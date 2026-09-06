import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';

// Rendering adapter only. The original fixed-step simulation remains in game.js.
const $3 = id => document.getElementById(id);
const S = .05 / PART_UNIT_M;
const scene3 = new THREE.Scene();
let renderer, controls, view='', signature='', low=false;
const camera = new THREE.PerspectiveCamera(43,1,.1,3000);
const models = {}, craft = new THREE.Group(), base = new THREE.Group();
const workshop = new THREE.Group(), moon = new THREE.Group(), distant = new THREE.Group();
const stageObjects=[];
const ray = new THREE.Raycaster(), pointer = new THREE.Vector2();
let pad, vab, radar, flame, innerFlame, lastTime=0;
let initialTouch=null, lastClick=null;
const ocean = new THREE.Color('#92bfca'), space = new THREE.Color('#050d1c');

function mesh(geometry,color,roughness=.7,metalness=0){return new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness,metalness}));}
function block(parent,pos,size,color){const o=mesh(new THREE.BoxGeometry(...size),color);o.position.set(...pos);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
function copy(name){const o=models[name].clone(true);o.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;}});return o;}
function stackModel(parts){
 const group=new THREE.Group();let y=0;
 for(const p of parts){const d=PARTS[p.partId];if(!d)continue;const o=copy(p.partId);o.position.y=y;group.add(o);y+=d.h*.05;}
 group.userData.height=y;return group;
}
function terrain(){
 const land=mesh(new THREE.CylinderGeometry(95,100,4,64),'#6a8568');land.position.y=-2.02;land.receiveShadow=true;base.add(land);
 const water=mesh(new THREE.PlaneGeometry(2200,2200),'#367c91',.28,.2);water.rotation.x=-Math.PI/2;water.position.y=-3;base.add(water);
 for(let i=0;i<26;i++){
  const a=i*2.399, r=52+(i%5)*8;
  const hill=mesh(new THREE.IcosahedronGeometry(1,1),i%2?'#62836b':'#78916e');
  hill.position.set(Math.cos(a)*r,1,Math.sin(a)*r);hill.scale.set(8+i%4,3+i%5,7+i%3);hill.receiveShadow=true;base.add(hill);
 }
 block(base,[0,.015,0],[50,.04,4],'#58686b');
 block(base,[-18,.02,1],[7,.05,19],'#58686b');
 block(base,[18,.02,1],[5,.05,15],'#58686b');
 for(let x=-24;x<24;x+=3)block(base,[x,.05,0],[1.4,.025,.1],'#cccfad');
 pad=copy('pad');pad.position.z=8;base.add(pad);
 vab=copy('vab');vab.position.set(-18,0,6);base.add(vab);
 radar=copy('radar');radar.position.set(18,0,6);base.add(radar);
 for(let i=0;i<24;i++){
  const x=(i*17%67)-33,z=-8-(i*13%29);
  const trunk=mesh(new THREE.CylinderGeometry(.13,.2,1.4,6),'#645a41');trunk.position.set(x,.7,z);base.add(trunk);
  const crown=mesh(new THREE.ConeGeometry(1.1,3.5,6),'#3e6752');crown.position.set(x,2.8,z);base.add(crown);
 }
 // Reference vehicle on the pad makes the purpose of the base immediately visible.
 const exhibit=stackModel([{partId:'engine_large'},{partId:'fuel_large'},{partId:'decoupler'},{partId:'engine_medium'},{partId:'fuel_medium'},{partId:'decoupler'},{partId:'engine_small'},{partId:'fuel_small'},{partId:'capsule'}]);
 exhibit.name='exhibit';exhibit.position.set(0,.69,8);base.add(exhibit);
}

