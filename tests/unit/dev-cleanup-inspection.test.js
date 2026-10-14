import {describe,it,expect} from 'vitest';
import {planTrigger} from '../../src/dev/triggers.js';
import {tools,handlers} from '../../src/tools/dev-cleanup-inspection.js';
import {registry} from '../../src/tools/index.js';
const account='acct_CLEANVERIFY123';
const parse=r=>JSON.parse(r.content[0].text);

describe('provider-verified TEST cleanup inspection',()=>{
  it('registers a read-only selected-account verifier',()=>{
    expect(tools[0]).toMatchObject({writes:false,
      profiles:['read_only','everyday','full']});
    expect(registry.tools.filter(x=>x.name==='dev_verify_cleanup_run'))
      .toHaveLength(1);
  });
});
