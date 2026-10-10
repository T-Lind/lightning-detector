import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'../..');
const model=await fs.readFile(path.join(root,'hardware/3d/model-data.json'),'utf8');
if(process.argv.includes('--geometry-only')){
 const file=path.join(root,'hardware/3d/viewer.html');
 const current=await fs.readFile(file,'utf8');
 const start=current.indexOf('window.ASSEMBLY=');
 const end=current.indexOf('</script>',start);
 if(start<0||end<0)throw Error('Existing viewer model script not found');
 const updated=current.slice(0,start)+`window.ASSEMBLY=${model};`+current.slice(end);
 await fs.writeFile(file,updated);
 console.log('Updated geometry in existing offline viewer:',Buffer.byteLength(updated),'bytes. Viewer code unchanged.');
}else{
const bundled=await build({entryPoints:[path.join(dir,'viewer.js')],bundle:true,write:false,format:'iife',minify:true,target:['es2020'],legalComments:'inline'});
const template=await fs.readFile(path.join(dir,'viewer.template.html'),'utf8');
const html=template.replace('/*__MODEL__*/',`window.ASSEMBLY=${model};`).replace('/*__SCRIPT__*/',bundled.outputFiles[0].text.replace(/<\/script/gi,'<\\/script'));
await fs.writeFile(path.join(root,'hardware/3d/viewer.html'),html);
await fs.copyFile(path.join(dir,'node_modules/three/LICENSE'),path.join(root,'hardware/3d/THREE-LICENSE.txt'));
console.log('Built offline viewer.html:',Buffer.byteLength(html),'bytes. No CDN or network dependency.');
}
