/* ---------- ambience: recorded beds, procedural air, spatial calls ---------- */
let AC=null,AU=null,bT=3,frogT=2;

/* The recorded beds supply the broadband texture that filtered white noise
   cannot fake: real air, real water, real insects. They are mixed strictly
   UNDER the procedural layer, which keeps everything responsive to the player
   and the wind. Long gain time constants so the beds glide rather than pump.
   See assets/ambience for the sources and licences. */
const BED_CFG={bay:{lp:5200,pan:-.25},park:{lp:9000,pan:.18},night:{lp:11000,pan:0}};

function b64Buf(u){
 const i=u.indexOf(','),bin=atob(u.slice(i+1)),a=new Uint8Array(bin.length);
 for(let k=0;k<bin.length;k++)a[k]=bin.charCodeAt(k);
 return a.buffer;
}
function startBeds(){
 if(!AC||!AU||typeof AMB_BEDS!=='object')return;
 AU.beds={};
 for(const k in AMB_BEDS){
  const c=BED_CFG[k]||{lp:9000,pan:0};
  AC.decodeAudioData(b64Buf(AMB_BEDS[k]),buf=>{
   if(!AC)return;
   const sr=AC.createBufferSource();sr.buffer=buf;sr.loop=true;
   const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=c.lp;
   const g=AC.createGain();g.gain.value=0;
   sr.connect(f);f.connect(g);
   if(c.pan&&AC.createStereoPanner){const p=AC.createStereoPanner();p.pan.value=c.pan;g.connect(p);p.connect(AC.destination)}
   else g.connect(AC.destination);
   sr.start(0,Math.random()*Math.max(0,buf.duration-1));
   AU.beds[k]=g;
  },()=>{});
 }
}
function audioInit(){
 if(AC)return;
 try{
  AC=new(window.AudioContext||window.webkitAudioContext)();
  const n=AC.sampleRate*2,b=AC.createBuffer(1,n,AC.sampleRate),d=b.getChannelData(0);
  for(let i=0;i<n;i++)d[i]=Math.random()*2-1;AU={b,shoreT:0,waterX:P.x,waterZ:P.z,waterDistance:80};
  const loop=(type,fq,q)=>{const sr=AC.createBufferSource();sr.buffer=b;sr.loop=true;
   const f=AC.createBiquadFilter();f.type=type;f.frequency.value=fq;f.Q.value=q;
   const g=AC.createGain();g.gain.value=0;sr.connect(f);f.connect(g);sr.start();return {f,g,sr};
  };
  const wind=loop('bandpass',450,.5);wind.g.connect(AC.destination);AU.f=wind.f;AU.g=wind.g;
  AU.water=loop('bandpass',620,.55);
  if(AC.createStereoPanner){AU.water.pan=AC.createStereoPanner();AU.water.g.connect(AU.water.pan);AU.water.pan.connect(AC.destination)}else AU.water.g.connect(AC.destination);
  AU.insects=loop('bandpass',3900,5);AU.insects.g.connect(AC.destination);
  /* Nearby vegetation rustle: a higher, tighter band than the air layer, driven
     by wind AND by how much brush the player is actually standing in, so it
     reads as leaves moving around them rather than a constant hiss. */
  AU.rustle=loop('bandpass',2600,2.2);AU.rustle.g.connect(AC.destination);
  startBeds();
 }catch(e){AC=null}
}
/* Material-specific ground contact. GROUND.inspect returns the same surface
   classification the renderer uses, so a footstep agrees with what is actually
   underfoot instead of the old single wet/dry switch. Wading is handled first
   because water depth dominates whatever the bed material is. */
