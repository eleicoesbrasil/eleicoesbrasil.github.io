<script>
(function(){
var D=__I18N_DATA__;
var PAIRS=D.PAIRS.slice().sort(function(a,b){return b[0].length-a[0].length;});
var RX=D.RX.map(function(r){return [new RegExp(r[0],r[1]),r[2]];});
var lang='pt',orig=new WeakMap(),last=new WeakMap(),aorig=new WeakMap();
var ATTR=['placeholder','aria-label','title'];
function tr(s){var t=s.trim();if(D.EX[t]!==undefined)return s.replace(t,D.EX[t]);
 for(var i=0;i<RX.length;i++)s=s.replace(RX[i][0],RX[i][1]);
 for(var j=0;j<PAIRS.length;j++){if(s.indexOf(PAIRS[j][0])>=0)s=s.split(PAIRS[j][0]).join(PAIRS[j][1]);}
 return s;}
function skip(n){var p=n.parentNode;return !p||p.nodeName==='SCRIPT'||p.nodeName==='STYLE';}
function doText(n){if(lang!=='en'||skip(n))return;var v=n.nodeValue;if(!v||last.get(n)===v)return;
 if(!/[A-Za-zÀ-ú]/.test(v)){return;}
 orig.set(n,v);var t=tr(v);last.set(n,t);if(t!==v)n.nodeValue=t;}
function doAttrs(el){if(lang!=='en'||!el.getAttribute)return;ATTR.forEach(function(a){var v=el.getAttribute(a);if(v===null)return;var o=aorig.get(el)||{};if(o[a]!==undefined&&o['t'+a]===v)return;o[a]=v;var t=tr(v);o['t'+a]=t;aorig.set(el,o);if(t!==v)el.setAttribute(a,t);});}
function walk(root){if(root.nodeType===3){doText(root);return;}if(root.nodeType!==1)return;
 doAttrs(root);var tw=document.createTreeWalker(root,NodeFilter.SHOW_ALL,null);var n;while((n=tw.nextNode())){if(n.nodeType===3)doText(n);else if(n.nodeType===1)doAttrs(n);}}
function restore(){var tw=document.createTreeWalker(document.body,NodeFilter.SHOW_ALL,null),n;while((n=tw.nextNode())){
 if(n.nodeType===3&&orig.has(n)&&last.get(n)===n.nodeValue){n.nodeValue=orig.get(n);last.delete(n);}
 else if(n.nodeType===1){var o=aorig.get(n);if(o){ATTR.forEach(function(a){if(o[a]!==undefined&&n.getAttribute(a)===o['t'+a])n.setAttribute(a,o[a]);});}}}}
var obs=new MutationObserver(function(ms){if(lang!=='en')return;ms.forEach(function(m){
 if(m.type==='childList')m.addedNodes.forEach(walk);
 else if(m.type==='characterData')doText(m.target);
 else if(m.type==='attributes')doAttrs(m.target);});});
obs.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:ATTR});
function setLang(l,persist){
 lang=l;window.__LANG=l;window.__LOC=l==='en'?'en-US':'pt-BR';window.__DEC=l==='en'?'.':',';
 document.documentElement.lang=l==='en'?'en':'pt-BR';
 document.getElementById('lg-pt').setAttribute('aria-pressed',l==='pt'?'true':'false');document.getElementById('lg-en').setAttribute('aria-pressed',l==='en'?'true':'false');
 if(l==='pt')restore();
 if(window.__rerender)window.__rerender();
 if(l==='en')walk(document.body);
 document.title=l==='en'?'2026 Runoff Dashboard':'Painel 2º Turno 2026';
 if(persist){try{localStorage.setItem('lang',l);}catch(e){}}}
document.getElementById('lg-pt').addEventListener('click',function(){setLang('pt',true);});
document.getElementById('lg-en').addEventListener('click',function(){setLang('en',true);});
var saved=null;try{saved=localStorage.getItem('lang');}catch(e){}
window.__setLang=setLang;window.__tr=tr;
setLang(saved==='en'?'en':'pt',false);
})();
</script>
