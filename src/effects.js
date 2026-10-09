/* ---------- leaf silhouettes on the existing canopy (one extra instanced draw) ---------- */
U.uLeafFar={value:76};
const leafCanvas=document.createElement('canvas');leafCanvas.width=leafCanvas.height=128;
{
 const ctx=leafCanvas.getContext('2d'),r=rngf(4,17,170);
 for(let i=0;i<42;i++){
  const x=8+r()*112,y=8+r()*112,a=r()*6.283,w=3+r()*4,h=7+r()*8;
  ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.beginPath();ctx.moveTo(0,-h);
  ctx.bezierCurveTo(w,-h*.45,w,h*.30,0,h);ctx.bezierCurveTo(-w,h*.30,-w,-h*.45,0,-h);
  const g=ctx.createLinearGradient(-w,0,w,0);g.addColorStop(0,'#bed0aa');g.addColorStop(.48,'#ffffff');g.addColorStop(1,'#a9c28f');ctx.fillStyle=g;ctx.fill();
  ctx.strokeStyle='#dde8cd';ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(0,-h*.8);ctx.lineTo(0,h*.8);ctx.stroke();ctx.restore();
 }
}
const leafTex=new T.CanvasTexture(leafCanvas);leafTex.encoding=T.sRGBEncoding;leafTex.anisotropy=Math.min(4,ren.capabilities.getMaxAnisotropy());
const LEAF_GEO=new T.PlaneGeometry(1,1);
const LEAF_MAT=new T.MeshLambertMaterial({map:leafTex,alphaTest:.5,side:T.DoubleSide});
LEAF_MAT.onBeforeCompile=s=>{
 for(const k of ['uOrg','uWind','uT','uLeafFar'])s.uniforms[k]=U[k];
 s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nuniform vec2 uOrg,uWind;uniform float uT,uLeafFar;'+GN)
 .replace('#include <begin_vertex>',`#include <begin_vertex>
  vec3 leafCenter=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
  transformed*=1.-smoothstep(uLeafFar*.56,uLeafFar,distance(leafCenter,cameraPosition));`)
 .replace('#include <project_vertex>',SWAY);
};
function addCanopyLeaves(pd,x0,z0,made,lo){
 if(lo||!pd.length)return;
 const count=pd.length*8,im=new T.InstancedMesh(LEAF_GEO,LEAF_MAT,count),d=new T.Object3D(),n=new T.Vector3(),zaxis=new T.Vector3(0,0,1),co=new T.Color();
 let k=0;
 for(const a of pd){const rng=rngf(Math.floor(a[0]*64),Math.floor(a[2]*64),171);
  for(let i=0;i<8;i++){
   const angle=rng()*Math.PI*2,y=(rng()-.5)*1.5,r=Math.sqrt(1-y*y),radius=a[3];
   n.set(Math.cos(angle)*r,y,Math.sin(angle)*r);
   d.position.set(a[0]-x0+n.x*radius*.94,a[1]+n.y*radius*.30,a[2]-z0+n.z*radius*.94);
   d.quaternion.setFromUnitVectors(zaxis,n);const s=radius*(.40+rng()*.20);d.scale.set(s,s*.60,1);d.updateMatrix();
   im.setMatrixAt(k,d.matrix);co.setRGB(a[5][0]*.80,a[5][1]*.84,a[5][2]*.84);im.setColorAt(k++,co);
  }
 }
 im.frustumCulled=false;im.userData.sh=false;made.push(im);
}
/* water-feedback */
/* ---------- soft water mist, canopy-anchored light shafts and night fireflies ---------- */
function effectGeometry(cap){
 const g=new T.InstancedBufferGeometry(),b=new T.PlaneGeometry(1,1);
 g.setIndex(b.index);g.setAttribute('position',b.attributes.position);g.setAttribute('uv',b.attributes.uv);
 g.setAttribute('aP',new T.InstancedBufferAttribute(new Float32Array(cap*3),3).setUsage(T.DynamicDrawUsage));
 g.setAttribute('aSize',new T.InstancedBufferAttribute(new Float32Array(cap*4),4).setUsage(T.DynamicDrawUsage));g.instanceCount=0;return g;
}
const mistGeo=effectGeometry(16);
const mist=new T.Mesh(mistGeo,new T.ShaderMaterial({uniforms:U,transparent:true,depthWrite:false,side:T.DoubleSide,
 vertexShader:`attribute vec3 aP;attribute vec4 aSize;uniform vec2 uOrg,uWind;uniform float uT;
 varying vec2 vUV;varying float vA;
 void main(){
  vec3 center=vec3(aP.x-uOrg.x,aP.y,aP.z-uOrg.y);
  center.xz+=uWind*sin(uT*.032+aSize.z)*1.3;
  vec3 right=normalize(vec3(viewMatrix[0][0],0.,viewMatrix[2][0]));
  vec3 w=center+right*position.x*aSize.x+vec3(0.,position.y*aSize.y,0.);
  gl_Position=projectionMatrix*viewMatrix*vec4(w,1.);vUV=uv;
  vA=aSize.w*(1.-smoothstep(45.,105.,distance(center,cameraPosition)));
 }`,
 fragmentShader:`uniform vec3 uFog;uniform float uMist,uFX,uT;varying vec2 vUV;varying float vA;
 void main(){vec2 p=vUV-.5;float envelope=(1.-smoothstep(.1,.5,abs(p.x)))*(1.-smoothstep(.03,.5,abs(p.y)));
 float fold=.83+.17*sin(vUV.x*6.28+uT*.09);
 float a=envelope*fold*vA*uMist*uFX*.065;if(a<.001)discard;
 gl_FragColor=vec4(uFog*1.12,a);`+DISPLAY+`}`
}));mist.frustumCulled=false;mist.renderOrder=4;scene.add(mist);
const rayGeo=effectGeometry(12);
const rays=new T.Mesh(rayGeo,new T.ShaderMaterial({uniforms:U,transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,
 vertexShader:`attribute vec3 aP;attribute vec4 aSize;uniform vec2 uOrg;uniform vec3 uSun;
 varying vec2 vUV;varying vec3 vWp;varying float vA;
 void main(){vec3 start=vec3(aP.x-uOrg.x,aP.y,aP.z-uOrg.y),beam=-uSun;
 vec3 center=start+beam*aSize.x*.5,across=normalize(cross(beam,cameraPosition-center)+vec3(.0001));
 float t=1.-uv.y;vec3 w=start+beam*t*aSize.x+across*position.x*aSize.y*(.42+t*.85);
 gl_Position=projectionMatrix*viewMatrix*vec4(w,1.);vUV=uv;vWp=w;
 vA=(1.-smoothstep(36.,76.,distance(center,cameraPosition)))*aSize.w;}`,
 fragmentShader:`uniform vec3 uSun,uSunColor;uniform float uRays,uFX;varying vec2 vUV;varying vec3 vWp;varying float vA;
 void main(){
 float side=pow(max(0.,1.-abs(vUV.x-.5)*2.),2.2);
 float ends=smoothstep(0.,.18,vUV.y)*(1.-smoothstep(.84,1.,vUV.y));
 float phase=pow(max(dot(normalize(vWp-cameraPosition),uSun),0.),3.);
 float a=side*ends*vA*uRays*uFX*phase*.060;if(a<.001)discard;
 gl_FragColor=vec4(uSunColor*.56,a);`+DISPLAY+`}`
}));rays.frustumCulled=false;rays.renderOrder=4.5;scene.add(rays);
const flyPos=new Float32Array(36*3),flyPhase=new Float32Array(36);
for(let i=0;i<36;i++)flyPhase[i]=h(i,17,180)*6.283;
const flyGeo=new T.BufferGeometry();flyGeo.setAttribute('position',new T.BufferAttribute(flyPos,3).setUsage(T.DynamicDrawUsage));flyGeo.setAttribute('aPhase',new T.BufferAttribute(flyPhase,1));flyGeo.setDrawRange(0,0);
const fireflies=new T.Points(flyGeo,new T.ShaderMaterial({uniforms:U,transparent:true,depthWrite:false,blending:T.AdditiveBlending,
 vertexShader:`attribute float aPhase;uniform float uT,uNight;uniform vec2 uOrg;varying float vA;
 void main(){vec3 w=position;w.xz-=uOrg;w.x+=sin(uT*.55+aPhase)*.42;w.y+=sin(uT*.72+aPhase)*.24;
 vec4 mv=viewMatrix*vec4(w,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(26./max(1.,-mv.z),1.,3.5);
 vA=pow(max(0.,sin(uT*1.15+aPhase)),6.)*uNight*(1.-smoothstep(18.,48.,distance(w,cameraPosition)));}`,
 fragmentShader:`varying float vA;void main(){float r=length(gl_PointCoord-.5)*2.;float a=(1.-smoothstep(.1,1.,r))*vA*.36;
 gl_FragColor=vec4(vec3(.57,.83,.17),a);`+DISPLAY+`}`
}));fireflies.frustumCulled=false;fireflies.renderOrder=3;scene.add(fireflies);
let atmosphereT=0,atmosphereCell='';
function atmosphere(dt){
 mist.visible=qm!==1&&U.uFX.value>.32&&U.uMist.value>.01;
 rays.visible=qm!==1&&U.uFX.value>.55&&U.uRays.value>.01;
 fireflies.visible=U.uNight.value>.05;
 atmosphereT-=dt;
 const cell=Math.floor(P.x/40)+':'+Math.floor(P.z/40);
 if(atmosphereT>0&&cell===atmosphereCell)return;atmosphereT=1.1;atmosphereCell=cell;
 const bx=Math.floor(P.x/40),bz=Math.floor(P.z/40);let mc=0,fc=0;
 for(let z=-2;z<=2;z++)for(let x=-2;x<=2;x++){
  const rng=rngf(bx+x,bz+z,181),wx=(bx+x+.18+rng()*.64)*40,wz=(bz+z+.18+rng()*.64)*40,e=H(wx,wz);
  const distance=Math.hypot(wx-P.x,wz-P.z);
  if(e<WL+.06&&distance<92&&mc<16){
   mistGeo.attributes.aP.setXYZ(mc,wx,WL+.62,wz);
   mistGeo.attributes.aSize.setXYZW(mc,15+rng()*12,1.2+rng()*.6,rng()*6.28,.65+rng()*.35);mc++;
  }
  if(e>WL-.9&&e<WL+.6&&distance<42){
   for(let k=0;k<3&&fc<36;k++)flyGeo.attributes.position.setXYZ(fc++,wx+(rng()-.5)*9,Math.max(e,WL)+.55+rng()*1.2,wz+(rng()-.5)*9);
  }
 }
 mistGeo.instanceCount=mc;mistGeo.attributes.aP.needsUpdate=mistGeo.attributes.aSize.needsUpdate=true;
 flyGeo.setDrawRange(0,fc);flyGeo.attributes.position.needsUpdate=true;
 let rc=0;const limit=qm===2?12:7;
 if(sdir.y>.025&&sdir.y<.58){
  const candidates=[];
  for(const c of chunks.values())for(const a of c.crowns||[]){const d=Math.hypot(a[0]-P.x,a[2]-P.z);if(d<67)candidates.push({a,d})}
  candidates.sort((a,b)=>a.d-b.d);
  for(const {a} of candidates){
   if(rc>=limit)break;
   const x=a[0]+a[3]*.57,z=a[2]-a[3]*.22,y=a[1]+a[3]*.08;
   const len=Math.min(38,Math.max(5,(y-H(x,z)+.5)/Math.max(.09,sdir.y)));
   rayGeo.attributes.aP.setXYZ(rc,x,y,z);rayGeo.attributes.aSize.setXYZW(rc,len,.45+a[3]*.35,0,.80);rc++;
  }
 }
 rayGeo.instanceCount=rc;rayGeo.attributes.aP.needsUpdate=rayGeo.attributes.aSize.needsUpdate=true;
}
