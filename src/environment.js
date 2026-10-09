/* ---------- clean, single-pass colour management ---------- */
ren.outputEncoding=T.sRGBEncoding;
ren.toneMapping=T.ACESFilmicToneMapping;
ren.toneMappingExposure=.95;
// The colour grade lives in the existing material pass. No composer, grain,
// render targets, screen-space noise, chromatic aberration or motion blur.
T.ShaderChunk.tonemapping_fragment=`
#if defined( TONE_MAPPING )
 gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif
float gradeLuma=dot(gl_FragColor.rgb,vec3(.2126,.7152,.0722));
gl_FragColor.rgb*=mix(vec3(1.),vec3(1.018,1.003,.982),smoothstep(.45,.95,gradeLuma));
gl_FragColor.rgb+=vec3(.0010,.0018,.0028)*(1.-smoothstep(.015,.18,gradeLuma));
`;
const DISPLAY='\n#include <tonemapping_fragment>\n#include <encodings_fragment>\n';
const PREF_KEY='okavango.marsh.settings.v2';
let saved={};try{saved=JSON.parse(localStorage.getItem(PREF_KEY)||'{}')||{}}catch(e){}
const U={
 uOrg:{value:new T.Vector2()},uT:{value:0},uSun:{value:new T.Vector3()},
 uMoon:{value:new T.Vector3()},uKey:{value:new T.Vector3()},
 uSunColor:{value:new T.Color()},uFog:{value:new T.Color()},uFogD:{value:.0038},
 uFar:{value:160},uZen:{value:new T.Color()},uPl:{value:new T.Vector3()},
 uMv:{value:0},uCr:{value:1},uDay:{value:1},uNight:{value:0},
 uWind:{value:new T.Vector2(.58,.25)},uFX:{value:1},uMist:{value:0},uRays:{value:0},
 uRipples:{value:Array.from({length:6},()=>new T.Vector4(0,0,-100,0))}
};
const sun=new T.DirectionalLight(0xfff0d8,1.3),hemi=new T.HemisphereLight(0xb4c6dc,0x8a6540,.72);
const lantern=new T.PointLight(0xffcf93,0,10,2);
scene.add(sun,sun.target,hemi,lantern);
sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
Object.assign(sun.shadow.camera,{left:-45,right:45,top:45,bottom:-45,near:1,far:260});
sun.shadow.bias=-.00035;sun.shadow.normalBias=.055;sun.shadow.radius=2.5;
const ENV={az:.9,el:.78,haze:[.43,.50,.46],zen:[.075,.17,.32],sun:[1,.92,.78],sunI:1.3,amb:.72,fogD:.0038,hs:[.62,.76,.9],hg:[.42,.31,.20]};
const sdir=new T.Vector3(),mdir=new T.Vector3(),keydir=new T.Vector3();
// A 36-minute orbit, continuously evaluated. TIME still jumps to familiar
// landmarks; it no longer freezes the world on one of four lighting presets.
const CYCLE_SECONDS=2160;
const TODS=[{n:'LATE MORNING',hour:9.75},{n:'NOON',hour:12},{n:'GOLDEN HOUR',hour:17.15},{n:'DUSK',hour:18.35},{n:'NIGHT',hour:22},{n:'DAWN',hour:6.2}];
const NIGHT={haze:[.016,.025,.044],zen:[.004,.010,.026],sun:[.54,.66,.91],sunI:0,amb:.25,fogD:.0040,hs:[.30,.41,.62],hg:[.17,.15,.12]};
const SKY_KEYS=[
 {hour:0,...NIGHT},{hour:4.9,...NIGHT},
 {hour:5.65,haze:[.12,.10,.15],zen:[.022,.044,.11],sun:[1,.52,.24],sunI:0,amb:.30,fogD:.0052,hs:[.45,.43,.57],hg:[.22,.17,.12]},
 {hour:6.25,haze:[.49,.31,.20],zen:[.052,.11,.23],sun:[1,.59,.28],sunI:.45,amb:.42,fogD:.0050,hs:[.64,.54,.47],hg:[.30,.21,.13]},
 {hour:7.5,haze:[.47,.46,.35],zen:[.065,.15,.29],sun:[1,.80,.52],sunI:1.16,amb:.64,fogD:.0042,hs:[.63,.70,.79],hg:[.40,.30,.19]},
 {hour:10,haze:[.43,.50,.46],zen:[.075,.17,.32],sun:[1,.92,.78],sunI:1.3,amb:.72,fogD:.0038,hs:[.62,.76,.90],hg:[.42,.31,.20]},
 {hour:12,haze:[.43,.51,.53],zen:[.052,.15,.34],sun:[1,.97,.91],sunI:1.42,amb:.78,fogD:.0032,hs:[.65,.80,.95],hg:[.45,.36,.24]},
 {hour:15.8,haze:[.48,.46,.35],zen:[.07,.15,.29],sun:[1,.83,.59],sunI:1.3,amb:.66,fogD:.0039,hs:[.69,.68,.65],hg:[.40,.29,.17]},
 {hour:17.2,haze:[.59,.35,.18],zen:[.078,.12,.24],sun:[1,.63,.30],sunI:1.02,amb:.48,fogD:.0047,hs:[.72,.52,.38],hg:[.33,.20,.11]},
 {hour:18.1,haze:[.34,.19,.20],zen:[.032,.053,.14],sun:[1,.42,.22],sunI:.12,amb:.32,fogD:.0050,hs:[.47,.38,.50],hg:[.23,.17,.13]},
 {hour:19.15,...NIGHT},{hour:24,...NIGHT}
];
let dayHour=Number.isFinite(saved.hour)&&saved.hour>=0&&saved.hour<24?saved.hour:9.75;
let todI=TODS.reduce((best,v,i)=>Math.abs(v.hour-dayHour)<Math.abs(TODS[best].hour-dayHour)?i:best,0),clockTransition=null,clockRunning=true,started=false,saveT=0;
let jumpQ=0,jb=0,cy2=0,cpT='',sunVis=1,sunVisT=1;
const sv=new T.Vector3();
function orbit(hour,out){const a=(hour-6)*Math.PI/12;return out.set(Math.cos(a)*.96,Math.sin(a)*.96,Math.sin(a)*.25+Math.cos(a)*.20).normalize()}
function applyEnv(){
 orbit(dayHour,sdir);orbit(dayHour+11.3,mdir);
 ENV.az=Math.atan2(sdir.x,sdir.z);ENV.el=Math.asin(sdir.y);
 const daylight=sm(-.13,.20,sdir.y),night=1-daylight;
 keydir.copy(sdir.y>.035?sdir:mdir);if(keydir.y<.025)keydir.y=.025;keydir.normalize();
 U.uSun.value.copy(sdir);U.uMoon.value.copy(mdir);U.uKey.value.copy(keydir);
 U.uSunColor.value.setRGB(...ENV.sun);U.uDay.value=daylight;U.uNight.value=night;
 U.uFog.value.setRGB(...ENV.haze);U.uZen.value.setRGB(...ENV.zen);
 scene.fog.color.copy(U.uFog.value);scene.fog.density=U.uFogD.value=ENV.fogD;
 sun.color.setRGB(...ENV.sun);if(sdir.y<=.035)sun.color.setRGB(.53,.67,.95);
 sun.intensity=ENV.sunI+(sdir.y<=.035?.30*sm(0,.35,mdir.y):0);
 hemi.intensity=ENV.amb;hemi.color.setRGB(...ENV.hs);hemi.groundColor.setRGB(...ENV.hg);
 U.uMist.value=(1-sm(.08,.34,Math.abs(sdir.y)))*(.46+.30*daylight);
 U.uRays.value=sm(.025,.10,sdir.y)*(1-sm(.32,.58,sdir.y));
 ren.toneMappingExposure=lerp(.95,1.06,night);lantern.intensity=night*.65;
}
function sampleEnvironment(){
 let a=SKY_KEYS[0],b=SKY_KEYS[1];
 for(let i=0;i<SKY_KEYS.length-1;i++)if(dayHour>=SKY_KEYS[i].hour&&dayHour<SKY_KEYS[i+1].hour){a=SKY_KEYS[i];b=SKY_KEYS[i+1];break}
 const t=sm(a.hour,b.hour,dayHour);
 for(const k of ['haze','zen','sun','hs','hg'])for(let i=0;i<3;i++)ENV[k][i]=lerp(a[k][i],b[k][i],t);
 for(const k of ['sunI','amb','fogD'])ENV[k]=lerp(a[k],b[k],t);
 applyEnv();
}
function setTime(hour,immediate=false){
 hour=((hour%24)+24)%24;
 if(immediate){dayHour=hour;clockTransition=null;sampleEnvironment()}
 else clockTransition={from:dayHour,to:(hour-dayHour+24)%24,t:0};
 let best=99;for(let i=0;i<TODS.length;i++){const d=Math.abs(TODS[i].hour-hour);if(d<best){best=d;todI=i}}
 saveSettings();
}
function saveSettings(){try{localStorage.setItem(PREF_KEY,JSON.stringify({quality:qm,sensitivity:SENS,hour:clockTransition?(clockTransition.from+clockTransition.to)%24:dayHour,version:2}))}catch(e){}}
function envStep(dt){
 if(started&&clockRunning){
  if(clockTransition){const tr=clockTransition;tr.t+=dt;const t=sm(0,4.5,tr.t);dayHour=(tr.from+tr.to*t)%24;if(tr.t>=4.5)clockTransition=null}
  else dayHour=(dayHour+24*dt/CYCLE_SECONDS)%24;
 }
 sampleEnvironment();
 const t=U.uT.value,angle=.48+Math.sin(t*.017)*.24+Math.sin(t*.006)*.15;
 const speed=.42+.25*(.5+.5*Math.sin(t*.043))+.10*Math.sin(t*.107);
 U.uWind.value.set(Math.cos(angle)*speed,Math.sin(angle)*speed);
 saveT+=dt;if(started&&saveT>20){saveT=0;saveSettings()}
}
function timeName(){return dayHour<5.6?'NIGHT':dayHour<7?'DAWN':dayHour<11?'LATE MORNING':dayHour<15?'NOON':dayHour<17.9?'GOLDEN HOUR':dayHour<19.15?'DUSK':'NIGHT'}
const sgS=$('sg').style;
function ui(dt){
 const dg=((-P.yaw*57.2958)%360+360)%360;
 const ct=['N','NE','E','SE','S','SW','W','NW'][Math.round(dg/45)%8]+'  '+Math.round(dg)+'°   ·   '+timeName();
 if(ct!==cpT){cpT=ct;$('cp').textContent=ct}
 sunVis+=(sunVisT-sunVis)*(1-Math.exp(-dt*6));
 sv.copy(cam.position).addScaledVector(sdir,500).project(cam);
 if(sv.z<1&&sdir.y>-.02){
  sgS.transform='translate('+((sv.x*.5+.5)*innerWidth)+'px,'+((-sv.y*.5+.5)*innerHeight)+'px)';
  sgS.opacity=cl(1.3-Math.hypot(sv.x,sv.y)*.85)*.28*sm(-.02,.15,sdir.y)*sunVis;
 }else sgS.opacity=0;
}
sampleEnvironment();
