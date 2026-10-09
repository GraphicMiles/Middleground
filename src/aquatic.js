/* ---------- water plants: independent seed stream; never alter terrain or props ---------- */
function mergePlant(parts){
 const p=[],n=[],c=[],idx=[];
 for(const [g,color] of parts){const at=g.attributes,off=p.length/3;
  for(let i=0;i<at.position.count;i++){p.push(at.position.getX(i),at.position.getY(i),at.position.getZ(i));n.push(at.normal.getX(i),at.normal.getY(i),at.normal.getZ(i));c.push(...color)}
  if(g.index)for(const i of g.index.array)idx.push(i+off);else for(let i=0;i<at.position.count;i++)idx.push(i+off);g.dispose();
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('normal',new T.Float32BufferAttribute(n,3));g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.setIndex(idx);return g;
}
function ribbon(height,width,lean,angle,x=0,z=0){
 const p=[],idx=[],ca=Math.cos(angle),sa=Math.sin(angle);
 for(let i=0;i<=5;i++){const t=i/5,bend=lean*t*t,w=width*(.25+.75*Math.sin(Math.PI*t))*(1-t*.9);
  for(const s of [-1,1])p.push(x+ca*bend-sa*w*s,height*t-.08*t*t,z+sa*bend+ca*w*s);
  if(i<5){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2)}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
function aquaticGeometry(kind){
 const parts=[],leaf=[.105,.195,.040],stem=[.115,.195,.052],brown=[.22,.12,.053];
 const cylinder=(r,h,x,y,z,color)=>parts.push([new T.CylinderGeometry(r*.68,r,h,5,1).translate(x,y+h*.5,z),color]);
 for(let k=0;k<3;k++){
  const a=k*2.1,x=Math.cos(a)*.12,z=Math.sin(a)*.12,ht=(kind===1?2.05:1.65)+k*.12;
  cylinder(.014,ht,x,0,z,stem);
  parts.push([ribbon(ht*.78,.035,.32,a+.65,x,z),leaf]);
  parts.push([ribbon(ht*.70,.030,.36,a-1.0,x,z),leaf]);
  if(kind===1){
   // Papyrus has an airy umbrella of drooping rays, not a solid green cone.
   for(let j=0;j<9;j++){
    const an=j*Math.PI*2/9,rr=.27+.04*(j%3);
    const g=ribbon(.11,.010,rr,an).translate(x,ht-.07,z);parts.push([g,[.18,.25,.07]]);
    cylinder(.019,.045,x+Math.cos(an)*rr,ht-.04,z+Math.sin(an)*rr,[.20,.235,.085]);
   }
  }else if(kind===2){cylinder(.042,.28,x,ht-.28,z,brown);cylinder(.006,.17,x,ht,z,[.25,.20,.10]);}
  else parts.push([ribbon(ht,.020,.20,a+1.3,x,z),leaf]);
 }
 return mergePlant(parts);
}
const AQ_GEOMETRIES=[aquaticGeometry(0),aquaticGeometry(1),aquaticGeometry(2)];
const padShape=new T.Shape();padShape.moveTo(.12,0);
for(let i=0;i<=28;i++){const a=.24+(Math.PI*2-.48)*i/28;padShape.lineTo(Math.cos(a),Math.sin(a));}
padShape.lineTo(.12,0);
const PAD_GEO=new T.ShapeGeometry(padShape).rotateX(-Math.PI*.5);PAD_GEO.computeVertexNormals();
const AM=new T.ShaderMaterial({uniforms:U,side:T.DoubleSide,
 vertexShader:GN+`
 attribute vec3 aP;attribute vec4 aR;attribute vec3 color;
 uniform vec2 uOrg,uWind;uniform float uT,uFar,uDay,uNight,uFogD;uniform vec3 uPl,uKey,uSunColor;
 varying vec3 vC;varying float vF;
 void main(){
  vec3 base=(modelMatrix*vec4(aP,1.)).xyz;vec2 global=base.xz+uOrg;
  float d=distance(base,cameraPosition),fade=1.-smoothstep(uFar*.53,uFar*.91,d);
  float c=cos(aR.y),s=sin(aR.y);vec3 l=position*aR.x*fade;
  l.xz=mat2(c,-s,s,c)*l.xz;
  float flex=pow(clamp(position.y/2.3,0.,1.),2.);
  float gust=.35+.65*nn(global*.045+uWind*uT*.40);
  l.xz+=uWind*flex*(.14*sin(uT*1.15+aR.z)+.23*gust);
  vec2 delta=base.xz-uPl.xz;float push=1.-smoothstep(.25,1.75,length(delta));
  l.xz+=normalize(delta+vec2(.0001))*push*flex*.72;l.y-=push*flex*.26;
  vec3 w=base+l;gl_Position=projectionMatrix*viewMatrix*vec4(w,1.);
  vec3 n=normal;n.xz=mat2(c,-s,s,c)*n.xz;
  float light=.23+.66*uDay+max(dot(n,uKey),0.)*(.11+.16*uDay);
  float back=pow(max(dot(normalize(w-cameraPosition),uKey),0.),4.)*.10*uDay*flex;
  vC=(color*light+vec3(.06,.08,.015)*back)*mix(vec3(.50,.62,.92),vec3(.30)+uSunColor*.70,uDay);
  vC+=vec3(.065,.041,.018)*pow(1.-clamp(distance(base,uPl)/9.,0.,1.),2.)*uNight;
  vF=1.-exp(-pow(d*uFogD,2.));
 }`,
 fragmentShader:`uniform vec3 uFog;varying vec3 vC;varying float vF;
 void main(){gl_FragColor=vec4(mix(vC,uFog,vF),1.);`+DISPLAY+`}`
});
const PM=new T.ShaderMaterial({uniforms:U,side:T.DoubleSide,
 vertexShader:WATER_WAVE_GLSL+`attribute vec3 aP;attribute vec4 aR;attribute vec2 aWaterMeta;
 uniform float uT,uFar,uFogD,uDay,uNight;uniform vec3 uPl;uniform vec2 uOrg;
 varying vec2 vL;varying float vF,vLight;
 void main(){
  vec3 base=(modelMatrix*vec4(aP,1.)).xyz;float d=distance(base,cameraPosition);
  float fade=1.-smoothstep(uFar*.53,uFar*.91,d),c=cos(aR.y),s=sin(aR.y);
  vec3 l=position*aR.x*fade;l.xz=mat2(c,-s,s,c)*l.xz;
  vec2 delta=base.xz-uPl.xz;float push=1.-smoothstep(.1,1.1,length(delta));
  l.xz+=normalize(delta+vec2(.0001))*push*.15;l.y+=waterDisplacement(base.xz+uOrg,aWaterMeta.x,aWaterMeta.y)+sin(uT*.9+aR.z)*.002;
  gl_Position=projectionMatrix*viewMatrix*vec4(base+l,1.);
  vL=position.xz;vLight=.23+.77*uDay;
  vLight+=pow(1.-clamp(distance(base,uPl)/9.,0.,1.),2.)*uNight*.2;
  vF=1.-exp(-pow(d*uFogD,2.));
 }`,
 fragmentShader:`uniform vec3 uFog;varying vec2 vL;varying float vF,vLight;
 void main(){
  float radius=length(vL),angle=atan(vL.y,vL.x);
  float vein=pow(abs(cos(angle*9.+radius*.4)),32.)*.022;
  vec3 c=mix(vec3(.047,.10,.025),vec3(.145,.205,.055),smoothstep(.04,.92,radius));
  c+=vec3(.02,.03,.007)*radius+vein;c*=vLight;
  gl_FragColor=vec4(mix(c,uFog,vF),1.);
 `+DISPLAY+`}`
});
const aquaticTier=c=>c.d<=1?2:(c.d===2&&qm!==1?1:0);
function* genAquatic(c){
 const tier=c.aqt=aquaticTier(c);c.aqq=qm;
 const drop=()=>{for(const m of c.aqm||[]){disp(m);const i=c.meshes.indexOf(m);if(i>=0)c.meshes.splice(i,1)}c.aqm=[]};
 if(!tier){drop();return}
 const x0=c.cx*CS,z0=c.cz*CS,rng=rngf(c.cx,c.cz,141),lists=[[],[],[],[]];
 const caps=qm===1?[18,10,8,22]:qm===2?[48,24,20,64]:[34,18,14,46];
 if(tier===1)for(let i=0;i<caps.length;i++)caps[i]=Math.ceil(caps[i]*.5);
 for(let j=0;j<12;j++){
  for(let i=0;i<12;i++){
   const lx=(i+rng())*CS/12,lz=(j+rng())*CS/12,e=samp(c.eg,lx,lz),s=e-WL,x=x0+lx,z=z0+lz;
   const choice=rng(),phase=rng()*Math.PI*2;
   if(s>-.40&&s<.20&&Mo(x,z,e)>.42){
    const kind=choice<.40?0:choice<.77?1:2;
    const rr=rngf(Math.floor(x*64),Math.floor(z*64),152);
    for(let k=0;k<3;k++){
     const a=rr()*6.283,r=.20+rr()*.42,bx=lx+Math.cos(a)*r,bz=lz+Math.sin(a)*r;
     const y=H(x0+bx,z0+bz),scale=.72+rr()*.43,yaw=rr()*6.283;
     if(lists[kind].length<caps[kind]&&y>WL-.45&&y<WL+.25)lists[kind].push([bx,y-.035,bz,scale,yaw,phase]);
    }
   }else if(s<-.16&&s>-1.15&&vn(x/18,z/18,154)>.47){
    const rr=rngf(Math.floor(x*64),Math.floor(z*64),155);
    for(let k=0;k<4;k++){
     const a=rr()*6.283,r=rr()*1.35,bx=lx+Math.cos(a)*r,bz=lz+Math.sin(a)*r,scale=.20+rr()*.29,yaw=rr()*6.283;
     if(lists[3].length<caps[3]&&H(x0+bx,z0+bz)<WL-.1)lists[3].push([bx,WL+.021,bz,scale,yaw,phase+k]);
    }
   }
  }
  if(j%2)yield;
 }
 const made=[];
 for(let k=0;k<4;k++){
  const list=lists[k];if(!list.length)continue;
  const base=k===3?PAD_GEO:AQ_GEOMETRIES[k],g=new T.InstancedBufferGeometry();
  // Own GPU attributes: unloading a chunk cannot invalidate a neighbour's buffers.
  g.setIndex(base.index.clone());g.setAttribute('position',base.attributes.position.clone());g.setAttribute('normal',base.attributes.normal.clone());
  if(k!==3)g.setAttribute('color',base.attributes.color.clone());
  const p=new Float32Array(list.length*3),a=new Float32Array(list.length*4);
  list.forEach((v,i)=>{p.set(v.slice(0,3),i*3);a.set([v[3],v[4],v[5],0],i*4)});
  g.setAttribute('aP',new T.InstancedBufferAttribute(p,3));g.setAttribute('aR',new T.InstancedBufferAttribute(a,4));g.instanceCount=list.length;
  if(k===3){const meta=new Float32Array(list.length*2);list.forEach((v,i)=>{const s=WATER.sample(x0+v[0],z0+v[2]);meta.set([s.depth,s.fetch],i*2)});g.setAttribute('aWaterMeta',new T.InstancedBufferAttribute(meta,2));}
  g.boundingSphere=new T.Sphere(new T.Vector3(CS/2,1,CS/2),CS*.76);
  const m=new T.Mesh(g,k===3?PM:AM);m.userData.aquatic=true;m.castShadow=false;if(k===3)m.renderOrder=2.1;
  made.push(m);yield;
 }
 drop();c.aqm=made;
 for(const m of made){c.meshes.push(m);world.add(m)}place(c);
}
