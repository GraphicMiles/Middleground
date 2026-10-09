const {chromium}=require('playwright');const path=require('path');const {pathToFileURL}=require('url');const assert=require('assert');
const launch={headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-webgl','--enable-unsafe-swiftshader','--use-angle=swiftshader']};
const finalURL=pathToFileURL(path.resolve(__dirname,'..','index.html')).href;
async function watch(page,errors,requests){page.on('pageerror',e=>{errors.push(e.message);console.error('JS',e.message)});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error('CONSOLE',m.text().slice(0,4000));}});page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url())});}
async function ready(page){await page.waitForFunction(()=>window.WORLD?.stats().ready,{timeout:90000});await page.evaluate(()=>WORLD.pause(true));}
(async()=>{
 const browser=await chromium.launch(launch);const report={desktop:{},mobile:{},errors:[],externalRequests:[]};
 try{
  const context=await browser.newContext({viewport:{width:640,height:360},deviceScaleFactor:1});await context.setOffline(true);
  const page=await context.newPage();page.setDefaultTimeout(60000);await watch(page,report.errors,report.externalRequests);
  await page.goto(finalURL,{waitUntil:'load'});await ready(page);console.log('Offline desktop ready');
  await page.click('#go');await page.evaluate(()=>{WORLD.pause(true);document.getElementById('start').style.display='none';if(document.pointerLockElement)document.exitPointerLock();});
  const old=await page.evaluate(()=>({x:WORLD.P.x,z:WORLD.P.z,time:WORLD.time()}));
  await page.keyboard.down('w');await page.evaluate(()=>{for(let i=0;i<60;i++)WORLD.tick(1/60)});await page.keyboard.up('w');
  const walk=await page.evaluate(()=>({x:WORLD.P.x,z:WORLD.P.z,speed:WORLD.P.spd}));assert(Math.hypot(walk.x-old.x,walk.z-old.z)>.5,'WASD did not move');
  await page.keyboard.down('Shift');await page.keyboard.down('d');await page.evaluate(()=>{for(let i=0;i<60;i++)WORLD.tick(1/60)});await page.keyboard.up('d');await page.keyboard.up('Shift');
  const sprint=await page.evaluate(()=>WORLD.P.spd);assert(sprint>3,'Sprint did not increase speed');
  await page.evaluate(()=>{for(let i=0;i<40;i++)WORLD.tick(1/60);document.getElementById('bj').click();WORLD.tick(1/60)});
  const jump=await page.evaluate(()=>({vy:WORLD.P.vy,height:WORLD.P.y-WORLD.H(WORLD.P.x,WORLD.P.z)}));assert(jump.vy>3&&jump.height>0,'Jump failed');
  await page.evaluate(()=>{for(let i=0;i<150;i++)WORLD.tick(1/60)});
  const time=await page.evaluate(()=>WORLD.time());assert(time>old.time,'Continuous time did not advance');
  report.desktop.controls={walkDistance:Math.hypot(walk.x-old.x,walk.z-old.z),sprintSpeed:sprint,jump,timeAdvance:time-old.time};
  report.desktop.streaming=await page.evaluate(()=>{
   const {P,H,chunks}=WORLD,s={x:280,z:0};const teleport=(x,z)=>{Object.assign(P,{x,z,y:H(x,z),ys:H(x,z),vx:0,vz:0,vy:0,gr:true});WORLD.step(.016);for(let i=0;i<3;i++)WORLD.build(1000,1)};
   teleport(s.x,s.z);const signature=[...chunks.values()].filter(c=>c.d<=1&&c.pDone).map(c=>({key:c.key,cs:c.cs,col:JSON.stringify(c.col)}));
   teleport(s.x+800,s.z+800);teleport(s.x,s.z);
   const diffs=signature.filter(c=>{const n=chunks.get(c.key);return !n||n.cs!==c.cs||JSON.stringify(n.col)!==c.col}).map(c=>c.key);
   WORLD.render();return {stats:WORLD.stats(),compared:signature.length,diffs};
  });assert(report.desktop.streaming.compared===9&&report.desktop.streaming.diffs.length===0,'Chunks changed on regeneration');assert(report.desktop.streaming.stats.mism===0,'Seed mismatch');console.log('Regeneration passed');
  report.desktop.wading=await page.evaluate(()=>{
   const {P,H}=WORLD;Object.assign(P,{x:291,z:-12,y:H(291,-12),ys:H(291,-12),vx:0,vz:0,vy:0,gr:true,yaw:0,ty:0});
   window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyA'}));for(let i=0;i<35;i++)WORLD.tick(1/60);window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyA'}));
   const ripples=WORLD.uniforms.uRipples.value.filter(r=>r.w>0).length;return {ripples,depth:-.55-H(P.x,P.z)};
  });assert(report.desktop.wading.ripples>0,'Wading did not generate ripples');
  await page.evaluate(()=>{WORLD.setTime(22,true);document.getElementById('bn').click();WORLD.setQuality(1);WORLD.render()});
  report.desktop.saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('okavango.marsh.settings.v2')));
  assert(report.desktop.saved.sensitivity===1.5&&report.desktop.saved.hour===22&&report.desktop.saved.quality===1,'Settings not saved');
  await page.reload({waitUntil:'load'});await ready(page);
  report.desktop.restored=await page.evaluate(()=>({stats:WORLD.stats(),sens:document.getElementById('bn').textContent}));assert(report.desktop.restored.stats.quality==='LOW'&&report.desktop.restored.stats.time===22&&report.desktop.restored.sens==='SENS 1.5','Settings not restored');console.log('Settings passed');
  // Use a real WebGL1 context and touch input, not merely a narrow desktop viewport.
  const mobileContext=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});await mobileContext.setOffline(true);
  await mobileContext.addInitScript(()=>{
   const original=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:original.call(this,type,...args)};
   try{localStorage.setItem('okavango.marsh.settings.v2',JSON.stringify({quality:1,sensitivity:1,hour:9.75}))}catch(e){}
  });
  const mobile=await mobileContext.newPage();mobile.setDefaultTimeout(60000);await watch(mobile,report.errors,report.externalRequests);
  await mobile.goto(finalURL,{waitUntil:'load'});await ready(mobile);await mobile.tap('#go');await mobile.evaluate(()=>{WORLD.pause(true);document.getElementById('start').style.display='none'});
  report.mobile.context=await mobile.evaluate(()=>({webgl2:WORLD.renderer.capabilities.isWebGL2,coarse:matchMedia('(pointer:coarse)').matches,maxAttributes:WORLD.renderer.capabilities.maxAttributes}));assert(!report.mobile.context.webgl2&&report.mobile.context.coarse,'Mobile/WebGL1 emulation failed');
  report.mobile.touch=await mobile.evaluate(()=>{
   const cv=document.getElementById('c'),make=(id,x,y)=>new Touch({identifier:id,target:cv,clientX:x,clientY:y,pageX:x,pageY:y,screenX:x,screenY:y});
   const event=(type,changed,all)=>cv.dispatchEvent(new TouchEvent(type,{changedTouches:changed,touches:all,targetTouches:all,bubbles:true,cancelable:true}));
   const p0={x:WORLD.P.x,z:WORLD.P.z,yaw:WORLD.P.yaw};
   let a=make(11,85,510),b=make(22,285,510);event('touchstart',[a,b],[a,b]);
   a=make(11,85,450);b=make(22,303,506);event('touchmove',[a,b],[a,b]);
   const joystickVisible=getComputedStyle(document.getElementById('js')).display!=='none';
   for(let i=0;i<35;i++)WORLD.tick(1/60);
   const moved=Math.hypot(WORLD.P.x-p0.x,WORLD.P.z-p0.z),turned=Math.abs(WORLD.P.yaw-p0.yaw),speed=WORLD.P.spd;
   event('touchend',[a,b],[]);const ended=getComputedStyle(document.getElementById('js')).display==='none';
   a=make(33,80,530);event('touchstart',[a],[a]);window.dispatchEvent(new Event('blur'));const cleared=getComputedStyle(document.getElementById('js')).display==='none';
   return {joystickVisible,moved,turned,speed,ended,cleared};
  });assert(report.mobile.touch.joystickVisible&&report.mobile.touch.moved>.25&&report.mobile.touch.turned>.02&&report.mobile.touch.ended&&report.mobile.touch.cleared,'Two-thumb controls failed');
  report.mobile.jump=await mobile.evaluate(()=>{
   for(let i=0;i<80;i++)WORLD.tick(1/60);const bj=document.getElementById('bj');bj.dispatchEvent(new TouchEvent('touchstart',{changedTouches:[],bubbles:true,cancelable:true}));WORLD.tick(1/60);return {vy:WORLD.P.vy,height:WORLD.P.y-WORLD.H(WORLD.P.x,WORLD.P.z)};
  });assert(report.mobile.jump.vy>3,'Touch jump failed');
  await mobile.evaluate(()=>{for(let i=0;i<120;i++)WORLD.tick(1/60);WORLD.setTime(12,true);WORLD.build(1000,1);WORLD.render()});
  report.mobile.stats=await mobile.evaluate(()=>WORLD.stats());assert(report.mobile.stats.failed.length===0,'Mobile chunk generation failed');console.log('Mobile WebGL1 / touch passed');
  assert(report.externalRequests.length===0,'Offline build made external requests');assert(report.errors.length===0,'JavaScript or shader errors');
  console.log(JSON.stringify(report,null,2));
  await context.close();await mobileContext.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
