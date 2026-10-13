// Owner-only opt-in: credentials are process environment values, never output.
import {verifyHostedOAuthRefresh}
  from '../src/acceptance/hosted-oauth-refresh.js';
if(process.argv.length!==3||process.argv[2]!=='--owner-approved-test-refresh'){
  process.stderr.write('Requires --owner-approved-test-refresh and secure RTC_* / MCP_OAUTH_* values.\n');
  process.exitCode=2;
}else{
  const report=await verifyHostedOAuthRefresh({
    origin:process.env.RTC_SERVICE_ORIGIN,
    approvedOrigin:process.env.RTC_APPROVED_ORIGIN,
    expectedDeploymentSha:process.env.RTC_EXPECTED_DEPLOYED_SHA,
    clientId:process.env.MCP_OAUTH_CLIENT_ID,
    accessToken:process.env.MCP_OAUTH_ACCESS_TOKEN,
    refreshToken:process.env.MCP_OAUTH_REFRESH_TOKEN,
    account:process.env.RTC_EXPECTED_ACCOUNT
  });
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
  if(report.status!=='passed')process.exitCode=1;
}
