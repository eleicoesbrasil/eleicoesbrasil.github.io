/* mobile_graficos: reescala os gráficos SVG (viewBox 1000) para a largura real do celular,
   com fontes de ~12px, título do eixo Y acima, rótulos quebrados, toque com tooltip fixo. */
(function(){
var MQ=window.matchMedia('(max-width:700px)');
var CFG={ // orig: W,H,l,r,t,b ; hn = altura desejada (px) no celular
 'c-svg3':{Ho:340,l:70,r:16,t:14,b:44,hn:300},
 'c-svg2':{Ho:300,l:70,r:16,t:14,b:44,hn:270},
 'c-svg4':{Ho:300,l:70,r:16,t:14,b:44,hn:270},
 't-svg':{Ho:420,l:70,r:16,t:16,b:52,hn:340},
 'as-svg':{Ho:440,l:70,r:16,t:16,b:56,hn:340},
 'b-svg':{Ho:440,l:50,r:10,t:16,b:70,hn:340,binlab:1},
 'g-svg':{Ho:400,l:84,r:16,t:26,b:70,hn:340,bars:1}
};
var Wo=1000, CH=7.3, LH=15, busy=false;
function $(i){return document.getElementById(i);}
function num(el,a){return parseFloat(el.getAttribute(a));}
function wrap(s,max){var w=s.split(/\s+/),out=[],cur='';w.forEach(function(x){if(cur&&(cur+' '+x).length>max){out.push(cur);cur=x;}else cur=cur?cur+' '+x:x;});if(cur)out.push(cur);return out;}
function setLines(el,lines,x){el.textContent='';lines.forEach(function(t,i){var s=document.createElementNS('http://www.w3.org/2000/svg','tspan');s.setAttribute('x',x);if(i)s.setAttribute('dy',LH);s.textContent=t;el.appendChild(s);});}
function compact(t){ // 12.345.678 -> 12,3 mi
 var m=/^([−+-]?)(\d{1,3}(?:[.,\s ]\d{3})+)$/.exec(t.trim());if(!m)return t;
 var v=parseInt(m[2].replace(/\D/g,''),10),en=(window.__LANG==='en'),d=window.__DEC||',';
 if(v>=1e6)return m[1]+(v/1e6).toFixed(1).replace('.',d)+(en?' M':' mi');
 if(v>=1e4)return m[1]+Math.round(v/1e3)+(en?' k':' mil');
 return t;}
function restore(svg){if(svg._orig===undefined)return;svg.innerHTML=svg._orig;svg.setAttribute('viewBox','0 0 1000 '+svg._ho);svg.classList.remove('mob');svg._fx=null;svg._wn=0;}
function apply(svg){
 var c=CFG[svg.id];if(!c)return;busy=true;
 try{
 if(svg._orig===undefined)return;
 svg.innerHTML=svg._orig;
 if(!MQ.matches){restore(svg);return;}
 var rw=svg.getBoundingClientRect().width-2;
 var Wn=Math.round(rw>120?rw:(document.documentElement.clientWidth-34));
 var texts=[].slice.call(svg.querySelectorAll('text'));
 var Ho=c.Ho,ml=c.l,mr=c.r,mt=c.t,mb=c.b;
 // rótulos do eixo Y (ancorados em end perto da margem esquerda)
 var maxy=0;texts.forEach(function(t){if(t.getAttribute('text-anchor')==='end'&&Math.abs(num(t,'x')-(ml-6))<1.5){if(c.bars||true){t.textContent=compact(t.textContent);}maxy=Math.max(maxy,t.textContent.length);}});
 var mln=Math.max(34,Math.round(maxy*CH+12)),mrn=12;
 // títulos
 var ytitle=null,xtitles=[];
 texts.forEach(function(t){var tr=t.getAttribute('transform')||'';
  if(/rotate\(-90\)/.test(tr))ytitle=t;
  else if(num(t,'y')>=Ho-10&&!t.getAttribute('transform'))xtitles.push(t);});
 var topLines=[],extraTop=0,extraBot=0;
 if(ytitle){topLines=wrap(ytitle.textContent,Math.floor((Wn-10)/CH));extraTop=topLines.length*LH+4;}
 var xl=xtitles.map(function(t){var s=t.textContent,max=Math.floor((Wn-12)/CH);return wrap(s,max);});
 xl.forEach(function(l){extraBot=Math.max(extraBot,(l.length-1)*LH);});
 // rótulos de valor (barras do fluxo): giram -90°
 var rot=[],maxPos=0,maxNeg=0;
 if(c.bars){texts.forEach(function(t){if(t.classList.contains('m')||t===ytitle)return;var y=num(t,'y');if(y>Ho-mb)return;
  var pr=t.previousElementSibling;if(!pr||pr.tagName!=='rect')return;t.textContent=compact(t.textContent);
  var pos=num(t,'y')<num(pr,'y')+num(pr,'height')/2,L=t.textContent.length*CH+8;rot.push([t,pos]);if(pos)maxPos=Math.max(maxPos,L);else maxNeg=Math.max(maxNeg,L);});
  extraTop+=Math.max(0,maxPos-20);extraBot+=maxNeg;}
 if(c.bars){var ml0=0;texts.forEach(function(t){if(!t.classList.contains('m')&&num(t,'y')>Ho-mb&&num(t,'y')<Ho-mb+40&&!t.getAttribute('transform')&&t!==ytitle&&xtitles.indexOf(t)<0)ml0=Math.max(ml0,t.textContent.length);});extraBot+=Math.round(ml0*CH*0.64);}
 var tn=mt+extraTop,bn=mb+extraBot,Hn=Math.round(c.hn+extraTop+extraBot);
 var kx=(Wn-mln-mrn)/(Wo-ml-mr),ky=(Hn-tn-bn)/(Ho-mt-mb);
 var fx=function(x){return x<ml?x-ml+mln:x>Wo-mr?x-(Wo-mr)+(Wn-mrn):mln+(x-ml)*kx;};
 var fy=function(y){return y<mt?y-mt+tn:y>Ho-mb?y-(Ho-mb)+(Hn-bn):tn+(y-mt)*ky;};
 svg._fx=fx;svg._wn=Wn;
 function pt(s){return s.replace(/(-?[\d.]+)[ ,]+(-?[\d.]+)/g,function(_,a,b){return fx(+a).toFixed(1)+(s.indexOf(',')>=0&&/,/.test(_)?',':' ')+fy(+b).toFixed(1);});}
 [].forEach.call(svg.querySelectorAll('*'),function(e){var n=e.tagName;
  if(n==='line'){['x1','x2'].forEach(function(a){e.setAttribute(a,fx(num(e,a)).toFixed(1));});['y1','y2'].forEach(function(a){e.setAttribute(a,fy(num(e,a)).toFixed(1));});}
  else if(n==='circle'){e.setAttribute('cx',fx(num(e,'cx')).toFixed(1));e.setAttribute('cy',fy(num(e,'cy')).toFixed(1));}
  else if(n==='rect'){var x=num(e,'x'),y=num(e,'y'),w=num(e,'width'),h=num(e,'height');e.setAttribute('x',fx(x).toFixed(1));e.setAttribute('y',fy(y).toFixed(1));e.setAttribute('width',Math.max(1,w*kx).toFixed(1));e.setAttribute('height',Math.max(0,h*ky).toFixed(1));}
  else if(n==='path'){e.setAttribute('d',e.getAttribute('d').replace(/([ML])\s*(-?[\d.]+)\s+(-?[\d.]+)/g,function(_,k,a,b){return k+fx(+a).toFixed(1)+' '+fy(+b).toFixed(1);}));}
  else if(n==='polyline'||n==='polygon'){e.setAttribute('points',e.getAttribute('points').trim().split(/\s+/).map(function(p){var q=p.split(',');return fx(+q[0]).toFixed(1)+','+fy(+q[1]).toFixed(1);}).join(' '));}
  else if(n==='text'&&!e.getAttribute('transform')){e.setAttribute('x',fx(num(e,'x')).toFixed(1));e.setAttribute('y',fy(num(e,'y')).toFixed(1));}});
 // título Y: horizontal no topo
 if(ytitle){ytitle.removeAttribute('transform');ytitle.setAttribute('text-anchor','start');ytitle.setAttribute('y',14);setLines(ytitle,topLines,4);ytitle.setAttribute('x',4);}
 // títulos X: quebrados
 xtitles.forEach(function(t,i){var l=xl[i],a=t.getAttribute('text-anchor');var x=(a==='middle')?Wn/2:4;t.setAttribute('x',x);
  t.setAttribute('y',(Hn-6-(l.length-1)*LH));setLines(t,l,x);});
 // rótulos de valor girados
 rot.forEach(function(r){var t=r[0],x=num(t,'x'),y=num(t,'y');t.setAttribute('transform','rotate(-90 '+x+' '+y+')');t.setAttribute('text-anchor',r[1]?'start':'end');t.setAttribute('x',x+4);t.setAttribute('y',y+(r[1]?-1:1));
  // girado: x do texto vira eixo "vertical"; ajusta para centralizar na barra
  t.setAttribute('x',x);t.setAttribute('y',y);t.setAttribute('transform','rotate(-90 '+x+' '+y+') translate(0 4)');});
 if(c.bars){ // rótulos das categorias: giram -40°
  var cats=texts.filter(function(t){return !t.classList.contains('m')&&num(t,'y')>fy(Ho-mb)&&t!==ytitle&&xtitles.indexOf(t)<0;});
  cats.forEach(function(t){var x=num(t,'x'),y=num(t,'y');t.setAttribute('text-anchor','end');t.setAttribute('transform','rotate(-40 '+x+' '+y+')');t.setAttribute('x',x+6);});}
 // rótulos de bins (b-svg): menos rótulos, 1 a cada k
 if(c.binlab){var bl=texts.filter(function(t){var y=num(t,'y');return t.getAttribute('text-anchor')==='middle'&&y>fy(Ho-mb)+20&&xtitles.indexOf(t)<0;});
  var step=Math.ceil(((bl.length/2)*50)/(Wn-mln-mrn));if(step>1){bl.forEach(function(t,i){var k=Math.floor(i/2);if(k%step)t.parentNode.removeChild(t);});}}
 svg.setAttribute('viewBox','0 0 '+Wn+' '+Hn);svg.classList.add('mob');
 }finally{ if(svg._mo)svg._mo.takeRecords(); busy=false;}
}
function init(id){var svg=$(id);if(!svg)return;svg._ho=CFG[id].Ho;
 var mo=new MutationObserver(function(){if(busy)return;svg._orig=svg.innerHTML;apply(svg);});svg._mo=mo;
 mo.observe(svg,{childList:true});
 if(svg.innerHTML.trim()){svg._orig=svg.innerHTML;apply(svg);}
 if(window.ResizeObserver){new ResizeObserver(function(es){var w=es[0].contentRect.width;if(w<=0)return;if(MQ.matches){if(!svg.classList.contains('mob')||Math.abs((w-2)-svg._wn)>3)apply(svg);}else if(svg.classList.contains('mob'))apply(svg);}).observe(svg);}
}
Object.keys(CFG).forEach(init);
(MQ.addEventListener?MQ.addEventListener('change',function(){Object.keys(CFG).forEach(function(i){var s=$(i);if(s)apply(s);});}):0);

// ---- toque: tooltip fixo em baixo
function mm(target,t){target.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,cancelable:true,clientX:t.clientX,clientY:t.clientY}));}
function nearest(svg,sel,t){var best=null,bd=1e9;[].forEach.call(svg.querySelectorAll(sel),function(e){var r=e.getBoundingClientRect();if(!r.width&&!r.height)return;
  var inside=t.clientX>=r.left&&t.clientX<=r.right,d=inside?0:Math.min(Math.abs(t.clientX-r.left),Math.abs(t.clientX-r.right));if(sel.indexOf('circle')>=0)d=Math.abs(t.clientX-(r.left+r.width/2))+Math.abs(t.clientY-(r.top+r.height/2))*0.15;
  if(d<bd){bd=d;best=e;}});return best;}
