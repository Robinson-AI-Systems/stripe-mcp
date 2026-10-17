// CI-only independent RTC HTTP process against the parent's disposable schema.
// Never load an owner key or accept an external/database host.
import {createServer} from 'node:http';
import pg from 'pg';
import {createDb} from '../src/db.js';
import {registry} from '../src/tools/index.js';
import {createRtcReadOnlyHttpHandler} from '../src/core/rtc-http.js';

const dsn=process.env.TEST_DATABASE_URL, schema=process.env.RTC_TEST_SCHEMA;
if(!dsn||!['localhost','127.0.0.1','::1'].includes(new URL(dsn).hostname)||
   !/^stripe_mcp_test_[a-f0-9]{12}$/.test(schema||'')||!process.send)
  throw Error('Disposable local PostgreSQL and private IPC are mandatory');
const client=new pg.Client({connectionString:dsn});
await client.connect();
await client.query('SET search_path TO "'+schema+'"');
const sql=async(parts,...values)=>{
  let statement=parts[0];
  for(let i=0;i<values.length;i++)statement+='$'+(i+1)+parts[i+1];
  return (await client.query(statement,values)).rows;
};
const rtc=createRtcReadOnlyHttpHandler({db:createDb(sql),registry});
const server=createServer(async(req,res)=>{
  res.status=n=>{res.statusCode=n;return res;};
  res.send=body=>{res.end(body);return res;};
  try{
    const url=new URL(req.url,'http://127.0.0.1');
    req.query=Object.fromEntries(url.searchParams);
    if(url.pathname==='/api/whoami')return await rtc(req,res,'whoami');
    return res.status(404).send('{"ok":false}');
  }catch{
    if(!res.writableEnded)res.status(503).send('{"ok":false,"error":{"code":"service_error"}}');
  }
});
const close=async()=>{
  await new Promise(resolve=>server.close(resolve));
  await client.end().catch(()=>{});
  process.exit(0);
};
process.once('disconnect',()=>{void close();});
server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));
