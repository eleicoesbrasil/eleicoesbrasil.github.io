/* mobile_inspecao (onda 2): substituto do mouse-over + zoom simples nos gráficos g-svg (fluxo), b-svg e as-svg (abstenção).
   - cartão de leitura PERSISTENTE (.mi-card) com ◀ ▶ ✕ (44px); toque marca; arrastar na horizontal move o cursor (scrub);
     arrasto vertical continua rolando a página (touch-action:pan-y); tocar fora fecha.
   - as-svg: botões − + ⟲, chips de faixa, modo "Mover" (arrasto desloca), pinça opcional; o eixo X é recalculado
     reescrevendo o markup ORIGINAL (viewBox 1000) e deixando o mobile_graficos reescalar (zero mudança nele).
   - Convive com mobile_graficos.js: lê svg._orig (markup original) e observa mudanças externas para reiniciar.
   Padrão visual para unificação: .mi-card / .mi-nav / .mi-hl / .mi-tools (ver mobile_inspecao.css). API: window.__mi */
(function(){
var MQ=window.matchMedia('(max-width:700px)');
var NS='http://www.w3.org/2000/svg';
function $(i){return document.getElementById(i);}
function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e;}
function btn(cls,txt,label){var b=el('button',cls,txt);b.type='button';if(label)b.setAttribute('aria-label',label);return b;}
var SW={'Lula':'var(--lula)','Flávio':'var(--flavio)','Outros':'var(--outros)','Brancos':'var(--bn)','Abstenção':'var(--abs)'};
var suppressUntil=0,charts={};
var HINT='Toque ou arraste sobre o gráfico para ler os valores.';

/* ---------- tooltip antigo: some quando o toque vem dos nossos gráficos ---------- */
var ttp=$('ttp');
if(ttp)new MutationObserver(function(){if(MQ.matches&&Date.now()<suppressUntil&&!ttp.hidden)ttp.hidden=true;}).observe(ttp,{attributes:true,attributeFilter:['hidden']});

/* ---------- criação do conjunto (wrap + cartão [+ ferramentas]) ---------- */
function mk(id,kind){
 var svg=$(id);if(!svg)return null;
 var c={id:id,kind:kind,svg:svg,sel:null,seen:svg._orig,mine:0,pts:{},panMode:false};
 var wrap=el('div','mi-wrap');svg.parentNode.insertBefore(wrap,svg);wrap.appendChild(svg);
 var hl=el('div','mi-hl');hl.innerHTML='<i class="mi-v"></i><i class="mi-r"></i><i class="mi-b"></i>';wrap.appendChild(hl);
 var card=el('div','mi-card mi-empty');card.setAttribute('role','status');card.setAttribute('aria-live','polite');
 var head=el('div','mi-head'),t=el('div','mi-t');t.appendChild(el('b','mi-ttl'));t.appendChild(el('span','mi-sub'));
 var nav=el('div','mi-nav');
 var bp=btn('mi-prev','◀','Anterior'),bn=btn('mi-next','▶','Próximo'),bx=btn('mi-x','✕','Fechar');
 nav.appendChild(bp);nav.appendChild(bn);nav.appendChild(bx);head.appendChild(t);head.appendChild(nav);
 var rows=el('div','mi-rows');
 card.appendChild(head);card.appendChild(rows);wrap.parentNode.insertBefore(card,wrap.nextSibling);
 c.wrap=wrap;c.hl=hl;c.card=card;c.rows=rows;c.ttl=t.firstChild;c.sub=t.lastChild;c.sub.textContent=HINT;
 bp.addEventListener('click',function(){step(c,-1);});bn.addEventListener('click',function(){step(c,1);});bx.addEventListener('click',function(){clear(c);});
 if(kind==='as')mkTools(c);
 bind(c);
 if(window.ResizeObserver)new ResizeObserver(function(){place(c);}).observe(svg);
 new MutationObserver(function(){sync(c);requestAnimationFrame(function(){place(c);});}).observe(svg,{childList:true});
 charts[id]=c;return c;
}

/* ---------- itens navegáveis ---------- */
function rectOf(es){var l=1e9,t=1e9,r=-1e9,b=-1e9;es.forEach(function(e){var q=e.getBoundingClientRect();l=Math.min(l,q.left);t=Math.min(t,q.top);r=Math.max(r,q.right);b=Math.max(b,q.bottom);});return {x0:l,y0:t,x1:r,y1:b};}
function items(c){
 var out=[],m={};
 if(c.kind==='as'){
  [].forEach.call(c.svg.querySelectorAll('circle[data-i]'),function(e){var i=+e.dataset.i,v=c.model&&c.model.bins[i];
   var vis=!(c.model&&c.view)||(v>=c.view[0]-1e-9&&v<=c.view[1]+1e-9);var q=rectOf([e]);q.key=i;q.els=[e];q.vis=vis;out.push(q);});
  out.sort(function(a,b){return a.key-b.key;});return out;}
 var sel=c.kind==='b'?'rect[data-b]':'rect[data-c]';
 [].forEach.call(c.svg.querySelectorAll(sel),function(e){var k=c.kind==='b'?(e.dataset.b+'/'+e.dataset.t):e.dataset.c;(m[k]=m[k]||(out.push({key:k,els:[],vis:true}),out[out.length-1])).els.push(e);});
 out.forEach(function(it){var q=rectOf(it.els);it.x0=q.x0;it.x1=q.x1;it.y0=q.y0;it.y1=q.y1;});
 return out;}
function idx(list,key){for(var i=0;i<list.length;i++)if(list[i].key===key)return i;return -1;}

/* ---------- seleção / cartão ---------- */
function clear(c){c.sel=null;c.card.classList.add('mi-empty');c.rows.innerHTML='';c.ttl.textContent='';c.sub.textContent=HINT;c.hl.className='mi-hl';}
function step(c,d){sync(c);var L=items(c);if(!L.length)return;var i=idx(L,c.sel);i=i<0?(d>0?0:L.length-1):(i+d+L.length)%L.length;select(c,L[i].key);}
function atX(c,x){sync(c);var L=items(c).filter(function(it){return it.vis;});if(!L.length)return;var b=null,bd=1e9;
 L.forEach(function(it){var d=x<it.x0?it.x0-x:x>it.x1?x-it.x1:0;d+=Math.abs(x-(it.x0+it.x1)/2)*0.001;if(d<bd){bd=d;b=it;}});if(b&&b.key!==c.sel)select(c,b.key);}
function select(c,key){
 sync(c);var L=items(c),i=idx(L,key);if(i<0)return;
 if(c.kind==='as'&&!L[i].vis&&c.model){var v=c.model.bins[key],r=c.view[1]-c.view[0];setView(c,v-r/2,v+r/2,true);L=items(c);}
 c.sel=key;fill(c,L[i],i,L.length);requestAnimationFrame(function(){place(c);});}
function fill(c,it,i,n){
 var o=c.kind==='as'||c.kind==='b'?fromTip(c,it):fromG(c,it);
 c.card.classList.remove('mi-empty');c.ttl.textContent='';
 if(o.sw){var s=el('i','mi-sw');s.style.background=o.sw;s.style.opacity=o.swo||1;c.ttl.appendChild(s);}
 c.ttl.appendChild(document.createTextNode(o.ttl));c.sub.textContent=o.sub||'';
 c.rows.innerHTML='';
 o.rows.forEach(function(r){var d=el('div','mi-row');if(r.sw){var s=el('i','mi-sw');s.style.background=r.sw;s.style.opacity=r.swo||1;d.appendChild(s);}
  if(r.l)d.appendChild(el('span','mi-l',r.l));d.appendChild(el('span','mi-v',r.v));c.rows.appendChild(d);});
 var p=el('span','mi-pos',(i+1)+' / '+n);c.rows.appendChild(p);}
/* cartão a partir do tooltip original (mousemove sintético; o tooltip é escondido em seguida) */
function fromTip(c,it){
 var e=it.els[0],q=e.getBoundingClientRect();
 var was=ttp?ttp.hidden:true,html='';
 e.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,cancelable:true,clientX:q.left+q.width/2,clientY:q.top+q.height/2}));
 if(ttp){html=ttp.innerHTML;ttp.hidden=true;}
 var d=el('div');d.innerHTML=html;var segs=[[]];
 [].forEach.call(d.childNodes,function(n){if(n.nodeName==='BR')segs.push([]);else segs[segs.length-1].push(n);});
 var ttl='',sub='';segs[0].forEach(function(n){if(n.nodeName==='STRONG')ttl=n.textContent;else sub+=n.textContent;});
 var rows=[];
 segs.slice(1).forEach(function(sg){var tx=sg.map(function(n){return n.textContent;}).join('');
  tx.split(' · ').forEach(function(part){part=part.trim();if(!part)return;var m=/^([^:]+):\s*(.*)$/.exec(part),l='',v=part;
   if(m){l=m[1];v=m[2];}else{var m2=/^([^\d+−-]+?)\s+([+−-]?\d.*)$/.exec(part);if(m2){l=m2[1];v=m2[2];}}
   var sw=null;for(var k in SW)if(l.indexOf(k)===0)sw=SW[k];rows.push({l:l,v:v,sw:sw});});});
 var un='';rows.forEach(function(r){var m=/^([+−-]?[\d.,]+)\s+(por 100 aptos)$/.exec(r.v);if(m){r.v=m[1];un=m[2];}});
 sub=sub.trim();if(un)sub=(sub?sub+' · ':'')+un;
 if(window.__LANG==='en'&&c.kind==='as'){ttl=ttl.replace(/^Seções com (\d+) a (\d+) eleitores$/,'Sections with $1 to $2 voters');}
 return {ttl:ttl||'—',sub:sub,rows:rows};}
