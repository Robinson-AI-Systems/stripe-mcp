// The authenticated connection selects exactly one profile. A caller-supplied
// tool name or tool arguments must never widen the profile's permissions.
export const CONNECTION_PROFILES=Object.freeze(['read_only','everyday','full']);
export function isToolAllowed(tool, profile, {allowWrites=false}={}) {
  return !!tool && typeof tool.name==='string' &&
    CONNECTION_PROFILES.includes(profile) && Array.isArray(tool.profiles) &&
    tool.profiles.includes(profile) && (tool.writes===false ||
      (allowWrites===true && profile!=='read_only' && tool.writes===true));
}
export function visibleTools(registry,profile,options={}) {
  if (!Array.isArray(registry?.tools)) return [];
  return registry.tools.filter(tool=>isToolAllowed(tool,profile,options));
}
export function profileCounts(registry,options={}) {
  return Object.fromEntries(CONNECTION_PROFILES.map(profile=>
    [profile,visibleTools(registry,profile,options).length]));
}
export function publicToolInfo(tool) {
  const {writes:_writes,profiles:_profiles,...rest}=tool;
  return rest;
}
