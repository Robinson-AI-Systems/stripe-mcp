// Run only in the owner's protected environment; never supply credentials
// as command-line arguments, in GitHub logs, or in this program's output.
import {preflightWebhookIngress} from '../src/acceptance/hosted-webhook-preflight.js';
import {makeProtectedServiceFetch} from '../src/acceptance/protected-service-fetch.js';
if(process.argv.length!==2){
  process.stderr.write('No arguments accepted; set protected RTC_* environment variables.\n');
  process.exitCode=2;
}else{
  const result=await preflightWebhookIngress({
    origin:process.env.RTC_SERVICE_ORIGIN,
    approvedOrigin:process.env.RTC_APPROVED_ORIGIN,
    expectedDeploymentSha:process.env.RTC_EXPECTED_DEPLOYED_SHA,
    account:process.env.RTC_EXPECTED_ACCOUNT,
    endpoint:process.env.RTC_EXPECTED_WEBHOOK_ENDPOINT,
    fetcher:makeProtectedServiceFetch({origin:process.env.RTC_SERVICE_ORIGIN,
      approvedOrigin:process.env.RTC_APPROVED_ORIGIN,
      oidcToken:process.env.VERCEL_OIDC_TOKEN})
  });
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
  if(result.status!=='passed')process.exitCode=1;
}
