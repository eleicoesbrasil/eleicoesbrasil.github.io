<script>
/* Aba "Relações": gráficos XY simples (um ponto por município) com reta de tendência.
   Dados: dados/relacoes.json (destaques por escopo, gerado por gerar_achados.py) + dados/ext/municipios.json (valores por município),
   ambos carregados sob demanda. API: window.__relInit. Textos dinâmicos via S(pt,en) com window.__LANG; estáticos em i18n_extra_relacoes.py. */
(function(){
var root=document.getElementById('rel-root');if(!root)return;
function $(i){return document.getElementById(i);}
function en(){return window.__LANG==='en';}
function S(p,e){return en()?e:p;}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function base(){return window.__DADOS_BASE||'../../dados/';}
function getJSON(name){return fetch(base()+name).then(function(r){if(!r.ok)throw 0;return r.json();}).catch(function(){return fetch('dados/'+name).then(function(r){if(!r.ok)throw 0;return r.json();});});}
function nf(v,d,mn){return v.toLocaleString(window.__LOC||'pt-BR',{minimumFractionDigits:mn===undefined?d:mn,maximumFractionDigits:d});}
function fr(r){return r==null||!isFinite(r)?'–':(r>=0?'+':'−')+nf(Math.abs(r),2,2);}
var R=null,M=null,VARS={},AL={},ST={sc:'2026',cor:true},tried=false,dirty=false,plots=[],FREE={x:null,y:null};
var REGS=['Norte','Nordeste','Centro-Oeste','Sudeste','Sul'],RN={'Norte':'North','Nordeste':'Northeast','Centro-Oeste':'Central-West','Sudeste':'Southeast','Sul':'South'};
var RC={'Norte':'#009E73','Nordeste':'#E69F00','Centro-Oeste':'#CC79A7','Sudeste':'#0072B2','Sul':'#56B4E9'};
function rl(s){return en()&&RN[s]?RN[s]:s;}
function vlab(k){var v=VARS[k];return v?(en()&&v.en?v.en:v.pt)||k:k;}
function alab(k){var a=AL[k];return a?(en()&&a.en?a.en:a.pt)||k:k;}
function lab(k){return AL[k]?alab(k):vlab(k);}
function unitOf(k){var v=VARS[k];if(!v||!v.unidade||v.unidade==='-')return '';var u=(en()&&v.unidade_en)?v.unidade_en:v.unidade;return en()&&!v.unidade_en&&/[^\x20-\x7e]/.test(u)?'':u;}
function low(s){return s&&!/^[A-ZÀ-Ý]{2}/.test(s)?s.charAt(0).toLowerCase()+s.slice(1):s;}  /* mantém siglas (PIB, IDH) */
function fmtLog(l){
 if(l==null||!isFinite(l))return '–';
 if(window.__stats&&window.__stats.fmtP){try{var s=window.__stats.fmtP(l,window.__LANG||'pt');if(typeof s==='string'&&s)return s;}catch(e){}}
 var dec=en()?'.':',';if(l<=-300)return 'p < 1e-300';
 if(l>-3){var p=Math.pow(10,l);return 'p = '+p.toFixed(p<0.01?4:3).replace('.',dec);}
 var e=Math.floor(l),m=Math.pow(10,l-e),sup=String(Math.abs(e)).split('').map(function(c){return '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c];}).join('');
 return 'p ≈ '+m.toFixed(1).replace('.',dec)+'×10'+(e<0?'⁻':'')+sup;}
function fmtQ(l){if(l==null||!isFinite(l))return '–';if(l<=-300)return 'q < 1e-300';if(l>-3)return 'q = '+Math.pow(10,l).toFixed(4).replace('.',en()?'.':',');
 var e=Math.floor(l),m=Math.pow(10,l-e),sup=String(Math.abs(e)).split('').map(function(c){return '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c];}).join('');return 'q ≈ '+m.toFixed(1).replace('.',en()?'.':',')+'×10'+(e<0?'⁻':'')+sup;}
/* ---------- estatística ---------- */
function pairs(xk,yk){var cx=M.cols[xk],cy=M.cols[yk],N=M.n,x=[],y=[],ri=[],ix=[];if(!cx||!cy)return {n:0,x:x,y:y,ri:ri,ix:ix};
 for(var i=0;i<N;i++){var a=cx[i],b=cy[i];if(typeof a!=='number'||typeof b!=='number'||!isFinite(a)||!isFinite(b))continue;x.push(a);y.push(b);ri.push(Math.max(0,REGS.indexOf(M.reg[i])));ix.push(i);}
 return {n:x.length,x:x,y:y,ri:ri,ix:ix};}
function pearson(x,y){var n=x.length,mx=0,my=0,i;if(n<3)return NaN;for(i=0;i<n;i++){mx+=x[i];my+=y[i];}mx/=n;my/=n;var sxx=0,syy=0,sxy=0;
 for(i=0;i<n;i++){var dx=x[i]-mx,dy=y[i]-my;sxx+=dx*dx;syy+=dy*dy;sxy+=dx*dy;}return sxx>0&&syy>0?sxy/Math.sqrt(sxx*syy):NaN;}
function ranks(v){var n=v.length,o=new Array(n),r=new Array(n),i=0,j;for(i=0;i<n;i++)o[i]=i;o.sort(function(a,b){return v[a]-v[b];});
 i=0;while(i<n){j=i;while(j+1<n&&v[o[j+1]]===v[o[i]])j++;var rk=(i+j)/2+1;for(var k=i;k<=j;k++)r[o[k]]=rk;i=j+1;}return r;}
function ols(x,y){var n=x.length,mx=0,my=0,i;for(i=0;i<n;i++){mx+=x[i];my+=y[i];}mx/=n;my/=n;var sxx=0,sxy=0;for(i=0;i<n;i++){sxx+=(x[i]-mx)*(x[i]-mx);sxy+=(x[i]-mx)*(y[i]-my);}
 var b=sxx>0?sxy/sxx:0;return {slope:b,intercept:my-b*mx};}
function forca(r){var a=Math.abs(r);return a>0.6?'forte':(a>=0.3?'moderada':'fraca');}
/* ---------- gráfico ---------- */
function css(n){return getComputedStyle(document.documentElement).getPropertyValue(n).trim()||'#888';}
function pct(sorted,q){var i=(sorted.length-1)*q,lo=Math.floor(i),hi=Math.ceil(i);return sorted[lo]+(sorted[hi]-sorted[lo])*(i-lo);}
function nice(lo,hi,n){var span=hi-lo||1,st=Math.pow(10,Math.floor(Math.log10(span/n))),e=span/n/st,m=e>=5?10:e>=2?5:e>=1?2:1,s=m*st,out=[];for(var v=Math.ceil(lo/s)*s;v<=hi+s*1e-9;v+=s)out.push(+v.toPrecision(12));return out;}
function tk(v,span){var a=Math.abs(v);if(a>=1e6)return nf(v/1e6,1)+'M';if(a>=1e4)return nf(v/1e3,0)+'k';if(span<5)return nf(v,2);if(span<50)return nf(v,1);return nf(v,0);}
function fv(v,k){var d=VARS[k]&&VARS[k].dec!=null?+VARS[k].dec:(Math.abs(v)<10?2:Math.abs(v)<1000?1:0);return nf(v,Math.max(0,Math.min(d,3)))+(unitOf(k)&&unitOf(k).length<14?' '+unitOf(k):'');}
function draw(p,hi){var c=p.canvas,P=p.P,dpr=window.devicePixelRatio||1,w=c.clientWidth||320,h=c.clientHeight||260;
 c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);var g=c.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);
 var L=w<420?38:46,B=24,T=8,Rm=10,pw=w-L-Rm,ph=h-T-B,fg=css('--fg'),mute=css('--mute'),line=css('--line');
 var xs=P.x.slice().sort(function(a,b){return a-b;}),ys=P.y.slice().sort(function(a,b){return a-b;});
 var xlo=pct(xs,.005),xhi=pct(xs,.995),ylo=pct(ys,.005),yhi=pct(ys,.995);if(xhi===xlo){xlo-=1;xhi+=1;}if(yhi===ylo){ylo-=1;yhi+=1;}
 var px=(xhi-xlo)*.03,py=(yhi-ylo)*.05;xlo-=px;xhi+=px;ylo-=py;yhi+=py;
 var X=function(v){return L+pw*(v-xlo)/(xhi-xlo);},Y=function(v){return T+ph*(1-(v-ylo)/(yhi-ylo));};
 g.font='11px system-ui,sans-serif';g.lineWidth=1;
 nice(ylo,yhi,4).forEach(function(v){var yy=Y(v);g.strokeStyle=line;g.beginPath();g.moveTo(L,yy);g.lineTo(L+pw,yy);g.stroke();g.fillStyle=mute;g.textAlign='right';g.textBaseline='middle';g.fillText(tk(v,yhi-ylo),L-4,yy);});
 nice(xlo,xhi,w<420?3:5).forEach(function(v){var xx=X(v);g.strokeStyle=line;g.beginPath();g.moveTo(xx,T);g.lineTo(xx,T+ph);g.stroke();g.fillStyle=mute;g.textAlign='center';g.textBaseline='top';g.fillText(tk(v,xhi-xlo),xx,T+ph+5);});
 var out=0,vis=[];g.globalAlpha=.4;
 for(var i=0;i<P.n;i++){var x=P.x[i],y=P.y[i];if(x<xlo||x>xhi||y<ylo||y>yhi){out++;continue;}var sx=X(x),sy=Y(y);vis.push(i,sx,sy);
  g.fillStyle=ST.cor?RC[REGS[P.ri[i]]]:fg;g.beginPath();g.arc(sx,sy,2.3,0,6.2832);g.fill();}
 g.globalAlpha=1;
 /* reta, recortada à área visível */
 var x1=xlo,x2=xhi,y1=p.slope*x1+p.intercept,y2=p.slope*x2+p.intercept;
 if(p.slope!==0){var xa=(ylo-p.intercept)/p.slope,xb=(yhi-p.intercept)/p.slope,mn=Math.min(xa,xb),mx=Math.max(xa,xb);x1=Math.max(xlo,mn);x2=Math.min(xhi,mx);y1=p.slope*x1+p.intercept;y2=p.slope*x2+p.intercept;}
 if(x1<x2){g.strokeStyle=fg;g.lineWidth=2.6;g.beginPath();g.moveTo(X(x1),Y(y1));g.lineTo(X(x2),Y(y2));g.stroke();g.strokeStyle=css('--bg');g.lineWidth=1;g.stroke();}
 if(hi!=null&&hi>=0){var sx2=X(P.x[hi]),sy2=Y(P.y[hi]);if(P.x[hi]>=xlo&&P.x[hi]<=xhi&&P.y[hi]>=ylo&&P.y[hi]<=yhi){g.lineWidth=2.5;g.strokeStyle=fg;g.beginPath();g.arc(sx2,sy2,6,0,6.2832);g.stroke();}}
 p.vis=vis;p.out=out;}
function hit(p,ev){var r=p.canvas.getBoundingClientRect(),mx=ev.clientX-r.left,my=ev.clientY-r.top,best=-1,bd=18*18,v=p.vis;
 for(var j=0;j<v.length;j+=3){var dx=v[j+1]-mx,dy=v[j+2]-my,d=dx*dx+dy*dy;if(d<bd){bd=d;best=v[j];}}return best;}
function showHint(p,i){var el=p.hint;if(i<0){el.textContent=S('Toque ou passe o mouse sobre um ponto para ver o município.','Tap or hover a point to see the municipality.')+(p.out?' '+S('('+p.out+' municípios fora da faixa visível.)','('+p.out+' municipalities outside the visible range.)'):'');draw(p,-1);return;}
 var m=p.P.ix[i];el.textContent=M.nome[m]+' ('+M.uf[m]+') · '+low(lab(p.xk))+': '+fv(p.P.x[i],p.xk)+' · '+low(lab(p.yk))+': '+fv(p.P.y[i],p.yk);draw(p,i);}
/* ---------- cartões ---------- */
function sealTxt(f){return f==='forte'?S('Relação forte','Strong relationship'):f==='moderada'?S('Relação moderada','Moderate relationship'):S('Relação fraca','Weak relationship');}
function cardHtml(e,id){
 var fr_=en()?(e.frase_en||e.frase_pt):e.frase_pt,d='';
 d+='<dt>'+esc(S('Correlação de Pearson (r)','Pearson correlation (r)'))+'</dt><dd>'+fr(e.pearson)+'</dd>';
 d+='<dt>'+esc(S('Correlação de Spearman (ρ)','Spearman correlation (ρ)'))+'</dt><dd>'+fr(e.spearman)+'</dd>';
 if(e.r_dentro_uf!==undefined)d+='<dt>'+esc(S('r dentro de cada estado','r within each state'))+'</dt><dd>'+fr(e.r_dentro_uf)+'</dd>';
 if(e.p_cluster_log10!==undefined){d+='<dt>'+esc(S('p robusto (por estado)','Robust p (by state)'))+'</dt><dd>'+esc(fmtLog(e.p_cluster_log10))+'</dd>';d+='<dt>'+esc(S('q (corrigido por múltiplos testes)','q (multiple-testing corrected)'))+'</dt><dd>'+esc(fmtQ(e.q_bh_log10))+'</dd>';}
 d+='<dt>'+esc(S('Municípios com os dois valores','Municipalities with both values'))+'</dt><dd>'+nf(e.n,0)+'</dd>';
 return '<article class="rel-card" data-id="'+esc(id)+'"><p class="rel-frase">'+esc(fr_)+'</p>'
  +'<p class="rel-meta">'+esc(S('Y: ','Y: '))+esc(lab(e.alvo))+' · '+esc(S('X: ','X: '))+esc(vlab(e.preditor))+(unitOf(e.preditor)?' ('+esc(unitOf(e.preditor))+')':'')+'</p>'
  +'<div class="rel-plot"><canvas role="img" aria-label="'+esc(fr_)+'"></canvas></div><p class="rel-hint" aria-live="polite"></p>'
  +'<div class="rel-seals"><span class="rel-seal '+e.forca+'">'+esc(sealTxt(e.forca))+'</span>'+(e.alerta?'<span class="rel-seal warn">'+esc(S('Some dentro dos estados','Fades within states'))+'</span>':'')+'</div>'
  +'<p class="rel-caveat">'+esc(S('Correlação não prova causa. São municípios, não eleitores.','Correlation does not prove causation. These are municipalities, not voters.'))+'</p>'
  +'<details class="rel-det"><summary>'+esc(S('Ver detalhes','See details'))+'</summary><dl class="rel-dl">'+d+'</dl>'
  +(e.p_cluster_log10===undefined?'<p class="rel-caveat">'+esc(S('p e q só são calculados para os destaques (com correção para a varredura de milhares de pares).','p and q are only computed for the highlights (corrected for the scan of thousands of pairs).'))+'</p>':'')+'</details></article>';}
function mount(box,e){var p={canvas:box.querySelector('canvas'),hint:box.querySelector('.rel-hint'),xk:e.preditor,yk:e.alvo,slope:e.slope,intercept:e.intercept,P:pairs(e.preditor,e.alvo),vis:[],out:0};
 plots.push(p);draw(p,-1);showHint(p,-1);
 var h=function(ev){showHint(p,hit(p,ev));};p.canvas.addEventListener('pointermove',h);p.canvas.addEventListener('pointerdown',h);p.canvas.addEventListener('pointerleave',function(){showHint(p,-1);});return p;}
function renderList(){plots=plots.filter(function(p){return p.free;});var L=$('rel-list'),es=(R.escopos[ST.sc]||[]);
 L.innerHTML=es.map(function(e){return cardHtml(e,e.id);}).join('');
 Array.prototype.forEach.call(L.querySelectorAll('.rel-card'),function(c,i){mount(c,es[i]);});
 $('rel-scope-note').textContent=ST.sc==='d2622'?S('“2026 vs 2022” compara a mudança no voto ou na abstenção entre as duas eleições, em pontos percentuais.','“2026 vs 2022” compares the change in vote share or abstention between the two elections, in percentage points.')
  :S('Mostrando as '+es.length+' relações mais fortes e menos repetidas para '+ST.sc+'.','Showing the '+es.length+' strongest, least repetitive relationships for '+ST.sc+'.');}
function renderFree(){plots=plots.filter(function(p){return !p.free;}).concat([]);var xk=FREE.x,yk=FREE.y,B=$('rel-free-card');
 var P=pairs(xk,yk),r=pearson(P.x,P.y),o=ols(P.x,P.y),rho=pearson(ranks(P.x),ranks(P.y)),f=forca(isFinite(r)?r:0);
 if(!(P.n>=10)||!isFinite(r)){B.innerHTML='<p class="rel-note">'+esc(S('Poucos municípios têm os dois valores para esta combinação.','Too few municipalities have both values for this pair.'))+'</p>';return;}
 var ya=lab(yk),xa=vlab(xk),fp=Math.abs(r)<0.1?(S('Não há relação clara entre ','There is no clear relationship between ')+low(xa)+S(' e ',' and ')+low(ya)+'.')
  :(S('Onde ','Where ')+low(xa)+S(' é maior, ',' is higher, ')+low(ya)+S(' tende a ser ',' tends to be ')+(r>0?S('maior.','higher.'):S('menor.','lower.')));
 var e={alvo:yk,preditor:xk,n:P.n,pearson:r,spearman:rho,forca:f,alerta:false,slope:o.slope,intercept:o.intercept,frase_pt:fp,frase_en:fp};
 B.innerHTML=cardHtml(e,'free');var p=mount(B.firstChild,e);p.free=true;}
function refreshLegend(){$('rel-leg').innerHTML=ST.cor?REGS.map(function(r){return '<span><i style="background:'+RC[r]+'"></i>'+esc(rl(r))+'</span>';}).join(''):'';$('rel-leg').hidden=!ST.cor;}
function fillSelects(){var groups={},order=[];Object.keys(VARS).forEach(function(k){var v=VARS[k];if(v.tipo&&v.tipo!=='num')return;if(!M.cols[k])return;var g=(en()?(v.grupo_en||v.grupo_pt):v.grupo_pt)||S('Outros','Other');if(!groups[g]){groups[g]=[];order.push(g);}groups[g].push(k);});
 var html=order.map(function(g){return '<optgroup label="'+esc(g)+'">'+groups[g].map(function(k){return '<option value="'+esc(k)+'">'+esc(vlab(k))+'</option>';}).join('')+'</optgroup>';}).join('');
 ['rel-x','rel-y'].forEach(function(id){var s=$(id);s.innerHTML=html;s.value=(id==='rel-x'?FREE.x:FREE.y);});}
function renderAll(){refreshLegend();Array.prototype.forEach.call(root.querySelectorAll('.rel-seg button'),function(b){b.setAttribute('aria-pressed',b.dataset.sc===ST.sc?'true':'false');});
 $('rel-cor').setAttribute('aria-pressed',ST.cor?'true':'false');plots=[];renderList();renderFree();}
function wire(){
 Array.prototype.forEach.call(root.querySelectorAll('.rel-seg button'),function(b){b.addEventListener('click',function(){ST.sc=b.dataset.sc;renderAll();});});
 $('rel-cor').addEventListener('click',function(){ST.cor=!ST.cor;renderAll();});
 $('rel-x').addEventListener('change',function(){FREE.x=this.value;renderFree();});
 $('rel-y').addEventListener('change',function(){FREE.y=this.value;renderFree();});
 var t=0;window.addEventListener('resize',function(){clearTimeout(t);t=setTimeout(function(){var pp=$('p-relacoes');if(pp&&!pp.hidden)plots.forEach(function(p){draw(p,-1);});},150);});}
function setStatus(m,err){var s=$('rel-status');s.hidden=!m;s.textContent=m||'';s.classList.toggle('err',!!err);}
window.__relInit=function(){
 if(R&&M){if(dirty){dirty=false;fillSelects();renderAll();}else plots.forEach(function(p){draw(p,-1);});return;}
 if(tried)return;tried=true;
 Promise.all([getJSON('relacoes.json'),getJSON('ext/municipios.json')]).then(function(a){
  R=a[0];M=a[1];(R.alvos||[]).forEach(function(x){AL[x.k]=x;});(M.vars||[]).forEach(function(v){VARS[v.k]=v;});
  var e0=(R.escopos['2026']||[])[0]||{};FREE.x=e0.preditor||Object.keys(VARS)[0];FREE.y=e0.alvo||'res26_t2_plula';
  setStatus('');$('rel-main').hidden=false;fillSelects();wire();renderAll();root.dataset.ready='1';
 }).catch(function(){setStatus(S('As relações ainda não foram geradas ou não puderam ser carregadas.','The relationships have not been generated yet or could not be loaded.'),true);root.dataset.ready='err';tried=false;});
};
var rr=window.__rerender;window.__rerender=function(){if(rr)rr.apply(this,arguments);if(!R||!M)return;var p=$('p-relacoes');if(p&&!p.hidden){fillSelects();renderAll();}else dirty=true;};
})();
</script>
