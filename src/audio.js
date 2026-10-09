/* ---------- procedural ambience, spatial calls and nearby water ---------- */
let AC=null,AU=null,bT=3,frogT=2;
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
 }catch(e){AC=null}
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
 AU.g.gain.setTargetAtTime(.018+.060*wind*wind,t,.35);AU.f.frequency.setTargetAtTime(300+500*wind,t,.35);
 AU.insects.g.gain.setTargetAtTime((.002+night*.010)*(.72+.28*Math.sin(U.uT.value*8.)),t,.15);
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
 AU.water.g.gain.setTargetAtTime((1-cl(AU.waterDistance/65))*.024*(.82+.18*Math.sin(U.uT.value*.8)),t,.4);
 bT-=dt;if(bT<0){bT=4+Math.random()*9;if(U.uDay.value>.65)chirp()}
 frogT-=dt;if(frogT<0){frogT=3+Math.random()*9;if(night>.25&&AU.waterDistance<65)frogCall()}
}
