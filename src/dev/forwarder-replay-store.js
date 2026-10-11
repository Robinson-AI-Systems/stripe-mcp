// V-4c2 durable per-account replay reservations and exact per-event HTTP receipts.
// An attempted event is NEVER automatically sent again under the same retry key.
const fail=x=>{throw new TypeError(x);};
const account=x=>typeof x==='string'&&/^acct_[A-Za-z0-9]+$/.test(x);
const forwarder=x=>typeof x==='string'&&/^fwd_[a-f0-9]{32}$/.test(x);
const replay=x=>typeof x==='string'&&/^rpl_[a-f0-9]{24}$/.test(x);
const event=x=>typeof x==='string'&&/^evt_[A-Za-z0-9]{2,100}$/.test(x);
const validKey=x=>typeof x==='string'&&x.length>=1&&x.length<=128;
const digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
function check({accountId,requestKey}){
  if(!account(accountId)||!validKey(requestKey))
    fail('Selected TEST account and exact replay retry key required');
}
export async function initDevForwarderReplayTables(sql){
  await sql`CREATE TABLE IF NOT EXISTS dev_forwarder_replays (
    id TEXT PRIMARY KEY,
    stripe_account TEXT NOT NULL REFERENCES stripe_accounts(id),
    forwarder_id TEXT NOT NULL REFERENCES dev_forwarders(id),
    request_key TEXT NOT NULL,
    config_digest TEXT NOT NULL,
    event_ids TEXT[] NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(stripe_account,request_key),
    CHECK(cardinality(event_ids) BETWEEN 1 AND 5)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS dev_forwarder_replay_events (
    replay_id TEXT NOT NULL REFERENCES dev_forwarder_replays(id),
    event_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'reserved'
      CHECK(status IN ('reserved','uncertain','accepted','rejected')),
    status_code INTEGER,
    attempted_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    PRIMARY KEY(replay_id,event_id)
  )`;
  await sql`CREATE INDEX IF NOT EXISTS dev_forwarder_replays_account
    ON dev_forwarder_replays(stripe_account,created_at DESC)`;
}
export function createDevForwarderReplayStore(sql){
  return {
    async getDevForwarderReplay({accountId,requestKey}){
      check({accountId,requestKey});
      const rows=await sql`SELECT id,forwarder_id,config_digest,event_ids,created_at
        FROM dev_forwarder_replays WHERE stripe_account=${accountId}
          AND request_key=${requestKey}`;
      if(!rows.length)return null;
      const row=rows[0];
      const receipts=await sql`SELECT event_id,status,status_code,attempted_at,finished_at
        FROM dev_forwarder_replay_events WHERE replay_id=${row.id}
        ORDER BY event_id`;
      return {id:row.id,forwarderId:row.forwarder_id,
        configDigest:row.config_digest,eventIds:row.event_ids,
        createdAt:row.created_at,receipts:receipts.map(x=>({
          eventId:x.event_id,status:x.status,statusCode:x.status_code,
          attemptedAt:x.attempted_at,finishedAt:x.finished_at
        }))};
    },
    async reserveDevForwarderReplay({
      accountId,forwarderId,requestKey,id,configDigest,eventIds
    }){
      check({accountId,requestKey});
      if(!forwarder(forwarderId)||!replay(id)||!digest(configDigest)||
        !Array.isArray(eventIds)||eventIds.length<1||eventIds.length>5||
        !eventIds.every(event)||new Set(eventIds).size!==eventIds.length)
        fail('Exact immutable TEST forwarder replay configuration required');
      // Data-modifying CTE reserves replay and every event atomically, while
      // proving the target still belongs to this account and is active.
      const inserted=await sql`WITH replay_insert AS (
        INSERT INTO dev_forwarder_replays
          (id,stripe_account,forwarder_id,request_key,config_digest,event_ids)
        SELECT ${id},${accountId},f.id,${requestKey},${configDigest},
          ${eventIds}::text[]
        FROM dev_forwarders f WHERE f.id=${forwarderId}
          AND f.stripe_account=${accountId} AND f.deleted_at IS NULL
        ON CONFLICT (stripe_account,request_key) DO NOTHING RETURNING id
      ), event_insert AS (
        INSERT INTO dev_forwarder_replay_events(replay_id,event_id)
        SELECT replay_insert.id,unnest(${eventIds}::text[]) FROM replay_insert
        RETURNING event_id
      ) SELECT replay_insert.id,
        (SELECT count(*) FROM event_insert)::int AS reserved
        FROM replay_insert`;
      if(inserted.length===1&&Number(inserted[0].reserved)===eventIds.length)
        return {id:inserted[0].id,newlyReserved:true};
      const prior=await this.getDevForwarderReplay({accountId,requestKey});
      if(!prior||prior.forwarderId!==forwarderId||
        prior.configDigest!==configDigest||
        prior.eventIds?.join('|')!==eventIds.join('|')||
        prior.receipts?.length!==eventIds.length)
        fail('Replay key is unavailable or belongs to a different immutable selection');
      return {id:prior.id,newlyReserved:false};
    },
    async markDevForwarderReplayAttempt({accountId,requestKey,id,eventId}){
      check({accountId,requestKey});
      if(!replay(id)||!event(eventId))fail('Exact replay event required');
      const rows=await sql`UPDATE dev_forwarder_replay_events e
        SET status='uncertain',attempted_at=now()
        WHERE e.replay_id=${id} AND e.event_id=${eventId}
          AND e.status='reserved' AND EXISTS (
            SELECT 1 FROM dev_forwarder_replays r
            JOIN dev_forwarders f ON f.id=r.forwarder_id
            WHERE r.id=e.replay_id AND r.stripe_account=${accountId}
              AND r.request_key=${requestKey} AND f.deleted_at IS NULL
              AND f.stripe_account=${accountId})
        RETURNING event_id`;
      return rows.length===1;
    },
    async recordDevForwarderReplayReceipt({
      accountId,requestKey,id,eventId,status,statusCode
    }){
      check({accountId,requestKey});
      if(!replay(id)||!event(eventId)||
        !['accepted','rejected'].includes(status)||
        !Number.isInteger(statusCode)||statusCode<100||statusCode>599||
        (status==='accepted')!==(statusCode>=200&&statusCode<300))
        fail('Verifiable HTTP status and matching replay outcome required');
      const rows=await sql`UPDATE dev_forwarder_replay_events e
        SET status=${status},status_code=${statusCode},finished_at=now()
        WHERE e.replay_id=${id} AND e.event_id=${eventId}
          AND e.status='uncertain' AND EXISTS (
            SELECT 1 FROM dev_forwarder_replays r
            WHERE r.id=e.replay_id AND r.stripe_account=${accountId}
              AND r.request_key=${requestKey})
        RETURNING event_id`;
      return rows.length===1;
    }
  };
}
