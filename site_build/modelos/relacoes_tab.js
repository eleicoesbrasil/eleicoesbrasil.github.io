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
var R=null,M=null,VARS={},AL={},ST={sc:'2026',cor:true,reg:''},tried=false,dirty=false,plots=[],FREE={x:null,y:null,pct:100,sq:false};
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
/* ---------- recorte, escala log e frase ---------- */
function cap(t){return t.charAt(0).toUpperCase()+t.slice(1);}
function fraseFor(xk,yk,r,reg){var ya=low(lab(yk)),xa=low(vlab(xk)),pre=reg?S('Na região '+reg+', ','In the '+rl(reg)+' region, '):'',t;
 if(!isFinite(r)||Math.abs(r)<0.1)t=S('não há relação clara entre ','there is no clear relationship between ')+xa+S(' e ',' and ')+ya+'.';
 else t=S('onde ','where ')+xa+S(' é maior, ',' is higher, ')+ya+S(' tende a ser ',' tends to be ')+(r>0?S('maior.','higher.'):S('menor.','lower.'));
 return cap(pre+t);}
function calc(p){var P=p.P,V=P;
 if(ST.reg){var ri=REGS.indexOf(ST.reg),x=[],y=[],g=[],ix=[];for(var i=0;i<P.n;i++)if(P.ri[i]===ri){x.push(P.x[i]);y.push(P.y[i]);g.push(P.ri[i]);ix.push(P.ix[i]);}V={n:x.length,x:x,y:y,ri:g,ix:ix};}
 var pos=V.n>=10,i2;for(i2=0;pos&&i2<V.n;i2++)if(!(V.x[i2]>0)){pos=false;}
 var lx=pos?V.x.map(Math.log):null,useLog=!!(p.log&&pos),xt=useLog?lx:V.x,o=ols(xt,V.y),r=pearson(xt,V.y);
 return {V:V,xt:xt,useLog:useLog,logok:pos,n:V.n,r:r,rho:pearson(ranks(V.x),ranks(V.y)),slope:o.slope,intercept:o.intercept,rlin:pearson(V.x,V.y),rlog:pos?pearson(lx,V.y):NaN,
  forca:forca(isFinite(r)?r:0),def:!ST.reg&&!useLog};}
function logTicks(lo,hi){var out=[],k,m;for(k=Math.floor(Math.log10(lo));k<=Math.ceil(Math.log10(hi));k++)[1,2,5].forEach(function(mm){var v=mm*Math.pow(10,k);if(v>=lo&&v<=hi)out.push(v);});
 if(out.length>7)out=out.filter(function(v){return Math.abs(Math.log10(v)-Math.round(Math.log10(v)))<1e-9;});return out;}
