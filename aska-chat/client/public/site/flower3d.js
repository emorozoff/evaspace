// 3D-цветок АСЬКИ: восемь лепестков-«линз», красный лепесток и сердцевина — трассировка лучей по расстояниям (SDF)
// в одном шейдере WebGL, без библиотек. Две «подачи»: золото с рубином и оникс (Зумер) или глянцевый пластик ICQ (Миллениал).
// AskaFlower.mount(canvas, { theme: 'gold' | 'plastic' }) → { setTheme, destroy }. Нет WebGL — вернёт null (остаётся картинка-заглушка).
(() => {
  'use strict';
  const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const FRAG = `
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform vec2 uLook; uniform float uTheme; uniform float uSS; uniform float uSpin;
mat3 rotY(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}
mat3 rotX(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,s,0.,-s,c);}
mat3 rotZ(float a){float c=cos(a),s=sin(a);return mat3(c,s,0.,-s,c,0.,0.,0.,1.);}
float sdEll(vec3 p, vec3 r){float k0=length(p/r);float k1=length(p/(r*r));return k0*(k0-1.)/k1;}
float sdTorus(vec3 p, vec2 t){vec2 q=vec2(length(p.xy)-t.x,p.z);return length(q)-t.y;}
mat3 R;
// x — расстояние, y — материал: 1 лепесток, 2 красный лепесток, 3 сердцевина, 4 кольцо
vec2 map(vec3 p){
  p=R*p;
  vec2 res=vec2(1e3,0.);
  float th=0.72;
  for(int i=0;i<8;i++){
    float a=float(i)*0.7853982-1.5707963;
    vec3 c=vec3(0.62*cos(a),-0.62*sin(a),0.);
    float d=sdEll(p-c,vec3(0.335,0.335,0.335*th*0.55));
    float m=(i==3)?2.:1.;
    if(d<res.x)res=vec2(d,m);
  }
  float dc=sdEll(p-vec3(0.,0.,0.05),vec3(0.31,0.31,0.2));
  if(dc<res.x)res=vec2(dc,3.);
  if(uTheme<0.5){
    float dr=sdTorus(rotX(0.35)*rotZ(uTime*0.2)*p,vec2(1.12,0.018));
    if(dr<res.x)res=vec2(dr,4.);
  }
  return res;
}
vec3 normal(vec3 p){
  const vec2 k=vec2(1.,-1.);float e=0.0012;
  return normalize(k.xyy*map(p+k.xyy*e).x+k.yyx*map(p+k.yyx*e).x+k.yxy*map(p+k.yxy*e).x+k.xxx*map(p+k.xxx*e).x);
}
// студия: тёплый софтбокс сверху, холодная полоса сбоку, фиолетовый «пол»
vec3 env(vec3 r){
  vec3 c=mix(vec3(0.012,0.008,0.025),vec3(0.22,0.17,0.12),smoothstep(-0.25,1.,r.y));
  c+=vec3(4.2,3.6,2.8)*exp(-(pow(r.x-0.35,2.)+pow(r.y-0.85,2.))*9.);
  c+=vec3(1.6,1.3,0.9)*exp(-pow(r.y-0.12,2.)*60.)*smoothstep(-0.2,0.6,r.x);
  c+=vec3(0.5,0.55,1.4)*smoothstep(0.65,0.97,-r.x)*smoothstep(-0.3,0.5,r.y);
  c+=vec3(0.9,0.6,0.3)*smoothstep(0.8,1.,r.z)*0.25;
  return c;
}
float ao(vec3 p,vec3 n){float o=0.,s=1.;for(int i=1;i<=4;i++){float h=0.04*float(i);o+=(h-map(p+n*h).x)*s;s*=0.6;}return clamp(1.-2.2*o,0.,1.);}
vec4 shade(vec2 frag){
  vec2 uv=(frag-0.5*uRes)/min(uRes.x,uRes.y);
  vec3 ro=vec3(0.,0.,3.15);
  vec3 rd=normalize(vec3(uv,-1.2));
  float t=0.;float m=0.;
  // ограничивающая сфера
  float b=dot(ro,rd);float cc=dot(ro,ro)-1.44;float h=b*b-cc;
  if(h<0.)return vec4(0.);
  t=max(0.,-b-sqrt(h));
  bool hit=false;
  for(int i=0;i<90;i++){
    vec2 r=map(ro+rd*t);
    if(r.x<0.0008){hit=true;m=r.y;break;}
    t+=r.x;
    if(t>5.)break;
  }
  if(!hit)return vec4(0.);
  vec3 p=ro+rd*t;vec3 n=normal(p);vec3 v=-rd;
  vec3 l1=normalize(vec3(0.5,0.8,0.6));vec3 l2=normalize(vec3(-0.7,0.2,0.4));
  float occ=ao(p,n);
  float fres=pow(1.-max(dot(n,v),0.),5.);
  vec3 rf=reflect(rd,n);
  vec3 col;
  if(uTheme<0.5){
    if(m<1.5||m>3.5){ // золото
      vec3 F0=vec3(1.,0.71,0.29);
      vec3 F=F0+(1.-F0)*fres;
      col=env(rf)*F+F0*vec3(0.95,0.8,0.6)*0.32*max(dot(n,v),0.)+F0*0.12;
      col+=vec3(1.,0.9,0.7)*pow(max(dot(rf,l1),0.),60.)*2.5;
      col*=mix(0.55,1.,occ);
    } else if(m<2.5){ // рубин: эмаль с лаком
      vec3 base=vec3(0.42,0.008,0.02);
      col=base*(0.18+0.9*max(dot(n,l1),0.))+base*0.4*max(dot(n,l2),0.);
      col+=env(rf)*(0.04+0.9*fres)+vec3(1.)*pow(max(dot(rf,l1),0.),90.)*1.6;
      col*=mix(0.6,1.,occ);
    } else { // оникс
      col=vec3(0.015)+env(rf)*(0.05+0.85*fres)*0.7+vec3(1.)*pow(max(dot(rf,l1),0.),120.)*1.3;
    }
  } else {
    // пластик ICQ: диффуз, блик и тёмный контур по краю
    vec3 base=m<1.5?vec3(0.05,0.42,0.035):(m<2.5?vec3(0.72,0.02,0.02):vec3(0.9,0.9,0.86));
    float dif=max(dot(n,l1),0.);
    col=base*(0.32+0.78*dif)+base*0.25*max(dot(n,l2),0.);
    col+=vec3(1.)*pow(max(dot(reflect(-l1,n),v),0.),48.)*0.75;
    col+=env(rf)*0.05*(0.3+fres*3.);
    col*=mix(0.7,1.,occ);
    float edge=smoothstep(0.52,0.82,1.-max(dot(n,v),0.));
    col=mix(col,vec3(0.004,0.006,0.004),edge*0.95);
  }
  col=col/(1.+col*0.55);
  col=pow(col,vec3(0.4545));
  return vec4(col,1.);
}
void main(){
  R=rotX(uLook.y*0.4+0.16*sin(uTime*0.45))*rotY(0.4*sin(uTime*0.5)+uSpin+uLook.x*0.5)*rotZ(uTime*0.12);
  vec2 f=gl_FragCoord.xy;
  vec4 c=shade(f);
  if(uSS>0.5){
    c+=shade(f+vec2(0.5,0.));c+=shade(f+vec2(0.,0.5));c+=shade(f+vec2(0.5,0.5));c*=0.25;
  }
  gl_FragColor=vec4(c.rgb*c.a,c.a);
}`;

  function mount(canvas, opts = {}) {
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'low-power' });
    if (!gl) return null;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    let prog;
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (e) { console.warn('АСЬКА 3D:', e.message); return null; }
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n) => gl.getUniformLocation(prog, n);
    const uRes = U('uRes'); const uTime = U('uTime'); const uLook = U('uLook'); const uTheme = U('uTheme'); const uSS = U('uSS'); const uSpin = U('uSpin');

    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = matchMedia('(pointer: coarse)').matches;
    let theme = opts.theme === 'plastic' ? 1 : 0;
    let look = [0, 0]; let target = [0, 0];
    let visible = true; let raf = 0; let last = 0; let t0 = performance.now(); let dragging = false; let spin = 0; let dragX = 0;
    let ss = 0;

    function resize() {
      const dpr = Math.min(coarse ? 2 : 1.75, devicePixelRatio || 1);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr)); const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      ss = !coarse && dpr < 1.5 ? 1 : 0; // сглаживание четырьмя лучами — только на обычных экранах компьютера
      gl.viewport(0, 0, w, h);
    }
    function frame(now) {
      raf = 0;
      if (!visible) return;
      const minGap = coarse ? 33 : 16; // на телефоне — 30 кадров в секунду
      if (now - last < minGap) { raf = requestAnimationFrame(frame); return; }
      last = now;
      look[0] += (target[0] - look[0]) * 0.07; look[1] += (target[1] - look[1]) * 0.07;
      const time = reduce ? 0.6 : (now - t0) / 1000;
      gl.uniform2f(uRes, canvas.width, canvas.height); gl.uniform1f(uTime, time); gl.uniform2f(uLook, look[0], look[1]);
      gl.uniform1f(uTheme, theme); gl.uniform1f(uSS, ss); gl.uniform1f(uSpin, spin);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reduce) raf = requestAnimationFrame(frame);
    }
    const kick = () => { if (!raf && visible) raf = requestAnimationFrame(frame); };
    resize();
    const ro = new ResizeObserver(() => { resize(); kick(); }); ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); }); io.observe(canvas);
    const onVis = () => { visible = !document.hidden; kick(); };
    document.addEventListener('visibilitychange', onVis);
    const onMove = (e) => {
      if (dragging) { spin += (e.clientX - dragX) / 120; dragX = e.clientX; }
      target = [(e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1];
      if (reduce) requestAnimationFrame(frame);
    };
    addEventListener('pointermove', onMove, { passive: true });
    // покрутить пальцем или мышкой
    canvas.addEventListener('pointerdown', (e) => { dragging = true; dragX = e.clientX; canvas.setPointerCapture?.(e.pointerId); });
    canvas.addEventListener('pointerup', () => { dragging = false; });
    canvas.addEventListener('pointercancel', () => { dragging = false; });
    canvas.addEventListener('pointermove', (e) => { if (dragging && e.pointerType !== 'mouse') { spin += (e.clientX - dragX) / 120; dragX = e.clientX; kick(); } });
    canvas.classList.add('ready');
    kick();
    return {
      setTheme(t) { theme = t === 'plastic' ? 1 : 0; requestAnimationFrame(frame); },
      destroy() { visible = false; ro.disconnect(); io.disconnect(); removeEventListener('pointermove', onMove); document.removeEventListener('visibilitychange', onVis); },
    };
  }
  window.AskaFlower = { mount };
})();
