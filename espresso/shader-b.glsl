uniform float uSteam;uniform float uLit;uniform vec3 uTip;
void main(){
  if(uSteam<.01){gl_FragColor=vec4(0.);return;}
  vec2 vb=viewOf(gl_FragCoord.xy);
  vec3 V=towardViewer();
  vec3 p0=rayOf(vb);
  vec2 q=p0.xy-uTip.xy;
  float tc=-dot(q,V.xy)/dot(V.xy,V.xy);
  float dxy=length(q+V.xy*tc);
  float Rb=40.;
  if(dxy>Rb){gl_FragColor=vec4(0.);return;}
  float hw=sqrt(Rb*Rb-dxy*dxy)/length(V.xy);
  float t0=tc-hw,t1=tc+hw;
  const int N=24;
  float dt=(t1-t0)/float(N);
  float j=hash12(gl_FragCoord.xy+uTime);
  float dens=0.;
  for(int i=0;i<N;i++){
    float t=t0+(float(i)+j)*dt;
    vec3 p=p0+V*t;
    float h=p.z-uTip.z;
    if(h>0.&&h<170.){
      vec2 d=p.xy-uTip.xy-vec2(.10,.04)*h;
      float r=2.5+.24*h;
      float core=exp(-dot(d,d)/(2.*r*r));
      float n=fbm3(vec3(p.xy*.075,h*.05-uTime*.9))*.65+.35*fbm3(vec3(p.xy*.19,h*.11-uTime*1.7));
      float body=smoothstep(.40,.74,n+.16*(1.-h/170.));
      float up=smoothstep(0.,10.,h)*(1.-smoothstep(70.,170.,h));
      dens+=core*body*up*dt*.055;
    }
  }
  float a=(1.-exp(-dens*1.9))*uSteam;
  a=min(a,.62);
  vec3 col=mix(vec3(.90,.94,1.),vec3(.40,.44,.52),uLit);
  a+=(hash12(gl_FragCoord.xy+uTime*3.)-.5)/255.*step(.004,a);
  gl_FragColor=vec4(col*a,a);
}
