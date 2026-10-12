import {serveRtc} from '../../src/core/rtc-route.js';
export default (req,res)=>serveRtc(req,res,'result',req.query?.handle);
