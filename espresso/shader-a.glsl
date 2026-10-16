uniform float uX;uniform float uHeat;uniform float uFront;uniform float uBoil;uniform float uYield;uniform float uStream;uniform float uLit;uniform float uF;
uniform vec4 uB;      // XC, ZC, BR, water level z
uniform vec4 uY;      // BY0, BY1, cup rim z, cup base z
uniform vec4 uC;      // cup x0, cup x1, cup y, cup inner radius at rim
uniform vec4 uS;      // spout x0, spout x1, spout z, stream radius
uniform vec4 uP;      // puck x, y, radius, bottom z
uniform vec4 uQ;      // puck top z, water top z, wet front (0..1), pressure 0..1
uniform float uG;     // ghost: how see-through the portafilter is
const float PI=3.14159265;
vec3 inkOf(float lum){ // lum 0..1: dark theme glows, light theme prints ink
  return mix(vec3(.10,.11,.14),vec3(.975),lum);
}
vec3 theme(float lum){return mix(vec3(lum),inkOf(lum),uLit);}
vec3 tintOf(float lum,vec3 tint,float amt){ // colour the subject: blend towards a hue that keeps the lum ordering
  vec3 base=theme(lum);
  vec3 hue=mix(tint*(.15+.85*lum),mix(tint*.55,vec3(1.),lum*lum)*(.35+.65*lum)+tint*.15,uLit);
  hue=mix(hue,mix(tint*lum*1.3,mix(tint*.35,vec3(.98),lum),uLit),0.);
  return mix(base,hue,amt);
}
// ---- boiler section: everything is invariant along the boiler's axis (y), so the optics is 2D in (x,z)
float hitCircle(vec2 rel,vec2 vel,float r,out vec2 n){
  float a=dot(vel,vel);float b=2.*dot(rel,vel);float c=dot(rel,rel)-r*r;
  float d=b*b-4.*a*c;
  if(d<0.)return -1.;
  float s=(-b-sqrt(d))/(2.*a);
  n=(rel+vel*s)/r;
  return s;
}
vec4 boilerOf(vec2 vb){
  float XC=uB.x,ZC=uB.y,BR=uB.z,ZW=uB.w;
  float ya=uY.x+4.,yb=uY.y-6.;
  float Ri=BR-4.;
  vec3 p0=onWallX(vb,XC);
  float px=pixelOf()/uCam.w;
  float m=window(p0.y,ya+.35,yb-.35,.6*px)*window(p0.z,ZC-Ri+.35,ZC+Ri-.35,.6*px);
  if(m<=0.||uX<=0.01)return vec4(0.);
  vec3 V=towardViewer();
  float dz0=p0.z-ZC;
  vec2 vel=vec2(-V.x,-V.z);
  float s=0.;
  // shell
  float a=dot(vel,vel);float b=2.*dz0*vel.y;float c=dz0*dz0-Ri*Ri;
  float sShell=(-b+sqrt(max(b*b-4.*a*c,0.)))/(2.*a);
  float sEnd=(p0.y-ya)/V.y;
  float sHit=min(sShell,sEnd);
  // objects: hx tube, two element tubes
  vec2 n=vec2(0.);vec2 nn;
  float kind=0.; // 0 shell, 1 end wall, 2 hx, 3 element
  if(sEnd<sShell)kind=1.;
  float sh=hitCircle(vec2(0.-(-20.),dz0-14.),vel,7.,nn);
  if(sh>0.&&sh<sHit){float yy=p0.y-V.y*sh;if(yy>ya&&yy<yb){sHit=sh;kind=2.;n=nn;}}
  for(int i=0;i<2;i++){
    float ex=i==0?-12.:-32.;float ez=i==0?-36.:-41.;
    float se=hitCircle(vec2(0.-ex,dz0-ez),vel,4.6,nn);
    if(se>0.&&se<sHit){float yy=p0.y-V.y*se;if(yy>ya&&yy<yb-38.){sHit=se;kind=3.;n=nn;}}
  }
  vec3 hp=p0-V*sHit; // the hit point (x,y,z)
  vec3 L=lightDir();
  float lum;vec3 col;
  float yn=clamp((hp.y-ya)/(yb-ya),0.,1.);
  if(kind<.5){
    vec3 nrm=normalize(vec3(-(hp.x-XC),0.,-(hp.z-ZC)));
    lum=.10+.34*max(dot(nrm,L),0.)+.10*fbm2(vec2(hp.y*.08,atan(hp.z-ZC,hp.x-XC)*3.));
    float weld=1.-smoothstep(0.,.9,abs(mod(hp.y+20.,62.)-31.)-30.);
    lum+=.10*weld;
    col=theme(lum);
  }else if(kind<1.5){
    vec2 q=vec2(hp.x-XC,hp.z-ZC);
    lum=.16+.06*fbm2(q*.1);
    float rv=length(q);
    float ring=1.-smoothstep(0.,.9,abs(rv-40.)-0.);
    lum+=.0;
    float ang=atan(q.y,q.x);float cell=abs(fract(ang*12./PI)-.5);
    float rivet=(1.-smoothstep(1.2,2.,length(vec2(cell*rv*PI/12.,rv-40.))));
    lum+=.18*rivet;
    col=theme(lum);
  }else if(kind<2.5){
    vec3 nrm=normalize(vec3(n.x,0.,n.y));
    float ribs=.5+.5*sin(hp.y*1.1);
    lum=.28+.40*max(dot(nrm,L),0.)+.10*ribs;
    float T=1.-uFront*(1.-smoothstep(uFront-.14,uFront,yn));
    T=clamp(T,0.,1.);
    vec3 hot=vec3(1.,.34,.10);vec3 cold=vec3(.18,.55,1.);
    vec3 tc=mix(cold,hot,T);
    col=mix(theme(lum),tc*(.30+.85*lum)*mix(1.,.82,uLit),.85);
    if(uLit>.5)col=mix(theme(lum),mix(tc*.55,vec3(1.),.35*lum),.85);
  }else{
    vec3 nrm=normalize(vec3(n.x,0.,n.y));
    lum=.30+.45*max(dot(nrm,L),0.);
    vec3 glow=mix(vec3(.55,.55,.58),vec3(1.,.42,.10),uHeat);
    col=mix(theme(lum),glow*(.35+.9*lum)*(.5+.9*uHeat),.8);
    if(uLit>.5)col=mix(theme(lum),mix(vec3(.45),vec3(.95,.38,.10),uHeat)*(.5+.5*lum),.8);
  }
  // water: tint by the length of the ray under the surface
  float sw=(p0.z-ZW)/V.z; // where the ray crosses the surface going away (if it starts above water)
  float inWater=p0.z<ZW?sHit:max(sHit-max(sw,0.),0.);
  if(p0.z>=ZW&&sw>sHit)inWater=0.;
  float fog=1.-exp(-inWater*.022);
  vec3 deep=mix(vec3(.04,.14,.30),vec3(.55,.74,.95),uLit);
  vec3 shallow=mix(vec3(.08,.30,.58),vec3(.35,.62,.92),uLit);
  vec3 wcol=mix(shallow,deep,smoothstep(0.,160.,inWater));
  col=mix(col,mix(col*.55,wcol,.78),fog);
  // heat glow in the water
  float gl=0.;
  for(int i=0;i<2;i++){
    float ex=i==0?-12.:-32.;float ez=i==0?-36.:-41.;
    vec2 rel=vec2(-ex,dz0-ez);float t=clamp(-dot(rel,vel)/dot(vel,vel),0.,sHit);
    float dd=length(rel+vel*t);
    gl+=exp(-dd*dd/(2.*11.*11.));
  }
  vec3 warm=mix(vec3(1.,.50,.14),vec3(.95,.55,.20),uLit);
  col+=uHeat*gl*.55*warm*mix(1.,-.5,uLit)*(fog+.35);
  if(uLit>.5)col=mix(col,vec3(.98,.62,.3),clamp(uHeat*gl*.35,0.,1.));
  // surface sheen and bubbles
  if(p0.z>=ZW&&sw>0.&&sw<sHit){
    vec3 sp=p0-V*sw;
    float rip=fbm2(sp.xy*.09+vec2(0.,uTime*.4));
    float spec=pow(max(dot(normalize(vec3(.3*(rip-.5),.3*(fbm2(sp.yx*.11+uTime*.3)-.5),1.)),normalize(L+V)),0.),40.);
    col=mix(col,theme(.55+.25*rip),.28);
    col+=spec*.35*mix(vec3(1.),vec3(-.6),uLit);
    col=mix(col,vec3(.7,.85,1.),0.);
  }
  // bubbles on a plane just behind the cut (so they read as inside the water)
  float xb=XC-9.;float sb=(XC-xb)/V.x;
  if(uBoil>.02&&sb<sHit){
    vec3 bp=p0-V*sb;
    if(bp.z<ZW&&bp.z>ZC-44.){
      float sum=0.;
      for(int l=0;l<3;l++){
        float fl=float(l);
        float sc=.075+.03*fl;
        vec2 g=vec2(bp.y*sc,(bp.z-uTime*(11.+6.*fl)*(.4+.6*uBoil))*sc);
        vec2 id=floor(g);vec2 f=fract(g)-.5;
        float h=hash12(id+fl*13.7);
        vec2 off=vec2(h-.5,hash12(id+4.1)-.5)*.3;
        float on=step(1.-.34*uBoil,h);
        float r=.20+.14*hash12(id+9.3);
        float d=length(f-off);
        float ring=smoothstep(r-.09,r-.02,d)*(1.-smoothstep(r-.02,r+.03,d));
        float body=(1.-smoothstep(r-.05,r,d))*.35;
        sum+=on*(ring*.9+body);
      }
      float under=smoothstep(ZC-44.,ZC-30.,bp.z);
      col=mix(col,theme(.92),clamp(sum,0.,1.)*under*.8);
    }
  }
  if(uF>.5){
    float on=(uF<1.5)?1.:(uF<2.5?(kind>1.5&&kind<2.5?1.:0.):(kind>2.5?1.:0.));
    col=mix(mix(col*.3,mix(col,vec3(.97),.7),uLit),col,on);
  }
  return vec4(col*m,m);
}
// ---- cups and the stream
vec4 cupsOf(vec2 vb){
  vec3 V=towardViewer();
  float rimZ=uY.z;
  vec3 pr=onFloor(vb,rimZ);
  vec4 acc=vec4(0.);
  float px=pixelOf()/uCam.z;
  for(int i=0;i<2;i++){
    float cx=i==0?uC.x:uC.y;
    vec2 c=vec2(cx,uC.z);
    float inRim=1.-smoothstep(uC.w-.9-.7*px,uC.w-.9,length(pr.xy-c));
    float lvl=uY.w+3.+(rimZ-uY.w-8.)*uYield;
    float t=(lvl-rimZ)/V.z;
    vec3 lp=pr+V*t;
    float rl=11.+(lvl-uY.w-2.5)/(rimZ-uY.w-2.5)*(uC.w-11.);
    float inLiq=1.-smoothstep(rl-.7*px,rl,length(lp.xy-c));
    if(uYield>.005){
      float ang=atan(lp.y-c.y,lp.x-c.x);
      float rr=length(lp.xy-c);
      float sw=fbm2(vec2(rr*.18+uTime*.05,ang*1.5+rr*.12));
      float lumc=.34+.4*sw;
      vec3 crema=mix(vec3(.55,.28,.10),vec3(.92,.66,.36),sw);
      crema=mix(crema,vec3(.35,.17,.06),smoothstep(rl-3.,rl,rr)*.7); // darker ring at the wall
      vec3 colc=mix(crema*mix(1.,.8,uLit),mix(vec3(.45,.22,.08),vec3(.82,.55,.28),sw),uLit);
      float a=inRim*inLiq;
      acc=acc*(1.-a)+vec4(colc*a,a);
    }
    // the stream down into this cup
    if(uStream>.01){
      float sx=i==0?uS.x:uS.y;
      vec2 ax=vec2(sx,uC.z);
      vec2 vxy=V.xy;
      vec2 q0=rayOf(vb).xy-ax;
      float tc=-dot(q0,vxy)/dot(vxy,vxy);
      vec3 pc=rayOf(vb)+V*tc;
      float dd=length(pc.xy-ax)/1.;
      float zc2=pc.z;
      float top=uS.z-1.;
      float bot=lvl;
      float len=top-bot;
      float front=top-len*uStream; // the stream falls from the spout
      float rad=uS.w*(1.-.3*smoothstep(top,bot,zc2))*(.95+.1*fbm2(vec2(zc2*.2-uTime*3.,sx)));
      float body=1.-smoothstep(rad-.5*px,rad+.5*px,dd);
      float along=smoothstep(front-1.,front+1.,zc2)*smoothstep(bot-1.,bot+1.,zc2)*step(zc2,top);
      // below the rim the stream is only seen through the opening
      float vis=zc2>rimZ?1.:inRim;
      float a=body*along*vis*clamp(uStream*4.,0.,1.);
      float core=1.-smoothstep(0.,rad,dd);
      vec3 sc=mix(vec3(.55,.28,.11),vec3(.98,.74,.44),core*core*(.75+.25*fbm2(vec2(zc2*.12-uTime*3.,sx))));
      sc=mix(sc,mix(vec3(.30,.14,.05),vec3(.62,.38,.18),.4),uLit);
      acc=acc*(1.-a)+vec4(sc*a,a);
    }
  }
  return acc;
}

