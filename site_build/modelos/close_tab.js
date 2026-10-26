<script>
(function(){
var CL=window.__CL; var $=function(i){return document.getElementById(i);};
function fm(n){return Math.round(n).toLocaleString(window.__LOC||'pt-BR');}
function dec(x,k){return x.toFixed(k).replace('.',(window.__DEC||','));}
function p1(x){return dec(x,1)+'%';}
function p2(x){return dec(x,2);}
var REG={Norte:['AC','AP','AM','PA','RO','RR','TO'],Nordeste:['AL','BA','CE','MA','PB','PE','PI','RN','SE'],'Centro-Oeste':['DF','GO','MT','MS'],Sudeste:['ES','MG','RJ','SP'],Sul:['PR','RS','SC']};
var inited=false,VS=null,TS=null;
window.__closeInit=function(){ if(!CL||!CL.datasets||!Object.keys(CL.datasets).length)return;
 if(!inited){inited=true;
  var ds=$('c-ds'); Object.keys(CL.datasets).sort().reverse().forEach(function(k){var o=document.createElement('option');o.value=k;o.textContent=CL.datasets[k].label;ds.appendChild(o);});
  if(CL.datasets['2026_2t']&&ds.value!==undefined)ds.value='2026_2t';
  var sel=$('c-uf'); var o=document.createElement('option');o.value='ALL';o.textContent='Brasil (sem exterior)';sel.appendChild(o);
  Object.keys(REG).forEach(function(r){var o=document.createElement('option');o.value='R:'+r;o.textContent='Região '+r;sel.appendChild(o);});
  Object.keys(REG).forEach(function(r){REG[r].forEach(function(u){var o=document.createElement('option');o.value=u;o.textContent=u;sel.appendChild(o);});});
  ['c-ds','c-uf'].forEach(function(i){$(i).addEventListener('change',draw);});
  $('c-ds').addEventListener('change',function(){if(window.__delayDraw)window.__delayDraw();});}
 draw(); if(window.__delayInit)window.__delayInit();};
function ufsSel(d){var v=$('c-uf').value; var all=Object.keys(d.ufs); if(v==='ALL')return all; if(v.indexOf('R:')===0)return REG[v.slice(2)].filter(function(u){return d.ufs[u];}); return d.ufs[v]?[v]:[];}
function agg(d,list){var len=CL.xmax-CL.xmin+1,n=new Array(len).fill(0),L=new Array(len).fill(0),F=new Array(len).fill(0),O=new Array(len).fill(0),am=0,tot=0;
 list.forEach(function(u){var s=d.ufs[u];am+=s.amostra;tot+=s.total;for(var i=0;i<len;i++){n[i]+=s.n[i];L[i]+=s.L[i];F[i]+=s.F[i];O[i]+=(s.O?s.O[i]:0);}});
 return {n:n,L:L,F:F,O:O,am:am,tot:tot};}
function axisX(X0,X1,W,m,H,yb,step){var s='';for(var t=Math.ceil((X0+CL.xmin)/step)*step;t<=X1+CL.xmin;t+=step){var x=m.l+(W-m.l-m.r)*(t-CL.xmin-X0)/(X1-X0);s+='<line x1="'+x+'" x2="'+x+'" y1="'+yb+'" y2="'+(yb+4)+'" stroke="var(--mute)"/><text class="m" x="'+x+'" y="'+(yb+17)+'" text-anchor="middle">'+(t>0?'+':t<0?'−':'')+Math.abs(t)+'</text>';}
 return s+'<text class="m" x="'+(W/2)+'" y="'+(H-6)+'" text-anchor="middle">minutos em relação às 17h de Brasília (0 = horário previsto de fechamento)</text>';}
function draw(){
 var d=CL.datasets[$('c-ds').value]||CL.datasets[Object.keys(CL.datasets)[0]]; if(!d)return; var list=ufsSel(d);
 if(!list.length){$('c-cards').innerHTML='<div class="card">Sem dados lidos ainda para esta seleção.</div>';['c-svg3','c-svg2','c-svg4','c-tab'].forEach(function(i){$(i).innerHTML='';});return;}
 var A=agg(d,list), len=A.n.length;
 var cn=[],cL=[],cF=[],tn=0,tL=0,tF=0,tO=0;
 for(var i=0;i<len;i++){tn+=A.n[i];tL+=A.L[i];tF+=A.F[i];tO+=A.O[i];cn.push(tn);cL.push(tL);cF.push(tF);}
 var valid=tL+tF+tO, i15=-CL.xmin+15, i60=-CL.xmin+60;
 var late15=0,late60=0,lv15=0,lv60=0;
 for(var i=i15+1;i<len;i++){late15+=A.n[i];lv15+=A.L[i]+A.F[i];} for(var i=i60+1;i<len;i++){late60+=A.n[i];lv60+=A.L[i]+A.F[i];}
 var lf=tL+tF;
 var cob=(A.am>=A.tot)?'todas as seções lidas ('+fm(A.am)+')':'amostra lida: '+fm(A.am)+' de '+fm(A.tot)+' boletins ('+p1(100*A.am/A.tot)+')';
 $('c-cards').innerHTML=
  '<div class="card"><div class="lab">Urnas analisadas</div><div class="big">'+fm(tn)+'</div><div class="small">'+cob+'</div></div>'+
  '<div class="card"><div class="lab">Fecharam mais de 15 min depois das 17h</div><div class="big">'+p1(100*late15/tn)+'</div><div class="small">'+fm(late15)+' urnas · '+p1(lf?100*lv15/lf:0)+' dos votos para Lula ou '+d.cand+' ('+fm(lv15)+' votos)</div></div>'+
  '<div class="card"><div class="lab">Fecharam mais de 1h depois</div><div class="big">'+p1(100*late60/tn)+'</div><div class="small">'+fm(late60)+' urnas · '+p1(lf?100*lv60/lf:0)+' dos votos para Lula ou '+d.cand+' ('+fm(lv60)+' votos)</div></div>';
 $('c-leg2').innerHTML='<span><i style="background:var(--lula)"></i>Lula entre os dois (acumulado)</span><span><i style="background:var(--outros)"></i>Janela de 5 minutos</span><span><i style="background:none;border-top:2px dashed var(--mute);height:0;width:16px"></i>50%</span>';
 $('c-leg4').innerHTML='<span><i style="background:var(--lula)"></i>Lula</span><span><i style="background:var(--flavio)"></i>'+d.cand+'</span>';
 $('t-leg').innerHTML='<span><i style="background:var(--lula)"></i>Atraso médio por faixa de tamanho</span><span><i style="background:none;border-top:2px dashed var(--mute);height:0;width:16px"></i>Mediana</span><span><i style="background:var(--mute);opacity:.5;border-radius:50%"></i>Seções (amostra)</span>';
 $('c-leg').innerHTML='<span><i style="background:var(--lula)"></i>Lula</span><span><i style="background:var(--flavio)"></i>'+d.cand+'</span>';
 // janela do eixo X
 var lo=0,hi=len-1; while(lo<len-1&&cn[lo]<tn*0.001)lo++; while(hi>0&&cn[hi-1]>=tn*0.999)hi--;
 lo=-CL.xmin-5; hi=Math.min(len-1,Math.max(hi,-CL.xmin+60));
 var X0=lo,X1=hi,W=1000,m={l:70,r:16,t:14,b:44},step=X1-X0>400?60:X1-X0>200?30:15;
 var xs=function(i){return m.l+(W-m.l-m.r)*(i-X0)/(X1-X0);}, z=xs(-CL.xmin);
 // gráfico 1: % acumulada dos votos válidos
 var H3=340,m3={l:70,r:16,t:14,b:44};
 var pL=[],pF=[];for(var i=0;i<len;i++){pL.push(valid>0?100*cL[i]/valid:0);pF.push(valid>0?100*cF[i]/valid:0);}
 var ym=Math.min(100,Math.max(10,Math.ceil((Math.max(pL[len-1],pF[len-1])+2)/10)*10)),ys3=function(v){return H3-m3.b-(H3-m3.t-m3.b)*v/ym;};
 var s3='';for(var v=0;v<=ym;v+=(ym>60?20:10)){var y=ys3(v);s3+='<line x1="'+m3.l+'" x2="'+(W-m3.r)+'" y1="'+y+'" y2="'+y+'" stroke="var(--line)"/><text class="m" x="'+(m3.l-6)+'" y="'+(y+4)+'" text-anchor="end">'+v+'%</text>';}
 s3+=axisX(X0,X1,W,m3,H3,H3-m3.b,step);
 s3+='<line x1="'+z+'" x2="'+z+'" y1="'+m3.t+'" y2="'+(H3-m3.b)+'" stroke="var(--mute)" stroke-dasharray="4 3"/>';
 function path3(c){var p='';for(var i=X0;i<=X1;i++)p+=(i===X0?'M':'L')+xs(i).toFixed(1)+' '+ys3(c[i]).toFixed(1);return p;}
 s3+='<path d="'+path3(pL)+'" fill="none" stroke="var(--lula)" stroke-width="2.4"/><path d="'+path3(pF)+'" fill="none" stroke="var(--flavio)" stroke-width="2.4"/>';
 var xe=xs(X1),fL=pL[X1],fF=pF[X1];
 s3+='<circle cx="'+xe+'" cy="'+ys3(fL)+'" r="4" fill="var(--lula)"/><text x="'+(xe-8)+'" y="'+(ys3(fL)-8)+'" text-anchor="end" style="fill:var(--lula);font-weight:600">Lula '+p1(fL)+'</text>';
 s3+='<circle cx="'+xe+'" cy="'+ys3(fF)+'" r="4" fill="var(--flavio)"/><text x="'+(xe-8)+'" y="'+(ys3(fF)+16)+'" text-anchor="end" style="fill:var(--flavio);font-weight:600">'+d.cand+' '+p1(fF)+'</text>';
 s3+='<line id="c-cur3" x1="0" x2="0" y1="'+m3.t+'" y2="'+(H3-m3.b)+'" stroke="var(--fg)" stroke-width="1" style="display:none"/>';
 $('c-svg3').innerHTML=s3;
 $('c-aviso').textContent='Empilhadas, as duas linhas somam '+p1(fL+fF)+' dos votos válidos'+((tO>0)?' (o restante são os demais candidatos do 1º turno).':'.');
 // gráfico 2 e 3: parcela entre os dois
 var H2=300,m2={l:70,r:16,t:14,b:44};
 var sh=[],win=[];for(var i=0;i<len;i++){sh.push(cL[i]+cF[i]>0?100*cL[i]/(cL[i]+cF[i]):null);var a=0,b=0;for(var j=Math.max(0,i-4);j<=i;j++){a+=A.L[j];b+=A.F[j];}win.push(a+b>0?100*a/(a+b):null);}
 var vals=[];for(var i=X0;i<=X1;i++){if(sh[i]!==null)vals.push(sh[i]);if(win[i]!==null&&cn[i]>tn*0.01)vals.push(win[i]);}
 var vmin=Math.floor(Math.min.apply(null,vals.concat([50]))-1),vmax=Math.ceil(Math.max.apply(null,vals.concat([50]))+1);
 var ys2=function(v){return H2-m2.b-(H2-m2.t-m2.b)*(v-vmin)/(vmax-vmin);};
 var s2='';for(var v=vmin;v<=vmax;v+=Math.max(1,Math.round((vmax-vmin)/5))){var y=ys2(v);s2+='<line x1="'+m2.l+'" x2="'+(W-m2.r)+'" y1="'+y+'" y2="'+y+'" stroke="var(--line)"/><text class="m" x="'+(m2.l-6)+'" y="'+(y+4)+'" text-anchor="end">'+v+'%</text>';}
 s2+='<line x1="'+m2.l+'" x2="'+(W-m2.r)+'" y1="'+ys2(50)+'" y2="'+ys2(50)+'" stroke="var(--mute)" stroke-dasharray="4 3"/><line x1="'+z+'" x2="'+z+'" y1="'+m2.t+'" y2="'+(H2-m2.b)+'" stroke="var(--mute)" stroke-dasharray="4 3"/>';
 s2+=axisX(X0,X1,W,m2,H2,H2-m2.b,step);
 function path2(a,min){var p='',on=false;for(var i=X0;i<=X1;i++){if(a[i]===null||(min&&cn[i]<tn*min)){on=false;continue;}p+=(on?'L':'M')+xs(i).toFixed(1)+' '+ys2(a[i]).toFixed(1);on=true;}return p;}
 s2+='<path d="'+path2(win,0.01)+'" fill="none" stroke="var(--outros)" stroke-width="1.2"/><path d="'+path2(sh,0)+'" fill="none" stroke="var(--lula)" stroke-width="2.4"/>';
 s2+='<line id="c-cur2" x1="0" x2="0" y1="'+m2.t+'" y2="'+(H2-m2.b)+'" stroke="var(--fg)" stroke-width="1" style="display:none"/>';
 $('c-svg2').innerHTML=s2;
 var H4=300,m4={l:70,r:16,t:14,b:44},lo4=50,hi4=50;
 for(var i=X0;i<=X1;i++){if(sh[i]!==null&&cn[i]>tn*0.001){lo4=Math.min(lo4,sh[i],100-sh[i]);hi4=Math.max(hi4,sh[i],100-sh[i]);}}
 lo4=Math.floor(lo4-1);hi4=Math.ceil(hi4+1);
 var ys4=function(v){return H4-m4.b-(H4-m4.t-m4.b)*(v-lo4)/(hi4-lo4);};
 var s4='',st4=Math.max(1,Math.round((hi4-lo4)/5));for(var v=lo4;v<=hi4;v+=st4){var y=ys4(v);s4+='<line x1="'+m4.l+'" x2="'+(W-m4.r)+'" y1="'+y+'" y2="'+y+'" stroke="var(--line)"/><text class="m" x="'+(m4.l-6)+'" y="'+(y+4)+'" text-anchor="end">'+v+'%</text>';}
 s4+='<line x1="'+m4.l+'" x2="'+(W-m4.r)+'" y1="'+ys4(50)+'" y2="'+ys4(50)+'" stroke="var(--mute)" stroke-dasharray="4 3"/><line x1="'+z+'" x2="'+z+'" y1="'+m4.t+'" y2="'+(H4-m4.b)+'" stroke="var(--mute)" stroke-dasharray="4 3"/>';
 s4+=axisX(X0,X1,W,m4,H4,H4-m4.b,step);
 function path4(f){var p='',on=false;for(var i=X0;i<=X1;i++){if(sh[i]===null||cn[i]<tn*0.001){on=false;continue;}p+=(on?'L':'M')+xs(i).toFixed(1)+' '+ys4(f(sh[i])).toFixed(1);on=true;}return p;}
 s4+='<path d="'+path4(function(v){return v;})+'" fill="none" stroke="var(--lula)" stroke-width="2.4"/><path d="'+path4(function(v){return 100-v;})+'" fill="none" stroke="var(--flavio)" stroke-width="2.4"/><line id="c-cur4" x1="0" x2="0" y1="'+m4.t+'" y2="'+(H4-m4.b)+'" stroke="var(--fg)" stroke-width="1" style="display:none"/>';
 $('c-svg4').innerHTML=s4;
 VS={pL:pL,pF:pF,X0:X0,X1:X1,m:m,W:W,A:A,cn:cn,cL:cL,cF:cF,sh:sh,d:d,tn:tn,valid:valid};
 // tabela de faixas
 var nomes=['No horário (até +15 min)','15 a 30 min depois','30 a 60 min depois','60 a 90 min depois','Mais de 90 min depois'];
 var fs=d.faixas, ftot=0; fs.forEach(function(r){ftot+=r.n;});
 var h='<thead><tr><th>Faixa de fechamento</th><th style="text-align:right">Urnas</th><th style="text-align:right">% das urnas</th><th style="text-align:right">Votos Lula</th><th style="text-align:right">Votos '+d.cand+'</th><th style="text-align:right">Lula (% dos dois)</th><th style="text-align:right">Esperado no município</th><th style="text-align:right">Diferença (pp)</th><th style="text-align:right">Votos de Lula acima/abaixo do esperado</th></tr></thead><tbody>';
 fs.forEach(function(r){var sL=100*r.L/(r.L+r.F),base=r.LFc?100*r.expL/r.LFc:null,act=r.LFc?100*r.Lc/r.LFc:null,dif=base!==null?act-base:null,ex=(r.Lc-r.expL);
  h+='<tr><th>'+nomes[r.f]+'</th><td class="n">'+fm(r.n)+'</td><td class="n">'+p1(100*r.n/ftot)+'</td><td class="n">'+fm(r.L)+'</td><td class="n">'+fm(r.F)+'</td><td class="n">'+p1(sL)+'</td><td class="n">'+(base===null?'—':p1(base))+'</td><td class="n '+(dif>0?'pos':'neg')+'">'+(dif===null?'—':(dif>0?'+':'−')+p2(Math.abs(dif)))+'</td><td class="n">'+(r.f===0?'—':(ex>0?'+':'−')+fm(Math.abs(ex)))+'</td></tr>';});
 $('c-tab').innerHTML=h+'</tbody>';
 $('c-nota').textContent='A tabela usa todo o país (sem exterior), independente do filtro "Onde". Os valores são os dos boletins lidos, sem estimativa. A comparação “esperado” só usa municípios que têm urnas nas duas situações. Diferença de poucos votos entre faixas não é evidência de padrão fora do esperado: o que importa é o tamanho frente à incerteza da amostra.';
 drawTam(d);
}
// ---- atraso x tamanho da seção
function drawTam(d){var T=d.tam; if(!T){return;} var pts=T.pontos,B=T.bins,W=1000,H=420,m={l:70,r:16,t:16,b:52};
 var xs0=pts.map(function(p){return p[0];}).sort(function(a,b){return a-b;}),xmax=xs0[Math.floor(xs0.length*0.995)]||600;
 var ymax=Math.max(60,Math.min(300,Math.max.apply(null,B.map(function(b){return b[2];}))*3));
 var xs=function(v){return m.l+(W-m.l-m.r)*Math.min(v,xmax)/xmax;},ys=function(v){return m.t+(H-m.t-m.b)*(ymax-Math.max(-5,Math.min(ymax,v)))/(ymax+5);};
 var s='';for(var i=0;i<=5;i++){var v=-5+(ymax+5)*i/5,y=ys(v);s+='<line x1="'+m.l+'" x2="'+(W-m.r)+'" y1="'+y+'" y2="'+y+'" stroke="var(--line)"/><text class="m" x="'+(m.l-6)+'" y="'+(y+4)+'" text-anchor="end">'+Math.round(v)+'</text>';}
 for(var k=0;k<=6;k++){var xv=xmax*k/6;s+='<text class="m" x="'+xs(xv)+'" y="'+(H-m.b+18)+'" text-anchor="middle">'+Math.round(xv)+'</text>';}
 pts.forEach(function(p){if(p[0]<=xmax)s+='<circle cx="'+xs(p[0]).toFixed(1)+'" cy="'+ys(p[1]).toFixed(1)+'" r="1.6" fill="var(--mute)" opacity="0.2"/>';});
 s+='<polyline points="'+B.map(function(b){return xs(b[1]).toFixed(1)+','+ys(b[3]).toFixed(1);}).join(' ')+'" fill="none" stroke="var(--mute)" stroke-width="2" stroke-dasharray="5 4"/>';
 s+='<polyline points="'+B.map(function(b){return xs(b[1]).toFixed(1)+','+ys(b[2]).toFixed(1);}).join(' ')+'" fill="none" stroke="var(--lula)" stroke-width="2.6"/>';
 B.forEach(function(b,i){s+='<circle cx="'+xs(b[1])+'" cy="'+ys(b[2])+'" r="4.5" fill="var(--lula)" data-i="'+i+'"/>';});
 s+='<text class="m" x="'+(W/2)+'" y="'+(H-8)+'" text-anchor="middle">eleitores aptos na seção</text><text class="m" transform="translate(16,'+(H/2)+') rotate(-90)" text-anchor="middle">atraso no fechamento (minutos depois das 17h)</text>';
 $('t-svg').innerHTML=s; TS={B:B};
 var sg=function(x){return (x>0?'+':x<0?'−':'')+Math.abs(x).toFixed(3).replace('.',(window.__DEC||','));};
 $('t-sub').textContent='Correlação de Pearson r = '+sg(T.pearson)+' e de Spearman ρ = '+sg(T.spearman)+' entre o número de eleitores aptos e o atraso no fechamento, em '+fm(d.n)+' urnas. Cada ponto vermelho é uma faixa com o mesmo número de seções (12 faixas).';}
// ---- tooltips
function hover(svg){return function(e){if(!VS)return;var r=svg.getBoundingClientRect(),px=(e.clientX-r.left)/r.width*1000;
  var i=Math.round(VS.X0+(px-VS.m.l)/(VS.W-VS.m.l-VS.m.r)*(VS.X1-VS.X0));i=Math.max(VS.X0,Math.min(VS.X1,i));
  var x=VS.m.l+(VS.W-VS.m.l-VS.m.r)*(i-VS.X0)/(VS.X1-VS.X0);
  ['c-cur2','c-cur3','c-cur4'].forEach(function(id){var el=$(id);if(el){el.setAttribute('x1',x);el.setAttribute('x2',x);el.style.display='';}});
  var t=i+CL.xmin, A=VS.A, d=VS.d, sh=VS.sh[i], vm=A.L[i]+A.F[i]+A.O[i];
  var h='<strong>'+(t>0?'+':t<0?'−':'')+Math.abs(t)+' min depois das 17h</strong><br>Urnas fechadas até aqui: '+fm(VS.cn[i])+' ('+p1(100*VS.cn[i]/VS.tn)+')<br>Lula acumulado: '+fm(VS.cL[i])+' ('+p2(VS.pL[i])+'% dos válidos)<br>'+d.cand+' acumulado: '+fm(VS.cF[i])+' ('+p2(VS.pF[i])+'% dos válidos)<br>Lula entre os dois: '+(sh===null?'—':p2(sh)+'%')+'<br><span class="mute">Neste minuto: '+fm(A.n[i])+' urnas · Lula '+fm(A.L[i])+' ('+(vm?p2(100*A.L[i]/vm):'—')+'% dos válidos) · '+d.cand+' '+fm(A.F[i])+' ('+(vm?p2(100*A.F[i]/vm):'—')+'% dos válidos)</span>';
  var T=$('ttp');T.innerHTML=h;T.hidden=false;T.style.left=Math.min(e.clientX+14,innerWidth-280)+'px';T.style.top=(e.clientY+14)+'px';};}
['c-svg2','c-svg3','c-svg4'].forEach(function(id){var s=$(id);s.addEventListener('mousemove',hover(s));s.addEventListener('mouseleave',function(){$('ttp').hidden=true;['c-cur2','c-cur3','c-cur4'].forEach(function(i){var el=$(i);if(el)el.style.display='none';});});});
$('t-svg').addEventListener('mousemove',function(e){var r=e.target;if(!TS||!r.dataset||r.dataset.i===undefined){$('ttp').hidden=true;return;}var b=TS.B[+r.dataset.i];
 var T=$('ttp');T.innerHTML='<strong>Seções com '+b[6]+' a '+b[7]+' eleitores</strong> ('+fm(b[0])+' urnas)<br>Atraso médio: '+p2(b[2])+' min · mediana '+p2(b[3])+' min<br>'+p1(b[4])+' fecharam com mais de 15 min · '+p1(b[5])+' com mais de 60 min';T.hidden=false;T.style.left=Math.min(e.clientX+14,innerWidth-280)+'px';T.style.top=(e.clientY+14)+'px';});
$('t-svg').addEventListener('mouseleave',function(){$('ttp').hidden=true;});
// ---- mapa do atraso médio por município
var DM={x:0,y:0,k:1,W:0,H:0,uf:''},dinit=false,dpts=[];
function merc(lat){var r=lat*Math.PI/180;return Math.log(Math.tan(Math.PI/4+r/2))*180/Math.PI;}
var BB={minx:-74,maxx:-34,miny:merc(-34),maxy:merc(5.5)};
function css(n){return getComputedStyle(document.documentElement).getPropertyValue(n).trim();}
function dark(){var a=document.documentElement.getAttribute('data-theme');return a==='dark'||(!a&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);}
function ramp(t){t=Math.max(0,Math.min(1,t));var a=dark()?[74,78,88]:[250,238,196],b=dark()?[255,122,84]:[178,34,38];return a.map(function(v,i){return Math.round(v+(b[i]-v)*t);});}
function dfit(b){var pad=24,w=DM.W-2*pad,h=DM.H-2*pad;var k=Math.min(w/(b.maxx-b.minx),h/(b.maxy-b.miny));DM.k=k;DM.x=DM.W/2-k*(b.minx+b.maxx)/2;DM.y=DM.H/2+k*(b.miny+b.maxy)/2;}
function dpx(X,Y){return [DM.x+DM.k*X,DM.y-DM.k*Y];}
function dsize(){var cv=$('d-cv'),r=cv.getBoundingClientRect(),dp=window.devicePixelRatio||1;DM.W=r.width;DM.H=r.height;cv.width=r.width*dp;cv.height=r.height*dp;cv.getContext('2d').setTransform(dp,0,0,dp,0,0);}
function dscale(){var modo=$('d-modo').value;if(modo==='p')return 100;var v=dpts.map(function(p){return p.m;}).sort(function(a,b){return a-b;});return Math.max(15,Math.ceil(v[Math.floor(v.length*0.97)]||30));}
window.__delayDraw=function(){var d=CL&&(CL.datasets[$('c-ds').value]||CL.datasets[Object.keys(CL.datasets)[0]]);if(!d||!dinit)return;
 dpts=d.mapa.map(function(r){return {n:r[0],uf:r[1],X:r[3],Y:merc(r[2]),c:r[4],m:r[5],p:r[6],a:r[7]};});
 var cv=$('d-cv'),ctx=cv.getContext('2d'),UFG=window.__UFG||[];
 ctx.clearRect(0,0,DM.W,DM.H);ctx.lineWidth=1;ctx.strokeStyle=css('--line');ctx.fillStyle=css('--surface');
 UFG.forEach(function(g){ctx.beginPath();g.p.forEach(function(ring){ring.forEach(function(c,i){var q=dpx(c[0],merc(c[1]));if(i)ctx.lineTo(q[0],q[1]);else ctx.moveTo(q[0],q[1]);});ctx.closePath();});ctx.fill();ctx.stroke();});
 var modo=$('d-modo').value,sc=dscale(),z=Math.sqrt(DM.k/(DM.W/44));
 dpts.slice().sort(function(a,b){return a.c-b.c;}).forEach(function(p){var q=dpx(p.X,p.Y);if(q[0]<-30||q[1]<-30||q[0]>DM.W+30||q[1]>DM.H+30)return;
  var v=(modo==='m'?p.m:p.p)/sc,col=ramp(v),r=Math.max(2.4,Math.min(26,Math.sqrt(p.c)*1.1*z));
  ctx.fillStyle='rgba('+col+',0.82)';ctx.beginPath();ctx.arc(q[0],q[1],r,0,6.283);ctx.fill();});
 var st=[];for(var i=0;i<=10;i++){st.push('rgb('+ramp(i/10)+')');}$('d-bar').style.background='linear-gradient(90deg,'+st.join(',')+')';
 $('d-l0').textContent='0';$('d-l1').textContent=modo==='m'?sc+' min ou mais':'100%';};
function dnear(mx,my){var best=null,bd=1e9;dpts.forEach(function(p){var q=dpx(p.X,p.Y),dd=(q[0]-mx)*(q[0]-mx)+(q[1]-my)*(q[1]-my);if(dd<bd){bd=dd;best=p;}});return bd<22*22?best:null;}
window.__delayInit=function(){var cv=$('d-cv');if(!cv)return;dsize();
 if(!dinit){dinit=true;var u=$('d-uf'),ufl=Array.from(new Set(((CL.datasets[$('c-ds').value]||CL.datasets[Object.keys(CL.datasets)[0]]).mapa||[]).map(function(r){return r[1];}))).sort();ufl.forEach(function(x){var o=document.createElement('option');o.value=x;o.textContent=x;u.appendChild(o);});
  dfit(BB);
  var drag=null,tip=$('d-tip');
  cv.addEventListener('pointerdown',function(e){drag={x:e.clientX,y:e.clientY,sx:DM.x,sy:DM.y,m:false};cv.setPointerCapture(e.pointerId);});
  cv.addEventListener('pointermove',function(e){if(drag){var dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>3)drag.m=true;if(drag.m){DM.x=drag.sx+dx;DM.y=drag.sy+dy;tip.hidden=true;window.__delayDraw();}return;}
   var r=cv.getBoundingClientRect(),p=dnear(e.clientX-r.left,e.clientY-r.top);
   if(p){tip.hidden=false;tip.innerHTML='<strong>'+p.n+' ('+p.uf+')</strong><br>'+fm(p.c)+' urnas lidas · seção média de '+fm(p.a)+' eleitores<br>Atraso médio: '+p2(p.m)+' min<br>'+p1(p.p)+' com mais de 15 min de atraso';tip.style.left=Math.min(e.clientX-r.left+12,DM.W-250)+'px';tip.style.top=(e.clientY-r.top+12)+'px';}else tip.hidden=true;});
  cv.addEventListener('pointerup',function(){drag=null;});cv.addEventListener('mouseleave',function(){tip.hidden=true;});
  function zoomAt(f,cx,cy){var X=(cx-DM.x)/DM.k,Y=(DM.y-cy)/DM.k;DM.k*=f;DM.x=cx-DM.k*X;DM.y=cy+DM.k*Y;window.__delayDraw();}
  cv.addEventListener('wheel',function(e){e.preventDefault();var r=cv.getBoundingClientRect();zoomAt(e.deltaY<0?1.25:0.8,e.clientX-r.left,e.clientY-r.top);},{passive:false});
  $('d-mais').onclick=function(){zoomAt(1.5,DM.W/2,DM.H/2);};$('d-menos').onclick=function(){zoomAt(1/1.5,DM.W/2,DM.H/2);};
  $('d-reset').onclick=function(){dfit(BB);$('d-uf').value='';window.__delayDraw();};
  $('d-modo').onchange=function(){window.__delayDraw();};
  $('d-uf').onchange=function(){var v=$('d-uf').value;if(!v){dfit(BB);window.__delayDraw();return;}var xs=[],ys=[];dpts.forEach(function(p){if(p.uf===v){xs.push(p.X);ys.push(p.Y);}});if(!xs.length)return;
   var b={minx:Math.min.apply(null,xs),maxx:Math.max.apply(null,xs),miny:Math.min.apply(null,ys),maxy:Math.max.apply(null,ys)},dx=(b.maxx-b.minx)*.08+.1,dy=(b.maxy-b.miny)*.08+.1;b.minx-=dx;b.maxx+=dx;b.miny-=dy;b.maxy+=dy;dfit(b);window.__delayDraw();};
  window.addEventListener('resize',function(){if($('p-fechamento').hidden)return;dsize();window.__delayDraw();});}
 else{dfit(BB);}
 window.__delayDraw();};
})();
</script>
