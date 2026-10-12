import {registry} from '../src/tools/index.js';
import {rtcManifest} from '../src/core/rtc-http.js';
import {send} from '../src/core/http.js';
export default function handler(req,res){
  if(req.method!=='GET')return send(res,405,{error:'method_not_allowed'});
  // Runtime Vercel system variables identify the *deployed* revision/branch,
  // not the newest GitHub main. Omit unavailable metadata; owner TEST
  // acceptance then fails closed rather than silently using stale code.
  return send(res,200,rtcManifest(registry,{
    sha:process.env.VERCEL_GIT_COMMIT_SHA,
    ref:process.env.VERCEL_GIT_COMMIT_REF,
    environment:process.env.VERCEL_ENV
  }));
}
