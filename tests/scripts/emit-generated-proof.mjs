import {readdir,readFile,lstat} from 'node:fs/promises';
import path from 'node:path';import {createHash} from 'node:crypto';import {gzipSync} from 'node:zlib';
const root=process.env.FALLLINE_OUTPUT;if(!root)throw Error('Owned proof root required');
const allowed=new Set(['owner.json','runner.json','source-before.json','source-after.json','declared-inputs.json','public-manifest.json','served-before.json','served-after.json','server-ready.json','server.stdout.txt','server.stderr.txt','generated-browser.json','tools-lock.json','carried-checks.json']);
let names;try{names=await readdir(root);}catch(e){if(e.code!=='ENOENT')throw e;names=[];}let total=0;
for(const name of names.sort()){
 const full=path.join(root,name),s=await lstat(full);
 if(!allowed.has(name)&&!/^\d\d-[a-z0-9-]+\.(stdout|stderr)\.txt$/.test(name)&&!/^(desktop-menu|desktop-spin-air|mobile-390|mobile-320|mobile-menu-320|earned-levels|failure-G0[1-6])\.png$/.test(name))throw Error('Unexpected proof '+name);
 if(!s.isFile()||s.isSymbolicLink()||s.size>2*1024*1024||(total+=s.size)>16*1024*1024)throw Error('Proof budget');
 const b=await readFile(full),codec=name.endsWith('.png')?'base64':'gzip-base64',encoded=(codec==='base64'?b:gzipSync(b,{level:9,mtime:0})).toString('base64');
 console.log('FALLLINE_GENERATED_FILE '+JSON.stringify({name,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex'),codec,chunks:Math.ceil(encoded.length/3000)}));
 for(let offset=0;offset<encoded.length;offset+=3000)console.log('FALLLINE_GENERATED_CHUNK '+JSON.stringify({name,index:offset/3000,data:encoded.slice(offset,offset+3000)}));
}
