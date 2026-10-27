(function(){
var MQ=window.matchMedia('(max-width:700px)');
var ESS={'f-tab':['dL','dF','dM','dC'],'a-tab':['ab1p','ab2p','dab','dAb']};
var ESSIDX={'b-tab':[0,2,3,6]};
var PCT={pL1:1,pL2:1,dpL:1,pF1:1,pF2:1,dpF:1,dpM:1,pO1:1,pC:1,dpBN:1,dpBN2:1,ab1p:1,ab2p:1,dab:1,pAb:1};
var opened={};
function T(s){try{return window.__LANG==='en'&&window.__tr?window.__tr(s):s;}catch(e){return s;}}
function clean(s){return (s||'').replace(/[▴▾]/g,'').replace(/\s+/g,' ').trim();}

function decorate(tab){
 var id=tab.id,head=tab.querySelectorAll('thead th'),labels=[],ids=[];
 for(var i=1;i<head.length;i++){var th=head[i];ids.push(th.dataset.id||'');
  var l=clean(th.textContent);if(PCT[th.dataset.id])l+=' %';labels.push(l);}
 var ess=ESS[id]||null,idx=ESSIDX[id]||null;
 var any=ess&&ids.some(function(x){return ess.indexOf(x)>=0;});
 tab.querySelectorAll('tbody tr').forEach(function(tr){
  var tds=tr.querySelectorAll('td'),nes=0,th=tr.querySelector('th');
  tds.forEach(function(td,j){
   td.setAttribute('data-l',labels[j]||'');
   var e;
   if(idx)e=idx.indexOf(j)>=0;
   else if(any)e=ess.indexOf(ids[j])>=0;
   else e=j<4;
   td.classList.toggle('es',e);if(!e)nes++;});
  var old=th&&th.querySelector('.mx');if(old)old.remove();
  if(th&&nes>0){
   var key=id+'|'+clean(th.textContent);
   var b=document.createElement('button');b.type='button';b.className='mx';b.setAttribute('aria-expanded',opened[key]?'true':'false');
   b.textContent=opened[key]?T('Menos'):T('Detalhes');b.dataset.key=key;th.appendChild(b);
   tr.classList.toggle('xp',!!opened[key]);}
 });
}
function sortbar(tab){
 var wrap=tab.closest('.tw'),id=tab.id;
 var bar=document.getElementById('sb-'+id);
 if(!bar){bar=document.createElement('div');bar.id='sb-'+id;bar.className='sortbar';
  bar.innerHTML='<label>'+'<span class="sbl"></span><select></select></label><button type="button" class="sbd" aria-label="Crescente/decrescente">⇅</button>';
  wrap.parentNode.insertBefore(bar,wrap);
  bar.querySelector('select').addEventListener('change',function(e){
   var v=e.target.value,th=tab.querySelector('thead th[data-s="'+v+'"]');
   if(!th)return;if(/[▴▾]/.test(th.textContent))return;th.click();});
  bar.querySelector('.sbd').addEventListener('click',function(){
   var th=Array.prototype.filter.call(tab.querySelectorAll('thead th[data-s]'),function(t){return /[▴▾]/.test(t.textContent);})[0];if(th)th.click();});}
 var sel=bar.querySelector('select'),ths=tab.querySelectorAll('thead th[data-s]'),cur='',h='';
 ths.forEach(function(th){var l=clean(th.textContent);if(PCT[th.dataset.id])l+=' %';
  if(/[▴▾]/.test(th.textContent))cur=th.dataset.s;
  h+='<option value="'+th.dataset.s+'">'+(th.dataset.s==='nome'?T('Nome'):l)+'</option>';});
 if(sel.innerHTML!==h)sel.innerHTML=h;sel.value=cur||'nome';
 bar.querySelector('.sbl').textContent=T('Ordenar por');
}
var busy=false,tmr={};
function refresh(tab){
 if(busy)return;busy=true;
 try{decorate(tab);if(tab.id!=='b-tab')sortbar(tab);}catch(e){}
 busy=false;
}
function watch(id){
 var tab=document.getElementById(id);if(!tab)return;
 var mo=new MutationObserver(function(){
  if(busy)return;clearTimeout(tmr[id]);tmr[id]=setTimeout(function(){mo.disconnect();refresh(tab);mo.observe(tab,{childList:true,subtree:true,characterData:true});},30);});
 mo.observe(tab,{childList:true,subtree:true,characterData:true});
 refresh(tab);
 tab.addEventListener('click',function(e){
  var b=e.target.closest('.mx');
  if(b){var tr=b.closest('tr'),k=b.dataset.key,o=!opened[k];opened[k]=o;tr.classList.toggle('xp',o);
   b.setAttribute('aria-expanded',o?'true':'false');b.textContent=T(o?'Menos':'Detalhes');e.stopPropagation();return;}
  if(!MQ.matches)return;
  if(e.target.closest('.tg'))return;
  var th=e.target.closest('tbody th');if(th){var tg=th.querySelector('.tg[data-k]');if(tg)tg.click();}
 },true);
}
['f-tab','a-tab','b-tab'].forEach(watch);

/* painel de colunas como bottom-sheet */
['f-cols','a-cols'].forEach(function(id){
 var d=document.getElementById(id);if(!d)return;
 var body=d.querySelector('div');
 function addClose(){
  if(!body.querySelector('.colbox')||body.querySelector('.sheetx'))return;
  var box=body.querySelector('.colbox');
  var h=document.createElement('div');h.className='sheetx';
  h.innerHTML='<strong class="sht"></strong><button type="button" class="shc"></button>';
  h.querySelector('.sht').textContent=T('Colunas a mostrar');h.querySelector('.shc').textContent=T('Aplicar');
  h.querySelector('.shc').addEventListener('click',function(){d.open=false;});
  box.insertBefore(h,box.firstChild);
 }
 new MutationObserver(addClose).observe(body,{childList:true});addClose();
 d.addEventListener('click',function(e){if(e.target===d)d.open=false;});
 d.addEventListener('toggle',function(){document.documentElement.classList.toggle('sheet-open',!!document.querySelector('details.cols[open]')&&MQ.matches);});
 document.addEventListener('keydown',function(e){if(e.key==='Escape')d.open=false;});
});
window.addEventListener('pagehide',function(){});
/* rerender de idioma: reaplicar rótulos */
var rr=window.__rerender;
if(rr)window.__rerender=function(){rr.apply(this,arguments);setTimeout(function(){['f-tab','a-tab','b-tab'].forEach(function(i){var t=document.getElementById(i);if(t)refresh(t);});},60);};
})();
