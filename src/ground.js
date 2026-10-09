/* ---------- ground v3: reference-led southern African material mosaic ---------- */
// Reference photographs inform colours only. Every shipped texture is original.
// Heights, seed, collisions, grass/tree placement and locomotion are unchanged.
const GROUND={
 version:5,_loaded:0,mode:'physical',
 palette:{sand:[.62,.55,.44],greySand:[.56,.53,.47],ochre:[.53,.40,.28],clay:[.67,.63,.54],loam:[.36,.32,.25],silt:[.44,.42,.35],mud:[.235,.205,.165],bed:[.145,.145,.125]},
 profile(x,z,e,m,slope=0){
  const s=e-WL,dry=1-sm(.44,.82,m);
  const wet=cl((1-sm(.025,.80,s))*(.73+.27*m)+.16*sm(.66,.90,m)*(1-sm(.65,1.8,s)));
  const mineral=vn(x/62+9.3,z/62-4.7,191),clayField=sm(.46,.70,vn(x/31,z/31,192));
  const clay=sm(.15,.48,s)*(1-sm(.95,1.55,s))*clayField*(1-wet)*(.55+.45*dry)*(1-sm(.15,.32,slope));
  const gravel=sm(.07,.20,slope)*(.4+.6*mineral)*(1-wet);
  const sand=(1-clay)*(1-wet)*(.62+.38*dry);
  // Flood-deposited silt from the Okavango reference: a fine, slightly cool band
  // above the water table, between saturated mud and the dry mineral soils.
  const silt=sm(.02,.30,s)*(1-sm(.62,1.30,s))*(1-wet*.82)*(.45+.55*sm(.40,.66,vn(x/44-13,z/44+27,194)));
  // Soil under grass cover darkens with accumulated litter, so loam follows the
  // vegetated moisture band rather than sitting on every damp surface.
  const grass=sm(-.05,.35,s)*sm(.55,1.15,m)*(1-sm(.85,1.65,s))*(1-wet*.60);
  // A cracked pan needs a dried clay crust, not merely clay-rich soil, so this
  // is gated harder on dryness than the pale crust colour and broken into
  // patches instead of covering every clay surface uniformly.
  const crack=clay*sm(.30,.68,dry)*sm(.22,.55,s)*(1-sm(.12,.30,slope))*sm(.38,.70,vn(x/23-2.6,z/23+14.2,195));
  return {wet,clay,gravel,sand,dry,mineral,silt,grass,crack};
 },
 color(e,m,x,z,slope=0,profile=null){
  const p=profile||GROUND.profile(x,z,e,m,slope),a=GROUND.palette;
  let c=mix3(a.greySand,a.sand,sm(.25,.74,p.mineral));
  c=mix3(c,a.silt,p.silt*.55);
  c=mix3(c,a.ochre,sm(.64,.88,p.mineral)*(.25+.30*p.dry));
  c=mix3(c,a.loam,cl((1-p.dry)*.26+p.grass*.24,0,.48));
  c=mix3(c,a.clay,p.clay*.70);
  c=mix3(c,a.mud,p.wet*.87);
  if(e<WL)c=mix3(c,a.bed,sm(0,.85,WL-e));
  const patch=.94+.10*vn(x/12,z/12,193);
  return c.map(v=>v*patch);
 },
 inspect(x,z){
  const e=H(x,z),m=Mo(x,z,e),slope=Math.hypot(H(x+.6,z)-H(x-.6,z),H(x,z+.6)-H(x,z-.6))/1.2,p=GROUND.profile(x,z,e,m,slope);
  const material=e<WL?'submerged sand/silt':p.wet>.45?'damp mud/silt':p.clay>.18?'dry clay crust':p.silt>.30?'flood-deposited silt':p.gravel>.25?'gravelly ochre soil':'Kalahari-style sand/loam';
  return {material,height:e,moisture:m,slope,...p,color:GROUND.color(e,m,x,z,slope)};
 }
};
const groundLoader=new T.TextureLoader();
const groundDetail=groundLoader.load(GROUND_TEXTURES.detail,()=>GROUND._loaded++,undefined,e=>console.error('Ground detail texture',e));
const groundNormal=groundLoader.load(GROUND_TEXTURES.normal,()=>GROUND._loaded++,undefined,e=>console.error('Ground normal texture',e));
for(const t of [groundDetail,groundNormal]){t.wrapS=t.wrapT=T.RepeatWrapping;t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.anisotropy=Math.min(4,ren.capabilities.getMaxAnisotropy())}
const groundPhysical=new T.MeshStandardMaterial({name:'Savanna ground',vertexColors:true,map:groundDetail,normalMap:groundNormal,roughness:.93,metalness:0,normalScale:new T.Vector2(.45,.45)});
const groundLow=new T.MeshLambertMaterial({name:'Savanna ground low',vertexColors:true,map:groundDetail});
function compileGround(mat,physical){
 mat.customProgramCacheKey=()=>physical?'ground-physical-v5':'ground-low-v5';
 mat.onBeforeCompile=s=>{
  for(const k of ['uOrg','uFX','uT','uDay'])s.uniforms[k]=U[k];
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute vec4 aSoil;uniform vec2 uOrg;varying vec3 vGround;varying vec4 vSoil;')
  .replace('#include <uv_vertex>',`#ifdef USE_UV
   vec3 groundPoint=(modelMatrix*vec4(position,1.)).xyz;
   vGround=groundPoint;vGround.xz+=uOrg;vSoil=aSoil;
   vUv=vGround.xz/6.;
   #endif`);
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vGround;varying vec4 vSoil;uniform float uFX,uT,uDay;');
  // A single packed texture: R=mineral detail, G=embedded grit, A=fine cracks.
  // Mip filtering and world UVs prevent screen grain and temporal sparkle.
  const dist=physical?'length(vViewPosition)':'distance(vGround,vec3(cameraPosition.x+uOrg.x,cameraPosition.y,cameraPosition.z+uOrg.y))';
  if(!physical){s.uniforms.uOrg=U.uOrg;s.fragmentShader=s.fragmentShader.replace('uniform float uFX,uT,uDay;','uniform float uFX,uT,uDay;uniform vec2 uOrg;')}
  s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
   // Surface relief follows the material: embedded grit and a dried crust carry
   // texture, while wet mud and submerged silt are smooth. Amplitude stays low
   // on purpose so the ground reads as soil rather than embossed plastic.
   float relief=(1.-vSoil.x*.78)*(.80+vSoil.z*.60+vSoil.w*.32);
   #ifdef USE_MAP
   vec4 groundTex=texture2D(map,vUv);
   float groundDistance=${dist};
   float closeGround=1.-smoothstep(12.,34.,groundDistance);
   float clayCrack=vSoil.w*closeGround*step(-.55,vGround.y);
   diffuseColor.rgb*=mix(1.,groundTex.r,.45+.55*closeGround);
   float crackMask=groundTex.a;
   // A second, wider crack scale stops the crust reading as one uniform overlay.
   if(clayCrack>.012)crackMask=mix(crackMask,texture2D(map,vUv*.61+vec2(.17,.09)).a,.55);
   diffuseColor.rgb*=1.-(1.-crackMask)*clayCrack*.42;
   diffuseColor.rgb+=vec3(.021,.019,.016)*groundTex.g*vSoil.z*closeGround;
   // Preserve the water pass's restrained, very-shallow bed caustics.
   float bedDepth=-.55-vGround.y;
   if(bedDepth>.015&&bedDepth<.36&&uFX>.35&&groundDistance<16.){
    float ca=abs(sin(vGround.x*2.7+sin(vGround.z*2.2+uT*.45)*.65+uT*.35));
    float cb=abs(sin(vGround.z*2.9+sin(vGround.x*2.3-uT*.30)*.65-uT*.42));
    diffuseColor.rgb+=vec3(.003,.0045,.0018)*pow(1.-min(ca,cb),12.)*(1.-smoothstep(7.,16.,groundDistance))*uDay*(1.-smoothstep(.08,.36,bedDepth));
   }
   #endif`);
  if(physical){
   // Damp earth takes a broad sheen, not a mirror one, so the wet end stops
   // short of reading as polished stone.
   s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(.94,.46,vSoil.x);');
   const normals=T.ShaderChunk.normal_fragment_maps.replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale *(.30+.70*uFX)*relief*(1.-smoothstep(18.,65.,length(vViewPosition)));');
   s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',normals);
  }
 };
}
compileGround(groundPhysical,true);compileGround(groundLow,false);
let TM=groundPhysical;
GROUND.syncQuality=(quality,fx)=>{
 const target=quality===1||(quality===0&&fx<.31)?groundLow:groundPhysical;
 if(TM===target)return;
 TM=target;GROUND.mode=target===groundLow?'low':'physical';
 for(const c of chunks.values())for(const m of c.meshes)if(m.userData.ground)m.material=TM;
};