/* cartão do g-svg: valores exatos vêm do markup original (o mobile_graficos abrevia os rótulos) */
var TURN={'1':'1º turno','2':'2º turno','d':'Variação (2º menos 1º)'};
function fromG(c,it){
 var d=document.createElementNS(NS,'svg');d.innerHTML=c.svg._orig||c.svg.innerHTML;
 var cur=null,groups={},order=[];
 [].forEach.call(d.children,function(e){var n=e.tagName.toLowerCase();
  if(n==='rect'&&e.hasAttribute('data-c')){var k=e.getAttribute('data-c');cur=groups[k]||(groups[k]={rows:[],name:k},order.push(k),groups[k]);
   var r={r:e.getAttribute('data-r'),fill:e.getAttribute('fill'),op:e.getAttribute('opacity'),val:''};cur.rows.push(r);cur.last=r;}
  else if(n==='text'&&!e.classList.contains('m')&&e.previousElementSibling){var p=e.previousElementSibling;
   if(p.tagName.toLowerCase()==='rect'&&p.hasAttribute('data-c')){groups[p.getAttribute('data-c')].last.val=e.textContent;}
   else if(cur&&e.getAttribute('text-anchor')==='middle'){cur.name=e.textContent;cur=null;}}});
 var g=groups[it.key]||{rows:[],name:''};
 var nota=($('g-nota')||{}).textContent||'';
 return {ttl:g.name,sw:g.rows[0]&&g.rows[0].fill,sub:nota.split(' · ').slice(0,2).join(' · '),
  rows:g.rows.map(function(r){return {l:TURN[r.r]||'',v:r.val,sw:r.fill,swo:r.op||1};})};}

