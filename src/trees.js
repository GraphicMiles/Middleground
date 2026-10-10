/* ---------- tree skeleton: curved, tapered branch tubes ----------
   Technique reverse-engineered from dgreenheck/ez-tree (MIT) and re-implemented
   with our own seeds and streams; no dependency on that library.

   What we take from it:
   - a branch is a chain of sections; radius tapers along the chain so a child
     that starts at the parent's local radius is the same thickness (no bulge);
   - per-section curvature, stronger on thin twigs (gnarliness ~ 1/sqrt(r));
   - children are distributed radially around the parent axis (phyllotaxis),
     stratified so they spread in 3D instead of fanning in one plane;
   - the skeleton is built from a seeded stream; meshing is a separate, cheap pass.

   We do NOT copy its code; this is our own, sized for our instanced/chunked
   renderer and our unified wind. */

/* Append a tube (ring per section) for one branch into the chunk buffers. */
function tubeInto(env,secs,cc){
 const SEG=6;
 const base=env.bv.length/3;
 for(let s=0;s<secs.length;s++){
  const sc=secs[s],p=[sc[0],sc[1],sc[2]],r=sc[3],d=[sc[4],sc[5],sc[6]];
  // stable perpendicular frame
  let up=Math.abs(d[1])>.92?[1,0,0]:[0,1,0];
  let sx=up[1]*d[2]-up[2]*d[1],sy=up[2]*d[0]-up[0]*d[2],sz=up[0]*d[1]-up[1]*d[0];
  let sl=Math.hypot(sx,sy,sz)||1;sx/=sl;sy/=sl;sz/=sl;
  const ux=d[1]*sz-d[2]*sy,uy=d[2]*sx-d[0]*sz,uz=d[0]*sy-d[1]*sx;
  for(let k=0;k<SEG;k++){
   const t=k/SEG*6.283,c=Math.cos(t),si=Math.sin(t);
   const nx=c*sx+si*ux,ny=c*sy+si*uy,nz=c*sz+si*uz;
   env.bv.push(p[0]-env.x0+nx*r,p[1]+ny*r,p[2]-env.z0+nz*r);
   env.bn.push(nx,ny,nz);
   env.bc.push(cc[0],cc[1],cc[2]);
  }
 }
 for(let s=0;s<secs.length-1;s++)for(let k=0;k<SEG;k++){
  const a=base+s*SEG+k,b=base+s*SEG+(k+1)%SEG,c=base+(s+1)*SEG+(k+1)%SEG,d2=base+(s+1)*SEG+k;
  env.bi.push(a,b,c,a,c,d2);
 }
}

/* Grow one curved, tapering branch chain; returns its sections and end frame. */
function growChain(tr,env,p,dir,r0,len,segs,taper,gnarl,uplift,cc,tips,tipR){
 const secs=[];let d=dir.slice(),pos=p.slice(),r=r0;
 const nrm=v=>{const l=Math.hypot(v[0],v[1],v[2])||1;return[v[0]/l,v[1]/l,v[2]/l]};
 for(let i=0;i<=segs;i++){
  secs.push([pos[0],pos[1],pos[2],r,d[0],d[1],d[2]]);
  pos=[pos[0]+d[0]*len/segs,pos[1]+d[1]*len/segs,pos[2]+d[2]*len/segs];
  r*=taper;
  const g=gnarl*Math.min(1.5,Math.sqrt(r0/Math.max(r,.02)));
  d=nrm([d[0]+(tr()-.5)*g,d[1]+(tr()-.5)*g*.5+uplift,d[2]+(tr()-.5)*g]);
 }
 tubeInto(env,secs,cc);
 if(tips)tips.push([secs[segs][0],secs[segs][1],secs[segs][2],tipR,tr()*6.28]);
 return {end:secs[segs],dir:d};
}

/* Build the whole skeleton for a generic / dead savannah tree into env buffers.
   `tr` is the tree's own seeded stream; the first draws (R..) must stay in the
   same order as before so collisions/collections are unchanged. */
