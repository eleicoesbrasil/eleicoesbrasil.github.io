(function(){
var NS='http://www.w3.org/2000/svg',T=function(pt,en){return window.__LANG==='en'?en:pt;},bars=[],seq=0;
function slug(s){return (s||'grafico').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)||'grafico';}
function title(el){var n=el.closest('section')||el.parentNode,h=n&&n.querySelector&&n.querySelector('h2,h3');return h?h.textContent:'grafico';}
function isHidden(el){return !(el.offsetParent||el.getClientRects().length);}
var PROPS=['fill','stroke','stroke-width','stroke-dasharray','stroke-linecap','stroke-linejoin','opacity','fill-opacity','stroke-opacity','font-family','font-size','font-weight','font-style','text-anchor','dominant-baseline','letter-spacing'];
function inline(o,c){ // copia estilos calculados (cores já resolvidas, sem var(--x)) para atributos style do clone
 var st=getComputedStyle(o),s='';
 if(st.display==='none'){c.parentNode&&c.parentNode.removeChild(c);return;}
 if(o.tagName!=='svg'||o.parentNode&&o.parentNode.tagName!=='svg'||true){PROPS.forEach(function(p){var v=st.getPropertyValue(p);if(v)s+=p+':'+v+';';});}
 if(c.setAttribute){c.setAttribute('style',s);Array.prototype.slice.call(c.attributes).forEach(function(a){if(a.value.indexOf('var(')>=0)c.removeAttribute(a.name);});}
 var oc=o.children,cc=c.children,i,list=[];for(i=0;i<cc.length;i++)list.push(cc[i]);
 for(i=0;i<oc.length&&i<list.length;i++)inline(oc[i],list[i]);}
function svgText(svg){
 var vb=svg.viewBox&&svg.viewBox.baseVal,W=vb&&vb.width||svg.clientWidth||1000,H=vb&&vb.height||svg.clientHeight||400,cl=svg.cloneNode(true);
 inline(svg,cl);cl.setAttribute('xmlns',NS);cl.setAttribute('width',W);cl.setAttribute('height',H);if(!cl.getAttribute('viewBox'))cl.setAttribute('viewBox','0 0 '+W+' '+H);
 cl.removeAttribute('class');cl.removeAttribute('role');cl.removeAttribute('hidden');
 var bg=getComputedStyle(document.body).backgroundColor,r=document.createElementNS(NS,'rect');r.setAttribute('x',vb?vb.x:0);r.setAttribute('y',vb?vb.y:0);r.setAttribute('width',W);r.setAttribute('height',H);r.setAttribute('fill',bg);cl.insertBefore(r,cl.firstChild);
 var lab=svg.getAttribute('aria-label');if(lab){var t=document.createElementNS(NS,'title');t.textContent=lab;cl.insertBefore(t,cl.firstChild);}
 return '<?xml version="1.0" encoding="UTF-8"?>\n'+new XMLSerializer().serializeToString(cl);}
function canvasText(cv){ // sem versão vetorial: imagem embutida num SVG
 var w=cv.clientWidth||cv.width,h=cv.clientHeight||cv.height;
 return '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="'+NS+'" xmlns:xlink="http://www.w3.org/1999/xlink" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'"><image width="'+w+'" height="'+h+'" href="'+cv.toDataURL('image/png')+'"/></svg>';}
function svgFor(el){ if(el.tagName==='CANVAS'){ if(window.__plotVector&&window.__plotVector[el.id]){var v=window.__plotVector[el.id]();if(v)return v;} return canvasText(el);} return svgText(el);}
function framed(){try{return window.top!==window.self;}catch(e){return true;}}
function copyText(txt,done){
 function fb(){var ta=document.createElement('textarea');ta.value=txt;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');done(true);}catch(e){done(false);}document.body.removeChild(ta);}
 if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(function(){done(true);},fb);else fb();}
function act(el,b,name){
 var txt;try{txt=svgFor(el);}catch(e){flash(b,T('Erro ao gerar','Export failed'));return;}
 if(framed()){copyText(txt,function(ok){flash(b,ok?T('SVG copiado','SVG copied'):T('Não foi possível copiar','Copy failed'));});return;}
 var blob=new Blob([txt],{type:'image/svg+xml;charset=utf-8'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name+'.svg';document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(function(){URL.revokeObjectURL(u);},4000);flash(b,T('SVG baixado','SVG downloaded'));}
function flash(b,t){var o=b.textContent;b.textContent=t;b.classList.add('pt-ok');setTimeout(function(){b.classList.remove('pt-ok');label(b);},1600);}
function label(b){b.textContent=framed()?T('Copiar SVG','Copy SVG'):T('⬇ SVG','⬇ SVG');}
function load(k){try{return +localStorage.getItem(k)||100;}catch(e){return 100;}}
function save(k,v){try{localStorage.setItem(k,v);}catch(e){}}
function attach(el){
 if(el.__pt||el.closest('.pt-bar'))return;
 if(el.tagName==='CANVAS'&&(el.width<150&&el.height<80))return;
 el.__pt=1;var id=el.id||('g'+(++seq)),key='pt-w:'+id,name=slug(title(el))+'_'+slug(id);
 var bar=document.createElement('div');bar.className='pt-bar';bar.setAttribute('role','group');
 bar.innerHTML='<label><span></span><input type="range" min="35" max="100" step="5"><output></output></label><button type="button" class="pt-b"></button>';
 var rg=bar.querySelector('input'),out=bar.querySelector('output'),sp=bar.querySelector('span'),b=bar.querySelector('button');
 function lang(){sp.textContent=T('Largura','Width');rg.setAttribute('aria-label',T('Largura do gráfico','Chart width'));bar.setAttribute('aria-label',T('Ferramentas do gráfico','Chart tools'));b.title=framed()?T('Copia o gráfico como SVG para a área de transferência','Copies the chart as SVG to the clipboard'):T('Baixa o gráfico como arquivo SVG','Downloads the chart as an SVG file');label(b);}
 function apply(v,persist){rg.value=v;out.textContent=v+'%';el.classList.toggle('pt-sized',v<100);el.style.width=v<100?v+'%':'';if(persist)save(key,v);}
 rg.value=load(key);apply(+rg.value,false);lang();
 rg.addEventListener('input',function(){apply(+rg.value,true);window.dispatchEvent(new Event('resize'));});
 b.addEventListener('click',function(){act(el,b,name);});
 el.parentNode.insertBefore(bar,el);bar.__lang=lang;bar.__el=el;bars.push(bar);}
var q=false;
function scan(){q=false;document.querySelectorAll('svg.sv, #p-fluxo canvas, #p-abstencao canvas, #p-fechamento canvas, #p-mapa canvas, #p-secoes canvas').forEach(attach);
 bars.forEach(function(bar){bar.hidden=isHidden(bar.__el);});}
function sched(){if(!q){q=true;requestAnimationFrame(scan);}}
new MutationObserver(sched).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['style','hidden','class']});
['lg-pt','lg-en'].forEach(function(i){var x=document.getElementById(i);if(x)x.addEventListener('click',function(){setTimeout(function(){bars.forEach(function(b){b.__lang();});},0);});});
window.addEventListener('hashchange',sched);document.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('[role=tab]'))setTimeout(sched,50);});
sched();window.__plotTools={scan:scan,svgFor:svgFor};
})();