/* ---------- indicador visual do ponto selecionado ---------- */
function place(c){
 if(c.sel===null||!MQ.matches){c.hl.className='mi-hl';return;}
 var L=items(c),i=idx(L,c.sel);if(i<0||!L[i].vis){c.hl.className='mi-hl';return;}
 var it=L[i],w=c.wrap.getBoundingClientRect(),s=c.svg.getBoundingClientRect(),h=c.hl,v=h.children[0],r=h.children[1],b=h.children[2];
 if(c.kind==='as'){var cx=(it.x0+it.x1)/2-w.left,cy=(it.y0+it.y1)/2-w.top;
  h.className='mi-hl on as';v.style.left=cx+'px';v.style.top=(s.top-w.top)+'px';v.style.height=s.height+'px';
  r.style.left=cx+'px';r.style.top=cy+'px';}
 else{h.className='mi-hl on box';b.style.left=(it.x0-w.left-3)+'px';b.style.top=(it.y0-w.top-3)+'px';b.style.width=(it.x1-it.x0+6)+'px';b.style.height=(it.y1-it.y0+6)+'px';}}

/* ---------- ponteiros: toque, scrub, pan, pinça ---------- */
function bind(c){
 var svg=c.svg;
 svg.addEventListener('pointerdown',function(e){if(!MQ.matches||e.pointerType==='mouse')return;suppressUntil=Date.now()+1e7;
  c.pts[e.pointerId]={sx:e.clientX,sy:e.clientY,lx:e.clientX,mode:null};try{svg.setPointerCapture(e.pointerId);}catch(x){}
  if(c.kind==='as'&&Object.keys(c.pts).length===2)pinchStart(c);});
 svg.addEventListener('pointermove',function(e){var p=c.pts[e.pointerId];if(!p)return;var dx=e.clientX-p.sx,dy=e.clientY-p.sy,n=Object.keys(c.pts).length;
  if(n===2&&c.pinch){c.pts[e.pointerId].cx=e.clientX;pinchMove(c);return;}
  if(!p.mode){if(Math.abs(dx)>8&&Math.abs(dx)>=Math.abs(dy)*1.2)p.mode='h';else if(Math.abs(dy)>8)p.mode='v';}
  if(p.mode==='h'){if(c.panMode&&c.view&&c.model&&!isFull(c))panBy(c,e.clientX-p.lx);else atX(c,e.clientX);}
  p.lx=e.clientX;});
 function up(e){var p=c.pts[e.pointerId];if(!p)return;delete c.pts[e.pointerId];suppressUntil=Date.now()+700;if(c.pinch&&Object.keys(c.pts).length<2)c.pinch=null;
  if(e.type==='pointerup'&&!p.mode&&Math.abs(e.clientX-p.sx)<=8&&Math.abs(e.clientY-p.sy)<=8)atX(c,e.clientX);}
 svg.addEventListener('pointerup',up);svg.addEventListener('pointercancel',up);
 svg.addEventListener('keydown',function(e){if(e.key==='ArrowRight')step(c,1);else if(e.key==='ArrowLeft')step(c,-1);else if(e.key==='Escape')clear(c);});
 svg.setAttribute('tabindex','0');
}
/* tocar fora fecha (só toque sem arrasto, para não fechar ao rolar a página) */
var dn=null;
document.addEventListener('pointerdown',function(e){dn={x:e.clientX,y:e.clientY,t:e.target};},true);
document.addEventListener('pointerup',function(e){if(!dn||!MQ.matches)return;var d=dn;dn=null;if(Math.abs(e.clientX-d.x)>8||Math.abs(e.clientY-d.y)>8)return;
 Object.keys(charts).forEach(function(k){var c=charts[k];if(c.sel===null)return;var t=d.t;
  if(t&&t.closest&&(t.closest('.mi-wrap')===c.wrap||t.closest('.mi-card')===c.card||t.closest('.mi-tools')===c.tools))return;clear(c);});},true);