function tkLog(v){if(v>=1e6)return nf(v/1e6,v%1e6?1:0)+'M';if(v>=1e4)return nf(v/1e3,0)+'k';return nf(v,v>=1&&v%1===0?0:v>=1?1:2);}
function css(n){return getComputedStyle(document.documentElement).getPropertyValue(n).trim()||'#888';}
function pct(sorted,q){var i=(sorted.length-1)*q,lo=Math.floor(i),hi=Math.ceil(i);return sorted[lo]+(sorted[hi]-sorted[lo])*(i-lo);}
function nice(lo,hi,n){var span=hi-lo||1,st=Math.pow(10,Math.floor(Math.log10(span/n))),e=span/n/st,m=e>=5?10:e>=2?5:e>=1?2:1,s=m*st,out=[];for(var v=Math.ceil(lo/s)*s;v<=hi+s*1e-9;v+=s)out.push(+v.toPrecision(12));return out;}
function tk(v,span){var a=Math.abs(v);if(a>=1e6)return nf(v/1e6,1)+'M';if(a>=1e4)return nf(v/1e3,0)+'k';if(span<5)return nf(v,2);if(span<50)return nf(v,1);return nf(v,0);}
function fv(v,k){var d=VARS[k]&&VARS[k].dec!=null?+VARS[k].dec:(Math.abs(v)<10?2:Math.abs(v)<1000?1:0);return nf(v,Math.max(0,Math.min(d,3)))+(unitOf(k)&&unitOf(k).length<14?' '+unitOf(k):'');}
var MC=document.createElement('canvas').getContext('2d');
function fitText(t,max,font){MC.font=font;if(MC.measureText(t).width<=max)return t;while(t.length>4&&MC.measureText(t+'…').width>max)t=t.slice(0,-1);return t+'…';}
function ttl(k){var u=unitOf(k);return lab(k)+(u?' ('+u+')':'');}
/* cena: toda a geometria do gráfico, usada pelo canvas e pelo SVG */
var SQ_W=314;  /* largura em que a área de plot (sem margens) fica quadrada: 300 − 8 − 42 = 250 de altura útil */
function scene(p,w,h){var C=p.cur,P={x:C.xt,y:C.V.y,ri:C.V.ri,n:C.n},L=(w<420?38:46)+16,B=24+18,T=8,Rm=10,pw=w-L-Rm,ph=h-T-B;
 if(!p.lim){var xs=P.x.slice().sort(function(a,b){return a-b;}),ys=P.y.slice().sort(function(a,b){return a-b;});
  var xl=pct(xs,.005),xh=pct(xs,.995),yl=pct(ys,.005),yh=pct(ys,.995);if(xh===xl){xl-=1;xh+=1;}if(yh===yl){yl-=1;yh+=1;}
  var px=(xh-xl)*.03,py=(yh-yl)*.05;p.lim=[xl-px,xh+px,yl-py,yh+py];}
 var xlo=p.lim[0],xhi=p.lim[1],ylo=p.lim[2],yhi=p.lim[3];
 var X=function(v){return L+pw*(v-xlo)/(xhi-xlo);},Y=function(v){return T+ph*(1-(v-ylo)/(yhi-ylo));};
 var Sc={w:w,h:h,L:L,T:T,pw:pw,ph:ph,yt:[],xt:[],pts:[],out:0,line:null,xtitle:ttl(p.xk)+(C.useLog?S(' · escala log',' · log scale'):''),ytitle:ttl(p.yk),X:X,Y:Y,lim:p.lim};
 nice(ylo,yhi,4).forEach(function(v){Sc.yt.push({y:Y(v),t:tk(v,yhi-ylo)});});
 if(C.useLog)logTicks(Math.exp(xlo),Math.exp(xhi)).forEach(function(v){Sc.xt.push({x:X(Math.log(v)),t:tkLog(v)});});
 else nice(xlo,xhi,w<420?3:5).forEach(function(v){Sc.xt.push({x:X(v),t:tk(v,xhi-xlo)});});
 for(var i=0;i<P.n;i++){var x=P.x[i],y=P.y[i];if(x<xlo||x>xhi||y<ylo||y>yhi){Sc.out++;continue;}Sc.pts.push({i:i,x:X(x),y:Y(y),c:P.ri[i]});}
 var x1=xlo,x2=xhi;if(C.slope!==0){var xa=(ylo-C.intercept)/C.slope,xb=(yhi-C.intercept)/C.slope;x1=Math.max(xlo,Math.min(xa,xb));x2=Math.min(xhi,Math.max(xa,xb));}
 if(x1<x2)Sc.line={x1:X(x1),y1:Y(C.slope*x1+C.intercept),x2:X(x2),y2:Y(C.slope*x2+C.intercept)};
 return Sc;}
/* tamanho do gráfico livre: largura em % do cartão ou "quadrado"; a altura nunca muda */
function applySize(p){var box=p.canvas.parentNode,avail=box.parentNode.clientWidth||320;
 var w=FREE.sq?Math.min(SQ_W,avail):Math.max(160,Math.round(avail*FREE.pct/100));box.style.width=w+'px';}
