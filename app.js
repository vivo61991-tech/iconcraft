'use strict';
/* ============================================================
   IconCraft v2 — Editor de Ícones (PWA)
   Arquitetura em camadas: vetor (SVG) + pixel (canvas)
   Desenho livre · espelho ao vivo · pincel caligráfico ·
   pincel negativo · balde de tinta · formas geométricas ·
   edição de nós · imagem de referência
   ============================================================ */

const $ = id => document.getElementById(id);
const SVGNS = 'http://www.w3.org/2000/svg';

/* ---------------- Estado ---------------- */
const state = {
  size: 512,
  gridOn: true,
  gridSpacing: 32,
  gridAbove: false,
  items: [],           // {id,kind:'stroke'|'fill', erase, raw, pts, closed, processed, nib, w, color, opacity, cap, fillOn, fill, fillOpacity, d}
  nextId: 1,
  tool: 'draw',
  selId: null,
  multi: [],
  zoom: 1,
  mirror: 'off',       // 'off' | 'v' | 'h'
  shapeKind: 'rect',
  bucket: { color:'#5ac8fa', tolerance:60 },
  ref: { src:null, x:0, y:0, scale:1, opacity:40, visible:true }
};
let undoStack=[], redoStack=[];
const THEME_KEY='iconcraft-theme', AUTOSAVE_KEY='iconcraft-autosave', PROJECTS_KEY='iconcraft-projects';

function defaultInk(){
  return document.documentElement.dataset.theme==='dark' ? '#e8ecf5' : '#1d2333';
}
let pendingStyle=null;  // {w,color,nib,cap,...} para os próximos traços
const NEW_STROKE = () => ({
  w:8, w2:4, color:defaultInk(), opacity:100, cap:'round', nib:'round',
  fillOn:false, fill:'#5ac8fa', fillOpacity:100
});

function toast(msg, err){
  const t=document.createElement('div'); t.className='toast'+(err?' err':''); t.textContent=msg;
  $('toasts').appendChild(t); setTimeout(()=>t.remove(),2800);
}

/* ---------------- Tema ---------------- */
const SUN='M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41.39.39 1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41.39.39 1.03.39 1.41 0l1.06-1.06z';
const MOON='M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z';
function applyTheme(t){
  document.documentElement.dataset.theme=t;
  localStorage.setItem(THEME_KEY,t);
  $('themeIcon').innerHTML='<path d="'+(t==='dark'?SUN:MOON)+'"/>';
  const mt=document.querySelector('meta[name=theme-color]');
  if(mt) mt.content = t==='dark' ? '#12141c' : '#ffffff';
  if(typeof applyBg==='function') applyBg();
}
$('themeBtn').onclick=()=>applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
/* fundo visual do board: barra do preto ao branco (nunca exportado) */
const BG_KEY='iconcraft-bg-level';
function bgLevel(){
  const s=localStorage.getItem(BG_KEY);
  if(s!==null && s!=='') return Math.max(0,Math.min(100,parseInt(s)||0));
  return document.documentElement.dataset.theme==='dark' ? 10 : 97;
}
function applyBg(){
  const l=Math.round(255*bgLevel()/100);
  const b=$('board'); if(b) b.style.background='rgb('+l+','+l+','+l+')';
}

/* ---------------- Utilidades de geometria ---------------- */
function polyPath(pts,closed){
  if(!pts.length) return '';
  let d='M'+pts[0].x.toFixed(2)+' '+pts[0].y.toFixed(2);
  for(let i=1;i<pts.length;i++) d+='L'+pts[i].x.toFixed(2)+' '+pts[i].y.toFixed(2);
  if(closed) d+='Z';
  return d;
}
const NIB_ANGLE={h:0, v:Math.PI/2, d1:Math.PI/4, d2:3*Math.PI/4};
/* fita caligráfica: polígono formado deslocando a linha central pela “pena” */
function ribbonD(pts, w, nib, closed, linear){
  if(pts.length<2) return '';
  const a=NIB_ANGLE[nib]||0;
  const dx=Math.cos(a)*w/2, dy=Math.sin(a)*w/2;
  const seq = closed ? pts.concat([pts[0]]) : pts;
  const up=seq.map(p=>({x:p.x+dx,y:p.y+dy}));
  const dn=seq.map(p=>({x:p.x-dx,y:p.y-dy})).reverse();
  const all=up.concat(dn);
  if(linear || all.length<4){
    let d='M'+all[0].x.toFixed(2)+' '+all[0].y.toFixed(2);
    for(let i=1;i<all.length;i++) d+='L'+all[i].x.toFixed(2)+' '+all[i].y.toFixed(2);
    return d+'Z';
  }
  return catmullPath(all, true, cornerIndices(all, true));
}
function hexToRgb(hex){
  const h=hex.replace('#','');
  const n=parseInt(h.length===3?h.split('').map(c=>c+c).join(''):h,16);
  return [(n>>16)&255,(n>>8)&255,n&255];
}

/* ---------------- Board — camadas ---------------- */
let overlay, underlay, gGrid, gHits, gUi, RES=1024;
function buildBoard(){
  overlay=$('overlay');
  overlay.setAttribute('viewBox','0 0 '+state.size+' '+state.size);
  overlay.innerHTML='';
  underlay=$('underlay');
  underlay.setAttribute('viewBox','0 0 '+state.size+' '+state.size);
  underlay.innerHTML='';
  gGrid=document.createElementNS(SVGNS,'g'); gGrid.setAttribute('pointer-events','none');
  gHits=document.createElementNS(SVGNS,'g');
  gUi=document.createElementNS(SVGNS,'g'); gUi.setAttribute('pointer-events','none');
  overlay.append(gGrid,gHits,gUi);
  RES = state.size<=512 ? state.size*2 : state.size;
  const cv=$('composite'); cv.width=RES; cv.height=RES;
  applyBoardSize(); drawGrid(); applyRef();
  compose(); renderHits();
}
function applyBoardSize(){
  const px=Math.round(Math.min(680,state.size)*state.zoom);
  const b=$('board'); b.style.width=px+'px'; b.style.height=px+'px';
}
function drawGrid(){
  gGrid.innerHTML=''; underlay.innerHTML='';
  if(!state.gridOn) return;
  const host = state.gridAbove ? gGrid : underlay;
  const s=state.gridSpacing, n=state.size;
  let d='';
  for(let p=s;p<n;p+=s) d+='M'+p+' 0V'+n+'M0 '+p+'H'+n;
  const path=document.createElementNS(SVGNS,'path');
  path.setAttribute('d',d);
  path.setAttribute('stroke','#8a8f9f');
  path.setAttribute('stroke-opacity','.4');
  path.setAttribute('stroke-width','1'); path.setAttribute('fill','none');
  path.setAttribute('vector-effect','non-scaling-stroke');
  host.appendChild(path);
  const c=document.createElementNS(SVGNS,'path');
  c.setAttribute('d','M'+(n/2)+' 0V'+n+'M0 '+(n/2)+'H'+n);
  c.setAttribute('stroke','#8a8f9f');
  c.setAttribute('stroke-opacity','.55');
  c.setAttribute('stroke-width','1.8'); c.setAttribute('fill','none');
  c.setAttribute('vector-effect','non-scaling-stroke');
  host.appendChild(c);
}
/* imagem de referência (nunca exportada) */
function applyRef(){
  const img=$('refImg'), r=state.ref;
  if(!r.src || !r.visible){ img.style.display='none'; return; }
  if(img.src!==r.src) img.src=r.src;
  img.style.display='block';
  const px=Math.round(Math.min(680,state.size)*state.zoom);
  const k=px/state.size;
  img.style.opacity=r.opacity/100;
  img.style.transform='translate('+(r.x*k)+'px,'+(r.y*k)+'px) scale('+(r.scale*k)+')';
}

/* ---------------- Motor de composição (camada pixel) ---------------- */
function itemPath2D(it){
  if(it.nib!=='round') return new Path2D(ribbonD(it.pts,it.w,it.nib,it.closed,it.linear));
  return new Path2D(it.d);
}
let scratchCv=null;
function getScratch(){
  if(!scratchCv) scratchCv=document.createElement('canvas');
  scratchCv.width=RES; scratchCv.height=RES; // redefinir também limpa
  return scratchCv;
}
function paintStroke(c, it, uniform){
  c.save();
  if(it.erase) c.globalCompositeOperation='destination-out';
  const p=itemPath2D(it);
  if(it.nib==='round'){
    if(!it.erase && it.fillOn && it.closed){
      c.globalAlpha=it.fillOpacity/100;
      c.fillStyle=it.fill;
      c.fill(p);
    }
    c.globalAlpha=(it.erase||uniform)?1:(it.opacity/100);
    c.strokeStyle=it.erase?'#000':it.color;
    c.lineWidth=it.w;
    c.lineCap=it.cap;
    c.stroke(p);
  } else {
    c.globalAlpha=(it.erase||uniform)?1:(it.opacity/100);
    const col=it.erase?'#000':it.color;
    c.fillStyle=col;
    c.fill(p);
    c.strokeStyle=col;
    c.lineWidth=Math.max(1, it.w2!=null?it.w2:4);
    c.lineCap='round';
    c.stroke(p);
  }
  c.restore();
}
function compose(){
  const cv=$('composite'), ctx=cv.getContext('2d');
  const k=RES/state.size;
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,RES,RES);
  ctx.setTransform(k,0,0,k,0,0);
  ctx.lineJoin='round';
  for(const it of state.items){
    if(it.kind==='fill'){ floodFillOp(ctx,it,k); continue; }
    if(!it.pts || it.pts.length<2) continue;
    if(!it.erase && it.opacity<100){
      // opacidade uniforme: desenha opaco num canvas auxiliar
      // e compõe o elemento inteiro com um único alfa
      const sc=getScratch();
      const sctx=sc.getContext('2d');
      sctx.setTransform(k,0,0,k,0,0);
      sctx.lineJoin='round';
      paintStroke(sctx, it, true);
      ctx.save();
      ctx.setTransform(1,0,0,1,0,0);
      ctx.globalAlpha=it.opacity/100;
      ctx.drawImage(sc,0,0);
      ctx.restore();
    } else {
      paintStroke(ctx, it, false);
    }
  }
}
/* balde: flood fill por varredura, tolerância p/ bordas suavizadas */
function floodFillOp(ctx,op,k){
  const W=RES,H=RES;
  const px=Math.round(op.x*k), py=Math.round(op.y*k);
  if(px<0||py<0||px>=W||py>=H) return;
  const img=ctx.getImageData(0,0,W,H), d=img.data;
  const idx=(py*W+px)*4;
  const t=[d[idx],d[idx+1],d[idx+2],d[idx+3]];
  const [nr,ng,nb]=hexToRgb(op.color);
  const na=Math.round(255*(op.opacity!=null?op.opacity:100)/100);
  if(Math.abs(t[0]-nr)+Math.abs(t[1]-ng)+Math.abs(t[2]-nb)+Math.abs(t[3]-na)<8) return;
  const tol=(state.bucket.tolerance||60);
  const match=i=>{
    const dr=d[i]-t[0],dg=d[i+1]-t[1],db=d[i+2]-t[2],da=d[i+3]-t[3];
    return dr*dr+dg*dg+db*db+da*da <= tol*tol;
  };
  const seen=new Uint8Array(W*H);
  const stack=[[px,py]];
  while(stack.length){
    let [x,y]=stack.pop();
    let i=y*W+x;
    while(x>=0 && match(i*4) && !seen[i]){ x--; i--; }
    x++; i++;
    let up=false, dn=false;
    while(x<W && match(i*4) && !seen[i]){
      seen[i]=1;
      d[i*4]=nr; d[i*4+1]=ng; d[i*4+2]=nb; d[i*4+3]=na;
      if(y>0){ const j=i-W; if(!seen[j]&&match(j*4)){ if(!up){stack.push([x,y-1]);up=true;} } else up=false; }
      if(y<H-1){ const j=i+W; if(!seen[j]&&match(j*4)){ if(!dn){stack.push([x,y+1]);dn=true;} } else dn=false; }
      x++; i++;
    }
  }
  // dilata 2px para cobrir a borda anti-serrilhada e eliminar a fissura clara
  for(let g=0; g<2; g++){
    const add=[];
    for(let y=0;y<H;y++){
      const row=y*W;
      for(let x=0;x<W;x++){
        const i=row+x;
        if(seen[i]) continue;
        if((x>0&&seen[i-1])||(x<W-1&&seen[i+1])||(y>0&&seen[i-W])||(y<H-1&&seen[i+W])) add.push(i);
      }
    }
    for(const i of add){
      seen[i]=1;
      d[i*4]=nr; d[i*4+1]=ng; d[i*4+2]=nb; d[i*4+3]=na;
    }
  }
  ctx.save(); ctx.setTransform(1,0,0,1,0,0);
  ctx.putImageData(img,0,0);
  ctx.restore();
}
/* ============================================================
   ALGORITMOS — suavização, simplificação, cantos, simetria
   ============================================================ */
