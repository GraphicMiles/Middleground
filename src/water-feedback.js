/* ---------- splashes: bounded pool, alternating feet, shallow-water scaling ---------- */
const DROP_N=48,dropPool=Array.from({length:DROP_N},()=>({life:0,x:0,y:0,z:0,vx:0,vy:0,vz:0}));
const dropPos=new Float32Array(DROP_N*3),dropLife=new Float32Array(DROP_N);
const dropGeo=new T.BufferGeometry();dropGeo.setAttribute('position',new T.BufferAttribute(dropPos,3).setUsage(T.DynamicDrawUsage));dropGeo.setAttribute('aLife',new T.BufferAttribute(dropLife,1).setUsage(T.DynamicDrawUsage));
const splashes=new T.Points(dropGeo,new T.ShaderMaterial({uniforms:U,transparent:true,depthWrite:false,
 vertexShader:`attribute float aLife;varying float vA;uniform vec4 uWaterFrame;
 void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=aLife>0.?clamp(30.*uWaterFrame.w/max(1.,-mv.z),1.,4.*uWaterFrame.w):0.;vA=aLife;}`,
 fragmentShader:`varying float vA;uniform float uDay;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;
 gl_FragColor=vec4(vec3(.30,.38,.31)*(.25+.75*uDay),vA*(1.-smoothstep(.25,1.,r))*.62);`+DISPLAY+`}`
}));
splashes.frustumCulled=false;splashes.visible=false;splashes.renderOrder=5;scene.add(splashes);
let rippleIndex=0,dropIndex=0,lastFoot=0,lastWet=0,wasGround=true,wasMoving=false,waterEvents=0;
function emitWater(t,strength,side){
 let sx=P.x+Math.cos(P.yaw)*side,sz=P.z-Math.sin(P.yaw)*side,info=WATER.sample(sx,sz);
 if(info.depth<.008){sx=P.x;sz=P.z;info=WATER.sample(sx,sz)}
 if(info.depth<.008)return;
 U.uRipples.value[rippleIndex++%6].set(sx,sz,t,strength);waterEvents++;
 const count=Math.round((qm===1?3:qm===2?7:5)*sm(.025,.28,info.depth)*(.60+.40*strength));
 const surface=WL+WATER.displacement(sx,sz,t,info);
 for(let i=0;i<count;i++){
  const d=dropPool[dropIndex++%DROP_N],a=Math.random()*6.283,r=.035+Math.random()*.10;
  d.x=sx+Math.cos(a)*r;d.z=sz+Math.sin(a)*r;d.y=surface+.028;
  d.vx=Math.cos(a)*(.22+Math.random()*.42)*strength+P.vx*.07;
  d.vz=Math.sin(a)*(.22+Math.random()*.42)*strength+P.vz*.07;
  d.vy=.55+Math.random()*.65+strength*.22;d.life=.34+Math.random()*.14;
 }
}
function waterFX(dt,t){
 const info=WATER.sample(P.x,P.z),wet=info.depth>.025&&P.y<WL+.08,foot=Math.floor(P.bob/Math.PI);
 if(started&&wet){
  const stepping=P.gr&&P.spd>.8&&foot!==lastFoot,entering=!lastWet&&P.spd>.8,starting=P.gr&&P.spd>.8&&!wasMoving,landing=P.gr&&!wasGround;
  if(stepping||entering||starting||landing){const strength=cl(.35+P.spd*.09+(landing?.18:0),.35,1);emitWater(t,strength,stepping?(foot%2?.15:-.15):0)}
 }
 lastFoot=foot;lastWet=wet;wasGround=P.gr;wasMoving=P.gr&&P.spd>.8;let active=0;
 for(let i=0;i<DROP_N;i++){
  const d=dropPool[i];d.life-=dt;
  if(d.life>0){
   d.vy-=9.8*dt;d.x+=d.vx*dt;d.z+=d.vz*dt;d.y+=d.vy*dt;
   if(d.y<WL-.02){d.life=0;dropLife[i]=0;continue}
   dropPos[i*3]=d.x-ox;dropPos[i*3+1]=d.y;dropPos[i*3+2]=d.z-oz;dropLife[i]=cl(d.life/.16);active++;
  }else dropLife[i]=0;
 }
 splashes.visible=active>0;if(active){dropGeo.attributes.position.needsUpdate=true;dropGeo.attributes.aLife.needsUpdate=true}
 updateWaterUniforms();
}
WATER.diagnostics=()=>({version:WATER.version,events:waterEvents,activeRipples:U.uRipples.value.filter(r=>r.w>0&&U.uT.value-r.z<WATER.maxRippleAge).length,activeDrops:dropPool.filter(d=>d.life>0).length});