function fixCursors(){['c-cur2','c-cur3','c-cur4'].forEach(function(id){var el=$(id);if(!el)return;var s=el.ownerSVGElement;if(!s||!s._fx)return;var x=s._fx(num(el,'x1'));el.setAttribute('x1',x);el.setAttribute('x2',x);});}
['c-svg2','c-svg3','c-svg4'].forEach(function(id){var s=$(id);if(!s)return;
 s.addEventListener('mousemove',function(){if(MQ.matches)fixCursors();});
 var h=function(e){if(!MQ.matches)return;var t=e.touches[0];if(t)mm(s,t);};
 s.addEventListener('touchstart',h,{passive:true});s.addEventListener('touchmove',h,{passive:true});
 s.addEventListener('touchend',function(e){if(MQ.matches&&e.cancelable)e.preventDefault();});});
[['t-svg','circle[data-i]'],['as-svg','circle[data-i]'],['b-svg','rect[data-b]']].forEach(function(p){var s=$(p[0]);if(!s)return;
 var h=function(e){if(!MQ.matches)return;var t=e.touches[0];if(!t)return;var el=nearest(s,p[1],t);if(el)mm(el,t);};
 s.addEventListener('touchstart',h,{passive:true});s.addEventListener('touchmove',h,{passive:true});
 s.addEventListener('touchend',function(e){if(MQ.matches&&e.cancelable)e.preventDefault();});});
