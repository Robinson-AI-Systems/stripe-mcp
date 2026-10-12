import {rtcOpenApi} from '../src/core/rtc-http.js';
import {send} from '../src/core/http.js';
export default function handler(req,res){
  if(req.method!=='GET')return send(res,405,{error:'method_not_allowed'});
  return send(res,200,rtcOpenApi());
}