// ---- the puck inside the basket: visible when the portafilter is see-through
vec4 puckOf(vec2 vb){
  if(uG<.02)return vec4(0.);
  vec3 V=towardViewer();
  vec3 p0=rayOf(vb);
  vec2 c=uP.xy;
  float R=uP.z;
  vec2 q=p0.xy-c;
  float tc=-dot(q,V.xy)/dot(V.xy,V.xy);
  float dxy=length(q+V.xy*tc);
  float Rw=R+1.2;
  if(dxy>Rw)return vec4(0.);
  vec3 L=lightDir();
  float zb=uP.w,zt=uP.z*0.+uQ.x,zw=uQ.y;
  // near side of the cylinder
  float hw=sqrt(max(Rw*Rw-dxy*dxy,0.))/length(V.xy);
  float tNear=tc+hw;
  vec3 ps=p0+V*tNear;
  vec4 col=vec4(0.);
  // top face of the puck
  float tTop=(zt-p0.z)/V.z;
  vec3 pt=p0+V*tTop;
  float onTop=1.-smoothstep(R-.8,R,length(pt.xy-c));
  float wetTop=smoothstep(0.,.25,uQ.z)*.8;
  float grain=fbm2(pt.xy*.9);
  vec3 dry=mix(vec3(.30,.19,.10),vec3(.50,.33,.18),grain);
  vec3 wet=mix(vec3(.10,.06,.03),vec3(.22,.13,.06),grain);
  vec3 topc=mix(dry,wet,wetTop);
  topc+=.22*pow(max(dot(normalize(L+V),vec3(0.,0.,1.)),0.),3.)*wetTop*vec3(.9,.8,.7);
  // side of the puck: wet from the top down to the front
  float sideA=0.;vec3 sidec=vec3(0.);
  if(ps.z>zb&&ps.z<zt){
    float depthFrac=(zt-ps.z)/(zt-zb);
    float wetS=1.-smoothstep(uQ.z-.12,uQ.z+.02,depthFrac);
    float g2=fbm2(vec2(atan(ps.y-c.y,ps.x-c.x)*4.,ps.z*.7));
    vec3 d2=mix(vec3(.26,.16,.08),vec3(.44,.28,.15),g2);
    vec3 w2=mix(vec3(.07,.04,.02),vec3(.16,.09,.04),g2);
    float shade=.55+.45*max(dot(normalize(vec3(ps.xy-c,0.)),L),0.);
    sidec=mix(d2,w2,wetS)*shade;
    sideA=1.;
  }
  // choose: the top face wins where it is hit before the side, else the side
  float a=0.;vec3 cc=vec3(0.);
  if(onTop>.01&&pt.z>=zt-.01&&tTop<=tNear+.01){cc=topc;a=onTop;}
  else if(sideA>0.){cc=sidec;a=sideA;}
  // the headspace of water above the puck: a translucent column, denser at pressure
  float aw=0.;vec3 wc=vec3(0.);
  if(uQ.w>.01){
    vec3 pw=p0+V*tNear;
    if(pw.z>zt&&pw.z<zw){
      float fall=.5+.5*fbm2(vec2(atan(pw.y-c.y,pw.x-c.x)*5.,pw.z*.5+uTime*6.));
      aw=(.16+.18*fall)*uQ.w;
      wc=mix(vec3(.30,.60,1.),vec3(.20,.45,.85),uLit);
    }
  }
  if(a<=0.&&aw<=0.)return vec4(0.);
  vec3 outc=cc*a*mix(1.,.9,uLit);
  if(uLit>.5)outc=mix(vec3(.45,.30,.18),cc,.8)*a;
  vec4 r=vec4(outc,a);
  r=r*(1.-aw)+vec4(wc*aw,aw)*(1.-a*.5);
  r*=uG;
  return r;
}
void main(){
  vec2 vb=viewOf(gl_FragCoord.xy);
  vec4 col=vec4(0.);
  vec4 b=boilerOf(vb);
  col=b;
  vec4 c=cupsOf(vb);
  col=col*(1.-c.a)+c;
  vec4 pk=puckOf(vb);
  col=col*(1.-pk.a)+pk;
  gl_FragColor=col;
}
