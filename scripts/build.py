from pathlib import Path
import re, json, base64, argparse, subprocess
root=Path(__file__).resolve().parents[1]
source=root/'src'
parser=argparse.ArgumentParser(description="Build the self-contained Okavango Marsh game.")
parser.add_argument('--check', action='store_true', help='Also check generated JavaScript with Node.js.')
args=parser.parse_args()
original=(source/'base.html').read_text()
inline=re.search(r'<script>\n(.*?)</script>', original, re.S)
external=re.search(r'<script\s+src=[^>]+>', original)
if not inline or not external:
 raise ValueError('Original upload does not contain the expected script blocks.')
s=inline.group(1)
original_shell=original[:external.start()]
ground_textures=json.dumps({key:'data:image/png;base64,'+base64.b64encode((root/'assets'/name).read_bytes()).decode('ascii') for key,name in [('detail','ground-detail.png'),('normal','ground-normal.png')]})
# Recorded ambience beds. Embedded as data URIs for the same reason the ground
# textures are: the build must stay a single offline file with no network fetches.
_amb=root/'assets'/'ambience'
amb_audio=json.dumps({f.stem:'data:audio/ogg;base64,'+base64.b64encode(f.read_bytes()).decode('ascii') for f in sorted(_amb.glob('*.ogg'))}) if _amb.is_dir() else '{}'
def replace(old,new):
 global s
 n=s.count(old)
 if n!=1: raise ValueError(f'Expected one match, found {n}: {old[:160]}')
 s=s.replace(old,new,1)
def region(start,end,text):
 global s
 i=s.index(start);j=s.index(end,i)
 s=s[:i]+text+'\n'+s[j:]
