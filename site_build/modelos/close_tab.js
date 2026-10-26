<script>
(function(){
var CL=window.__CL; var $=function(i){return document.getElementById(i);};
function fm(n){return Math.round(n).toLocaleString(window.__LOC||'pt-BR');}
function p1(x){return x.toFixed(1).replace('.',(window.__DEC||','))+'%';}
function p2(x){return x.toFixed(2).replace('.',(window.__DEC||','));}
var REG={Norte:['AC','AP','AM','PA','RO','RR','TO'],Nordeste:['AL','BA','CE','MA','PB','PE','PI','RN','SE'],'Centro-Oeste':['DF','GO','MT','MS'],Sudeste:['ES','MG','RJ','SP'],Sul:['PR','RS','SC']};
var inited=false;
window.__closeInit=function(){ if(!CL||!CL.datasets||inited){ if(inited)draw(); return;} inited=true;
 var ds=$('c-ds'); Object.keys(CL.datasets).forEach(function(k){var o=document.createElement('option');o.value=k;o.textContent=CL.datasets[k].label;ds.appendChild(o);});
 var sel=$('c-uf'); var o=document.createElement('option');o.value='ALL';o.textContent='Brasil (sem exterior)';sel.appendChild(o);
 Object.keys(REG).forEach(function(r){var o=document.createElement('option');o.value='R:'+r;o.textContent='Região '+r;sel.appendChild(o);});
 Object.keys(REG).forEach(function(r){REG[r].forEach(function(u){var o=document.createElement('option');o.value=u;o.textContent=u;sel.appendChild(o);});});
 ['c-ds','c-uf','c-esc','c-mod'].forEach(function(i){$(i).addEventListener('change',draw);});
 draw(); };
function ufsSel(d){var v=$('c-uf').value; var all=Object.keys(d.ufs); if(v==='ALL')return all; if(v.indexOf('R:')===0)return REG[v.slice(2)].filter(function(u){return d.ufs[u];}); return d.ufs[v]?[v]:[];}
function agg(d,list,est){var len=CL.xmax-CL.xmin+1,n=new Array(len).fill(0),L=new Array(len).fill(0),F=new Array(len).fill(0),am=0,tot=0;
 list.forEach(function(u){var s=d.ufs[u],f=est?s.fator:1;am+=s.amostra;tot+=s.total;for(var i=0;i<len;i++){n[i]+=s.n[i]*f;L[i]+=s.L[i]*f;F[i]+=s.F[i]*f;}});
 return {n:n,L:L,F:F,am:am,tot:tot};}
var VS=null;
function draw(){
 var d=CL.datasets[$('c-ds').value]; if(!d)return; var est=$('c-esc').value==='est'; var list=ufsSel(d);
 if(!list.length){$('c-cards').innerHTML='<div class="card">Sem dados lidos ainda para esta seleção.</div>';$('c-svg1').innerHTML='';$('c-svg2').innerHTML='';$('c-tab').innerHTML='';return;}
 var A=agg(d,list,est), len=A.n.length; var mod=$('c-mod').value; $('c-svg1').style.display=(mod==='pct')?'none':''; $('c-svg3').style.display=(mod==='votos')?'none':''; $('c-h3').style.display=$('c-p3').style.display=(mod==='votos')?'none':'';
 var cn=[],cL=[],cF=[],tn=0,tL=0,tF=0;
 for(var i=0;i<len;i++){tn+=A.n[i];tL+=A.L[i];tF+=A.F[i];cn.push(tn);cL.push(tL);cF.push(tF);}
 // janela do eixo x: do primeiro 0,1% ao 99,9% das urnas
 var lo=0,hi=len-1; while(lo<len-1&&cn[lo]<tn*0.001)lo++; while(hi>0&&cn[hi-1]>=tn*0.999)hi--;
 lo=Math.min(lo,CL.xmin*-1-30+0); lo=Math.max(0,Math.min(lo,-CL.xmin-30)); hi=Math.min(len-1,Math.max(hi,-CL.xmin+60));
 var late15=0;for(var i=-CL.xmin+16;i<len;i++)late15+=A.n[i]; var late60=0;for(var i=-CL.xmin+61;i<len;i++)late60+=A.n[i];
 var lv=0,fv=0;for(var i=-CL.xmin+16;i<len;i++){lv+=A.L[i];fv+=A.F[i];}
 $('c-cards').innerHTML=
  '<div class="card"><div class="lab">Urnas analisadas</div><div class="big">'+fm(tn)+'</div><div class="small">'+(est?'estimado a partir de '+fm(A.am)+' boletins lidos de '+fm(A.tot)+' ('+p1(100*A.am/A.tot)+')':fm(A.am)+' de '+fm(A.tot)+' boletins')+'</div></div>'+
  '<div class="card"><div class="lab">Fecharam mais de 15 min depois das 17h</div><div class="big">'+p1(100*late15/tn)+'</div><div class="small">'+fm(late15)+' urnas · '+fm(lv+fv)+' votos em Lula ou '+d.cand+'</div></div>'+
  '<div class="card"><div class="lab">Fecharam mais de 1h depois</div><div class="big">'+p1(100*late60/tn)+'</div><div class="small">'+fm(late60)+' urnas</div></div>';
 $('c-leg').innerHTML='<span><i style="background:var(--lula)"></i>Lula</span><span><i style="background:var(--flavio)"></i>'+d.cand+'</span>';
 // eixo
 var X0=lo,X1=hi,W=1000,H=380,m={l:70,r:16,t:14,b:44};
 var xs=function(i){return m.l+(W-m.l-m.r)*(i-X0)/(X1-X0);};
 var ymax=Math.max(tL,tF)*1.05;var ys=function(v){return H-m.b-(H-m.t-m.b)*v/ymax;};
 var s='';
 for(var k=0;k<=4;k++){var v=ymax*k/4,y=ys(v);s+='<line x1="'+m.l+'" x2="'+(W-m.r)+'" y1="'+y+'" y2="'+y+'" stroke="var(--line)"/><text class="m" x="'+(m.l-6)+'" y="'+(y+4)+'" text-anchor="end">'+(v>=1e6?(v/1e6).toFixed(1).replace('.',(window.__DEC||','))+' mi':fm(v))+'</text>';}
 var step=X1-X0>400?60:X1-X0>200?30:15;
 for(var t=Math.ceil((X0+CL.xmin)/step)*step;t<=X1+CL.xmin;t+=step){var x=xs(t-CL.xmin);s+='<line x1="'+x+'" x2="'+x+'" y1="'+(H-m.b)+'" y2="'+(H-m.b+4)+'" stroke="var(--mute)"/><text class="m" x="'+x+'" y="'+(H-m.b+17)+'" text-anchor="middle">'+(t>0?'+':t<0?'−':'')+Math.abs(t)+'</text>';}
 s+='<text class="m" x="'+(W/2)+'" y="'+(H-6)+'" text-anchor="middle">minutos em relação às 17h de Brasília (0 = horário previsto de fechamento)</text>';
 var z=xs(-CL.xmin);s+='<line x1="'+z+'" x2="'+z+'" y1="'+m.t+'" y2="'+(H-m.b)+'" stroke="var(--mute)" stroke-dasharray="4 3"/>';
 function path(c){var p='';for(var i=X0;i<=X1;i++)p+=(i===X0?'M':'L')+xs(i).toFixed(1)+' '+ys(c[i]).toFixed(1);return p;}
 s+='<path d="'+path(cL)+'" fill="none" stroke="var(--lula)" stroke-width="2.4"/><path d="'+path(cF)+'" fill="none" stroke="var(--flavio)" stroke-width="2.4"/>';
 s+='<line id="c-cur1" x1="0" x2="0" y1="'+m.t+'" y2="'+(H-m.b)+'" stroke="var(--fg)" stroke-width="1" style="display:none"/>';
 $('c-svg1').innerHTML=s;
 // segundo gráfico: parcela acumulada e janela de 5 min
 var H2=300,m2={l:70,r:16,t:14,b:44};
 var sh=[],win=[];for(var i=0;i<len;i++){sh.push(cL[i]+cF[i]>0?100*cL[i]/(cL[i]+cF[i]):null);
  var a=0,b=0;for(var j=Math.max(0,i-4);j<=i;j++){a+=A.L[j];b+=A.F[j];}win.push(a+b>0?100*a/(a+b):null);}
 var vals=[];for(var i=X0;i<=X1;i++){if(sh[i]!==null)vals.push(sh[i]);if(win[i]!==null&&cn[i]>tn*0.01)vals.push(win[i]);}
 var vmin=Math.min.apply(null,vals.concat([50])),vmax=Math.max.apply(null,vals.concat([50]));vmin=Math.floor(vmin-1);vmax=Math.ceil(vmax+1);
 var ys2=function(v){return H2-m2.b-(H2-m2.t-m2.b)*(v-vmin)/(vmax-vmin);};
 var s2='';for(var v=vmin;v<=vmax;v+=Math.max(1,Math.round((vmax-vmin)/5))){var y=ys2(v);s2+='<line x1="'+m2.l+'" x2="'+(W-m2.r)+'" y1="'+y+'" y2="'+y+'" stroke="var(--line)"/><text class="m" x="'+(m2.l-6)+'" y="'+(y+4)+'" text-anchor="end">'+v+'%</text>';}
 var y50=ys2(50);s2+='<line x1="'+m2.l+'" x2="'+(W-m2.r)+'" y1="'+y50+'" y2="'+y50+'" stroke="var(--mute)" stroke-dasharray="4 3"/>';
 s2+='<line x1="'+z+'" x2="'+z+'" y1="'+m2.t+'" y2="'+(H2-m2.b)+'" stroke="var(--mute)" stroke-dasharray="4 3"/>';
 for(var t=Math.ceil((X0+CL.xmin)/step)*step;t<=X1+CL.xmin;t+=step){var x=xs(t-CL.xmin);s2+='<line x1="'+x+'" x2="'+x+'" y1="'+(H2-m2.b)+'" y2="'+(H2-m2.b+4)+'" stroke="var(--mute)"/><text class="m" x="'+x+'" y="'+(H2-m2.b+17)+'" text-anchor="middle">'+(t>0?'+':t<0?'−':'')+Math.abs(t)+'</text>';}
 s2+='<text class="m" x="'+(W/2)+'" y="'+(H2-6)+'" text-anchor="middle">minutos em relação às 17h de Brasília (0 = horário previsto de fechamento)</text>';
 function path2(a,min){var p='',on=false;for(var i=X0;i<=X1;i++){if(a[i]===null||(min&&cn[i]<tn*min)){on=false;continue;}p+=(on?'L':'M')+xs(i).toFixed(1)+' '+ys2(a[i]).toFixed(1);on=true;}return p;}
 s2+='<path d="'+path2(win,0.01)+'" fill="none" stroke="var(--outros)" stroke-width="1.2"/><path d="'+path2(sh,0)+'" fill="none" stroke="var(--lula)" stroke-width="2.4"/>';
 s2+='<text class="m" x="'+(m2.l+6)+'" y="'+(m2.t+12)+'">linha vermelha: acumulado · linha clara: janela de 5 minutos</text>';
 s2+='<line id="c-cur2" x1="0" x2="0" y1="'+m2.t+'" y2="'+(H2-m2.b)+'" stroke="var(--fg)" stroke-width="1" style="display:none"/>';
 $('c-svg2').innerHTML=s2;

 // terceiro gráfico: % acumulada do total final de cada candidato
 var H3=340,m3={l:70,r:16,t:14,b:44};var ys3=function(v){return H3-m3.b-(H3-m3.t-m3.b)*v/100;};
 var pL=[],pF=[];for(var i=0;i<len;i++){pL.push(tL+tF>0?100*cL[i]/(tL+tF):0);pF.push(tL+tF>0?100*cF[i]/(tL+tF):0);}
 var s3='';for(var v=0;v<=100;v+=25){var y=ys3(v);s3+='<line x1="'+m3.l+'" x2="'+(W-m3.r)+'" y1="'+y+'" y2="'+y+'" stroke="var(--line)"/><text class="m" x="'+(m3.l-6)+'" y="'+(y+4)+'" text-anchor="end">'+v+'%</text>';}
 for(var t=Math.ceil((X0+CL.xmin)/step)*step;t<=X1+CL.xmin;t+=step){var x=xs(t-CL.xmin);s3+='<line x1="'+x+'" x2="'+x+'" y1="'+(H3-m3.b)+'" y2="'+(H3-m3.b+4)+'" stroke="var(--mute)"/><text class="m" x="'+x+'" y="'+(H3-m3.b+17)+'" text-anchor="middle">'+(t>0?'+':t<0?'−':'')+Math.abs(t)+'</text>';}
 s3+='<text class="m" x="'+(W/2)+'" y="'+(H3-6)+'" text-anchor="middle">minutos em relação às 17h de Brasília (0 = horário previsto de fechamento)</text>';
 s3+='<line x1="'+z+'" x2="'+z+'" y1="'+m3.t+'" y2="'+(H3-m3.b)+'" stroke="var(--mute)" stroke-dasharray="4 3"/>';
 function path3(c){var p='';for(var i=X0;i<=X1;i++)p+=(i===X0?'M':'L')+xs(i).toFixed(1)+' '+ys3(c[i]).toFixed(1);return p;}
 var pS=pL.map(function(v,i){return v+pF[i];});
 s3+='<path d="'+path3(pS)+'" fill="none" stroke="var(--mute)" stroke-width="1.4" stroke-dasharray="5 4"/>';
 s3+='<path d="'+path3(pL)+'" fill="none" stroke="var(--lula)" stroke-width="2.4"/><path d="'+path3(pF)+'" fill="none" stroke="var(--flavio)" stroke-width="2.4"/>';
 var xe=xs(X1),fL=pL[X1],fF=pF[X1];
 s3+='<circle cx="'+xe+'" cy="'+ys3(fL)+'" r="4" fill="var(--lula)"/><text x="'+(xe-8)+'" y="'+(ys3(fL)-8)+'" text-anchor="end" style="fill:var(--lula);font-weight:600">Lula '+p1(fL)+'</text>';
 s3+='<circle cx="'+xe+'" cy="'+ys3(fF)+'" r="4" fill="var(--flavio)"/><text x="'+(xe-8)+'" y="'+(ys3(fF)+16)+'" text-anchor="end" style="fill:var(--flavio);font-weight:600">'+d.cand+' '+p1(fF)+'</text>';
 s3+='<text class="m" x="'+(xe-8)+'" y="'+(ys3(100)-5)+'" text-anchor="end">soma das duas linhas: '+p1(fL+fF)+'</text>';
 s3+='<line id="c-cur3" x1="0" x2="0" y1="'+m3.t+'" y2="'+(H3-m3.b)+'" stroke="var(--fg)" stroke-width="1" style="display:none"/>';
 $('c-svg3').innerHTML=s3;

 // quarto gráfico: parcela acumulada de cada um (só vermelha e azul)
 var H4=300,m4={l:70,r:16,t:14,b:44},lo4=50,hi4=50;
 for(var i=X0;i<=X1;i++){if(sh[i]!==null&&cn[i]>tn*0.001){lo4=Math.min(lo4,sh[i],100-sh[i]);hi4=Math.max(hi4,sh[i],100-sh[i]);}}
 lo4=Math.floor(lo4-1);hi4=Math.ceil(hi4+1);
 var ys4=function(v){return H4-m4.b-(H4-m4.t-m4.b)*(v-lo4)/(hi4-lo4);};
 var s4='';var st4=Math.max(1,Math.round((hi4-lo4)/5));for(var v=lo4;v<=hi4;v+=st4){var y=ys4(v);s4+='<line x1="'+m4.l+'" x2="'+(W-m4.r)+'" y1="'+y+'" y2="'+y+'" stroke="var(--line)"/><text class="m" x="'+(m4.l-6)+'" y="'+(y+4)+'" text-anchor="end">'+v+'%</text>';}
 var y50b=ys4(50);s4+='<line x1="'+m4.l+'" x2="'+(W-m4.r)+'" y1="'+y50b+'" y2="'+y50b+'" stroke="var(--mute)" stroke-dasharray="4 3"/>';
 for(var t=Math.ceil((X0+CL.xmin)/step)*step;t<=X1+CL.xmin;t+=step){var x=xs(t-CL.xmin);s4+='<line x1="'+x+'" x2="'+x+'" y1="'+(H4-m4.b)+'" y2="'+(H4-m4.b+4)+'" stroke="var(--mute)"/><text class="m" x="'+x+'" y="'+(H4-m4.b+17)+'" text-anchor="middle">'+(t>0?'+':t<0?'−':'')+Math.abs(t)+'</text>';}
 s4+='<text class="m" x="'+(W/2)+'" y="'+(H4-6)+'" text-anchor="middle">minutos em relação às 17h de Brasília (0 = horário previsto de fechamento)</text>';
 s4+='<line x1="'+z+'" x2="'+z+'" y1="'+m4.t+'" y2="'+(H4-m4.b)+'" stroke="var(--mute)" stroke-dasharray="4 3"/>';
 function path4(f){var p='',on=false;for(var i=X0;i<=X1;i++){if(sh[i]===null||cn[i]<tn*0.001){on=false;continue;}p+=(on?'L':'M')+xs(i).toFixed(1)+' '+ys4(f(sh[i])).toFixed(1);on=true;}return p;}
 s4+='<path d="'+path4(function(v){return v;})+'" fill="none" stroke="var(--lula)" stroke-width="2.4"/><path d="'+path4(function(v){return 100-v;})+'" fill="none" stroke="var(--flavio)" stroke-width="2.4"/>';
 s4+='<line id="c-cur4" x1="0" x2="0" y1="'+m4.t+'" y2="'+(H4-m4.b)+'" stroke="var(--fg)" stroke-width="1" style="display:none"/>';
 $('c-svg4').innerHTML=s4;
 VS={pL:pL,pF:pF,X0:X0,X1:X1,m:m,W:W,A:A,cn:cn,cL:cL,cF:cF,sh:sh,win:win,d:d,tn:tn};
 // tabela de faixas
 var nomes=['No horário (até +15 min)','15 a 30 min depois','30 a 60 min depois','60 a 90 min depois','Mais de 90 min depois'];
 var fs=d.faixas, ftot=0, gf=0,gsm=0; list.forEach(function(u){gf+=d.ufs[u].total;gsm+=d.ufs[u].amostra;}); var fe=est?(gf/gsm):1;
 fs.forEach(function(r){ftot+=r.n;});
 var h='<thead><tr><th>Faixa de fechamento</th><th style="text-align:right">Urnas</th><th style="text-align:right">% das urnas</th><th style="text-align:right">Votos Lula</th><th style="text-align:right">Votos '+d.cand+'</th><th style="text-align:right">Lula (% de L+'+d.cand.charAt(0)+')</th><th style="text-align:right">Esperado no município</th><th style="text-align:right">Diferença (pp)</th><th style="text-align:right">Votos de Lula acima/abaixo do esperado</th></tr></thead><tbody>';
 fs.forEach(function(r){var sL=100*r.L/(r.L+r.F),base=r.LFc?100*r.expL/r.LFc:null,act=r.LFc?100*r.Lc/r.LFc:null,dif=base!==null?act-base:null,ex=(r.Lc-r.expL)*fe;
  h+='<tr><th>'+nomes[r.f]+'</th><td class="n">'+fm(r.n*fe)+'</td><td class="n">'+p1(100*r.n/ftot)+'</td><td class="n">'+fm(r.L*fe)+'</td><td class="n">'+fm(r.F*fe)+'</td><td class="n">'+p1(sL)+'</td><td class="n">'+(base===null?'—':p1(base))+'</td><td class="n '+(dif>0?'pos':'neg')+'">'+(dif===null?'—':(dif>0?'+':'−')+p2(Math.abs(dif)))+'</td><td class="n">'+(r.f===0?'—':(ex>0?'+':'−')+fm(Math.abs(ex)))+'</td></tr>';});
 $('c-tab').innerHTML=h+'</tbody>';
 $('c-nota').textContent='A tabela usa todo o país (sem exterior), independente do filtro "Onde". '+(est?'Os valores são estimados multiplicando a amostra pelo inverso da fração lida em cada estado. ':'')+'A comparação “esperado” só usa municípios que têm urnas nas duas situações. Diferença de poucos votos entre faixas não é evidência de padrão fora do esperado: o que importa é o tamanho frente à incerteza da amostra.';
}
function hover(svg,which){return function(e){if(!VS)return;var r=svg.getBoundingClientRect(),px=(e.clientX-r.left)/r.width*1000;
  var i=Math.round(VS.X0+(px-VS.m.l)/(VS.W-VS.m.l-VS.m.r)*(VS.X1-VS.X0));i=Math.max(VS.X0,Math.min(VS.X1,i));
  var x=VS.m.l+(VS.W-VS.m.l-VS.m.r)*(i-VS.X0)/(VS.X1-VS.X0);
  ['c-cur1','c-cur2','c-cur3','c-cur4'].forEach(function(id){var el=$(id);if(el){el.setAttribute('x1',x);el.setAttribute('x2',x);el.style.display='';}});
  var t=i+CL.xmin, A=VS.A, d=VS.d; var sh=VS.sh[i];
  var 
  h='<strong>'+(t>0?'+':t<0?'−':'')+Math.abs(t)+' min depois das 17h</strong><br>Urnas fechadas até aqui: '+fm(VS.cn[i])+' ('+p1(100*VS.cn[i]/VS.tn)+')<br>Lula acumulado: '+fm(VS.cL[i])+'<br>'+d.cand+' acumulado: '+fm(VS.cF[i])+'<br>Lula entre os dois: '+(sh===null?'—':p2(sh)+'%')+'<br><span class="mute">Neste minuto: '+fm(A.n[i])+' urnas · Lula '+fm(A.L[i])+' · '+d.cand+' '+fm(A.F[i])+'</span>';
  var T=$('ttp');T.innerHTML=h;T.hidden=false;T.style.left=Math.min(e.clientX+14,innerWidth-280)+'px';T.style.top=(e.clientY+14)+'px';};}
['c-svg1','c-svg2','c-svg3','c-svg4'].forEach(function(id,k){var s=$(id);s.addEventListener('mousemove',hover(s,k));s.addEventListener('mouseleave',function(){$('ttp').hidden=true;['c-cur1','c-cur2','c-cur3','c-cur4'].forEach(function(i){var el=$(i);if(el)el.style.display='none';});});});
})();
</script>
