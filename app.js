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
  marginPx: 0,          // margem (moldura interna) em px; 0 = desligada
  snapOn: false,        // grade magnética (atrai objetos às linhas) — começa desativada
  drawMode: 'free',     // 'free' | 'straight' | 'curve'
  joinEnds: false,      // conectar pontas: funde traços cujas pontas se tocam
  trimJoin: false,      // ajustar pontas: torna a junção perfeita (corta/completa)
  showProps: true,      // "Ver propriedades dos objetos": HUD no topo com cor/posição/tamanho (habilitado por padrão)
  items: [],           // {id,kind:'stroke'|'fill', erase, raw, pts, closed, processed, nib, w, color, opacity, cap, fillOn, fill, fillOpacity, d}
  nextId: 1,
  tool: 'select',
  selId: null,
  multi: [],
  zoom: 1,
  mirror: 'off',       // 'off' | 'v' | 'h'
  shapeKind: 'rect',
  cornerR: 0.22,
  globalLine: '#1D2333',   // cor de LINHA ativa (global, predefinida) — vale para todas as ferramentas
  globalFill: '#5AC8FA',   // cor de PREENCHIMENTO ativa (global, predefinida)
  globalLineOff: false,    // linha sem cor
  globalFillOn: true,      // preenchimento ativo
  navMode: 'select',   // último modo do FAB de navegação: 'select' | 'pan'
  lastCreate: 'draw',  // última ferramenta de criação usada (ícone do FAB esquerdo) — lápis por padrão
  bucket: { color:'#5ac8fa', tolerance:60, opacity:100 },
  ref: { src:null, x:0, y:0, scale:1, opacity:40, visible:true }
};
let undoStack=[], redoStack=[];
const THEME_KEY='iconcraft-theme', AUTOSAVE_KEY='iconcraft-autosave', PROJECTS_KEY='iconcraft-projects';

