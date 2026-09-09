import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {verifyImageBackport} from './verify-image-backport.mjs';
if(isMainThread){
 const root=verifyImageBackport();
 await new Promise((resolve,reject)=>{const worker=new Worker(new URL(import.meta.url),{workerData:{root}});const timer=setTimeout(()=>{void worker.terminate();reject(Error('Image parser did not terminate within five seconds'));},5000);worker.on('message',()=>{clearTimeout(timer);resolve();});worker.on('error',error=>{clearTimeout(timer);reject(error);});worker.on('exit',code=>{if(code!==0){clearTimeout(timer);reject(Error('Parser worker failed: '+code));}});});
 console.log('Image backport PASS: all 20 entry-point hashes, CJS/ESM malformed ICNS/HEIF/JXL rejection, valid PNG/ICNS/HEIF');
}else{
 function box(name,payload=Buffer.alloc(0),size=payload.length+8){const b=Buffer.alloc(payload.length+8);b.writeUInt32BE(size);b.write(name,4,4,'ascii');payload.copy(b,8);return b;}
 const icns=Buffer.alloc(16);icns.write('icns');icns.writeUInt32BE(16,4);icns.write('ic07',8);const validIcns=Buffer.from(icns);validIcns.writeUInt32BE(8,12);
 const dimensions=Buffer.alloc(12);dimensions.writeUInt32BE(640,4);dimensions.writeUInt32BE(480,8);
 const heif=(size)=>Buffer.concat([box('ftyp',Buffer.from('heic0000')),box('meta',Buffer.concat([Buffer.alloc(4),box('iprp',box('ipco',box('ispe',dimensions,size)))]))]);
 const jxl=Buffer.concat([box('JXL ',Buffer.from([13,10,135,10])),box('ftyp',Buffer.from('jxl 0000')),box('jxlp',Buffer.alloc(4),0)]);
 const png=Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489','hex');
 for(const ext of ['mjs','cjs']){
  const api=await import(pathToFileURL(path.join(workerData.root,'dist/index.'+ext)));
  for(const bad of [icns,heif(0),jxl])assert.throws(()=>api.imageSize(bad));
  assert.equal(api.imageSize(png).width,1);assert.equal(api.imageSize(validIcns).width,128);assert.equal(api.imageSize(heif(20)).width,640);
  for(const [format,bad] of [['icns',icns],['heif',heif(0)],['jxl',jxl]]){const direct=await import(pathToFileURL(path.join(workerData.root,'dist/types/'+format+'.'+ext)));assert.throws(()=>direct[format.toUpperCase()].calculate(bad));}
 }
 parentPort.postMessage('ok');
}
