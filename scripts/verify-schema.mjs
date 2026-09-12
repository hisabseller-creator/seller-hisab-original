import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import {createHash} from "node:crypto";
import assert from "node:assert/strict";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import * as schema from "../db/schema-all.ts";
const migrations=fs.readdirSync("drizzle").filter(f=>f.endsWith(".sql")).sort();
export function replay(until=migrations.length) {
  const db=new DatabaseSync(":memory:"); db.exec("PRAGMA foreign_keys=ON");
  for(const f of migrations.slice(0,until)) db.exec(fs.readFileSync("drizzle/"+f,"utf8"));
  return db;
}
for(const [file,hash] of Object.entries(JSON.parse(fs.readFileSync('db/applied-migrations.sha256.json','utf8'))))assert.equal(createHash('sha256').update(fs.readFileSync('drizzle/'+file)).digest('hex'),hash,'Historical migration edited: '+file);
const db=replay();
const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>r.name);
const configs=Object.values(schema).map(getTableConfig);
assert.deepEqual(configs.map(t=>t.name).sort(),tables);
for(const table of configs){
 const actual=db.prepare(`PRAGMA table_info('${table.name}')`).all();
 assert.deepEqual(table.columns.map(c=>c.name).sort(),actual.map(c=>c.name).sort(),table.name+" columns");
 for(const c of table.columns){const a=actual.find(a=>a.name===c.name);assert.equal(c.getSQLType().toLowerCase(),a.type.toLowerCase(),table.name+"."+c.name);assert.equal(c.primary,Boolean(a.pk),table.name+"."+c.name+" primary key");assert.equal(c.notNull,Boolean(a.notnull)||Boolean(a.pk),table.name+"."+c.name+" nullability");}
 for(const c of table.columns){const a=actual.find(a=>a.name===c.name);const expected=c.default===undefined?null:typeof c.default==='string'?"'"+c.default.replaceAll("'","''")+"'":String(c.default);assert.equal(a.dflt_value,expected,table.name+'.'+c.name+' default');}
 const indexes=db.prepare(`PRAGMA index_list('${table.name}')`).all().filter(i=>i.origin==='c');
 assert.deepEqual(table.indexes.map(i=>i.config.name).sort(),indexes.map(i=>i.name).sort(),table.name+" indexes");
 for(const i of table.indexes){const a=indexes.find(a=>a.name===i.config.name);assert.equal(Boolean(i.config.unique),Boolean(a.unique));assert.deepEqual(i.config.columns.map(c=>c.name),db.prepare(`PRAGMA index_info('${a.name}')`).all().map(c=>c.name));}
}
const governedBase=JSON.parse(fs.readFileSync('db/sql-governance.json','utf8'));
const governedLive=JSON.parse(fs.readFileSync('db/sql-governance-live.json','utf8'));
const governed={
 foreignKeys:{...governedBase.foreignKeys,...governedLive.foreignKeys},
 objects:[...new Map([...governedBase.objects,...governedLive.objects].map(item=>[`${item.type}:${item.name}`,item])).values()].sort((a,b)=>a.type.localeCompare(b.type)||a.name.localeCompare(b.name)),
};
assert.deepEqual(Object.fromEntries(tables.map(name=>[name,db.prepare("PRAGMA foreign_key_list('"+name+"')").all().map(r=>({...r}))])),governed.foreignKeys,'Foreign-key manifest drift');
assert.deepEqual(db.prepare("SELECT type,name,tbl_name AS tableName,sql FROM sqlite_master WHERE type='trigger' OR (type='table' AND sql LIKE '%CHECK%') ORDER BY type,name").all().map(r=>({...r})),governed.objects);
// Representative populated 0014 upgrade; execute later migrations exactly once
// in this disposable database, never in a remote or existing local database.
const upgraded=replay(15);
upgraded.exec("INSERT INTO users (id,email,created_at) VALUES ('upgrade-user','fixture@example.invalid','2026-01-01'); INSERT INTO payments (id,provider_order_id,analysis_id,user_id,product,provider,amount_paise,currency,status,created_at,updated_at) VALUES ('upgrade-payment','order-fixture','analysis-fixture','upgrade-user','action-report','razorpay',4900,'INR','created','2026-01-01','2026-01-01')");
for(const f of migrations.slice(15))upgraded.exec(fs.readFileSync('drizzle/'+f,'utf8'));
assert.equal(upgraded.prepare("SELECT amount_paise FROM payments WHERE id='upgrade-payment'").get().amount_paise,4900);
assert.equal(upgraded.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
assert.deepEqual(upgraded.prepare('PRAGMA foreign_key_check').all(),[]);
console.log(`Schema parity / immutable migration replay / populated upgrade PASS: ${tables.length} tables, ${migrations.length} migrations`);