function draw(p,hi){if(p.free)applySize(p);
 var c=p.canvas,dpr=window.devicePixelRatio||1,w=c.clientWidth||320,h=c.clientHeight||300;
 c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);var g=c.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);
 var Sc=scene(p,w,h),fg=css('--fg'),mute=css('--mute'),line=css('--line'),bg=css('--bg');g.lineWidth=1;g.font='11px system-ui,sans-serif';
 Sc.yt.forEach(function(t){g.strokeStyle=line;g.beginPath();g.moveTo(Sc.L,t.y);g.lineTo(Sc.L+Sc.pw,t.y);g.stroke();g.fillStyle=mute;g.textAlign='right';g.textBaseline='middle';g.fillText(t.t,Sc.L-4,t.y);});
 Sc.xt.forEach(function(t){g.strokeStyle=line;g.beginPath();g.moveTo(t.x,Sc.T);g.lineTo(t.x,Sc.T+Sc.ph);g.stroke();g.fillStyle=mute;g.textAlign='center';g.textBaseline='top';g.fillText(t.t,t.x,Sc.T+Sc.ph+5);});
 var tf='600 '+(w<420?10:11.5)+'px system-ui,sans-serif';g.font=tf;g.fillStyle=fg;g.textAlign='center';g.textBaseline='alphabetic';
 g.fillText(fitText(Sc.xtitle,Sc.pw,tf),Sc.L+Sc.pw/2,h-4);
 g.save();g.translate(12,Sc.T+Sc.ph/2);g.rotate(-Math.PI/2);g.fillText(fitText(Sc.ytitle,Sc.ph,tf),0,0);g.restore();
 var vis=[];g.globalAlpha=.4;
 Sc.pts.forEach(function(q){vis.push(q.i,q.x,q.y);g.fillStyle=ST.cor?RC[REGS[q.c]]:fg;g.beginPath();g.arc(q.x,q.y,2.3,0,6.2832);g.fill();});
 g.globalAlpha=1;
 if(Sc.line){g.strokeStyle=fg;g.lineWidth=2.6;g.beginPath();g.moveTo(Sc.line.x1,Sc.line.y1);g.lineTo(Sc.line.x2,Sc.line.y2);g.stroke();g.strokeStyle=bg;g.lineWidth=1;g.stroke();}
 if(hi!=null&&hi>=0){var q=Sc.pts.filter(function(t){return t.i===hi;})[0];if(q){g.lineWidth=2.5;g.strokeStyle=fg;g.beginPath();g.arc(q.x,q.y,6,0,6.2832);g.stroke();}}
 p.vis=vis;p.out=Sc.out;}
/* SVG do gráfico: mesma cena do canvas, cores já resolvidas (sem variáveis CSS) e legenda das regiões embaixo */
function svgFor(p){var w=Math.round(p.canvas.clientWidth)||320,h=300,Sc=scene(p,w,h),fg=css('--fg'),mute=css('--mute'),line=css('--line'),bg=css('--bg'),leg=ST.cor,H=h+(leg?26:0),f1=(n)=>n.toFixed(1);
 var tf='600 '+(w<420?10:11.5)+'px system-ui,sans-serif',o=['<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+H+'" viewBox="0 0 '+w+' '+H+'" font-family="system-ui,sans-serif">','<title>'+esc(p.cur.frase||'')+'</title>','<rect width="100%" height="100%" fill="'+bg+'"/>'];
 Sc.yt.forEach(function(t){o.push('<line x1="'+Sc.L+'" x2="'+(Sc.L+Sc.pw)+'" y1="'+f1(t.y)+'" y2="'+f1(t.y)+'" stroke="'+line+'"/><text x="'+(Sc.L-4)+'" y="'+f1(t.y)+'" font-size="11" fill="'+mute+'" text-anchor="end" dominant-baseline="middle">'+esc(t.t)+'</text>');});
 Sc.xt.forEach(function(t){o.push('<line x1="'+f1(t.x)+'" x2="'+f1(t.x)+'" y1="'+Sc.T+'" y2="'+(Sc.T+Sc.ph)+'" stroke="'+line+'"/><text x="'+f1(t.x)+'" y="'+(Sc.T+Sc.ph+17)+'" font-size="11" fill="'+mute+'" text-anchor="middle">'+esc(t.t)+'</text>');});
 var fs=w<420?10:11.5;
 o.push('<text x="'+f1(Sc.L+Sc.pw/2)+'" y="'+(h-4)+'" font-size="'+fs+'" font-weight="600" fill="'+fg+'" text-anchor="middle">'+esc(fitText(Sc.xtitle,Sc.pw,tf))+'</text>');
 o.push('<text transform="translate(12 '+f1(Sc.T+Sc.ph/2)+') rotate(-90)" font-size="'+fs+'" font-weight="600" fill="'+fg+'" text-anchor="middle">'+esc(fitText(Sc.ytitle,Sc.ph,tf))+'</text>');
 o.push('<g fill-opacity=".4">');Sc.pts.forEach(function(q){o.push('<circle cx="'+f1(q.x)+'" cy="'+f1(q.y)+'" r="2.3" fill="'+(leg?RC[REGS[q.c]]:fg)+'"/>');});o.push('</g>');
 if(Sc.line)o.push('<line x1="'+f1(Sc.line.x1)+'" y1="'+f1(Sc.line.y1)+'" x2="'+f1(Sc.line.x2)+'" y2="'+f1(Sc.line.y2)+'" stroke="'+bg+'" stroke-width="4.2" stroke-linecap="round"/><line x1="'+f1(Sc.line.x1)+'" y1="'+f1(Sc.line.y1)+'" x2="'+f1(Sc.line.x2)+'" y2="'+f1(Sc.line.y2)+'" stroke="'+fg+'" stroke-width="2.6" stroke-linecap="round"/>');
 if(leg){var x=Sc.L;REGS.forEach(function(r){o.push('<circle cx="'+x+'" cy="'+(h+10)+'" r="4.5" fill="'+RC[r]+'"/><text x="'+(x+8)+'" y="'+(h+14)+'" font-size="11.5" fill="'+mute+'">'+esc(rl(r))+'</text>');x+=Math.max(52,rl(r).length*6.4+26);});}
 o.push('</svg>');return o.join('');}
function downloadSvg(p){var txt=svgFor(p),framed=false;try{framed=window.top!==window.self;}catch(e){framed=true;}
 if(framed&&navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).catch(function(){});return;}
 var bl=new Blob([txt],{type:'image/svg+xml;charset=utf-8'}),u=URL.createObjectURL(bl),l=document.createElement('a');l.href=u;l.download='relacao_'+p.yk+'_vs_'+p.xk+'.svg';document.body.appendChild(l);l.click();document.body.removeChild(l);setTimeout(function(){URL.revokeObjectURL(u);},1500);}
