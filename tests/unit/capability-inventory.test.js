import {describe,it,expect} from 'vitest';
import {buildCapabilityInventory,validateCapabilityInventory,CREDENTIAL_KINDS}
  from '../../src/stripe/capability-inventory.js';
const r=(id,method,path) => ({id,method,path,summary:'Example Stripe action',
  root:{paths:{[path]:{get:{}}}}});
const fixture=()=>({operations:new Map([
  ['getCustomer',r('getCustomer','GET','/v1/customers/{customer}')],
  ['createProduct',r('createProduct','POST','/v1/products')],
  ['readToken',r('readToken','GET','/v1/tokens/{token}')],
  ['writeUnknown',r('writeUnknown','POST','/v1/unmapped')]
])});
const tools=[{name:'api_read'},{name:'product_create'}];
const handlers={api_read:()=>null,product_create:()=>null};
const build=()=>buildCapabilityInventory({api:fixture(),tools,handlers,pinnedSha:'test-checksum'});
describe('CAP-1 source and provider evidence separation',()=>{
  it('is deterministic, complete, and conservative about authority',()=>{
    const a=build(),b=build();
    expect(a).toEqual(b);
    expect(validateCapabilityInventory(a,{api:fixture(),tools,handlers,pinnedSha:'test-checksum'}).operationCount).toBe(4);
    expect(a.registeredTools).toEqual([
      {name:'api_read',area:'unclassified',writes:false,handlerRegistered:true,
        mappedPinnedOperations:[],evidence:'not-mapped-to-pinned-operation'},
      {name:'product_create',area:'unclassified',writes:false,handlerRegistered:true,
        mappedPinnedOperations:['POST /v1/products'],evidence:'source-native-name-mapping-only'}
    ]);
    expect(a.operations.map(x=>x.key)).toEqual([
      'GET /v1/customers/{customer}','POST /v1/products',
      'GET /v1/tokens/{token}','POST /v1/unmapped']);
    expect(a.operations[0].source.disposition).toBe('guarded-universal-read-candidate');
    expect(a.operations[1].source.nativeTool).toBe('product_create');
    expect(a.operations[1].source.registeredHandler).toBe(true);
    expect(a.operations[2].source.disposition).toBe('schema-discovery-only');
    expect(a.operations[3].source.disposition).toBe('schema-discovery-only');
    for (const row of a.operations) {
      expect(Object.keys(row.credentials)).toEqual([...CREDENTIAL_KINDS]);
      expect(Object.values(row.credentials).every(x=>x.disposition==='unknown')).toBe(true);
      expect(row.source.providerVerified).toBe(false);
      expect(row.liveAcceptance.disposition).toBe('not-linked-to-independent-ledger');
    }
  });
  it('rejects duplicate, removed, orphan and mutated provider rows',()=>{
    const options={api:fixture(),tools,handlers,pinnedSha:'test-checksum'};
    const missing=build();missing.operations.pop();
    expect(()=>validateCapabilityInventory(missing,options)).toThrow(/count/);
    const duplicate=build();duplicate.operations[1].operationId=duplicate.operations[0].operationId;
    expect(()=>validateCapabilityInventory(duplicate,options)).toThrow(/duplicate/);
    const orphan=build();orphan.operations[1].path='/v1/fake';
    expect(()=>validateCapabilityInventory(orphan,options)).toThrow(/orphan/);
    const falseProof=build();falseProof.operations[0].source.providerVerified=true;
    expect(()=>validateCapabilityInventory(falseProof,options)).toThrow(/evidence/);
  });
  it('rejects schema hash drift and registry drift',()=>{
    const original=build(), options={api:fixture(),tools,handlers,pinnedSha:'different-sha'};
    expect(()=>validateCapabilityInventory(original,options)).toThrow(/identity/);
    expect(()=>validateCapabilityInventory(original,{
      api:fixture(),tools:[{name:'product_create'}],pinnedSha:'test-checksum'
    })).toThrow(/drift/);
  });
  it('refuses a tool-name mapping without a registered handler',()=>{
    expect(()=>buildCapabilityInventory({api:fixture(),tools,handlers:{api_read:()=>null},
      pinnedSha:'test-checksum'})).toThrow(/runtime handler/);
  });
  it('refuses malformed or ambiguous catalog records',()=>{
    expect(()=>buildCapabilityInventory({api:{operations:new Map()},tools,pinnedSha:'test'}))
      .toThrow(/catalog/);
    expect(()=>buildCapabilityInventory({api:fixture(),
      tools:[{name:'api_read'},{name:'api_read'}],pinnedSha:'test'})).toThrow(/duplicate/);
  });
});
