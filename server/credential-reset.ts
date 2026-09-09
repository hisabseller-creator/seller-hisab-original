import {getD1} from './runtime';
/** Credential replacement and old-session revocation share one atomic D1 batch. */
export async function replaceCredential(userId:string,previousHash:string|null,newHash:string){
 const db=getD1();const results=await db.batch([
  db.prepare('DELETE FROM sessions WHERE user_id=?1 AND EXISTS(SELECT 1 FROM users WHERE id=?1 AND password_hash IS ?2 AND deleted_at IS NULL)').bind(userId,previousHash),
  db.prepare('UPDATE users SET password_hash=?3 WHERE id=?1 AND password_hash IS ?2 AND deleted_at IS NULL').bind(userId,previousHash,newHash),
 ]);if(results[1].meta.changes!==1)throw Error('Credentials changed. Sign in again.');
}
