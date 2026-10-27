<script>
(function(){
var $=function(i){return document.getElementById(i);};
var BASE='../../dados/mapa/', IDX=null, MUN=null, inited=false, V={x:0,y:0,k:1,W:0,H:0}, CELLS=[];
function fm(n){return Math.round(n).toLocaleString(window.__LOC||'pt-BR');}
function dec(x,k){return x.toFixed(k).replace('.',(window.__DEC||','));}
function merc(lat){var r=lat*Math.PI/180;return Math.log(Math.tan(Math.PI/4+r/2))*180/Math.PI;}
function css(n){return getComputedStyle(document.documentElement).getPropertyValue(n).trim();}
function dark(){var a=document.documentElement.getAttribute('data-theme');return a==='dark'||(!a&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);}
function titulo(s){return s.toLowerCase().replace(/(^|[\s\-])(\S)/g,function(m,a,b){return a+b.toUpperCase();}).replace(/ (Da|De|Do|Das|Dos|E) /g,function(m){return m.toLowerCase();});}
function ramp(t){ // t em [-1,1]: azul (negativo) a vermelho (positivo)
 var neu=dark()?[70,76,88]:[238,236,230],red=dark()?[240,98,108]:[190,32,44],blu=dark()?[104,152,230]:[26,84,170],c=t>=0?red:blu,a=Math.min(1,Math.abs(t));
 return neu.map(function(v,i){return Math.round(v+(c[i]-v)*a);});}
function seq(t){t=Math.max(0,Math.min(1,t));var a=dark()?[60,66,76]:[250,240,205],b=dark()?[255,122,84]:[170,30,36];return a.map(function(v,i){return Math.round(v+(b[i]-v)*t);});}
function met(o){var s=o.v13+o.v22,m=$('s-met').value||'l';
 if(m==='l')return s?100*o.v13/s:null; if(m==='f')return s?100*o.v22/s:null; if(m==='m')return s?100*(o.v13-o.v22)/s:null;
 if(m==='a')return o.ap?100*(o.ap-o.cp)/o.ap:null; if(m==='d')return o.d; return o.s;}
var SC={max:30};
function cor(v){var m=$('s-met').value||'l';if(v===null||v===undefined)return [150,150,150];
 if(m==='l')return ramp((v-50)/25); if(m==='f')return ramp(-(v-50)/25); if(m==='m')return ramp(v/50);
 if(m==='a')return seq(v/40); if(m==='d')return seq(v/SC.max); return seq(v/SC.max);}
function legenda(){var m=$('s-met').value||'l',st=[];
 for(var i=0;i<=10;i++){var t=i/10,c=(m==='l'||m==='f'||m==='m')?ramp(t*2-1):seq(t);st.push('rgb('+c+')');}
 if(m==='f'){st=st.reverse();}
 $('s-bar').style.background='linear-gradient(90deg,'+st.join(',')+')';
 var L={l:['25%','75%'],f:['25%','75%'],m:['−50 pp','+50 pp'],a:['0%','40%'],d:['0 min',SC.max+' min'],s:['0',String(SC.max)]}[m];
 $('s-l0').textContent=L[0];$('s-l1').textContent=L[1];}
function msg(t){var e=$('s-msg');if(!t){e.hidden=true;return;}e.hidden=false;e.textContent=t;}
function dsize(){var cv=$('s-cv'),r=cv.getBoundingClientRect(),dp=window.devicePixelRatio||1;V.W=r.width;V.H=r.height;cv.width=r.width*dp;cv.height=r.height*dp;cv.getContext('2d').setTransform(dp,0,0,dp,0,0);}
function fit(b){var pad=26,w=V.W-2*pad,h=V.H-2*pad,x0=b[0],x1=b[2],y0=merc(b[1]),y1=merc(b[3]);var k=Math.min(w/Math.max(x1-x0,1e-4),h/Math.max(y1-y0,1e-4));V.k=k;V.x=V.W/2-k*(x0+x1)/2;V.y=V.H/2+k*(y0+y1)/2;}
function P(lon,lat){return [V.x+V.k*lon,V.y-V.k*merc(lat)];}
function rings(g){return g.type==='Polygon'?[g.coordinates]:g.coordinates;}
var GEN=0;
function prep(){GEN++;CELLS=[];if(!MUN)return;
 var cam=$('s-cam').value||'loc';
 if(cam==='zon'){var z={};MUN.locais.forEach(function(l){var o=z[l.zona]||(z[l.zona]={s:0,ap:0,cp:0,v13:0,v22:0,vo:0,dw:0,dn:0,zona:l.zona});o.s+=l.s;o.ap+=l.ap;o.cp+=l.cp;o.v13+=l.v13;o.v22+=l.v22;if(l.d!==null){o.dw+=l.d*l.s;o.dn+=l.s;}});
  MUN.zonas.forEach(function(zz){var o=z[zz.zona]||{s:0,ap:0,cp:0,v13:0,v22:0,dw:0,dn:0};o.d=o.dn?o.dw/o.dn:null;o.nome='Zona '+zz.zona;o.bairro='';o.zonaInfo=zz;CELLS.push({o:o,g:zz.g,u:0,tipo:'zona'});});}
 else MUN.locais.forEach(function(l){CELLS.push({o:l,g:l.g,u:l.u,tipo:'local'});});
 var vals=CELLS.map(function(c){return met(c.o);}).filter(function(v){return v!==null&&v!==undefined;}).sort(function(a,b){return a-b;});
 var m=$('s-met').value||'l';SC.max=(m==='d')?Math.max(15,Math.ceil(vals[Math.floor(vals.length*0.97)]||30)):(m==='s'?Math.max(5,Math.ceil(vals[Math.floor(vals.length*0.97)]||10)):30);
 CELLS.forEach(function(c){var bx=[1e9,1e9,-1e9,-1e9];rings(c.g).forEach(function(p){p[0].forEach(function(q){var X=q[0],Y=merc(q[1]);if(X<bx[0])bx[0]=X;if(Y<bx[1])bx[1]=Y;if(X>bx[2])bx[2]=X;if(Y>bx[3])bx[3]=Y;});});c.bx=bx;});}
function draw(){var cv=$('s-cv'),ctx=cv.getContext('2d');ctx.clearRect(0,0,V.W,V.H);legenda();if(!MUN)return;
 var cam=$('s-cam').value||'loc',lw=css('--line'),fg=css('--fg');
 function path(g){ctx.beginPath();rings(g).forEach(function(p){p.forEach(function(r){r.forEach(function(q,i){var a=P(q[0],q[1]);if(i)ctx.lineTo(a[0],a[1]);else ctx.moveTo(a[0],a[1]);});ctx.closePath();});});}
 if(cam!=='sq'||true){CELLS.forEach(function(c){var v=met(c.o),col=cor(v),al=cam==='sq'?0.18:(c.u===2?0.5:c.u===1?0.75:0.92);
   path(c.g);ctx.fillStyle='rgba('+col+','+al+')';ctx.fill();ctx.strokeStyle=cam==='sq'?lw:'rgba(80,80,80,0.55)';ctx.lineWidth=c.u===2?1.2:0.7;ctx.setLineDash(c.u===2?[5,4]:[]);ctx.stroke();ctx.setLineDash([]);});}
 if(cam==='sq'){MUN.locais.forEach(function(l){var n=l.s,k=Math.ceil(Math.sqrt(n)),side=70,dlat=side/111320,dlon=side/(111320*Math.cos(l.lat*Math.PI/180)),col=cor(met(l)),j=0;
   for(var gx=0;gx<k&&j<n;gx++)for(var gy=0;gy<k&&j<n;gy++,j++){var lon=l.lon+(gx-k/2)*dlon*1.15,lat=l.lat+(gy-k/2)*dlat*1.15,a=P(lon,lat),b=P(lon+dlon,lat+dlat),w=Math.max(1.2,Math.abs(b[0]-a[0])),h=Math.max(1.2,Math.abs(b[1]-a[1]));
    ctx.fillStyle='rgb('+col+')';ctx.fillRect(a[0],a[1]-h,w,h);}});}
 if(cam!=='zon'&&MUN.zonas.length){ctx.strokeStyle=fg;ctx.globalAlpha=0.55;ctx.lineWidth=1.6;MUN.zonas.forEach(function(z){path(z.g);ctx.stroke();});ctx.globalAlpha=1;}
 if(cam==='zon'){ctx.fillStyle=fg;ctx.font='600 12px '+css('--mono');CELLS.forEach(function(c){var b=c.bx,a=P(b[0],0),z=P(b[2],0);if(z[0]-a[0]>40){var cx=(a[0]+z[0])/2,cy=V.y-V.k*(b[1]+b[3])/2;ctx.fillText(c.o.nome,cx-18,cy);}});}
 else{ctx.fillStyle=fg;ctx.font='11px '+css('--body');ctx.globalAlpha=0.9;CELLS.forEach(function(c){var b=c.bx,a=P(b[0],0),z=P(b[2],0);if(z[0]-a[0]>150){var cx=(a[0]+z[0])/2,cy=V.y-V.k*(b[1]+b[3])/2,t=(c.o.nome||'').slice(0,28);ctx.fillText(t,cx-ctx.measureText(t).width/2,cy);}});ctx.globalAlpha=1;}
 if(window.__mapS&&window.__mapS.after)window.__mapS.after();}
function pip(c,X,Y){var b=c.bx;if(X<b[0]||X>b[2]||Y<b[1]||Y>b[3])return false;var inside=false;
 rings(c.g).forEach(function(p){var r=p[0];for(var i=0,j=r.length-1;i<r.length;j=i++){var xi=r[i][0],yi=merc(r[i][1]),xj=r[j][0],yj=merc(r[j][1]);if((yi>Y)!==(yj>Y)&&X<(xj-xi)*(Y-yi)/(yj-yi)+xi)inside=!inside;}});return inside;}
function tiph(o){var s=o.v13+o.v22;
 return '<strong>'+(o.nome||'')+'</strong>'+(o.bairro?'<br>Bairro: '+titulo(o.bairro):'')+'<br>Zona '+(o.zona||'—')+' · '+fm(o.s)+' seções · '+fm(o.ap)+' eleitores aptos'+(o.nl>1?' · '+o.nl+' locais neste ponto':'')+
 '<br>Lula '+dec(s?100*o.v13/s:0,1)+'% · Flávio Bolsonaro '+dec(s?100*o.v22/s:0,1)+'% (de Lula + Flávio Bolsonaro)'+'<br>Abstenção '+dec(o.ap?100*(o.ap-o.cp)/o.ap:0,1)+'%'+(o.d!==null&&o.d!==undefined?'<br>Atraso médio no fechamento '+dec(o.d,1)+' min':'')+
 (o.a?'<br><span class="mute">Área estimada '+dec(o.a,1)+' km² · '+(o.u===2?'estimativa pouco confiável':o.u===1?'estimativa moderada':'estimativa razoável')+'</span>':'');}
function tip(o,e){var t=$('s-tip');t.innerHTML=tiph(o);
 t.hidden=false;var r=$('s-cv').getBoundingClientRect();t.style.left=Math.min(e.clientX-r.left+12,V.W-270)+'px';t.style.top=(e.clientY-r.top+12)+'px';}
function carregar(uf,cd){msg('Carregando…');fetch(BASE+uf+'/'+cd+'.json').then(function(r){if(!r.ok)throw 0;return r.json();}).then(function(d){MUN=d;prep();dsize();fit(d.bbox);draw();msg('');
 $('s-aviso').textContent='Áreas estimadas por proximidade ao local de votação (diagrama de Voronoi recortado pelo limite municipal'+(d.fonte==='IBGE'?' do IBGE':', aproximado pelos locais, pois o limite do IBGE não foi encontrado')+'). Bordas tracejadas e cores mais claras indicam células grandes, onde a estimativa é menos confiável. Os quadrados são uma convenção visual, um por seção, em volta do ponto do local; não mostram a posição real das seções.'+(d.inval_locais?' '+fm(d.inval_locais)+' locais ('+fm(d.inval_secoes)+' seções) ficaram de fora por falta de coordenada válida.':'');}).catch(function(){msg('Não foi possível carregar os dados deste município.');});}
function listaMun(){var uf=$('s-uf').value,dl='';(IDX[uf]||[]).forEach(function(r){dl+='<option value="'+titulo(r[1])+'">';});$('s-muns').innerHTML=dl;}
function escolher(){var uf=$('s-uf').value,v=$('s-mun').value.trim().toLowerCase(),r=(IDX[uf]||[]).filter(function(x){return titulo(x[1]).toLowerCase()===v||x[1].toLowerCase()===v;})[0];if(r)carregar(uf,r[0]);}
/* API de toque (mobile_mapas.js) */
function ccent(c){var b=c.bx;return [V.x+V.k*(b[0]+b[2])/2,V.y-V.k*(b[1]+b[3])/2];}
window.__mapS={cv:document.getElementById('s-cv'),id:'s',
 size:function(){return [V.W,V.H];},
 get:function(i){var c=CELLS[i];if(!c)return null;var q=ccent(c);return {x:q[0],y:q[1],html:tiph(c.o),r:10,path:function(){var out=[];rings(c.g).forEach(function(p){p.forEach(function(r){out.push(r.map(function(z){return P(z[0],z[1]);}));});});return out;}};},
 hit:function(x,y){var X=(x-V.x)/V.k,Y=(V.y-y)/V.k;for(var i=CELLS.length-1;i>=0;i--){if(pip(CELLS[i],X,Y))return i;}return -1;},
 near:function(x,y,n){var a=[];CELLS.forEach(function(c,i){var q=ccent(c);if(q[0]<0||q[1]<0||q[0]>V.W||q[1]>V.H)return;a.push([(q[0]-x)*(q[0]-x)+(q[1]-y)*(q[1]-y),i]);});a.sort(function(u,v){return u[0]-v[0];});return a.slice(0,n).map(function(u){return u[1];});},
 zoomAt:function(f,cx,cy){var X=(cx-V.x)/V.k,Y=(V.y-cy)/V.k;V.k*=f;V.x=cx-V.k*X;V.y=cy+V.k*Y;draw();},
 reset:function(){if(MUN){fit(MUN.bbox);draw();}},pan:function(dx,dy){V.x+=dx;V.y+=dy;draw();},gen:function(){return GEN;},after:null};
window.__secInit=function(){var cv=$('s-cv');if(!cv)return;
 if(!inited){inited=true;
  if(location.protocol.indexOf('http')!==0||/claude\.ai|claudeusercontent/.test(location.hostname)){msg('Esta visão carrega arquivos do site público. Abra https://eleicoesbrasil.github.io/2026/presidente/#secoes para ver o mapa por zona e local de votação.');return;}
  fetch(BASE+'index.json').then(function(r){if(!r.ok)throw 0;return r.json();}).then(function(ix){IDX=ix;var u=$('s-uf'),h='';Object.keys(ix).sort().forEach(function(k){h+='<option value="'+k+'">'+k+'</option>';});u.innerHTML=h;
   u.value=ix.SP?'SP':Object.keys(ix)[0];listaMun();var d=(ix[u.value]||[]).filter(function(r){return r[1]==='SÃO PAULO';})[0]||(ix[u.value]||[])[0];if(d){$('s-mun').value=titulo(d[1]);carregar(u.value,d[0]);}
   u.onchange=function(){listaMun();var first=(IDX[u.value]||[])[0];if(first){$('s-mun').value=titulo(first[1]);carregar(u.value,first[0]);}};
   $('s-mun').onchange=escolher;
   ['s-met','s-cam'].forEach(function(i){$(i).onchange=function(){prep();draw();};});
  }).catch(function(){msg('Os dados do mapa por município ainda não foram publicados neste endereço.');});
  var drag=null;
  cv.addEventListener('pointerdown',function(e){drag={x:e.clientX,y:e.clientY,sx:V.x,sy:V.y,m:false};cv.setPointerCapture(e.pointerId);});
  cv.addEventListener('pointermove',function(e){if(drag){var dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>3)drag.m=true;if(drag.m){V.x=drag.sx+dx;V.y=drag.sy+dy;$('s-tip').hidden=true;draw();}return;}
   if(!MUN)return;var r=cv.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top,X=(mx-V.x)/V.k,Y=(V.y-my)/V.k,hit=null;
   for(var i=CELLS.length-1;i>=0;i--){if(pip(CELLS[i],X,Y)){hit=CELLS[i];break;}}
   if(hit)tip(hit.o,e);else $('s-tip').hidden=true;});
  cv.addEventListener('pointerup',function(){drag=null;});cv.addEventListener('mouseleave',function(){$('s-tip').hidden=true;});
  function zoomAt(f,cx,cy){var X=(cx-V.x)/V.k,Y=(V.y-cy)/V.k;V.k*=f;V.x=cx-V.k*X;V.y=cy+V.k*Y;draw();}
  cv.addEventListener('wheel',function(e){e.preventDefault();var r=cv.getBoundingClientRect();zoomAt(e.deltaY<0?1.3:0.77,e.clientX-r.left,e.clientY-r.top);},{passive:false});
  $('s-mais').onclick=function(){zoomAt(1.6,V.W/2,V.H/2);};$('s-menos').onclick=function(){zoomAt(1/1.6,V.W/2,V.H/2);};
  $('s-reset').onclick=function(){if(MUN){fit(MUN.bbox);draw();}};
  window.addEventListener('resize',function(){if($('p-secoes').hidden)return;dsize();if(MUN){fit(MUN.bbox);}draw();});}
 dsize();if(MUN)fit(MUN.bbox);draw();};
})();
</script>
