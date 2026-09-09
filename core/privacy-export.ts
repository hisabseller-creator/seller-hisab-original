const SECRET_KEY=/^(password(?:Hash)?|password_hash|access_?token|refresh_?token|consumer_?(key|secret)|encrypted_?payload|iv|session_?(secret|token|hash)|token_?hash|key_?secret|authorization|cookie|client_?secret|api_?key)$/i;
/** Defense in depth at the portability boundary, including JSON audit fields. */
export function portableData(value:unknown):unknown {
 if(Array.isArray(value))return value.map(portableData);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!SECRET_KEY.test(key)).map(([key,item])=>{
  if(/json$/i.test(key)&&typeof item==='string'){try{return [key,JSON.stringify(portableData(JSON.parse(item)))];}catch{return [key,null];}}
  return [key,portableData(item)];
 }));
 return value;
}
export const POLICY_VERSION='2026-09-readiness-v1';