function hit(p,ev){var r=p.canvas.getBoundingClientRect(),mx=ev.clientX-r.left,my=ev.clientY-r.top,best=-1,bd=18*18,v=p.vis;
 for(var j=0;j<v.length;j+=3){var dx=v[j+1]-mx,dy=v[j+2]-my,d=dx*dx+dy*dy;if(d<bd){bd=d;best=v[j];}}return best;}
function showHint(p,i){var el=p.hint;if(i<0){el.textContent=S('Toque ou passe o mouse sobre um ponto para ver o município.','Tap or hover a point to see the municipality.')+(p.out?' '+S('('+p.out+' municípios fora da faixa visível.)','('+p.out+' municipalities outside the visible range.)'):'');draw(p,-1);return;}
 var m=p.cur.V.ix[i];el.textContent=M.nome[m]+' ('+M.uf[m]+') · '+low(lab(p.xk))+': '+fv(p.cur.V.x[i],p.xk)+' · '+low(lab(p.yk))+': '+fv(p.cur.V.y[i],p.yk);draw(p,i);}
/* ---------- cartões ---------- */
function sealTxt(f){return f==='forte'?S('Relação forte','Strong relationship'):f==='moderada'?S('Relação moderada','Moderate relationship'):S('Relação fraca','Weak relationship');}
function row(a,b){return '<dt>'+esc(a)+'</dt><dd>'+b+'</dd>';}
function cardHtml(p){var e=p.e,c=p.cur,ok=c.def&&e.p_cluster_log10!==undefined,d='',
 rS=c.def&&e.pearson!=null?e.pearson:c.r,rhoS=c.def&&e.spearman!=null?e.spearman:c.rho,nS=c.def&&e.n?e.n:c.n;
 d+=row(c.useLog?S('r (eixo X em escala log)','r (X axis on log scale)'):S('Correlação de Pearson (r)','Pearson correlation (r)'),fr(rS));
 d+=row(S('Correlação de Spearman (ρ)','Spearman correlation (ρ)'),fr(rhoS));
 if(ok){d+=row(S('r dentro de cada estado','r within each state'),fr(e.r_dentro_uf));d+=row(S('p robusto (por estado)','Robust p (by state)'),esc(fmtLog(e.p_cluster_log10)));d+=row(S('q (corrigido por múltiplos testes)','q (multiple-testing corrected)'),esc(fmtQ(e.q_bh_log10)));}
 d+=row(S('Municípios com os dois valores','Municipalities with both values'),nf(nS,0));
 var tip=c.logok&&!c.useLog&&Math.abs(c.rlog)-Math.abs(c.rlin)>=0.05?'<p class="rel-tip">'+esc(S('Dica: em escala logarítmica a relação fica mais reta (r = '+fr(c.rlog).replace('.',',')+' em vez de '+fr(c.rlin)+').','Tip: on a log scale the relationship looks straighter (r = '+fr(c.rlog)+' instead of '+fr(c.rlin)+').'))+'</p>':'';
 var seals='<span class="rel-seal '+c.forca+'">'+esc(sealTxt(c.forca))+'</span>'+(c.def&&e.alerta?'<span class="rel-seal warn">'+esc(S('Some dentro dos estados','Fades within states'))+'</span>':'')+(ST.reg?'<span class="rel-seal">'+esc(S('Região: ','Region: ')+rl(ST.reg))+'</span>':'');
 return '<article class="rel-card"><p class="rel-frase">'+esc(c.frase)+'</p>'
  +'<p class="rel-meta">Y: '+esc(lab(p.yk))+' · X: '+esc(vlab(p.xk))+(unitOf(p.xk)?' ('+esc(unitOf(p.xk))+')':'')+'</p>'
  +'<div class="rel-plot"><canvas role="img" aria-label="'+esc(c.frase)+'"></canvas></div><p class="rel-hint" aria-live="polite"></p>'+tip
  +(c.useLog?'<p class="rel-caveat">'+esc(S('Eixo horizontal em escala logarítmica: cada marca multiplica o valor (em vez de somar), e a reta mostra a tendência nessa escala.','Horizontal axis on a log scale: each mark multiplies the value (instead of adding), and the line shows the trend on that scale.'))+'</p>':'')
  +'<div class="rel-seals">'+seals+'</div>'
  +'<div class="rel-acts">'+(c.logok?'<button type="button" class="rel-btn" data-act="log" aria-pressed="'+(c.useLog?'true':'false')+'">'+esc(c.useLog?S('Voltar à escala normal','Back to normal scale'):S('Eixo X em escala log','Log scale on X axis'))+'</button>':'')
  +'<button type="button" class="rel-btn" data-act="svg">'+esc(S('Baixar SVG','Download SVG'))+'</button></div>'
  +'<p class="rel-caveat">'+esc(S('Correlação não prova causa. São municípios, não eleitores.','Correlation does not prove causation. These are municipalities, not voters.'))+'</p>'
  +'<details class="rel-det"><summary>'+esc(S('Ver detalhes','See details'))+'</summary><dl class="rel-dl">'+d+'</dl>'
  +'<p class="rel-caveat">'+esc(S('Spearman (ρ) vê se os dois sobem (ou descem) juntos mesmo quando a curva não é uma reta; se ele for bem maior que r, a relação é curva.','Spearman (ρ) checks whether the two rise (or fall) together even when the curve is not a straight line; if it is much larger than r, the relationship is curved.'))+'</p>'
  +(ok?'':'<p class="rel-caveat">'+esc(e.p_cluster_log10===undefined?S('p e q só são calculados para os destaques (com correção para a varredura de milhares de pares).','p and q are only computed for the highlights (corrected for the scan of thousands of pairs).'):S('p e q valem para o Brasil inteiro, em escala normal; neste recorte eles não se aplicam.','p and q hold for all of Brazil on the normal scale; they do not apply to this view.'))+'</p>')+'</details></article>';}