# Keep the original deterministic world, player simulation and basic controls.
region('const U={','const GN=',(source/'environment.js').read_text())
region('/* sky */','/* terrain material:',(source/'sky.js').read_text())
region('/* terrain material:','/* shared prop geometry */','const GROUND_TEXTURES='+ ground_textures+';\n'+(source/'ground.js').read_text()+'\n'+(source/'materials.js').read_text()+'\n'+(source/'water.js').read_text())
replace('const TRG=new T.CylinderGeometry', '''// A crown reads as a cluster of foliage lobes, not a smooth ellipsoid, so the
// displacement is strong and low frequency: that is what puts gaps and
// unevenness into the silhouette instead of one rounded blob.
function canopyGeometry(seg,ring){const g=new T.SphereGeometry(1,seg,ring),p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),f=.62+.52*vn(x*1.25+33.4,z*1.25+y*1.05,185);p.setXYZ(i,x*f,y*f,z*f)}g.computeVertexNormals();return g}
const PDG_LO=canopyGeometry(8,5);
// Trunks sweep out into the ground instead of standing as straight cones. The
// profile is concave: a rapid flare that settles into the shaft, ending at .62
// so it meets the next branch segment (radius R*.62) without a visible step.
// The base stays within the collision radius the simulation already uses.
function trunkGeometry(){const pts=[];for(let i=0;i<=6;i++){const y=i/6;pts.push(new T.Vector2(.62+1.03*Math.exp(-y*5.2),y))}const g=new T.LatheGeometry(pts,9);g.computeVertexNormals();return g}
const TRT=trunkGeometry();
// Baobabs are a flared barrel that narrows abruptly at the shoulder. The base
// is capped at 1.10: collisions hold the player at .95*r+.35, and 1.10*r stays
// inside that for the whole generated radius range of 1.1 to 2.0.
function baobabGeometry(){const pts=[];for(let i=0;i<=7;i++){const y=i/7;pts.push(new T.Vector2(Math.max(.30,.55+.55*Math.exp(-y*2.2)-.28*Math.pow(y,6)),y))}const g=new T.LatheGeometry(pts,12);g.computeVertexNormals();return g}
const TRB_BAOBAB=baobabGeometry();
const TRG=new T.CylinderGeometry''')
replace('PDG=jit(new T.SphereGeometry(1,9,5))','PDG=canopyGeometry(14,9)')
replace('TRB=new T.CylinderGeometry(.8,1,1,12,1,false).translate(0,.5,0)','TRB=TRB_BAOBAB')
replace('add(PDG,pd,true', 'add(lo?PDG_LO:PDG,pd,true')
# The old palette was authored as display colour. Decode albedo before ACES,
# rather than washing the original ochre soil into a white surface.
replace('const cc=ground(e,m,x,z),v=.88+.24*h(Math.floor(x*.5),Math.floor(z*.5),9);col.set([cc[0]*v,cc[1]*v,cc[2]*v],k*3);', 'const cc=ground(e,m,x,z),v=.94+.12*h(Math.floor(x*.5),Math.floor(z*.5),9);col.set(cc.map(a=>(a<=.04045?a/12.92:Math.pow((a+.055)/1.055,2.4))*v),k*3);')
# Ground albedo and material metadata only; no height/layout/physics changes.
i=s.index('const CG=');j=s.index('const place=',i)
legacy=s[s.index('const cmask=',i):s.index('function ground(',i)]
s=s[:i]+legacy+'function ground(e,m,x,z){return GROUND.color(e,m,x,z)}\n'+s[j:]
replace('am=new Float32Array(N*N);let cs=0;', 'am=new Float32Array(N*N),soilInfo=new Float32Array(N*N*4);let cs=0;')
replace('const cc=ground(e,m,x,z),v=.94+.12*h(Math.floor(x*.5),Math.floor(z*.5),9);', 'const slope=Math.hypot(nx,nz)/(2*ST),surface=GROUND.profile(x,z,e,m,slope),cc=GROUND.color(e,m,x,z,slope,surface),v=1;soilInfo.set([surface.wet,surface.clay,surface.gravel,surface.crack],k*4);')
replace("g.setAttribute('aM',new T.BufferAttribute(am,1));", "g.setAttribute('aM',new T.BufferAttribute(am,1));g.setAttribute('aSoil',new T.BufferAttribute(soilInfo,4));")
replace('const t=new T.Mesh(g,TM);t.receiveShadow=true;', 'const t=new T.Mesh(g,TM);t.receiveShadow=true;t.userData.ground=true;')
replace('c.eg=eg;c.mg=mg;c.cs=cs;', 'c.soilInfo=soilInfo;c.eg=eg;c.mg=mg;c.cs=cs;')

replace('f(a);D.updateMatrix();im.setMatrixAt(i,D.matrix);im.setColorAt(i,co)', 'f(a);if(mat===MT||mat===MR)co.convertSRGBToLinear();D.updateMatrix();im.setMatrixAt(i,D.matrix);im.setColorAt(i,co)')
# Cached water-side data uses the same padded terrain heights at chunk borders.
replace('soilInfo=new Float32Array(N*N*4);let cs=0;', 'soilInfo=new Float32Array(N*N*4),waterInfo=new Float32Array(N*N*2);let cs=0;')
replace('eg[k]=e;mg[k]=m;dp[k]=WL-e;am[k]=cmask(x,z,e-WL);cs+=e*(k%7+1)', 'eg[k]=e;mg[k]=m;dp[k]=WL-e;am[k]=cmask(x,z,e-WL);waterInfo[k*2]=cl(.30+.52*m+.18*sm(.1,1.2,dp[k]));waterInfo[k*2+1]=sm(.025,.9,WL-Math.max(e,hp[q-1],hp[q+1],hp[q-PN],hp[q+PN]));cs+=e*(k%7+1)')
replace("wg.setAttribute('aD',new T.BufferAttribute(dp,1));", "wg.setAttribute('aD',new T.BufferAttribute(dp,1));wg.setAttribute('aWater',new T.BufferAttribute(waterInfo,2));")
replace('c.eg=eg;c.mg=mg;c.cs=cs;', 'c.eg=eg;c.mg=mg;c.waterInfo=waterInfo;c.cs=cs;')