function footstep(x,z,dpt){
 if(!AC||!AU)return;const d=cl(dpt/1.2);
 if(d>.04){noiseHit(2200+1400*d,.05+.07*d,.18+.16*d);if(d>.30)noiseHit(260,.06*d,.20);return}
 const g=GROUND.inspect(x,z);
 if(g.wet>.45){noiseHit(300,.085,.13);noiseHit(1800,.040,.09);return}
 if(g.clay>.18){noiseHit(1400,.065,.08);noiseHit(5200,.030,.05);return}
 if(g.gravel>.25){noiseHit(3200,.055,.07);noiseHit(6200,.028,.05);return}
 if(g.silt>.30){noiseHit(900,.048,.13);return}
 if(g.grass>.25){noiseHit(3300,.032,.13);return}
 noiseHit(1100,.050,.15);
}
function landHit(x,z,dpt,im){
 if(!AC||!AU)return;const v=cl(im/10);
 if(dpt>.15){noiseHit(2400,.05+.10*v,.30);noiseHit(220,.05+.10*v,.22);return}
 const g=GROUND.inspect(x,z);
 noiseHit(g.wet>.45?700:g.clay>.18?1300:900,.07+.06*v,.22);
}
function noiseHit(fq,vol,dur){
 if(!AC||!AU)return;const sr=AC.createBufferSource();sr.buffer=AU.b;
 const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=fq;
 const g=AC.createGain(),t=AC.currentTime;g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);
 sr.connect(f);f.connect(g);g.connect(AC.destination);sr.start(t,Math.random(),dur+.05);
 sr.onended=()=>{sr.disconnect();f.disconnect();g.disconnect()};
}
function callPanner(angle,distance){
 const p=AC.createPanner();p.panningModel='HRTF';p.distanceModel='inverse';p.refDistance=12;p.maxDistance=160;p.rolloffFactor=.75;
 const x=P.x+Math.cos(angle)*distance,z=P.z+Math.sin(angle)*distance;
 if(p.positionX){p.positionX.value=x;p.positionY.value=2;p.positionZ.value=z}else p.setPosition(x,2,z);
 p.connect(AC.destination);return p;
}
function chirp(){
 if(!AC)return;const t=AC.currentTime,n=2+(Math.random()*3|0),f0=2200+Math.random()*1800,p=callPanner(Math.random()*6.283,20+Math.random()*48);
 for(let i=0;i<n;i++){
  const o=AC.createOscillator(),g=AC.createGain(),s=t+i*.13;
  o.frequency.setValueAtTime(f0,s);o.frequency.exponentialRampToValueAtTime(f0*1.4,s+.07);
  g.gain.setValueAtTime(0,s);g.gain.linearRampToValueAtTime(.014,s+.02);g.gain.linearRampToValueAtTime(0,s+.09);
  o.connect(g);g.connect(p);o.start(s);o.stop(s+.10);
  o.onended=()=>{o.disconnect();g.disconnect();if(i===n-1)p.disconnect()};
 }
}
function frogCall(){
 if(!AC)return;const t=AC.currentTime,o=AC.createOscillator(),g=AC.createGain();
 const dx=AU.waterX-P.x,dz=AU.waterZ-P.z,p=callPanner(Math.atan2(dz,dx),Math.max(16,AU.waterDistance));
 o.type='triangle';o.frequency.setValueAtTime(210+Math.random()*70,t);o.frequency.exponentialRampToValueAtTime(125,t+.32);
 g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.020,t+.025);g.gain.exponentialRampToValueAtTime(.001,t+.38);
 o.connect(g);g.connect(p);o.start(t);o.stop(t+.42);o.onended=()=>{o.disconnect();g.disconnect();p.disconnect()};
}
function audioStep(dt){
 if(!AC||!AU)return;const t=AC.currentTime,wind=cl((U.uWind.value.length()-.30)/.55),night=U.uNight.value;
 const T=U.uT.value;
 /* Air movement gusts on two slow incommensurate rates instead of holding one
    steady filtered-noise level, which is what made it read as hiss. */
 const gust=.80+.14*Math.sin(T*.31)+.08*Math.sin(T*.79+1.7);
 AU.g.gain.setTargetAtTime((.010+.042*wind*wind)*gust,t,.35);
 AU.f.frequency.setTargetAtTime(300+500*wind+40*Math.sin(T*.47),t,.35);
 /* Halved: the night bed now carries real insects, so this only adds sparkle. */
 AU.insects.g.gain.setTargetAtTime((.001+night*.005)*(.72+.28*Math.sin(T*8.)),t,.15);
 const brush=1-cl(P.bs),mv=cl(P.spd/3);
 AU.rustle.g.gain.setTargetAtTime((.003+.016*wind)*(.30+.70*brush)+.011*brush*mv,t,.25);
 if(AU.beds){
  const near=1-cl(AU.waterDistance/48),target={
   bay:.22*near*(.88+.12*Math.sin(T*.13)),
   park:.20*cl(U.uDay.value)*(.55+.45*wind),
   night:.26*night*(.90+.10*Math.sin(T*.19+2.1))
  };
  for(const k in AU.beds)AU.beds[k].gain.setTargetAtTime(target[k]||0,t,2.2);
 }
 const l=AC.listener,forwardX=-Math.sin(P.yaw),forwardZ=-Math.cos(P.yaw);
 if(l.positionX){l.positionX.value=P.x;l.positionY.value=cam.position.y;l.positionZ.value=P.z;l.forwardX.value=forwardX;l.forwardY.value=0;l.forwardZ.value=forwardZ;l.upX.value=0;l.upY.value=1;l.upZ.value=0}
 else{l.setPosition(P.x,cam.position.y,P.z);l.setOrientation(forwardX,0,forwardZ,0,1,0)}
 AU.shoreT-=dt;
 if(AU.shoreT<=0){AU.shoreT=1.8;AU.waterDistance=80;
  for(const r of [0,8,20,38,60])for(let i=0;i<8;i++){
   const a=i*Math.PI/4,x=P.x+Math.cos(a)*r,z=P.z+Math.sin(a)*r;
   if(H(x,z)<WL+.04&&r<AU.waterDistance){AU.waterDistance=r;AU.waterX=x;AU.waterZ=z;}
  }
 }
 const dx=AU.waterX-P.x,dz=AU.waterZ-P.z,dist=Math.hypot(dx,dz);
 if(AU.water.pan)AU.water.pan.pan.setTargetAtTime(cl((Math.cos(P.yaw)*dx-Math.sin(P.yaw)*dz)/Math.max(1,dist),-1,1),t,.25);
 AU.water.g.gain.setTargetAtTime((1-cl(AU.waterDistance/65))*.024*(.82+.18*Math.sin(T*.8)),t,.4);
 bT-=dt;if(bT<0){bT=4+Math.random()*9;if(U.uDay.value>.65)chirp()}
 frogT-=dt;if(frogT<0){frogT=3+Math.random()*9;if(night>.25&&AU.waterDistance<65)frogCall()}
}
