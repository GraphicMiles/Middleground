/* ---------- the same lechwe herds, now with articulated legs ---------- */
const animals=(()=>{
 const Pp=[],Nn=[],Cc=[],Ii=[];
 const addShape=(g,c)=>{
  const p=g.attributes.position,n=g.attributes.normal,ix=g.index.array,o=Pp.length/3;
  for(let i=0;i<p.count;i++){Pp.push(p.getX(i),p.getY(i),p.getZ(i));Nn.push(n.getX(i),n.getY(i),n.getZ(i));Cc.push(c[0],c[1],c[2])}
  for(let i=0;i<ix.length;i++)Ii.push(ix[i]+o);g.dispose();
 };
 const ellipsoid=(w,h,d,x,y,z,c)=>addShape(new T.SphereGeometry(1,10,6).scale(w*.5,h*.5,d*.5).translate(x,y,z),c);
 const box=(w,h,d,x,y,z,rx,c)=>{const g=new T.BoxGeometry(w,h,d);if(rx)g.rotateX(rx);g.translate(x,y,z);addShape(g,c)};
 const bd=[.50,.33,.17],lg=[.26,.18,.11],hd=[.44,.30,.16],hn=[.13,.11,.09];
 ellipsoid(.44,.54,1.10,0,.98,0,bd);
 addShape(new T.CylinderGeometry(.08,.10,.57,7).rotateX(.65).translate(0,1.3,.68),hd);
 ellipsoid(.17,.20,.35,0,1.52,1.0,hd);
 for(const s of [-1,1]){
  addShape(new T.CylinderGeometry(.006,.017,.43,5).rotateX(-.35).translate(s*.053,1.78,.92),hn);
  ellipsoid(.16,.055,.10,s*.115,1.60,.94,hd);
  ellipsoid(.020,.025,.023,s*.080,1.56,1.065,[.009,.007,.005]);
 }
 box(.045,.045,.28,0,1.06,-.64,.15,bd);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(Pp,3));g.setAttribute('normal',new T.Float32BufferAttribute(Nn,3));g.setAttribute('color',new T.Float32BufferAttribute(Cc,3));g.setIndex(Ii);
 const NH=3,PER=3,gait=new Float32Array(NH*PER*2);
 const mat=new T.MeshLambertMaterial({vertexColors:true});
 const im=new T.InstancedMesh(g,mat,NH*PER);im.frustumCulled=false;im.castShadow=true;scene.add(im);
 // 36 cheap articulated limbs in ONE additional draw. This works even on
 // WebGL1 hardware with only eight vertex attributes; shadows follow the legs.
 const legGeo=mergePlant([[new T.CylinderGeometry(.030,.022,.76,5).translate(0,-.38,0),lg],[new T.BoxGeometry(.065,.055,.085).translate(0,-.758,.012),[.075,.057,.038]]]);
 const limbs=new T.InstancedMesh(legGeo,mat,NH*PER*4);limbs.frustumCulled=false;limbs.castShadow=true;scene.add(limbs);
 const legD=new T.Object3D(),legM=new T.Matrix4();
 function updateAnimalLegs(index,parent,phase,speed){
  let leg=0;
  for(const sz of [1,-1])for(const sx of [-1,1]){
   const paired=(sz===1&&sx===1)||(sz===-1&&sx===-1);
   legD.position.set(sx*.14,.80,sz*.4);legD.rotation.set(Math.sin(phase+(paired?Math.PI:0))*cl(speed*.33,0,.7),0,0);
   legD.updateMatrix();legM.multiplyMatrices(parent,legD.matrix);limbs.setMatrixAt(index*4+leg++,legM);
  }
 }