function resample(pts, spacing){
  if(pts.length<2) return pts.map(p=>({...p}));
  const out=[{...pts[0]}];
  let prev={...pts[0]};
  for(let i=1;i<pts.length;i++){
    let b=pts[i];
    let dist=Math.hypot(b.x-prev.x,b.y-prev.y);
    while(dist>=spacing){
      const t=spacing/dist;
      prev={x:prev.x+(b.x-prev.x)*t, y:prev.y+(b.y-prev.y)*t};
      out.push({...prev});
      dist=Math.hypot(b.x-prev.x,b.y-prev.y);
    }
  }
  const last=pts[pts.length-1], tail=out[out.length-1];
  if(Math.hypot(last.x-tail.x,last.y-tail.y)>spacing*0.35) out.push({...last});
  return out;
}
function smoothPts(pts, win, passes, closed){
  let p=pts.map(q=>({...q}));
  for(let k=0;k<passes;k++){
    const q=p.map((pt,i)=>{
      let sx=0,sy=0,n=0;
      for(let j=-win;j<=win;j++){
        let idx=i+j;
        if(closed) idx=(idx+p.length)%p.length;
        else if(idx<0||idx>=p.length) continue;
        sx+=p[idx].x; sy+=p[idx].y; n++;
      }
      return {x:sx/n,y:sy/n};
    });
    if(!closed){ q[0]={...p[0]}; q[q.length-1]={...p[p.length-1]}; }
    p=q;
  }
  return p;
}
function rdp(pts, eps){
  if(pts.length<3) return pts.map(p=>({...p}));
  const keep=new Array(pts.length).fill(false);
  keep[0]=keep[pts.length-1]=true;
  const stack=[[0,pts.length-1]];
  while(stack.length){
    const [a,b]=stack.pop();
    let maxD=0, idx=-1;
    const A=pts[a], B=pts[b];
    const dx=B.x-A.x, dy=B.y-A.y, len=Math.hypot(dx,dy)||1e-9;
    for(let i=a+1;i<b;i++){
      const dd=Math.abs(dy*pts[i].x - dx*pts[i].y + B.x*A.y - B.y*A.x)/len;
      if(dd>maxD){maxD=dd;idx=i;}
    }
    if(maxD>eps && idx>0){ keep[idx]=true; stack.push([a,idx],[idx,b]); }
  }
  return pts.filter((_,i)=>keep[i]).map(p=>({...p}));
}
function cornerIndices(pts, closed){
  const res=new Set(), n=pts.length;
  if(n<3) return res;
  const lim=closed?n:n-1;
  for(let i=(closed?0:1); i<lim; i++){
    const a=pts[(i-1+n)%n], b=pts[i], c=pts[(i+1)%n];
    const v1x=b.x-a.x, v1y=b.y-a.y, v2x=c.x-b.x, v2y=c.y-b.y;
    const l1=Math.hypot(v1x,v1y)||1e-9, l2=Math.hypot(v2x,v2y)||1e-9;
    const cos=(v1x*v2x+v1y*v2y)/(l1*l2);
    const ang=Math.acos(Math.max(-1,Math.min(1,cos)))*180/Math.PI;
    if(ang>52) res.add(i);
  }
  return res;
}
function smoothPath(pts, closed, corners){
  const n=pts.length;
  if(n<2) return '';
  if(n===2) return polyPath(pts,false);
  const isC=i=>corners.has(((i%n)+n)%n);
  const P=i=>pts[((i%n)+n)%n];
  const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  const f=v=>v.toFixed(2);
  let d='';
  if(!closed){
    d='M'+f(pts[0].x)+' '+f(pts[0].y);
    d+='L'+f(mid(pts[0],pts[1]).x)+' '+f(mid(pts[0],pts[1]).y);
    for(let i=1;i<n-1;i++){
      const m=mid(pts[i],pts[i+1]);
      if(isC(i)) d+='L'+f(pts[i].x)+' '+f(pts[i].y)+'L'+f(m.x)+' '+f(m.y);
      else d+='Q'+f(pts[i].x)+' '+f(pts[i].y)+' '+f(m.x)+' '+f(m.y);
    }
    d+='L'+f(pts[n-1].x)+' '+f(pts[n-1].y);
  } else {
    const m0=mid(P(0),P(1));
    d='M'+f(m0.x)+' '+f(m0.y);
    for(let i=1;i<=n;i++){
      const m=mid(P(i),P(i+1));
      if(isC(i)) d+='L'+f(P(i).x)+' '+f(P(i).y)+'L'+f(m.x)+' '+f(m.y);
      else d+='Q'+f(P(i).x)+' '+f(P(i).y)+' '+f(m.x)+' '+f(m.y);
    }
    d+='Z';
  }
  return d;
}
/* corte de cantos (Chaikin) — arredonda quinas preservando as extremidades */
function chaikin(pts, closed, passes){
  let p=pts;
  for(let k=0;k<passes;k++){
    const n=p.length;
    if(n<3) return p;
    const out=[];
    if(!closed) out.push({...p[0]});
    const segs=closed?n:n-1;
    for(let i=0;i<segs;i++){
      const a=p[i], b=p[(i+1)%n];
      out.push({x:a.x*0.75+b.x*0.25, y:a.y*0.75+b.y*0.25});
      out.push({x:a.x*0.25+b.x*0.75, y:a.y*0.25+b.y*0.75});
    }
    if(!closed) out.push({...p[n-1]});
    p=out;
  }
  return p;
}
/* spline que passa exatamente pelos pontos — preserva a estrutura do desenho */
function catmullPath(pts, closed, corners){
  const n=pts.length;
  if(n<2) return '';
  if(n===2) return polyPath(pts,false);
  const f=v=>v.toFixed(2);
  const isC=i=>corners.has(((i%n)+n)%n);
  const P=i=>pts[((i%n)+n)%n];
  const seg=(p0,p1,p2,p3)=>{
    const c1={x:p1.x+(p2.x-p0.x)/6, y:p1.y+(p2.y-p0.y)/6};
    const c2={x:p2.x-(p3.x-p1.x)/6, y:p2.y-(p3.y-p1.y)/6};
    return 'C'+f(c1.x)+' '+f(c1.y)+' '+f(c2.x)+' '+f(c2.y)+' '+f(p2.x)+' '+f(p2.y);
  };
  let d='M'+f(pts[0].x)+' '+f(pts[0].y);
  const segs = closed ? n : n-1;
  for(let i=0;i<segs;i++){
    const p1=P(i), p2=P(i+1);
    const p0 = ((!closed && i===0) || isC(i)) ? p1 : P(i-1);
    const p3 = ((!closed && i===segs-1) || isC(i+1)) ? p2 : P(i+2);
    d+=seg(p0,p1,p2,p3);
  }
  if(closed) d+='Z';
  return d;
}
function pathLen(pts){
  let L=0;
  for(let i=1;i<pts.length;i++) L+=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y);
  return L;
}
function isNearLine(pts){
  if(pts.length<3) return true;
  const A=pts[0], B=pts[pts.length-1];
  const dx=B.x-A.x, dy=B.y-A.y, len=Math.hypot(dx,dy);
  if(len<4) return false;
  let maxD=0;
  for(const p of pts){
    const dd=Math.abs(dy*p.x - dx*p.y + B.x*A.y - B.y*A.x)/len;
    if(dd>maxD) maxD=dd;
  }
  return maxD < Math.max(2.5, len*0.02);
}
function mirrorNib(n){ return n==='d1' ? 'd2' : (n==='d2' ? 'd1' : n); }
function syncTwin(it){
  if(!it || !it.link) return;
  const tw=state.items.find(x=>x.id===it.link.id && x.kind==='stroke');
  if(!tw){ it.link=null; return; }
  const c=state.size/2;
  const refl = it.link.axis==='v' ? p=>({x:2*c-p.x,y:p.y}) : p=>({x:p.x,y:2*c-p.y});
  tw.pts=it.pts.map(refl).reverse();
  tw.closed=it.closed; tw.processed=it.processed;
  tw.linear=it.linear;
  tw.w=it.w; tw.w2=it.w2; tw.color=it.color; tw.opacity=it.opacity;
  tw.cap=it.cap; tw.nib=mirrorNib(it.nib);
  tw.fillOn=it.fillOn; tw.fill=it.fill; tw.fillOpacity=it.fillOpacity;
  rebuildPath(tw);
}
function rebuildPath(it){
  if(it.kind!=='stroke') return;
  if(!it.processed){ it.d=polyPath(it.pts,false); return; }
  if(it.linear){ it.d=polyPath(it.pts, it.closed); return; }
  if(it.pts.length===2){ it.d=polyPath(it.pts,false); return; }
  it.d=catmullPath(it.pts, it.closed, cornerIndices(it.pts,it.closed));
}
function processStroke(s, level){
  const t = level==null ? 0.5 : Math.max(0, Math.min(1, level));
  s.linear=false;
  const wasProcessed = s.processed && s.pts && s.pts.length>1;
  const base = wasProcessed ? (s.closed ? s.pts.concat([s.pts[0]]) : s.pts) : s.raw;
  let pts=resample(base, Math.max(1.5, state.size/300));
  const L=pathLen(pts);
  let closed;
  if(wasProcessed){ closed=s.closed; }
  else {
    const closeGap=Math.hypot(pts[0].x-pts[pts.length-1].x, pts[0].y-pts[pts.length-1].y);
    closed = pts.length>8 && closeGap < Math.max(12, L*0.09);
  }
  const win=1+Math.round(t*2), passes=(t>0.66?2:1);
  pts=smoothPts(pts, win, passes, closed);
  if(isNearLine(pts) && !closed){
    s.pts=[pts[0], pts[pts.length-1]];
    s.closed=false; s.processed=true; rebuildPath(s);
    return;
  }
  let simp=rdp(pts, Math.max(0.8, state.size/900 + t*(state.size/160)));
  if(closed && simp.length>3){
    const g=Math.hypot(simp[0].x-simp[simp.length-1].x, simp[0].y-simp[simp.length-1].y);
    if(g < Math.max(12,L*0.09)) simp=simp.slice(0,-1);
  }
  if(t>0.55) simp=chaikin(simp, closed, t>0.85 ? 2 : 1);
  s.pts=simp; s.closed=closed; s.processed=true;
  rebuildPath(s);
}
function strokeItems(){ return state.items.filter(i=>i.kind==='stroke'); }
function symmetryScore(strokes, axis){
  let minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9;
  const cloud=[];
  for(const s of strokes){
    if(!s.pts||s.pts.length<2) continue;
    const rs=resample(s.pts, Math.max(2,state.size/200));
    for(const p of rs){
      cloud.push(p);
      if(p.x<minX)minX=p.x; if(p.x>maxX)maxX=p.x;
      if(p.y<minY)minY=p.y; if(p.y>maxY)maxY=p.y;
    }
  }
  if(cloud.length<4) return 1e9;
  const cx=(minX+maxX)/2, cy=(minY+maxY)/2;
  const diag=Math.hypot(maxX-minX,maxY-minY)||1;
  const refl = axis==='v' ? p=>({x:2*cx-p.x,y:p.y}) : p=>({x:p.x,y:2*cy-p.y});
  let sum=0, n=0;
  const step=Math.max(1, Math.floor(cloud.length/240));
  for(let i=0;i<cloud.length;i+=step){
    const r=refl(cloud[i]);
    let bd=1e18;
    for(const c of cloud){
      const d=(c.x-r.x)*(c.x-r.x)+(c.y-r.y)*(c.y-r.y);
      if(d<bd) bd=d;
    }
    sum+=Math.sqrt(bd); n++;
  }
  return (sum/n)/diag;
}
function symmetrize(axis, targets){
  const strokes=(targets&&targets.length?targets:strokeItems()).filter(s=>s.pts&&s.pts.length>1);
  if(!strokes.length) return;
  let minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9;
  for(const s of strokes) for(const p of s.pts){
    if(p.x<minX)minX=p.x; if(p.x>maxX)maxX=p.x;
    if(p.y<minY)minY=p.y; if(p.y>maxY)maxY=p.y;
  }
  const cx=(minX+maxX)/2, cy=(minY+maxY)/2;
  const diag=Math.hypot(maxX-minX,maxY-minY)||1;
  const guard=diag*0.12;
  const reflect = axis==='v' ? p=>({x:2*cx-p.x,y:p.y}) : p=>({x:p.x,y:2*cy-p.y});
  const cloudOf=()=>{
    const cloud=[];
    for(const s of strokes){
      const rs=resample(s.pts.length>1?s.pts:s.raw, Math.max(2,state.size/260));
      for(const p of rs) cloud.push(p);
    }
    return cloud;
  };
  const nearest=(cloud,q)=>{
    let best=null,bd=1e18;
    for(const c of cloud){
      const dd=(c.x-q.x)*(c.x-q.x)+(c.y-q.y)*(c.y-q.y);
      if(dd<bd){bd=dd;best=c;}
    }
    return {p:best,d:Math.sqrt(bd)};
  };
  for(let it=0; it<2; it++){
    const cloud=cloudOf();
    for(const s of strokes){
      s.pts=s.pts.map(p=>{
        const r=reflect(p);
        const {p:q,d}=nearest(cloud,r);
        if(!q || d>guard) return p;
        const m=reflect(q);
        return {x:(p.x+m.x)/2, y:(p.y+m.y)/2};
      });
    }
  }
  for(const s of strokes){
    const sm=smoothPts(s.pts, 1, 1, s.closed);
    s.pts=rdp(sm, Math.max(0.8, state.size/700));
    rebuildPath(s);
  }
}

/* ============================================================
   DESENHO — caneta, pincel negativo, forma, espelho ao vivo
   ============================================================ */
