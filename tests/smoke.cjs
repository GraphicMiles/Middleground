const {chromium}=require('playwright');const fs=require('fs');const path=require('path');const {pathToFileURL}=require('url');const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-webgl','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:800,height:450},deviceScaleFactor:1});page.setDefaultTimeout(60000);
  const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('JS:',e.message)});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error('CONSOLE:',m.text().slice(0,3500));}});
  await page.context().setOffline(true);
  await page.goto(pathToFileURL(path.join(root,'index.html')).href,{waitUntil:'load',timeout:60000});console.log('Loaded');
  await page.waitForFunction(()=>window.WORLD?.stats().ready,{timeout:90000});console.log('Spawn ready');
  await page.evaluate(()=>{WORLD.pause(true);document.getElementById('start').style.display='none';WORLD.P.tp=-.04;WORLD.step(.05);WORLD.render();});
  const baseline=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','baseline.json'),'utf8'));
  const report=await page.evaluate(b=>({stats:WORLD.stats(),spawn:{x:WORLD.P.x,z:WORLD.P.z,y:WORLD.P.y},heightError:Math.max(...b.heights.map(p=>Math.abs(WORLD.H(p.x,p.z)-p.y))),chunks:[...WORLD.chunks.values()].filter(c=>c.pDone).map(c=>({key:c.key,cs:c.cs,collisions:c.col,plants:(c.aqm||[]).reduce((n,m)=>n+m.geometry.instanceCount,0)})),renderer:WORLD.renderer.getContext().getParameter(WORLD.renderer.getContext().RENDERER)}),baseline);
  report.chunksCompared=0;report.signatureMismatches=[];report.collisionMismatches=[];
  for(const c of report.chunks){const old=baseline.chunks.find(o=>o.key===c.key);if(!old)continue;report.chunksCompared++;if(c.cs!==old.cs)report.signatureMismatches.push(c.key);if(JSON.stringify(c.collisions)!==JSON.stringify(old.collisions))report.collisionMismatches.push(c.key);}
  report.errors=errors;
  console.log(JSON.stringify({stats:report.stats,spawn:report.spawn,heightError:report.heightError,compared:report.chunksCompared,signatureMismatches:report.signatureMismatches,collisionMismatches:report.collisionMismatches,errors},null,2));
  if(report.chunksCompared<9||errors.length||report.heightError!==0||report.signatureMismatches.length||report.collisionMismatches.length)process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