function environments(){
 scene3.add(base,craft,workshop,moon,distant);
 scene3.add(new THREE.HemisphereLight('#c9edff','#384434',2.5));
 const sun=new THREE.DirectionalLight('#fff0ce',3.4);sun.position.set(-35,65,-25);sun.castShadow=true;
 sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-65,right:65,top:65,bottom:-65,near:1,far:180});
 sun.shadow.bias=-.0004;sun.shadow.normalBias=.025;scene3.add(sun);
 const fill=new THREE.DirectionalLight('#79cddf',1.5);fill.position.set(20,15,25);scene3.add(fill);
 const ground=mesh(new THREE.CylinderGeometry(32,32,.25,64),'#172c3a',.5,.2);ground.position.y=-.15;ground.receiveShadow=true;workshop.add(ground);
 const grid=new THREE.GridHelper(64,32,'#42606c','#263f4b');grid.position.y=.01;workshop.add(grid);
 for(let r of [3,8,16]){const o=mesh(new THREE.TorusGeometry(r,.025,6,96),'#79a7a6');o.rotation.x=Math.PI/2;o.position.y=.04;workshop.add(o);}
 const lunar=mesh(new THREE.CylinderGeometry(250,250,8,96),'#939a9b');lunar.position.y=-4;lunar.receiveShadow=true;moon.add(lunar);
 for(let i=0;i<60;i++){
  const a=i*2.4,r=8+(i*23%210),rr=1+i%8;
  const cr=mesh(new THREE.TorusGeometry(rr,.18+rr*.08,6,24),'#777f85');cr.rotation.x=Math.PI/2;cr.position.set(Math.cos(a)*r,.05,Math.sin(a)*r);moon.add(cr);
 }
 block(moon,[0,.035,0],[8,.07,8],'#677176');
 for(const x of [-3,3])block(moon,[x,.08,0],[.12,.05,5],'#f1d190');
 const globe=mesh(new THREE.SphereGeometry(110,64,32),'#225e91',.8);globe.position.set(0,-155,0);distant.add(globe);
 // Low relief land patches, with a deterministic distribution (no runtime assets).
 for(let i=0;i<30;i++){
  const a=i*2.399,b=Math.acos(1-2*(i+.5)/30);
  const p=new THREE.Vector3(Math.sin(b)*Math.cos(a),Math.cos(b),Math.sin(b)*Math.sin(a));
  const patch=mesh(new THREE.SphereGeometry(1,12,8),i%2?'#678a75':'#567c67');patch.position.copy(p).multiplyScalar(110).add(globe.position);
  patch.scale.set(8+i%9,3+i%3,7+i%7);patch.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),p);distant.add(patch);
 }
 const starPositions=[];
 for(let i=0;i<900;i++){const a=i*2.39996,b=Math.acos(1-2*(i+.5)/900);starPositions.push(650*Math.sin(b)*Math.cos(a),650*Math.cos(b),650*Math.sin(b)*Math.sin(a));}
 const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));
 const stars=new THREE.Points(starGeo,new THREE.PointsMaterial({color:'#c8e3ff',size:.75,sizeAttenuation:true}));stars.name='stars';scene3.add(stars);
 // ConeGeometry points upwards by default. Rotate first, then put its wide base at nozzle.
 const cone=new THREE.ConeGeometry(.75,4.5,24);cone.rotateZ(Math.PI);cone.translate(0,-2.25,0);
 flame=new THREE.Mesh(cone,new THREE.MeshBasicMaterial({color:'#ff7b32',transparent:true,opacity:.72,depthWrite:false,blending:THREE.AdditiveBlending}));
 const c2=new THREE.ConeGeometry(.4,3.3,20);c2.rotateZ(Math.PI);c2.translate(0,-1.65,0);
 innerFlame=new THREE.Mesh(c2,new THREE.MeshBasicMaterial({color:'#fff0b0',transparent:true,opacity:.95,depthWrite:false}));
 craft.add(flame,innerFlame);
}

function resetCamera(){
 const mobile=innerWidth<760;
 if(view==='home') {camera.position.set(mobile?85:48,mobile?70:36,mobile?115:61);controls.target.set(0,4,4);controls.minDistance=28;controls.maxDistance=220;}
 else {const h=remainingHeight();controls.target.set(0,h*.46,0);const d=Math.max(14,h*(mobile?2.1:1.65));camera.position.set(d*.72,h*.6+d*.18,d);controls.minDistance=5;controls.maxDistance=180;}
 controls.update();
}
function remainingHeight(){return view==='build'?state.stack.reduce((s,p)=>s+PARTS[p.partId].h*.05,0):state.stages.slice(state.active).reduce((s,st)=>s+st.parts.reduce((n,p)=>n+PARTS[p.partId].h*.05,0),0);}

