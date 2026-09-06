import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
await mkdir('vendor',{recursive:true});
await copyFile('node_modules/three/build/three.module.js','vendor/three.module.js');
await copyFile('node_modules/three/LICENSE','vendor/THREE-LICENSE.txt');
for(const [file,path] of Object.entries({ 'OrbitControls.js':'controls/OrbitControls.js','GLTFLoader.js':'loaders/GLTFLoader.js','BufferGeometryUtils.js':'utils/BufferGeometryUtils.js'})) {
 let s=await readFile('node_modules/three/examples/jsm/'+path,'utf8');
 s=s.replaceAll("from 'three'","from './three.module.js'").replaceAll("'../utils/BufferGeometryUtils.js'","'./BufferGeometryUtils.js'");
 await writeFile('vendor/'+file,s);
}
