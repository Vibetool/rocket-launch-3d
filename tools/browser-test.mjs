import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=process.cwd();
const server=createServer(async(req,res)=>{
 try{const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
 if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403).end();return;}
 const f=path===root?resolve(root,'index.html'):path;
 const body=await readFile(f);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.png':'image/png'})[extname(f)]||'application/octet-stream');res.end(body);
 }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=process.env.TEST_URL||`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true,...(process.env.TEST_PROXY?{proxy:{server:process.env.TEST_PROXY}}:{args:['--no-proxy-server']})});
const errors=[];
try{
const page=await browser.newPage({viewport:{width:1440,height:900}});
page.on('pageerror',e=>errors.push(e.message));
await page.route('https://api.ovobot.ai/**',r=>r.fulfill({status:503,body:'{}'}));
await page.goto(url);
await page.waitForFunction(()=>window.__threeReady);
await page.waitForTimeout(500);
await page.screenshot({path:'/private/tmp/rocket3d-home.png'});
// Camera control is a real pointer drag, not a mocked transform.
const before=await page.evaluate(()=>ROCKET3D.camera.position.toArray());
await page.mouse.move(800,650);await page.mouse.down();await page.mouse.move(1050,660,{steps:12});await page.mouse.up();
await page.waitForTimeout(350);
assert.notDeepEqual(await page.evaluate(()=>ROCKET3D.camera.position.toArray()),before);
await page.click('#resetView');
await page.click('#hsRadar');await page.locator('.ship.is-preset').click();
await page.waitForFunction(()=>ROCKET3D.view==='build');
assert.equal(await page.evaluate(()=>state.stack.length),9);
await page.screenshot({path:'/private/tmp/rocket3d-build.png'});
await page.click('#btnLaunch');await page.waitForFunction(()=>ROCKET3D.view==='fly');
await page.waitForTimeout(250);
await page.screenshot({path:'/private/tmp/rocket3d-flight.png'});
// Terrain is not a valid Easter-egg target. Project a real deck point for a double click.
const point=await page.evaluate(()=>{
 const r=ROCKET3D, p=r.models.pad.position.clone();p.set(3,.7,1);const model=r.scene.children.find(g=>g.children.some(c=>c.name==='pad')).children.find(c=>c.name==='pad');model.localToWorld(p);p.project(r.camera);
 const b=r.renderer.domElement.getBoundingClientRect();return {x:b.left+(p.x+1)*b.width/2,y:b.top+(1-p.y)*b.height/2};
});
await page.mouse.dblclick(point.x,point.y,{delay:90});
assert.equal(await page.evaluate(()=>state.boost),1.4,'3D platform raycast boost');
await page.screenshot({path:'/private/tmp/rocket3d-boost.png'});
const mission=await page.evaluate(()=>{
 for(let i=0;i<20000&&state.mode==='fly';i++){
   const st=state.stages[state.active];if(st.totalFuel<.01&&state.active<state.stages.length-1)separate();
   update(1/60);
 }
 const reached=state.result?.win,v=state.stages[state.active].vy,y=state.stages[state.active].y;
 continueFlight();const same=state.stages[state.active].vy===v&&state.stages[state.active].y===y;
 for(let i=0;i<2000&&state.mode==='fly';i++)update(1/60);
 const phase=state.phase;startMoonLanding();
 return {reached,same,phase,fuel:state.stages[0].totalFuel,capacity:state.stages[0].parts.reduce((s,p)=>s+(PARTS[p.partId].capacity||0),0),vy:state.stages[0].vy,boost:state.boost,alt:state.stages[0].y,gravity:gravityAt(0)};
});
assert.equal(mission.reached,true);assert.equal(mission.same,true);assert.equal(mission.phase,'moon_choice');
assert.equal(mission.fuel,mission.capacity*.3);assert.ok(mission.vy<0);assert.equal(mission.boost,1);assert.equal(mission.alt,1000);assert.ok(Math.abs(mission.gravity-9.8*2/3)<1e-12);
await page.waitForTimeout(200);await page.screenshot({path:'/private/tmp/rocket3d-moon.png'});
const landing=await page.evaluate(()=>{
 for(let i=0;i<20000&&state.mode==='fly';i++){
  const st=state.stages[0],a=st.maxThrust*THRUST_SCALE/st.mass-gravityAt(0);
  const safe=Math.min(70,Math.sqrt(Math.max(0,st.y-1)*2*Math.max(1,a))*.65+3);
  setBurn(-st.vy>safe);update(1/60);
 }
 return {phase:state.phase,title:document.getElementById('rTitle').textContent,impact:state.lastImpact};
});
assert.equal(landing.phase,'moon_done');console.log('mission',mission,'landing',landing);
// Local records use a separate namespace on the shared github.io origin.
assert.equal(await page.evaluate(()=>localStorage.getItem('rocket_fleet_v1')),null);
assert.ok(await page.evaluate(()=>localStorage.getItem('rocket3d_fleet_v1')));
// Mobile: preserve the original tabbed builder, with a real touch-capable viewport.
const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
mobile.on('pageerror',e=>errors.push(e.message));
await mobile.route('https://api.ovobot.ai/**',r=>r.fulfill({status:503,body:'{}'}));
await mobile.goto(url);await mobile.waitForFunction(()=>window.__threeReady);await mobile.waitForTimeout(300);
await mobile.screenshot({path:'/private/tmp/rocket3d-mobile-home.png'});
await mobile.tap('#hsRadar');await mobile.locator('.ship.is-preset').tap();await mobile.locator('[data-tab="preview"]').tap();await mobile.waitForTimeout(350);
await mobile.screenshot({path:'/private/tmp/rocket3d-mobile-build.png'});
assert.ok(await mobile.evaluate(()=>ROCKET3D.renderer.domElement.getBoundingClientRect().height>100));
await mobile.locator('[data-tab="stack"]').tap();await mobile.tap('#btnLaunch');await mobile.waitForTimeout(350);
await mobile.screenshot({path:'/private/tmp/rocket3d-mobile-flight.png'});
assert.equal(await mobile.evaluate(()=>ROCKET3D.view),'fly');
// Two real WebRTC peers, locally exchanged SDP (no writes to production signaling).
await page.goto(url);await mobile.goto(url);
await Promise.all([page.waitForFunction(()=>window.__threeReady),mobile.waitForFunction(()=>window.__threeReady)]);
// Production co-op entry is temporarily disabled; test retained protocol explicitly.
assert.equal(await page.locator('#btnCoop').isVisible(),false);
await Promise.all([page.evaluate(()=>bindCoopEvents()),mobile.evaluate(()=>bindCoopEvents())]);
const offer=await page.evaluate(async()=>{
 ICE.iceServers=[];NET.active=true;NET.role='host';setupPeer(true);
 await NET.pc.setLocalDescription(await NET.pc.createOffer());
 await new Promise(resolve=>{if(NET.pc.iceGatheringState==='complete')resolve();else NET.pc.addEventListener('icegatheringstatechange',()=>{if(NET.pc.iceGatheringState==='complete')resolve();});});
 return NET.pc.localDescription.toJSON();
});
const answer=await mobile.evaluate(async offer=>{
 ICE.iceServers=[];NET.active=true;NET.role='guest';setupPeer(false);
 await NET.pc.setRemoteDescription(offer);await NET.pc.setLocalDescription(await NET.pc.createAnswer());
 await new Promise(resolve=>{if(NET.pc.iceGatheringState==='complete')resolve();else NET.pc.addEventListener('icegatheringstatechange',()=>{if(NET.pc.iceGatheringState==='complete')resolve();});});
 return NET.pc.localDescription.toJSON();
},offer);
await page.evaluate(answer=>NET.pc.setRemoteDescription(answer),answer);
await Promise.all([page.waitForFunction(()=>NET.dc?.readyState==='open'),mobile.waitForFunction(()=>NET.dc?.readyState==='open')]);
await page.click('#hsVab');await page.waitForFunction(()=>!document.getElementById('coopGate').hidden);
assert.ok(await page.locator('#buildScreen').evaluate(el=>el.classList.contains('locked')));
await mobile.waitForFunction(()=>document.getElementById('hsVab').classList.contains('peer-here'));
await mobile.tap('#hsVab');await page.waitForFunction(()=>document.getElementById('coopGate').hidden);
await page.click('#btnPreset');await mobile.waitForFunction(()=>state.stack.length===5);
await page.click('#btnLaunch');await mobile.waitForFunction(()=>NET.peerLaunchReady);
assert.equal(await page.evaluate(()=>state.mode),'build','one vote must not launch');
await mobile.locator('[data-tab="stack"]').tap();await mobile.tap('#btnLaunch');
await Promise.all([page.waitForFunction(()=>state.mode==='fly'),mobile.waitForFunction(()=>state.mode==='fly')]);
const automatic=await page.evaluate(()=>{state.stages[0].parts.forEach(p=>p.fuel=0);for(let i=0;i<65;i++)update(1/60);return state.active;});
assert.equal(automatic,1);
await page.evaluate(()=>netLeave());await mobile.evaluate(()=>netLeave());
assert.deepEqual(errors,[]);console.log('PASS desktop, mobile, orbit, preset, launch, boost, staging, Karman, momentum, Moon, storage');
console.log('PASS real local WebRTC data channel, building gate/highlight, design sync, two launch votes, automatic separation');
}finally{await browser.close();server.close();}