function setView(next){
 view=next;document.body.dataset.view=next;signature='';
 const host=next==='home'?$3('homeScreen'):next==='build'?$3('preview').parentElement:$3('flyScreen');
 host.prepend(renderer.domElement);
 $3('viewHint').textContent=next==='home'?'点击建筑进入 · 拖动旋转 · 滚轮缩放':next==='build'?'拖动检查火箭 · 滚轮缩放':'拖动环绕火箭 · 滚轮缩放';
 base.visible=next==='home';workshop.visible=next==='build';craft.visible=next!=='home';
 controls.enablePan=next==='build';resetCamera();
}
function rebuild(){
 const key=view==='build'?state.stack.map(p=>p.partId).join(','):state.stages.map(st=>st.parts.map(p=>p.partId).join(',')).join('|');
 if(key===signature)return;signature=key;
 for(const o of stageObjects)craft.remove(o);stageObjects.length=0;
 if(view==='build'){const o=stackModel(state.stack);craft.add(o);stageObjects.push(o);resetCamera();}
 else for(const st of state.stages){const o=stackModel(st.parts);craft.add(o);stageObjects.push(o);}
}
function label(id,pos){
 const p=pos.clone().project(camera),el=$3(id),w=renderer.domElement.clientWidth,h=renderer.domElement.clientHeight;
 const margin=Math.min(100,w*.25);
 el.style.left=Math.max(margin,Math.min(w-margin,(p.x+1)*w/2))+'px';el.style.top=Math.max(130,Math.min(h-100,(-p.y+1)*h/2))+'px';
 el.style.visibility=p.z>1?'hidden':'visible';
}
function hits(event,objects){
 const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
 ray.setFromCamera(pointer,camera);return ray.intersectObjects(objects,true);
}
function boost(event){
 if(view!=='fly'||state.mode!=='fly'||state.world==='moon'||!base.visible||!hits(event,[pad]).length)return false;
 if(state.boost>1)return false;
 state.boost=BOOST_MUL;for(const st of state.stages)st.thrustMul=BOOST_MUL;
 $3('boostBadge').hidden=false;toastShip('发射台超频！本局推力 +40%');return true;
}

