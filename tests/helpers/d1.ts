import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
export function testDatabase(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
 for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync('drizzle/'+f,'utf8'));
 function prepare(sql:string){let args:unknown[]=[];return {bind(...values:unknown[]){args=values;return this;},async first<T>(){return sqlite.prepare(sql).get(...args as never[]) as T??null;},async all<T>(){return {results:sqlite.prepare(sql).all(...args as never[]) as T[]};},async run(){const r=sqlite.prepare(sql).run(...args as never[]);return {success:true,meta:{changes:Number(r.changes)}};}};}
 const d1={prepare,async batch(statements:{run:()=>Promise<unknown>}[]){sqlite.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
 return {sqlite,d1:d1 as unknown as D1Database};
}
