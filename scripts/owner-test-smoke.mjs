// Owner-operated local acceptance probe. Configure secrets privately in the
// process environment; never paste them in chat, shell arguments or PRs.
import {pathToFileURL} from 'node:url';
import {runOwnerTestSmoke} from '../src/acceptance/owner-test-smoke.js';
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const report=await runOwnerTestSmoke({
      account:process.env.STRIPE_TEST_ACCOUNT,key:process.env.STRIPE_TEST_KEY,
      focus:process.env.STRIPE_TEST_SMOKE_FOCUS||'core'
    });
    process.stdout.write(JSON.stringify(report,null,2)+'\n');
    if(report.errors)process.exitCode=1;
  }catch{
    process.stderr.write('Custom MCP TEST smoke not verified. Check private account/key setup.\n');
    process.exitCode=1;
  }
}