function defaultInk(){
  return document.documentElement.dataset.theme==='dark' ? '#e8ecf5' : '#1d2333';
}
let pendingStyle=null;  // {w,color,nib,cap,...} para os próximos traços
let currentProjectName=null;  // nome do projeto aberto (null = novo/não salvo)
let projectDirty=false;       // há alterações não salvas?
function markDirty(){ projectDirty=true; updateSaveBtn(); }
function updateSaveBtn(){
  const sb=$('projSaveOver');
  if(sb) sb.disabled = !projectDirty;   // só habilita se há o que salvar
}
const NEW_STROKE = () => ({
  w:8, w2:4,
  color: (state.globalLine!=null ? state.globalLine : defaultInk()),
  opacity:100, cap:'round', nib:'round',
  fillOn: !!state.globalFillOn,
  fill: (state.globalFill!=null ? state.globalFill : '#5ac8fa'),
  fillOpacity:100,
  lineOff: !!state.globalLineOff
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
const NIB_ANGLE={h:0, v:Math.PI/2, d1:3*Math.PI/4, d2:Math.PI/4};
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
  const host = state.gridAbove ? gGrid : underlay;
  if(!state.gridOn){ drawMargin(host); return; }
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
  drawMargin(host);
}
function drawMargin(host){
  // moldura de margem: retângulo interno mais grosso, exatamente sobre linhas da grade
  const m=state.marginPx||0, n=state.size;
  if(m<=0 || m*2>=n) return;
  const g=host || (state.gridAbove ? gGrid : underlay);
  const rect=document.createElementNS(SVGNS,'rect');
  rect.setAttribute('x',m); rect.setAttribute('y',m);
  rect.setAttribute('width',n-2*m); rect.setAttribute('height',n-2*m);
  rect.setAttribute('fill','none');
  rect.setAttribute('stroke','#99CC33');
  rect.setAttribute('stroke-opacity','.7');
  rect.setAttribute('stroke-width','2.4');
  rect.setAttribute('vector-effect','non-scaling-stroke');
  g.appendChild(rect);
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
function lineColorOf(it){
  // linha "sem cor": adota a cor do preenchimento (some sem perder a forma)
  if(it.lineOff && it.fillOn) return it.fill;
  return it.color;
}
function paintStroke(c, it, uniform){
  c.save();
  if(it.erase) c.globalCompositeOperation='destination-out';
  const p=itemPath2D(it);
  const a=(it.erase||uniform)?1:(it.opacity/100);
  if(it.nib==='round'){
    if(!it.erase && it.fillOn && it.closed){
      c.globalAlpha=uniform?1:(a*(it.fillOpacity/100));
      c.fillStyle=it.fill;
      c.fill(p);
    }
    c.globalAlpha=a;
    c.strokeStyle=it.erase?'#000':lineColorOf(it);
    c.lineWidth=it.w;
    c.lineCap=it.cap;
    c.lineJoin=(it.cap==='round')?'round':(it.cap==='square'?'miter':'bevel');
    c.miterLimit=4;
    c.stroke(p);
  } else {
    // pena caligráfica: preenchimento usa o CONTORNO da forma (it.d), não a fita da pena
    if(!it.erase && it.fillOn && it.closed){
      c.globalAlpha=uniform?1:(a*(it.fillOpacity/100));
      c.fillStyle=it.fill;
      c.fill(new Path2D(it.d));
    }
    c.globalAlpha=a;
    const col=it.erase?'#000':lineColorOf(it);
    c.fillStyle=col;
    c.fill(p);
    c.strokeStyle=col;
    c.lineWidth=Math.max(1, it.w2!=null?it.w2:4);
    c.lineCap='round';
    c.stroke(p);
  }
  c.restore();
}
let refCv=null, fillCv=null;
function drawAllStrokes(ctx,k){
  for(const it of state.items){
    if(it.kind!=='stroke') continue;
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
function compose(){
  const cv=$('composite'), ctx=cv.getContext('2d');
  const k=RES/state.size;
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,RES,RES);
  // desenha cada objeto na ORDEM da pilha (índice maior = mais acima).
  // legado: itens antigos kind:'fill' (balde) ainda pintam ao fundo da região.
  const legacyFills=state.items.filter(i=>i.kind==='fill');
  if(legacyFills.length){
    if(!refCv) refCv=document.createElement('canvas');
    refCv.width=RES; refCv.height=RES;
    const rctx=refCv.getContext('2d');
    rctx.setTransform(k,0,0,k,0,0); rctx.lineJoin='round';
    drawAllStrokes(rctx,k);
    const refD=rctx.getImageData(0,0,RES,RES).data;
    const lay=new ImageData(RES,RES);
    for(const f of legacyFills) floodIntoLayer(refD, lay.data, f, k);
    if(!fillCv) fillCv=document.createElement('canvas');
    fillCv.width=RES; fillCv.height=RES;
    fillCv.getContext('2d').putImageData(lay,0,0);
    ctx.drawImage(fillCv,0,0);
  }
  ctx.setTransform(k,0,0,k,0,0);
  ctx.lineJoin='round';
  // agora cada traço (com seu preenchimento próprio) na ordem de empilhamento
  drawAllStrokes(ctx,k);
}
/* balde: calcula a região limitada pelos traços e pinta na CAMADA DE FUNDO */
function floodIntoLayer(refD, layD, op, k){
  const W=RES, H=RES;
  const px=Math.round(op.x*k), py=Math.round(op.y*k);
  if(px<0||py<0||px>=W||py>=H) return;
  const idx=(py*W+px)*4;
  const t=[refD[idx],refD[idx+1],refD[idx+2],refD[idx+3]];
  const [nr,ng,nb]=hexToRgb(op.color);
  const na=Math.round(255*(op.opacity!=null?op.opacity:100)/100);
  const tol=(state.bucket.tolerance||60);
  const match=i=>{
    const dr=refD[i]-t[0], dg=refD[i+1]-t[1], db=refD[i+2]-t[2], da=refD[i+3]-t[3];
    return dr*dr+dg*dg+db*db+da*da <= tol*tol;
  };
  const seen=new Uint8Array(W*H);
  const paint=i=>{ layD[i*4]=nr; layD[i*4+1]=ng; layD[i*4+2]=nb; layD[i*4+3]=na; };
  const stack=[[px,py]];
  while(stack.length){
    let [x,y]=stack.pop();
    let i=y*W+x;
    while(x>=0 && match(i*4) && !seen[i]){ x--; i--; }
    x++; i++;
    let up=false, dn=false;
    while(x<W && match(i*4) && !seen[i]){
      seen[i]=1; paint(i);
      if(y>0){ const j=i-W; if(!seen[j]&&match(j*4)){ if(!up){stack.push([x,y-1]);up=true;} } else up=false; }
      if(y<H-1){ const j=i+W; if(!seen[j]&&match(j*4)){ if(!dn){stack.push([x,y+1]);dn=true;} } else dn=false; }
      x++; i++;
    }
  }
  // dilata 2px: como a camada fica POR BAIXO dos traços, isso só
  // cola o fundo na borda — nunca cobre nada visível
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
    for(const i of add){ seen[i]=1; paint(i); }
  }
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
let drawing=null, liveA=null, liveB=null, pendingShapePts=null, shaping=null, lineDraw=null, curveEdit=null, curveDrag=null;
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
    const cap=pendingStyle.cap||'round';
    el.setAttribute('fill','none');
    el.setAttribute('stroke',col);
    el.setAttribute('stroke-width',pendingStyle.w);
    el.setAttribute('stroke-linecap',cap);
    el.setAttribute('stroke-linejoin', cap==='round'?'round':(cap==='square'?'miter':'bevel'));
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
  // fecha automaticamente se o traço termina perto de onde começou
  let closed=false;
  if(!erase && pts.length>8){
    const a=pts[0], b=pts[pts.length-1];
    const gap=Math.hypot(a.x-b.x, a.y-b.y);
    const L=pathLen(pts);
    if(gap < Math.max(14, L*0.10)) closed=true;
  }
  const s={
    id:state.nextId++, kind:'stroke', erase:!!erase,
    raw:pts.map(p=>({x:+p.x.toFixed(2),y:+p.y.toFixed(2)})),
    pts:null, closed:closed, processed:false, d:null,
    ...pendingStyle
  };
  if(erase){ s.fillOn=false; }
  s.pts=s.raw.map(p=>({...p}));
  s.d=polyPath(s.pts, s.closed);
  return s;
}
function arcThrough(a, m, b, N){
  // gera N+1 pontos de um arco de círculo que passa por a, m, b.
  // se os 3 forem quase colineares, retorna a reta.
  N=N||24;
  const ax=a.x, ay=a.y, bx=b.x, by=b.y, mx=m.x, my=m.y;
  const d=2*(ax*(by-my)+bx*(my-ay)+mx*(ay-by));
  if(Math.abs(d)<1e-6){
    const out=[]; for(let i=0;i<=N;i++){const t=i/N; out.push({x:ax+(bx-ax)*t,y:ay+(by-ay)*t});} return out;
  }
  const ux=((ax*ax+ay*ay)*(by-my)+(bx*bx+by*by)*(my-ay)+(mx*mx+my*my)*(ay-by))/d;
  const uy=((ax*ax+ay*ay)*(mx-bx)+(bx*bx+by*by)*(ax-mx)+(mx*mx+my*my)*(bx-ax))/d;
  const cx=ux, cy=uy;                       // centro do círculo
  const r=Math.hypot(ax-cx, ay-cy);
  let a0=Math.atan2(ay-cy, ax-cx);
  let a1=Math.atan2(by-cy, bx-cx);
  let am=Math.atan2(my-cy, mx-cx);
  // normaliza para o arco percorrer a->m->b na direção certa
  const norm=(x)=>{ while(x<0)x+=2*Math.PI; while(x>=2*Math.PI)x-=2*Math.PI; return x; };
  a0=norm(a0); a1=norm(a1); am=norm(am);
  let start=a0, end=a1;
  // escolhe o sentido que passa por am
  let cw = ( (norm(am-a0) <= norm(a1-a0)) );
  const out=[];
  for(let i=0;i<=N;i++){
    const t=i/N;
    let ang;
    if(cw){ ang = a0 + norm(a1-a0)*t; }
    else  { ang = a0 - norm(a0-a1)*t; }
    out.push({x:cx+r*Math.cos(ang), y:cy+r*Math.sin(ang)});
  }
  return out;
}
// --------- conectar pontas: funde traços cujas pontas se tocam ---------
function endpointsOf(it){
  const p=it.pts; if(!p||p.length<2) return null;
  return {first:p[0], last:p[p.length-1]};
}
// distância de um ponto ao segmento
function distToSeg(p,a,b){
  const dx=b.x-a.x, dy=b.y-a.y; const L2=dx*dx+dy*dy||1e-9;
  let t=((p.x-a.x)*dx+(p.y-a.y)*dy)/L2; t=Math.max(0,Math.min(1,t));
  return Math.hypot(p.x-(a.x+dx*t), p.y-(a.y+dy*t));
}
// tenta conectar o traço "s" (recém-criado) a um traço aberto existente.
// retorna o item resultante (fundido) ou o próprio s.
function tryJoinEnds(s){
  if(!state.joinEnds) return s;
  if(s.erase || s.closed || !s.pts || s.pts.length<2) return s;
  const tol=Math.max(14, s.w*1.2 + 8);   // "muito próxima": tolera imprecisão do usuário
  const se=endpointsOf(s);
  // procura candidato: outro stroke aberto cuja ponta esteja perto de uma ponta de s
  for(let i=state.items.length-1;i>=0;i--){
    const o=state.items[i];
    if(o===s || o.kind!=='stroke' || o.erase || o.closed) continue;
    if(o.id===s.id) continue;
    if(!o.pts || o.pts.length<2) continue;
    if(s.link && o.id===s.link.id) continue;   // não funde com o próprio espelho
    const oe=endpointsOf(o);
    // 4 combinações de pontas
    const combos=[
      ['last','first'],  // s.last -> o.first : s + o
      ['last','last'],   // s.last -> o.last  : s + reverse(o)
      ['first','last'],  // s.first-> o.last  : o + s
      ['first','first']  // s.first-> o.first : reverse(o) + s
    ];
    for(const [sk,ok] of combos){
      const d=Math.hypot(se[sk].x-oe[ok].x, se[sk].y-oe[ok].y);
      if(d<=tol){
        return fuseStrokes(o, s, sk, ok);
      }
    }
  }
  // também: se as duas pontas de s tocam a mesma peça (fechar a própria), fecha
  const dSelf=Math.hypot(se.first.x-se.last.x, se.first.y-se.last.y);
  if(dSelf<=tol && s.pts.length>6){ s.closed=true; rebuildPath(s); }
  return s;
}
// funde o->s numa peça só. sk/ok indicam quais pontas se encontram.
function fuseStrokes(o, s, sk, ok){
  // monta a sequência de pontos de o + s conectando as pontas certas
  let op=o.pts.map(p=>({...p}));
  let sp=s.pts.map(p=>({...p}));
  // queremos: [...o até a ponta 'ok'] emendado com [s a partir da ponta 'sk']
  // orienta o para terminar em 'ok'
  if(ok==='first') op.reverse();       // agora o termina no que era 'first'
  // orienta s para começar em 'sk'
  if(sk==='last') sp.reverse();        // agora s começa no que era 'last'
  let pts=op.concat(sp);

  if(state.trimJoin) pts=trimJunction(pts, op.length);

  // resolve a junção geral (remove duplicados muito próximos)
  pts=dedupePts(pts);

  o.pts=pts; o.raw=pts.map(p=>({...p}));
  o.processed=true;
  // se virou uma volta fechada, fecha
  const g=Math.hypot(pts[0].x-pts[pts.length-1].x, pts[0].y-pts[pts.length-1].y);
  o.closed = g < Math.max(14, o.w*1.2+8) && pts.length>6;
  rebuildPath(o);
  // remove s (e o espelho de s, se houver) — a peça agora é "o"
  removeItemById(s.id);
  if(s.link && s.link.id!=null) removeItemById(s.link.id);
  state.selId=o.id; state.multi=[];
  return o;
}
function dedupePts(pts){
  const out=[pts[0]];
  for(let i=1;i<pts.length;i++){
    const a=out[out.length-1], b=pts[i];
    if(Math.hypot(a.x-b.x,a.y-b.y)>0.6) out.push(b);
  }
  return out;
}
// "ajustar pontas": limpa a região da junção (corta excesso / completa a costura)
function trimJunction(pts, joinIdx){
  // joinIdx = índice onde s começa (a costura fica entre joinIdx-1 e joinIdx)
  if(joinIdx<2 || joinIdx>pts.length-2) return pts;
  const A=pts[joinIdx-1], B=pts[joinIdx];
  const mid={x:(A.x+B.x)/2, y:(A.y+B.y)/2};
  // funde os dois pontos da costura num ponto médio (elimina rebarba/degrau)
  const out=pts.slice(0,joinIdx-1);
  out.push(mid);
  out.push(...pts.slice(joinIdx+1));
  // suaviza levemente ao redor da costura para não deixar quina dura
  const j=out.findIndex(p=>p===mid);
  if(j>0 && j<out.length-1){
    const a=out[j-1], b=out[j], c=out[j+1];
    out[j]={x:(a.x+2*b.x+c.x)/4, y:(a.y+2*b.y+c.y)/4};
  }
  return out;
}
function removeItemById(id){
  const i=state.items.findIndex(x=>x.id===id);
  if(i>=0) state.items.splice(i,1);
}
function attachDrawEvents(){
  const board=$('board');
  board.addEventListener('pointerdown',e=>{
    if(eyedropActive) return;   // conta-gotas ativo: o board de desenho/ref não reage
    if(state.tool==='pan'){ panPointerDown(e); return; }
    if(state.tool==='ref' && e.target.id==='refImg'){ startRefDrag(e); return; }
    const t=state.tool;
    // ajuste de curvatura: arrastar puxa o meio da linha curva recém-criada
    if(t==='draw' && state.drawMode==='curve' && curveEdit){
      const it=state.items.find(x=>x.id===curveEdit.id);
      if(it){
        board.setPointerCapture(e.pointerId);
        curveDrag={id:it.id, a:curveEdit.a, b:curveEdit.b};
        e.preventDefault(); return;
      } else { curveEdit=null; }
    }
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
    // modos LINHA RETA e CURVA (só no lápis): traça entre início e fim
    if(t==='draw' && (state.drawMode==='straight' || state.drawMode==='curve')){
      curveEdit=null;   // nova linha: encerra ajuste da curva anterior
      const p=boardPoint(e);
      lineDraw={a:p, b:p, mode:state.drawMode};
      liveA=makeLive(false);
      if(state.mirror!=='off'){ liveB=makeLive(false); liveB.classList.add('mirror-live'); }
      e.preventDefault(); return;
    }
    drawing={pts:[boardPoint(e)], mode:t};
    liveA=makeLive(t==='erase');
    if(state.mirror!=='off'){ liveB=makeLive(t==='erase'); liveB.classList.add('mirror-live'); }
    e.preventDefault();
  });
  board.addEventListener('pointermove',e=>{
    if(curveDrag){
      const it=state.items.find(x=>x.id===curveDrag.id); if(!it) { curveDrag=null; return; }
      const m=boardPoint(e);
      const pts=arcThrough(curveDrag.a, m, curveDrag.b, 40);
      it.pts=pts.map(p=>({...p})); it.raw=pts.map(p=>({...p})); it.linear=false;
      it.lineEnds=[{...curveDrag.a},{...curveDrag.b}]; it._curveMid={...m};
      rebuildPath(it); if(it.link) syncTwin(it);
      if(!nodeRAF) nodeRAF=requestAnimationFrame(()=>{ nodeRAF=null; compose(); renderUi(); });
      return;
    }
    if(lineDraw){
      lineDraw.b=boardPoint(e);
      const pts=[lineDraw.a, lineDraw.b];
      updateLive(liveA, pts);
      if(liveB) updateLive(liveB, pts.map(mirrorPoint));
      return;
    }
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
    if(curveDrag){
      const it=state.items.find(x=>x.id===curveDrag.id);
      curveDrag=null;
      if(it){
        const joined=tryJoinEnds(it);   // conecta pontas após ajustar a curva
        if(joined!==it){ curveEdit=null; state.selId=joined.id; }
        compose(); renderHits(); renderPanel(); autosave();
      }
      return;
    }
    if(lineDraw){
      if(liveA){liveA.remove();liveA=null;}
      if(liveB){liveB.remove();liveB=null;}
      const {a,b,mode}=lineDraw; lineDraw=null;
      if(Math.hypot(b.x-a.x,b.y-a.y)<4) return;   // muito curto, ignora
      pushUndo();
      // amostra a reta em vários pontos (para o modo curva poder encurvar depois)
      const N=24, pts=[];
      for(let i=0;i<=N;i++){ const t=i/N; pts.push({x:a.x+(b.x-a.x)*t, y:a.y+(b.y-a.y)*t}); }
      const s={id:state.nextId++, kind:'stroke', erase:false,
        raw:pts.map(p=>({...p})), pts:pts.map(p=>({...p})),
        closed:false, processed:true, linear:true, d:null, ...pendingStyle,
        lineKind:(mode==='curve'?'curve':'straight'), lineEnds:[{...a},{...b}]};
      rebuildPath(s);
      state.items.push(s);
      if(state.mirror!=='off'){
        const m=JSON.parse(JSON.stringify(s)); m.id=state.nextId++;
        m.pts=m.pts.map(mirrorPoint).reverse(); m.raw=m.raw.map(mirrorPoint).reverse();
        m.nib=mirrorNib(s.nib);
        if(m.lineEnds) m.lineEnds=m.lineEnds.map(mirrorPoint).reverse();
        rebuildPath(m);
        s.link={id:m.id,axis:state.mirror}; m.link={id:s.id,axis:state.mirror};
        state.items.push(m);
      }
      state.selId=s.id; state.multi=[];
      if(mode==='curve'){
        // curva: só conecta depois do ajuste (ao puxar o meio ou ao encerrar)
        curveEdit={id:s.id, a:{...a}, b:{...b}};
      } else {
        // reta: conecta pontas imediatamente (se habilitado)
        const joined=tryJoinEnds(s); state.selId=joined.id;
      }
      compose(); renderHits(); renderUi(); renderPanel(); autosave();
      return;
    }
    if(shaping){
      if(liveA){liveA.remove();liveA=null;}
      if(liveB){liveB.remove();liveB=null;}
      const {a,b}=shaping; shaping=null;
      if(Math.abs(b.x-a.x)<4 && Math.abs(b.y-a.y)<4) return;
      pushUndo();
      const fit=fitShape(state.shapeKind,[a,b]);
      const s={id:state.nextId++, kind:'stroke', erase:false,
        raw:fit.pts.map(p=>({...p})), pts:fit.pts.map(p=>({...p})),
        closed:fit.closed, processed:true, linear:true, d:null, ...pendingStyle,
        shapeKind:state.shapeKind, shapeBox:{minX:Math.min(a.x,b.x),minY:Math.min(a.y,b.y),maxX:Math.max(a.x,b.x),maxY:Math.max(a.y,b.y)},
        cornerR:(state.shapeKind==='rrect'?(state.cornerR!=null?state.cornerR:0.22):null)};
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
    // conectar pontas (se habilitado): funde com traço cuja ponta esteja próxima
    const joined=tryJoinEnds(s);
    // seleciona o traço recém-criado (ou o fundido) para ajuste ao vivo pelo painel
    state.selId=joined.id; state.multi=[];
    compose(); renderHits(); renderUi(); autosave();
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
    const rr = (state.cornerR!=null?state.cornerR:0.22);
    const r=Math.max(0.5, Math.min(w,h)*0.5*rr);
    const STEPS=10;
    const cornersDef=[
      [maxX-r,minY+r,-Math.PI/2,0],[maxX-r,maxY-r,0,Math.PI/2],
      [minX+r,maxY-r,Math.PI/2,Math.PI],[minX+r,minY+r,Math.PI,1.5*Math.PI]
    ];
    for(const [ax,ay,a0,a1] of cornersDef)
      for(let i=0;i<=STEPS;i++){
        const a=a0+(a1-a0)*i/STEPS;
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
function updateMirrorButton(){
  const on = state.mirror!=='off';
  $('mirrorLbl').textContent = 'Espelho: ' + (state.mirror==='off'?'off':(state.mirror==='v'?'↔ vertical':'↕ horizontal'));
  $('btnMirror').classList.toggle('primary', on);
  const ic=$('mirrorIcon');
  if(ic) ic.style.transform = state.mirror==='h' ? 'rotate(90deg)' : 'none';
}
function setMirror(m){
  state.mirror=m;
  updateMirrorButton();
  toast(m==='off' ? 'Espelho ao vivo desligado.'
    : 'Espelho ao vivo '+(m==='v'?'vertical':'horizontal')+': desenhe de um lado e o outro replica.');
}
function openPopMenu(menu, anchor){
  closePopMenus();
  menu.classList.add('open');
  const r=anchor.getBoundingClientRect();
  const mw=menu.offsetWidth, mh=menu.offsetHeight;
  let left=r.left, top=r.bottom+6;
  if(left+mw>window.innerWidth-8) left=window.innerWidth-mw-8;
  if(top+mh>window.innerHeight-8) top=Math.max(8, r.top-mh-6);
  // âncoras na toolbox lateral abrem ao lado
  if(anchor.closest('#toolbox') && window.innerWidth>=768){ left=r.right+8; top=r.top; if(top+mh>window.innerHeight-8) top=window.innerHeight-mh-8; }
  menu.style.left=Math.max(8,left)+'px';
  menu.style.top=top+'px';
}
function closePopMenus(){ document.querySelectorAll('.popmenu.open').forEach(m=>m.classList.remove('open')); }
$('btnMirror').onclick=e=>{ e.stopPropagation(); openPopMenu($('mirrorMenu'), $('btnMirror')); };
$('mirrorMenu').querySelectorAll('button').forEach(b=>b.onclick=()=>{ setMirror(b.dataset.mirror); closePopMenus(); });
document.addEventListener('pointerdown',e=>{
  if(!e.target.closest('.popmenu') && !e.target.closest('#btnMirror') && !e.target.closest('#btnSaveTool') && !e.target.closest('#btnClearAll')) closePopMenus();
},true);
/* --------- balde --------- */
function fillObjectAt(p, color, op){
  // encontra o objeto (fechado OU cujo contorno cerca o ponto) mais acima e o preenche.
  // traços abertos cuja área contém o ponto são FECHADOS e viram forma unificada
  // (preenchimento + linha como uma única unidade, igual às formas geométricas).
  const cv=$('composite'); const k=RES/state.size;
  const ctx=cv.getContext('2d');
  for(let i=state.items.length-1;i>=0;i--){
    const it=state.items[i];
    if(it.kind!=='stroke' || it.erase) continue;
    if(!it.pts || it.pts.length<3) continue;
    // testa o interior do contorno (usa o path fechado do traço)
    const closedD = it.closed ? it.d : polyPath(it.pts, true);
    const path = it.closed ? itemPath2D(it) : new Path2D(closedD);
    ctx.save(); ctx.setTransform(k,0,0,k,0,0);
    const inside=ctx.isPointInPath(path, p.x*k, p.y*k);
    ctx.restore();
    if(inside){
      // se era aberto, fecha-o de vez: passa a ser uma forma como as geométricas
      if(!it.closed){
        it.closed=true;
        rebuildPath(it);
      }
      it.fillOn=true; it.fill=color;
      it.fillOpacity=(op!=null?op:100);
      return it;
    }
  }
  return null;
}
function doBucket(e){
  const p=boardPoint(e);
  const col=state.bucket.color;
  const op=(state.bucket.opacity!=null?state.bucket.opacity:100);
  pushUndo();
  const hit=fillObjectAt(p, col, op);
  if(hit){
    syncTwin(hit);
    if(state.mirror!=='off'){ const m=mirrorPoint(p); const h2=fillObjectAt(m,col,op); if(h2) syncTwin(h2); }
    compose(); renderHits(); renderPanel(); autosave();
  } else {
    // nenhum objeto fechado sob o clique: cai no balde legado (região por pixels)
    state.items.push({id:state.nextId++, kind:'fill', x:+p.x.toFixed(1), y:+p.y.toFixed(1),
      color:col, opacity:op});
    if(state.mirror!=='off'){
      const m=mirrorPoint(p);
      state.items.push({id:state.nextId++, kind:'fill', x:+m.x.toFixed(1), y:+m.y.toFixed(1), color:col, opacity:op});
    }
    compose(); renderPanel(); autosave();
  }
}
/* ============================================================
   SELEÇÃO, NÓS, REFERÊNCIA, PROCESSAMENTO, UNDO
   ============================================================ */
function lastObject(){
  for(let i=state.items.length-1;i>=0;i--){ if(state.items[i].kind==='stroke') return state.items[i]; }
  return null;
}
function selItem(){ return state.items.find(i=>i.id===state.selId); }
function setSelection(ids){
  ids=[...new Set(ids)].filter(id=>state.items.some(i=>i.id===id && i.kind==='stroke'));
  if(ids.length<=1){ state.selId = ids.length ? ids[0] : null; state.multi=[]; }
  else { state.selId=null; state.multi=ids; }
  // não abre o painel automaticamente: o usuário usa a aba/seta quando quiser
  // (evita a caixa cobrindo a tela ao mover/redimensionar)
}
function renderHits(){
  gHits.innerHTML='';
  for(const it of state.items){
    if(it.kind!=='stroke' || !it.d) continue;
    const hit=document.createElementNS(SVGNS,'path');
    hit.setAttribute('class','stroke-hit');
    hit.setAttribute('d',it.d);
    hit.setAttribute('fill', it.closed ? 'rgba(0,0,0,0)' : 'none');
    hit.setAttribute('stroke','transparent');
    hit.setAttribute('stroke-width',Math.max(14,it.w+8));
    const noHit=eyedropActive || ['draw','erase','shape','pan','select','smooth','modify','nodes'].includes(state.tool);
    hit.style.cursor = noHit ? 'inherit' : 'pointer';
    // select é resolvido pelo board (objectAtPoint); aqui capturamos só p/ nodes etc.
    // no conta-gotas, os hits ficam inertes: clicar só prova a cor, sem selecionar/arrastar.
    hit.style.pointerEvents = noHit ? 'none' : (it.closed ? 'all' : 'stroke');
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
  if(typeof refreshBrushCursor==='function') refreshBrushCursor();
}
function renderUi(){
  updateOrderFabs();
  updateColorBtn();
  updatePropsHud();
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
    c.setAttribute('class','node'+(nodeSubmode==='remove'?' node-rem':(nodeSubmode==='add'?' node-dim':'')));
    c.setAttribute('pointer-events','auto');
    c.setAttribute('vector-effect','non-scaling-stroke');
    c.addEventListener('pointerdown',e=>{
      e.stopPropagation(); e.preventDefault();
      if(nodeSubmode==='remove'){
        if(it.pts.length<=(it.closed?3:2)){ toast('O traço precisa de pelo menos '+(it.closed?3:2)+' pontos.'); return; }
        pushUndo();
        it.pts.splice(i,1); rebuildPath(it); syncTwin(it);
        compose(); renderHits(); renderUi(); renderPanel(); autosave();
        return;
      }
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

  // alça de arredondamento (só para retângulo arredondado)
  if(it.shapeKind==='rrect' && it.cornerR!=null){
    const w=bb.x1-bb.x0, h=bb.y1-bb.y0;
    const rr=(it.cornerR!=null?it.cornerR:0.22);
    const r=Math.max(0.5, Math.min(w,h)*0.5*rr);
    // posiciona a bolinha no canto superior direito, deslocada ao longo da borda de topo pelo raio
    const hx=bb.x1 - r, hy=bb.y0;
    const cr=mk('circle');
    cr.setAttribute('cx',hx); cr.setAttribute('cy',hy);
    cr.setAttribute('r',hs*0.6);
    cr.setAttribute('class','thandle corner');
    cr.setAttribute('pointer-events','auto');
    cr.setAttribute('vector-effect','non-scaling-stroke');
    cr.style.cursor='ew-resize';
    cr.addEventListener('pointerdown',e=>{ e.stopPropagation(); e.preventDefault(); startCornerDrag(it,e); });
    gUi.appendChild(cr);
  }
}
function startCornerDrag(it, ev){
  const bb=ptsBBox(it.pts);
  const w=bb.x1-bb.x0, h=bb.y1-bb.y0;
  const box={minX:bb.x0,minY:bb.y0,maxX:bb.x1,maxY:bb.y1};
  const maxR=Math.min(w,h)*0.5;
  const move=e=>{
    const p=boardPoint(e);
    // distância do canto superior direito ao longo da borda de topo:
    // puxar para a esquerda (para dentro) = mais arredondado; para a direita = menos
    const distFromCorner = Math.max(0, bb.x1 - p.x);
    let rr = Math.max(0, Math.min(1, distFromCorner / maxR));
    it.cornerR = rr;
    state.cornerR = rr; // global para novas formas
    regenRRect(it, box);
    if(it.link) syncTwin(it);
    compose(); renderHits(); renderUi();
  };
  const up=()=>{
    window.removeEventListener('pointermove',move);
    window.removeEventListener('pointerup',up);
    renderPanel(); autosave();
  };
  pushUndo();
  window.addEventListener('pointermove',move);
  window.addEventListener('pointerup',up);
}
function regenRRect(it, box){
  // regenera os pontos do retângulo arredondado com o novo raio
  const w=box.maxX-box.minX, h=box.maxY-box.minY;
  const r=Math.max(0.5, Math.min(w,h)*0.5*(it.cornerR!=null?it.cornerR:0.22));
  const STEPS=10;
  const pts=[];
  const cornersDef=[
    [box.maxX-r,box.minY+r,-Math.PI/2,0],[box.maxX-r,box.maxY-r,0,Math.PI/2],
    [box.minX+r,box.maxY-r,Math.PI/2,Math.PI],[box.minX+r,box.minY+r,Math.PI,1.5*Math.PI]
  ];
  for(const [ax,ay,a0,a1] of cornersDef)
    for(let i=0;i<=STEPS;i++){
      const a=a0+(a1-a0)*i/STEPS;
      pts.push({x:ax+r*Math.cos(a),y:ay+r*Math.sin(a)});
    }
  it.pts=pts; it.raw=pts.map(p=>({...p})); it.linear=true; it.closed=true;
  it.shapeBox=box;
  rebuildPath(it);
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
// linhas de snap = grade + margem (se houver)
function snapLines(){
  const s=state.gridSpacing||32, n=state.size;
  const xs=[], ys=[];
  for(let p=0;p<=n;p+=s){ xs.push(p); ys.push(p); }
  xs.push(n/2); ys.push(n/2);              // eixos centrais
  if(state.marginPx>0){                     // bordas da margem
    xs.push(state.marginPx, n-state.marginPx);
    ys.push(state.marginPx, n-state.marginPx);
  }
  return {xs, ys};
}
// dado uma bbox candidata, retorna o ajuste (ox,oy) para encostar na linha mais próxima
function snapAdjust(bb){
  if(!state.snapOn) return {ox:0, oy:0};
  const {xs, ys}=snapLines();
  const tol=Math.max(6, state.gridSpacing*0.35);   // raio de atração
  const near=(vals, targets)=>{
    let best=0, bd=1e9;
    for(const v of vals) for(const t of targets){
      const d=Math.abs(v-t);
      if(d<bd){ bd=d; best=t-v; }
    }
    return bd<=tol ? best : 0;
  };
  // tenta alinhar bordas esquerda/direita/centro em X; topo/base/centro em Y
  const ox=near([bb.x0, bb.x1, (bb.x0+bb.x1)/2], xs);
  const oy=near([bb.y0, bb.y1, (bb.y0+bb.y1)/2], ys);
  return {ox, oy};
}
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
    let mvx=dx, mvy=dy;
    if(state.snapOn){
      // bbox candidata após o movimento bruto
      const cand=ptsBBox(orig.pts.map(q=>({x:q.x+dx,y:q.y+dy})));
      const {ox,oy}=snapAdjust(cand);
      mvx+=ox; mvy+=oy;
    }
    it.pts=orig.pts.map(q=>({x:q.x+mvx,y:q.y+mvy}));
    it.raw=orig.raw.map(q=>({x:q.x+mvx,y:q.y+mvy}));
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
    let mvx=dx, mvy=dy;
    if(state.snapOn){
      let X0=1e9,Y0=1e9,X1=-1e9,Y1=-1e9;
      for(const o of orig) for(const q of o.pts){ X0=Math.min(X0,q.x+dx);Y0=Math.min(Y0,q.y+dy);X1=Math.max(X1,q.x+dx);Y1=Math.max(Y1,q.y+dy); }
      const adj=snapAdjust({x0:X0,y0:Y0,x1:X1,y1:Y1});
      mvx+=adj.ox; mvy+=adj.oy;
    }
    for(const o of orig){
      o.m.pts=o.pts.map(q=>({x:q.x+mvx,y:q.y+mvy}));
      o.m.raw=o.raw.map(q=>({x:q.x+mvx,y:q.y+mvy}));
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
function buildBrushCursor(){
  // desenha a ponta do traço no tamanho/forma atuais como cursor SVG
  const ps=pendingStyle;
  const zoom=state.zoom||1;
  const nib=ps.nib||'round';
  const erase = state.tool==='erase';
  const color = erase ? '#ff5d73' : (ps.color||'#000');
  // tamanho aparente da ponta na tela (px lógicos * zoom), com limites
  let w = ps.w * zoom;
  w = Math.max(4, Math.min(110, w));
  const pad=4, sw=1.2;
  const S=Math.ceil(w+pad*2);
  const c=S/2;
  let shape;
  if(nib==='round'){
    // diâmetro externo = w exatamente: o anel de contorno fica por DENTRO
    const r=Math.max(0.5, w/2 - sw/2);
    shape='<circle cx="'+c+'" cy="'+c+'" r="'+r+'" fill="'+(erase?'none':color)+'" '+
      'fill-opacity="'+(erase?0:0.28)+'" stroke="'+color+'" stroke-width="'+sw+'"/>';
  } else {
    // pena caligráfica: retângulo fino no ângulo da pena
    const ang={h:0,v:90,d1:135,d2:45}[nib]||0;
    const len=w, thick=Math.max(2,(ps.w2||4)*zoom);
    const lx=len-sw, ty=thick-sw;
    shape='<g transform="rotate('+ang+' '+c+' '+c+')">'+
      '<rect x="'+(c-lx/2)+'" y="'+(c-ty/2)+'" width="'+lx+'" height="'+ty+'" rx="'+(ty/2)+'" '+
      'fill="'+color+'" fill-opacity="'+(erase?0.2:0.42)+'" stroke="'+color+'" stroke-width="'+sw+'"/></g>';
  }
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+S+'" height="'+S+'" viewBox="0 0 '+S+' '+S+'">'+
    shape+'<circle cx="'+c+'" cy="'+c+'" r="1.3" fill="'+color+'"/></svg>';
  const url='data:image/svg+xml;base64,'+btoa(svg);
  return 'url('+url+') '+Math.round(c)+' '+Math.round(c)+', crosshair';
}
function setBoardCursor(css){
  const b=$('board'); if(!b) return;
  b.style.cursor=css;
  ['overlay','composite','underlay'].forEach(id=>{ const e=$(id); if(e) e.style.cursor=css; });
}
function refreshBrushCursor(){
  if(['draw','erase','shape'].includes(state.tool)) setBoardCursor(buildBrushCursor());
}
function setTool(t, fromList){
  // sair da ferramenta de suavização confirma o que estiver aplicado
  if(state.tool==='smooth' && t!=='smooth') endSmoothSession(true);
  curveEdit=null; curveDrag=null;   // encerra ajuste de curva pendente
  const prev=state.tool;
  state.tool=t;
  // ferramentas que operam sobre um objeto: se nada selecionado, pega o último
  if(['modify','nodes'].includes(t)){
    const hasSel = state.selId!=null || (state.multi && state.multi.length);
    if(!hasSel){
      const last=lastObject();
      if(last){ state.selId=last.id; state.multi=[]; }
    }
  }
  if(t==='smooth' && prev!=='smooth'){
    if(!strokeItems().length){ toast('Desenhe algum traço primeiro.'); state.tool=prev; return; }
    beginSmoothSession();
    toast('Suavizar: escolha reto ou redondo. Clique noutro traço para ajustar outro.');
  }
  document.querySelectorAll('.tool[data-tool]').forEach(b=>b.classList.toggle('on',b.dataset.tool===t));
  const bd=$('board');
  bd.classList.toggle('tool-ref', t==='ref');
  // classe genérica com a ferramenta atual (para CSS de cursor/pointer-events)
  bd.className=bd.className.replace(/\btoolmode-\w+/g,'').trim();
  bd.classList.add('toolmode-'+t);
  document.body.classList.toggle('tool-smooth', t==='smooth');
  document.body.classList.toggle('tool-modify', t==='modify');
  if(t!=='nodes') nodeSubmode=null;
  const cur={bucket:'cell',select:'default',nodes:'default',ref:'move',pan:'grab'};
  if(['draw','erase','shape'].includes(t)) setBoardCursor(buildBrushCursor());
  else setBoardCursor(cur[t]||'default');
  if(t==='ref' && !state.ref.src) toast('Carregue uma imagem de referência no painel à direita.');
  if(t==='select' || t==='pan') state.navMode=t;
  if(CREATE_TOOLS.includes(t)) state.lastCreate=t;
  // cores globais: pendingStyle sempre carrega a última cor usada
  if(pendingStyle){
    if(state.globalLine){ pendingStyle.color=state.globalLine; pendingStyle.lineOff=false; }
    if(state.globalFill){ pendingStyle.fill=state.globalFill; pendingStyle.fillOn=true; }
  }
  updateFab();
  if(mobileMenuOpen) closeMobileMenu();
  renderUi(); renderPanel();
  const hasProps=['draw','erase','shape','bucket','layers','smooth','nodes','modify','ref'].includes(t);
  if(window.innerWidth<768){
    // mobile: só selecionar na lista da esquerda abre as opções da ferramenta.
    if(fromList && hasProps) openProps('props');
    else closeProps();
  } else {
    // desktop: o painel flutuante abre para ferramentas com opções; fecha em select/pan.
    if(hasProps) openProps('props');
    else closeProps();
  }
}
let mobileMenuOpen=false;
const ICON_SELECT='<svg viewBox="0 0 24 24"><path d="M7 2l12 11.2-5.8.5 3.3 7.3-2.2 1-3.2-7.4L7 18.5z"/></svg>';
const ICON_PAN='<svg viewBox="0 0 24 24"><path d="M13 6v5h5V7.75L22.25 12 18 16.25V13h-5v5h3.25L12 22.25 7.75 18H11v-5H6v3.25L1.75 12 6 7.75V11h5V6H7.75L12 1.75 16.25 6z"/></svg>';
const CREATE_TOOLS=['draw','erase','shape','bucket','nodes','ref'];
function projectsSectionHTML(){
  const cur = currentProjectName ? ('Projeto aberto: <b>'+currentProjectName.replace(/</g,'&lt;')+'</b>'+(projectDirty?' (alterações não salvas)':' (salvo)')) : 'Projeto novo (ainda não salvo)';
  return '<div class="sec" data-group="projects"><h3>Meus projetos <span class="tag" id="projCount"></span></h3>'+
    '<div class="hint" style="margin-bottom:10px">'+cur+'</div>'+
    '<div class="btn-row" style="margin-bottom:8px">'+
      '<button class="btn sm pos" id="projSaveOver"'+(projectDirty?'':' disabled')+'>Salvar</button>'+
      '<button class="btn sm" id="projNew">Novo</button></div>'+
    '<div class="btn-row" style="margin-bottom:10px">'+
      '<button class="btn sm primary" id="projSave">Salvar como…</button>'+
      '<button class="btn sm" id="projExport">Baixar (.json)</button>'+
      '<button class="btn sm" id="projImport">Abrir (.json)</button></div>'+
    '<div id="projList"></div>'+
  '</div>';
}
function openProjectsPanel(){
  if(document.body.classList.contains('props-open') && panelMode==='projects') closeProps();
  else openProps('projects');
}
function colorsSectionHTML(){
  const line = state.globalLineOff ? null : state.globalLine;
  const fill = state.globalFillOn ? state.globalFill : null;
  return '<div class="sec" data-group="colors">'+secHeadInfo('Cores ativas','','Cor da linha (contorno) e do preenchimento ativas. São globais: já vêm predefinidas e valem para os PRÓXIMOS objetos que você criar em qualquer ferramenta. Use o ✕ para deixar sem cor.')+
    '<div class="row"><label class="lbl">Linha</label>'+colorFieldX('gcLine', line, 'gcLineOff')+'</div>'+
    '<div class="row"><label class="lbl">Preenchimento</label>'+colorFieldX('gcFill', fill, 'gcFillClear')+'</div>'+
  '</div>';
}
function bindColorsSection(){
  // seletor das cores ativas GLOBAIS (para novos objetos). Não altera objetos existentes.
  const applyLine=v=>{
    state.globalLine=v; state.globalLineOff=false;
    if(pendingStyle){ pendingStyle.color=v; pendingStyle.lineOff=false; }
    updateColorBtn(); refreshBrushCursor();
  };
  const applyFill=v=>{
    state.globalFill=v; state.globalFillOn=true;
    if(pendingStyle){ pendingStyle.fill=v; pendingStyle.fillOn=true; }
    updateColorBtn();
  };
  bindColorField('gcLine', ()=>state.globalLine||'#1D2333', applyLine);
  const lo=$('gcLineOff'); if(lo) lo.onclick=()=>{ state.globalLineOff=true; if(pendingStyle)pendingStyle.lineOff=true; updateColorBtn(); renderPanel(); };
  bindColorField('gcFill', ()=>state.globalFill||'#5AC8FA', applyFill);
  const fc=$('gcFillClear'); if(fc) fc.onclick=()=>{ state.globalFillOn=false; if(pendingStyle)pendingStyle.fillOn=false; updateColorBtn(); renderPanel(); };
}
function updatePropsHud(){
  const hud=$('propsHud'); if(!hud) return;
  if(!state.showProps){ hud.style.display='none'; return; }
  const it=selItem();
  if(!it || it.kind!=='stroke'){ hud.style.display='none'; return; }
  hud.style.display='flex';
  const dot=$('propsDot').querySelector('circle');
  dot.setAttribute('fill', it.fillOn? it.fill : 'transparent');
  dot.setAttribute('stroke', it.lineOff? '#888' : it.color);
  dot.style.fillOpacity = it.fillOn? '1':'0.12';
  const m=layerMetrics(it);
  const fmt=n=>(n>0?'+':'')+n;
  $('propsText').innerHTML='X <b>'+fmt(m.h)+'</b>  Y <b>'+fmt(m.v)+'</b>  L <b>'+m.w+'</b>  A <b>'+m.ht+'</b>';
}
function activeLineColor(){
  return state.globalLineOff ? null : state.globalLine;
}
function activeFillColor(){
  return state.globalFillOn ? state.globalFill : null;
}
function updateColorBtn(){
  const c=$('colorBtnCirc'); if(!c) return;
  // BORDA do círculo = cor de linha ativa (global); INTERIOR = cor de preenchimento ativa (global)
  // usa style inline (prioridade máxima) para vencer qualquer regra CSS
  const line = state.globalLineOff ? '#888888' : (state.globalLine || '#888888');
  const fill = state.globalFillOn ? (state.globalFill || 'none') : 'none';
  c.style.setProperty('stroke', line, 'important');
  c.style.setProperty('fill', fill, 'important');
  c.style.fillOpacity = (fill!=='none') ? '1' : '0';
}
function updateFab(){
  updateColorBtn();
  // FAB inferior esquerdo: ferramentas de criação
  const fab=$('mobileFab');
  if(fab && !mobileMenuOpen){
    // se a ferramenta atual for uma que "mora" no menu esquerdo (modify/smooth/layers),
    // o FAB mostra ELA e fica ativo; senão mostra a última ferramenta de criação.
    const LEFT_ACTIVE=['modify','smooth','layers'];
    const shown = LEFT_ACTIVE.includes(state.tool) ? state.tool : state.lastCreate;
    const btn=document.querySelector('.tool[data-tool="'+shown+'"]');
    if(btn) fab.innerHTML=btn.querySelector('svg').outerHTML;
    fab.classList.toggle('fab-active', CREATE_TOOLS.includes(state.tool) || LEFT_ACTIVE.includes(state.tool));
  }
  // FAB superior direito: navegação — mostra o modo memorizado (select/pan),
  // sem mudar quando uma ferramenta de criação é ativada embaixo
  const nav=$('mobileNav');
  if(nav){
    const navActive = (state.tool==='select' || state.tool==='pan');
    nav.innerHTML = (state.navMode==='pan') ? ICON_PAN : ICON_SELECT;
    nav.classList.toggle('fab-active', navActive);
  }
}
function openMobileMenu(){
  mobileMenuOpen=true;
  document.body.classList.add('menu-open');
  $('mobileFab').innerHTML='<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
}
function closeMobileMenu(){
  mobileMenuOpen=false;
  document.body.classList.remove('menu-open');
  updateFab();
}
let panelMode='props'; // 'props' = ferramenta/elemento · 'env' = canvas/projetos
function applyPanelMode(){
  const P=$('panel');
  if(!P) return;
  const mobile=window.innerWidth<768;
  // seções com data-group aparecem só quando o modo corresponde ao grupo
  P.querySelectorAll('.sec[data-group]').forEach(s=>{
    const g = s.getAttribute('data-group');
    s.style.display = (!mobile) ? '' : ((panelMode===g) ? '' : 'none');
  });
  // seções sem data-group (opções da ferramenta) aparecem só no modo props
  P.querySelectorAll('.sec:not([data-group])').forEach(s=>{
    s.style.display = (!mobile || panelMode==='props') ? '' : 'none';
  });
}
function openProps(mode){
  panelMode = mode || 'props';
  document.body.classList.add('props-open');
  renderPanel();                 // monta o conteúdo do modo atual (props ou env)
  const P=$('panel'); if(P) P.scrollTop=0;
}
function closeProps(){ document.body.classList.remove('props-open'); updateFab(); }
function toggleEnv(){
  if(document.body.classList.contains('props-open') && panelMode==='env') closeProps();
  else openProps('env');
}
document.querySelectorAll('.tool[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool, true));
$('mobileFab').onclick=()=>{
  if(mobileMenuOpen){ closeMobileMenu(); return; }
  // se a ferramenta de criação está inativa, o 1º toque apenas a ativa;
  // só abre o menu quando ela já está ativa e é tocada de novo
  if(!CREATE_TOOLS.includes(state.tool)){ setTool(state.lastCreate); return; }
  openMobileMenu();
};
$('mobileNav').onclick=()=>{
  if(mobileMenuOpen) closeMobileMenu();
  // 1º toque ativa o modo guardado; 2º toque (já ativo) alterna select<->pan
  if(state.tool==='select' || state.tool==='pan'){
    state.navMode = state.tool==='select' ? 'pan' : 'select';
  }
  setTool(state.navMode);
};
$('mobileProps').onclick=toggleEnv;
$('panelReopen').onclick=()=>openProps('props');
const _cb=$('colorFab'); if(_cb) _cb.onclick=()=>{ if(document.body.classList.contains('props-open') && panelMode==='colors') closeProps(); else openProps('colors'); };
const _la=$('leftArrow'); if(_la) _la.onclick=()=>{
  // abre o mesmo menu de ferramentas do botão inferior esquerdo
  if(mobileMenuOpen){ closeMobileMenu(); return; }
  openMobileMenu();
};
$('btnSaveTool').onclick=e=>{ e.stopPropagation(); if(mobileMenuOpen) closeMobileMenu(); openPopMenu($('exportMenu'), $('btnSaveTool')); };

/* ---------------- Painel de camadas ---------------- */
function objectItems(){ return state.items.filter(i=>i.kind==='stroke'); }
function layerLabel(it){
  const kind = it.erase ? 'Recorte' : (it.closed ? 'Forma' : 'Traço');
  const paint = (!it.erase && it.fillOn) ? ' • preenchido' : '';
  return kind+' #'+it.id+paint;
}
function layerMetrics(it){
  // marco zero = centro do canvas. H: esquerda(-) direita(+). V: cima(-) baixo(+).
  const bb=ptsBBox(it.pts||[]);
  const cx=state.size/2, cy=state.size/2;
  const h=Math.round(bb.cx-cx);   // posição horizontal do centro do objeto
  const v=Math.round(bb.cy-cy);   // posição vertical
  const w=Math.round(bb.w), ht=Math.round(bb.h);
  return { h, v, w, ht };
}
function layersSectionHTML(){
  const objs=objectItems().slice().reverse(); // topo da lista = topo da pilha
  const selId = state.selId!=null ? state.selId : (state.multi.length===1?state.multi[0]:null);
  const canMove = selId!=null;
  let h='<div class="sec" data-group="layers"><div class="lay-head">'+
    '<h3>Camadas <span class="tag">'+objs.length+'</span></h3>'+
    '<div class="lay-move"><button class="lay-navbtn" id="layUp"'+(canMove?'':' disabled')+' title="Subir o selecionado">▲</button>'+
    '<button class="lay-navbtn" id="layDown"'+(canMove?'':' disabled')+' title="Descer o selecionado">▼</button></div></div>';
  if(!objs.length){
    h+='<div class="lay-empty">Nenhum objeto ainda. Desenhe algo para ver as camadas aqui.</div></div>';
    return h;
  }
  const fmt=n=>(n>0?'+':'')+n;
  const rowHTML=(it)=>{
    const sel = (it.id===state.selId) || (state.multi&&state.multi.includes(it.id));
    const sw = it.erase ? '<span class="lay-sw erase">⌫</span>'
      : '<span class="lay-sw" style="background:'+(it.fillOn?it.fill:'transparent')+';border-color:'+it.color+'"></span>';
    const m=layerMetrics(it);
    return '<div class="lay-row'+(sel?' sel':'')+'" data-id="'+it.id+'">'+
      sw+
      '<div class="lay-info"><span class="lay-name">'+layerLabel(it)+'</span>'+
        '<span class="lay-meta">x: '+fmt(m.h)+' · y: '+fmt(m.v)+' · '+m.w+'×'+m.ht+'</span></div>'+
    '</div>';
  };
  // agrupa pares espelhados num único container; demais itens ficam sozinhos
  const done=new Set();
  const blocks=[];
  for(const it of objs){
    if(done.has(it.id)) continue;
    const twin = it.link ? objs.find(o=>o.id===it.link.id) : null;
    if(twin && !done.has(twin.id)){
      done.add(it.id); done.add(twin.id);
      const groupSel = [it.id,twin.id].some(id=>id===state.selId || (state.multi&&state.multi.includes(id)));
      // data-group lista os dois ids para mover juntos
      blocks.push('<div class="lay-item lay-mirror'+(groupSel?' sel':'')+'" draggable="true" data-id="'+it.id+'" data-group="'+it.id+','+twin.id+'">'+
        '<div class="lay-badge">espelhado</div>'+
        rowHTML(it)+rowHTML(twin)+
      '</div>');
    } else {
      done.add(it.id);
      blocks.push('<div class="lay-item" draggable="true" data-id="'+it.id+'">'+rowHTML(it)+'</div>');
    }
  }
  h+='<div class="lay-list" id="layList">'+blocks.join('')+'</div></div>';
  return h;
}
function bindLayersSection(){
  const list=$('layList');
  const selId = state.selId!=null ? state.selId : (state.multi.length===1?state.multi[0]:null);
  const up=$('layUp'), dn=$('layDown');
  if(up) up.onclick=()=>{ if(selId!=null){ moveLayer(selId,+1); } };
  if(dn) dn.onclick=()=>{ if(selId!=null){ moveLayer(selId,-1); } };
  if(!list) return;
  // clique numa LINHA interna seleciona o objeto daquela linha
  list.querySelectorAll('.lay-row').forEach(rw=>{
    rw.addEventListener('click',ev=>{ ev.stopPropagation(); const id=+rw.dataset.id; setSelection([id]); renderUi(); renderPanel(); });
  });
  list.querySelectorAll('.lay-item').forEach(row=>{
    const id=+row.dataset.id;
    // clique no container (fora das linhas) seleciona o primeiro
    row.addEventListener('click',()=>{ setSelection([id]); renderUi(); renderPanel(); });
    row.addEventListener('dragstart',ev=>{ ev.dataTransfer.setData('text/plain', id); row.classList.add('drag'); });
    row.addEventListener('dragend',()=>row.classList.remove('drag'));
    row.addEventListener('dragover',ev=>{ ev.preventDefault(); row.classList.add('over'); });
    row.addEventListener('dragleave',()=>row.classList.remove('over'));
    row.addEventListener('drop',ev=>{
      ev.preventDefault(); row.classList.remove('over');
      const from=+ev.dataTransfer.getData('text/plain'), to=id;
      if(from!==to) dropLayer(from,to);
    });
  });
  const selRow=list.querySelector('.lay-item.sel');
  if(selRow) selRow.scrollIntoView({block:'nearest'});
}
function mirrorGroupIds(id){
  const it=state.items.find(x=>x.id===id);
  if(it && it.link && it.link.id!=null){
    const tw=state.items.find(x=>x.id===it.link.id);
    if(tw) return [it.id, tw.id];
  }
  return [id];
}
function ensureMirrorAdjacent(){
  // mantém pares espelhados sempre adjacentes na pilha (twin logo abaixo do item)
  const arr=state.items;
  for(let i=0;i<arr.length;i++){
    const it=arr[i];
    if(it.kind==='stroke' && it.link && it.link.id!=null){
      const ti=arr.findIndex(x=>x.id===it.link.id);
      if(ti>=0 && Math.abs(ti-i)>1){
        const [tw]=arr.splice(ti,1);
        const ni=arr.findIndex(x=>x.id===it.id);
        arr.splice(ni+1,0,tw);
      }
    }
  }
}
function moveLayer(id, dir){
  // dir +1 = subir na pilha (índice maior). Pares espelhados movem juntos como bloco.
  const arr=state.items;
  ensureMirrorAdjacent();
  const group=mirrorGroupIds(id);
  const gIdx=group.map(gid=>arr.findIndex(i=>i.id===gid)).filter(x=>x>=0).sort((a,b)=>a-b);
  if(!gIdx.length) return;
  const lo=gIdx[0], hi=gIdx[gIdx.length-1];
  // vizinho (fora do grupo) na direção do movimento
  let j = dir>0 ? hi+1 : lo-1;
  if(j<0 || j>=arr.length) return;
  const neighborId = arr[j].id;
  pushUndo();
  const block=arr.slice(lo,hi+1);           // remove o bloco
  arr.splice(lo, block.length);
  const ni=arr.findIndex(x=>x.id===neighborId);
  const insertAt = dir>0 ? ni+1 : ni;       // depois (subir) ou antes (descer) do vizinho
  arr.splice(insertAt,0,...block);
  ensureMirrorAdjacent();
  compose(); renderHits(); renderUi(); renderPanel(); autosave();
}
function dropLayer(fromId, toId){
  const arr=state.items;
  const fi=arr.findIndex(i=>i.id===fromId), ti=arr.findIndex(i=>i.id===toId);
  if(fi<0||ti<0) return;
  pushUndo();
  const [moved]=arr.splice(fi,1);
  const ti2=arr.findIndex(i=>i.id===toId);
  arr.splice(ti2,0,moved);
  compose(); renderHits(); renderUi(); renderPanel(); autosave();
}
/* camadas agora é ferramenta comum: ativada via setTool('layers') */
$('exportMenu').querySelectorAll('button').forEach(b=>b.onclick=()=>{
  closePopMenus();
  const k=b.dataset.export;
  if(k==='svg') $('btnExportSvg').click();
  else if(k==='png') $('btnExportPng').click();
  else if(k==='project') exportProjectFile();       // salvar arquivo de edição
  else if(k==='open') importProjectFile();           // abrir arquivo de edição
  else if(k==='projects') openProjectsPanel();       // módulo de lista de projetos
});
function deleteSelected(){
  const ids = state.multi.length ? state.multi.slice() : (state.selId!=null ? [state.selId] : []);
  if(!ids.length) return;
  pushUndo();
  state.items=state.items.filter(x=>!ids.includes(x.id));
  state.selId=null; state.multi=[];
  compose(); renderHits(); renderUi(); renderPanel(); autosave();
}
function clearAll(){
  if(!state.items.length) return;
  pushUndo(); state.items=[]; state.selId=null; state.multi=[];
  compose(); renderHits(); renderUi(); renderPanel(); autosave();
}
$('btnClearAll').onclick=e=>{
  e.stopPropagation();
  if(mobileMenuOpen) closeMobileMenu();
  if(!state.items.length){ toast('Não há nada para excluir.'); return; }
  const hasSel = state.multi.length>0 || state.selId!=null;
  const menu=$('clearMenu');
  // mostra "Excluir selecionados" só quando há seleção
  const selBtn=menu.querySelector('[data-clear="sel"]');
  selBtn.style.display = hasSel ? '' : 'none';
  openPopMenu(menu, $('btnClearAll'));
};
$('clearMenu').querySelectorAll('button').forEach(b=>b.onclick=()=>{
  closePopMenus();
  if(b.dataset.clear==='sel') deleteSelected();
  else {
    if(confirm('Excluir todos os objetos?')) clearAll();
  }
});
/* --------- processar / reverter --------- */
let pendingTargets=null; // mantido para a interpretação de formas
let smoothSession=null, smoothRAF=null;
/* estica o traço: menos curvas, segmentos retos — extremidades preservadas */
function denoiseStroke(s, level){
  // reduz tremores/dentes mantendo a forma e a direção geral.
  // opera sobre s.pts atuais (o preview já restaurou o backup antes de chamar).
  const u = Math.max(0, Math.min(1, level));
  if(u<=0.001) return;
  const closed=s.closed;
  let src0 = s.pts.map(p=>({...p}));
  let n=src0.length;
  if(n<3){ s.pts=src0.map(p=>({...p})); rebuildPath(s); return; }

  // reamostra em passo regular para o filtro agir de forma uniforme
  const step = Math.max(1.2, state.size/260);
  const baseArr = closed ? src0.concat([src0[0]]) : src0;
  let rs = resample(baseArr, step);
  if(closed && rs.length>3){
    const g=Math.hypot(rs[0].x-rs[rs.length-1].x, rs[0].y-rs[rs.length-1].y);
    if(g < step*1.5) rs=rs.slice(0,-1);
  }
  n=rs.length;
  if(n<3){ s.pts=src0; rebuildPath(s); return; }

  // guarda as EXTREMIDADES para não encolher a forma (traço aberto)
  const first={...rs[0]}, last={...rs[n-1]};

  // filtro de média móvel na COMPONENTE PERPENDICULAR à direção local.
  // janela e nº de passes crescem forte com u -> efeito bem perceptível.
  const win = 1 + Math.round(u*4);          // raio da janela: até 5 vizinhos de cada lado
  const passes = 2 + Math.round(u*8);       // até ~10 passes
  const P=i=>rs[((i%n)+n)%n];
  let cur = rs.map(p=>({...p}));

  for(let pass=0; pass<passes; pass++){
    const nxt=cur.map(p=>({...p}));
    const iStart = closed?0:1, iEnd = closed?n:n-1;
    for(let i=iStart; i<iEnd; i++){
      // direção local suave (média de alguns vizinhos)
      const a=cur[((i-win)%n+n)%n], c=cur[((i+win)%n)];
      let dx=c.x-a.x, dy=c.y-a.y; const L=Math.hypot(dx,dy)||1e-9; dx/=L; dy/=L;
      // alvo = média da janela (posição "esticada")
      let sx=0, sy=0, cnt=0;
      for(let k=-win;k<=win;k++){ const q=cur[((i+k)%n+n)%n]; sx+=q.x; sy+=q.y; cnt++; }
      const mx=sx/cnt, my=sy/cnt;
      const b=cur[i];
      // decompõe o ponto atual vs média em direção (along) e normal (perp)
      const vx=b.x-mx, vy=b.y-my;
      const perp = vx*(-dy)+vy*(dx);
      const along= vx*dx+vy*dy;
      // puxa a componente perpendicular em direção à média (achata a ruga),
      // preservando a componente ao longo da linha (mantém o direcional).
      const kPerp = 0.85*u;                 // força alta na perpendicular
      const kAlong= 0.15*u;                 // quase não mexe no sentido da linha
      const newPerp = perp*(1-kPerp);
      const newAlong= along*(1-kAlong);
      nxt[i]={ x: mx + dx*newAlong + (-dy)*newPerp, y: my + dy*newAlong + (dx)*newPerp };
    }
    cur=nxt;
  }
  if(!closed){ cur[0]=first; cur[n-1]=last; }  // preserva as pontas
  s.pts=cur;
  s.raw=cur.map(p=>({...p}));
  s.processed=true;
  rebuildPath(s);
}
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
function beginSmoothSession(){
  const sel=selItem();
  const baseTargets = state.multi.length>1
    ? state.multi.slice()
    : ((sel && sel.kind==='stroke') ? [sel.id] : strokeItems().map(s=>s.id));
  smoothSession={backup:snapshot(), targets:withTwins(baseTargets), value:50, applied:false};
}
function endSmoothSession(commit){
  if(!smoothSession) return;
  // sair da ferramenta: mantém só o que foi aplicado; reverte o preview pendente
  if(!smoothSession.applied){
    restore(smoothSession.backup); autosave();
  }
  smoothSession=null;
}
function withTwins(ids){
  const set=new Set(ids);
  for(const id of ids){
    const it=state.items.find(x=>x.id===id);
    if(it && it.link && it.link.id!=null) set.add(it.link.id);
  }
  return [...set];
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
  // remover ruídos (após reto/redondo): achata pequenas rugas mantendo a direção
  const dz = smoothSession.denoise!=null ? smoothSession.denoise : 0;
  if(dz>0){ for(const s of tgt) denoiseStroke(s, dz/100); }
  else { for(const s of tgt){ if(s._dnBase) delete s._dnBase; } }
  for(const s of tgt)
    if(s.link) syncTwin(s);
  compose(); renderHits(); renderUi();
}
function smoothRetarget(){
  if(!smoothSession) return;
  // troca de alvo SEM ter aplicado: reverte o traço anterior ao formato original.
  if(!smoothSession.applied){
    restore(smoothSession.backup);
  }
  // novo baseline a partir do estado atual (já revertido ou já aplicado)
  smoothSession.backup=snapshot();
  smoothSession.value=50;
  smoothSession.denoise=0;
  smoothSession.applied=false;
  const sl=$('smLevel'); if(sl) sl.value=50;
  const sv=$('smLevelv'); if(sv) sv.textContent='0';
  const dnl=$('smDenoise'); if(dnl) dnl.value=0;
  const dnv=$('smDenoisev'); if(dnv) dnv.textContent='0';
  const sel=selItem();
  const baseTargets = state.multi.length>1
    ? state.multi.slice()
    : ((sel && sel.kind==='stroke')
      ? [sel.id]
      : state.items.filter(i=>i.kind==='stroke').map(i=>i.id));
  smoothSession.targets = withTwins(baseTargets);
  compose(); renderHits(); renderUi(); renderPanel();
}
/* a UI da suavização agora vive no painel da direita (renderPanel) */
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
    smoothSession=null;
  }
  undoStack.push(snapshot()); if(undoStack.length>60) undoStack.shift(); redoStack=[]; updateUndoBtns();
}
function undo(){
  if(smoothSession){
    const bk=smoothSession.backup;
    smoothSession=null;
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
function reorderPanelForTool(){
  const P=$('panel');
  // palavra-chave do título de cada ferramenta -> sobe a seção ao topo
  const map={bucket:'Preenchimento', shape:'Forma geométrica', pan:'Canvas', ref:'Canvas', smooth:'Suavizar traço', layers:'Camadas', modify:'Modificar', draw:'Lápis', erase:'Borracha', nodes:'Editar nós'};
  const key=map[state.tool];
  if(!key) return;
  const secs=[...P.querySelectorAll('.sec')];
  const target=secs.find(s=>{ const h=s.querySelector('h3'); return h && h.textContent.trim().startsWith(key); });
  if(target && target!==P.firstElementChild) P.insertBefore(target, P.firstElementChild);
}
// ---------- utilidades do painel ----------
let __helpId=0;
const helpTexts={};
function secHeadInfo(title, tag, help){
  // título com selo opcional e botão (i) que abre a ajuda daquela seção
  let btn='';
  if(help){
    const id='hlp'+(++__helpId);
    helpTexts[id]=help;
    btn='<button class="sec-info" data-help="'+id+'" title="Ajuda">i</button>';
  }
  return '<h3>'+title+(tag?' <span class="tag">'+tag+'</span>':'')+btn+'</h3>';
}
function showHelpPopup(id){
  const txt=helpTexts[id]; if(!txt) return;
  let ov=document.getElementById('helpPop');
  if(ov) ov.remove();
  ov=document.createElement('div');
  ov.id='helpPop';
  ov.innerHTML='<div class="help-card"><button class="help-close" id="helpClose">✕</button><div class="help-body">'+txt+'</div></div>';
  document.body.appendChild(ov);
  const close=()=>ov.remove();
  ov.addEventListener('click',e=>{ if(e.target===ov) close(); });
  document.getElementById('helpClose').onclick=close;
}
document.addEventListener('click',e=>{
  const b=e.target.closest && e.target.closest('.sec-info');
  if(b){ e.stopPropagation(); showHelpPopup(b.dataset.help); }
});

function panelTitleFor(){
  const map={draw:'Lápis',erase:'Borracha',shape:'Forma',bucket:'Preenchimento',nodes:'Editar nós',
    modify:'Modificar',smooth:'Suavizar',layers:'Camadas',ref:'Referência'};
  if(panelMode==='env') return 'Ambiente';
  if(panelMode==='colors') return 'Cores ativas';
  if(panelMode==='projects') return 'Meus projetos';
  return map[state.tool] || 'Opções';
}
function panelHead(){
  return '<div id="panelDrag" title="Arraste para mover"><span class="pd-grip"><i></i><i></i><i></i></span>'+
      '<span class="pd-title">'+panelTitleFor()+'</span>'+
      '<button class="pd-close" id="panelDragClose" title="Fechar">✕</button></div>'+
    '<button id="panelClose" title="Retrair"><svg viewBox="0 0 24 24"><path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg></button>';
}
let panelPos=null; // {left,top} posição customizada do painel (desktop)
function applyPanelPos(){
  const P=$('panel'); if(!P) return;
  if(window.innerWidth<768){ P.style.left=''; P.style.top=''; P.style.right=''; return; }
  if(panelPos){
    P.style.left=panelPos.left+'px';
    P.style.top=panelPos.top+'px';
    P.style.right='auto';
  }
}
function bindPanelDrag(){
  const bar=$('panelDrag'); const P=$('panel');
  const xbtn=$('panelDragClose'); if(xbtn) xbtn.onclick=closeProps;
  if(!bar || !P) return;
  applyPanelPos();
  const onDown=e=>{
    if(window.innerWidth<768) return;           // arraste só no desktop
    if(e.target.closest('.pd-close')) return;
    e.preventDefault();
    const r=P.getBoundingClientRect();
    const ox=e.clientX-r.left, oy=e.clientY-r.top;
    const move=ev=>{
      let nx=ev.clientX-ox, ny=ev.clientY-oy;
      // manter dentro da tela
      nx=Math.max(4, Math.min(window.innerWidth - r.width - 4, nx));
      ny=Math.max(56, Math.min(window.innerHeight - 60, ny));
      panelPos={left:nx, top:ny};
      P.style.left=nx+'px'; P.style.top=ny+'px'; P.style.right='auto';
    };
    const up=()=>{ window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up); };
    window.addEventListener('pointermove',move);
    window.addEventListener('pointerup',up);
  };
  bar.addEventListener('pointerdown',onDown);
}
function finishToolPanel(){
  const pc=$('panelClose'); if(pc) pc.onclick=closeProps;
  bindPanelDrag();
  bindPanel(selItem());
  applyPanelMode();
}
// ---------- geradores de seção reutilizáveis ----------
function secPencil(){ // lápis: modo (livre/reta/curva) + pontas, espessura, cor, opacidade
  const ps=pendingStyle;
  const dm=state.drawMode||'free';
  return '<div class="sec">'+secHeadInfo('Lápis','','Modos: "Livre" desenha à mão; "Reta" faz uma linha reta entre onde você toca e solta; "Curva" faz a reta e depois deixa você puxar o meio para encurvar (curva perfeita). Abaixo: ponta, espessura, cor, pontas e opacidade.')+
    '<div class="row"><label class="lbl">Modo</label><div class="seg" id="pdMode">'+
      '<button data-v="free" class="'+(dm==='free'?'on':'')+'">Livre</button>'+
      '<button data-v="straight" class="'+(dm==='straight'?'on':'')+'">Reta</button>'+
      '<button data-v="curve" class="'+(dm==='curve'?'on':'')+'">Curva</button></div></div>'+
    '<label class="chk"><input type="checkbox" id="pdJoin"'+(state.joinEnds?' checked':'')+'>Conectar pontas (funde linhas que se tocam)</label>'+
    (state.joinEnds?'<label class="chk" style="margin-left:16px"><input type="checkbox" id="pdTrim"'+(state.trimJoin?' checked':'')+'>Ajustar pontas (junção perfeita: corta/completa)</label>':'')+
    '<div class="row"><label class="lbl">Ponta</label>'+nibSeg('pdNib',ps.nib)+'</div>'+
    (ps.nib==='round'
      ? '<div class="row"><label class="lbl">Espessura</label>'+
        '<input type="range" id="pdW" min="1" max="80" value="'+ps.w+'"><span class="range-val" id="pdWv">'+ps.w+'</span></div>'
      : '<div class="row"><label class="lbl">Comprimento</label>'+
        '<input type="range" id="pdW" min="2" max="90" value="'+ps.w+'"><span class="range-val" id="pdWv">'+ps.w+'</span></div>'+
        '<div class="row"><label class="lbl">Grossura</label>'+
        '<input type="range" id="pdW2" min="1" max="40" value="'+(ps.w2||4)+'"><span class="range-val" id="pdW2v">'+(ps.w2||4)+'</span></div>')+
    '<div class="row"><label class="lbl">Cor da linha</label>'+colorFieldX('pdColor', ps.lineOff?null:ps.color, 'pdLineOff')+'</div>'+
    (ps.nib==='round'?'<div class="row"><label class="lbl">Pontas</label><div class="seg" id="pdCap">'+
      '<button data-v="round" class="'+(ps.cap==='round'?'on':'')+'">Redonda</button>'+
      '<button data-v="square" class="'+(ps.cap==='square'?'on':'')+'">Quadrada</button>'+
      '<button data-v="butt" class="'+(ps.cap==='butt'?'on':'')+'">Reta</button></div></div>':'')+
    '<div class="row"><label class="lbl">Opacidade</label>'+
      '<input type="range" id="pdOp" min="5" max="100" value="'+(ps.opacity!=null?ps.opacity:100)+'"><span class="range-val" id="pdOpv">'+(ps.opacity!=null?ps.opacity:100)+'</span></div>'+
  '</div>';
}
function secEraser(){ // borracha: mesmas propriedades do lápis (sem cor)
  const ps=pendingStyle;
  return '<div class="sec">'+secHeadInfo('Borracha','','A borracha apaga onde você passa, com as mesmas pontas e espessura do lápis.')+
    '<div class="row"><label class="lbl">Ponta</label>'+nibSeg('pdNib',ps.nib)+'</div>'+
    (ps.nib==='round'
      ? '<div class="row"><label class="lbl">Espessura</label>'+
        '<input type="range" id="pdW" min="1" max="80" value="'+ps.w+'"><span class="range-val" id="pdWv">'+ps.w+'</span></div>'
      : '<div class="row"><label class="lbl">Comprimento</label>'+
        '<input type="range" id="pdW" min="2" max="90" value="'+ps.w+'"><span class="range-val" id="pdWv">'+ps.w+'</span></div>'+
        '<div class="row"><label class="lbl">Grossura</label>'+
        '<input type="range" id="pdW2" min="1" max="40" value="'+(ps.w2||4)+'"><span class="range-val" id="pdW2v">'+(ps.w2||4)+'</span></div>')+
    (ps.nib==='round'?'<div class="row"><label class="lbl">Pontas</label><div class="seg" id="pdCap">'+
      '<button data-v="round" class="'+(ps.cap==='round'?'on':'')+'">Redonda</button>'+
      '<button data-v="square" class="'+(ps.cap==='square'?'on':'')+'">Quadrada</button>'+
      '<button data-v="butt" class="'+(ps.cap==='butt'?'on':'')+'">Reta</button></div></div>':'')+
  '</div>';
}
function secShape(){ // forma: formas + arredondamento + preenchimento + linha + espessura (tudo direto)
  const ps=pendingStyle;
  const isR = state.shapeKind==='rrect';
  return '<div class="sec">'+secHeadInfo('Forma geométrica','','Arraste no canvas para criar. A forma tem cor de preenchimento e cor de linha (borda), cada uma com ✕ para remover. No arredondado, ajuste o canto pela alça na quina ou pelo controle "Arredondamento".')+'<div class="shape-grid" style="margin-bottom:12px">'+
    SHAPE_DEFS.map(d=>'<button class="shape-opt shape-pick'+(state.shapeKind===d[0]?' on':'')+'" data-shape="'+d[0]+'"><svg viewBox="0 0 30 30">'+d[2]+'</svg>'+d[1]+'</button>').join('')+
    '</div>'+
    (isR?'<div class="row"><label class="lbl">Arredondamento</label>'+
      '<input type="range" id="pdCornerR" min="0" max="100" value="'+Math.round((state.cornerR!=null?state.cornerR:0.22)*100)+'"><span class="range-val" id="pdCornerRv">'+Math.round((state.cornerR!=null?state.cornerR:0.22)*100)+'%</span></div>':'')+
    '<div class="row"><label class="lbl">Preenchimento</label>'+colorFieldX('pdFill', ps.fillOn?ps.fill:null, 'pdFillClear')+'</div>'+
    '<div class="row"><label class="lbl">Linha</label>'+colorFieldX('pdColor', ps.lineOff?null:ps.color, 'pdLineOff')+'</div>'+
    '<div class="row"><label class="lbl">Espessura da linha</label>'+
      '<input type="range" id="pdW" min="1" max="80" value="'+ps.w+'"><span class="range-val" id="pdWv">'+ps.w+'</span></div>'+
  '</div>';
}
function secFill(){ // preenchimento (antigo balde): cor, opacidade, tolerância
  return '<div class="sec">'+secHeadInfo('Preenchimento','','Clique dentro de uma forma fechada para preenchê-la. Em regiões abertas, a tolerância define até onde a cor se espalha.')+
    '<div class="row"><label class="lbl">Cor</label>'+
      '<button class="cswatch" id="bkColor" style="background:'+state.bucket.color+'"></button>'+
      '<input class="inp hexinp" id="bkColortx" value="'+String(state.bucket.color).toUpperCase()+'" maxlength="7" spellcheck="false"></div>'+
    '<div class="row"><label class="lbl">Opacidade</label>'+
      '<input type="range" id="bkOp" min="5" max="100" value="'+(state.bucket.opacity!=null?state.bucket.opacity:100)+'"><span class="range-val" id="bkOpv">'+(state.bucket.opacity!=null?state.bucket.opacity:100)+'</span></div>'+
    '<div class="row"><label class="lbl">Tolerância</label>'+
      '<input type="range" id="bkTol" min="8" max="140" value="'+state.bucket.tolerance+'"><span class="range-val" id="bkTolv">'+state.bucket.tolerance+'</span></div>'+
  '</div>';
}
function secRef(){ // imagem de referência: carregar, ocultar, remover, opacidade, escala
  const r=state.ref;
  return '<div class="sec"><h3>Imagem de referência</h3>'+
    '<div class="btn-row" style="margin-bottom:9px">'+
      '<button class="btn sm primary" id="refLoad">Carregar imagem…</button>'+
      (r.src?'<button class="btn sm" id="refToggle">'+(r.visible?'Ocultar':'Mostrar')+'</button>'+
      '<button class="btn sm danger" id="refRemove">Remover</button>':'')+'</div>'+
    (r.src?
      '<div class="row"><label class="lbl">Opacidade</label>'+
        '<input type="range" id="refOp" min="5" max="90" value="'+r.opacity+'"><span class="range-val" id="refOpv">'+r.opacity+'</span></div>'+
      '<div class="row"><label class="lbl">Escala</label>'+
        '<input type="range" id="refSc" min="10" max="300" value="'+Math.round(r.scale*100)+'"><span class="range-val" id="refScv">'+Math.round(r.scale*100)+'%</span></div>'
      : '<div class="hint">Carregue uma imagem para usá-la como base de referência (calque). Depois arraste-a no canvas para posicionar.</div>')+
    (r.src?'<div class="hint">Arraste a imagem no canvas para posicionar. A referência é só apoio visual — não entra na arte exportada nem é salva no projeto.</div>':'')+
  '</div>';
}
function secNodes(it){ // editar nós: dobrar/dividir + adicionar/remover pontual + arrastar
  if(!it || it.kind!=='stroke') return '<div class="sec"><h3>Editar nós</h3><div class="hint">Toque num traço para editar seus nós.</div></div>';
  const add = nodeSubmode==='add', rem = nodeSubmode==='remove';
  return '<div class="sec">'+secHeadInfo('Editar nós', it.pts.length+' nós','Dobrar (✕) e Dividir (÷) mudam a quantidade de nós de uma vez. Em "Adicionar nó" (＋), toque sobre a linha para criar um nó ali; em "Remover nó" (－), toque no nó a retirar. Fora desses modos, arraste os pontos livremente. Toque noutro objeto para editá-lo.')+
    '<div class="cp-label" style="text-transform:uppercase;letter-spacing:.8px;margin:2px 0 6px;font-size:10px;color:var(--muted)">Quantidade</div>'+
    '<div class="btn-row">'+
      '<button class="btn sm" id="ndDouble">✕ Dobrar</button>'+
      '<button class="btn sm" id="ndHalve">÷ Dividir</button></div>'+
    '<div class="cp-label" style="text-transform:uppercase;letter-spacing:.8px;margin:10px 0 6px;font-size:10px;color:var(--muted)">Editar pontual</div>'+
    '<div class="btn-row">'+
      '<button class="btn sm'+(add?' primary':'')+'" id="ndAdd">'+(add?'＋ Clique na linha…':'＋ Adicionar nó')+'</button>'+
      '<button class="btn sm'+(rem?' danger':'')+'" id="ndRemove">'+(rem?'－ Clique no nó…':'－ Remover nó')+'</button></div>'+
  '</div>';
}

let nodeSubmode=null; // null | 'add' | 'remove'
let modifyOpen='linha'; // seção retrátil aberta no Modificar
let accOpen={}; // estado de acordeões por chave (ex.: forma-linha)
function accItem(key, title, bodyHTML){
  // 'linha','preenchimento','suavidade','acoes' usam modifyOpen (um por vez);
  // demais chaves usam accOpen[key] (retração independente, inicia fechada)
  const inModify=['linha','preenchimento','suavidade','acoes'].includes(key);
  const open = inModify ? (modifyOpen===key) : (accOpen[key]===true);
  return '<div class="acc'+(open?' open':'')+'" data-acc="'+key+'">'+
    '<button class="acc-head" data-acctoggle="'+key+'"><span>'+title+'</span>'+
      '<svg viewBox="0 0 24 24" class="acc-caret"><path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg></button>'+
    '<div class="acc-body"'+(open?'':' style="display:none"')+'>'+bodyHTML+'</div>'+
  '</div>';
}
function secModify(it){
  if(!it || it.kind!=='stroke'){
    return '<div class="sec"><h3>Modificar</h3><div class="hint">Toque num objeto para modificá-lo. Você pode alternar entre objetos livremente.</div></div>';
  }
  const isCalig = it.nib!=='round';
  // corpo LINHA (traço): ponta, espessura, cor da linha, pontas, opacidade
  const linhaBody =
    '<div class="row"><label class="lbl">Ponta</label>'+nibSeg('stNib',it.nib)+'</div>'+
    (!isCalig
      ? '<div class="row"><label class="lbl">Espessura</label><input type="range" id="stW" min="1" max="80" value="'+it.w+'"><span class="range-val" id="stWv">'+it.w+'</span></div>'
      : '<div class="row"><label class="lbl">Comprimento</label><input type="range" id="stW" min="2" max="90" value="'+it.w+'"><span class="range-val" id="stWv">'+it.w+'</span></div>'+
        '<div class="row"><label class="lbl">Grossura</label><input type="range" id="stW2" min="1" max="40" value="'+(it.w2!=null?it.w2:4)+'"><span class="range-val" id="stW2v">'+(it.w2!=null?it.w2:4)+'</span></div>')+
    (it.erase?'':'<div class="row"><label class="lbl">Cor da linha</label>'+colorFieldX('stColor', it.lineOff?null:it.color, 'stLineOff')+'</div>')+
    (!isCalig?'<div class="row"><label class="lbl">Pontas</label><div class="seg" id="segCap">'+
      '<button data-v="round" class="'+(it.cap==='round'?'on':'')+'">Redonda</button>'+
      '<button data-v="square" class="'+(it.cap==='square'?'on':'')+'">Quadrada</button>'+
      '<button data-v="butt" class="'+(it.cap==='butt'?'on':'')+'">Reta</button></div></div>':'')+
    '<div class="row"><label class="lbl">Opacidade</label><input type="range" id="stOp" min="5" max="100" value="'+it.opacity+'"><span class="range-val" id="stOpv">'+it.opacity+'</span></div>';
  // corpo PREENCHIMENTO
  const fillBody = it.closed
    ? '<div class="row"><label class="lbl">Cor</label>'+colorFieldX('stFill', it.fillOn?it.fill:null, 'stFillClear')+'</div>'+
      (it.fillOn?'<div class="row"><label class="lbl">Opacidade</label><input type="range" id="stFillOp" min="5" max="100" value="'+it.fillOpacity+'"><span class="range-val" id="stFillOpv">'+it.fillOpacity+'</span></div>':'')
    : '<div class="hint">Só traços fechados podem ser preenchidos.</div>';
  // corpo SUAVIDADE (aplica direto no objeto)
  const smv = (it._smv!=null?it._smv:50);
  const suaveBody =
    '<div class="sm-scale"><span class="sm-end">Reto</span>'+
      '<input type="range" id="mdSmooth" min="0" max="100" value="'+smv+'">'+
      '<span class="sm-end">Redondo</span></div>'+
    '<div class="row" style="justify-content:center;margin:2px 0 6px"><span class="range-val" id="mdSmoothv">'+(smv-50)+'</span></div>'+
    '<div class="btn-row"><button class="btn sm pos" id="mdSmoothApply">Aplicar</button>'+
      '<button class="btn sm neg" id="mdSmoothReset">Voltar ao meio</button></div>';
  // corpo AÇÕES
  const acoesBody =
    '<div class="btn-row">'+
      '<button class="btn sm" id="stNodes">Editar nós</button>'+
      '<button class="btn sm" id="stMirrorV">Espelhar ↔</button>'+
      '<button class="btn sm" id="stMirrorH">Espelhar ↕</button>'+
      '<button class="btn sm" id="stDup">Duplicar</button>'+
      '<button class="btn sm danger" id="stDel">Excluir</button></div>';

  return '<div class="sec"><h3>Modificar <span class="tag">#'+it.id+'</span></h3>'+
    '<div class="hint" style="margin-top:-2px">Toque noutro objeto para modificá-lo. Abra uma seção por vez.</div>'+
    accItem('linha', it.erase?'Traço (borracha)':'Linha', linhaBody)+
    accItem('preenchimento', 'Preenchimento', fillBody)+
    accItem('suavidade', 'Suavidade', suaveBody)+
    accItem('acoes', 'Ações', acoesBody)+
  '</div>';
}
function renderPanel(){
  const P=$('panel');
  updateColorBtn();
  const it=selItem();
  const multiSel = (state.multi && state.multi.length>1)
    ? state.items.filter(i=>i.kind==='stroke' && state.multi.includes(i.id)) : null;
  let html='';
  // modo AMBIENTE (Canvas/Projetos) — acionado pelo botão de ambiente
  if(panelMode==='env'){
    P.innerHTML=panelHead()+envSectionsHTML();
    const pc=$('panelClose'); if(pc) pc.onclick=closeProps;
    bindPanel(it);
    renderProjects();
    bindPanelDrag();
    applyPanelMode();
    return;
  }
  // modo CORES ATIVAS — acionado pelo botão de cor (canto superior esquerdo)
  if(panelMode==='colors'){
    P.innerHTML=panelHead()+colorsSectionHTML();
    const pc=$('panelClose'); if(pc) pc.onclick=closeProps;
    bindColorsSection();
    bindPanelDrag();
    applyPanelMode();
    return;
  }
  // modo PROJETOS — lista de projetos salvos (acionado pelo menu Salvar)
  if(panelMode==='projects'){
    P.innerHTML=panelHead()+projectsSectionHTML();
    const pc=$('panelClose'); if(pc) pc.onclick=closeProps;
    const pso=$('projSaveOver'); if(pso) pso.onclick=()=>{ saveProjectOver(); renderPanel(); };
    const pnw=$('projNew'); if(pnw) pnw.onclick=()=>{ newProject(); renderPanel(); };
    const pjs=$('projSave'); if(pjs) pjs.onclick=()=>{ saveProjectAs(); renderPanel(); };
    const pje=$('projExport'); if(pje) pje.onclick=exportProjectFile;
    const pji=$('projImport'); if(pji) pji.onclick=importProjectFile;
    renderProjects();
    bindPanelDrag();
    applyPanelMode();
    return;
  }
  if(state.tool==='layers'){
    P.innerHTML=panelHead()+layersSectionHTML();
    const pc=$('panelClose'); if(pc) pc.onclick=closeProps;
    bindLayersSection();
    bindPanelDrag();
    applyPanelMode();
    return;
  }
  if(state.tool==='smooth'){
    const v = smoothSession ? smoothSession.value : 50;
    const temAlvo = smoothSession && smoothSession.targets && smoothSession.targets.length===1;
    const alvo = temAlvo ? 'traço selecionado' : (state.multi.length>1 ? state.multi.length+' traços' : 'toque num traço');
    const dv = smoothSession && smoothSession.denoise!=null ? smoothSession.denoise : 0;
    html='<div class="sec">'+secHeadInfo('Suavizar traço', alvo,
      'Reto ↔ Redondo: arraste para o redondo para arredondar e tirar o tremido, ou para o reto para deixar linear — sempre respeitando as pontas. "Reduzir ruídos" achata as rugas e dentes mantendo a direção da linha, sem deformar o objeto (como esticar um plástico rugado). Toque noutro traço para ajustá-lo; a ferramenta continua aberta até você trocar de ferramenta. Aplicar confirma; sair sem aplicar volta ao original.')+
      '<div class="sm-scale"><span class="sm-end">Reto</span>'+
        '<input type="range" id="smLevel" min="0" max="100" value="'+v+'">'+
        '<span class="sm-end">Redondo</span></div>'+
      '<div class="row" style="justify-content:center;margin:2px 0 8px"><span class="range-val" id="smLevelv">'+(v-50)+'</span></div>'+
      '<div class="cp-label" style="text-transform:uppercase;letter-spacing:.8px;margin:14px 0 5px;font-size:10px;color:var(--muted)">Reduzir ruídos</div>'+
      '<div class="sm-scale"><span class="sm-end">0</span>'+
        '<input type="range" id="smDenoise" min="0" max="100" value="'+dv+'">'+
        '<span class="sm-end">Máx</span></div>'+
      '<div class="row" style="justify-content:center;margin:2px 0 8px"><span class="range-val" id="smDenoisev">'+dv+'</span></div>'+
      '<div class="btn-row"><button class="btn sm pos" id="smApply">Aplicar</button>'+
        '<button class="btn sm neg" id="smReset">Voltar ao meio</button></div>'+
    '</div>';
    // no modo suavizar mostra SÓ esta seção (nada das propriedades do traço)
    P.innerHTML=panelHead()+html;
    const pc=$('panelClose'); if(pc) pc.onclick=closeProps;
    bindSmoothPanel();
    bindPanelDrag();
    applyPanelMode();
    return;
  }
  // ===== ferramentas de criação: cada uma mostra só suas seções =====
  if(state.tool==='draw'){
    P.innerHTML=panelHead()+secPencil();
    finishToolPanel(); return;
  }
  if(state.tool==='erase'){
    P.innerHTML=panelHead()+secEraser();
    finishToolPanel(); return;
  }
  if(state.tool==='shape'){
    P.innerHTML=panelHead()+secShape();
    finishToolPanel(); return;
  }
  if(state.tool==='bucket'){
    P.innerHTML=panelHead()+secFill();
    finishToolPanel(); return;
  }
  if(state.tool==='nodes'){
    P.innerHTML=panelHead()+secNodes(it);
    finishToolPanel(); return;
  }
  if(state.tool==='modify'){
    P.innerHTML=panelHead()+secModify(it);
    finishToolPanel(); return;
  }
  if(state.tool==='ref'){
    P.innerHTML=panelHead()+secRef();
    finishToolPanel(); return;
  }

  // (env agora vive em envSectionsHTML; este trecho não é mais alcançado)
  return;
}
function envSectionsHTML(){
  const r=state.ref;
  let html='';
  html+='<div class="sec" data-group="env"><h3>Canvas</h3>'+
    '<div class="row"><label class="lbl">Tamanho</label><select class="inp" id="cvSize" style="flex:1">'+
      [128,256,512,1024].map(v=>'<option value="'+v+'"'+(state.size===v?' selected':'')+'>'+v+' × '+v+' px</option>').join('')+'</select></div>'+
    '<label class="chk"><input type="checkbox" id="cvGrid"'+(state.gridOn?' checked':'')+'>Mostrar grade</label>'+
    '<label class="chk"><input type="checkbox" id="cvGridAbove"'+(state.gridAbove?' checked':'')+'>Grade por cima do desenho</label>'+
    '<div class="row"><label class="lbl">Espaço grade</label><select class="inp" id="cvGridSp" style="flex:1">'+
      [8,16,32,64,128].map(v=>'<option value="'+v+'"'+(state.gridSpacing===v?' selected':'')+'>'+v+' px</option>').join('')+'</select></div>'+
    '<div class="row"><label class="lbl">Margem</label><select class="inp" id="cvMargin" style="flex:1">'+
      ['<option value="0"'+(state.marginPx===0?' selected':'')+'>Sem margem</option>'].concat(
      [8,16,24,32,48,64,96,128].map(v=>'<option value="'+v+'"'+(state.marginPx===v?' selected':'')+'>'+v+' px</option>')).join('')+'</select></div>'+
    '<label class="chk"><input type="checkbox" id="cvSnap"'+(state.snapOn?' checked':'')+'>Grade magnética (atrai objetos às linhas)</label>'+
    '<label class="chk"><input type="checkbox" id="cvShowProps"'+(state.showProps?' checked':'')+'>Ver propriedades dos objetos (cor, posição e tamanho no topo)</label>'+
    '<div class="row"><label class="lbl">Fundo</label>'+
      '<input type="range" id="cvBg" min="0" max="100" value="'+bgLevel()+'"><span class="range-val" id="cvBgv">'+bgLevel()+'</span></div>'+
    '<div class="hint" style="margin:-4px 0 8px">Do preto (0) ao branco (100), só para enxergar o objeto — a exportação PNG/SVG continua com fundo transparente.</div>'+
    '<div class="row"><label class="lbl">Zoom</label>'+
      '<input type="range" id="cvZoom" min="50" max="250" value="'+Math.round(state.zoom*100)+'"><span class="range-val" id="cvZoomv">'+Math.round(state.zoom*100)+'%</span></div>'+
    '<div class="btn-row" style="margin-bottom:8px"><button class="btn sm" id="cvZoomFit">Ajustar à tela</button><button class="btn sm" id="cvZoom100">100%</button></div>'+
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

  html+='<div class="sec" data-group="env"><h3>Projetos <span class="tag" id="projCount"></span></h3>'+
    '<div class="btn-row" style="margin-bottom:10px">'+
      '<button class="btn sm primary" id="projSave">Salvar como…</button>'+
      '<button class="btn sm" id="projExport">Baixar .json</button>'+
      '<button class="btn sm" id="projImport">Abrir .json</button></div>'+
    '<div id="projList"></div>'+
    '<div class="hint">Projetos ficam no navegador; o trabalho atual é salvo automaticamente. A imagem de referência não é incluída.</div>'+
  '</div>';

  return html;
}
function bindSmoothPanel(){
  const r=$('smLevel'); if(!r) return;
  if(!smoothSession) beginSmoothSession();
  if(smoothSession.denoise==null) smoothSession.denoise=0;
  r.oninput=()=>{
    smoothSession.value=parseInt(r.value);
    const lv=$('smLevelv'); if(lv) lv.textContent=(smoothSession.value-50);
    if(!smoothRAF) smoothRAF=requestAnimationFrame(()=>{ smoothRAF=null; applySmoothPreview(); });
  };
  const dn=$('smDenoise'); if(dn) dn.oninput=()=>{
    smoothSession.denoise=parseInt(dn.value);
    const dv=$('smDenoisev'); if(dv) dv.textContent=smoothSession.denoise;
    if(!smoothRAF) smoothRAF=requestAnimationFrame(()=>{ smoothRAF=null; applySmoothPreview(); });
  };
  const ap=$('smApply'); if(ap) ap.onclick=()=>{
    if(!smoothSession) return;
    const changed = (smoothSession.value<48 || smoothSession.value>52) || (smoothSession.denoise>0);
    // confirma o ajuste atual: vira o novo baseline (registra no desfazer)
    if(changed){
      undoStack.push(smoothSession.backup); if(undoStack.length>60) undoStack.shift();
      redoStack=[]; updateUndoBtns();
    }
    smoothSession.backup=snapshot();   // baseline = estado JÁ ajustado (permite acumular)
    smoothSession.applied=true;
    // zera os DOIS controles para poder aplicar de novo sobre o resultado
    smoothSession.value=50;
    smoothSession.denoise=0;
    const rr=$('smLevel'); if(rr) rr.value=50;
    const lv=$('smLevelv'); if(lv) lv.textContent='0';
    const dn=$('smDenoise'); if(dn) dn.value=0;
    const dv=$('smDenoisev'); if(dv) dv.textContent='0';
    if(changed) toast('Ajuste aplicado. Deslize de novo para reforçar.');
    autosave();
  };
  const rs=$('smReset'); if(rs) rs.onclick=()=>{
    // volta ao meio: reverte o preview ao baseline atual, ambos sliders no zero
    if(smoothSession){
      restore(smoothSession.backup);
      smoothSession.value=50;
      smoothSession.denoise=0;
      const dn=$('smDenoise'); if(dn) dn.value=0;
      const dv=$('smDenoisev'); if(dv) dv.textContent='0';
      compose(); renderHits(); renderUi();
    }
    const rr=$('smLevel'); if(rr) rr.value=50;
    const lv=$('smLevelv'); if(lv) lv.textContent='0';
  };
}
function bindPanel(it){
  if(state.tool==='smooth') bindSmoothPanel();
  if(state.tool==='layers') bindLayersSection();
  // acordeão do Modificar: abre um por vez
  document.querySelectorAll('[data-acctoggle]').forEach(b=>b.onclick=()=>{
    const k=b.dataset.acctoggle;
    if(['linha','preenchimento','suavidade','acoes'].includes(k)){
      modifyOpen = (modifyOpen===k) ? null : k;   // Modificar: um por vez
    } else {
      accOpen[k] = !accOpen[k];                    // outros: retração independente
    }
    renderPanel();
  });
  // suavidade dentro do Modificar
  if(state.tool==='modify' && it && it.kind==='stroke'){
    const sr=$('mdSmooth');
    if(sr){
      let base=snapshot();
      sr.oninput=()=>{
        it._smv=parseInt(sr.value);
        const lv=$('mdSmoothv'); if(lv) lv.textContent=(it._smv-50);
        // preview
        const j=JSON.parse(base); state.items=j.items;
        const t2=state.items.find(x=>x.id===it.id);
        if(t2){
          if(it._smv>52){ t2.linear=false; processStroke(t2,(it._smv-50)/50); }
          else if(it._smv<48){ straightenStroke(t2,(50-it._smv)/50); }
          if(t2.link){ const tw=state.items.find(x=>x.id===t2.link.id); if(tw) syncTwin(t2); }
        }
        compose(); renderHits(); renderUi();
      };
      const ap=$('mdSmoothApply'); if(ap) ap.onclick=()=>{
        if(it._smv!=null && (it._smv<48||it._smv>52)){
          undoStack.push(base); if(undoStack.length>60) undoStack.shift(); redoStack=[]; updateUndoBtns();
          base=snapshot();
        }
        it._smv=50; const rr=$('mdSmooth'); if(rr) rr.value=50;
        const lv=$('mdSmoothv'); if(lv) lv.textContent='0';
        toast('Suavidade aplicada.'); autosave();
      };
      const rs=$('mdSmoothReset'); if(rs) rs.onclick=()=>{
        const j=JSON.parse(base); state.items=j.items; it._smv=50;
        const rr=$('mdSmooth'); if(rr) rr.value=50;
        const lv=$('mdSmoothv'); if(lv) lv.textContent='0';
        compose(); renderHits(); renderUi();
      };
    }
  }
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
    // LINHA (com opção sem cor = adota a cor do preenchimento)
    bindColorField('stColor', ()=>it.color, v=>{ it.color=v; it.lineOff=false; state.globalLine=v; state.globalLineOff=false; if(pendingStyle){pendingStyle.color=v;pendingStyle.lineOff=false;} updateColorBtn(); rr(); renderPanel(); });
    const lo=$('stLineOff'); if(lo) lo.onclick=()=>{ it.lineOff=true; rr(); renderPanel(); };
    bindRange('stOp',v=>{it.opacity=v;rr();});
    const sc=$('segCap'); if(sc) sc.querySelectorAll('button').forEach(b=>b.onclick=()=>{it.cap=b.dataset.v;renderPanel();rr();});
    // PREENCHIMENTO (com opção sem cor = X)
    bindColorField('stFill', ()=>it.fill||'#5AC8FA', v=>{
      it.fill=v; it.fillOn=true; state.globalFill=v; state.globalFillOn=true; if(pendingStyle){pendingStyle.fill=v;pendingStyle.fillOn=true;} updateColorBtn(); rr(); renderPanel();
    });
    const fc=$('stFillClear'); if(fc) fc.onclick=()=>{ it.fillOn=false; rr(); renderPanel(); };
    bindRange('stFillOp',v=>{it.fillOpacity=v;rr();});
    const nd=$('ndDouble'); if(nd) nd.onclick=()=>{ nodeSubmode=null; doubleNodes(it); };
    const nh=$('ndHalve'); if(nh) nh.onclick=()=>{ nodeSubmode=null; halveNodes(it); };
    const nadd=$('ndAdd'); if(nadd) nadd.onclick=()=>{ nodeSubmode = nodeSubmode==='add'?null:'add'; renderPanel(); renderUi(); };
    const nrem=$('ndRemove'); if(nrem) nrem.onclick=()=>{ nodeSubmode = nodeSubmode==='remove'?null:'remove'; renderPanel(); renderUi(); };
    const sno=$('stNodes'); if(sno) sno.onclick=()=>{ ensureEditableNodes(it); compose(); setTool('nodes'); };
    const smv2=$('stMirrorV'); if(smv2) smv2.onclick=()=>mirrorDup(it,'v');
    const smh2=$('stMirrorH'); if(smh2) smh2.onclick=()=>mirrorDup(it,'h');
    const sdu=$('stDup'); if(sdu) sdu.onclick=()=>{
      pushUndo();
      const c2=JSON.parse(JSON.stringify(it)); c2.id=state.nextId++;
      delete c2.link;
      c2.pts=c2.pts.map(p=>({x:p.x+18,y:p.y+18}));
      c2.raw=c2.raw.map(p=>({x:p.x+18,y:p.y+18}));
      rebuildPath(c2);
      state.items.push(c2); state.selId=c2.id;
      compose(); renderHits(); renderPanel(); autosave();
    };
    const sde=$('stDel'); if(sde) sde.onclick=()=>{
      pushUndo();
      state.items=state.items.filter(x=>x.id!==it.id); state.selId=null;
      compose(); renderHits(); renderPanel(); autosave();
    };
  }
  document.querySelectorAll('.shape-pick').forEach(b=>b.onclick=()=>{
    state.shapeKind=b.dataset.shape; renderPanel();
  });
  // aplica ao objeto selecionado (recém-criado) enquanto o painel está aberto
  const liveObj=()=>{
    if(!document.body.classList.contains('props-open')) return null;
    const it=selItem();
    return (it && it.kind==='stroke') ? it : null;
  };
  const liveApply=(fn)=>{
    const it=liveObj(); if(!it) return;
    fn(it);
    if(it.link) syncTwin(it);
    rebuildPath(it); compose(); renderHits(); renderUi();
  };
  bindNib('pdNib',v=>{pendingStyle.nib=v; liveApply(it=>{it.nib=v;}); renderPanel();refreshBrushCursor();});
  bindRange('pdW',v=>{pendingStyle.w=v; liveApply(it=>{it.w=v;}); refreshBrushCursor();});
  bindRange('pdW2',v=>{pendingStyle.w2=v; liveApply(it=>{it.w2=v;}); refreshBrushCursor();});
  bindColorField('pdColor', ()=>pendingStyle.color, v=>{pendingStyle.color=v; pendingStyle.lineOff=false; state.globalLine=v; state.globalLineOff=false; liveApply(it=>{it.color=v; it.lineOff=false;}); updateColorBtn(); refreshBrushCursor(); renderPanel();});
  const pdlo=$('pdLineOff'); if(pdlo) pdlo.onclick=()=>{ pendingStyle.lineOff=true; liveApply(it=>{it.lineOff=true;}); renderPanel(); };
  bindColorField('pdFill', ()=>pendingStyle.fill||'#5AC8FA', v=>{ pendingStyle.fill=v; pendingStyle.fillOn=true; state.globalFill=v; state.globalFillOn=true; liveApply(it=>{it.fill=v; it.fillOn=true;}); updateColorBtn(); renderPanel(); });
  const pdfc=$('pdFillClear'); if(pdfc) pdfc.onclick=()=>{ pendingStyle.fillOn=false; liveApply(it=>{it.fillOn=false;}); renderPanel(); };
  bindRange('pdOp',v=>{pendingStyle.opacity=v; liveApply(it=>{it.opacity=v;});});
  bindRange('pdCornerR',v=>{ state.cornerR=v/100; liveApply(it=>{ if(it.shapeKind==='rrect' && it.shapeBox){ it.cornerR=v/100; regenRRect(it, it.shapeBox); } }); });
  const pdcap=$('pdCap'); if(pdcap) pdcap.querySelectorAll('button').forEach(b=>b.onclick=()=>{pendingStyle.cap=b.dataset.v; liveApply(it=>{it.cap=b.dataset.v;}); renderPanel();refreshBrushCursor();});
  const pdmode=$('pdMode'); if(pdmode) pdmode.querySelectorAll('button').forEach(b=>b.onclick=()=>{ state.drawMode=b.dataset.v; curveEdit=null; renderPanel(); });
  const pdjoin=$('pdJoin'); if(pdjoin) pdjoin.onchange=e=>{ state.joinEnds=e.target.checked; if(!state.joinEnds) state.trimJoin=false; renderPanel(); autosave(); };
  const pdtrim=$('pdTrim'); if(pdtrim) pdtrim.onchange=e=>{ state.trimJoin=e.target.checked; autosave(); };
  bindColorField('bkColor', ()=>state.bucket.color, v=>{state.bucket.color=v;});
  bindRange('bkOp',v=>{state.bucket.opacity=v;});
  bindRange('bkTol',v=>{state.bucket.tolerance=v;});
  document.querySelectorAll('[data-editfill]').forEach(b=>b.onclick=()=>{
    const id=parseInt(b.dataset.editfill);
    editFillId = (editFillId===id) ? null : id;
    renderPanel();
  });
  if(editFillId!=null){
    const f=state.items.find(x=>x.id===editFillId && x.kind==='fill');
    if(f){
      bindColorField('efColor', ()=>f.color, v=>{ pushUndo(); f.color=v; compose(); renderPanel(); autosave(); });
      bindRange('efOp', v=>{ f.opacity=v; compose(); autosave(); });
    }
  }
  document.querySelectorAll('[data-delfill]').forEach(b=>b.onclick=()=>{
    pushUndo();
    state.items=state.items.filter(x=>x.id!==parseInt(b.dataset.delfill));
    compose(); renderPanel(); autosave();
  });
  const rl=$('refLoad'); if(rl) rl.onclick=()=>{
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
  const cvs=$('cvSize'); if(cvs) cvs.onchange=e=>{
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
  const cvg=$('cvGrid'); if(cvg) cvg.onchange=e=>{state.gridOn=e.target.checked;drawGrid();autosave();};
  const cvgs=$('cvGridSp'); if(cvgs) cvgs.onchange=e=>{state.gridSpacing=parseInt(e.target.value);drawGrid();autosave();};
  const ga=$('cvGridAbove'); if(ga) ga.onchange=e=>{state.gridAbove=e.target.checked;drawGrid();autosave();};
  const cvm=$('cvMargin'); if(cvm) cvm.onchange=e=>{state.marginPx=parseInt(e.target.value);drawGrid();autosave();};
  const cvsn=$('cvSnap'); if(cvsn) cvsn.onchange=e=>{state.snapOn=e.target.checked;autosave();};
  const cvsp=$('cvShowProps'); if(cvsp) cvsp.onchange=e=>{state.showProps=e.target.checked;updatePropsHud();autosave();};
  bindRange('cvBg',v=>{ localStorage.setItem(BG_KEY,String(Math.round(v))); applyBg(); });
  bindRange('cvZoom',v=>{state.zoom=v/100;applyBoardSize();applyRef();},'%');
  const zf=$('cvZoomFit'); if(zf) zf.onclick=zoomFit;
  const z1=$('cvZoom100'); if(z1) z1.onclick=()=>setZoom(1);
  const pjs=$('projSave'); if(pjs) pjs.onclick=saveProjectAs;
  const pje=$('projExport'); if(pje) pje.onclick=exportProjectFile;
  const pji=$('projImport'); if(pji) pji.onclick=importProjectFile;
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
    marginPx:state.marginPx,snapOn:state.snapOn,joinEnds:state.joinEnds,trimJoin:state.trimJoin,
    globalLine:state.globalLine,globalFill:state.globalFill,globalLineOff:state.globalLineOff,globalFillOn:state.globalFillOn,
    showProps:state.showProps,
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
  state.marginPx=j.marginPx||0; state.snapOn=!!j.snapOn;
  state.joinEnds=!!j.joinEnds; state.trimJoin=!!j.trimJoin;
  if(j.globalLine!==undefined) state.globalLine=j.globalLine;
  if(j.globalFill!==undefined) state.globalFill=j.globalFill;
  if(j.globalLineOff!==undefined) state.globalLineOff=!!j.globalLineOff;
  if(j.globalFillOn!==undefined) state.globalFillOn=!!j.globalFillOn;
  if(j.showProps!==undefined) state.showProps=!!j.showProps;
  // segurança: nunca deixar as globais nulas (mantém predefinidas visíveis)
  if(state.globalLine==null) state.globalLine='#1D2333';
  if(state.globalFill==null) state.globalFill='#5AC8FA';
  state.items=j.items||[];
  state.items.forEach(i=>{ if(i.kind==='stroke' && i.w2==null) i.w2=4; });
  if(j.bucket) Object.assign(state.bucket,j.bucket);
  state.nextId=j.nextId||(Math.max(0,...state.items.map(s=>s.id))+1);
  state.selId=null;
  buildBoard(); renderPanel();
  projectDirty=false; updateSaveBtn();   // recém-carregado: nada a salvar ainda
}
function autosave(){
  projectDirty=true; updateSaveBtn();
  try{ localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(projectData())); }catch(e){}
}
function getProjects(){ try{ return JSON.parse(localStorage.getItem(PROJECTS_KEY)||'{}'); }catch(e){ return {}; } }
function saveProjectAs(){
  const name=(prompt('Nome do projeto:', currentProjectName||'meu-icone')||'').trim();
  if(!name) return;
  const all=getProjects();
  all[name]={when:Date.now(),data:projectData()};
  try{
    localStorage.setItem(PROJECTS_KEY,JSON.stringify(all));
    currentProjectName=name; projectDirty=false; updateSaveBtn();
    toast('Projeto "'+name+'" salvo.'); renderProjects();
  }
  catch(e){ toast('Sem espaço no navegador para salvar.',true); }
}
// salvar SOBRE o projeto atual (sem perguntar nome)
function saveProjectOver(){
  if(!currentProjectName){ saveProjectAs(); return; }  // ainda não tem nome: cai no salvar como
  const all=getProjects();
  all[currentProjectName]={when:Date.now(),data:projectData()};
  try{
    localStorage.setItem(PROJECTS_KEY,JSON.stringify(all));
    projectDirty=false; updateSaveBtn();
    toast('Projeto "'+currentProjectName+'" salvo.'); renderProjects();
  }
  catch(e){ toast('Sem espaço no navegador para salvar.',true); }
}
// NOVO projeto (tela limpa), perguntando sobre alterações não salvas
function newProject(){
  const hasContent = state.items.length>0;
  if(hasContent && projectDirty){
    const salvar = confirm('Deseja salvar as alterações antes de criar um novo projeto?\n\nOK = salvar   |   Cancelar = descartar');
    if(salvar){
      if(currentProjectName){ saveProjectOver(); }        // projeto existente: salva e segue
      else { saveProjectAs(); return; }                    // projeto novo: vai pro Salvar como; refaça "Novo" depois
    }
  }
  // limpa tudo e começa do zero
  pushUndo();
  state.items=[]; state.selId=null; state.multi=[]; state.nextId=1;
  if(state.ref){ state.ref.src=null; }
  currentProjectName=null; projectDirty=false;
  compose(); renderHits(); renderUi(); renderPanel(); updateSaveBtn();
  try{ localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(projectData())); }catch(e){}
  toast('Novo projeto.');
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
    bo.onclick=()=>{ pushUndo(); loadProjectData(all[n].data); currentProjectName=n; projectDirty=false; updateSaveBtn(); toast('Projeto "'+n+'" carregado.'); };
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
let lastNudge=0, pickerState=null, eyedropActive=false, editFillId=null;
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
    expanded:false, editMode:false, mode:(pickerState&&pickerState.mode)||'palette',
    hue:hexToHsv(color||'#5AC8FA').h};
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
  if(!keepHue){ pickerState.hsl=hexToHsl(c); const v=hexToHsv(c).v; if(v>0.02) pickerState.hue=hexToHsv(c).h; }
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
    '<div class="cp-tabs">'+
      '<button class="cp-tab'+(st.mode==='palette'?' on':'')+'" data-mode="palette" title="Paletas">▦</button>'+
      '<button class="cp-tab'+(st.mode==='box'?' on':'')+'" data-mode="box" title="Caixa de gradiente">◨</button>'+
      '<button class="cp-tab'+(st.mode==='wheel'?' on':'')+'" data-mode="wheel" title="Roda de cores">◉</button>'+
    '</div>'+
    (st.mode==='wheel'
      ? '<div class="cp-wheel-wrap"><canvas id="cpWheel" width="220" height="220"></canvas><div id="cpWheelDot"></div></div>'+
        '<input type="range" id="cpVal" min="0" max="100" value="'+Math.round(hexToHsl(st.color).l*100)+'" title="Tonalidade (preto → cor → branco)" class="cp-tone">'
      : st.mode==='box'
      ? '<div class="cp-box-wrap"><canvas id="cpBox" width="240" height="180"></canvas><div id="cpBoxDot"></div></div>'+
        '<input type="range" id="cpHue" min="0" max="360" value="'+Math.round(hexToHsv(st.color).h*360)+'" title="Matiz" class="cp-hue">'
      : '<input type="range" id="cpLight" min="0" max="100" value="50" title="Tonalidade: mais claro ← → mais escuro">'+
        '<div class="cp-label">Cores do tema</div>'+
        '<div class="cp-grid">'+THEME_COLORS.map(c=>cell(c)).join('')+'</div>'+
        [0,1,2,3,4].map(row=>'<div class="cp-grid">'+THEME_COLORS.map(c=>cell(variantsOf(c)[row])).join('')+'</div>').join('')+
        '<div class="cp-label" style="margin-top:9px">Cores padrão</div>'+
        '<div class="cp-grid">'+STD_COLORS.map(c=>cell(c)).join('')+'</div>')+
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
  el.querySelectorAll('.cp-tab').forEach(b=>b.onclick=()=>{ st.mode=b.dataset.mode; renderPicker(); });
  el.querySelector('#cpHex').onchange=e=>{
    let v=e.target.value.trim(); if(v && v[0]!=='#') v='#'+v;
    if(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)){
      if(v.length===4) v='#'+v[1]+v[1]+v[2]+v[2]+v[3]+v[3];
      setPickerColor(v); addRecentColor(v);
    } else e.target.value=st.color;
  };
  const lightSl=el.querySelector('#cpLight');
  if(lightSl) lightSl.oninput=e=>{
    const {h,s}=st.hsl;
    const L=0.97 - (e.target.value/100)*0.94;
    st.hsl={h,s,l:L};
    setPickerColor(hslToHex(h,s,L), true);
  };
  el.querySelector('#cpEye').onclick=()=>{ startEyedropCapture(); };
  el.querySelector('#cpClose').onclick=()=>closeColorPicker();
  const me=el.querySelector('#cpMore'); if(me) me.onclick=()=>{ st.expanded=!st.expanded; renderPicker(); };
  const ed=el.querySelector('#cpEdit'); if(ed) ed.onclick=()=>{ st.editMode=!st.editMode; renderPicker(); };
  if(st.mode==='wheel'){ try{ setupWheel(el); }catch(err){ console.error(err); } requestAnimationFrame(()=>{ if(pickerState&&pickerState.mode==='wheel') try{ setupWheel(el); }catch(e){} }); }
  if(st.mode==='box'){ try{ setupBox(el); }catch(err){ console.error(err); } requestAnimationFrame(()=>{ if(pickerState&&pickerState.mode==='box') try{ setupBox(el); }catch(e){} }); }
}
/* ---- roda de cores (HSV) ---- */
function hexToHsv(hex){
  const [r,g,b]=hexToRgb(hex).map(v=>v/255);
  const max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min;
  let h=0;
  if(d!==0){
    if(max===r) h=((g-b)/d+(g<b?6:0))/6;
    else if(max===g) h=((b-r)/d+2)/6;
    else h=((r-g)/d+4)/6;
  }
  return {h, s:max===0?0:d/max, v:max};
}
function hsvToHex(h,s,v){
  let r,g,b;
  const i=Math.floor(h*6), f=h*6-i, p=v*(1-s), q=v*(1-f*s), t=v*(1-(1-f)*s);
  switch(i%6){
    case 0: r=v;g=t;b=p;break; case 1: r=q;g=v;b=p;break; case 2: r=p;g=v;b=t;break;
    case 3: r=p;g=q;b=v;break; case 4: r=t;g=p;b=v;break; default: r=v;g=p;b=q;
  }
  return rgbToHex(r*255,g*255,b*255);
}
function setupBox(el){
  const cv=el.querySelector('#cpBox'); if(!cv) return;
  const ctx=cv.getContext('2d'), W=cv.width, H=cv.height;
  const st=pickerState;
  const hsv=hexToHsv(st.color);
  if(st.hue==null) st.hue=hsv.h;
  const hue=st.hue;
  // fundo: matiz puro -> branco (horizontal), transparente -> preto (vertical)
  const base=hsvToHex(hue,1,1);
  ctx.fillStyle=base; ctx.fillRect(0,0,W,H);
  const gw=ctx.createLinearGradient(0,0,W,0);
  gw.addColorStop(0,'#ffffff'); gw.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=gw; ctx.fillRect(0,0,W,H);
  const gb=ctx.createLinearGradient(0,0,0,H);
  gb.addColorStop(0,'rgba(0,0,0,0)'); gb.addColorStop(1,'#000000');
  ctx.fillStyle=gb; ctx.fillRect(0,0,W,H);
  // marcador na posição de saturação/brilho atual
  const dot=el.querySelector('#cpBoxDot');
  const place=(s,v)=>{ dot.style.left=(s*W)+'px'; dot.style.top=((1-v)*H)+'px'; };
  place(hsv.s, hsv.v);
  const pick=e=>{
    const r=cv.getBoundingClientRect();
    let x=(e.clientX-r.left)/r.width, y=(e.clientY-r.top)/r.height;
    x=Math.max(0,Math.min(1,x)); y=Math.max(0,Math.min(1,y));
    const s=x, v=1-y;
    place(s,v);
    const hex=hsvToHex(st.hue,s,v);
    st.color=hex.toUpperCase(); st.hsl=hexToHsl(hex);
    st.onPick(st.color);
    const pv=el.querySelector('#cpPreview'); if(pv) pv.style.background=st.color;
    const hx=el.querySelector('#cpHex'); if(hx) hx.value=st.color;
  };
  let dragging=false;
  cv.addEventListener('pointerdown',e=>{ dragging=true; cv.setPointerCapture(e.pointerId); pick(e); });
  cv.addEventListener('pointermove',e=>{ if(dragging) pick(e); });
  cv.addEventListener('pointerup',e=>{ dragging=false; addRecentColor(st.color); });
  const hueSl=el.querySelector('#cpHue');
  if(hueSl) hueSl.oninput=()=>{ st.hue=hueSl.value/360; setupBox(el); 
    // ao mover o matiz, recomputa a cor mantendo s/v
    const cur=hexToHsv(st.color);
    const hex=hsvToHex(st.hue,cur.s,cur.v);
    st.color=hex.toUpperCase(); st.hsl=hexToHsl(hex); st.onPick(st.color);
    const pv=el.querySelector('#cpPreview'); if(pv) pv.style.background=st.color;
    const hx=el.querySelector('#cpHex'); if(hx) hx.value=st.color;
  };
}
function setupWheel(el){
  const cv=el.querySelector('#cpWheel'); if(!cv) return;
  const ctx=cv.getContext('2d'), W=cv.width, R=W/2;
  const st=pickerState;
  const hslCur=hexToHsl(st.color);
  // matiz/saturação da versão PURA da cor (L=0.5) — posiciona o ponto na roda
  const pureHex=hslToHex(hslCur.h, hslCur.s, 0.5);
  const hsv=hexToHsv(pureHex);
  hsv.h=hslCur.h;
  // ESTILO FIGMA: a roda mostra todas as cores em brilho máximo (v=1).
  // O escuro/claro fica só na barra de tonalidade abaixo.
  const img=ctx.createImageData(W,W), d=img.data;
  for(let y=0;y<W;y++) for(let x=0;x<W;x++){
    const dx=x-R, dy=y-R, dist=Math.hypot(dx,dy);
    const i=(y*W+x)*4;
    if(dist>R+0.5){ d[i+3]=0; continue; }
    let h=(Math.atan2(dy,dx)/(2*Math.PI)); if(h<0) h+=1;
    const s=Math.min(1,dist/R);
    const [rr,gg,bb]=hexToRgb(hsvToHex(h,s,1));
    d[i]=rr; d[i+1]=gg; d[i+2]=bb;
    d[i+3]= dist>R-1 ? Math.max(0,255*(R+0.5-dist)/1.5) : 255; // borda suave
  }
  ctx.putImageData(img,0,0);
  const dot=el.querySelector('#cpWheelDot');
  const place=(h,s)=>{ const ang=h*2*Math.PI, rad=s*R; dot.style.left=(R+Math.cos(ang)*rad)+'px'; dot.style.top=(R+Math.sin(ang)*rad)+'px'; };
  place(hsv.h, hsv.s);
  // barra de tonalidade estilo Figma: preto (0) -> cor pura (50) -> branco (100)
  const tone=el.querySelector('#cpVal');
  // matiz e saturação-base (em HSL) da cor pura escolhida na roda
  let baseHS = { h: hexToHsl(hsvToHex(hsv.h, hsv.s, 1)).h, s: hexToHsl(hsvToHex(hsv.h, hsv.s, 1)).s };
  const toneToHex=(pct)=>{
    const l=pct/100;                 // 0=preto, 0.5=cor cheia, 1=branco
    return hslToHex(baseHS.h, baseHS.s, l);
  };
  const paintTone=()=>{
    if(!tone) return;
    const mid=hslToHex(baseHS.h, baseHS.s, 0.5);
    tone.style.background='linear-gradient(to right,#000 0%,'+mid+' 50%,#fff 100%)';
  };
  paintTone();
  const applyFromWheel=(h,s)=>{
    // atualiza matiz/saturação base a partir da roda
    baseHS = { h: hexToHsl(hsvToHex(h,s,1)).h, s: hexToHsl(hsvToHex(h,s,1)).s };
    const pct = tone ? +tone.value : 50;
    const hex = toneToHex(pct);
    st.color=hex.toUpperCase(); st.hsl=hexToHsl(hex); st.hue=h;
    st.onPick(st.color);
    const pv=el.querySelector('#cpPreview'); if(pv) pv.style.background=st.color;
    const hx=el.querySelector('#cpHex'); if(hx) hx.value=st.color;
    paintTone();
  };
  const pick=e=>{
    const r=cv.getBoundingClientRect();
    const scale=W/r.width;
    let dx=(e.clientX-r.left)*scale-R, dy=(e.clientY-r.top)*scale-R;
    let dist=Math.hypot(dx,dy);
    if(dist>R){ dx*=R/dist; dy*=R/dist; dist=R; }
    let h=(Math.atan2(dy,dx)/(2*Math.PI)); if(h<0) h+=1;
    const s=Math.min(1,dist/R);
    place(h,s);
    applyFromWheel(h,s);
  };
  let dragging=false;
  cv.addEventListener('pointerdown',e=>{ dragging=true; cv.setPointerCapture(e.pointerId); pick(e); });
  cv.addEventListener('pointermove',e=>{ if(dragging) pick(e); });
  cv.addEventListener('pointerup',e=>{ dragging=false; addRecentColor(st.color); });
  if(tone) tone.oninput=()=>{
    const hex=toneToHex(+tone.value);
    st.color=hex.toUpperCase(); st.hsl=hexToHsl(hex);
    st.onPick(st.color);
    const pv=el.querySelector('#cpPreview'); if(pv) pv.style.background=st.color;
    const hx=el.querySelector('#cpHex'); if(hx) hx.value=st.color;
  };
}
/* ================= captura de cor em tela cheia ================= */
let eyedropCapture=null; // {origColor, provisional, pickerBackup, panelWasOpen}
function startEyedropCapture(){
  if(!pickerState) return;
  // guarda o estado atual para restaurar depois
  eyedropCapture={
    origColor: pickerState.color,
    provisional: pickerState.color,
    onPick: pickerState.onPick,
    anchorColor: pickerState.color,
    mode: pickerState.mode,
    panelWasOpen: document.body.classList.contains('props-open')
  };
  // esconde o seletor e limpa a tela
  const cp=$('colorPicker'); if(cp) cp.style.display='none';
  document.body.classList.add('eyedrop-capturing');
  eyedropActive=true;
  renderHits();   // hits ficam inertes: clicar não seleciona nem arrasta objetos
  // barra começa com a cor atual
  updateEyedropBar(pickerState.color);
  toast('Toque no desenho para provar a cor. Confirme em Aplicar.');
}
function updateEyedropBar(color){
  const sw=$('eyedropSwatch'), hx=$('eyedropHex');
  if(color){ if(sw) sw.style.background=color; if(hx) hx.textContent=color.toUpperCase(); }
  else { if(sw) sw.style.background='transparent'; if(hx) hx.textContent='—'; }
}
function endEyedropCapture(apply){
  const cap=eyedropCapture; if(!cap) return;
  eyedropActive=false;
  document.body.classList.remove('eyedrop-capturing');
  const cp=$('colorPicker'); if(cp) cp.style.display='';
  eyedropCapture=null;
  renderHits();   // restaura os hits normais (seleção volta a funcionar)
  if(apply && cap.provisional){
    setPickerColor(cap.provisional);   // carrega a cor no seletor e aplica no alvo
  }
  // o seletor volta como estava (já visível); nada mais a fazer
}
// prova a cor num ponto (toque simples, sem confirmar)
function eyedropSample(e){
  const c=sampleCanvas(boardPoint(e));
  if(c){ eyedropCapture.provisional=c; updateEyedropBar(c); }
  else { updateEyedropBar(null); toast('Área transparente nesse ponto.'); }
}
// gestos durante a captura: reutiliza o sistema pan/pinça (arrastar 1 dedo, pinça 2 dedos)
// e um toque simples (sem mover) prova a cor.
let edTap={pt:null, moved:false};
$('board').addEventListener('pointerdown',e=>{
  if(!eyedropActive) return;
  e.stopPropagation();
  edTap.pt={x:e.clientX,y:e.clientY,id:e.pointerId}; edTap.moved=false;
  panPointerDown(e);   // habilita arraste/pinça
}, true);
$('board').addEventListener('pointermove',e=>{
  if(!eyedropActive) return;
  if(edTap.pt && edTap.pt.id===e.pointerId){
    if(Math.abs(e.clientX-edTap.pt.x)>6 || Math.abs(e.clientY-edTap.pt.y)>6) edTap.moved=true;
  }
  panPointerMove(e);
}, true);
$('board').addEventListener('pointerup',e=>{
  if(!eyedropActive) return;
  e.stopPropagation();
  const wasTap = edTap.pt && edTap.pt.id===e.pointerId && !edTap.moved && activePointers.size<=1;
  panPointerUp(e);
  if(wasTap) eyedropSample(e);   // toque simples = provar a cor
  edTap.pt=null;
}, true);
$('board').addEventListener('pointercancel',e=>{ if(eyedropActive){ panPointerUp(e); edTap.pt=null; } }, true);
/* gestos no modo suavizar: arrastar 1 dedo = pan, pinça = zoom, toque = isolar traço */
let smTap=null;
$('board').addEventListener('pointermove',e=>{
  if(state.tool!=='smooth' || !smTap) return;
  if(smTap.pt.id===e.pointerId){
    if(Math.abs(e.clientX-smTap.pt.x)>6 || Math.abs(e.clientY-smTap.pt.y)>6) smTap.moved=true;
  }
  panPointerMove(e);
}, true);
$('board').addEventListener('pointerup',e=>{
  if(state.tool!=='smooth' || !smTap) return;
  const wasTap = smTap.pt.id===e.pointerId && !smTap.moved && activePointers.size<=1;
  const hit=smTap.hit;
  panPointerUp(e);
  if(wasTap && hit){
    setSelection([hit.id]); renderUi();
    if(smoothSession) smoothRetarget(); else renderPanel();
  }
  smTap=null;
}, true);
$('board').addEventListener('pointercancel',e=>{ if(state.tool==='smooth'&&smTap){ panPointerUp(e); smTap=null; } }, true);
$('eyedropApply').onclick=()=>endEyedropCapture(true);
$('eyedropCancel').onclick=()=>endEyedropCapture(false);
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
function colorFieldX(id, val, clearId){
  const empty = (val==null);
  const sw = empty
    ? '<button class="cswatch empty" id="'+id+'" title="Sem cor"></button>'
    : '<button class="cswatch" id="'+id+'" style="background:'+val+'"></button>';
  const tx = '<input class="inp hexinp" id="'+id+'tx" value="'+(empty?'':String(val).toUpperCase())+'" placeholder="—" maxlength="7" spellcheck="false">';
  const clr = '<button class="btn sm cclear" id="'+clearId+'" title="Sem cor">✕</button>';
  return sw+tx+clr;
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
  if(k==='p') setTool('pan');
  if(k==='l') setTool('layers');
  if(k==='m') setTool('modify');
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
function selectedSingleId(){
  if(state.selId!=null) return state.selId;
  if(state.multi.length===1) return state.multi[0];
  return null;
}
function updateOrderFabs(){
  const box=$('orderFabs'); if(!box) return;
  const id=selectedSingleId();
  const it = id!=null ? state.items.find(i=>i.id===id) : null;
  if(!it || it.kind!=='stroke' || !it.pts || state.tool!=='select'){
    box.classList.remove('show'); return;
  }
  box.classList.add('show');
  // posiciona logo abaixo do centro-inferior da forma, em coords de tela
  const bb=ptsBBox(it.pts);
  const r=overlay.getBoundingClientRect();
  const sx = r.left + (bb.cx/state.size)*r.width;
  const sy = r.top  + (bb.y1/state.size)*r.height;
  box.style.left = sx+'px';
  box.style.top  = (sy+12)+'px';
  box.style.bottom='auto';
  box.style.transform='translateX(-50%)';
}
$('orderUp').onclick=()=>{ const id=selectedSingleId(); if(id!=null) moveLayer(id,+1); };
$('orderDown').onclick=()=>{ const id=selectedSingleId(); if(id!=null) moveLayer(id,-1); };
/* hit-test central: objeto mais acima sob o ponto do board */
function objectAtPoint(p){
  const cv=$('composite'); const k=RES/state.size; const ctx=cv.getContext('2d');
  for(let i=state.items.length-1;i>=0;i--){
    const it=state.items[i];
    if(it.kind!=='stroke' || !it.pts || it.pts.length<2) continue;
    const path=itemPath2D(it);
    ctx.save(); ctx.setTransform(k,0,0,k,0,0);
    let hit=false;
    if(it.closed){ hit=ctx.isPointInPath(path, p.x*k, p.y*k); }
    if(!hit){
      // proximidade da linha (traços abertos ou borda)
      ctx.lineWidth=Math.max(14, it.w+10);
      hit=ctx.isPointInStroke(path, p.x*k, p.y*k);
    }
    ctx.restore();
    if(hit) return it;
  }
  return null;
}
/* seleção/deseleção robusta por toque ou clique */
$('board').addEventListener('pointerdown',e=>{
  if(eyedropActive) return;   // conta-gotas: não seleciona nem move nada
  if(state.tool!=='select' && state.tool!=='smooth' && state.tool!=='modify' && state.tool!=='nodes') return;
  if(e.button!==undefined && e.button!==0) return;
  // no submodo "adicionar", o clique deve criar nó na linha mesmo que caia perto de um nó
  const ndAddMode = (state.tool==='nodes' && nodeSubmode==='add');
  if(!ndAddMode && e.target.closest && e.target.closest('.thandle,.node')) return;

  const startP=boardPoint(e);
  const hit=objectAtPoint(startP);

  // MODO EDITAR NÓS
  if(state.tool==='nodes'){
    const cur=selItem();
    // clicou noutro objeto: migra a edição para ele
    if(hit && (!cur || hit.id!==cur.id)){
      setSelection([hit.id]); ensureEditableNodes(hit);
      nodeSubmode=null; compose(); renderHits(); renderUi(); renderPanel();
      return;
    }
    if(cur && cur.kind==='stroke'){
      // submodo adicionar: clique na linha cria um nó ali
      if(nodeSubmode==='add' && hit && hit.id===cur.id){
        addNodeAt(cur, startP); renderUi();
        return;
      }
      // (remover é tratado no clique do próprio nó, via renderNodes)
    }
    return;
  }

  // MODO MODIFICAR: toca noutro objeto = alterna alvo; permite arrastar/manipular
  if(state.tool==='modify'){
    if(hit){ setSelection([hit.id]); if(!document.body.classList.contains('props-open')) openProps('props'); else renderPanel(); renderUi(); startMoveDrag(hit, e); }
    return;
  }

  // MODO SUAVIZAR: toque isola o traço; arraste m=pan; pinça=zoom (ferramenta segue ativa)
  if(state.tool==='smooth'){
    smTap={pt:{x:e.clientX,y:e.clientY,id:e.pointerId}, moved:false, hit:hit};
    if(hit && !document.body.classList.contains('props-open')) openProps('props');
    panPointerDown(e);
    return;
  }

  if(hit){
    if(e.shiftKey){
      const base = state.multi.length ? state.multi.slice() : (state.selId!=null ? [state.selId] : []);
      const at=base.indexOf(hit.id);
      if(at>=0) base.splice(at,1); else base.push(hit.id);
      setSelection(base); renderUi(); renderPanel();
      return;
    }
    if(state.multi.length>1 && state.multi.includes(hit.id)){ startGroupMove(e); return; }
    setSelection([hit.id]);
    renderUi(); renderPanel();
    startMoveDrag(hit, e);
    return;
  }
  e.preventDefault();
  startMarquee(e);
}, true);
function setZoom(z){
  state.zoom=Math.max(0.25,Math.min(3,z));
  applyBoardSize(); applyRef(); refreshBrushCursor();
  const zc=$('cvZoom'); if(zc){ zc.value=Math.round(state.zoom*100); const zv=$('cvZoomv'); if(zv) zv.textContent=Math.round(state.zoom*100)+'%'; }
}
function zoomFit(){
  const ws=$('workspace');
  const mobile=window.innerWidth<768;
  const base=Math.min(680, state.size);
  if(mobile){
    // no smartphone: prioriza a LARGURA e encosta o desenho no topo
    // (as opções da ferramenta aparecem embaixo, então quanto mais alto, melhor)
    const availW=ws.clientWidth-20;
    let z=availW/base;
    // se couber com folga na altura, tudo bem; senão, ainda prioriza a largura
    z=Math.max(0.25, Math.min(2.5, z));
    setZoom(z);
    ws.scrollLeft=0; ws.scrollTop=0;   // alinhado ao topo
  } else {
    const availW=ws.clientWidth-32, availH=ws.clientHeight-32;
    const z=Math.min(availW/base, availH/base);
    setZoom(Math.max(0.25, Math.min(2.5, z)));
    ws.scrollLeft=0; ws.scrollTop=0;
  }
}
/* ---------------- Pan/Zoom por toque (ferramenta P) ---------------- */
const activePointers=new Map();
let pinch=null;
function panPointerDown(e){
  e.preventDefault();
  const board=$('board'); board.setPointerCapture(e.pointerId);
  activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const wsE=$('workspace');
  if(activePointers.size===1){
    board.style.cursor='grabbing';
    board._panStart={x:e.clientX,y:e.clientY,sl:wsE.scrollLeft,st:wsE.scrollTop};
  } else if(activePointers.size===2){
    const pts=[...activePointers.values()];
    pinch={d:Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y), zoom:state.zoom,
      cx:(pts[0].x+pts[1].x)/2, cy:(pts[0].y+pts[1].y)/2};
  }
}
function panPointerMove(e){
  if(!activePointers.has(e.pointerId)) return;
  activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const wsE=$('workspace'), board=$('board');
  if(activePointers.size>=2 && pinch){
    const pts=[...activePointers.values()];
    const d=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
    const nz=Math.max(0.5,Math.min(2.5, pinch.zoom*(d/pinch.d)));
    const rect=board.getBoundingClientRect();
    const px=pinch.cx-rect.left, py=pinch.cy-rect.top;
    const k=nz/state.zoom;
    state.zoom=nz; applyBoardSize(); applyRef(); refreshBrushCursor();
    wsE.scrollLeft += px*(k-1); wsE.scrollTop += py*(k-1);
    const z=$('cvZoom'); if(z){ z.value=Math.round(nz*100); const zv=$('cvZoomv'); if(zv) zv.textContent=Math.round(nz*100)+'%'; }
  } else if(activePointers.size===1 && board._panStart){
    const s=board._panStart;
    wsE.scrollLeft = s.sl-(e.clientX-s.x);
    wsE.scrollTop  = s.st-(e.clientY-s.y);
  }
}
function panPointerUp(e){
  activePointers.delete(e.pointerId);
  if(activePointers.size<2) pinch=null;
  if(activePointers.size===0){
    $('board')._panStart=null;
    // NÃO forçar 'grab' aqui: este handler é global e dispara ao terminar
    // qualquer gesto (inclusive um risco). Só o modo pan usa 'grab'.
    if(state.tool==='pan') setBoardCursor('grab');
    else if(['draw','erase','shape'].includes(state.tool)) refreshBrushCursor();
  }
}
document.addEventListener('pointermove',panPointerMove);
document.addEventListener('pointerup',panPointerUp);
document.addEventListener('pointercancel',panPointerUp);

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
  applyBoardSize(); applyRef(); refreshBrushCursor();
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
  setTool('select');
  updateColorBtn();
  updateUndoBtns();
  if('serviceWorker' in navigator && location.protocol.startsWith('http')){
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
}
init();
