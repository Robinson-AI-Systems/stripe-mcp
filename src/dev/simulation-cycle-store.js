// V-5c1: account-scoped, atomic month-by-month TEST simulation intent.
// No provider calls here. A crash after marking an attempt leaves 'uncertain'.
const error=x=>{throw new TypeError(x);};
const account=x=>typeof x==='string'&&/^acct_[A-Za-z0-9]+$/.test(x);
const run=x=>typeof x==='string'&&/^run_[a-f0-9]{24}$/.test(x);
const invoice=x=>typeof x==='string'&&/^in_[A-Za-z0-9]{2,100}$/.test(x);
const payment=x=>x===null||typeof x==='string'&&
  /^pi_[A-Za-z0-9]{2,100}$/.test(x);
const key=x=>typeof x==='string'&&x.length>=1&&x.length<=128;
const unix=x=>Number.isSafeInteger(x)&&x>=946684800&&x<=4102444800;
function scope({accountId,runId}){
  if(!account(accountId)||!run(runId))
    error('An exact selected-account TEST simulation run is required');
}
export async function initDevSimulationCycleTables(sql){
  await sql`CREATE TABLE IF NOT EXISTS dev_simulation_cycles (
    run_id TEXT NOT NULL REFERENCES dev_runs(id),
    cycle INTEGER NOT NULL CHECK (cycle BETWEEN 1 AND 3),
    request_key TEXT NOT NULL,
    target_frozen_time BIGINT NOT NULL
      CHECK (target_frozen_time BETWEEN 946684800 AND 4102444800),
    state TEXT NOT NULL DEFAULT 'reserved'
      CHECK (state IN ('reserved','uncertain','observed')),
    invoice_id TEXT,
    invoice_status TEXT,
    payment_intent_id TEXT,
    payment_status TEXT,
    observed_clock_time BIGINT,
    attempted_at TIMESTAMPTZ,
    observed_at TIMESTAMPTZ,
    PRIMARY KEY(run_id,cycle),
    UNIQUE(run_id,request_key),
    CHECK((state='observed')=(observed_at IS NOT NULL))
  )`;
  await sql`CREATE INDEX IF NOT EXISTS dev_simulation_cycles_state
    ON dev_simulation_cycles(run_id,state,cycle)`;
}
export function createDevSimulationCycleStore(sql){
  return {
    async getDevSimulationCycles({accountId,runId}){
      scope({accountId,runId});
      const rows=await sql`SELECT c.cycle,c.request_key,c.target_frozen_time,
        c.state,c.invoice_id,c.invoice_status,c.payment_intent_id,
        c.payment_status,c.observed_clock_time,c.attempted_at,c.observed_at
        FROM dev_simulation_cycles c JOIN dev_runs r ON r.id=c.run_id
        WHERE r.stripe_account=${accountId} AND r.id=${runId}
          AND r.scenario='subscription-simulation'
        ORDER BY c.cycle`;
      return rows.map(x=>({
        cycle:x.cycle,requestKey:x.request_key,targetFrozenTime:Number(x.target_frozen_time),
        state:x.state,invoiceId:x.invoice_id??null,
        invoiceStatus:x.invoice_status??null,
        paymentIntentId:x.payment_intent_id??null,
        paymentStatus:x.payment_status??null,
        observedClockTime:x.observed_clock_time===null?null:Number(x.observed_clock_time),
        attemptedAt:x.attempted_at??null,observedAt:x.observed_at??null
      }));
    },
    async reserveDevSimulationCycle({accountId,runId,cycle,requestKey,targetFrozenTime}){
      scope({accountId,runId});
      if(!Number.isInteger(cycle)||cycle<1||cycle>3||
        !key(requestKey)||!unix(targetFrozenTime))
        error('Exact monthly cycle, retry key and target time required');
      // Only one cycle per run and only when prior cycle is independently
      // observed. Prevent concurrent duplicate advances from different clients.
      const inserted=await sql`INSERT INTO dev_simulation_cycles
        (run_id,cycle,request_key,target_frozen_time)
        SELECT r.id,${cycle},${requestKey},${targetFrozenTime}
        FROM dev_runs r WHERE r.id=${runId}
          AND r.stripe_account=${accountId}
          AND r.scenario='subscription-simulation'
          AND r.status='completed' AND r.size>=${cycle}
          AND (${cycle}=1 OR EXISTS(
            SELECT 1 FROM dev_simulation_cycles prev
              WHERE prev.run_id=r.id AND prev.cycle=${cycle}-1
                AND prev.state='observed'))
        ON CONFLICT (run_id,cycle) DO NOTHING
        RETURNING cycle`;
      if(inserted.length===1)return {cycle,newlyReserved:true};
      const rows=await this.getDevSimulationCycles({accountId,runId});
      const prior=rows.find(x=>x.cycle===cycle);
      if(!prior||prior.requestKey!==requestKey||
        prior.targetFrozenTime!==targetFrozenTime)
        error('Cycle unavailable, not sequential, or already bound to another immutable target');
      return {cycle,newlyReserved:false};
    },
    async beginDevSimulationCycle({accountId,runId,cycle,requestKey,targetFrozenTime}){
      scope({accountId,runId});
      if(!Number.isInteger(cycle)||cycle<1||cycle>3||
        !key(requestKey)||!unix(targetFrozenTime))
        error('Invalid exact TEST cycle advancement');
      // This state change happens BEFORE contacting Stripe. Even if HTTP
      // succeeds and our process is interrupted, an idempotent retry cannot
      // automatically send a second advance.
      const rows=await sql`UPDATE dev_simulation_cycles c
        SET state='uncertain',attempted_at=now()
        FROM dev_runs r WHERE c.run_id=r.id
          AND r.id=${runId} AND r.stripe_account=${accountId}
          AND r.scenario='subscription-simulation'
          AND c.cycle=${cycle} AND c.request_key=${requestKey}
          AND c.target_frozen_time=${targetFrozenTime}
          AND c.state='reserved'
        RETURNING c.cycle`;
      return rows.length===1;
    },
    async observeDevSimulationCycle({
      accountId,runId,cycle,requestKey,targetFrozenTime,
      observedClockTime,invoiceId,invoiceStatus,paymentIntentId=null,
      paymentStatus='unavailable'
    }){
      scope({accountId,runId});
      if(!Number.isInteger(cycle)||cycle<1||cycle>3||
        !key(requestKey)||!unix(targetFrozenTime)||
        observedClockTime!==targetFrozenTime||
        !invoice(invoiceId)||!payment(paymentIntentId)||
        !['paid','open','void','uncollectible'].includes(invoiceStatus)||
        !['succeeded','requires_payment_method','requires_action',
          'processing','canceled','unavailable'].includes(paymentStatus)||
        (invoiceStatus==='paid'&&paymentStatus!=='succeeded'))
        error('Independent exact ready clock, invoice and payment observations required');
      const rows=await sql`UPDATE dev_simulation_cycles c
        SET state='observed',invoice_id=${invoiceId},
          invoice_status=${invoiceStatus},
          payment_intent_id=${paymentIntentId},
          payment_status=${paymentStatus},
          observed_clock_time=${observedClockTime},
          observed_at=now()
        FROM dev_runs r WHERE c.run_id=r.id
          AND r.id=${runId} AND r.stripe_account=${accountId}
          AND r.scenario='subscription-simulation'
          AND c.cycle=${cycle} AND c.request_key=${requestKey}
          AND c.target_frozen_time=${targetFrozenTime}
          AND c.state='uncertain'
        RETURNING c.cycle`;
      return rows.length===1;
    }
  };
}
