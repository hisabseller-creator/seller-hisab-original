import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
const result=spawnSync(process.platform==='win32'?'pnpm.cmd':'pnpm',['list','--depth','Infinity','--json'],{encoding:'utf8',shell:process.platform==='win32',timeout:120000,maxBuffer:32*1024*1024});if(result.status!==0)throw Error('Dependency inventory failed');
const graph=JSON.parse(result.stdout),seen=new Map();
function visit(tree){for(const kind of ['dependencies','devDependencies','optionalDependencies'])for(const [name,node] of Object.entries(tree[kind]??{})){const version=node.version;if(typeof version!=='string')throw Error('Missing dependency version');const id=name+'@'+version;if(seen.has(id))continue;seen.set(id,{type:'library','bom-ref':id,name,version,purl:'pkg:npm/'+name.replace('@','%40')+'@'+encodeURIComponent(version)});visit(node);}}
for(const tree of graph)visit(tree);
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/sbom.cdx.json',JSON.stringify({bomFormat:'CycloneDX',specVersion:'1.6',version:1,metadata:{timestamp:new Date().toISOString(),component:{type:'application',name:pkg.name,version:pkg.version}},components:[...seen.values()].sort((a,b)=>a.name.localeCompare(b.name))},null,2));console.log('CycloneDX inventory generated:',seen.size,'package versions');
