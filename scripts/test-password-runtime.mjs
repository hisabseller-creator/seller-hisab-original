import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const require=createRequire(import.meta.url);
const wranglerRequire=createRequire(require.resolve('wrangler'));
const {Miniflare}=wranglerRequire('miniflare');
const ts=require('typescript');
const transpile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const mf=new Miniflare({modules:[{type:'ESModule',path:'entry.js',contents:`import {hashPassword,verifyPassword} from './password.js';export default {async fetch(){const start=Date.now();const h=await hashPassword('Runtime#Fixture2026');return Response.json({ok:await verifyPassword('Runtime#Fixture2026',h),version:h.split('$')[0],ms:Date.now()-start});}}`},{type:'ESModule',path:'password.js',contents:transpile('server/password.ts').replace('"./crypto"','"./crypto.js"')},{type:'ESModule',path:'crypto.js',contents:transpile('server/crypto.ts')}],compatibilityDate:'2026-05-22',compatibilityFlags:['nodejs_compat']});
try {const response=await mf.dispatchFetch('http://localhost');const body=await response.json();assert.equal(body.ok,true);assert.equal(body.version,'v3');console.log('Workers KDF runtime PASS',body);} finally {await mf.dispose();}
