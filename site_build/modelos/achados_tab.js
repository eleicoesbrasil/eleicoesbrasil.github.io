<script>
/* Aba "Achados": cartões ordenados com relações entre alvos eleitorais e preditores municipais.
   Dados: dados/achados.json (contrato em dados_externos/CONTRATO_ACHADOS.md) + dados/ext/municipios.json (só o campo vars, para rótulos),
   ambos carregados sob demanda ao abrir a aba. API: window.__achInit. Textos dinâmicos via S(pt,en) com window.__LANG; estáticos em i18n_extra_achados.py. */
(function(){
var root=document.getElementById('ach-root');if(!root)return;
function $(i){return document.getElementById(i);}
function en(){return window.__LANG==='en';}
function S(p,e){return en()?e:p;}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function base(){return window.__DADOS_BASE||'../../dados/';}
function getJSON(name){return fetch(base()+name).then(function(r){if(!r.ok)throw 0;return r.json();}).catch(function(){return fetch('dados/'+name).then(function(r){if(!r.ok)throw 0;return r.json();});});}
var A=null,VARS={},AL={},loadTried=false,labTried=false,shown=15,PAGE=15,dirty=false,list=[],tmp=null;
var ST={alvo:'',dir:'',q:'',ord:'pt',busca:'',rob:false};
function nf(v,d,mn){return v.toLocaleString(window.__LOC||'pt-BR',{minimumFractionDigits:mn===undefined?d:mn,maximumFractionDigits:d});}
function fr(r){return r==null||!isFinite(r)?'–':(r>=0?'+':'−')+nf(Math.abs(r),2,2);}
function fs(v,d){return v==null||!isFinite(v)?'–':(v<0?'−':'')+nf(Math.abs(v),d===undefined?1:d);}
/* p em notação legível: usa window.__stats.fmtP se existir; senão formata a partir do log10 p. */
function fmtLog(l,pre){
 if(l==null||!isFinite(l))return '–';
 if(window.__stats&&window.__stats.fmtP&&pre==='p'){try{var s=window.__stats.fmtP(l,window.__LANG||'pt');if(typeof s==='string'&&s)return s;}catch(e){}}
 var dec=en()?'.':',';
 if(l<=-300)return pre+' < 1e-300';
 if(l>-3){var p=Math.pow(10,l);return pre+' = '+(p<0.001?'0'+dec+'001':p.toFixed(p<0.01?4:3).replace('.',dec));}
 var e=Math.floor(l),m=Math.pow(10,l-e);if(m>=9.995){m=1;e++;}
 var sup=String(Math.abs(e)).split('').map(function(c){return '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c];}).join('');
 return pre+' ≈ '+m.toFixed(1).replace('.',dec)+'×10'+(e<0?'⁻':'')+sup;}
function fmtQ(q){if(q==null||!isFinite(q))return '–';var l=q<=0?-301:Math.log10(q);return fmtLog(l,'q');}
function logQ(q){return q==null?0:(q<=0?-301:Math.log10(q));}
var RN={'Norte':'North','Nordeste':'Northeast','Centro-Oeste':'Central-West','Sudeste':'Southeast','Sul':'South'},RO=['Norte','Nordeste','Centro-Oeste','Sudeste','Sul'];
function rl(s){return en()&&RN[s]?RN[s]:s;}
/* ---------- rótulos ---------- */
function vlab(k){var v=VARS[k];return v?(en()&&v.en?v.en:v.pt)||k:k;}
function alab(k){var a=AL[k];return a?(en()&&a.en?a.en:a.pt)||k:k;}
function unitOf(k){var v=VARS[k];if(!v||!v.unidade||v.unidade==='-')return '';var u=(en()&&v.unidade_en)?v.unidade_en:v.unidade;return en()&&!v.unidade_en&&/[^\x20-\x7e]/.test(u)?'':u;}
function ppU(alvo){var t=(alvo+' '+(AL[alvo]?AL[alvo].pt:'')).toLowerCase();return /%|abst|comp|plula|padv|pbr|pnu|pct/.test(t)?' pp':'';}
function metaOf(a){var v=VARS[a.preditor],b=[];if(v){var g=en()?(v.grupo_en||v.grupo_pt):v.grupo_pt;if(g)b.push(g);var u=unitOf(a.preditor);if(u)b.push(u);var fo=en()?v.fonte_en:v.fonte;if(fo)b.push(fo);if(v.ano)b.push(v.ano);}
 return b.join(' · ');}
/* ---------- selos ---------- */
function seals(a){var o=[],t=a.tags||[],has=function(x){return t.indexOf(x)>=0;};
 var some=has('some_dentro_uf')||(a.r_dentro_uf!=null&&Math.abs(a.r_dentro_uf)<0.5*Math.abs(a.pearson));
 var poucas=has('poucas_ufs')||(a.p_cluster_log10!=null&&a.p_cluster_log10>-1.3);
 if(has('robusto'))o.push(['ok',S('Robusto','Robust')]);
 else if(has('dentro_uf')&&!some)o.push(['ok',S('Sobrevive dentro da UF','Survives within states')]);
 if(some)o.push(['bad',S('Some dentro da UF','Vanishes within states')]);
 if(poucas)o.push(['warn',S('Depende de poucas UFs','Depends on few states')]);
 return o;}
/* ---------- SVG ---------- */
function wrap(s,n){var w=String(s).split(/\s+/),l=[],c='';w.forEach(function(x){if((c+' '+x).trim().length>n&&c){l.push(c);c=x;}else c=(c+' '+x).trim();});if(c)l.push(c);return l;}
function chartSvg(a,head,cls){
 var W=360,oy=0,P=[];
 if(head){var tl=wrap(en()?(a.texto_en||a.texto_pt):a.texto_pt,38).slice(0,6);tl.forEach(function(s,i){P.push('<text class="h" x="8" y="'+(18+i*17)+'">'+esc(s)+'</text>');});
  var ml=wrap(alab(a.alvo)+' ~ '+vlab(a.preditor),46).slice(0,3);ml.forEach(function(s,i){P.push('<text x="8" y="'+(18+tl.length*17+4+i*15)+'">'+esc(s)+'</text>');});oy=18+tl.length*17+4+ml.length*15+12;}
 var q=a.quintis||{},ya=q.alvo||[],xp=q.preditor||[],H=116,top=oy+34,base_=top+H,vmin=Math.min.apply(null,ya.concat(0)),vmax=Math.max.apply(null,ya.concat(0));
 if(vmax===vmin)vmax=vmin+1;var sc=H/(vmax-vmin),zy=top+(vmax)*sc,bw=44,sl=(W-16)/5,lab=ppU(a.alvo);
 P.push('<line class="ax" x1="8" x2="'+(W-8)+'" y1="'+zy.toFixed(1)+'" y2="'+zy.toFixed(1)+'"/>');
 ya.forEach(function(v,i){var h=Math.abs(v)*sc,x=8+sl*i+(sl-bw)/2,y=v>=0?zy-h:zy;
  P.push('<rect class="b1" x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+bw+'" height="'+Math.max(1,h).toFixed(1)+'" rx="2"/>');
  P.push('<text class="v" text-anchor="middle" x="'+(x+bw/2).toFixed(1)+'" y="'+(v>=0?y-4:y+h+13).toFixed(1)+'">'+fs(v,1)+'</text>');
  P.push('<text text-anchor="middle" x="'+(x+bw/2).toFixed(1)+'" y="'+(base_+18)+'">Q'+(i+1)+'</text>');
  if(xp[i]!=null)P.push('<text text-anchor="middle" x="'+(x+bw/2).toFixed(1)+'" y="'+(base_+34)+'">'+cmp(xp[i])+'</text>');});
 P.push('<text x="8" y="'+(oy+12)+'">'+esc(S('Média do alvo por quintil'+(lab?' (pp)':''),'Target mean by quintile'+(lab?' (pp)':'')))+'</text>');
 var ry=base_+54;P.push('<text x="8" y="'+(ry+8)+'">'+esc(S('r dentro de cada região','r within each region'))+'</text>');ry+=16;
 var rg=a.regioes||{},ks=RO.filter(function(k){return rg[k]!=null;}).concat(Object.keys(rg).filter(function(k){return RO.indexOf(k)<0;})),cx=238,hw=100;
 P.push('<line class="ax" x1="'+cx+'" x2="'+cx+'" y1="'+ry+'" y2="'+(ry+ks.length*20)+'"/>');
 ks.forEach(function(k,i){var r=rg[k],w=Math.abs(r)*hw,y=ry+i*20;
  P.push('<text x="8" y="'+(y+14)+'">'+esc(rl(k))+'</text>');
  P.push('<rect class="'+(r>=0?'b1':'b2')+'" x="'+(r>=0?cx:cx-w).toFixed(1)+'" y="'+(y+3)+'" width="'+Math.max(1,w).toFixed(1)+'" height="14" rx="2"/>');
  P.push('<text class="v" text-anchor="'+(r>=0?'start':'end')+'" x="'+(r>=0?cx+w+4:cx-w-4).toFixed(1)+'" y="'+(y+14)+'">'+fr(r)+'</text>');});
 var Ht=ry+ks.length*20+8;
 return '<svg class="ach-sv'+(cls?' '+cls:'')+'" viewBox="0 0 '+W+' '+Ht+'" width="'+W+'" height="'+Ht+'" role="img" aria-label="'+esc(S('Quintis e regiões: ','Quintiles and regions: ')+alab(a.alvo)+' ~ '+vlab(a.preditor))+'" xmlns="http://www.w3.org/2000/svg">'+P.join('')+'</svg>';}
function cmp(v){var a=Math.abs(v);if(a>=1e6)return nf(v/1e6,1)+'M';if(a>=1e4)return nf(v/1e3,0)+'k';if(a>=1000)return nf(v,0);return nf(v,a>=100?0:a>=10?1:2,0);}
/* ---------- cartões ---------- */
function canApply(){return typeof window.__cruzApply==='function';}
function card(a,i){
 var s=seals(a),ef=a.efeito_pp||{},pp=ppU(a.alvo),ic=ef.dif_ic||[],u=unitOf(a.preditor);
 var txt=en()?(a.texto_en||a.texto_pt):a.texto_pt,al=en()?(a.alerta_en||a.alerta_pt):a.alerta_pt;
 var h='<article class="ach-card" data-i="'+esc(a.id)+'"><div class="ach-top"><span class="ach-rk">#'+(i+1)+'</span><div><p class="ach-txt">'+esc(txt)+'</p><p class="ach-meta">'+esc(alab(a.alvo))+' ~ '+esc(vlab(a.preditor))+(metaOf(a)?' · '+esc(metaOf(a)):'')+'</p></div></div>';
 if(s.length)h+='<div class="ach-seals">'+s.map(function(x){return '<span class="ach-seal '+x[0]+'">'+esc(x[1])+'</span>';}).join('')+'</div>';
 if(al)h+='<p class="ach-alert">'+esc(al)+'</p>';
 h+='<div class="ach-eff"><b>'+(ef.dif>=0?'+':'−')+nf(Math.abs(ef.dif||0),1)+pp+'</b><span>'+esc(S('entre o 1º e o 5º quintil: ','between 1st and 5th quintile: '))+fs(ef.q1,1)+' → '+fs(ef.q5,1)+(ic.length===2?' · '+esc(S('IC95% ','95% CI '))+fs(ic[0],1)+' '+esc(S('a','to'))+' '+fs(ic[1],1):'')+'</span></div>';
 h+='<dl class="ach-dl"><div><dt>'+esc(S('r de Pearson (IC95%)','Pearson r (95% CI)'))+'</dt><dd>'+fr(a.pearson)+(a.ci?' ('+fr(a.ci[0])+' '+esc(S('a','to'))+' '+fr(a.ci[1])+')':'')+'</dd></div>'
  +'<div><dt>'+esc(S('Spearman (ρ)','Spearman (ρ)'))+'</dt><dd>'+fr(a.spearman)+'</dd></div>'
  +'<div><dt>'+esc(S('r ponderado (por eleitores)','Weighted r (by voters)'))+'</dt><dd>'+fr(a.r_ponderado)+'</dd></div>'
  +'<div><dt>'+esc(S('r dentro da UF','r within state'))+'</dt><dd>'+fr(a.r_dentro_uf)+'</dd></div>'
  +'<div><dt>'+esc(S('p (ingênuo)','p (naïve)'))+'</dt><dd>'+esc(fmtLog(a.p_log10,'p'))+'</dd></div>'
  +'<div><dt>'+esc(S('p robusto a clusters (UF)','Cluster-robust p (state)'))+'</dt><dd>'+esc(fmtLog(a.p_cluster_log10,'p'))+'</dd></div>'
  +'<div><dt>'+esc(S('q (Benjamini–Hochberg)','q (Benjamini–Hochberg)'))+'</dt><dd>'+esc(fmtQ(a.q_bh))+'</dd></div>'
  +'<div><dt>n</dt><dd>'+nf(a.n||0,0)+' '+esc(S('municípios','municipalities'))+'</dd></div></dl>';
 h+='<figure class="ach-fig"><p class="ach-cap">'+esc(S('Barras: média do alvo em cada quintil do preditor (Q1 menor, Q5 maior). Abaixo, mediana do preditor'+(u?' ('+u+')':'')+'.','Bars: target mean in each predictor quintile (Q1 lowest, Q5 highest). Below, predictor median'+(u?' ('+u+')':'')+'.'))+'</p>'+chartSvg(a,false)+'</figure>';
 h+='<div class="ach-acts">'+(canApply()?'<button type="button" class="ach-btn" data-act="cruz" data-i="'+esc(a.id)+'">'+esc(S('Abrir no Cruzamento','Open in Cross-tab'))+'</button>':'')
  +(window.__plotTools&&window.__plotTools.svgFor?'<button type="button" class="ach-btn" data-act="svg" data-i="'+esc(a.id)+'">'+esc(S('Baixar SVG do cartão','Download card SVG'))+'</button>':'')+'</div></article>';
 return h;}
/* ---------- filtro e render ---------- */
function filtered(){
 var b=ST.busca.trim().toLowerCase(),f=A.achados.filter(function(a){
  if(ST.alvo&&a.alvo!==ST.alvo)return false;
  if(ST.dir==='pos'&&!(a.pearson>0))return false;if(ST.dir==='neg'&&!(a.pearson<0))return false;
  if(ST.rob&&(a.tags||[]).indexOf('robusto')<0)return false;
  if(ST.q&&!(logQ(a.q_bh)<=Math.log10(+ST.q)))return false;
  if(b){var v=VARS[a.preditor]||{},hay=(a.preditor+' '+(v.pt||'')+' '+(v.en||'')+' '+(v.grupo_pt||'')+' '+(v.grupo_en||'')).toLowerCase();if(hay.indexOf(b)<0)return false;}
  return true;});
 var key={pt:function(a){return -(a.pontuacao||0);},r:function(a){return -Math.abs(a.pearson||0);},ef:function(a){return -Math.abs((a.efeito_pp||{}).dif||0);},uf:function(a){return -Math.abs(a.r_dentro_uf||0);}}[ST.ord];
 return f.sort(function(x,y){return key(x)-key(y);});}
function render(){
 if(!A)return;list=filtered();
 $('ach-count').textContent=S('Mostrando '+Math.min(shown,list.length)+' de '+list.length+' achados (de '+nf(A.achados.length,0)+' publicados; varredura de '+nf(A.familia||0,0)+' pares testados).','Showing '+Math.min(shown,list.length)+' of '+list.length+' findings ('+nf(A.achados.length,0)+' published; scan of '+nf(A.familia||0,0)+' tested pairs).');
 var L=$('ach-list');L.innerHTML=list.length?list.slice(0,shown).map(card).join(''):'<p class="ach-status">'+esc(S('Nenhum achado com esses filtros. Afrouxe o limiar de q ou desmarque “Só robustos”.','No findings match these filters. Relax the q threshold or turn off “Robust only”.'))+'</p>';
 var m=$('ach-more');m.hidden=list.length<=shown;m.textContent=S('Mostrar mais ('+(list.length-shown)+' restantes)','Show more ('+(list.length-shown)+' remaining)');
 $('ach-rob').setAttribute('aria-pressed',ST.rob?'true':'false');}
function fillAlvos(){var s=$('ach-alvo'),v=s.value;s.innerHTML='<option value="">'+esc(S('Todos os resultados','All outcomes'))+'</option>'+A.alvos.map(function(a){return '<option value="'+esc(a.k)+'">'+esc(alab(a.k))+'</option>';}).join('');s.value=v||ST.alvo;}
function meth(){var m=en()?(A.metodo_en||A.metodo_pt):A.metodo_pt;$('ach-meth').textContent=(m||'')+(A.gerado?' ('+S('gerado em ','generated ')+A.gerado+')':'');}
function exportSvg(a){
 if(!tmp){tmp=document.createElement('div');tmp.className='ach-tmp';tmp.setAttribute('aria-hidden','true');root.appendChild(tmp);}
 tmp.innerHTML=chartSvg(a,true);var svg=tmp.firstChild,txt;try{txt=window.__plotTools.svgFor(svg);}catch(e){txt=null;}tmp.innerHTML='';if(!txt)return;
 var framed=false;try{framed=window.top!==window.self;}catch(e){framed=true;}
 if(framed&&navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).catch(function(){});return;}
 var bl=new Blob([txt],{type:'image/svg+xml;charset=utf-8'}),u=URL.createObjectURL(bl),l=document.createElement('a');l.href=u;l.download='achado_'+a.id+'_'+a.preditor+'.svg';document.body.appendChild(l);l.click();document.body.removeChild(l);setTimeout(function(){URL.revokeObjectURL(u);},4000);}
function wire(){
 [['ach-alvo','alvo'],['ach-dir','dir'],['ach-q','q'],['ach-ord','ord']].forEach(function(p){$(p[0]).addEventListener('change',function(){ST[p[1]]=this.value;shown=PAGE;render();});});
 var t=0;$('ach-busca').addEventListener('input',function(){var v=this.value;clearTimeout(t);t=setTimeout(function(){ST.busca=v;shown=PAGE;render();},150);});
 $('ach-rob').addEventListener('click',function(){ST.rob=!ST.rob;shown=PAGE;render();});
 $('ach-more').addEventListener('click',function(){shown+=PAGE;render();});
 $('ach-list').addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('button[data-act]');if(!b)return;
  var a=A.achados.filter(function(x){return x.id===b.dataset.i;})[0];if(!a)return;
  if(b.dataset.act==='svg')exportSvg(a);
  else if(b.dataset.act==='cruz'&&canApply()){try{window.__cruzApply({grupoPor:{tipo:'quantis',k:a.preditor,n:5},medidas:[{k:a.alvo,agg:'wmean'}]});}catch(err){}if(window.__show)window.__show('cruzamento');}});}
function setStatus(msg,err){var s=$('ach-status');s.hidden=!msg;s.textContent=msg||'';s.classList.toggle('err',!!err);}
function loadLabels(){if(labTried)return;labTried=true;getJSON('ext/municipios.json').then(function(d){(d.vars||[]).forEach(function(v){VARS[v.k]=v;});if(A)render();}).catch(function(){});}
window.__achInit=function(){
 if(A){if(dirty){dirty=false;fillAlvos();meth();render();}else if(!$('ach-list').children.length)render();loadLabels();return;}
 if(loadTried)return;loadTried=true;
 getJSON('achados.json').then(function(d){
  if(!d||!d.achados||!d.achados.length){setStatus(S('Ainda não há achados publicados para esta versão do painel.','No findings have been published yet for this version of the dashboard.'));root.dataset.ready='empty';return;}
  A=d;(d.alvos||[]).forEach(function(a){AL[a.k]=a;});setStatus('');$('ach-main').hidden=false;fillAlvos();meth();wire();render();root.dataset.ready='1';loadLabels();
 }).catch(function(){setStatus(S('Os achados ainda não foram gerados ou não puderam ser carregados.','The findings have not been generated yet or could not be loaded.'),true);root.dataset.ready='err';loadTried=false;});
};
var rr=window.__rerender;window.__rerender=function(){if(rr)rr.apply(this,arguments);if(!A)return;var p=$('p-achados');if(p&&!p.hidden){fillAlvos();meth();render();}else dirty=true;};
})();
</script>