function renderCard(p){var dt=p.card&&p.card.querySelector('details'),open=dt&&dt.open;
 p.cur=calc(p);p.lim=null;var c=p.cur,e=p.e;
 c.frase=(c.def&&e.frase_pt)?(en()?(e.frase_en||e.frase_pt):e.frase_pt):fraseFor(p.xk,p.yk,c.r,ST.reg);
 p.slot.innerHTML=cardHtml(p);p.card=p.slot.firstChild;p.canvas=p.card.querySelector('canvas');p.hint=p.card.querySelector('.rel-hint');
 if(open)p.card.querySelector('details').open=true;
 draw(p,-1);showHint(p,-1);var h=function(ev){showHint(p,hit(p,ev));};
 p.canvas.addEventListener('pointermove',h);p.canvas.addEventListener('pointerdown',h);p.canvas.addEventListener('pointerleave',function(){showHint(p,-1);});}
function mountCard(slot,e,free){var p={e:e,slot:slot,xk:e.preditor,yk:e.alvo,free:!!free,P:pairs(e.preditor,e.alvo),log:false,vis:[],out:0};plots.push(p);renderCard(p);return p;}
function renderList(){plots=plots.filter(function(p){return p.free;});var L=$('rel-list'),es=(R.escopos[ST.sc]||[]);
 L.innerHTML=es.map(function(){return '<div class="rel-slot"></div>';}).join('');
 Array.prototype.forEach.call(L.querySelectorAll('.rel-slot'),function(sl,i){mountCard(sl,es[i],false);});
 $('rel-scope-note').textContent=ST.sc==='d2622'?S('“2026 vs 2022” compara a mudança no voto ou na abstenção entre as duas eleições, em pontos percentuais.','“2026 vs 2022” compares the change in vote share or abstention between the two elections, in percentage points.')
  :S('Mostrando as '+es.length+' relações mais fortes e menos repetidas para '+ST.sc+'.','Showing the '+es.length+' strongest, least repetitive relationships for '+ST.sc+'.');}
