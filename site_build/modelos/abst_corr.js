<script>
(function(){
var $=function(i){return document.getElementById(i);};
var EN_L={dabs:'Change in abstention rate (pp)',dcp:'Change in turnout (votes)',dcpr:'Change in turnout (%)',dV:'Change in valid votes',dL:'Change in Lula votes',dF:'Change in Flávio Bolsonaro votes',dLr:'Change in Lula votes (%)',dFr:'Change in Flávio Bolsonaro votes (%)',dpL:'Change in Lula valid-vote share (pp)',dpF:'Change in Flávio Bolsonaro valid-vote share (pp)',dB:'Change in blank votes',dN:'Change in null votes',dpB:'Change in blank share (pp)',dpN:'Change in null share (pp)',ap2:'Eligible voters',abs2:'Abstention rate (%)',cp2:'Total votes (turnout)',V2:'Valid votes',L2:'Lula votes',F2:'Flávio Bolsonaro votes',pL2:'Lula valid-vote share (%)',pF2:'Flávio Bolsonaro valid-vote share (%)',B2:'Blank votes',N2:'Null votes',pB2:'Blank share of turnout (%)',pN2:'Null share of turnout (%)',abs1:'Abstention rate (%)',cp1:'Total votes (turnout)',L1:'Lula votes',F1:'Flávio Bolsonaro votes',pL1:'Lula valid-vote share (%)',pF1:'Flávio Bolsonaro valid-vote share (%)'};
var EN_G={'Variação (2º − 1º turno)':'Change (2nd − 1st round)','2º turno':'2nd round','1º turno':'1st round'};
function en(){return window.__LANG==='en';}
function S(pt,e){return en()?e:pt;}
function LV(i){return en()?EN_L[D.vars[i].k]:D.vars[i].l;}
function GV(i){return en()?EN_G[D.vars[i].g]:D.vars[i].g;}
var D=null,loaded=false,mode='f',sel=-1,pick=null,IDX={};
function fm(n){return Math.round(n).toLocaleString(window.__LOC||'pt-BR');}
function dc(x,k){return x.toFixed(k).replace('.',(window.__DEC||','));}
function fv(v,i){var d=D.vars[i].d;return d?dc(v,d):fm(v);}
function nar(){return window.innerWidth<=700;}
function base(){return window.__DADOS_BASE||'../../dados/';}
function msg(t){$('ac-nota').textContent=t;}
function load(cb){ if(D){cb();return;} msg(S('Carregando os dados por seção (uma vez só)…','Loading section-level data (once)…'));
 fetch(base()+'abst_corr.json').then(function(r){if(!r.ok)throw 0;return r.json();}).catch(function(){return fetch('dados/abst_corr.json').then(function(r){if(!r.ok)throw 0;return r.json();});})
 .then(function(d){D=d;d.vars.forEach(function(v,i){IDX[v.k]=i;});msg('');cb();}).catch(function(){msg(S('Dados por seção ainda não publicados.','Section-level data not published yet.'));}); }
function fill(sel_,def){var s=$(sel_),g='',og=null;D.vars.forEach(function(v,i){if(v.g!==g){g=v.g;og=document.createElement('optgroup');og.label=GV(i);s.appendChild(og);}var o=document.createElement('option');o.value=i;o.textContent=LV(i);og.appendChild(o);});s.value=def;}
function rank(a){var ix=a.map(function(v,i){return [v,i];}).sort(function(p,q){return p[0]-q[0];}),r=new Array(a.length),i=0,j;while(i<ix.length){j=i;while(j+1<ix.length&&ix[j+1][0]===ix[i][0])j++;for(var k=i;k<=j;k++)r[ix[k][1]]=(i+j)/2+1;i=j+1;}return r;}
function pear(a,b){var n=a.length,ma=0,mb=0,i;for(i=0;i<n;i++){ma+=a[i];mb+=b[i];}ma/=n;mb/=n;var sa=0,sb=0,sc=0;for(i=0;i<n;i++){sa+=(a[i]-ma)*(a[i]-ma);sb+=(b[i]-mb)*(b[i]-mb);sc+=(a[i]-ma)*(b[i]-mb);}return sa&&sb?sc/Math.sqrt(sa*sb):0;}
function ri(r){return (r>=0?'+':'−')+dc(Math.abs(r),3);}
function cards(items){$('ac-r').innerHTML=items.map(function(c){return '<div><b>'+c[0]+'</b><span>'+c[1]+'</span></div>';}).join('');}
function nice(lo,hi){var sp=hi-lo||1,st=Math.pow(10,Math.floor(Math.log10(sp/4))),m=sp/4/st;st*=m>5?10:m>2?5:m>1?2:1;var t=[],v=Math.ceil(lo/st)*st;for(;v<=hi+1e-9;v+=st)t.push(Math.abs(v)<1e-12?0:v);return t;}
function yi(){return +$('ac-y').value;}
function xi(){return mode==='f'?0:+$('ac-x').value;}
/* ---------- violinos ---------- */
function drawF(){
 var nb=$('ac-nb').value,B=D.bins[nb],y=yi(),N=B.n.length,trim=$('ac-trim').checked,i,j;
 var qs=B.q.map(function(b){return b[y];}),means=B.mean.map(function(m){return m[y];});
 var lo=Infinity,hi=-Infinity;qs.forEach(function(q,k){lo=Math.min(lo,trim?q[1]:q[0],means[k]);hi=Math.max(hi,trim?q[39]:q[40],means[k]);});
 var pd=(hi-lo||1)*.06;lo-=pd;hi+=pd;
 var sv=$('ac-svg'),W=nar()?Math.max(300,Math.round(sv.getBoundingClientRect().width)||340):1000,H=nar()?400:460,fs=nar()?12:13,m={l:nar()?50:72,r:nar()?8:20,t:16,b:nar()?62:66};
 sv.setAttribute('viewBox','0 0 '+W+' '+H);var pw=W-m.l-m.r,ph=H-m.t-m.b,bw=pw/N,Y=function(v){return m.t+ph*(1-(v-lo)/(hi-lo));},s='';
 nice(lo,hi).forEach(function(t){var yy=Y(t);s+='<line x1="'+m.l+'" x2="'+(W-m.r)+'" y1="'+yy+'" y2="'+yy+'" stroke="var(--line)"/><text class="m" font-size="'+fs+'" x="'+(m.l-6)+'" y="'+(yy+4)+'" text-anchor="end">'+fv(t,y)+'</text>';});
 var pts=[];
 qs.forEach(function(q,k){var cx=m.l+bw*(k+.5),hw=bw*.42,a=trim?1:0,b=trim?39:40,w=[],mx=0;
  for(j=a;j<=b;j++){var l=Math.max(a,j-1),r=Math.min(b,j+1),dq=q[r]-q[l];w.push(dq>0?(r-l)/dq:0);}
  // suaviza e limita picos (quantis repetidos) antes de normalizar
  var cap=0;w.slice().sort(function(p,q2){return p-q2;}).forEach(function(v,ii,arr){if(ii===Math.floor(arr.length*.9))cap=v*1.5;});
  w=w.map(function(v){return Math.min(v,cap||v);});var sm=w.map(function(v,ii){return ((w[ii-1]||v)+2*v+(w[ii+1]||v))/4;});mx=Math.max.apply(null,sm)||1;
  var L=[],R=[];for(j=a;j<=b;j++){var ww=hw*sm[j-a]/mx,yy=Y(q[j]);L.push((cx-ww)+','+yy);R.push((cx+ww)+','+yy);}
  var col=k===sel?'var(--fg)':'var(--flavio)';
  s+='<g class="ac-row" data-k="'+k+'"><rect class="hl" x="'+(m.l+bw*k)+'" y="'+m.t+'" width="'+bw+'" height="'+ph+'" fill="var(--fg)" opacity="'+(k===sel?.12:0)+'"/>';
  if(q[b]>q[a]){s+='<polygon points="'+L.concat(R.reverse()).join(' ')+'" fill="'+col+'" fill-opacity=".28" stroke="'+col+'" stroke-width="1"/>';}else{s+='<line x1="'+(cx-hw*.5)+'" x2="'+(cx+hw*.5)+'" y1="'+Y(q[20])+'" y2="'+Y(q[20])+'" stroke="'+col+'"/>';}
  s+='<rect x="'+(cx-3)+'" y="'+Y(q[30])+'" width="6" height="'+Math.max(1,Y(q[10])-Y(q[30]))+'" fill="var(--fg)" opacity=".75"/><line x1="'+(cx-7)+'" x2="'+(cx+7)+'" y1="'+Y(q[20])+'" y2="'+Y(q[20])+'" stroke="var(--bg)" stroke-width="2"/></g>';
  pts.push([cx,Y(means[k])]);});
 s+='<polyline points="'+pts.map(function(p){return p.join(',');}).join(' ')+'" fill="none" stroke="var(--lula)" stroke-width="2.5"/>'+pts.map(function(p){return '<circle cx="'+p[0]+'" cy="'+p[1]+'" r="'+(nar()?4:5)+'" fill="var(--lula)" stroke="var(--bg)" stroke-width="1.5"/>';}).join('');
 var step=nar()?(N>10?4:N>5?2:1):(N>10?2:1);
 for(i=0;i<N;i+=step){var cx2=m.l+bw*(i+.5);s+='<text class="m" font-size="'+fs+'" x="'+cx2+'" y="'+(H-m.b+16)+'" text-anchor="middle">'+dc(B.lo[i],1)+'</text>';}
 s+='<text class="m" font-size="'+fs+'" x="'+(m.l+pw/2)+'" y="'+(H-12)+'" text-anchor="middle">'+(nar()?S('faixa: variação da abstenção (pp) ← caiu · subiu →','bracket: abstention change (pp) ← fell · rose →'):S('início de cada faixa: variação da abstenção (pp) — esquerda: caiu mais · direita: subiu mais','start of each bracket: abstention change (pp) — left: fell most · right: rose most'))+'</text>';
 sv.innerHTML=s;
 $('ac-leg').innerHTML='<span><i style="background:var(--flavio);opacity:.4"></i>'+S('Distribuição na faixa (95% central)','Distribution within the bracket (central 95%)')+'</span><span><i style="background:var(--fg);opacity:.75"></i>'+S('Entre 25% e 75% · traço claro: mediana','25%–75% range · light mark: median')+'</span><span><i style="background:var(--lula)"></i>'+S('Média da faixa (linha)','Bracket mean (line)')+'</span>';
 var mx_=B.mean.map(function(a){return a[0];}),pr=pear(mx_,means),sp=pear(rank(mx_),rank(means));
 cards([[ri(D.rP[0][y]),S('Pearson, todas as '+fm(D.n)+' seções (variação da abstenção × variável Y)','Pearson, all '+fm(D.n)+' sections (abstention change × Y variable)')],[ri(D.rS[0][y]),S('Spearman, todas as seções','Spearman, all sections')],[ri(pr),S('Pearson entre as médias das '+N+' faixas','Pearson between the means of the '+N+' brackets')],[ri(sp),S('Spearman entre as médias das faixas','Spearman between the bracket means')]]);
 info();
}
function infoF(){var nb=$('ac-nb').value,B=D.bins[nb],y=yi(),k=sel;if(k<0){$('ac-info').textContent=S('Toque numa faixa (ou use ◀ ▶) para ler os valores.','Tap a bracket (or use ◀ ▶) to read the values.');return;}
 var q=B.q[k][y];$('ac-info').innerHTML=S('<strong>Faixa '+(k+1)+' de '+B.n.length+'</strong> · '+fm(B.n[k])+' seções · variação da abstenção de '+dc(B.lo[k],2)+' a '+dc(B.hi[k],2)+' pp<br>'+LV(y)+': média '+fv(B.mean[k][y],y)+' · mediana '+fv(q[20],y)+' · 25%–75%: '+fv(q[10],y)+' a '+fv(q[30],y)+' · 95% central: '+fv(q[1],y)+' a '+fv(q[39],y),'<strong>Bracket '+(k+1)+' of '+B.n.length+'</strong> · '+fm(B.n[k])+' sections · abstention change from '+dc(B.lo[k],2)+' to '+dc(B.hi[k],2)+' pp<br>'+LV(y)+': mean '+fv(B.mean[k][y],y)+' · median '+fv(q[20],y)+' · 25%–75%: '+fv(q[10],y)+' to '+fv(q[30],y)+' · central 95%: '+fv(q[1],y)+' to '+fv(q[39],y));}
/* ---------- dispersão ---------- */
var SC=null;
function drawS(){
 var x=xi(),y=yi(),cv=$('ac-cv'),w=Math.max(300,Math.round(cv.parentNode.getBoundingClientRect().width)||340),h=nar()?380:460,dpr=window.devicePixelRatio||1,trim=$('ac-trim').checked;
 cv.width=w*dpr;cv.height=h*dpr;cv.style.height=h+'px';var g=cv.getContext('2d');g.scale(dpr,dpr);
 var css=getComputedStyle(document.documentElement),col=function(v){return css.getPropertyValue(v).trim()||'#888';};
 var X=D.sample[x],Yv=D.sample[y],n=X.length,xl=trim?D.p[x][0]:Math.min.apply(null,X),xh=trim?D.p[x][1]:Math.max.apply(null,X),yl=trim?D.p[y][0]:Math.min.apply(null,Yv),yh=trim?D.p[y][1]:Math.max.apply(null,Yv);
 if(xh<=xl)xh=xl+1;if(yh<=yl)yh=yl+1;var px=(xh-xl)*.04,py=(yh-yl)*.04;xl-=px;xh+=px;yl-=py;yh+=py;
 var m={l:nar()?54:76,r:12,t:12,b:46},pw=w-m.l-m.r,ph=h-m.t-m.b,SX=function(v){return m.l+pw*(v-xl)/(xh-xl);},SY=function(v){return m.t+ph*(1-(v-yl)/(yh-yl));};
 g.font=(nar()?12:13)+'px system-ui,sans-serif';g.fillStyle=col('--mute');g.strokeStyle=col('--line');g.lineWidth=1;
 g.textAlign='end';nice(yl,yh).forEach(function(t){var yy=SY(t);g.beginPath();g.moveTo(m.l,yy);g.lineTo(w-m.r,yy);g.stroke();g.fillText(fv(t,y),m.l-6,yy+4);});
 g.textAlign='center';nice(xl,xh).forEach(function(t){var xx=SX(t);g.beginPath();g.moveTo(xx,m.t);g.lineTo(xx,m.t+ph);g.stroke();g.fillText(fv(t,x),xx,h-m.b+16);});
 g.fillText(LV(x),m.l+pw/2,h-6);
 g.save();g.beginPath();g.rect(m.l,m.t,pw,ph);g.clip();g.fillStyle=col('--flavio');g.globalAlpha=.28;
 for(var i=0;i<n;i++){g.beginPath();g.arc(SX(X[i]),SY(Yv[i]),nar()?2.2:2,0,6.3);g.fill();}
 g.globalAlpha=1;var r=D.rP[x][y],bsl=D.sd[x]?r*D.sd[y]/D.sd[x]:0,y0=D.mean[y]+bsl*(xl-D.mean[x]),y1=D.mean[y]+bsl*(xh-D.mean[x]);
 g.strokeStyle=col('--lula');g.lineWidth=2.5;g.beginPath();g.moveTo(SX(xl),SY(y0));g.lineTo(SX(xh),SY(y1));g.stroke();
 if(pick!==null){g.strokeStyle=col('--fg');g.lineWidth=2;g.beginPath();g.arc(SX(X[pick]),SY(Yv[pick]),7,0,6.3);g.stroke();}
 g.restore();SC={SX:SX,SY:SY,X:X,Y:Yv,w:w,h:h,m:m};
 $('ac-leg').innerHTML='<span><i style="background:var(--flavio);opacity:.5;border-radius:50%"></i>'+S('Seções (amostra de '+fm(n)+')','Sections (sample of '+fm(n)+')')+'</span><span><i style="background:var(--lula)"></i>'+S('Reta de ajuste (mínimos quadrados, todas as seções)','Fitted line (least squares, all sections)')+'</span>';
 cards([[ri(D.rP[x][y]),S('Pearson, todas as '+fm(D.n)+' seções','Pearson, all '+fm(D.n)+' sections')],[ri(D.rS[x][y]),S('Spearman, todas as seções','Spearman, all sections')],[dc(D.rP[x][y]*D.rP[x][y],3),S('r² (Pearson ao quadrado)','r² (Pearson squared)')],[(bsl>=0?'+':'−')+dc(Math.abs(bsl),4),S('inclinação: variação em Y por unidade de X','slope: change in Y per unit of X')]]);
 info();
}
function infoS(){ if(pick===null){$('ac-info').textContent=S('Toque num ponto para ler os valores daquela seção (amostra).','Tap a dot to read the values of that section (sample).');return;}
 var x=xi(),y=yi();$('ac-info').innerHTML='<strong>'+S('Seção da amostra','Sample section')+'</strong><br>'+LV(x)+': '+fv(SC.X[pick],x)+' · '+LV(y)+': '+fv(SC.Y[pick],y);}
function info(){ if(mode==='f')infoF();else infoS(); }
/* ---------- correlograma (barras) ---------- */
function drawC(){var x=xi(),sv=$('ac-cor'),W=nar()?Math.max(300,Math.round(sv.getBoundingClientRect().width)||340):1000,rowh=nar()?38:30,fs=nar()?12:13,y=yi(),
 order=D.vars.map(function(v,i){return i;}).filter(function(i){return i!==x;}).sort(function(a,b){return Math.abs(D.rP[x][b])-Math.abs(D.rP[x][a]);}),H=order.length*rowh+30,s='',mid=W/2,half=(W-30)/2;
 $('ac-xn').textContent=LV(x);sv.setAttribute('viewBox','0 0 '+W+' '+H);
 s+='<line x1="'+mid+'" x2="'+mid+'" y1="0" y2="'+(H-24)+'" stroke="var(--line)"/><text class="m" font-size="'+fs+'" x="'+(mid-half+4)+'" y="'+(H-8)+'" text-anchor="start">−1</text><text class="m" font-size="'+fs+'" x="'+mid+'" y="'+(H-8)+'" text-anchor="middle">0</text><text class="m" font-size="'+fs+'" x="'+(mid+half-4)+'" y="'+(H-8)+'" text-anchor="end">+1</text>';
 order.forEach(function(i,k){var top=k*rowh,rp=D.rP[x][i],rs=D.rS[x][i],lab=LV(i),suf=D.vars[i].g==='2º turno'?S(' (2º)',' (2nd)'):D.vars[i].g==='1º turno'?S(' (1º)',' (1st)'):'';var cap=Math.floor((W-(nar()?124:150))/(nar()?6.2:6.8))-suf.length;if(lab.length>cap)lab=lab.slice(0,cap-1)+'…';lab+=suf;
  s+='<g class="ac-row" data-y="'+i+'"><rect class="hl" x="0" y="'+top+'" width="'+W+'" height="'+rowh+'" fill="var(--fg)" opacity="'+(i===y?.1:0)+'"/><text class="m" font-size="'+fs+'" x="4" y="'+(top+13)+'">'+lab+'</text>'+
  '<rect x="'+(rp>=0?mid:mid+rp*half)+'" y="'+(top+rowh*.6)+'" width="'+Math.abs(rp)*half+'" height="'+(rowh*.28)+'" fill="'+(rp>=0?'var(--lula)':'var(--flavio)')+'" opacity=".85"/>'+
  '<rect x="'+(rs>=0?mid:mid+rs*half)+'" y="'+(top+rowh*.6)+'" width="'+Math.abs(rs)*half+'" height="'+(rowh*.28)+'" fill="none" stroke="var(--fg)" stroke-width="1.5"/>'+
  '<text class="m" font-size="'+fs+'" x="'+(W-4)+'" y="'+(top+13)+'" text-anchor="end">'+ri(rp)+' · '+ri(rs)+'</text></g>';});
 sv.innerHTML=s;}
function draw(){ if(!D)return;
 var f=mode==='f';$('ac-svg').style.display=f?'':'none';$('ac-cv').style.display=f?'none':'';$('ac-l-x').hidden=f;$('ac-l-nb').hidden=!f;$('ac-prev').hidden=$('ac-next').hidden=!f;
 if(f)drawF();else drawS();drawC();}
function hitF(ev){var sv=$('ac-svg'),r=sv.getBoundingClientRect(),W=sv.viewBox.baseVal.width,N=D.bins[$('ac-nb').value].n.length,m={l:nar()?50:72,r:nar()?8:20},k=Math.floor(((ev.clientX-r.left)*W/r.width-m.l)/((W-m.l-m.r)/N));return k>=0&&k<N?k:-1;}
function init(){ fill('ac-y',IDX.dpL);fill('ac-x',0);
 ['ac-y','ac-x','ac-nb','ac-trim'].forEach(function(i){$(i).addEventListener('change',function(){pick=null;if(i==='ac-nb')sel=-1;draw();});});
 $('ac-m-f').onclick=function(){mode='f';$('ac-m-f').setAttribute('aria-pressed','true');$('ac-m-s').setAttribute('aria-pressed','false');draw();};
 $('ac-m-s').onclick=function(){mode='s';$('ac-m-s').setAttribute('aria-pressed','true');$('ac-m-f').setAttribute('aria-pressed','false');draw();};
 $('ac-svg').addEventListener('click',function(e){var k=hitF(e);if(k>=0){sel=k;draw();}});
 $('ac-svg').addEventListener('mousemove',function(e){if(e.pointerType==='touch')return;var k=hitF(e);if(k>=0&&k!==sel){sel=k;drawF();}});
 function step(d){var N=D.bins[$('ac-nb').value].n.length;sel=sel<0?(d>0?0:N-1):(sel+d+N)%N;draw();}
 $('ac-prev').onclick=function(){step(-1);};$('ac-next').onclick=function(){step(1);};
 function near(e){if(!SC)return;var r=$('ac-cv').getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,b=-1,bd=(nar()?26:14)*(nar()?26:14);for(var i=0;i<SC.X.length;i++){var dx=SC.SX(SC.X[i])-x,dy=SC.SY(SC.Y[i])-y,d=dx*dx+dy*dy;if(d<bd){bd=d;b=i;}}pick=b<0?null:b;drawS();}
 $('ac-cv').addEventListener('click',near);$('ac-cv').addEventListener('mousemove',function(e){if(e.buttons===0)near(e);});
 $('ac-cor').addEventListener('click',function(e){var g=e.target.closest('.ac-row');if(!g||g.dataset.y===undefined)return;$('ac-y').value=g.dataset.y;pick=null;draw();});
 window.addEventListener('resize',function(){var p=$('p-abstencao');if(D&&p&&!p.hidden)draw();});
 draw();}
function go(){ if(loaded)return;loaded=true;load(init);}
function relang(){ if(!D)return;var y=$('ac-y').value,x=$('ac-x').value;$('ac-y').innerHTML='';$('ac-x').innerHTML='';fill('ac-y',y);fill('ac-x',x);draw();}
window.__acRedraw=relang;['lg-pt','lg-en'].forEach(function(i){var b=$(i);if(b)b.addEventListener('click',function(){setTimeout(relang,0);});});
var sec=$('ac-sec');if(sec&&'IntersectionObserver' in window){new IntersectionObserver(function(es,ob){es.forEach(function(e){if(e.isIntersecting){go();ob.disconnect();}});},{rootMargin:'300px'}).observe(sec);}else go();
})();
</script>