let drawing=null, liveA=null, liveB=null, pendingShapePts=null, shaping=null;
function previewD(pts,closed){
  return pts.length===2 ? polyPath(pts,false) : catmullPath(pts,closed,cornerIndices(pts,closed));
}
function makeShapeLive(isMirror){
  const el=document.createElementNS(SVGNS,'path');
  el.setAttribute('fill','none');
  el.setAttribute('stroke',pendingStyle.color);
  el.setAttribute('stroke-width',Math.max(2, pendingStyle.nib==='round'?pendingStyle.w:(pendingStyle.w2||4)));
  el.setAttribute('stroke-linejoin','round');
  el.setAttribute('stroke-dasharray','6 5');
  if(isMirror) el.classList.add('mirror-live');
  gUi.appendChild(el);
  return el;
}
function boardPoint(e){
  const r=overlay.getBoundingClientRect();
  return {
    x:(e.clientX-r.left)/r.width*state.size,
    y:(e.clientY-r.top)/r.height*state.size
  };
}
function mirrorPoint(p){
  const c=state.size/2;
  return state.mirror==='v' ? {x:2*c-p.x,y:p.y} : {x:p.x,y:2*c-p.y};
}
function makeLive(erase){
  const nib=pendingStyle.nib;
  const el=document.createElementNS(SVGNS, nib==='round' ? 'polyline' : 'path');
  const col=erase ? 'var(--danger)' : pendingStyle.color;
  if(nib==='round'){
    el.setAttribute('fill','none');
    el.setAttribute('stroke',col);
    el.setAttribute('stroke-width',pendingStyle.w);
    el.setAttribute('stroke-linecap','round');
    el.setAttribute('stroke-linejoin','round');
    if(erase) el.setAttribute('stroke-dasharray','7 5');
  } else {
    el.setAttribute('fill',col);
    el.setAttribute('stroke',col);
    el.setAttribute('stroke-width',Math.max(1,pendingStyle.w2||4));
    el.setAttribute('stroke-linecap','round');
    el.setAttribute('stroke-linejoin','round');
    if(erase) el.setAttribute('opacity','.55');
  }
  gUi.appendChild(el);
  return el;
}
function updateLive(el, pts){
  if(pendingStyle.nib==='round')
    el.setAttribute('points', pts.map(q=>q.x.toFixed(1)+','+q.y.toFixed(1)).join(' '));
  else
    el.setAttribute('d', ribbonD(pts, pendingStyle.w, pendingStyle.nib, false));
}
function newStrokeItem(pts, erase){
  const s={
    id:state.nextId++, kind:'stroke', erase:!!erase,
    raw:pts.map(p=>({x:+p.x.toFixed(2),y:+p.y.toFixed(2)})),
    pts:null, closed:false, processed:false, d:null,
    ...pendingStyle
  };
  if(erase){ s.fillOn=false; }
  s.pts=s.raw.map(p=>({...p}));
  s.d=polyPath(s.pts,false);
  return s;
}
function attachDrawEvents(){
  const board=$('board');
  board.addEventListener('pointerdown',e=>{
    if(state.tool==='ref' && e.target.id==='refImg'){ startRefDrag(e); return; }
    const t=state.tool;
    if(t==='bucket'){ doBucket(e); return; }
    if(t==='shape'){
      if(e.button!==undefined && e.button!==0) return;
      board.setPointerCapture(e.pointerId);
      const p=boardPoint(e);
      shaping={a:p,b:p};
      liveA=makeShapeLive(false);
      if(state.mirror!=='off') liveB=makeShapeLive(true);
      e.preventDefault(); return;
    }
    if(t!=='draw' && t!=='erase') return;
    if(e.button!==undefined && e.button!==0) return;
    board.setPointerCapture(e.pointerId);
    drawing={pts:[boardPoint(e)], mode:t};
    liveA=makeLive(t==='erase');
    if(state.mirror!=='off'){ liveB=makeLive(t==='erase'); liveB.classList.add('mirror-live'); }
    e.preventDefault();
  });
  board.addEventListener('pointermove',e=>{
    if(shaping){
      shaping.b=boardPoint(e);
      const {pts,closed}=fitShape(state.shapeKind,[shaping.a,shaping.b]);
      liveA.setAttribute('d', previewD(pts,closed));
      if(liveB) liveB.setAttribute('d', previewD(pts.map(mirrorPoint),closed));
      return;
    }
    if(!drawing) return;
    const p=boardPoint(e);
    const last=drawing.pts[drawing.pts.length-1];
    if(Math.hypot(p.x-last.x,p.y-last.y)>1.2){
      drawing.pts.push(p);
      updateLive(liveA, drawing.pts);
      if(liveB) updateLive(liveB, drawing.pts.map(mirrorPoint));
    }
  });
  const finish=()=>{
    if(shaping){
      if(liveA){liveA.remove();liveA=null;}
      if(liveB){liveB.remove();liveB=null;}
      const {a,b}=shaping; shaping=null;
      if(Math.abs(b.x-a.x)<4 && Math.abs(b.y-a.y)<4) return;
      pushUndo();
      const fit=fitShape(state.shapeKind,[a,b]);
      const s={id:state.nextId++, kind:'stroke', erase:false,
        raw:fit.pts.map(p=>({...p})), pts:fit.pts.map(p=>({...p})),
        closed:fit.closed, processed:true, d:null, ...pendingStyle};
      rebuildPath(s);
      state.items.push(s);
      if(state.mirror!=='off'){
        const m=JSON.parse(JSON.stringify(s)); m.id=state.nextId++;
        m.pts=m.pts.map(mirrorPoint).reverse(); m.raw=m.raw.map(mirrorPoint).reverse();
        m.nib=mirrorNib(s.nib);
        rebuildPath(m);
        s.link={id:m.id,axis:state.mirror}; m.link={id:s.id,axis:state.mirror};
        state.items.push(m);
      }
      state.selId=s.id;
      compose(); renderHits(); renderPanel(); autosave();
      return;
    }
    if(!drawing) return;
    if(liveA){liveA.remove();liveA=null;}
    if(liveB){liveB.remove();liveB=null;}
    const {pts,mode}=drawing; drawing=null;
    if(pts.length<3) return;
    pushUndo();
    const s=newStrokeItem(pts, mode==='erase');
    state.items.push(s);
    if(state.mirror!=='off'){
      const m=JSON.parse(JSON.stringify(s));
      m.id=state.nextId++;
      m.raw=m.raw.map(mirrorPoint).reverse();
      m.pts=m.raw.map(p=>({...p}));
      m.d=polyPath(m.pts,false);
      m.nib=mirrorNib(s.nib);
      s.link={id:m.id,axis:state.mirror};
      m.link={id:s.id,axis:state.mirror};
      state.items.push(m);
    }
    compose(); renderHits(); autosave();
  };
  board.addEventListener('pointerup',finish);
  board.addEventListener('pointercancel',finish);
}
/* --------- formas geométricas encaixadas no rascunho --------- */
function fitShape(kind, rough){
  let minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9;
  for(const p of rough){
    if(p.x<minX)minX=p.x; if(p.x>maxX)maxX=p.x;
    if(p.y<minY)minY=p.y; if(p.y>maxY)maxY=p.y;
  }
  const w=maxX-minX, h=maxY-minY, cx=(minX+maxX)/2, cy=(minY+maxY)/2;
  const pts=[];
  const sample=(fn,n)=>{ for(let i=0;i<n;i++) pts.push(fn(i/n)); };
  let closed=true;
  if(kind==='circle'){
    const r=(w+h)/4;
    sample(t=>({x:cx+r*Math.cos(t*2*Math.PI-Math.PI/2), y:cy+r*Math.sin(t*2*Math.PI-Math.PI/2)}),48);
  } else if(kind==='ellipse'){
    sample(t=>({x:cx+(w/2)*Math.cos(t*2*Math.PI-Math.PI/2), y:cy+(h/2)*Math.sin(t*2*Math.PI-Math.PI/2)}),48);
  } else if(kind==='rect'){
    pts.push({x:minX,y:minY},{x:maxX,y:minY},{x:maxX,y:maxY},{x:minX,y:maxY});
  } else if(kind==='rrect'){
    const r=Math.min(w,h)*0.22;
    const cornersDef=[
      [maxX-r,minY+r,-Math.PI/2,0],[maxX-r,maxY-r,0,Math.PI/2],
      [minX+r,maxY-r,Math.PI/2,Math.PI],[minX+r,minY+r,Math.PI,1.5*Math.PI]
    ];
    for(const [ax,ay,a0,a1] of cornersDef)
      for(let i=0;i<=6;i++){
        const a=a0+(a1-a0)*i/6;
        pts.push({x:ax+r*Math.cos(a),y:ay+r*Math.sin(a)});
      }
  } else if(kind==='triangle'){
    pts.push({x:cx,y:minY},{x:maxX,y:maxY},{x:minX,y:maxY});
  } else if(kind==='line'){
    closed=false;
    let A=rough[0], B=rough[rough.length-1];
    const dx=Math.abs(B.x-A.x), dy=Math.abs(B.y-A.y);
    if(dx>dy*3){ A={x:minX,y:cy}; B={x:maxX,y:cy}; }
    else if(dy>dx*3){ A={x:cx,y:minY}; B={x:cx,y:maxY}; }
    pts.push({x:A.x,y:A.y},{x:B.x,y:B.y});
  }
  return {pts,closed};
}
const SHAPE_DEFS=[
  ['circle','Círculo','<circle cx="15" cy="15" r="10"/>'],
  ['ellipse','Oval','<ellipse cx="15" cy="15" rx="12" ry="7"/>'],
  ['rect','Retângulo','<rect x="4" y="7" width="22" height="16" rx="1"/>'],
  ['rrect','Arredondado','<rect x="4" y="7" width="22" height="16" rx="5"/>'],
  ['triangle','Triângulo','<path d="M15 5l11 20H4z"/>'],
  ['line','Linha','<path d="M5 25L25 5"/>']
];
function detectShape(s){
  const base = s.processed && s.pts && s.pts.length>1 ? (s.closed?s.pts.concat([s.pts[0]]):s.pts) : s.raw;
  let pts=resample(base, Math.max(2, state.size/220));
  if(pts.length<3) return 'line';
  pts=smoothPts(pts,2,1,false);
  const L=pathLen(pts);
  const gap=Math.hypot(pts[0].x-pts[pts.length-1].x, pts[0].y-pts[pts.length-1].y);
  const closed=(s.processed&&s.closed) || (pts.length>8 && gap<Math.max(14, L*0.12));
  if(!closed) return isNearLine(pts) ? 'line' : null;
  let minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9;
  for(const p of pts){ if(p.x<minX)minX=p.x; if(p.x>maxX)maxX=p.x; if(p.y<minY)minY=p.y; if(p.y>maxY)maxY=p.y; }
  const w=maxX-minX, h=maxY-minY, diag=Math.hypot(w,h)||1;
  const cx=(minX+maxX)/2, cy=(minY+maxY)/2, rx=Math.max(1,w/2), ry=Math.max(1,h/2);
  let err=0;
  for(const p of pts) err+=Math.abs(Math.hypot((p.x-cx)/rx,(p.y-cy)/ry)-1);
  err/=pts.length;
  let simp=rdp(pts, diag*0.045);
  if(simp.length>2){
    const g2=Math.hypot(simp[0].x-simp[simp.length-1].x, simp[0].y-simp[simp.length-1].y);
    if(g2<diag*0.1) simp=simp.slice(0,-1);
  }
  const corners=simp.length;
  if(err<0.13) return (Math.abs(w-h)/Math.max(w,h)<0.18) ? 'circle' : 'ellipse';
  if(corners===3) return 'triangle';
  let area=0;
  for(let i=0;i<simp.length;i++){
    const a=simp[i], b=simp[(i+1)%simp.length];
    area+=a.x*b.y-b.x*a.y;
  }
  area=Math.abs(area)/2;
  if(corners>=4 && corners<=6 && area/Math.max(1,w*h)>0.72) return 'rect';
  if(err<0.2) return (Math.abs(w-h)/Math.max(w,h)<0.18) ? 'circle' : 'ellipse';
  return null;
}
function applyShapeInterpretation(){
  const ids=(pendingTargets||[]).slice(); pendingTargets=null;
  const tgt=state.items.filter(i=>i.kind==='stroke' && ids.includes(i.id));
  if(!tgt.length) return;
  pushUndo();
  let conv=0;
  for(const s of tgt){
    const kind=detectShape(s);
    if(kind){
      const srcPts=resample(
        s.processed && s.pts.length>1 ? (s.closed?s.pts.concat([s.pts[0]]):s.pts) : s.raw,
        Math.max(2, state.size/220));
      const fit=fitShape(kind, srcPts);
      s.pts=fit.pts.map(p=>({...p})); s.closed=fit.closed; s.processed=true;
      rebuildPath(s); conv++;
    } else {
      processStroke(s, 0.5);
    }
  }
  for(const s of tgt) if(s.link && ids.includes(s.link.id)) syncTwin(s);
  compose(); renderHits(); renderPanel(); autosave();
  toast(conv ? conv+' traço(s) convertido(s) em forma geométrica.' : 'Nenhuma forma reconhecida — traços apenas suavizados.');
}
/* --------- espelho ao vivo --------- */
$('btnMirror').onclick=()=>{
  state.mirror = state.mirror==='off' ? 'v' : (state.mirror==='v' ? 'h' : 'off');
  $('mirrorLbl').textContent = 'Espelho: ' + (state.mirror==='off'?'off':(state.mirror==='v'?'↔ vertical':'↕ horizontal'));
  $('btnMirror').classList.toggle('primary', state.mirror!=='off');
  toast(state.mirror==='off' ? 'Espelho ao vivo desligado.' :
    'Espelho ao vivo: desenhe de um lado e o outro replica em tempo real.');
};
/* --------- balde --------- */
function doBucket(e){
  const p=boardPoint(e);
  pushUndo();
  state.items.push({id:state.nextId++, kind:'fill', x:+p.x.toFixed(1), y:+p.y.toFixed(1),
    color:state.bucket.color, opacity:100});
  if(state.mirror!=='off'){
    const m=mirrorPoint(p);
    state.items.push({id:state.nextId++, kind:'fill', x:+m.x.toFixed(1), y:+m.y.toFixed(1),
      color:state.bucket.color, opacity:100});
  }
  compose(); renderPanel(); autosave();
}
/* ============================================================
   SELEÇÃO, NÓS, REFERÊNCIA, PROCESSAMENTO, UNDO
   ============================================================ */