/* ---------- zoom (as-svg) ---------- */
function parseAS(orig){
 var d=document.createElementNS(NS,'svg');d.innerHTML=orig;var tk=[],tels=[];
 [].forEach.call(d.querySelectorAll('text'),function(t){var y=+t.getAttribute('y');
  if(t.getAttribute('text-anchor')==='middle'&&!t.getAttribute('transform')&&y>380&&y<425&&/^\d+$/.test(t.textContent.trim())){tk.push({x:+t.getAttribute('x'),v:+t.textContent,y:y});tels.push(t);}});
 if(tk.length<3)return null;
 var M={orig:orig,d:d,tels:tels,x0:tk[0].x,x1:tk[tk.length-1].x,v0:tk[0].v,v1:tk[tk.length-1].v,ty:tk[0].y,bins:{}};
 [].forEach.call(d.querySelectorAll('circle[data-i]'),function(e){M.bins[+e.getAttribute('data-i')]=M.v0+(+e.getAttribute('cx')-M.x0)/(M.x1-M.x0)*(M.v1-M.v0);});
 return M;}
function sync(c){ // detecta redesenho externo (troca de idioma etc.)
 var o=c.svg._orig;if(o===undefined)o=c.svg.innerHTML;
 if(c.mine){if(c.svg._orig!==undefined&&c.svg._orig!==c.seen){c.seen=c.svg._orig;c.mine=0;}return;}
 if(o!==c.seen||(c.kind==='as'&&!c.model)){var ch=o!==c.seen;c.seen=o;
  if(c.kind==='as'){c.model=parseAS(o);c.view=c.model?[c.model.v0,c.model.v1]:null;buildChips(c);}
  if(ch&&c.sel!==null)clear(c);updTools(c);}}
