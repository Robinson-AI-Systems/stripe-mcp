import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createProfileOverlay,coreProfileExports}
  from '../../scripts/k3-profile-overlay.mjs';
import {profileCounts,listingForConnection,isGuardedTestWrite}
  from '../../src/core/profiles.js';
describe('Hub K-3 original Stripe profile migration safety',()=>{
  const source=readFileSync(new URL('../../src/core/profiles.js',import.meta.url),'utf8');
  it('names only five shared core exports, retains all source-owned policy',()=>{
    expect(coreProfileExports).toEqual([
      'CONNECTION_PROFILES','isToolAllowed','visibleTools',
      'profileCounts','publicToolInfo'
    ]);
    const wrapped=createProfileOverlay(source);
    expect(wrapped).toContain("from 'robinson-mcp-core/profiles'");
    expect(wrapped).toContain('export function isGuardedTestWrite(');
    expect(wrapped).toContain('export function listingForConnection(');
    expect(wrapped).toContain('const guardedTestAreas=');
    expect(wrapped).not.toContain('export function publicToolInfo(');
  });
  it('rejects source seam drift instead of dropping Stripe policy',()=>{
    for(const wrong of ['',source.replace('const guardedTestAreas=','const lostAreas='),
      source.replace('export function listingForConnection(',
        'export function missingListing('),
      source+source]){
      expect(()=>createProfileOverlay(wrong)).toThrow();
    }
  });
  it('keeps actual source grants, compact listing and money surfaces safe',()=>{
    const registry={tools:[
      {name:'stripe_whoami',writes:false,profiles:['read_only','everyday','full']},
      {name:'stripe_payment_refund',writes:true,area:'payments',
        writeContract:'defineWrite-v1',profiles:['full']},
      {name:'stripe_money_out',writes:true,area:'money',profiles:['full']}
    ]};
    expect(profileCounts(registry)).toEqual({read_only:1,everyday:1,full:1});
    expect(isGuardedTestWrite(registry.tools[1],{mode:'test',profile:'full'})).toBe(true);
    expect(isGuardedTestWrite(registry.tools[1],{mode:'live',profile:'full'})).toBe(false);
    expect(isGuardedTestWrite(registry.tools[2],{mode:'test',profile:'full'})).toBe(false);
    expect(listingForConnection(registry,{mode:'test',profile:'full',listing:'compact'}).map(x=>x.name))
      .toEqual(['stripe_whoami']);
    expect(listingForConnection(registry,{mode:'test',profile:'full',listing:'catalog'}).map(x=>x.name))
      .toEqual(['stripe_whoami','stripe_payment_refund']);
    expect(listingForConnection(registry,{mode:'live',profile:'full',listing:'catalog'}).map(x=>x.name))
      .toEqual(['stripe_whoami']);
  });
});