function selItem(){ return state.items.find(i=>i.id===state.selId); }
function setSelection(ids){
  ids=[...new Set(ids)].filter(id=>state.items.some(i=>i.id===id && i.kind==='stroke'));
  if(ids.length<=1){ state.selId = ids.length ? ids[0] : null; state.multi=[]; }
  else { state.selId=null; state.multi=ids; }
}
function renderHits(){
  gHits.innerHTML='';
  for(const it of state.items){
    if(it.kind!=='stroke' || !it.d) continue;
    const hit=document.createElementNS(SVGNS,'path');
    hit.setAttribute('d',it.d);
    hit.setAttribute('fill', it.closed ? 'rgba(0,0,0,0)' : 'none');
    hit.setAttribute('stroke','transparent');
    hit.setAttribute('stroke-width',Math.max(14,it.w+8));
    hit.style.cursor='pointer';
    hit.addEventListener('pointerdown',e=>{
      if(state.tool==='draw'||state.tool==='erase'||state.tool==='shape'||state.tool==='bucket'||state.tool==='ref') return;
      e.stopPropagation();
      if(state.tool==='select' && e.shiftKey){
        const base = state.multi.length ? state.multi.slice() : (state.selId!=null ? [state.selId] : []);
        const at=base.indexOf(it.id);
        if(at>=0) base.splice(at,1); else base.push(it.id);
        setSelection(base);
        renderUi(); renderPanel();
        if(smoothSession) smoothRetarget();
        return;
      }
      if(state.tool==='select' && state.multi.length>1 && state.multi.includes(it.id)){
        startGroupMove(e);
        return;
      }
      setSelection([it.id]);
      if(smoothSession){ smoothRetarget(); renderPanel(); return; }
      if(state.tool==='nodes'){ ensureEditableNodes(it); compose(); }
      if(state.tool==='select') startMoveDrag(it,e);
      renderUi(); renderPanel();
    });
    hit.addEventListener('dblclick',e=>{
      if(state.tool!=='nodes' || state.selId!==it.id) return;
      e.stopPropagation();
      addNodeAt(it, boardPoint(e));
    });
    gHits.appendChild(hit);
  }
  renderUi();
}
function renderUi(){
  gUi.innerHTML='';
  if(state.multi && state.multi.length>1){
    const members=state.items.filter(i=>i.kind==='stroke' && state.multi.includes(i.id));
    if(members.length>1){
      let X0=1e9,Y0=1e9,X1=-1e9,Y1=-1e9;
      for(const m of members){
        const o=document.createElementNS(SVGNS,'path');
        o.setAttribute('d', m.nib==='round' ? m.d : ribbonD(m.pts,m.w,m.nib,m.closed,m.linear));
        o.setAttribute('class','sel-outline');
        o.setAttribute('vector-effect','non-scaling-stroke');
        gUi.appendChild(o);
        const bb=ptsBBox(m.pts);
        X0=Math.min(X0,bb.x0); Y0=Math.min(Y0,bb.y0);
        X1=Math.max(X1,bb.x1); Y1=Math.max(Y1,bb.y1);
      }
      const box=document.createElementNS(SVGNS,'rect');
      box.setAttribute('x',X0-4); box.setAttribute('y',Y0-4);
      box.setAttribute('width',Math.max(0.1,X1-X0+8)); box.setAttribute('height',Math.max(0.1,Y1-Y0+8));
      box.setAttribute('class','sel-bbox');
      box.setAttribute('vector-effect','non-scaling-stroke');
      gUi.appendChild(box);
      return;
    }
    state.multi=[];
  }
  const it=selItem();
  if(!it || it.kind!=='stroke') return;
  const o=document.createElementNS(SVGNS,'path');
  o.setAttribute('d', it.nib==='round' ? it.d : ribbonD(it.pts,it.w,it.nib,it.closed,it.linear));
  o.setAttribute('class','sel-outline');
  o.setAttribute('vector-effect','non-scaling-stroke');
  gUi.appendChild(o);
  if(state.tool==='nodes') renderNodes(it);
  if(state.tool==='select') renderTransformHandles(it);
}
function ensureEditableNodes(it){
  if(!it || it.kind!=='stroke') return;
  if(!it.processed || it.pts.length>40) processStroke(it, 0.5);
  let eps=Math.max(2, state.size/140);
  const min=it.closed?3:2;
  while(it.pts.length>26 && eps<state.size/6){
    const simp=rdp(it.pts, eps);
    if(simp.length>=min) it.pts=simp;
    eps*=1.5;
  }
  rebuildPath(it); syncTwin(it);
}
function addNodeAt(it,p){
  pushUndo();
  let best=0,bd=1e18;
  const n=it.pts.length, segs=it.closed?n:n-1;
  for(let i=0;i<segs;i++){
    const a=it.pts[i], b=it.pts[(i+1)%n];
    const abx=b.x-a.x, aby=b.y-a.y;
    const tt=Math.max(0,Math.min(1,((p.x-a.x)*abx+(p.y-a.y)*aby)/((abx*abx+aby*aby)||1e-9)));
    const qx=a.x+abx*tt, qy=a.y+aby*tt;
    const d=(p.x-qx)*(p.x-qx)+(p.y-qy)*(p.y-qy);
    if(d<bd){bd=d;best=i;}
  }
  const a=it.pts[best], b=it.pts[(best+1)%n];
  it.pts.splice(best+1,0,{x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  rebuildPath(it); syncTwin(it);
  compose(); renderHits(); renderPanel(); autosave();
}
function doubleNodes(it){
  if(it.pts.length>=160){ toast('Limite de nós atingido.'); return; }
  pushUndo();
  const n=it.pts.length, segs=it.closed?n:n-1, out=[];
  for(let i=0;i<n;i++){
    out.push(it.pts[i]);
    if(i<segs){
      const b=it.pts[(i+1)%n];
      out.push({x:(it.pts[i].x+b.x)/2,y:(it.pts[i].y+b.y)/2});
    }
  }
  it.pts=out;
  rebuildPath(it); syncTwin(it);
  compose(); renderHits(); renderPanel(); autosave();
}
function halveNodes(it){
  const min=it.closed?3:2;
  if(it.pts.length<=min){ toast('Mínimo de nós atingido.'); return; }
  pushUndo();
  const target=Math.max(min, Math.ceil(it.pts.length/2));
  let eps=Math.max(1, state.size/500), simp=it.pts;
  while(simp.length>target && eps<state.size/4){
    const s2=rdp(it.pts, eps);
    if(s2.length>=min) simp=s2;
    eps*=1.4;
  }
  if(simp.length===it.pts.length)
    simp=it.pts.filter((_,i)=>i%2===0 || i===it.pts.length-1);
  it.pts=simp;
  rebuildPath(it); syncTwin(it);
  compose(); renderHits(); renderPanel(); autosave();
}
function renderNodes(it){
  const rNode=Math.max(4, state.size/110);
  it.pts.forEach((p,i)=>{
    const c=document.createElementNS(SVGNS,'circle');
    c.setAttribute('cx',p.x); c.setAttribute('cy',p.y); c.setAttribute('r',rNode);
    c.setAttribute('class','node');
    c.setAttribute('pointer-events','auto');
    c.setAttribute('vector-effect','non-scaling-stroke');
    c.addEventListener('pointerdown',e=>{
      e.stopPropagation(); e.preventDefault();
      startNodeDrag(it,i,e,c);
    });
    c.addEventListener('dblclick',e=>{
      e.stopPropagation();
      if(it.pts.length<=(it.closed?3:2)){ toast('O traço precisa de pelo menos '+(it.closed?3:2)+' pontos.'); return; }
      pushUndo();
      it.pts.splice(i,1); rebuildPath(it); syncTwin(it);
      compose(); renderHits(); renderPanel(); autosave();
    });
    gUi.appendChild(c);
  });
}
let nodeRAF=null;
function startNodeDrag(it,i,ev,circle){
  const move=e=>{
    const p=boardPoint(e);
    it.pts[i]={x:p.x,y:p.y};
    circle.setAttribute('cx',p.x); circle.setAttribute('cy',p.y);
    rebuildPath(it); syncTwin(it);
    if(!nodeRAF) nodeRAF=requestAnimationFrame(()=>{ nodeRAF=null; compose(); 
      const o=gUi.querySelector('.sel-outline');
      if(o) o.setAttribute('d', it.nib==='round' ? it.d : ribbonD(it.pts,it.w,it.nib,it.closed,it.linear));
    });
  };
  const up=()=>{
    document.removeEventListener('pointermove',move);
    document.removeEventListener('pointerup',up);
    compose(); renderHits(); autosave();
  };
  document.addEventListener('pointermove',move);
  document.addEventListener('pointerup',up);
  pushUndo();
}
/* --------- redimensionar e girar --------- */
function ptsBBox(pts){
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const p of pts){ if(p.x<x0)x0=p.x; if(p.x>x1)x1=p.x; if(p.y<y0)y0=p.y; if(p.y>y1)y1=p.y; }
  return {x0,y0,x1,y1,cx:(x0+x1)/2,cy:(y0+y1)/2,w:x1-x0,h:y1-y0};
}
function renderTransformHandles(it){
  const bb=ptsBBox(it.pts);
  const mk=t=>document.createElementNS(SVGNS,t);
  const box=mk('rect');
  box.setAttribute('x',bb.x0); box.setAttribute('y',bb.y0);
  box.setAttribute('width',Math.max(0.1,bb.w)); box.setAttribute('height',Math.max(0.1,bb.h));
  box.setAttribute('class','sel-bbox');
  box.setAttribute('vector-effect','non-scaling-stroke');
  gUi.appendChild(box);
  const hs=Math.max(5, state.size/85);
  const HP={
    nw:[bb.x0,bb.y0,'nwse-resize'], n:[bb.cx,bb.y0,'ns-resize'], ne:[bb.x1,bb.y0,'nesw-resize'],
    e:[bb.x1,bb.cy,'ew-resize'], se:[bb.x1,bb.y1,'nwse-resize'], s:[bb.cx,bb.y1,'ns-resize'],
    sw:[bb.x0,bb.y1,'nesw-resize'], w:[bb.x0,bb.cy,'ew-resize']
  };
  for(const dir in HP){
    const [x,y,cur]=HP[dir];
    const h=mk('rect');
    h.setAttribute('x',x-hs/2); h.setAttribute('y',y-hs/2);
    h.setAttribute('width',hs); h.setAttribute('height',hs);
    h.setAttribute('class','thandle');
    h.setAttribute('pointer-events','auto');
    h.setAttribute('vector-effect','non-scaling-stroke');
    h.style.cursor=cur;
    h.addEventListener('pointerdown',e=>{ e.stopPropagation(); e.preventDefault(); startScaleDrag(it,dir,e); });
    gUi.appendChild(h);
  }
  const rOff=Math.max(20, state.size/24);
  const line=mk('line');
  line.setAttribute('x1',bb.cx); line.setAttribute('y1',bb.y0);
  line.setAttribute('x2',bb.cx); line.setAttribute('y2',bb.y0-rOff);
  line.setAttribute('class','sel-bbox');
  line.setAttribute('vector-effect','non-scaling-stroke');
  gUi.appendChild(line);
  const rot=mk('circle');
  rot.setAttribute('cx',bb.cx); rot.setAttribute('cy',bb.y0-rOff);
  rot.setAttribute('r',hs*0.68);
  rot.setAttribute('class','thandle rot');
  rot.setAttribute('pointer-events','auto');
  rot.setAttribute('vector-effect','non-scaling-stroke');
  rot.style.cursor='grab';
  rot.addEventListener('pointerdown',e=>{ e.stopPropagation(); e.preventDefault(); startRotateDrag(it,e); });
  gUi.appendChild(rot);
}
function startScaleDrag(it,dir,ev){
  const bb=ptsBBox(it.pts);
  const ax = dir.includes('w') ? bb.x1 : (dir.includes('e') ? bb.x0 : bb.cx);
  const ay = dir.includes('n') ? bb.y1 : (dir.includes('s') ? bb.y0 : bb.cy);
  const p0=boardPoint(ev);
  const pts0=it.pts.map(q=>({...q})), raw0=it.raw.map(q=>({...q}));
  const bx = dir.includes('e')||dir.includes('w');
  const by = dir.includes('n')||dir.includes('s');
  const spanX=p0.x-ax, spanY=p0.y-ay;
  pushUndo();
  const move=e=>{
    const p=boardPoint(e);
    let sx = (bx && Math.abs(spanX)>0.5) ? (p.x-ax)/spanX : 1;
    let sy = (by && Math.abs(spanY)>0.5) ? (p.y-ay)/spanY : 1;
    if(e.shiftKey && bx && by){
      const u=(Math.abs(sx)+Math.abs(sy))/2;
      sx=(sx<0?-1:1)*u; sy=(sy<0?-1:1)*u;
    }
    const T=q=>({x:ax+(q.x-ax)*sx, y:ay+(q.y-ay)*sy});
    it.pts=pts0.map(T); it.raw=raw0.map(T);
    rebuildPath(it); syncTwin(it);
    if(!nodeRAF) nodeRAF=requestAnimationFrame(()=>{ nodeRAF=null; compose(); renderUi(); });
  };
  const up=()=>{
    document.removeEventListener('pointermove',move);
    document.removeEventListener('pointerup',up);
    compose(); renderHits(); renderUi(); renderPanel(); autosave();
  };
  document.addEventListener('pointermove',move);
  document.addEventListener('pointerup',up);
}
function startRotateDrag(it,ev){
  const bb=ptsBBox(it.pts);
  const cx=bb.cx, cy=bb.cy;
  const p0=boardPoint(ev);
  const a0=Math.atan2(p0.y-cy, p0.x-cx);
  const pts0=it.pts.map(q=>({...q})), raw0=it.raw.map(q=>({...q}));
  pushUndo();
  const move=e=>{
    const p=boardPoint(e);
    let da=Math.atan2(p.y-cy,p.x-cx)-a0;
    if(e.shiftKey){ const st=Math.PI/12; da=Math.round(da/st)*st; }
    const cs=Math.cos(da), sn=Math.sin(da);
    const T=q=>({x:cx+(q.x-cx)*cs-(q.y-cy)*sn, y:cy+(q.x-cx)*sn+(q.y-cy)*cs});
    it.pts=pts0.map(T); it.raw=raw0.map(T);
    rebuildPath(it); syncTwin(it);
    if(!nodeRAF) nodeRAF=requestAnimationFrame(()=>{ nodeRAF=null; compose(); renderUi(); });
  };
  const up=()=>{
    document.removeEventListener('pointermove',move);
    document.removeEventListener('pointerup',up);
    compose(); renderHits(); renderUi(); renderPanel(); autosave();
  };
  document.addEventListener('pointermove',move);
  document.addEventListener('pointerup',up);
}
/* --------- mover elemento arrastando --------- */
function startMoveDrag(it,ev){
  const start=boardPoint(ev);
  let started=false, orig=null;
  const move=e=>{
    const p=boardPoint(e);
    const dx=p.x-start.x, dy=p.y-start.y;
    if(!started){
      if(Math.hypot(dx,dy)<3) return;
      started=true;
      pushUndo();
      orig={pts:it.pts.map(q=>({...q})), raw:it.raw.map(q=>({...q}))};
    }
    it.pts=orig.pts.map(q=>({x:q.x+dx,y:q.y+dy}));
    it.raw=orig.raw.map(q=>({x:q.x+dx,y:q.y+dy}));
    rebuildPath(it); syncTwin(it);
    if(!nodeRAF) nodeRAF=requestAnimationFrame(()=>{ nodeRAF=null; compose(); renderUi(); });
  };
  const up=()=>{
    document.removeEventListener('pointermove',move);
    document.removeEventListener('pointerup',up);
    if(started){ compose(); renderHits(); renderPanel(); autosave(); }
  };
  document.addEventListener('pointermove',move);
  document.addEventListener('pointerup',up);
}
/* --------- seleção por área (marquee) --------- */
function startMarquee(ev){
  const start=boardPoint(ev);
  let rect=null, moved=false;
  const move=e=>{
    const p=boardPoint(e);
    if(!moved && Math.hypot(p.x-start.x,p.y-start.y)<3) return;
    moved=true;
    if(!rect){
      rect=document.createElementNS(SVGNS,'rect');
      rect.setAttribute('class','marquee');
      rect.setAttribute('vector-effect','non-scaling-stroke');
      gUi.appendChild(rect);
    }
    const x=Math.min(start.x,p.x), y=Math.min(start.y,p.y);
    const w=Math.abs(p.x-start.x), h=Math.abs(p.y-start.y);
    rect.setAttribute('x',x); rect.setAttribute('y',y);
    rect.setAttribute('width',w); rect.setAttribute('height',h);
    rect._box={x0:x,y0:y,x1:x+w,y1:y+h};
  };
  const up=()=>{
    document.removeEventListener('pointermove',move);
    document.removeEventListener('pointerup',up);
    if(!moved){
      setSelection([]);
      renderUi(); renderPanel();
      if(smoothSession) smoothRetarget();
      return;
    }
    const bx=rect._box; rect.remove();
    const ids=[];
    for(const s of strokeItems()){
      if(!s.pts || s.pts.length<2) continue;
      const path = s.closed ? s.pts.concat([s.pts[0]]) : s.pts;
      const rs=resample(path, Math.max(3, state.size/128));
      let inside=false;
      for(const p of rs){
        if(p.x>=bx.x0 && p.x<=bx.x1 && p.y>=bx.y0 && p.y<=bx.y1){ inside=true; break; }
      }
      if(inside) ids.push(s.id);
    }
    setSelection(ids);
    renderUi(); renderPanel();
    if(smoothSession) smoothRetarget();
    if(ids.length>1) toast(ids.length+' traços selecionados.');
  };
  document.addEventListener('pointermove',move);
  document.addEventListener('pointerup',up);
}
function startGroupMove(ev){
  const members=state.items.filter(i=>i.kind==='stroke' && state.multi.includes(i.id));
  if(!members.length) return;
  const start=boardPoint(ev);
  let started=false, orig=null;
  const move=e=>{
    const p=boardPoint(e);
    const dx=p.x-start.x, dy=p.y-start.y;
    if(!started){
      if(Math.hypot(dx,dy)<3) return;
      started=true; pushUndo();
      orig=members.map(m=>({m, pts:m.pts.map(q=>({...q})), raw:m.raw.map(q=>({...q}))}));
    }
    for(const o of orig){
      o.m.pts=o.pts.map(q=>({x:q.x+dx,y:q.y+dy}));
      o.m.raw=o.raw.map(q=>({x:q.x+dx,y:q.y+dy}));
      rebuildPath(o.m); syncTwin(o.m);
    }
    if(!nodeRAF) nodeRAF=requestAnimationFrame(()=>{ nodeRAF=null; compose(); renderUi(); });
  };
  const up=()=>{
    document.removeEventListener('pointermove',move);
    document.removeEventListener('pointerup',up);
    if(started){ compose(); renderHits(); renderPanel(); autosave(); }
  };
  document.addEventListener('pointermove',move);
  document.addEventListener('pointerup',up);
}
/* --------- arrastar imagem de referência --------- */
function startRefDrag(ev){
  ev.preventDefault();
  const start=boardPoint(ev);
  const ox=state.ref.x, oy=state.ref.y;
  const move=e=>{
    const p=boardPoint(e);
    state.ref.x=ox+(p.x-start.x);
    state.ref.y=oy+(p.y-start.y);
    applyRef();
  };
  const up=()=>{ document.removeEventListener('pointermove',move); document.removeEventListener('pointerup',up); };
  document.addEventListener('pointermove',move);
  document.addEventListener('pointerup',up);
}
/* --------- ferramentas --------- */
function setTool(t){
  state.tool=t;
  document.querySelectorAll('.tool[data-tool]').forEach(b=>b.classList.toggle('on',b.dataset.tool===t));
  $('board').classList.toggle('tool-ref', t==='ref');
  const cur={draw:'crosshair',erase:'crosshair',shape:'crosshair',bucket:'cell',select:'default',nodes:'default',ref:'move'};
  $('board').style.cursor=cur[t]||'default';
  if(t==='ref' && !state.ref.src) toast('Carregue uma imagem de referência no painel à direita.');
  renderUi(); renderPanel();
}
document.querySelectorAll('.tool[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
$('btnClearAll').onclick=()=>{
  if(!state.items.length) return;
  if(!confirm('Limpar todos os traços e preenchimentos?')) return;
  pushUndo(); state.items=[]; state.selId=null;
  compose(); renderHits(); renderPanel(); autosave();
};
/* --------- processar / reverter --------- */
let pendingTargets=null; // mantido para a interpretação de formas
let smoothSession=null, smoothRAF=null;
/* estica o traço: menos curvas, segmentos retos — extremidades preservadas */
function straightenStroke(s, u){
  const wasProcessed = s.processed && s.pts && s.pts.length>1;
  const base = wasProcessed ? (s.closed ? s.pts.concat([s.pts[0]]) : s.pts) : s.raw;
  let pts=resample(base, Math.max(1.5, state.size/300));
  let closed;
  if(wasProcessed){ closed=s.closed; }
  else {
    const L=pathLen(pts);
    const gap=Math.hypot(pts[0].x-pts[pts.length-1].x, pts[0].y-pts[pts.length-1].y);
    closed = pts.length>8 && gap < Math.max(12, L*0.09);
  }
  pts=smoothPts(pts, 1, 1, closed);
  const eps=1 + u*u*(state.size/22);
  let simp=rdp(pts, eps);
  if(closed && simp.length>3){
    const g=Math.hypot(simp[0].x-simp[simp.length-1].x, simp[0].y-simp[simp.length-1].y);
    if(g < Math.max(12, pathLen(pts)*0.09)) simp=simp.slice(0,-1);
  }
  const min=closed?3:2;
  if(simp.length<min) simp=[pts[0], pts[pts.length-1]];
  s.pts=simp; s.closed=closed; s.processed=true; s.linear=true;
  rebuildPath(s);
}
function openSmoothBar(){
  if(smoothSession){ hideSmoothBar(); smoothSession=null; return; }
  if(!strokeItems().length){ toast('Desenhe algum traço primeiro.'); return; }
  const sel=selItem();
  const targets = state.multi.length>1
    ? state.multi.slice()
    : ((sel && sel.kind==='stroke') ? [sel.id] : strokeItems().map(s=>s.id));
  smoothSession={backup:snapshot(), targets, value:50};
  setTool('select');
  toast(sel && sel.kind==='stroke'
    ? 'Ajustando apenas o traço selecionado.'
    : 'Clique num traço para ajustar só ele — ou mova a barra para ajustar todos.');
  showSmoothBar();
}
function applySmoothPreview(){
  if(!smoothSession) return;
  const v=smoothSession.value;
  const j=JSON.parse(smoothSession.backup);
  state.items=j.items;
  const tgt=state.items.filter(i=>i.kind==='stroke' && smoothSession.targets.includes(i.id));
  if(v>52){
    const t=(v-50)/50;
    for(const s of tgt){ s.linear=false; processStroke(s, t); }
  } else if(v<48){
    const u=(50-v)/50;
    for(const s of tgt) straightenStroke(s, u);
  }
  for(const s of tgt)
    if(s.link && smoothSession.targets.includes(s.link.id)) syncTwin(s);
  compose(); renderHits(); renderUi();
}
function smoothRetarget(){
  if(!smoothSession) return;
  // ajuste independente por alvo: ao trocar de alvo, o preview atual é
  // confirmado (vai para o undo) e a barra volta ao meio (50 = neutro)
  if(smoothSession.value<48 || smoothSession.value>52){
    undoStack.push(smoothSession.backup);
    if(undoStack.length>60) undoStack.shift();
    redoStack=[]; updateUndoBtns();
    smoothSession.backup=snapshot();
    autosave();
  }
  smoothSession.value=50;
  const sl=$('smLevel'); if(sl) sl.value=50;
  const sel=selItem();
  smoothSession.targets = state.multi.length>1
    ? state.multi.slice()
    : ((sel && sel.kind==='stroke')
      ? [sel.id]
      : state.items.filter(i=>i.kind==='stroke').map(i=>i.id));
  renderUi();
}
function showSmoothBar(){
  hideSmoothBar();
  const bar=document.createElement('div');
  bar.id='smoothBar';
  bar.innerHTML='<span class="sm-end">Reto</span>'+
    '<input type="range" id="smLevel" min="0" max="100" value="50">'+
    '<span class="sm-end">Redondo</span>'+
    '<button class="btn sm primary" id="smApply">Aplicar</button>'+
    '<button class="btn sm" id="smCancel">Cancelar</button>';
  document.body.appendChild(bar);
  const r=bar.querySelector('#smLevel');
  r.oninput=()=>{
    smoothSession.value=parseInt(r.value);
    if(!smoothRAF) smoothRAF=requestAnimationFrame(()=>{ smoothRAF=null; applySmoothPreview(); });
  };
  bar.querySelector('#smApply').onclick=()=>{
    undoStack.push(smoothSession.backup); if(undoStack.length>60) undoStack.shift();
    redoStack=[]; updateUndoBtns();
    smoothSession=null; hideSmoothBar();
    renderPanel(); autosave();
    toast('Ajuste do traço aplicado.');
  };
  bar.querySelector('#smCancel').onclick=()=>{
    const bk=smoothSession.backup;
    smoothSession=null; hideSmoothBar();
    restore(bk); autosave();
  };
}
function hideSmoothBar(){ const b=$('smoothBar'); if(b) b.remove(); }
$('btnSmoothTool').onclick=openSmoothBar;
$('btnRevert').onclick=()=>{
  const ps=strokeItems().filter(s=>s.processed);
  if(!ps.length){ toast('Nenhum traço processado para reverter.'); return; }
  pushUndo();
  for(const s of ps){
    s.pts=s.raw.map(p=>({...p}));
    s.closed=false; s.processed=false; s.linear=false;
    s.d=polyPath(s.pts,false);
  }
  compose(); renderHits(); renderPanel(); autosave();
  toast('Traços revertidos ao desenho original.');
};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{
  b.closest('.modal-bg').classList.remove('open'); pendingShapePts=null;
});
document.querySelectorAll('.modal-bg').forEach(m=>m.addEventListener('pointerdown',e=>{
  if(e.target===m){ m.classList.remove('open'); pendingShapePts=null; }
}));
/* --------- undo / redo --------- */
function snapshot(){ return JSON.stringify({items:state.items,nextId:state.nextId}); }
function restore(sn){
  const j=JSON.parse(sn);
  state.items=j.items; state.nextId=j.nextId;
  if(!state.items.some(i=>i.id===state.selId)) state.selId=null;
  state.multi=(state.multi||[]).filter(id=>state.items.some(i=>i.id===id));
  compose(); renderHits(); renderPanel();
}
function pushUndo(){
  if(smoothSession){
    // outra edição começou com a barra de suavização aberta:
    // confirma o ajuste em andamento e fecha a barra, para o backup
    // antigo nunca ressuscitar elementos já apagados
    undoStack.push(smoothSession.backup);
    smoothSession=null; hideSmoothBar();
  }
  undoStack.push(snapshot()); if(undoStack.length>60) undoStack.shift(); redoStack=[]; updateUndoBtns();
}
function undo(){
  if(smoothSession){
    const bk=smoothSession.backup;
    smoothSession=null; hideSmoothBar();
    restore(bk); updateUndoBtns(); autosave();
    return;
  }
  if(!undoStack.length) return; redoStack.push(snapshot()); restore(undoStack.pop()); updateUndoBtns(); autosave();
}
function redo(){
  if(smoothSession) return;
  if(!redoStack.length) return; undoStack.push(snapshot()); restore(redoStack.pop()); updateUndoBtns(); autosave();
}
function updateUndoBtns(){ $('btnUndo').disabled=!undoStack.length; $('btnRedo').disabled=!redoStack.length; }
$('btnUndo').onclick=undo; $('btnRedo').onclick=redo;
/* ============================================================
   PAINEL, EXPORTAÇÃO, PROJETOS, INIT
   ============================================================ */
const NIB_LABELS={round:'●',h:'─',v:'│',d1:'╱',d2:'╲'};
function nibSeg(id,cur){
  return '<div class="nib-seg" id="'+id+'">'+
    Object.keys(NIB_LABELS).map(n=>'<button class="nib-btn'+(cur===n?' on':'')+'" data-nib="'+n+'" title="'+
      ({round:'Ponta redonda (normal)',h:'Pena horizontal — traço vertical fica grosso',v:'Pena vertical — traço horizontal fica grosso',d1:'Pena diagonal ╱',d2:'Pena diagonal ╲'})[n]+'">'+NIB_LABELS[n]+'</button>').join('')+'</div>';
}
function bindNib(id,fn){
  const s=$(id); if(!s) return;
  s.querySelectorAll('.nib-btn').forEach(b=>b.onclick=()=>{ fn(b.dataset.nib);
    s.querySelectorAll('.nib-btn').forEach(x=>x.classList.toggle('on',x===b)); });
}
function bindRange(id,fn,suffix){
  const r=$(id); if(!r) return;
  r.oninput=()=>{ $(id+'v').textContent=r.value+(suffix||''); fn(parseFloat(r.value)); };
}
function renderPanel(){
  const P=$('panel');
  const it=selItem();
  const multiSel = (state.multi && state.multi.length>1)
    ? state.items.filter(i=>i.kind==='stroke' && state.multi.includes(i.id)) : null;
  let html='';
  if(multiSel && multiSel.length>1){
    const f=multiSel[0];
    html+='<div class="sec"><h3>Seleção múltipla <span class="tag">'+multiSel.length+' traços</span></h3>'+
      colorField('muColor',f.color)+
      colorField('muFill',f.fill)+
      '<div class="row"><label class="lbl">Espessura</label>'+
        '<input type="range" id="muW" min="1" max="80" value="'+f.w+'"><span class="range-val" id="muWv">'+f.w+'</span></div>'+
      '<div class="row"><label class="lbl">Opacidade</label>'+
        '<input type="range" id="muOp" min="5" max="100" value="'+f.opacity+'"><span class="range-val" id="muOpv">'+f.opacity+'</span></div>'+
      '<div class="btn-row" style="margin-top:8px"><button class="btn sm danger" id="muDel">Excluir todos</button></div>'+
      '<div class="hint">A primeira cor pinta o traço; a segunda, o preenchimento das formas fechadas de ponta redonda. Arraste qualquer item para mover o grupo todo; Shift+clique adiciona ou remove da seleção; setas movem o grupo; Delete exclui tudo.</div>'+
    '</div>';
  } else if(it && it.kind==='stroke'){
    html+='<div class="sec"><h3>'+(it.erase?'Pincel negativo':'Traço')+' selecionado <span class="tag">#'+it.id+(it.processed?' · suave':' · bruto')+(it.link?' · espelhado':'')+'</span></h3>'+
      '<div class="row"><label class="lbl">Ponta</label>'+nibSeg('stNib',it.nib)+'</div>'+
      (it.nib==='round'
        ? '<div class="row"><label class="lbl">Espessura</label>'+
          '<input type="range" id="stW" min="1" max="80" value="'+it.w+'"><span class="range-val" id="stWv">'+it.w+'</span></div>'
        : '<div class="row"><label class="lbl">Comprimento</label>'+
          '<input type="range" id="stW" min="2" max="90" value="'+it.w+'"><span class="range-val" id="stWv">'+it.w+'</span></div>'+
          '<div class="row"><label class="lbl">Grossura</label>'+
          '<input type="range" id="stW2" min="1" max="40" value="'+(it.w2!=null?it.w2:4)+'"><span class="range-val" id="stW2v">'+(it.w2!=null?it.w2:4)+'</span></div>')+
      (it.erase?'':colorField('stColor',it.color)+
      '<div class="row"><label class="lbl">Opacidade</label>'+
        '<input type="range" id="stOp" min="5" max="100" value="'+it.opacity+'"><span class="range-val" id="stOpv">'+it.opacity+'</span></div>')+
      (it.nib==='round'?'<div class="row"><label class="lbl">Pontas</label><div class="seg" id="segCap">'+
        '<button data-v="round" class="'+(it.cap==='round'?'on':'')+'">Redonda</button>'+
        '<button data-v="square" class="'+(it.cap==='square'?'on':'')+'">Quadrada</button>'+
        '<button data-v="butt" class="'+(it.cap==='butt'?'on':'')+'">Reta</button></div></div>':'')+
    '</div>';
    if(!it.erase){
      html+='<div class="sec"><h3>Preenchimento do traço'+(it.closed?'':' <span class="tag">aberto</span>')+'</h3>'+
        '<label class="chk"><input type="checkbox" id="stFillOn"'+(it.fillOn?' checked':'')+(it.closed&&it.nib==='round'?'':' disabled')+'>Preencher forma</label>'+
        colorField('stFill',it.fill)+
        '<div class="row"><label class="lbl">Opacidade</label>'+
          '<input type="range" id="stFillOp" min="5" max="100" value="'+it.fillOpacity+'"><span class="range-val" id="stFillOpv">'+it.fillOpacity+'</span></div>'+
        (it.closed&&it.nib==='round'?'':'<div class="hint">Disponível para traços fechados com ponta redonda. Para preencher regiões compostas, use o balde de tinta.</div>')+
      '</div>';
    }
    html+='<div class="sec"><h3>Ações</h3><div class="btn-row">'+
      '<button class="btn sm" id="stNodes">Editar nós</button>'+
      '<button class="btn sm" id="stMirrorV">Espelhar ↔</button>'+
      '<button class="btn sm" id="stMirrorH">Espelhar ↕</button>'+
      '<button class="btn sm" id="stDup">Duplicar</button>'+
      '<button class="btn sm danger" id="stDel">Excluir</button></div>'+
      '<div class="hint">Editar nós: arraste os pontos para ajustar a curva; duplo clique num ponto remove. Espelhar cria cópia refletida no centro do canvas.</div>'+
    '</div>';
    if(state.tool==='nodes'){
      html+='<div class="sec"><h3>Nós <span class="tag">'+it.pts.length+'</span></h3>'+
        '<div class="btn-row">'+
        '<button class="btn sm" id="ndDouble">Dobrar nós</button>'+
        '<button class="btn sm" id="ndHalve">Reduzir nós</button></div>'+
        '<div class="hint">Duplo clique sobre a linha adiciona um nó no lugar; duplo clique num nó remove. Se o traço tem par espelhado vinculado, o outro lado acompanha automaticamente.</div>'+
      '</div>';
    }
  } else {
    html+='<div class="empty">Desenhe à mão livre, rascunhe uma <b>forma geométrica</b>, use o <b>balde</b> para preencher regiões ou o <b>pincel negativo</b> para recortar transparência.</div>';
  }

  if(state.tool==='shape'){
    html+='<div class="sec"><h3>Forma geométrica</h3><div class="shape-grid">'+
      SHAPE_DEFS.map(d=>'<button class="shape-opt shape-pick'+(state.shapeKind===d[0]?' on':'')+'" data-shape="'+d[0]+'"><svg viewBox="0 0 30 30">'+d[2]+'</svg>'+d[1]+'</button>').join('')+
      '</div><div class="hint">Clique e arraste no canvas para criar no tamanho desejado. Com o espelho ligado, o outro lado nasce junto e vinculado.</div></div>';
  }
  html+='<div class="sec"><h3>Próximos traços</h3>'+
    '<div class="row"><label class="lbl">Ponta</label>'+nibSeg('pdNib',pendingStyle.nib)+'</div>'+
    (pendingStyle.nib==='round'
      ? '<div class="row"><label class="lbl">Espessura</label>'+
        '<input type="range" id="pdW" min="1" max="80" value="'+pendingStyle.w+'"><span class="range-val" id="pdWv">'+pendingStyle.w+'</span></div>'
      : '<div class="row"><label class="lbl">Comprimento</label>'+
        '<input type="range" id="pdW" min="2" max="90" value="'+pendingStyle.w+'"><span class="range-val" id="pdWv">'+pendingStyle.w+'</span></div>'+
        '<div class="row"><label class="lbl">Grossura</label>'+
        '<input type="range" id="pdW2" min="1" max="40" value="'+(pendingStyle.w2||4)+'"><span class="range-val" id="pdW2v">'+(pendingStyle.w2||4)+'</span></div>')+
    colorField('pdColor',pendingStyle.color)+
    '<div class="hint">A pena caligráfica muda a grossura conforme a direção do traço — igual caneta de ponta chata.</div>'+
  '</div>';

  const fills=state.items.filter(i=>i.kind==='fill');
  html+='<div class="sec"><h3>Balde de tinta <span class="tag">'+fills.length+'</span></h3>'+
    colorField('bkColor',state.bucket.color)+
    '<div class="row"><label class="lbl">Tolerância</label>'+
      '<input type="range" id="bkTol" min="8" max="140" value="'+state.bucket.tolerance+'"><span class="range-val" id="bkTolv">'+state.bucket.tolerance+'</span></div>'+
    '<div id="fillList">'+fills.map(f=>'<div class="fill-item"><span class="fill-swatch" style="background:'+f.color+'"></span>'+
      '<span class="grow">('+Math.round(f.x)+', '+Math.round(f.y)+')</span>'+
      '<button class="btn sm danger" data-delfill="'+f.id+'">×</button></div>').join('')+'</div>'+
    '<div class="hint">Preenchimentos são aplicados na camada pixel (aparecem no PNG; o SVG exporta apenas o vetor).</div>'+
  '</div>';

  const r=state.ref;
  html+='<div class="sec"><h3>Canvas</h3>'+
    '<div class="row"><label class="lbl">Tamanho</label><select class="inp" id="cvSize" style="flex:1">'+
      [128,256,512,1024].map(v=>'<option value="'+v+'"'+(state.size===v?' selected':'')+'>'+v+' × '+v+' px</option>').join('')+'</select></div>'+
    '<label class="chk"><input type="checkbox" id="cvGrid"'+(state.gridOn?' checked':'')+'>Mostrar grade</label>'+
    '<label class="chk"><input type="checkbox" id="cvGridAbove"'+(state.gridAbove?' checked':'')+'>Grade por cima do desenho</label>'+
    '<div class="row"><label class="lbl">Espaço grade</label><select class="inp" id="cvGridSp" style="flex:1">'+
      [16,32,64,128].map(v=>'<option value="'+v+'"'+(state.gridSpacing===v?' selected':'')+'>'+v+' px</option>').join('')+'</select></div>'+
    '<div class="row"><label class="lbl">Fundo</label>'+
      '<input type="range" id="cvBg" min="0" max="100" value="'+bgLevel()+'"><span class="range-val" id="cvBgv">'+bgLevel()+'</span></div>'+
    '<div class="hint" style="margin:-4px 0 8px">Do preto (0) ao branco (100), só para enxergar o objeto — a exportação PNG/SVG continua com fundo transparente.</div>'+
    '<div class="row"><label class="lbl">Zoom</label>'+
      '<input type="range" id="cvZoom" min="50" max="250" value="'+Math.round(state.zoom*100)+'"><span class="range-val" id="cvZoomv">'+Math.round(state.zoom*100)+'%</span></div>'+
    '<div class="cp-label" style="margin:12px 0 7px;text-transform:uppercase;letter-spacing:.9px">Imagem de referência</div>'+
    '<div class="btn-row" style="margin-bottom:9px">'+
      '<button class="btn sm primary" id="refLoad">Carregar imagem…</button>'+
      (r.src?'<button class="btn sm" id="refToggle">'+(r.visible?'Ocultar':'Mostrar')+'</button>'+
      '<button class="btn sm danger" id="refRemove">Remover</button>':'')+'</div>'+
    (r.src?
      '<div class="row"><label class="lbl">Opacidade</label>'+
        '<input type="range" id="refOp" min="5" max="90" value="'+r.opacity+'"><span class="range-val" id="refOpv">'+r.opacity+'</span></div>'+
      '<div class="row"><label class="lbl">Escala</label>'+
        '<input type="range" id="refSc" min="10" max="300" value="'+Math.round(r.scale*100)+'"><span class="range-val" id="refScv">'+Math.round(r.scale*100)+'%</span></div>':'')+
    '<div class="hint">Grade, fundo e referência são apenas apoio visual do ambiente — nenhum deles entra na arte final. A referência também não é salva no projeto. Use a ferramenta (R) para arrastá-la.</div>'+
  '</div>';

  html+='<div class="sec"><h3>Projetos <span class="tag" id="projCount"></span></h3>'+
    '<div class="btn-row" style="margin-bottom:10px">'+
      '<button class="btn sm primary" id="projSave">Salvar como…</button>'+
      '<button class="btn sm" id="projExport">Baixar .json</button>'+
      '<button class="btn sm" id="projImport">Abrir .json</button></div>'+
    '<div id="projList"></div>'+
    '<div class="hint">Projetos ficam no navegador; o trabalho atual é salvo automaticamente. A imagem de referência não é incluída.</div>'+
  '</div>';

  P.innerHTML=html;
  bindPanel(it);
  renderProjects();
}
function bindPanel(it){
  const multiSel2 = (state.multi && state.multi.length>1)
    ? state.items.filter(i=>i.kind==='stroke' && state.multi.includes(i.id)) : null;
  if(multiSel2 && multiSel2.length>1){
    const upd=()=>{ for(const m of multiSel2){ rebuildPath(m); syncTwin(m); } compose(); renderHits(); renderUi(); autosave(); };
    bindColorField('muColor', ()=>multiSel2[0].color, v=>{ multiSel2.forEach(m=>{m.color=v;}); upd(); });
    bindColorField('muFill', ()=>multiSel2[0].fill, v=>{
      multiSel2.forEach(m=>{ m.fill=v; if(m.closed && m.nib==='round') m.fillOn=true; });
      upd();
    });
    bindRange('muW', v=>{ multiSel2.forEach(m=>{m.w=v;}); upd(); });
    bindRange('muOp', v=>{ multiSel2.forEach(m=>{m.opacity=v;}); upd(); });
    $('muDel').onclick=()=>{
      pushUndo();
      const ids=state.multi.slice();
      state.items=state.items.filter(x=>!ids.includes(x.id));
      state.multi=[]; state.selId=null;
      compose(); renderHits(); renderPanel(); autosave();
    };
  }
  if(it && it.kind==='stroke'){
    const rr=()=>{ rebuildPath(it); syncTwin(it); compose(); renderHits(); autosave(); };
    bindNib('stNib',v=>{it.nib=v;renderPanel();rr();});
    bindRange('stW',v=>{it.w=v;rr();});
    bindRange('stW2',v=>{it.w2=v;rr();});
    bindColorField('stColor', ()=>it.color, v=>{it.color=v; rr();});
    bindRange('stOp',v=>{it.opacity=v;rr();});
    const sc=$('segCap'); if(sc) sc.querySelectorAll('button').forEach(b=>b.onclick=()=>{it.cap=b.dataset.v;renderPanel();rr();});
    const fo=$('stFillOn'); if(fo) fo.onchange=e=>{it.fillOn=e.target.checked;rr();};
    bindColorField('stFill', ()=>it.fill, v=>{
      it.fill=v;
      if(!it.fillOn && it.closed && it.nib==='round'){ it.fillOn=true; const fo=$('stFillOn'); if(fo) fo.checked=true; }
      rr();
    });
    bindRange('stFillOp',v=>{it.fillOpacity=v;rr();});
    const nd=$('ndDouble'); if(nd) nd.onclick=()=>doubleNodes(it);
    const nh=$('ndHalve'); if(nh) nh.onclick=()=>halveNodes(it);
    $('stNodes').onclick=()=>{ ensureEditableNodes(it); compose(); setTool('nodes'); };
    $('stMirrorV').onclick=()=>mirrorDup(it,'v');
    $('stMirrorH').onclick=()=>mirrorDup(it,'h');
    $('stDup').onclick=()=>{
      pushUndo();
      const c2=JSON.parse(JSON.stringify(it)); c2.id=state.nextId++;
      delete c2.link;
      c2.pts=c2.pts.map(p=>({x:p.x+18,y:p.y+18}));
      c2.raw=c2.raw.map(p=>({x:p.x+18,y:p.y+18}));
      rebuildPath(c2);
      state.items.push(c2); state.selId=c2.id;
      compose(); renderHits(); renderPanel(); autosave();
    };
    $('stDel').onclick=()=>{
      pushUndo();
      state.items=state.items.filter(x=>x.id!==it.id); state.selId=null;
      compose(); renderHits(); renderPanel(); autosave();
    };
  }
  document.querySelectorAll('.shape-pick').forEach(b=>b.onclick=()=>{
    state.shapeKind=b.dataset.shape; renderPanel();
  });
  bindNib('pdNib',v=>{pendingStyle.nib=v;renderPanel();});
  bindRange('pdW',v=>{pendingStyle.w=v;});
  bindRange('pdW2',v=>{pendingStyle.w2=v;});
  bindColorField('pdColor', ()=>pendingStyle.color, v=>{pendingStyle.color=v;});
  bindColorField('bkColor', ()=>state.bucket.color, v=>{state.bucket.color=v;});
  bindRange('bkTol',v=>{state.bucket.tolerance=v;});
  document.querySelectorAll('[data-delfill]').forEach(b=>b.onclick=()=>{
    pushUndo();
    state.items=state.items.filter(x=>x.id!==parseInt(b.dataset.delfill));
    compose(); renderPanel(); autosave();
  });
  $('refLoad').onclick=()=>{
    const inp=document.createElement('input'); inp.type='file'; inp.accept='image/*';
    inp.onchange=()=>{
      const f=inp.files[0]; if(!f) return;
      const rd=new FileReader();
      rd.onload=()=>{
        state.ref.src=rd.result; state.ref.visible=true;
        state.ref.x=0; state.ref.y=0;
        const img=new Image();
        img.onload=()=>{ state.ref.scale=state.size/Math.max(img.width,img.height); applyRef(); renderPanel(); };
        img.src=rd.result;
        setTool('ref');
      };
      rd.readAsDataURL(f);
    };
    inp.click();
  };
  const rt=$('refToggle'); if(rt) rt.onclick=()=>{state.ref.visible=!state.ref.visible;applyRef();renderPanel();};
  const rm=$('refRemove'); if(rm) rm.onclick=()=>{state.ref.src=null;applyRef();renderPanel();};
  bindRange('refOp',v=>{state.ref.opacity=v;applyRef();});
  bindRange('refSc',v=>{state.ref.scale=v/100;applyRef();},'%');
  $('cvSize').onchange=e=>{
    const ratio=parseInt(e.target.value)/state.size;
    state.size=parseInt(e.target.value);
    for(const s of state.items){
      if(s.kind==='fill'){ s.x*=ratio; s.y*=ratio; continue; }
      s.pts=s.pts.map(p=>({x:p.x*ratio,y:p.y*ratio}));
      s.raw=s.raw.map(p=>({x:p.x*ratio,y:p.y*ratio}));
      s.w=Math.max(1,Math.round(s.w*ratio));
      rebuildPath(s);
    }
    state.ref.scale*=ratio; state.ref.x*=ratio; state.ref.y*=ratio;
    buildBoard(); renderPanel(); autosave();
  };
  $('cvGrid').onchange=e=>{state.gridOn=e.target.checked;drawGrid();autosave();};
  $('cvGridSp').onchange=e=>{state.gridSpacing=parseInt(e.target.value);drawGrid();autosave();};
  const ga=$('cvGridAbove'); if(ga) ga.onchange=e=>{state.gridAbove=e.target.checked;drawGrid();autosave();};
  bindRange('cvBg',v=>{ localStorage.setItem(BG_KEY,String(Math.round(v))); applyBg(); });
  bindRange('cvZoom',v=>{state.zoom=v/100;applyBoardSize();applyRef();},'%');
  $('projSave').onclick=saveProjectAs;
  $('projExport').onclick=exportProjectFile;
  $('projImport').onclick=importProjectFile;
}
function mirrorDup(it,axis){
  pushUndo();
  const c=state.size/2;
  const c2=JSON.parse(JSON.stringify(it)); c2.id=state.nextId++;
  const refl = axis==='v' ? p=>({x:2*c-p.x,y:p.y}) : p=>({x:p.x,y:2*c-p.y});
  c2.pts=c2.pts.map(refl).reverse(); c2.raw=c2.raw.map(refl).reverse();
  c2.nib=mirrorNib(it.nib);
  rebuildPath(c2);
  if(it.link){ const old=state.items.find(x=>x.id===it.link.id); if(old) old.link=null; }
  it.link={id:c2.id,axis}; c2.link={id:it.id,axis};
  state.items.push(c2); state.selId=c2.id;
  compose(); renderHits(); renderPanel(); autosave();
  toast('Cópia espelhada criada e vinculada: editar um lado reflete no outro.');
}
/* ---------------- Exportação ---------------- */
function buildSVG(){
  const erasers=state.items.filter(i=>i.kind==='stroke'&&i.erase&&i.pts&&i.pts.length>1);
  const visible=state.items.filter(i=>i.kind==='stroke'&&!i.erase&&i.pts&&i.pts.length>1);
  let maskDef='', maskAttr='';
  if(erasers.length){
    maskDef='<defs><mask id="cut"><rect width="'+state.size+'" height="'+state.size+'" fill="#fff"/>';
    for(const e of erasers){
      if(e.nib==='round')
        maskDef+='<path d="'+e.d+'" fill="none" stroke="#000" stroke-width="'+e.w+'" stroke-linecap="'+e.cap+'" stroke-linejoin="round"/>';
      else
        maskDef+='<path d="'+ribbonD(e.pts,e.w,e.nib,e.closed,e.linear)+'" fill="#000" stroke="#000" stroke-width="'+Math.max(1,e.w2!=null?e.w2:4)+'" stroke-linejoin="round" stroke-linecap="round"/>';
    }
    maskDef+='</mask></defs>\n';
    maskAttr=' mask="url(#cut)"';
  }
  let inner='';
  for(const s of visible){
    if(s.nib==='round'){
      inner+='  <path d="'+s.d+'" fill="'+(s.fillOn&&s.closed?s.fill:'none')+'"'+
        (s.fillOn&&s.closed&&s.fillOpacity<100?' fill-opacity="'+(s.fillOpacity/100)+'"':'')+
        ' stroke="'+s.color+'" stroke-width="'+s.w+'"'+
        (s.opacity<100?' opacity="'+(s.opacity/100)+'"':'')+
        ' stroke-linecap="'+s.cap+'" stroke-linejoin="round"/>\n';
    } else {
      inner+='  <path d="'+ribbonD(s.pts,s.w,s.nib,s.closed,s.linear)+'" fill="'+s.color+'" stroke="'+s.color+'" stroke-width="'+Math.max(1,s.w2!=null?s.w2:4)+'" stroke-linejoin="round" stroke-linecap="round"'+
        (s.opacity<100?' opacity="'+(s.opacity/100)+'"':'')+'/>\n';
    }
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+state.size+' '+state.size+'" width="'+state.size+'" height="'+state.size+'">\n'+
    maskDef+'<g'+maskAttr+'>\n'+inner+'</g>\n</svg>';
}
function downloadBlob(blob,name){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download=name;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},400);
}
$('btnExportSvg').onclick=()=>{
  if(!strokeItems().length){ toast('Nada para exportar ainda.'); return; }
  downloadBlob(new Blob([buildSVG()],{type:'image/svg+xml'}),'icone.svg');
  const nf=state.items.filter(i=>i.kind==='fill').length;
  toast('SVG exportado.'+(nf?' Obs.: os '+nf+' preenchimento(s) de balde só aparecem no PNG.':''));
};
$('btnExportPng').onclick=()=>{
  if(!state.items.length){ toast('Nada para exportar ainda.'); return; }
  const scale=Math.max(1,Math.min(4,Math.round(parseFloat(prompt('Escala do PNG (1 a 4):','2')||'2'))));
  const out=document.createElement('canvas');
  out.width=state.size*scale; out.height=state.size*scale;
  const ctx=out.getContext('2d');
  ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
  ctx.drawImage($('composite'),0,0,out.width,out.height);
  out.toBlob(b=>{
    if(b){ downloadBlob(b,'icone-'+out.width+'.png'); toast('PNG exportado em '+out.width+'×'+out.height+' (fundo transparente).'); }
    else toast('Falha ao gerar PNG.',true);
  },'image/png');
};
/* ---------------- Projetos ---------------- */
function projectData(){
  return {app:'iconcraft',version:2,
    size:state.size,gridOn:state.gridOn,gridSpacing:state.gridSpacing,gridAbove:state.gridAbove,
    items:state.items,nextId:state.nextId,bucket:state.bucket};
}
function migrate(j){
  if(j.items) return j;
  // projetos da v1 usavam "strokes"
  j.items=(j.strokes||[]).map(s=>({kind:'stroke',erase:false,nib:'round',...s}));
  return j;
}
function loadProjectData(raw){
  const j=migrate(raw);
  if(j.app!=='iconcraft') throw new Error('Arquivo não é um projeto do IconCraft.');
  state.size=j.size||512; state.gridOn=j.gridOn!==false; state.gridSpacing=j.gridSpacing||32;
  state.gridAbove=!!j.gridAbove;
  state.items=j.items||[];
  state.items.forEach(i=>{ if(i.kind==='stroke' && i.w2==null) i.w2=4; });
  if(j.bucket) Object.assign(state.bucket,j.bucket);
  state.nextId=j.nextId||(Math.max(0,...state.items.map(s=>s.id))+1);
  state.selId=null;
  buildBoard(); renderPanel();
}
function autosave(){
  try{ localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(projectData())); }catch(e){}
}
function getProjects(){ try{ return JSON.parse(localStorage.getItem(PROJECTS_KEY)||'{}'); }catch(e){ return {}; } }
function saveProjectAs(){
  const name=(prompt('Nome do projeto:','meu-icone')||'').trim();
  if(!name) return;
  const all=getProjects();
  all[name]={when:Date.now(),data:projectData()};
  try{ localStorage.setItem(PROJECTS_KEY,JSON.stringify(all)); toast('Projeto "'+name+'" salvo.'); renderProjects(); }
  catch(e){ toast('Sem espaço no navegador para salvar.',true); }
}
function renderProjects(){
  const list=$('projList'); if(!list) return;
  const all=getProjects(), names=Object.keys(all).sort((a,b)=>all[b].when-all[a].when);
  $('projCount').textContent=names.length||'';
  list.innerHTML = names.length ? '' : '<div class="hint">Nenhum projeto salvo ainda.</div>';
  for(const n of names){
    const item=document.createElement('div'); item.className='proj-item';
    const dt=new Date(all[n].when);
    item.innerHTML='<span class="name">'+n.replace(/</g,'&lt;')+'</span>'+
      '<span class="when">'+dt.toLocaleDateString('pt-BR')+'</span>';
    const bo=document.createElement('button'); bo.className='btn sm'; bo.textContent='Abrir';
    bo.onclick=()=>{ pushUndo(); loadProjectData(all[n].data); toast('Projeto "'+n+'" carregado.'); };
    const bd=document.createElement('button'); bd.className='btn sm danger'; bd.textContent='×'; bd.title='Excluir projeto';
    bd.onclick=()=>{ if(!confirm('Excluir o projeto "'+n+'"?'))return; delete all[n]; localStorage.setItem(PROJECTS_KEY,JSON.stringify(all)); renderProjects(); };
    item.append(bo,bd); list.appendChild(item);
  }
}
function exportProjectFile(){
  downloadBlob(new Blob([JSON.stringify(projectData(),null,1)],{type:'application/json'}),'projeto-icone.json');
}
function importProjectFile(){
  const inp=document.createElement('input'); inp.type='file'; inp.accept='.json';
  inp.onchange=()=>{
    const f=inp.files[0]; if(!f) return;
    const rd=new FileReader();
    rd.onload=()=>{ try{ pushUndo(); loadProjectData(JSON.parse(rd.result)); toast('Projeto importado.'); }catch(e){ toast('Erro: '+e.message,true); } };
    rd.readAsText(f);
  };
  inp.click();
}
/* ============ SELETOR DE CORES ============ */
let lastNudge=0, pickerState=null, eyedropActive=false;
const RECENT_KEY='iconcraft-recent-colors';
function getRecentColors(){ try{ return JSON.parse(localStorage.getItem(RECENT_KEY)||'[]'); }catch(e){ return []; } }
function addRecentColor(c){
  c=c.toUpperCase();
  let r=getRecentColors().filter(x=>x!==c);
  r.unshift(c); r=r.slice(0,30);
  localStorage.setItem(RECENT_KEY, JSON.stringify(r));
}
function delRecentColor(c){
  localStorage.setItem(RECENT_KEY, JSON.stringify(getRecentColors().filter(x=>x!==c.toUpperCase())));
}
function rgbToHex(r,g,b){
  return '#'+[r,g,b].map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('').toUpperCase();
}
function hexToHsl(hex){
  const [r,g,b]=hexToRgb(hex).map(v=>v/255);
  const max=Math.max(r,g,b), min=Math.min(r,g,b);
  let h=0,s=0; const l=(max+min)/2;
  if(max!==min){
    const d=max-min;
    s=l>0.5 ? d/(2-max-min) : d/(max+min);
    if(max===r) h=((g-b)/d+(g<b?6:0))/6;
    else if(max===g) h=((b-r)/d+2)/6;
    else h=((r-g)/d+4)/6;
  }
  return {h,s,l};
}
function hslToHex(h,s,l){
  let r,g,b;
  if(s===0){ r=g=b=l; }
  else {
    const q=l<0.5 ? l*(1+s) : l+s-l*s, p=2*l-q;
    const f=t=>{
      if(t<0)t+=1; if(t>1)t-=1;
      if(t<1/6) return p+(q-p)*6*t;
      if(t<1/2) return q;
      if(t<2/3) return p+(q-p)*(2/3-t)*6;
      return p;
    };
    r=f(h+1/3); g=f(h); b=f(h-1/3);
  }
  return rgbToHex(r*255,g*255,b*255);
}
function mixHex(a,b,t){
  const A=hexToRgb(a), B=hexToRgb(b);
  return rgbToHex(A[0]+(B[0]-A[0])*t, A[1]+(B[1]-A[1])*t, A[2]+(B[2]-A[2])*t);
}
const THEME_COLORS=['#FFFFFF','#000000','#44546A','#4472C4','#ED7D31','#A5A5A5','#FFC000','#5B9BD5','#70AD47','#7030A0'];
const STD_COLORS=['#C00000','#FF0000','#FFC000','#FFFF00','#92D050','#00B050','#00B0F0','#0070C0','#002060','#7030A0'];
function variantsOf(hex){
  if(hex==='#FFFFFF') return ['#F2F2F2','#D9D9D9','#BFBFBF','#A6A6A6','#808080'];
  if(hex==='#000000') return ['#808080','#595959','#404040','#262626','#0D0D0D'];
  return [mixHex(hex,'#FFFFFF',0.8),mixHex(hex,'#FFFFFF',0.6),mixHex(hex,'#FFFFFF',0.4),
          mixHex(hex,'#000000',0.25),mixHex(hex,'#000000',0.5)];
}
function sampleCanvas(p){
  const k=RES/state.size;
  const x=Math.round(p.x*k), y=Math.round(p.y*k);
  if(x<0||y<0||x>=RES||y>=RES) return null;
  const d=$('composite').getContext('2d').getImageData(x,y,1,1).data;
  if(d[3]===0) return null;
  return rgbToHex(d[0],d[1],d[2]);
}
function openColorPicker(anchor,color,onPick){
  closeColorPicker();
  pickerState={color:(color||'#5AC8FA').toUpperCase(), onPick, hsl:hexToHsl(color||'#5AC8FA'),
    expanded:false, editMode:false};
  const el=document.createElement('div');
  el.id='colorPicker';
  document.body.appendChild(el);
  renderPicker();
  const r=anchor.getBoundingClientRect(), w=278;
  let left=Math.min(r.left, window.innerWidth-w-10);
  let top=r.bottom+8;
  const ph=el.offsetHeight||430;
  if(top+ph>window.innerHeight-8) top=Math.max(8, r.top-ph-8);
  el.style.left=Math.max(8,left)+'px';
  el.style.top=top+'px';
}
function closeColorPicker(){
  const el=$('colorPicker');
  if(el){
    if(pickerState) addRecentColor(pickerState.color);
    el.remove();
  }
  pickerState=null;
  if(eyedropActive){ eyedropActive=false; $('board').style.cursor=''; }
}
function setPickerColor(c, keepHue){
  if(!pickerState) return;
  pickerState.color=c.toUpperCase();
  if(!keepHue) pickerState.hsl=hexToHsl(c);
  pickerState.onPick(pickerState.color);
  const el=$('colorPicker'); if(!el) return;
  const pv=el.querySelector('#cpPreview'), hx=el.querySelector('#cpHex'), sl=el.querySelector('#cpLight');
  if(pv) pv.style.background=pickerState.color;
  if(hx && document.activeElement!==hx) hx.value=pickerState.color;
  if(sl){
    const {h,s,l}=pickerState.hsl;
    sl.style.background='linear-gradient(to right,'+hslToHex(h,s,0.95)+','+hslToHex(h,s,0.5)+','+hslToHex(h,s,0.06)+')';
    if(!keepHue) sl.value=Math.round((0.97-Math.max(0.03,Math.min(0.97,l)))/0.94*100);
  }
}
function renderPicker(){
  const el=$('colorPicker'); if(!el||!pickerState) return;
  const st=pickerState;
  const cell=(c,cls)=>'<button class="cp-c '+(cls||'')+'" data-c="'+c+'" style="background:'+c+'" title="'+c+'"></button>';
  const recents=getRecentColors();
  const shown=st.expanded ? recents : recents.slice(0,10);
  el.innerHTML=
    '<div class="cp-head">'+
      '<div id="cpPreview" style="background:'+st.color+'"></div>'+
      '<input class="inp" id="cpHex" value="'+st.color+'" maxlength="7" spellcheck="false">'+
      '<button class="cp-mini" id="cpEye" title="Conta-gotas: capturar cor de um elemento do desenho">'+
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.71 5.63l-2.34-2.34a.996.996 0 0 0-1.41 0l-3.12 3.12-1.93-1.91-1.41 1.41 1.42 1.42L3 16.25V21h4.75l9.92-9.92 1.42 1.42 1.41-1.41-1.92-1.92 3.12-3.12c.4-.4.4-1.03.01-1.42zM6.92 19L5 17.08l8.06-8.06 1.92 1.92L6.92 19z"/></svg></button>'+
      '<button class="cp-mini" id="cpClose" title="Fechar">✕</button>'+
    '</div>'+
    '<input type="range" id="cpLight" min="0" max="100" value="50" title="Tonalidade: mais claro ← → mais escuro">'+
    '<div class="cp-label">Cores do tema</div>'+
    '<div class="cp-grid">'+THEME_COLORS.map(c=>cell(c)).join('')+'</div>'+
    [0,1,2,3,4].map(row=>'<div class="cp-grid">'+THEME_COLORS.map(c=>cell(variantsOf(c)[row])).join('')+'</div>').join('')+
    '<div class="cp-label" style="margin-top:9px">Cores padrão</div>'+
    '<div class="cp-grid">'+STD_COLORS.map(c=>cell(c)).join('')+'</div>'+
    '<div class="cp-label" style="margin-top:9px"><span>Cores recentes</span><span>'+
      (recents.length?'<button class="cp-mini'+(st.editMode?' on':'')+'" id="cpEdit">'+(st.editMode?'Concluir':'Editar')+'</button>':'')+
      (recents.length>10?'<button class="cp-mini" id="cpMore">'+(st.expanded?'▲':'▼')+'</button>':'')+
    '</span></div>'+
    (recents.length
      ? '<div class="cp-grid">'+shown.map(c=>cell(c, st.editMode?'del':'')).join('')+'</div>'+
        (st.editMode?'<div class="cp-label">Clique numa cor recente para removê-la.</div>':'')
      : '<div class="cp-label">As cores que você usar aparecem aqui.</div>');
  setPickerColor(st.color);
  el.querySelectorAll('.cp-c').forEach(b=>b.onclick=()=>{
    const c=b.dataset.c;
    if(st.editMode && b.classList.contains('del')){ delRecentColor(c); renderPicker(); return; }
    setPickerColor(c);
    addRecentColor(c);
  });
  el.querySelector('#cpHex').onchange=e=>{
    let v=e.target.value.trim(); if(v && v[0]!=='#') v='#'+v;
    if(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)){
      if(v.length===4) v='#'+v[1]+v[1]+v[2]+v[2]+v[3]+v[3];
      setPickerColor(v); addRecentColor(v);
    } else e.target.value=st.color;
  };
  el.querySelector('#cpLight').oninput=e=>{
    const {h,s}=st.hsl;
    const L=0.97 - (e.target.value/100)*0.94;
    st.hsl={h,s,l:L};
    setPickerColor(hslToHex(h,s,L), true);
  };
  el.querySelector('#cpEye').onclick=()=>{
    eyedropActive=true;
    $('board').style.cursor='copy';
    toast('Clique num ponto do desenho para capturar a cor.');
  };
  el.querySelector('#cpClose').onclick=()=>closeColorPicker();
  const me=el.querySelector('#cpMore'); if(me) me.onclick=()=>{ st.expanded=!st.expanded; renderPicker(); };
  const ed=el.querySelector('#cpEdit'); if(ed) ed.onclick=()=>{ st.editMode=!st.editMode; renderPicker(); };
}
/* conta-gotas: intercepta o clique no board antes das ferramentas */
$('board').addEventListener('pointerdown',e=>{
  if(!eyedropActive) return;
  e.stopPropagation(); e.preventDefault();
  const c=sampleCanvas(boardPoint(e));
  eyedropActive=false; $('board').style.cursor='';
  if(c) setPickerColor(c);
  else toast('Área transparente — nenhuma cor nesse ponto.');
}, true);
/* fecha ao clicar fora */
document.addEventListener('pointerdown',e=>{
  if(!pickerState || eyedropActive) return;
  const el=$('colorPicker');
  if(el && !el.contains(e.target) && !e.target.classList.contains('cswatch')) closeColorPicker();
}, true);
/* campo de cor reutilizável: quadradinho + hex editável */
function colorField(id,val){
  return '<div class="row"><label class="lbl">Cor</label>'+
    '<button class="cswatch" id="'+id+'" style="background:'+val+'"></button>'+
    '<input class="inp hexinp" id="'+id+'tx" value="'+String(val).toUpperCase()+'" maxlength="7" spellcheck="false"></div>';
}
function bindColorField(id, getV, setV){
  const sw=$(id), tx=$(id+'tx');
  if(!sw) return;
  const apply=v=>{ setV(v); sw.style.background=v; if(tx&&document.activeElement!==tx) tx.value=v.toUpperCase(); };
  sw.onclick=e=>{ e.preventDefault(); openColorPicker(sw, getV(), apply); };
  if(tx) tx.onchange=()=>{
    let v=tx.value.trim(); if(v && v[0]!=='#') v='#'+v;
    if(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)){
      if(v.length===4) v='#'+v[1]+v[1]+v[2]+v[2]+v[3]+v[3];
      apply(v.toUpperCase()); addRecentColor(v);
    } else tx.value=String(getV()).toUpperCase();
  };
}
/* ---------------- Teclado ---------------- */
document.addEventListener('keydown',e=>{
  const t=e.target;
  if(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT') return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){ e.preventDefault(); if(e.shiftKey) redo(); else undo(); return; }
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){ e.preventDefault(); redo(); return; }
  const k=e.key.toLowerCase();
  if(k==='d') setTool('draw');
  if(k==='g') setTool('shape');
  if(k==='e') setTool('erase');
  if(k==='b') setTool('bucket');
  if(k==='s') setTool('select');
  if(k==='n') setTool('nodes');
  if(k==='r') setTool('ref');
  if(e.key==='Escape'){ state.selId=null; state.multi=[]; renderUi(); renderPanel(); if(smoothSession) smoothRetarget(); }
  if((state.selId!=null || state.multi.length>1) && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){
    const targets = state.multi.length>1
      ? state.items.filter(i=>i.kind==='stroke' && state.multi.includes(i.id))
      : (selItem() && selItem().kind==='stroke' ? [selItem()] : []);
    if(targets.length){
      e.preventDefault();
      const st=e.shiftKey?10:1;
      const dx=e.key==='ArrowLeft'?-st:(e.key==='ArrowRight'?st:0);
      const dy=e.key==='ArrowUp'?-st:(e.key==='ArrowDown'?st:0);
      if(Date.now()-lastNudge>800) pushUndo();
      lastNudge=Date.now();
      for(const it of targets){
        it.pts=it.pts.map(q=>({x:q.x+dx,y:q.y+dy}));
        it.raw=it.raw.map(q=>({x:q.x+dx,y:q.y+dy}));
        rebuildPath(it); syncTwin(it);
      }
      compose(); renderHits(); renderUi(); autosave();
      return;
    }
  }
  if((e.key==='Delete'||e.key==='Backspace') && (state.selId!=null || state.multi.length)){
    pushUndo();
    const ids = state.multi.length ? state.multi.slice() : [state.selId];
    state.items=state.items.filter(x=>!ids.includes(x.id));
    state.selId=null; state.multi=[];
    compose(); renderHits(); renderPanel(); autosave();
  }
});
/* deseleciona clicando no vazio */
$('board').addEventListener('pointerdown',e=>{
  if((state.tool==='select'||state.tool==='nodes') && (e.target===overlay||e.target.id==='composite')){
    if(state.tool==='select' && (e.button===undefined || e.button===0)){
      e.preventDefault();
      startMarquee(e);
      return;
    }
    state.selId=null; state.multi=[]; renderUi(); renderPanel();
    if(smoothSession) smoothRetarget();
  }
});
/* ---------------- Zoom com scroll e pan ---------------- */
const ws=$('workspace');
ws.addEventListener('wheel',e=>{
  e.preventDefault();
  const old=state.zoom;
  const nz=Math.max(0.5, Math.min(2.5, old*(e.deltaY<0 ? 1.1 : 1/1.1)));
  if(Math.abs(nz-old)<0.001) return;
  const rect=$('board').getBoundingClientRect();
  const px=e.clientX-rect.left, py=e.clientY-rect.top;
  const k=nz/old;
  state.zoom=nz;
  applyBoardSize(); applyRef();
  ws.scrollLeft += px*(k-1);
  ws.scrollTop  += py*(k-1);
  const z=$('cvZoom');
  if(z){ z.value=Math.round(nz*100); const zv=$('cvZoomv'); if(zv) zv.textContent=Math.round(nz*100)+'%'; }
},{passive:false});
let panning=null;
ws.addEventListener('pointerdown',e=>{
  const empty = !e.target.closest('.thandle') && !e.target.closest('.node') &&
    ['overlay','composite','underlay','board','workspace','stage','refImg'].includes(e.target.id||'');
  if(e.button===1 || (e.button===2 && empty)){
    e.preventDefault(); e.stopPropagation();
    panning={x:e.clientX, y:e.clientY, sl:ws.scrollLeft, st:ws.scrollTop};
    ws.style.cursor='grabbing';
  }
},true);
document.addEventListener('pointermove',e=>{
  if(!panning) return;
  ws.scrollLeft=panning.sl-(e.clientX-panning.x);
  ws.scrollTop=panning.st-(e.clientY-panning.y);
});
document.addEventListener('pointerup',()=>{ if(panning){ panning=null; ws.style.cursor=''; } });
ws.addEventListener('contextmenu',e=>e.preventDefault());

/* ---------------- Init ---------------- */
function init(){
  applyTheme(localStorage.getItem(THEME_KEY)||'dark');
  pendingStyle=NEW_STROKE();
  buildBoard();
  applyBg();
  attachDrawEvents();
  try{
    const sv=localStorage.getItem(AUTOSAVE_KEY);
    if(sv) loadProjectData(JSON.parse(sv));
  }catch(e){}
  renderPanel(); updateUndoBtns();
  if('serviceWorker' in navigator && location.protocol.startsWith('http')){
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
}
init();