# The new plant generator has its own seeded random stream.
replace('function* genProps(c){',(source/'trees.js').read_text()+'\n'+(source/'aquatic.js').read_text()+'\nfunction* genProps(c){')
replace('g.index=bl.index;g.setAttribute(\'position\',bl.attributes.position);',"g.index=bl.index.clone();g.setAttribute('position',bl.attributes.position.clone());")
replace('im.frustumCulled=false;im.castShadow=sh;im.userData.sh=sh;made.push(im)',"im.frustumCulled=false;im.castShadow=sh;im.userData.sh=sh;if(mat===MTS||mat===LM)im.customDepthMaterial=treeDepth;made.push(im)")
replace('co.setRGB(...a[5])},MTS);yield;', 'co.setRGB(...a[5])},LM);addCanopyLeaves(pd,x0,z0,made,lo);yield;')
replace('c.pm=made;for(const m of made)', 'c.crowns=pd;c.pm=made;for(const m of made)')
# ---- Pass 6a: our own curved/tapered branch skeleton for generic + dead trees ----
replace("tpos=[],lo=c.lo=wantLo(c);","tpos=[],bv=[],bn=[],bi=[],bc=[],buv=[],lv=[],ln=[],li=[],lc=[],luv=[],hi=c.d<=1,seg=c.d<=1?10:(c.d===2?8:6),lo=c.lo=wantLo(c);let supLeft=c.d===0?2:0;")
NEW_TREE = """ const sup=ty===0&&supLeft>0&&((x-P.x)*(x-P.x)+(z-P.z)*(z-P.z))<324;if(sup)supLeft--;
 const st=savannahTree(tr,{bv,bn,bi,bc,buv,lv,ln,li,lc,luv,x0,z0,seg,hi,sup},x,e,z,u,lo,ty===2);
 if(st.lf)for(const tp of st.tips)leafCluster(tr,{lv,ln,li,lc,luv,x0,z0},tp[0],tp[1],tp[2],tp[3],st.lf,lo);
 col.push([x,z,st.R+.2,1e9]);tpos.push([x,z,st.R,st.pr])};"""
i6=s.index("  const dead=ty===2,R=");j6=s.index("tpos.push([x,z,R,pr])};",i6)+len("tpos.push([x,z,R,pr])};")
if s.count("  const dead=ty===2,R=")!=1 or s.count("tpos.push([x,z,R,pr])};")!=1: raise ValueError("6a tree anchors not unique")
s=s[:i6]+NEW_TREE+"\n"+s[j6:]
replace("const D=new T.Object3D(),co=new T.Color(),made=[];D.rotation.order='YXZ';",
 "const D=new T.Object3D(),co=new T.Color(),made=[];D.rotation.order='YXZ';\n if(bv.length){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(bv,3));g.setAttribute('normal',new T.Float32BufferAttribute(bn,3));g.setAttribute('color',new T.Float32BufferAttribute(bc,3));g.setAttribute('uv',new T.Float32BufferAttribute(buv,2));g.setIndex(bi);const m=new T.InstancedMesh(g,MT_BRANCH,1);m.setMatrixAt(0,new T.Matrix4());m.castShadow=true;m.customDepthMaterial=treeDepth;m.frustumCulled=false;made.push(m)}\n if(lv.length){const g2=new T.BufferGeometry();g2.setAttribute('position',new T.Float32BufferAttribute(lv,3));g2.setAttribute('normal',new T.Float32BufferAttribute(ln,3));g2.setAttribute('color',new T.Float32BufferAttribute(lc,3));g2.setAttribute('uv',new T.Float32BufferAttribute(luv,2));g2.setIndex(li);const m2=new T.InstancedMesh(g2,MT_LEAF,1);m2.setMatrixAt(0,new T.Matrix4());m2.castShadow=true;m2.customDepthMaterial=LEAF_DEPTH;m2.frustumCulled=false;made.push(m2)}")

