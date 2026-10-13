// Avoid executing the full additive DDL initializer on every owner-page GET,
// password attempt or TEST read. Each cold isolate/deployment still initializes
// the complete schema once; concurrent requests share that same pending promise.
// A failed initialization is never cached as success: the next call retries.
export function createSchemaOnce() {
  let ready=null;
  return function ensureSchema(initialize){
    if(typeof initialize!=='function')
      return Promise.reject(new TypeError('Schema initializer required'));
    if(!ready){
      ready=Promise.resolve().then(initialize).catch(error=>{
        ready=null;
        throw error;
      });
    }
    return ready;
  };
}
