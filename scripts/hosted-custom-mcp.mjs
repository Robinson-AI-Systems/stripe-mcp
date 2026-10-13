// Protected-environment only, never use bearer/secret arguments or echo responses.
import {verifyHostedStandaloneMcp,verifyHostedMcpRevocation}
  from '../src/acceptance/hosted-custom-mcp.js';
const [mode,...extra]=process.argv.slice(2);
if(!['--connected','--revoked'].includes(mode)||extra.length){
  process.stderr.write('Use --connected or --revoked; configure protected MCP_* and RTC_* environment values.\n');
  process.exitCode=2;
}else{
  const shared={origin:process.env.RTC_SERVICE_ORIGIN,
    approvedOrigin:process.env.RTC_APPROVED_ORIGIN,
    expectedDeploymentSha:process.env.RTC_EXPECTED_DEPLOYED_SHA};
  const report=mode==='--connected'?
    await verifyHostedStandaloneMcp({...shared,
      token:process.env.MCP_CONNECTED_ACCESS_TOKEN,
      account:process.env.RTC_EXPECTED_ACCOUNT}):
    await verifyHostedMcpRevocation({...shared,
      revokedToken:process.env.MCP_REVOKED_ACCESS_TOKEN});
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
  if(report.status!=='passed')process.exitCode=1;
}
