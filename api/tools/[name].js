import {serveRtc} from '../../src/core/rtc-route.js';
export default (req,res)=>serveRtc(req,res,req.query?.name==='_batch'?'batch':
  req.method==='GET'?'describe':'call',req.query?.name);