function isFull(c){return !c.model||(c.view[0]<=c.model.v0+1e-9&&c.view[1]>=c.model.v1-1e-9);}
function niceStep(r){var raw=r/5,p=Math.pow(10,Math.floor(Math.log(raw)/Math.LN10)),f=raw/p;return p*(f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10);}
function renderAS(c){
 var M=c.model,a=c.view[0],b=c.view[1];c.mine=1;
 if(isFull(c)){c.svg.innerHTML=M.orig;return;}
 var X=function(px){var v=M.v0+(px-M.x0)/(M.x1-M.x0)*(M.v1-M.v0);return M.x0+(v-a)/(b-a)*(M.x1-M.x0);};
 var keep='',scat='',poly='',bins='',ticks='';
 [].forEach.call(M.d.children,function(e){var n=e.tagName.toLowerCase();if(M.tels.indexOf(e)>=0)return;
  if(n==='circle'){var nx=X(+e.getAttribute('cx')),k=e.cloneNode(true);k.setAttribute('cx',nx.toFixed(1));
   if(e.hasAttribute('data-i'))bins+=k.outerHTML;else if(nx>=M.x0-2&&nx<=M.x1+2)scat+=k.outerHTML;}
  else if(n==='polygon'||n==='polyline'){var k2=e.cloneNode(true);k2.setAttribute('points',e.getAttribute('points').trim().split(/\s+/).map(function(p){var q=p.split(',');return X(+q[0]).toFixed(1)+','+q[1];}).join(' '));poly+=k2.outerHTML;}
  else keep+=e.outerHTML;});
 var st=niceStep(b-a),dec=st<1?1:0;
 for(var v=Math.ceil(a/st-1e-9)*st;v<=b+1e-9;v+=st){var px=M.x0+(v-a)/(b-a)*(M.x1-M.x0);ticks+='<text class="m" x="'+px.toFixed(1)+'" y="'+M.ty+'" text-anchor="middle">'+(dec?(+v.toFixed(1)).toString().replace('.',window.__DEC||','):Math.round(v))+'</text>';}
 c.svg.innerHTML=keep+ticks+'<clipPath id="mi-clip"><rect x="'+M.x0+'" y="16" width="'+(M.x1-M.x0)+'" height="368"/></clipPath><g clip-path="url(#mi-clip)">'+scat+poly+bins+'</g>';}
function setView(c,a,b,quiet){
 var M=c.model;if(!M)return;var full=M.v1-M.v0,r=Math.max(full/16,Math.min(full,b-a));
 a=Math.max(M.v0,Math.min(a,M.v1-r));c.view=[a,a+r];renderAS(c);updTools(c);if(!quiet)requestAnimationFrame(function(){place(c);});}
function zoomBy(c,f){sync(c);if(!c.model)return;var cx=(c.view[0]+c.view[1])/2;
 if(c.sel!==null&&c.model.bins[c.sel]!==undefined){var v=c.model.bins[c.sel];if(v>=c.view[0]&&v<=c.view[1])cx=v;}
 var r=(c.view[1]-c.view[0])/f;var fr=(cx-c.view[0])/(c.view[1]-c.view[0]);setView(c,cx-r*fr,cx-r*fr+r);}
function panBy(c,dpx){var w=c.svg.getBoundingClientRect().width-50,r=c.view[1]-c.view[0];setView(c,c.view[0]-dpx/w*r,c.view[1]-dpx/w*r);}
function pinchStart(c){var ks=Object.keys(c.pts);if(ks.length<2||!c.model)return;var a=c.pts[ks[0]],b=c.pts[ks[1]];
 c.pinch={d0:Math.max(20,Math.abs(a.lx-b.lx)),v0:c.view.slice(),k:ks};}
