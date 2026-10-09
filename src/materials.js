const SWAY=`vec4 wq=modelMatrix*instanceMatrix*vec4(transformed,1.);
 vec2 gw=wq.xz+uOrg;float hs=smoothstep(1.2,8.,wq.y);
 float gs=nn(gw*.035+vec2(uT*.30,uT*.13)),ts=nn(gw*.5+vec2(uT*.75,-uT*.45));
 vec2 sd=uWind*(gs*.75+ts*.30-.12)*.32*hs;
 wq.xz+=sd;wq.y-=length(sd)*.12;
 vec4 mvPosition=viewMatrix*wq;gl_Position=projectionMatrix*mvPosition;`;
const mkMT=(sw,leaf=false)=>{
 const m=new T.MeshLambertMaterial({color:0xffffff});
 m.customProgramCacheKey=()=>leaf?'canopy-v2':sw?'wood-sway-v2':'props-v2';
 m.onBeforeCompile=s=>{
  s.uniforms.uOrg=U.uOrg;s.uniforms.uT=U.uT;s.uniforms.uWind=U.uWind;
  let vs=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vP;uniform vec2 uOrg;'+(sw?'uniform float uT;uniform vec2 uWind;'+GN:''))
  .replace('#include <begin_vertex>','#include <begin_vertex>\nvP=(modelMatrix*instanceMatrix*vec4(transformed,1.)).xyz;vP.xz+=uOrg;');
  if(sw)vs=vs.replace('#include <project_vertex>',SWAY);s.vertexShader=vs;
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vP;uniform float uT;'+GN+CLD)
  .replace('#include <color_fragment>','#include <color_fragment>\n'+(leaf?
   'float leafDetail=nn(vP.xz*3.6+vP.y*4.2);diffuseColor.rgb*=.79+.30*leafDetail;diffuseColor.rgb+=vec3(.012,.022,.002)*nn(vP.xz*8.+vP.y*5.);':
   'float bark=nn(vec2((vP.x+vP.z)*14.,vP.y*.9));diffuseColor.rgb*=(.80+.28*nn(vP.xz*2.1+vP.y*1.2))*(.90+.16*bark);')+'\ndiffuseColor.rgb*=cld(vP.xz,uT);');
 };
 return m;
};
const MT=mkMT(false),MTS=mkMT(true),LM=mkMT(true,true);
// Matching wind in the shadow pass prevents detached tree shadows.
const treeDepth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});
treeDepth.onBeforeCompile=s=>{
 s.uniforms.uOrg=U.uOrg;s.uniforms.uT=U.uT;s.uniforms.uWind=U.uWind;
 s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nuniform vec2 uOrg,uWind;uniform float uT;'+GN)
 .replace('#include <project_vertex>',SWAY);
};
/* ---------- instanced grass: existing density, improved daylight / wind ---------- */
const GM=new T.ShaderMaterial({uniforms:U,side:T.DoubleSide,
 vertexShader:GN+CLD+`
 attribute vec3 aP;attribute vec4 aR;
 uniform float uT,uFar,uFogD,uDay,uNight;uniform vec2 uOrg,uWind;uniform vec3 uKey,uPl,uSunColor;
 varying vec3 vC;varying float vF;
 void main(){
  vec3 wp=(modelMatrix*vec4(aP,1.)).xyz;vec2 g=wp.xz+uOrg;
  float d=distance(wp,cameraPosition),fade=1.-smoothstep(uFar*.6,uFar,d);
  float t=position.y,ph=hh(aP.xz),stf=.6+.8*hh(aP.zx+3.);
  float hg=aR.x*fade,wd=aR.y*(1.+d*.020),c=cos(aR.z),s=sin(aR.z);
  vec3 l=vec3(position.x*wd*c-position.z*hg*s,t*hg,position.x*wd*s+position.z*hg*c);
  float gust=nn(g*.035+vec2(uT*.30,uT*.13)),tur=nn(g*.4+vec2(uT*.85,-uT*.5));
  float amp=(gust*.9+tur*.35-.16+.1*sin(uT*2.2+ph*6.28))/stf;
  float bend=amp*t*t*hg*.53;
  l.xz+=uWind*bend+vec2(c,-s)*t*t*hg*.12*(ph-.5)*2.;l.y-=abs(bend)*.25*t;
  vec2 pd=wp.xz-uPl.xz;float pw=1.-smoothstep(.2,1.9,length(pd));
  l.xz+=normalize(pd+vec2(.0001))*pw*t*hg*.55;l.y-=pw*t*t*hg*.3;
  vec3 w=wp+l;gl_Position=projectionMatrix*viewMatrix*vec4(w,1.);
  vec3 bc=mix(vec3(.070,.115,.045),vec3(.21,.17,.10),aR.w);
  vec3 tc=mix(vec3(.30,.38,.17),vec3(.61,.50,.31),aR.w);
  if(aR.x>1.3){bc=vec3(.065,.11,.042);tc=vec3(.28,.36,.15);}
  float sd=pow(max(dot(normalize(w-cameraPosition),uKey),0.),4.);
  vC=(mix(bc,tc,t)*(.88+.24*ph)*(.5+.6*t)+tc*sd*.13*t)*cld(g,uT)*(.90+.18*nn(g*.045+5.))*(.20+.80*uDay);
  vC*=mix(vec3(.50,.62,.92),vec3(.30)+uSunColor*.70,uDay);
  float lamp=pow(1.-clamp(distance(wp,uPl)/9.,0.,1.),2.)*uNight;
  vC+=vec3(.085,.058,.029)*lamp;
  vF=1.-exp(-pow(d*uFogD,2.));
 }`,
 fragmentShader:`uniform vec3 uFog;varying vec3 vC;varying float vF;
 void main(){gl_FragColor=vec4(mix(vC,uFog,vF),1.);`+DISPLAY+`}`
});
// Blades are curved, not straight: z carries the forward sweep of a circular
// arc and the shader folds it into the blade's own azimuth. Same vertex and
// triangle budget as the old flat strip.
const BL=new T.BufferGeometry();BL.setAttribute('position',new T.BufferAttribute(new Float32Array([-.5,0,0,.5,0,0,-.42,.390,.0584,.42,.390,.0584,-.24,.764,.2417,.24,.764,.2417,0,1,.4526]),3));BL.setIndex([0,1,2,1,3,2,2,3,4,3,5,4,4,5,6]);
const BL2=new T.BufferGeometry();BL2.setAttribute('position',new T.BufferAttribute(new Float32Array([-.5,0,0,.5,0,0,-.3,.5477,.1183,.3,.5477,.1183,0,1,.4526]),3));BL2.setIndex([0,1,2,1,3,2,2,3,4]);