function frame(time){
 const dt=Math.min(.05,(time-lastTime)/1000||.016);lastTime=time;
 const next=!$3('homeScreen').hidden?'home':!$3('buildScreen').hidden?'build':'fly';
 if(next!==view)setView(next);
 document.body.classList.toggle('coop-on',!$3('coopBar').hidden);
 const canvas=renderer.domElement,w=canvas.parentElement.clientWidth,h=canvas.parentElement.clientHeight;
 $3('viewTools').hidden=w<2||h<2;
 if(w<2||h<2)return;
 const pixel=renderer.getPixelRatio();
 if(canvas.width!==Math.round(w*pixel)||canvas.height!==Math.round(h*pixel)){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
 let isMoon=false,alt=0;
 if(view!=='home')rebuild();
 if(view==='fly'){
  const active=state.stages[state.active];alt=active?.y||0;isMoon=state.world==='moon';
  const lift=.69;
  stageObjects.forEach((o,i)=>{const st=state.stages[i];o.position.set((st.x-(active?.x||0))*S,(st.y-alt)*S+lift,0);o.visible=!(i<state.active&&st.landed);});
  const targetHeight=remainingHeight()*.46;
  const delta=(targetHeight-controls.target.y)*Math.min(1,dt*3);controls.target.y+=delta;camera.position.y+=delta;
  base.position.set(0,-alt*S,-8);base.visible=!isMoon&&alt<6500;base.getObjectByName('exhibit').visible=false;
  moon.visible=isMoon;moon.position.y=-alt*S;workshop.visible=false;distant.visible=!isMoon&&alt>4500;
  const on=active?.thrusting&&!active?.landed&&state.mode==='fly';
  flame.visible=innerFlame.visible=!!on;flame.position.y=innerFlame.position.y=lift;
  const flicker=.88+Math.sin(time*.055)*.07+Math.sin(time*.097)*.05;
  flame.scale.setScalar(flicker);innerFlame.scale.setScalar(1.02-flicker*.12);
  flame.material.color.set(state.boost>1?'#a783ff':'#ff792e');innerFlame.material.color.set(state.boost>1?'#85d9ff':'#fff2ae');
 }else{
  flame.visible=innerFlame.visible=false;moon.visible=distant.visible=false;
  base.position.set(0,0,0);base.getObjectByName('exhibit').visible=true;
 }
 const f=isMoon?1:Math.min(1,alt/70000);
 scene3.background=view==='build'?new THREE.Color('#0a1a29'):ocean.clone().lerp(space,f);
 scene3.fog=view==='build'?null:new THREE.Fog(scene3.background,view==='home'?130:250,view==='home'?350:1000);
 scene3.getObjectByName('stars').visible=view==='fly'&&(isMoon||alt>24000);
 controls.update();scene3.updateMatrixWorld(true);
 if(view==='home'){
  label('hsVab',new THREE.Vector3(-18,13.5,6));label('hsRadar',new THREE.Vector3(18,10,6));
 }
 renderer.render(scene3,camera);
}

async function boot(){
 renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
 renderer.domElement.className='webgl-view';renderer.domElement.setAttribute('aria-label','可旋转的三维航天场景');
 renderer.setPixelRatio(Math.min(devicePixelRatio,matchMedia('(pointer:coarse)').matches?1.25:1.75));
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
 $3('homeScreen').prepend(renderer.domElement);
 controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;
 controls.maxPolarAngle=Math.PI*.485;controls.minPolarAngle=.13;controls.enablePan=false;
 const gltf=await new GLTFLoader().loadAsync('assets/rocket-models.glb');
 for(const name of [...Object.keys(PARTS),'vab','radar','pad']){models[name]=gltf.scene.getObjectByName(name);if(!models[name])throw Error('模型缺失：'+name);}
 terrain();environments();
 // Stop the legacy canvas renderers without touching the flight rules or input UI.
 window.render=()=>{};window.drawPreview=()=>{};
 $3('resetView').onclick=resetCamera;
 $3('qualityView').onclick=()=>{low=!low;renderer.setPixelRatio(low?1:Math.min(devicePixelRatio,1.75));renderer.shadowMap.enabled=!low;$3('qualityView').textContent=low?'画质：省电':'画质：标准';};
 renderer.domElement.addEventListener('pointerdown',e=>{initialTouch={x:e.clientX,y:e.clientY,id:e.pointerId};});
 renderer.domElement.addEventListener('pointerup',e=>{
  if(!initialTouch||initialTouch.id!==e.pointerId||Math.hypot(e.clientX-initialTouch.x,e.clientY-initialTouch.y)>7){initialTouch=null;return;}
  initialTouch=null;
  if(view==='home'){const h=hits(e,[vab,radar]);if(h.length){let o=h[0].object;while(o.parent&&o!==vab&&o!==radar)o=o.parent;$3(o===vab?'hsVab':'hsRadar').click();}}
  else if(view==='fly'){
   const now=performance.now();if(lastClick&&now-lastClick.t<350&&Math.hypot(e.clientX-lastClick.x,e.clientY-lastClick.y)<24){boost(e);lastClick=null;}
   else lastClick={t:now,x:e.clientX,y:e.clientY};
  }
 });
 renderer.domElement.addEventListener('pointercancel',()=>{initialTouch=null;lastClick=null;});
 renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();$3('boot3d').hidden=false;$3('boot3d').innerHTML='<b>显卡渲染已暂停</b><p>请刷新页面重新进入。原版 2D 游戏仍可使用。</p>';});
 window.__threeReady=true;clearTimeout(window.__threeWatch);$3('boot3d').hidden=true;
 window.ROCKET3D={renderer,scene:scene3,camera,controls,models,boost,resetCamera,get view(){return view;},frame};
 renderer.setAnimationLoop(frame);
}
boot().catch(error=>{console.error(error);clearTimeout(window.__threeWatch);$3('boot3d').innerHTML='<b>无法启动 3D 画面</b><p>需要支持 WebGL 2 的浏览器，请尝试最新版 Chrome。</p><a href="https://vibetool.github.io/rocket-launch/">继续玩原版 2D 游戏</a>';});
