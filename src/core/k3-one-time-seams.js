// K-3 staged PRIVATE candidate adapter. Service-owned bindings only.
// Runtime Stripe keeps its independent original one-time store until a
// reviewed, published dependency is authorized; no core package import here.
export function stripeOneTimeSeams(db) {
  if(typeof db?.addOneTimeSecret!=='function'||
    typeof db?.consumeOneTimeSecret!=='function')
    throw new TypeError('Stripe durable atomic secret store required');
  return Object.freeze({
    db,
    contextFor:({id,account,mode,kind})=>
      ['stripe-once',id,account||'',mode||'',kind].join('/'),
    setupPathFor:id=>'/api/stripe/setup?show='+encodeURIComponent(id),
    accountFromRow:row=>row.stripe_account
  });
}
