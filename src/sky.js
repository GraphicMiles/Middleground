/* ---------- continuous sky, sun, moon and world-anchored stars ---------- */
const sky=new T.Mesh(new T.SphereGeometry(900,24,12),new T.ShaderMaterial({
 uniforms:U,side:T.BackSide,depthWrite:false,fog:false,extensions:{derivatives:true},
 vertexShader:`varying vec3 vD;
 void main(){vD=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:GN+`
 uniform vec3 uFog,uZen,uSun,uMoon,uSunColor;
 uniform float uT,uDay,uNight;varying vec3 vD;
 float fb(vec2 p){float a=.5,r=0.;for(int i=0;i<3;i++){r+=a*nn(p);p=p*2.03+7.1;a*=.5;}return r;}
 void main(){
  vec3 d=normalize(vD);float y=max(d.y,0.);
  vec3 c=mix(uFog,uZen,pow(y,.43));
  float s=max(dot(d,uSun),0.),m=max(dot(d,uMoon),0.);
  float solar=pow(s,80.)*.14+pow(s,1400.)*.95;
  c+=uSunColor*solar*uDay;
  float sunDisc=smoothstep(.99991,.99998,s)*smoothstep(-.01,.035,uSun.y);
  c+=uSunColor*sunDisc*5.;
  // Directional star coordinates never depend on screen pixels or movement.
  vec2 sp=vec2(atan(d.x,d.z),asin(clamp(d.y,0.,1.)))*105.;
  vec2 cell=floor(sp),sf=fract(sp);
  float seed=hh(cell+91.7),mag=hh(cell+47.);
  vec2 center=.16+.68*vec2(hh(cell+3.9),hh(cell+12.4));
  float footprint=max(fwidth(sp.x),fwidth(sp.y));
  float star=(1.-smoothstep(.012+.025*mag,.028+.025*mag+min(.14,footprint*.55),length(sf-center)))*step(.984,seed);
  vec3 starTint=mix(vec3(.61,.77,1.),vec3(1.,.84,.61),mag);
  c+=starTint*star*(.32+mag*.85)*pow(uNight,2.)*(1.-smoothstep(-.13,.025,uSun.y))*smoothstep(.02,.18,d.y)*(.92+.08*sin(uT*.65+seed*200.));
  vec3 mr=normalize(cross(uMoon,vec3(0.,1.,0.))),mu=cross(mr,uMoon);
  vec2 uv=vec2(dot(d,mr),dot(d,mu))/.0115;
  float radius=length(uv);
  if(m>.9998&&radius<1.04){
   vec3 mn=vec3(uv,sqrt(max(0.,1.-dot(uv,uv))));
   float phase=smoothstep(-.13,.12,dot(mn,normalize(vec3(.52,.17,.83))));
   float craters=.79+.13*nn(uv*8.+3.)+.08*nn(uv*21.+9.);
   vec3 moon=vec3(.71,.77,.82)*craters*(.07+.93*phase);
   c=mix(c,moon,(1.-smoothstep(.95,1.03,radius))*uNight*smoothstep(-.01,.07,uMoon.y));
  }
  c+=vec3(.31,.43,.68)*pow(m,1900.)*.055*uNight;
  float cloud=0.;
  if(d.y>0.){
   vec2 cp=d.xz/(d.y+.18)*.9+vec2(uT*.0028,uT*.0010);
   float cv=fb(cp*1.4);
   cloud=smoothstep(.51,.75,cv+.07*nn(cp*5.))*smoothstep(.06,.26,d.y);
   vec3 cc=mix(uFog,vec3(.76,.78,.76)*(.05+.95*uDay),.62);
   cc*=.78+.22*smoothstep(.50,.76,cv);
   cc+=uSunColor*pow(s,7.)*.15*uDay;
   c=mix(c,cc,cloud*.78);
  }
  float az=atan(d.x,d.z);
  float r1=.009+.015*nn(vec2(az*1.9,2.))+.012*nn(vec2(az*7.,5.));
  float r2=.018+.02*nn(vec2(az*1.4,9.))+.014*nn(vec2(az*5.,1.));
  vec3 ridge=mix(uFog,uZen,.18)*(.83+.10*uDay);
  c=mix(c,mix(uFog,ridge,.40),1.-smoothstep(r2-.0015,r2+.0015,d.y));
  c=mix(c,mix(uFog,ridge,.72),1.-smoothstep(r1-.0015,r1+.0015,d.y));
  gl_FragColor=vec4(d.y<0.?uFog:c,1.);
 `+DISPLAY+`}`
}));
sky.frustumCulled=false;sky.renderOrder=-1;scene.add(sky);