function savannahTree(tr,env,x,e,z,u,lo,dead){
 const R=.14+.14*tr();
 // 6c: species from a position hash (no tr draw) so collisions/seeds stay fixed.
 // 0 camel-thorn (rounded dome), 1 umbrella-thorn (flat table-top), 2 mopane (dense, low).
 const sv=vn(x*.131+9.7,z*.171-3.1,777);
 const sp=dead?0:(sv<.45?0:sv<.80?1:2);
 const SP=[[1.0,1.0,1.0,0,.07],[1.30,.85,1.15,0,.01],[.72,1.15,.80,2,.10]][sp];
 const h1=(1.4+tr()*1.2)*SP[2],t1=.1+tr()*.22,h2=(1.2+tr()*1.4)*SP[2],t2=-t1*(.5+tr());
 const cc=dead?[.07,.055,.05]:[.20,.15,.11];
 const LC=[[.30,.38,.10],[.16,.26,.07],[.28,.32,.15]][sp];
 const lf=dead?0:[LC[0]*(.85+.30*u),LC[1]*(.85+.30*u),LC[2]*(.85+.30*u)];
 const spread=(.78+.44*u)*SP[0],lift=(.78+.40*u)*SP[1],leanA=tr()*6.28;
 const pr=(1.5+tr()*1.1)*(.84+.32*u)*(sp===2?.8:1);
 const a=tr()*6.28,nrm=v=>{const l=Math.hypot(v[0],v[1],v[2])||1;return[v[0]/l,v[1]/l,v[2]/l]};
 const tips=[];
 const lean=t1*(0.7+0.8*vn(x*.7,z*.7,778));          // per-tree lean/asymmetry
 const d0=nrm([Math.sin(lean)*Math.sin(a),1,Math.sin(lean)*Math.cos(a)]);
 const t=growChain(tr,env,[x,e-.1,z],d0,R,h1,lo?1:2,.62,.05,.02,cc,null,0);
 const d1=nrm([Math.sin(t2)*Math.sin(a),1,Math.sin(t2)*Math.cos(a)]);
 const q=growChain(tr,env,t.end.slice(0,3),d1,t.end[3],h2,lo?1:2,.62,.06,.02,cc,null,0);
 const n=3+(tr()*2|0)+(u>.72?1:0)+SP[3];
 for(let i=0;i<n;i++){
  const ang=a+i*(6.28/n)+tr()*.6,lops=1+.22*Math.cos(ang+leanA);
  const side=[Math.cos(ang),0,Math.sin(ang)];
  const pitch=dead?.9:.75+.35*spread;
  let nd=nrm([q.dir[0]*.4+side[0]*pitch,q.dir[1]*.4+(dead?.25:lift*.5),q.dir[2]*.4+side[2]*pitch]);
  const L=dead?1.5+tr()*1.4:(1.75+tr()*1.7)*spread*lops;
  const limb=growChain(tr,env,q.end.slice(0,3),nd,q.end[3]*.7,L,lo?1:2,.62,.10,dead?-.02:.03+SP[4],cc,lo?tips:null,pr);
  if(!lo&&!dead)for(let w=0;w<2;w++){
   const wa=ang+(w?1:-1)*.7;const ws=[Math.cos(wa),0,Math.sin(wa)];
   let wd=nrm([limb.dir[0]+ws[0]*.5,limb.dir[1]+.25+SP[4],limb.dir[2]+ws[2]*.5]);
   growChain(tr,env,limb.end.slice(0,3),wd,limb.end[3]*.7,L*.5,1,.6,.12,.05+SP[4],cc,tips,pr*.8);
  }
 }
 if(lf&&!lo)tips.push([q.end[0],q.end[1]+.18,q.end[2],pr*.72,tr()*6.28]);
 return {tips,lf,pr,R};
}

/* Branch tube material: vertex-coloured so each tree keeps its own tint,
   double-sided, and its own program cache key (it differs from MTS by
   vertexColors, so it must not share MTS's cached program). */
const MT_BRANCH=mkMT(true);
MT_BRANCH.vertexColors=true;
MT_BRANCH.side=T.DoubleSide;
MT_BRANCH.customProgramCacheKey=()=>'wood-branch-vc-v1';

/* ---- 6b: foliage as small crossed leaf cards clustered at twig tips ----
   Replaces the solid ellipsoid puffs (the main blob) with many small cards so
   the crown has gaps and a frayed silhouette. Technique as ez-tree (leaf cards
   on outer skeleton, stratified), own code. */
function addLeaf(tr,env,x,y,z,size,col){
 for(let q=0;q<2;q++){
  const yaw=tr()*6.283,pit=(tr()-.5)*1.4+q*1.5708;
  const ca=Math.cos(yaw),sa=Math.sin(yaw),cp=Math.cos(pit),sp=Math.sin(pit);
  const base=env.lv.length/3,cs=[[-.5,0,0],[.5,0,0],[.5,1,0],[-.5,1,0]];
  for(const c of cs){
   const X=c[0]*size,Y=c[1]*size;
   const Y2=Y*cp,Z2=Y*sp;
   const X3=X*ca+Z2*sa,Z3=-X*sa+Z2*ca;
   env.lv.push(x-env.x0+X3,y+Y2,z-env.z0+Z3);env.ln.push(0,1,0);
   const sh=.8+tr()*.4;env.lc.push(col[0]*sh,col[1]*sh,col[2]*sh);
  }
  env.li.push(base,base+1,base+2,base,base+2,base+3);
 }
}
function leafCluster(tr,env,x,y,z,rad,lf,lo){
 const cards=lo?4:14;
 for(let i=0;i<cards;i++){
  const ox=(tr()-.5)*rad*1.7,oy=(tr()-.5)*rad*1.0,oz=(tr()-.5)*rad*1.7;
  addLeaf(tr,env,x+ox,y+oy,z+oz,(lo?.62:.5)+tr()*.3,lf);
 }
}
const MT_LEAF=mkMT(true,true);
MT_LEAF.vertexColors=true;MT_LEAF.side=T.DoubleSide;
MT_LEAF.customProgramCacheKey=()=>'leaf-card-vc-v1';