replace('else if(s===1)c.job=genGrass(c);else c.job=genProps(c)', 'else if(s===1)c.job=genGrass(c);else if(s===2)c.job=genProps(c);else c.job=genAquatic(c)')
replace("catch(err){c.job=null;c.fail=(c.fail||0)+1", "catch(err){if(!c.fail)console.error('Chunk '+c.key,err);c.job=null;c.fail=(c.fail||0)+1")
replace("c.pm=[];c.col=[];c.bq=[];c.eg=c.mg=null", "c.pm=[];c.aqm=[];c.crowns=[];c.col=[];c.bq=[];c.eg=c.mg=c.waterInfo=c.soilInfo=null")
replace("todo:[0,1,2],meshes:[],tier:-1,col:[],bq:[],pm:[]", "todo:[0,1,2,3],meshes:[],tier:-1,aqt:-1,col:[],bq:[],pm:[],aqm:[],crowns:[]")
replace("const nt=tierOf(c)!==c.tier||c.gq!==qm,np=wantLo(c)!==c.lo;if(nt||np){c.state='DEGRADING';c.todo=[];if(nt)c.todo.push(1);if(np)c.todo.push(2)}", "const nt=tierOf(c)!==c.tier||c.gq!==qm,np=wantLo(c)!==c.lo,na=aquaticTier(c)!==c.aqt||c.aqq!==qm;if(nt||np||na){c.state='DEGRADING';c.todo=[];if(nt)c.todo.push(1);if(np)c.todo.push(2);if(na)c.todo.push(3)}")
# Input fixes don't change bindings, acceleration, sprint, jump or collisions.
replace('let SENS=1,qm=0,sprintB=false', "let SENS=[.6,1,1.5,2].includes(saved.sensitivity)?saved.sensitivity:1,qm=[0,1,2].includes(saved.quality)?saved.quality:0,sprintB=false")
replace("addEventListener('blur',()=>{for(const k in K)K[k]=0});", "function resetInput(){for(const k in K)K[k]=0;stick=null;look=null;jumpQ=0;$('js').style.display='none'}\naddEventListener('blur',resetInput);")
replace('document.pointerLockElement===cv||e.buttons&1', 'document.pointerLockElement===cv||(e.target===cv&&e.buttons&1)')
replace("cv.addEventListener('click',()=>{if(!coarse&&!document.pointerLockElement&&cv.requestPointerLock)cv.requestPointerLock()});", "function requestMouseLock(){if(coarse||window.top!==window||document.pointerLockElement===cv||!cv.requestPointerLock)return;try{const p=cv.requestPointerLock();if(p&&p.catch)p.catch(()=>{})}catch(e){}}\ncv.addEventListener('click',requestMouseLock);")
replace("$('go').onclick=()=>{$('start').style.display='none';audioInit();if(AC&&AC.resume)AC.resume();hint();if(!coarse)cv.requestPointerLock&&cv.requestPointerLock()};", "$('go').onclick=()=>{if(!spawnReady)return;started=true;$('start').classList.add('leaving');setTimeout(()=>{$('start').style.display='none'},550);audioInit();if(AC&&AC.resume)AC.resume().catch(()=>{});hint();requestMouseLock()};")
region('/* ---------- atmosphere dust ---------- */','/* ---------- soaring birds', (source/'effects.js').read_text().replace('/* water-feedback */',(source/'water-feedback.js').read_text()))
# Put existing bird colours through the same clean colour-management pass.
replace("fragmentShader:'uniform vec3 uFog;void main(){gl_FragColor=vec4(mix(vec3(.07,.065,.06),uFog,.35),1.);}'}", "fragmentShader:'uniform vec3 uFog;uniform float uDay;void main(){gl_FragColor=vec4(mix(vec3(.07,.065,.06)*(.22+.78*uDay),uFog,.35),1.);'+DISPLAY+'}'}")
# Same herd counts, spawning and steering; replace only model / articulation.
start=s.index('/* ---------- wildlife:');tail=s.index(' const herds=[],D=new T.Object3D();',start)
s=s[:start]+(source/'fauna-model.js').read_text()+s[tail:]
replace('const o=i++;\n    if(!h.on)', 'const o=i++;gait[o*2+1]=0;\n    if(!h.on)')
replace('m.y=H(m.x,m.z);\n     D.scale.set(1.1,1.1,1.1);', 'm.y=H(m.x,m.z);m.gait=(m.gait===undefined?m.ph:m.gait)+v*dt*(h.fl>0?2.7:4.1);gait[o*2]=m.gait;gait[o*2+1]=v;\n     D.scale.set(1.1,1.1,1.1);')
replace('D.updateMatrix();im.setMatrixAt(o,D.matrix)}}', 'D.updateMatrix();im.setMatrixAt(o,D.matrix);updateAnimalLegs(o,D.matrix,gait[o*2],gait[o*2+1])}}')
replace('im.instanceMatrix.needsUpdate=true}})();', 'im.instanceMatrix.needsUpdate=true;limbs.instanceMatrix.needsUpdate=true}})();')
replace("ren.setPixelRatio(pr);$('bq').textContent='GFX '+QN[qm]}", "ren.setPixelRatio(pr);U.uFX.value=qm===1?.28:qm===2?1:.85;U.uLeafFar.value=qm===1?45:qm===2?96:76;$('bq').textContent='GFX '+QN[qm];$('bn').textContent='SENS '+SENS.toFixed(1);GROUND.syncQuality(qm,U.uFX.value)}")
replace("$('bq').onclick=()=>{qm=(qm+1)%3;applyQ()};", "$('bq').onclick=()=>{qm=(qm+1)%3;applyQ();saveSettings()};")
replace("$('bn').textContent='SENS '+SENS.toFixed(1)};", "$('bn').textContent='SENS '+SENS.toFixed(1);saveSettings()};")
replace("e.textContent='ontouchstart' in window?", "e.textContent=coarse?")