function pinchMove(c){var P=c.pinch;if(!P)return;var a=c.pts[P.k[0]],b=c.pts[P.k[1]];if(!a||!b)return;
 a.lx=a.cx!==undefined?a.cx:a.lx;b.lx=b.cx!==undefined?b.cx:b.lx;var d=Math.max(20,Math.abs(a.lx-b.lx)),f=d/P.d0;
 var r0=P.v0[1]-P.v0[0],mid=(P.v0[0]+P.v0[1])/2,r=r0/f;setView(c,mid-r/2,mid+r/2,true);}
function mkTools(c){
 var t=el('div','mi-tools');t.setAttribute('role','group');t.setAttribute('aria-label','Zoom do gráfico');
 var row=el('div','mi-zrow');
 c.bOut=btn('mi-z','−','Afastar');c.bIn=btn('mi-z','+','Aproximar');c.bRst=btn('mi-z','⟲','Reiniciar');
 c.bPan=btn('mi-pan','↔ Mover');c.bPan.setAttribute('aria-pressed','false');
 row.appendChild(c.bOut);row.appendChild(c.bIn);row.appendChild(c.bRst);row.appendChild(c.bPan);
 var lab=el('div','mi-zl');lab.appendChild(el('span','','Mostrando'));c.zNum=el('b','mi-zn');lab.appendChild(document.createTextNode(' '));lab.appendChild(c.zNum);lab.appendChild(document.createTextNode(' '));c.zUnit=el('span','','eleitores por seção');lab.appendChild(c.zUnit);
 var chips=el('div','mi-chips');chips.appendChild(el('span','mi-cap','Faixa:'));c.chips=chips;
 t.appendChild(row);t.appendChild(lab);t.appendChild(chips);c.tools=t;c.wrap.parentNode.insertBefore(t,c.wrap);
 c.bIn.addEventListener('click',function(){zoomBy(c,2);});c.bOut.addEventListener('click',function(){zoomBy(c,0.5);});
 c.bRst.addEventListener('click',function(){sync(c);if(c.model)setView(c,c.model.v0,c.model.v1);});
 c.bPan.addEventListener('click',function(){c.panMode=!c.panMode;updTools(c);});}
function buildChips(c){if(!c.chips)return;[].slice.call(c.chips.querySelectorAll('.mi-chip')).forEach(function(x){x.remove();});
 var M=c.model;if(!M)return;var full=M.v1-M.v0;
 for(var i=0;i<3;i++)(function(i){var a=M.v0+full*i/3,b=M.v0+full*(i+1)/3;var ch=btn('mi-chip',Math.round(a)+'–'+Math.round(b));ch.dataset.a=a;ch.dataset.b=b;
  ch.addEventListener('click',function(){sync(c);setView(c,a,b);});c.chips.appendChild(ch);})(i);}
function updTools(c){if(!c.tools||!c.model)return;var M=c.model,full=isFull(c),r=c.view[1]-c.view[0];
 c.zUnit.hidden=full;c.zNum.textContent=full?'todas as faixas':Math.round(c.view[0])+'–'+Math.round(c.view[1]);
 c.bOut.disabled=full;c.bRst.disabled=full;c.bIn.disabled=r<=(M.v1-M.v0)/16+1e-9;
 c.bPan.hidden=full;if(full)c.panMode=false;c.bPan.setAttribute('aria-pressed',c.panMode?'true':'false');c.bPan.classList.toggle('on',c.panMode);
 c.wrap.classList.toggle('mi-zoomed',!full);c.wrap.classList.toggle('mi-panmode',c.panMode&&!full);
 [].forEach.call(c.chips.querySelectorAll('.mi-chip'),function(x){var on=!full&&Math.abs(+x.dataset.a-c.view[0])<1e-6&&Math.abs(+x.dataset.b-c.view[1])<1e-6;x.setAttribute('aria-pressed',on?'true':'false');});}

/* ---------- init ---------- */
['g-svg:g','b-svg:b','as-svg:as'].forEach(function(s){var p=s.split(':');var c=mk(p[0],p[1]);if(c)sync(c);});
window.__mi={charts:charts,select:function(id,k){select(charts[id],k);},step:function(id,d){step(charts[id],d);},clear:function(id){clear(charts[id]);},setView:function(id,a,b){setView(charts[id],a,b);}};
})();