function renderFree(){plots=plots.filter(function(p){return !p.free;});var xk=FREE.x,yk=FREE.y,B=$('rel-free-card'),P=pairs(xk,yk);
 if(!(P.n>=10)){B.innerHTML='<p class="rel-note">'+esc(S('Poucos municípios têm os dois valores para esta combinação.','Too few municipalities have both values for this pair.'))+'</p>';return;}
 B.innerHTML='<div class="rel-slot"></div>';mountCard(B.firstChild,{alvo:yk,preditor:xk,n:P.n},true);}
function refreshLegend(){var h=ST.cor?REGS.map(function(r){return '<span><i style="background:'+RC[r]+'"></i>'+esc(rl(r))+'</span>';}).join(''):'';['rel-leg','rel-free-leg'].forEach(function(id){$(id).innerHTML=h;$(id).hidden=!ST.cor;});}
var ITEMS=[],CB={x:{act:-1},y:{act:-1}};
function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
function buildItems(){ITEMS=[];Object.keys(VARS).forEach(function(k){var v=VARS[k];if(v.tipo&&v.tipo!=='num')return;if(!M.cols[k])return;
 ITEMS.push({k:k,g:(en()?(v.grupo_en||v.grupo_pt):v.grupo_pt)||S('Outros','Other'),l:vlab(k),s:norm((v.pt||'')+' '+(v.en||'')+' '+(v.grupo_pt||'')+' '+(v.grupo_en||'')+' '+k)});});}
function cbAct(w){var ul=$('rel-'+w+'-list'),os=ul.querySelectorAll('[role=option]'),inp=$('rel-'+w);
 Array.prototype.forEach.call(os,function(o,i){o.classList.toggle('act',i===CB[w].act);});
 var cur=os[CB[w].act];if(cur){inp.setAttribute('aria-activedescendant',cur.id);if(cur.scrollIntoView)cur.scrollIntoView({block:'nearest'});}else inp.removeAttribute('aria-activedescendant');}
function cbRender(w,q){var ul=$('rel-'+w+'-list'),nq=norm(q).split(/\s+/).filter(Boolean),
 res=ITEMS.filter(function(it){return nq.every(function(t){return it.s.indexOf(t)>=0;});}),tot=res.length,html='',g=null;res=res.slice(0,120);
 res.forEach(function(it,i){if(it.g!==g){g=it.g;html+='<li class="rel-opt-g" role="presentation">'+esc(g)+'</li>';}
  html+='<li role="option" id="rel-'+w+'-o'+i+'" data-k="'+esc(it.k)+'" aria-selected="'+(it.k===FREE[w]?'true':'false')+'">'+esc(it.l)+'</li>';});
 if(!res.length)html='<li class="rel-opt-n" role="presentation">'+esc(S('Nenhuma variável encontrada.','No variable found.'))+'</li>';
 else if(tot>res.length)html+='<li class="rel-opt-n" role="presentation">'+esc(S('Mostrando '+res.length+' de '+tot+'. Digite mais para refinar.','Showing '+res.length+' of '+tot+'. Type more to narrow down.'))+'</li>';
 ul.innerHTML=html;CB[w].act=res.length?0:-1;cbAct(w);}
