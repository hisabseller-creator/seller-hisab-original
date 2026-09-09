import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
export function verifyImageBackport(){
 const fromVinext=createRequire(path.join(fs.realpathSync('node_modules/vinext'),'package.json'));
 const root=path.dirname(path.dirname(fromVinext.resolve('image-size')));
 const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));if(pkg.version!=='2.0.2')throw Error('Review backport against new image-size version');
 const manifest=JSON.parse(fs.readFileSync('db/image-size-backport.sha256.json','utf8'));
 if(Object.keys(manifest).length!==20)throw Error('Incomplete parser backport manifest');
 for(const [file,hash] of Object.entries(manifest))if(createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')!==hash)throw Error('Security backport missing or modified: '+file);
 return root;
}