# Route ground contact through the material-aware helpers instead of the
# original wet/dry-only noiseHit at both call sites.
replace("noiseHit(wet>.05?2600:700,.1,.25)","landHit(P.x,P.z,dpt,im)")
replace("noiseHit(wet>.05?2600:1100,wet>.05?.12:.05,wet>.05?.35:.16)","footstep(P.x,P.z,dpt)")
region('/* ---------- procedural audio ---------- */',"$('bj').addEventListener", 'const AMB_BEDS='+amb_audio+';\n'+(source/'audio.js').read_text())
replace("$('bm').onclick=()=>{todI=(todI+1)%TODS.length;todT=TODS[todI];todTime=6};", "$('bm').onclick=()=>{todI=(todI+1)%TODS.length;setTime(TODS[todI].hour)};")
replace("document.addEventListener('visibilitychange',()=>{if(AC&&AC.suspend)document.hidden?AC.suspend():AC.resume()});", "document.addEventListener('visibilitychange',()=>{resetInput();last=performance.now();if(AC){const p=document.hidden?AC.suspend():AC.resume();if(p&&p.catch)p.catch(()=>{})}});\naddEventListener('pagehide',saveSettings);")
# Extend existing culling to the optional aquatic draws.
replace('const pm=c.pm;if(!pm||!pm.length)continue;', 'const pm=c.pm||[],aq=c.aqm||[];if(!pm.length&&!aq.length)continue;')
replace('for(const m of pm){m.visible=vis;m.castShadow=vis&&near&&m.userData.sh}}}', 'for(const m of pm){m.visible=vis;m.castShadow=vis&&near&&m.userData.sh}for(const m of aq)m.visible=vis&&dist<U.uFar.value*.94;}}')
replace('function shadowAim(){const L=sdir,', 'function shadowAim(){const L=keydir,')
replace('.addScaledVector(sdir,120)', '.addScaledVector(keydir,120)')
# Main loop: keep physics timestep bounded but measure actual frame duration.
start=s.index('function loop(now){');end=s.index("addEventListener('resize'",start)
loop=r'''let simT=0,debugPause=false,contextPaused=false,spawnReady=false;
$('go').disabled=true;
function updateSpawn(){
 if(spawnReady)return;
 let ready=0,total=0;
 for(const c of chunks.values())if(c.d<=1){total++;if(c.state==='ACTIVE'&&c.pDone&&c.eg)ready++}
 $('go').textContent='Preparing wetland · '+ready+'/'+total;
 if(total===9&&ready===9){spawnReady=true;$('go').disabled=false;$('go').textContent='Tap to explore'}
}
cv.addEventListener('webglcontextlost',e=>{e.preventDefault();contextPaused=true;resetInput();$('ht').textContent='Graphics paused · restoring…';$('ht').style.opacity=1});
cv.addEventListener('webglcontextrestored',()=>{contextPaused=false;last=performance.now();applyQ();$('ht').style.opacity=0});
function loop(now){
 requestAnimationFrame(loop);
 const rawDt=Math.max(0,(now-last)/1000);last=now;
 if(document.hidden||debugPause||contextPaused)return;
 const dt=Math.min(.05,rawDt);simT+=dt;U.uT.value=simT;
 hudT-=dt;if(hudT<=0){hudT=.15;stream();sunVisT=sunOcc()}
 if(started)move(dt);
 U.uPl.value.set(P.x-ox,P.y,P.z-oz);U.uMv.value=cl(P.spd/4);
 animals(dt,simT);envStep(dt);waterFX(dt,simT);atmosphere(dt);GROUND.syncQuality(qm,U.uFX.value);
 sky.position.copy(cam.position);lantern.position.copy(cam.position);lantern.position.y-=.22;
 cam.updateMatrixWorld();cull();ui(dt);audioStep(dt);
 work(spawnReady?(fps<45?2.5:5):11,spawnReady?99:1);updateSpawn();shadowAim();
 ren.render(scene,cam);
 acc+=rawDt;fr++;
 if(acc>.5){
  fps=fr/acc;fr=0;acc=0;if(dbgs.on){hud();drawMap()}
  if(qm===0){
   if(fps<40){lowT+=.5;hiT=0;
    if(lowT>=2){lowT=0;
     // Shed added effects before changing the original game's resolution.
     if(U.uFX.value>.5)U.uFX.value=.45;
     else if(U.uFX.value>.3)U.uFX.value=.28;
     else if(pr>.75){pr=Math.max(.7,pr-.15);ren.setPixelRatio(pr)}
     else if(shOn){setShadow(false);shAuto=1;shOffT=0}
    }
   }else if(fps>57){lowT=0;hiT+=.5;
    if(hiT>=8){hiT=0;if(pr<prCap-.01){pr=Math.min(prCap,pr+.1);ren.setPixelRatio(pr)}else if(U.uFX.value<.84)U.uFX.value=Math.min(.85,U.uFX.value+.20)}
    if(shAuto&&!shOn&&pr>=prCap-.01){shOffT+=.5;if(shOffT>=20*(1<<Math.min(shTry,4))){shOffT=0;shTry++;shAuto=0;setShadow(true,1024)}}
   }else{lowT=0;hiT=0}
  }
 }
}
'''
s=s[:start]+loop+s[end:]
start=s.index('window.WORLD=');end=s.index('\n})();',start)
s=s[:start]+r'''window.WORLD={
 chunks,ENV,applyEnv,H,P,water:WATER,ground:GROUND,
 stats:()=>({regen,mism,unloaded,fps,quality:QN[qm],pixelRatio:pr,calls:ren.info.render.calls,triangles:ren.info.render.triangles,geometries:ren.info.memory.geometries,textures:ren.info.memory.textures,optionalEffects:U.uFX.value,time:dayHour,ready:spawnReady,failed:[...chunks.values()].filter(c=>c.state==='FAILED').map(c=>({key:c.key,error:c.err}))}),
 setTime,time:()=>dayHour,setClockRunning:on=>{clockRunning=!!on},
 setQuality:q=>{if(Number.isInteger(q)&&q>=0&&q<=2){qm=q;applyQ();saveSettings()}},
 pause:on=>{debugPause=!!on;last=performance.now()},
 step:dt=>{move(cl(dt,0,.05));stream();U.uPl.value.set(P.x-ox,P.y,P.z-oz)},
 tick:dt=>{dt=cl(dt,0,.05);simT+=dt;U.uT.value=simT;move(dt);stream();U.uPl.value.set(P.x-ox,P.y,P.z-oz);U.uMv.value=cl(P.spd/4);animals(dt,simT);envStep(dt);waterFX(dt,simT);atmosphere(dt)},
 build:(budget=8,maxD=99)=>{work(cl(budget,1,1000),maxD);updateSpawn()},
 render:()=>{GROUND.syncQuality(qm,U.uFX.value);updateWaterUniforms();U.uPl.value.set(P.x-ox,P.y,P.z-oz);animals(0,U.uT.value);atmosphere(1.2);sky.position.copy(cam.position);lantern.position.copy(cam.position);lantern.position.y-=.22;cam.updateMatrixWorld();cull();shadowAim();ui(0);ren.render(scene,cam)},
 camera:cam,renderer:ren,scene,uniforms:U
};
applyQ();stream();work(12,1);move(.016);updateSpawn();
requestAnimationFrame(t=>{last=t;loop(t)});
'''+s[end:]
if args.check:
 subprocess.run(['node','--check','-'],input=s,text=True,check=True)
