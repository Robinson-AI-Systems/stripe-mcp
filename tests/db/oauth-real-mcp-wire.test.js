// Real HTTP + isolated PostgreSQL + official MCP SDK public OAuth path.
// The client and Stripe account are synthetic. No hosted ingress, owner secret,
// live provider, actual Stripe request or remote OAuth acceptance is implied.
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {createServer} from 'node:http';
import {createHash,randomBytes} from 'node:crypto';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {createDb} from '../../src/db.js';
import {createOAuthHandlers} from '../../src/core/oauth-handlers.js';
import {createMcpHandler} from '../../src/core/mcp-server.js';
import {registry} from '../../src/tools/index.js';
import {openIsolatedSchema,closeIsolatedSchema,neonShapedQuery,rawQuery}
  from '../../test/helpers/pg-neon-adapter.js';

const account='acct_OAUTH_REAL_MCP';
const otherAccount='acct_OTHER_REAL_MCP';
const publicOrigin='https://stripe-auth.example.test';
const callback='http://localhost:34121/callback';
const resource=publicOrigin+'/api/mcp';
const passphrase='TEST-ONLY-NOT-A-REAL-OWNER-PASSWORD';
const env={PUBLIC_BASE_URL:publicOrigin,ADMIN_PASSPHRASE:passphrase};
let db,server,host;
function adapt(res){
  res.status=n=>{res.statusCode=n;return res;};
  res.send=value=>{res.end(value);return res;};
  res.json=value=>res.send(JSON.stringify(value));
}
function encode(data){return new URLSearchParams(data).toString();}
async function request(path,{method='GET',data,form=false,token}={}){
  const headers={
    ...(token?{authorization:'Bearer '+token}:{}),
    ...(data===undefined?{}:{'content-type':form?
      'application/x-www-form-urlencoded':'application/json'})
  };
  const response=await fetch(host+path,{method,headers,redirect:'manual',
    ...(data===undefined?{}:{body:form?encode(data):JSON.stringify(data)})});
  const raw=await response.text();
  return {status:response.status,body:raw,
    json:raw.startsWith('{')?JSON.parse(raw):null,
    location:response.headers.get('location')};
}
async function connect(token){
  const client=new Client({name:'stripe-test-oauth-wire',version:'1.0.0'},
    {capabilities:{}});
  const transport=new StreamableHTTPClientTransport(new URL(host+'/api/mcp'),
    {requestInit:{headers:{authorization:'Bearer '+token}}});
  await client.connect(transport);
  return client;
}
beforeAll(async()=>{
  const dsn=process.env.TEST_DATABASE_URL;
  if(!dsn||!['localhost','127.0.0.1','::1'].includes(new URL(dsn).hostname))
    throw Error('Disposable localhost PostgreSQL required');
  await openIsolatedSchema(dsn);
  db=createDb(neonShapedQuery());
  await db.initSchema();
  await rawQuery('INSERT INTO stripe_accounts(id,label,test_key_enc) VALUES($1,$2,$3),($4,$5,$6)',
    [account,'OAuth isolated TEST','v1.fake',otherAccount,'Other isolated TEST','v1.fake']);
  const oauth=createOAuthHandlers({db,env});
  const mcp=createMcpHandler({db,registry,env});
  server=createServer(async(req,res)=>{
    adapt(res);
    try{
      const url=new URL(req.url,'http://127.0.0.1');
      req.query=Object.fromEntries(url.searchParams);
      if(req.method==='POST'){
        const parts=[];
        for await(const part of req)parts.push(part);
        req.rawBody=Buffer.concat(parts);
        const raw=req.rawBody.toString('utf8');
        req.body=req.headers['content-type']?.startsWith('application/x-www-form-urlencoded')?
          raw:JSON.parse(raw);
      }
      if(url.pathname==='/api/oauth/register')return await oauth.register(req,res);
      if(url.pathname==='/api/oauth/authorize')return await oauth.authorize(req,res);
      if(url.pathname==='/api/oauth/token')return await oauth.token(req,res);
      if(url.pathname==='/api/mcp')return await mcp(req,res);
      return res.status(404).json({error:'not_found'});
    }catch{
      if(!res.writableEnded)res.status(503).json({error:'test_transport_failed'});
    }
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  host='http://127.0.0.1:'+server.address().port;
});
afterAll(async()=>{
  if(server)await new Promise((resolve,reject)=>
    server.close(e=>e?reject(e):resolve()));
  await closeIsolatedSchema();
});

describe('actual OAuth public PKCE -> MCP SDK HTTP acceptance boundary',()=>{
  it('registers, owner-selects TEST account, uses PKCE and keeps scope across refresh and revocation',
    async()=>{
      const reg=await request('/api/oauth/register',{method:'POST',data:{
        redirect_uris:[callback],token_endpoint_auth_method:'none',
        client_name:'Isolated SDK TEST client'
      }});
      expect(reg.status).toBe(201);
      expect(reg.json.client_secret).toBeUndefined();
      const clientId=reg.json.client_id;
      const verifier=randomBytes(32).toString('base64url');
      const challenge=createHash('sha256').update(verifier).digest('base64url');
      const auth={client_id:clientId,redirect_uri:callback,response_type:'code',
        code_challenge:challenge,code_challenge_method:'S256',resource,
        state:'sdk-wire-nonce',stripe_account:account,mode:'test',
        profile:'read_only',listing:'catalog'};
      const page=await request('/api/oauth/authorize?'+encode(auth));
      expect(page.status).toBe(200);
      expect(page.body).toContain('OAuth isolated TEST');
      expect(page.body).not.toContain(passphrase);
      const forbidden=await request('/api/oauth/authorize',{method:'POST',form:true,
        data:{...auth,mode:'live',passphrase}});
      expect(forbidden.status).toBe(400);
      const approved=await request('/api/oauth/authorize',{method:'POST',form:true,
        data:{...auth,passphrase}});
      expect(approved.status).toBe(302);
      const redirect=new URL(approved.location);
      expect(redirect.origin+redirect.pathname).toBe(callback);
      expect(redirect.searchParams.get('state')).toBe(auth.state);
      const code=redirect.searchParams.get('code');
      expect(code).toMatch(/^[A-Za-z0-9_-]{43}$/);

      const grant={grant_type:'authorization_code',client_id:clientId,
        redirect_uri:callback,code_verifier:verifier,resource,code};
      const issued=await request('/api/oauth/token',{method:'POST',form:true,data:grant});
      expect(issued.status).toBe(200);
      expect(issued.json).toMatchObject({token_type:'Bearer',expires_in:3600});
      expect((await request('/api/oauth/token',{method:'POST',form:true,
        data:grant})).json.error).toBe('invalid_grant');

      const first=await connect(issued.json.access_token);
      try{
        const catalog=await first.listTools();
        expect(catalog.tools.some(t=>t.name==='stripe_whoami')).toBe(true);
        expect(catalog.tools.some(t=>t.name==='stripe_payment_intent_create')).toBe(false);
        const result=await first.callTool({name:'stripe_whoami',arguments:{}});
        const observed=JSON.parse(result.content[0].text);
        expect(observed).toMatchObject({account,mode:'test',profile:'read_only'});
        expect(JSON.stringify(observed)).not.toContain(otherAccount);
      }finally{await first.close();}

      const rotated=await request('/api/oauth/token',{method:'POST',form:true,data:{
        grant_type:'refresh_token',client_id:clientId,
        refresh_token:issued.json.refresh_token,resource
      }});
      expect(rotated.status).toBe(200);
      expect(rotated.json.access_token).not.toBe(issued.json.access_token);
      expect((await db.getAccessToken(rotated.json.access_token)).stripe_account).toBe(account);
      expect(await db.getAccessToken(issued.json.access_token)).toBeNull();
      expect((await request('/api/oauth/token',{method:'POST',form:true,data:{
        grant_type:'refresh_token',client_id:clientId,
        refresh_token:issued.json.refresh_token,resource
      }})).json.error).toBe('invalid_grant');

      const second=await connect(rotated.json.access_token);
      try{
        const observed=JSON.parse((await second.callTool({
          name:'stripe_whoami',arguments:{}
        })).content[0].text);
        expect(observed).toMatchObject({account,mode:'test',profile:'read_only'});
      }finally{await second.close();}
      expect(await db.revokeAccessToken(rotated.json.access_token)).toBe(true);
      expect(await db.getAccessToken(rotated.json.access_token)).toBeNull();
      const refused=await request('/api/mcp',{method:'POST',
        token:rotated.json.access_token,
        data:{jsonrpc:'2.0',id:99,method:'tools/list',params:{}}});
      expect(refused.status).toBe(401);
      expect(refused.json.error).toBe('invalid_token');
      const revokedRefresh=await request('/api/oauth/token',{method:'POST',form:true,
        data:{grant_type:'refresh_token',client_id:clientId,
          refresh_token:rotated.json.refresh_token,resource}});
      expect(revokedRefresh.status).toBe(400);
    },20000);
});