document.addEventListener('touchstart',function(e){if(!MQ.matches)return;var tp=$('ttp');if(!tp||tp.hidden)return;if(e.target.closest&&e.target.closest('svg.sv'))return;
 tp.hidden=true;['c-cur2','c-cur3','c-cur4'].forEach(function(i){var el=$(i);if(el)el.style.display='none';});},{passive:true});

// ---- texto de ajuda: toque em vez de mouse
function tx(){if(!MQ.matches)return;[].forEach.call(document.querySelectorAll('#p-fechamento .sub'),function(p){var t=p.textContent;
  var n=t.replace('Passe o mouse sobre o gráfico para ver os valores exatos.','Toque e arraste sobre o gráfico para ver os valores exatos.').replace('Hover over the chart to see exact values.','Touch and drag on the chart to see exact values.');if(n!==t&&p.childNodes.length===1)p.textContent=n;});}
tx();setTimeout(tx,1500);
[].forEach.call(document.querySelectorAll('#p-fechamento .sub'),function(p){new MutationObserver(tx).observe(p,{childList:true,characterData:true,subtree:true});});
// ---- tabela de faixas -> cartões (rótulos por célula)
var tab=$('c-tab');
if(tab){var lab=function(){var hs=[].map.call(tab.querySelectorAll('thead th'),function(h){return h.textContent;});
  if(!hs.length)return;[].forEach.call(tab.querySelectorAll('tbody tr'),function(tr){[].forEach.call(tr.querySelectorAll('td'),function(td,i){td.setAttribute('data-label',hs[i+1]||'');});});};
 new MutationObserver(function(){lab();}).observe(tab,{childList:true});lab();}
})();