# Emit one self-contained game. The original upload is the only base source.
shell=original_shell
shell=shell.replace('<meta name="viewport"', '<meta name="theme-color" content="#15221c"><meta name="description" content="A clean, phone-first Okavango wetland exploration. Single-file and offline-ready.">\n<meta name="viewport"')
shell=shell.replace('</style>', '''
/* Cleaner presentation, without changing the original controls or layout. */
#vg{background:radial-gradient(ellipse at 50% 55%,#0000 65%,#0003 100%)}
#start{background:linear-gradient(180deg,#101c18c9,#11211cd9);transition:opacity .55s ease}
#start.leaving{opacity:0;pointer-events:none}
#start b{font-family:ui-sans-serif,system-ui,sans-serif;letter-spacing:.035em;font-weight:500;font-size:clamp(24px,5vw,36px)!important}
#start>div{max-width:560px;line-height:1.8}
#go{margin-top:12px;padding:14px 24px;background:#d7dfc2;color:#1a2a20;border-color:#d7dfc2;letter-spacing:.08em}
#go:disabled{opacity:.60;cursor:wait}
#cp{font-size:11px;letter-spacing:.12em}
.b{min-height:40px}.b.p{min-height:34px}
@media(max-width:720px){#cp{left:auto;right:10px;top:calc(47px + env(safe-area-inset-top,0px));transform:none;font-size:10px;letter-spacing:.08em}#hud{top:calc(72px + env(safe-area-inset-top,0px))}#map{top:calc(72px + env(safe-area-inset-top,0px));width:120px;height:120px}}
@media(prefers-reduced-motion:reduce){#start{transition:none}#ht{transition:none}}
</style>''')
shell=shell.replace('Seeded, streamed wetland · first person', 'The same living wetland · a clearer, more natural world')
shell=shell.replace('Desktop: click, WASD + mouse', 'Desktop: click or drag to look · WASD + mouse')
shell=shell.replace('Buttons: JUMP · TIME of day · GFX quality · SENS look speed', 'Buttons: JUMP · TIME of day · GFX quality · SENS look speed<br>Day and night flow naturally · TIME skips ahead · settings are remembered')
shell=shell.replace('id="go" style="position:static"', 'id="go" style="position:static" disabled')
lib=(root/'assets/three-r128.min.js').read_text()
# Three.js retains its MIT licence notice in the embedded runtime.
assert '</script' not in lib.lower()
final=shell+'<!-- Three.js r128, MIT licence, embedded for offline play. Original world seed and physics retained. -->\n<script>\n'+lib+'\n</script>\n<script>\n'+s+'\n</script></body></html>\n'
(root/'index.html').write_text(final)
print(f'Built {len(s):,} characters of game code; self-contained HTML {len(final):,} characters.')
