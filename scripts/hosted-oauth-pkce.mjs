// Interactive owner use on the SAME machine that opens the browser.
// Do not pipe, log, screenshot, paste or commit the temporary authorization URL.
import {verifyOwnerBrowserPkce}
  from '../src/acceptance/hosted-owner-pkce.js';
if(process.argv.length!==3||process.argv[2]!=='--owner-approved-test-pkce'){
  process.stderr.write('Requires --owner-approved-test-pkce and protected RTC_* variables.\n');
  process.exitCode=2;
}else{
  const report=await verifyOwnerBrowserPkce({
    origin:process.env.RTC_SERVICE_ORIGIN,
    approvedOrigin:process.env.RTC_APPROVED_ORIGIN,
    expectedDeploymentSha:process.env.RTC_EXPECTED_DEPLOYED_SHA,
    account:process.env.RTC_EXPECTED_ACCOUNT,
    onAuthorizeUrl:async url=>{
      process.stderr.write('Open the following link only in your private signed-in browser on this computer. Select the exact TEST account and read_only profile. Do not share it.\n'+url+'\n');
    }
  });
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
  if(report.status!=='passed')process.exitCode=1;
}
