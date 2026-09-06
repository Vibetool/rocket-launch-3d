import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const baseline={
 'parts.js':'0d4535cb4f7cd0eb20782ae4b7f9328e46f419f2c56a0ce198c3a451535d58b7',
 'physics.js':'bcf1412d1c7869df1b3e64634e82ca8c55d7d17ab09c9e2a34cd66342d5a0c6a',
 'game.js':'56193e752490db79356a6b5aecb75f5ad37eba5f5f758ec5230e3a6d910e71b9'
};
for(const [f,hash] of Object.entries(baseline))assert.equal(createHash('sha256').update(readFileSync(f)).digest('hex'),hash,'Original 2D rules changed: '+f);
const ctx=vm.createContext({});
vm.runInContext(readFileSync('parts.js','utf8')+readFileSync('physics.js','utf8')+`
 globalThis.check={thrust:[PARTS.engine_large.thrust,PARTS.engine_medium.thrust,PARTS.engine_small.thrust],g:gravityAt(0),scale:THRUST_SCALE};
 const s=new Stage([{partId:'engine_large',fuel:0},{partId:'fuel_large',fuel:100}],0,0);
 stepStage(s,1/60);check.fuel=s.totalFuel;check.positive=s.vy>0;
 setWorld('moon');check.moon=gravityAt(0);check.vacuum=airDensity(1000);
`,ctx);
assert.equal(JSON.stringify(ctx.check.thrust),'[30,20,15]');assert.equal(ctx.check.scale,25);
assert.ok(Math.abs(ctx.check.fuel-99.95)<1e-10);assert.ok(ctx.check.positive);assert.equal(ctx.check.vacuum,0);
const glb=readFileSync('assets/rocket-models.glb');assert.equal(glb.toString('utf8',0,4),'glTF');
const jsonLen=glb.readUInt32LE(12);const model=JSON.parse(glb.toString('utf8',20,20+jsonLen));
for(const n of ['engine_large','engine_medium','engine_small','fuel_large','fuel_medium','fuel_small','capsule','decoupler','vab','radar','pad'])assert.ok(model.nodes.some(x=>x.name===n),'Missing model '+n);
assert.ok(!readFileSync('vendor/GLTFLoader.js','utf8').includes("from 'three'"));
console.log('PASS original physics hashes, thrust/fuel/gravity, 11 Blender models, local dependencies');