function cbOpen(w){var inp=$('rel-'+w);$('rel-'+w+'-list').hidden=false;inp.setAttribute('aria-expanded','true');cbRender(w,'');}
function cbClose(w){var inp=$('rel-'+w);$('rel-'+w+'-list').hidden=true;inp.setAttribute('aria-expanded','false');inp.value=vlab(FREE[w]);}
function cbPick(w,k){FREE[w]=k;cbClose(w);renderFree();}
function wireCb(w){var inp=$('rel-'+w),ul=$('rel-'+w+'-list');
 inp.addEventListener('focus',function(){inp.select();cbOpen(w);});
 inp.addEventListener('click',function(){if(ul.hidden){inp.select();cbOpen(w);}});
 inp.addEventListener('input',function(){if(ul.hidden){ul.hidden=false;inp.setAttribute('aria-expanded','true');}cbRender(w,inp.value);});
 inp.addEventListener('blur',function(){cbClose(w);});
 inp.addEventListener('keydown',function(ev){var n=ul.querySelectorAll('[role=option]').length;
  if(ev.key==='ArrowDown'){ev.preventDefault();if(ul.hidden)cbOpen(w);else if(n){CB[w].act=(CB[w].act+1)%n;cbAct(w);}}
  else if(ev.key==='ArrowUp'){ev.preventDefault();if(n){CB[w].act=(CB[w].act-1+n)%n;cbAct(w);}}
  else if(ev.key==='Enter'){var o=ul.querySelectorAll('[role=option]')[CB[w].act];if(o){ev.preventDefault();cbPick(w,o.dataset.k);inp.blur();}}
  else if(ev.key==='Escape'){cbClose(w);inp.blur();}});
 ul.addEventListener('mousedown',function(ev){ev.preventDefault();});   /* mantém o foco para o clique valer */
 ul.addEventListener('click',function(ev){var o=ev.target.closest&&ev.target.closest('[role=option]');if(o){cbPick(w,o.dataset.k);inp.blur();}});}
function fillRegions(){var r=$('rel-reg');r.innerHTML='<option value="">'+esc(S('Todas as regiões','All regions'))+'</option>'+REGS.map(function(x){return '<option value="'+esc(x)+'">'+esc(rl(x))+'</option>';}).join('');r.value=ST.reg;}
function fillSelects(){fillRegions();buildItems();['x','y'].forEach(function(w){var i=$('rel-'+w);i.value=vlab(FREE[w]);i.placeholder=S('Digite para buscar…','Type to search…');if(!$('rel-'+w+'-list').hidden)cbRender(w,'');});}
function renderAll(){refreshLegend();Array.prototype.forEach.call(root.querySelectorAll('.rel-seg button'),function(b){b.setAttribute('aria-pressed',b.dataset.sc===ST.sc?'true':'false');});
 $('rel-cor').setAttribute('aria-pressed',ST.cor?'true':'false');plots=[];renderList();renderFree();}
function wire(){
 Array.prototype.forEach.call(root.querySelectorAll('.rel-seg button'),function(b){b.addEventListener('click',function(){ST.sc=b.dataset.sc;renderAll();});});
 $('rel-cor').addEventListener('click',function(){ST.cor=!ST.cor;renderAll();});
 wireCb('x');wireCb('y');
 $('rel-reg').addEventListener('change',function(){ST.reg=this.value;plots.forEach(renderCard);});
 var rw=$('rel-w'),sq=$('rel-sq');
 function freeRedraw(){plots.forEach(function(p){if(p.free)draw(p,-1);});$('rel-wv').textContent=FREE.sq?S('quadrado','square'):FREE.pct+'%';sq.setAttribute('aria-pressed',FREE.sq?'true':'false');}
 rw.addEventListener('input',function(){FREE.pct=+rw.value;FREE.sq=false;freeRedraw();});
 sq.addEventListener('click',function(){FREE.sq=!FREE.sq;if(!FREE.sq){rw.value=FREE.pct;}freeRedraw();});
 root.addEventListener('click',function(ev){var b=ev.target.closest&&ev.target.closest('button[data-act]');if(!b)return;var card=b.closest('.rel-card'),pp=plots.filter(function(p){return p.card===card;})[0];if(!pp)return;
  if(b.dataset.act==='svg')downloadSvg(pp);else if(b.dataset.act==='log'){pp.log=!pp.log;renderCard(pp);}});
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
