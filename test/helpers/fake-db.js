// Test-only fake that mirrors the A-2 schema and A-3 OAuth store behavior.
import { SCHEMA_TABLES, connectionSettings } from '../../src/db.js';
import { hashToken } from '../../src/core/oauth.js';

export function createFakeDb({ clock = () => Date.now(), accounts = [] } = {}) {
  const rows = new Map();
  const createdTables = new Set();
  const clients = new Map();
  const codes = new Map();
  const tokens = new Map();
  const attempts = [];
  const accountRows = new Map(accounts.map(a => [a.id, structuredClone(a)]));
  const encryptedTestKeys = new Map();
  const oneTimeSecrets = new Map();
  const audit = [];
  const reservations = [];
  const approvals = [];
  const liveIntents = [];
  const revokeIntents = [];
  const disableIntents = [];
  const defaultIntents = [];
  const limitIntents = [];
  const moneyConsentIntents = [];
  return {
    async initSchema() { for (const table of SCHEMA_TABLES) createdTables.add(table); },
    async listTables() { return [...createdTables].sort(); },
    async put(key, value) { rows.set(key, structuredClone(value)); },
    async get(key) { return rows.has(key) ? structuredClone(rows.get(key)) : null; },
    async createOAuthClient({ clientId, clientSecret, redirectUris, clientName }) {
      if (clients.has(clientId)) throw new Error('duplicate client');
      clients.set(clientId, { client_id: clientId, client_secret_hash: hashToken(clientSecret),
        redirect_uris: structuredClone(redirectUris), client_name: clientName || null });
    },
    async getOAuthClient(id) { return structuredClone(clients.get(id) || null); },
    async createAuthCode({ code, clientId, redirectUri, codeChallenge, codeChallengeMethod = 'S256',
      stripeAccount = null, mode = 'test', profile = 'everyday', listing = 'catalog', ttlSeconds = 600 }) {
      codes.set(hashToken(code), { client_id: clientId, redirect_uri: redirectUri,
        code_challenge: codeChallenge, code_challenge_method: codeChallengeMethod,
        stripe_account: stripeAccount, mode, profile, listing, expires_at: clock() + ttlSeconds * 1000 });
    },
    async consumeAuthCode(code) {
      const key = hashToken(code);
      const row = codes.get(key);
      codes.delete(key);
      return row && row.expires_at > clock() ? structuredClone(Object.fromEntries(
        Object.entries(row).filter(([name]) => name !== 'expires_at'))) : null;
    },
    async createAccessToken({ accessToken, refreshToken, clientId, stripeAccount = null,
      mode = 'test', profile = 'everyday', listing = 'catalog', ttlSeconds = 3600 }) {
      tokens.set(hashToken(accessToken), { token_hash: hashToken(accessToken),
        refresh_hash: refreshToken ? hashToken(refreshToken) : null, client_id: clientId,
        stripe_account: stripeAccount, mode, profile, listing, kind: 'connector',
        expires_at: clock() + ttlSeconds * 1000, revoked_at: null });
    },
    async getAccessToken(accessToken) {
      const row = tokens.get(hashToken(accessToken));
      if (!row || row.revoked_at || row.expires_at <= clock()) return null;
      return { client_id: row.client_id, ...connectionSettings(row), kind: row.kind,
        expires_at: new Date(row.expires_at), revoked_at: null };
    },
    async getTokenByRefreshToken(refreshToken) {
      const key = hashToken(refreshToken);
      const row = [...tokens.values()].find((item) => item.refresh_hash === key &&
        !item.revoked_at);
      return row ? { client_id: row.client_id, ...connectionSettings(row) } : null;
    },
    async rotateRefreshToken({ refreshToken, clientId, accessToken, newRefreshToken,
      ttlSeconds = 3600 }) {
      const row = [...tokens.values()].find((item) => item.refresh_hash === hashToken(refreshToken) &&
        item.client_id === clientId && !item.revoked_at);
      if (!row) return null;
      tokens.delete(row.token_hash);
      row.token_hash = hashToken(accessToken);
      row.refresh_hash = hashToken(newRefreshToken);
      row.expires_at = clock() + ttlSeconds * 1000;
      tokens.set(row.token_hash, row);
      return { client_id: row.client_id, ...connectionSettings(row) };
    },
    async revokeAccessToken(accessToken) {
      const row = tokens.get(hashToken(accessToken));
      if (!row || row.revoked_at) return false;
      row.revoked_at = clock();
      return true;
    },
    async recordLoginAttempt(ip) {
      const id = attempts.length + 1;
      attempts.push({ id, ip, success: false, at: clock() });
      return id;
    },
    async markLoginAttemptSucceeded(id) {
      const row = attempts.find((a) => a.id === id);
      if (row) row.success = true;
    },
    async countRecentFailedLogins(ip, minutes) {
      return attempts.filter((a) => a.ip === ip && !a.success && a.at > clock() - minutes * 60000).length;
    },
    async listStripeAccounts() { return structuredClone([...accountRows.values()].map(a => ({
      ...a, test_connected: encryptedTestKeys.has(a.id), live_connected: !!a.live_connected
    }))); },
    async getStripeAccount(id) {
      const account = accountRows.get(id);
      if (!account) return null;
      const saved = encryptedTestKeys.get(id);
      return structuredClone({ ...account, test_key_kind: saved?.kind || null,
        test_key_last4: saved?.last4 || null, key_permissions: saved?.permissions || {},
        money_limit_cents: account.money_limit_cents ?? 50000, test_connected: !!saved,
        live_connected: !!account.live_connected });
    },
    async saveTestKey({ account, label, ciphertext, kind, last4, permissions = {} }) {
      const before = accountRows.get(account) || { id: account, is_default: accountRows.size === 0,
        live_enabled: false };
      accountRows.set(account, { ...before, label });
      encryptedTestKeys.set(account, { ciphertext, kind, last4, permissions: structuredClone(permissions) });
    },
    async updateKeyPermissions({account,permissions,expectedCiphertext}) {
      if (typeof expectedCiphertext!=='string' || !expectedCiphertext ||
          typeof account!=='string' || !/^acct_[A-Za-z0-9]+$/.test(account) ||
          !permissions || typeof permissions!=='object' || Array.isArray(permissions) ||
          !Object.values(permissions).every(v=>v==='ok'||v==='denied')) {
        throw new TypeError('Invalid verified permissions');
      }
      const stored=encryptedTestKeys.get(account);
      if (!stored || stored.ciphertext!==expectedCiphertext) return false;
      stored.permissions=structuredClone(permissions);
      return true;
    },
    async getEncryptedKey({ account, mode }) {
      if (mode !== 'test') return null;
      const row = encryptedTestKeys.get(account);
      return row ? { ciphertext: row.ciphertext } : null;
    },
    async addOneTimeSecret({ id, account, mode, kind, ciphertext, expiresAt }) {
      oneTimeSecrets.set(id, { stripe_account: account, mode, kind, ciphertext,
        expires_at: new Date(expiresAt).getTime() });
    },
    async consumeOneTimeSecret(id) {
      const row = oneTimeSecrets.get(id);
      oneTimeSecrets.delete(id);
      return row && row.expires_at > clock() ? structuredClone(Object.fromEntries(
        Object.entries(row).filter(([name]) => name !== 'expires_at'))) : null;
    },
    async createLiveEnableIntent({ id, account, expiresAt }) {
      if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{32,64}$/.test(id) ||
          !accountRows.has(account) || !(expiresAt instanceof Date)) throw new TypeError('Invalid live intent');
      liveIntents.push({ id, account, expiresAt:expiresAt.getTime(), consumedAt:null });
      return true;
    },
    async getLiveEnableIntent(id) {
      const row=liveIntents.find(x=>x.id===id&&x.consumedAt===null&&x.expiresAt>clock());
      const account=row?accountRows.get(row.account):null;
      return row ? {id:row.id,stripe_account:row.account,label:account.label,
        expires_at:new Date(row.expiresAt)} : null;
    },
    async consumeLiveEnableIntent({id,allowActivation=false}) {
      if (allowActivation!==true) return false;
      const row=liveIntents.find(x=>x.id===id&&x.consumedAt===null&&x.expiresAt>clock());
      if (!row) return false;
      row.consumedAt=clock();
      const account=accountRows.get(row.account);
      if (!account?.live_connected) return false;
      account.live_enabled=true;
      audit.push({stripe_account:row.account,mode:'live',tool:'stripe_enable_live',
        summary:'Owner independently approved LIVE mode for this account',dry_run:false});
      return true;
    },
    async requestMoneyLimitIntent({id,account,newLimitCents,expiresAt}) {
      if (typeof id!=='string' || !/^[A-Za-z0-9_-]{32,64}$/.test(id) ||
          typeof account!=='string' || !/^acct_[A-Za-z0-9]+$/.test(account) ||
          !Number.isSafeInteger(newLimitCents) || newLimitCents<0 ||
          newLimitCents>2147483647 || !(expiresAt instanceof Date) ||
          !Number.isFinite(expiresAt.getTime()))
        throw new TypeError('Invalid owner money-limit intent');
      if (!accountRows.has(account)||!encryptedTestKeys.has(account)) return false;
      const current=accountRows.get(account).money_limit_cents??50000;
      if(current===newLimitCents)return false;
      limitIntents.push({id,account,expected:current,newLimitCents,
        expiresAt:expiresAt.getTime(),consumedAt:null});
      return true;
    },
    async getMoneyLimitIntent(id) {
      const r=limitIntents.find(x=>x.id===id&&x.consumedAt===null&&x.expiresAt>clock());
      return r?{id:r.id,stripe_account:r.account,
        label:accountRows.get(r.account)?.label??r.account,
        expected_limit_cents:r.expected,new_limit_cents:r.newLimitCents,
        expires_at:new Date(r.expiresAt)}:null;
    },
    async consumeMoneyLimitIntent(id) {
      const r=limitIntents.find(x=>x.id===id&&x.consumedAt===null&&x.expiresAt>clock());
      if(!r || !encryptedTestKeys.has(r.account))return false;
      const current=accountRows.get(r.account).money_limit_cents??50000;
      if(current!==r.expected)return false;
      r.consumedAt=clock();
      accountRows.get(r.account).money_limit_cents=r.newLimitCents;
      audit.push({id:audit.length+1,stripe_account:r.account,mode:'test',
        tool:'stripe_set_money_limit',target:r.account,
        summary:'Owner changed the daily USD money-out account limit from the private setup page',
        before:{limit_cents:current},after:{limit_cents:r.newLimitCents},
        dry_run:false,at:new Date(clock())});
      return true;
    },
    async requestDefaultAccountIntent({id,account,expiresAt}) {
      if (typeof id!=='string' || !/^[A-Za-z0-9_-]{32,64}$/.test(id) ||
          typeof account!=='string' || !/^acct_[A-Za-z0-9]+$/.test(account) ||
          !(expiresAt instanceof Date) || !Number.isFinite(expiresAt.getTime()))
        throw new TypeError('Invalid default-account intent');
      if (!accountRows.has(account)||!encryptedTestKeys.has(account)||
          accountRows.get(account).is_default===true) return false;
      const previous=[...accountRows.values()].find(a=>a.is_default===true)?.id??null;
      defaultIntents.push({id,account,expectedDefault:previous,
        expiresAt:expiresAt.getTime(),consumedAt:null});
      return true;
    },
    async getDefaultAccountIntent(id) {
      const r=defaultIntents.find(x=>x.id===id&&x.consumedAt===null&&x.expiresAt>clock());
      return r?{id:r.id,stripe_account:r.account,
        expected_default:r.expectedDefault,
        label:accountRows.get(r.account)?.label??r.account,
        expires_at:new Date(r.expiresAt)}:null;
    },
    async consumeDefaultAccountIntent(id) {
      const r=defaultIntents.find(x=>x.id===id&&x.consumedAt===null&&x.expiresAt>clock());
      if(!r)return false;
      const nowDefault=[...accountRows.values()].find(a=>a.is_default===true)?.id??null;
      if(nowDefault!==r.expectedDefault || !encryptedTestKeys.has(r.account))return false;
      r.consumedAt=clock();
      for(const a of accountRows.values())a.is_default=(a.id===r.account);
      audit.push({id:audit.length+1,stripe_account:r.account,mode:'test',
        tool:'stripe_set_default_account',target:r.account,
        summary:'Owner selected this account as default on the private setup page',
        dry_run:false,at:new Date(clock())});
      return true;
    },
    async requestDisableLiveIntent({id,account,expiresAt}) {
      if (typeof id!=='string' || !/^[A-Za-z0-9_-]{32,64}$/.test(id) ||
          typeof account!=='string' || !/^acct_[A-Za-z0-9]+$/.test(account) ||
          !(expiresAt instanceof Date) || !Number.isFinite(expiresAt.getTime()))
        throw new TypeError('Invalid LIVE-disable intent');
      if (accountRows.get(account)?.live_enabled!==true) return false;
      disableIntents.push({id,account,expiresAt:expiresAt.getTime(),consumedAt:null});
      return true;
    },
    async getDisableLiveIntent(id) {
      const r=disableIntents.find(x=>x.id===id&&x.consumedAt===null&&
        x.expiresAt>clock()&&accountRows.get(x.account)?.live_enabled===true);
      return r ? {id:r.id,stripe_account:r.account,
        label:accountRows.get(r.account)?.label??r.account,
        expires_at:new Date(r.expiresAt)} : null;
    },
    async consumeDisableLiveIntent(id) {
      const r=disableIntents.find(x=>x.id===id&&x.consumedAt===null&&
        x.expiresAt>clock()&&accountRows.get(x.account)?.live_enabled===true);
      if(!r) return false;
      r.consumedAt=clock();
      accountRows.get(r.account).live_enabled=false;
      audit.push({id:audit.length+1,stripe_account:r.account,mode:'live',
        tool:'stripe_disable_live',target:r.account,
        summary:'Owner disabled LIVE connection access using the private setup page',
        dry_run:false,at:new Date(clock())});
      return true;
    },
    async requestConnectionRevokeIntent({id,account,clientId,expiresAt}) {
      if (typeof id!=='string' || !/^[A-Za-z0-9_-]{32,64}$/.test(id) ||
          typeof account!=='string' || !/^acct_[A-Za-z0-9]+$/.test(account) ||
          typeof clientId!=='string' || !/^[A-Za-z0-9:_-]{1,160}$/.test(clientId) ||
          !(expiresAt instanceof Date)) throw new TypeError('Invalid owner intent');
      if (![...tokens.values()].some(t=>t.stripe_account===account&&t.client_id===clientId&&
          t.kind==='connector'&&!t.revoked_at)) return false;
      revokeIntents.push({id,account,clientId,expiresAt:expiresAt.getTime(),consumedAt:null});
      return true;
    },
    async getConnectionRevokeIntent(id) {
      const r=revokeIntents.find(x=>x.id===id&&x.consumedAt===null&&x.expiresAt>clock());
      return r ? {id:r.id,stripe_account:r.account,client_id:r.clientId,
        label:accountRows.get(r.account)?.label??r.account,expires_at:new Date(r.expiresAt)} : null;
    },
    async consumeConnectionRevokeIntent(id) {
      const r=revokeIntents.find(x=>x.id===id&&x.consumedAt===null&&x.expiresAt>clock());
      if (!r) return false;
      const eligible=[...tokens.values()].filter(t=>t.stripe_account===r.account&&
        t.client_id===r.clientId&&t.kind==='connector'&&!t.revoked_at);
      if(!eligible.length)return false;
      r.consumedAt=clock();
      for(const t of eligible)t.revoked_at=clock();
      audit.push({id:audit.length+1,stripe_account:r.account,mode:'test',
        tool:'stripe_revoke_connection',target:r.clientId,
        summary:'Owner revoked this account connection from the private setup page',
        dry_run:false,at:new Date(clock())});
      return true;
    },
    async requestMoneyConsentIntent({id,account,idempotencyKey,expiresAt}) {
      if(typeof id!=='string'||!/^[A-Za-z0-9_-]{32,64}$/.test(id)||
          !/^acct_[A-Za-z0-9]+$/.test(account)||
          typeof idempotencyKey!=='string'||!idempotencyKey||
          idempotencyKey.length>128||!(expiresAt instanceof Date))
        throw new TypeError('Invalid owner consent intent');
      const row=approvals.find(a=>a.account===account&&a.key===idempotencyKey&&
        a.mode==='test'&&a.currency==='usd'&&a.target!==''&&
        a.approvedAt===null&&a.consumedAt===null&&a.expiresAt>clock());
      if(!row)return false;
      moneyConsentIntents.push({id,account,key:idempotencyKey,tool:row.tool,
        target:row.target,amountCents:row.amountCents,
        expiresAt:expiresAt.getTime(),consumedAt:null});
      return true;
    },
    async getMoneyConsentIntent(id) {
      const i=moneyConsentIntents.find(x=>x.id===id&&x.consumedAt===null&&x.expiresAt>clock());
      if(!i)return null;
      const a=approvals.find(x=>x.account===i.account&&x.key===i.key&&
        x.tool===i.tool&&x.target===i.target&&x.amountCents===i.amountCents&&
        x.mode==='test'&&x.currency==='usd'&&x.approvedAt===null&&
        x.consumedAt===null&&x.expiresAt>clock());
      if(!a)return null;
      return {id:i.id,stripe_account:i.account,request_key:i.key,tool:i.tool,
        target:i.target,amount_cents:i.amountCents,
        expires_at:new Date(i.expiresAt),description:a.description,
        currency:'usd',mode:'test',
        label:accountRows.get(i.account)?.label||i.account,
        money_limit_cents:accountRows.get(i.account)?.money_limit_cents??50000};
    },
    async consumeMoneyConsentIntent(id) {
      const i=moneyConsentIntents.find(x=>x.id===id&&x.consumedAt===null&&x.expiresAt>clock());
      if(!i)return false;
      const a=approvals.find(x=>x.account===i.account&&x.key===i.key&&
        x.tool===i.tool&&x.target===i.target&&x.amountCents===i.amountCents&&
        x.mode==='test'&&x.currency==='usd'&&x.approvedAt===null&&
        x.consumedAt===null&&x.expiresAt>clock());
      if(!a)return false;
      i.consumedAt=clock();a.approvedAt=clock();
      audit.push({id:audit.length+1,stripe_account:i.account,mode:'test',
        tool:'owner_approve_money_request',target:i.target,
        summary:'Owner independently approved one exact TEST money-out request',
        amount_cents:i.amountCents,currency:'usd',dry_run:false,at:new Date(clock())});
      return true;
    },
    async requestMoneyApproval({account,idempotencyKey,tool,description,
      amountCents,currency,target='',mode='test'}) {
      if (![account,idempotencyKey,tool,description].every(x=>typeof x==='string'&&x) ||
          !/^acct_[A-Za-z0-9]+$/.test(account) ||
          !Number.isSafeInteger(amountCents)||amountCents<=0||currency!=='usd'||
          description.length>240||mode!=='test'||typeof target!=='string'||
          (target!=='' && !/^(?:ch|py|po|tr|re|pi|in|cus|acct|ba|src|pm|sub|txn|bt)_[A-Za-z0-9]{2,100}$/.test(target)))
        throw new TypeError('Invalid provider money approval request');
      if(!accountRows.has(account))return false;
      let row=approvals.find(a=>a.account===account&&a.key===idempotencyKey);
      if(!row){
        row={account,key:idempotencyKey,tool,description,amountCents,currency,
          target,mode,expiresAt:clock()+86400000,approvedAt:null,
          allowOverLimit:false,overrideApprovedAt:null,consumedAt:null};
        approvals.push(row);
      }
      return row.tool===tool&&row.description===description&&
        row.amountCents===amountCents&&row.currency===currency&&
        row.target===target&&row.mode===mode&&row.consumedAt===null&&
        row.expiresAt>clock();
    },
    async listPendingMoneyApprovals({account,limit=10}){
      if(!/^acct_[A-Za-z0-9]+$/.test(account)||!Number.isInteger(limit)||
          limit<1||limit>20)throw new TypeError('Invalid pending money filter');
      return structuredClone(approvals.filter(r=>r.account===account&&
        r.target!==''&&r.mode==='test'&&r.consumedAt===null&&
        r.expiresAt>clock()).slice().reverse().slice(0,limit)
        .map(r=>({request_key:r.key,tool:r.tool,target:r.target,
          description:r.description,amount_cents:r.amountCents,
          currency:r.currency,mode:r.mode,created_at:null,
          expires_at:new Date(r.expiresAt),approved_at:r.approvedAt?
            new Date(r.approvedAt):null,override_approved_at:r.overrideApprovedAt?
            new Date(r.overrideApprovedAt):null,allow_over_limit:r.allowOverLimit})));
    },
    // Simulates authenticated owner action. Never expose this as an AI operation.
    async approveMoneyRequest({ account, idempotencyKey, allowOverLimit = false }) {
      if (allowOverLimit !== false) throw new TypeError('Separate owner override action required');
      const row=approvals.find(a => a.account === account && a.key === idempotencyKey &&
        a.target!=='' && a.mode==='test' &&
        a.consumedAt === null && a.expiresAt > clock());
      if (!row) return false;
      row.approvedAt=clock();
      return true;
    },
    async approveMoneyOverride({ account, idempotencyKey }) {
      const row=approvals.find(a => a.account === account && a.key === idempotencyKey &&
        a.approvedAt !== null && a.approvedAt >= clock() - 600000 &&
        a.target!=='' && a.mode==='test' && a.consumedAt === null && a.expiresAt > clock());
      if (!row) return false;
      row.allowOverLimit=true; row.overrideApprovedAt=clock();
      return true;
    },
    async listMoneyApprovalsForTest() { return structuredClone(approvals); },
    async reserveMoneyOut({ account, connection, idempotencyKey, amountCents, currency }) {
      if (![account, connection, idempotencyKey].every(x => typeof x === 'string' && x) ||
          !Number.isSafeInteger(amountCents) || amountCents <= 0 || !/^[a-z]{3}$/.test(currency)) {
        throw new TypeError('Invalid money reservation');
      }
      if (currency !== 'usd') return { decision: 'currency_unsupported',
        used_cents: 0, limit_cents: 0 };
      const row = accountRows.get(account);
      if (!row) return { decision: 'account_missing', used_cents: 0, limit_cents: 0 };
      const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver',
        year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(clock()));
      const existing = reservations.find(r => r.account === account && r.key === idempotencyKey);
      const limit_cents = row.money_limit_cents ?? 50000;
      const used_cents = reservations.filter(r => r.account === account &&
        r.day === day && r.state !== 'rejected').reduce((sum, r) => sum + r.amountCents, 0);
      if (existing) return { decision: existing.amountCents !== amountCents ||
        existing.currency !== currency ? 'request_conflict' :
          existing.day !== day ? 'previous_day' : 'already_' + existing.state,
        used_cents, limit_cents };
      const approval = approvals.find(a => a.account === account && a.key === idempotencyKey);
      if (!approval || approval.amountCents !== amountCents || approval.currency !== currency ||
          approval.approvedAt === null || approval.consumedAt !== null ||
          approval.expiresAt <= clock() || approval.approvedAt < clock() - 600000) {
        return { decision:'owner_approval_required', used_cents, limit_cents };
      }
      if (used_cents > limit_cents - amountCents &&
          (!approval.allowOverLimit || approval.overrideApprovedAt === null)) {
        return { decision:'limit_exceeded_override_required', used_cents, limit_cents };
      }
      approval.consumedAt=clock();
      reservations.push({ account, connection, key: idempotencyKey, amountCents, currency,
        day, state: 'reserved' });
      return { decision: 'reserved', used_cents: used_cents + amountCents, limit_cents };
    },
    async settleMoneyReservation({ account, connection, idempotencyKey, state }) {
      if (!['confirmed', 'uncertain', 'rejected'].includes(state)) throw new TypeError('Invalid reservation state');
      const row = reservations.find(r => r.account === account && r.connection === connection &&
        r.key === idempotencyKey && r.state === 'reserved');
      if (!row) return false;
      row.state = state;
      return true;
    },
    async getMoneyUsage({ account, connection: _connection }) {
      const row = accountRows.get(account);
      if (!row) return null;
      const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver',
        year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(clock()));
      return { used_cents: reservations.filter(r => r.account === account &&
        r.day === day && r.state !== 'rejected').reduce((sum, r) => sum + r.amountCents,0),
        limit_cents: row.money_limit_cents ?? 50000 };
    },
    async listRecentChanges({account,mode=null,limit=20,offset=0}) {
      if (!account || (mode!==null&&!['test','live'].includes(mode)) ||
          !Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(offset)||offset<0||offset>1000000) throw new TypeError('Invalid audit filter');
      return structuredClone(audit.filter(r=>r.stripe_account===account&&(!mode||r.mode===mode))
        .slice().reverse().slice(offset,offset+limit).map(r=>Object.fromEntries(
          Object.entries(r).filter(([name])=>!['inverse','before','after'].includes(name)))));
    },
    async listConnectionsForAccount({account,limit=50,offset=0}) {
      if (!account||!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(offset)||offset<0||offset>1000000) {
        throw new TypeError('Invalid account connection filter');
      }
      return structuredClone([...tokens.values()].filter(r=>r.stripe_account===account)
        .slice(offset,offset+limit).map(r=>({
          client_id:r.client_id,mode:r.mode,profile:r.profile,listing:r.listing,
          created_at:null,last_used_at:null,expires_at:new Date(r.expires_at),
          revoked_at:r.revoked_at?new Date(r.revoked_at):null
        })));
    },
    async recordChange({ account = null, mode = 'test', connection = null,
      tool, summary, dryRun = false, idempotencyKey = null, inverse = null,
      amountCents = null, currency = null, direction = null }) {
      if (!tool || !summary) throw new TypeError('Tool and summary required for audit');
      const row = { id: audit.length + 1, stripe_account: account, mode, connection,
        tool, summary, dry_run: dryRun, idempotency_key: idempotencyKey,
        inverse: structuredClone(inverse), amount_cents: amountCents, currency, direction,
        at: new Date(clock()) };
      audit.push(row);
      return row.id;
    },
    async listAuditForTest() { return structuredClone(audit); },
    async tokenRowsForTest() { return structuredClone([...tokens.values()]); }
  };
}
