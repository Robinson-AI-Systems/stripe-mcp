// Owner-only hosted RTC TEST acceptance: secrets are read from protected env,
// never command-line arguments or output. Zero provider mutation by design.
import {verifyRtcService,verifyRtcRevocation} from '../src/acceptance/rtc-service-check.js';
const modes=['--authorized-read-only','--authorized-provider-read','--verify-revocation'];
async function main(){
  const [mode,...rest]=process.argv.slice(2);
  if(!modes.includes(mode)||rest.length){
    process.stderr.write('Choose --authorized-read-only, --authorized-provider-read or --verify-revocation. Configure protected RTC_* environment variables.\n');
    process.exitCode=2;return;
  }
  const config={origin:process.env.RTC_SERVICE_ORIGIN,
    approvedOrigin:process.env.RTC_APPROVED_ORIGIN,
    expectedDeploymentSha:process.env.RTC_EXPECTED_DEPLOYED_SHA};
  const result=mode==='--verify-revocation'?
    await verifyRtcRevocation({...config,revokedPass:process.env.RTC_REVOKED_PASS}):
    await verifyRtcService({...config,pass:process.env.RTC_TEST_PASS,
      expectedAccount:process.env.RTC_EXPECTED_ACCOUNT,
      providerRead:mode==='--authorized-provider-read'});
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
  if(result.status!=='passed')process.exitCode=1;
}
await main();
