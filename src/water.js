/* ---------- water engine v2: one material pass, no reflection render target ---------- */
// A centimetre-scale VISUAL surface. Physics always keeps the original WL and H.
// All coordinates and shore data are world-anchored so chunk rebasing is invisible.
const WATER={
 version:2,level:WL,maxRippleAge:4.6,
 sample(x,z){
  const cx=Math.floor(x/CS),cz=Math.floor(z/CS),c=chunks.get(cx+':'+cz);
  if(!c||!c.eg||!c.waterInfo){const bed=H(x,z),depth=Math.max(0,WL-bed);return {bed,depth,sediment:cl(.30+.52*Mo(x,z,bed)+.18*sm(.1,1.2,depth)),fetch:sm(.025,.9,depth)}}
  const u=(x-cx*CS)/ST,v=(z-cz*CS)/ST,i=Math.min(SEG-1,Math.floor(u)),j=Math.min(SEG-1,Math.floor(v)),fu=u-i,fv=v-j,k=j*N+i;
  // Match the terrain's actual triangle diagonal, not a bilinear height estimate.
  let a,b,d,wa,wb,wd;
  if(fu+fv<=1){a=k;b=k+1;d=k+N;wa=1-fu-fv;wb=fu;wd=fv}
  else{a=k+N+1;b=k+N;d=k+1;wa=fu+fv-1;wb=1-fu;wd=1-fv}
  const bed=c.eg[a]*wa+c.eg[b]*wb+c.eg[d]*wd;
  const sediment=c.waterInfo[a*2]*wa+c.waterInfo[b*2]*wb+c.waterInfo[d*2]*wd;
  const fetch=c.waterInfo[a*2+1]*wa+c.waterInfo[b*2+1]*wb+c.waterInfo[d*2+1]*wd;
  return {bed,depth:Math.max(0,WL-bed),sediment,fetch};
 },
 displacement(x,z,t=U.uT.value,info=null){
  const s=info||WATER.sample(x,z),w=U.uWind.value,len=w.length(),directionLength=Math.hypot(w.x+.0001,w.y+.0001),dx=(w.x+.0001)/directionLength,dz=(w.y+.0001)/directionLength;
  const shelter=sm(.06,.60,s.depth)*(.28+.72*s.fetch),energy=.38+.62*cl(len/.85);
  const a=(x*dx+z*dz)*.84-t*(.65+len*.65),b=(x*(dx*.8-dz*.6)+z*(dz*.8+dx*.6))*.49-t*.72;
  return (Math.sin(a)*.010+Math.sin(b)*.006)*shelter*energy*U.uWaterOptics.value.w;
 }
};
// Packing keeps the water fragment shader within 16 active uniform vectors,
// including six persistent ripples and the renderer's exposure / camera uniforms.
U.uWaterFrame={value:new T.Vector4(0,1,.85,1)}; // time, daylight, optional detail, pixel ratio
U.uWaterFlow={value:new T.Vector4(.58,.25,.0038,0)}; // wind xy, fog density, active ripples
U.uWaterOptics={value:new T.Vector4(1,1,1,1)}; // sediment, extinction, reflection, wave gain
function updateWaterUniforms(){
 U.uWaterFrame.value.set(U.uT.value,U.uDay.value,U.uFX.value,ren.getPixelRatio());
 let active=0;for(const r of U.uRipples.value){const age=U.uT.value-r.z;if(r.w>0&&age>=0&&age<WATER.maxRippleAge)active++}
 U.uWaterFlow.value.set(U.uWind.value.x,U.uWind.value.y,U.uFogD.value,active);
}
const WATER_WAVE_GLSL=`
 uniform vec4 uWaterFrame,uWaterFlow,uWaterOptics;
 float surfaceShelter(float depth,float fetch){return smoothstep(.06,.60,depth)*(.28+.72*fetch);}
 float surfaceEnergy(){return .38+.62*clamp(length(uWaterFlow.xy)/.85,0.,1.);}
 vec2 surfaceDirection(){return normalize(uWaterFlow.xy+vec2(.0001));}
 float waterDisplacement(vec2 p,float depth,float fetch){
  vec2 d=surfaceDirection(),across=vec2(-d.y,d.x);float t=uWaterFrame.x,wind=length(uWaterFlow.xy);
  float a=dot(p,d)*.84-t*(.65+wind*.65),b=dot(p,d*.8+across*.6)*.49-t*.72;
  return (sin(a)*.010+sin(b)*.006)*surfaceShelter(depth,fetch)*surfaceEnergy()*uWaterOptics.w;
 }
`;
const WM=new T.ShaderMaterial({name:'Wetland water v2',uniforms:U,transparent:true,depthWrite:false,extensions:{derivatives:true},
 vertexShader:WATER_WAVE_GLSL+`
 attribute float aD;attribute vec2 aWater;uniform vec2 uOrg;
 varying float vD;varying vec3 vWp;varying vec2 vG,vWater;
 void main(){
  vec4 w=modelMatrix*vec4(position,1.);vec2 p=w.xz+uOrg;
  w.y+=waterDisplacement(p,aD,aWater.y);
  vD=aD;vWater=aWater;vWp=w.xyz;vG=p;
  gl_Position=projectionMatrix*viewMatrix*w;
 }`,
 fragmentShader:GN+WATER_WAVE_GLSL+`
 uniform vec3 uSun,uMoon,uFog,uZen,uSunColor;uniform vec4 uRipples[6];
 varying float vD;varying vec3 vWp;varying vec2 vG,vWater;
 float reflectedCloud(vec2 p){float r=nn(p)*.5;p=p*2.03+7.1;r+=nn(p)*.25;p=p*2.03+7.1;r+=nn(p)*.125;return r;}
 void main(){
  if(vD<=0.)discard;
  float t=uWaterFrame.x,day=uWaterFrame.y,detail=uWaterFrame.z,depth=vD;
  vec2 p=vG,d=surfaceDirection(),across=vec2(-d.y,d.x);
  float wind=length(uWaterFlow.xy),distanceToEye=distance(vWp,cameraPosition);
  float shelter=surfaceShelter(depth,vWater.y),energy=surfaceEnergy();
  float a=dot(p,d)*.84-t*(.65+wind*.65),b=dot(p,d*.8+across*.6)*.49-t*.72;
  vec2 slope=(d*cos(a)*.010*.84+(d*.8+across*.6)*cos(b)*.006*.49)*shelter*energy;
  // Directional capillary waves fade before their wavelength becomes subpixel.
  float footprint=length(fwidth(p)),micro=(1.-smoothstep(.045,.25,footprint))*(1.-smoothstep(22.,100.,distanceToEye));
  float c=dot(p,d)*3.3-t*(1.20+wind),e=dot(p,d*.45+across*.89)*5.1-t*1.63;
  slope+=(d*cos(c)*.013+(d*.45+across*.89)*cos(e)*.006)*shelter*energy*micro;
  float stir=0.,bubbles=0.;
  // Footprints remain where the feet touched, even when the player moves away.
  if(uWaterFlow.w>.5&&distanceToEye<14.)for(int i=0;i<6;i++){
   vec4 rp=uRipples[i];float age=t-rp.z;
   if(age>=0.&&age<4.6&&rp.w>0.){
    vec2 delta=p-rp.xy;float r=length(delta),front=r-age*.95,width=.09+age*.055;
    float packet=exp(-front*front/(width*width))*exp(-age*.82)*rp.w;
    slope+=delta/(r+.001)*cos(front*20.)*packet*.022*smoothstep(0.,.1,depth);
    stir+=(1.-smoothstep(.06,.38+age*.14,r))*exp(-age*.78)*rp.w*(1.-smoothstep(.25,.95,depth));
    bubbles+=packet*(1.-smoothstep(.16,.50,age))*.025;
   }
  }
  slope*=uWaterOptics.w;
  vec3 N=normalize(vec3(-slope.x,1.,-slope.y)),V=normalize(cameraPosition-vWp),Rr=reflect(-V,N);
  float fresnel=.022+.978*pow(1.-max(dot(N,V),0.),5.);
  float sediment=clamp(vWater.x*uWaterOptics.x+stir*.14,0.,1.);
  float extinction=mix(.90,2.65,sediment)*uWaterOptics.y;
  float transmission=exp(-depth*extinction);
  vec3 shallow=mix(vec3(.075,.100,.055),vec3(.105,.086,.042),sediment);
  vec3 deep=mix(vec3(.027,.082,.076),vec3(.055,.072,.046),sediment*.72);
  vec3 body=mix(shallow,deep,smoothstep(.10,1.65,depth));
  body=mix(body,vec3(.12,.095,.051),clamp(stir*.28,0.,.25));
  body*=(.17+.83*day)*mix(vec3(.55,.65,.88),vec3(.35)+uSunColor*.65,day);
  // Analytic sky reflection: no second scene render and no expensive SSR.
  vec3 sky=mix(uFog,uZen,pow(clamp(Rr.y,0.,1.),.43));
  if(detail>.70&&fresnel>.12&&Rr.y>0.){
   vec2 cp=Rr.xz/(Rr.y+.18)*.9+vec2(t*.0028,t*.0010);
   float cv=reflectedCloud(cp*1.4),cloud=smoothstep(.51,.75,cv+.07*nn(cp*5.))*smoothstep(.06,.26,Rr.y);
   vec3 cc=mix(uFog,vec3(.76,.78,.76)*(.05+.95*day),.62)*(.78+.22*smoothstep(.50,.76,cv));
   sky=mix(sky,cc,cloud*.78);
  }
  float reflection=clamp(fresnel*uWaterOptics.z,0.,1.);
  vec3 col=mix(body,sky,reflection);
  // Wider, filtered glints instead of unstable pinpricks of white.
  float exponent=mix(240.,95.,smoothstep(.035,.25,footprint));
  float sunGlint=pow(max(dot(Rr,uSun),0.),exponent)*.95*smoothstep(-.01,.06,uSun.y)*day;
  float moonGlint=pow(max(dot(Rr,uMoon),0.),150.)*.18*(1.-day);
  col+=uSunColor*sunGlint+vec3(.53,.67,.88)*moonGlint;
  // Quiet marsh banks are NOT outlined with ocean surf. Trace foam appears
  // only in a wind-driven, shallow crest; wading can leave a few short bubbles.
  float shoreline=(1.-smoothstep(.035,.20,depth))*smoothstep(.004,.035,depth);
  float crest=smoothstep(.76,.98,sin(c));
  float foam=shoreline*smoothstep(.67,.84,wind)*crest*(.4+.6*vWater.y)*.045;
  col+=vec3(.39,.40,.27)*(foam+bubbles)*(.22+.78*day);
  col+=vec3(.028,.018,.007)*(1.-day)*exp(-distanceToEye*.4);
  float edge=smoothstep(0.,.028+min(.025,fwidth(depth)),depth);
  float alpha=clamp((1.-transmission*(1.-reflection))*edge+foam*.10,.0,.98);
  float fog=1.-exp(-pow(distanceToEye*uWaterFlow.z,2.));
  gl_FragColor=vec4(mix(col,uFog,fog),alpha);
 `+DISPLAY+`}`
});
