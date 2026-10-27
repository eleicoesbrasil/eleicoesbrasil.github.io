<script>
(function(){
var $=function(i){return document.getElementById(i);};
var LOC=function(){return window.__LOC||'pt-BR';};
function fm(n){return Math.round(n).toLocaleString(LOC());}
function p1(x){return x.toFixed(1).replace('.',(window.__DEC||','))+'%';}
var REG={Norte:['AC','AP','AM','PA','RO','RR','TO'],Nordeste:['AL','BA','CE','MA','PB','PE','PI','RN','SE'],'Centro-Oeste':['DF','GO','MT','MS'],Sudeste:['ES','MG','RJ','SP'],Sul:['PR','RS','SC']};
var DS=[['2026_2t','2026 · 2º turno'],['2026_1t','2026 · 1º turno'],['2022_2t','2022 · 2º turno'],['2022_1t','2022 · 1º turno']];
var CACHE={},D=null,inited=false,chosen=null,STEPS=[0,1,2,3,5,10,15,30,60];
var CAND={'2026_1t':'Flávio Bolsonaro','2026_2t':'Flávio Bolsonaro','2022_1t':'Jair Bolsonaro','2022_2t':'Jair Bolsonaro'};
var NAMES={'2026_1t':['Lula','Flávio Bolsonaro'],'2026_2t':['Lula','Flávio Bolsonaro'],'2022_1t':['Lula','Jair Bolsonaro'],'2022_2t':['Lula','Jair Bolsonaro']};
function base(){var s=document.querySelector('script[data-base]');return (window.__DADOS_BASE||'../../dados/');}
function msg(t){$('cb-nota').textContent=t;}
function load(key,cb){ if(CACHE[key]){cb(CACHE[key]);return;} msg('Carregando dados do conjunto (uma vez só)…'); $('cb-svg').style.opacity='.4';
 fetch(base()+'barras/'+key+'.json').then(function(r){if(!r.ok)throw 0;return r.json();}).catch(function(){return fetch('dados/barras/'+key+'.json').then(function(r){if(!r.ok)throw 0;return r.json();});}).then(function(d){
   d.uf=d.zonas.map(function(z){return z[0];}); CACHE[key]=d; $('cb-svg').style.opacity=''; cb(d);
 }).catch(function(){msg('Dados deste conjunto ainda não publicados.');$('cb-svg').innerHTML='';$('cb-svg').style.opacity='';}); }
function opts(sel,arr,keep){var v=sel.value;sel.innerHTML='';arr.forEach(function(a){var o=document.createElement('option');o.value=a[0];o.textContent=a[1];sel.appendChild(o);});if(keep&&arr.some(function(a){return a[0]===v;}))sel.value=v;}
function zonSel(){ // índices de zona que entram no recorte
 var e=$('cb-esc').value,Z=D.zonas,out=[],i;
 if(e==='br'){for(i=0;i<Z.length;i++)out.push(i);return out;}
 if(e==='reg'){var l=REG[$('cb-reg').value]||[];for(i=0;i<Z.length;i++)if(l.indexOf(Z[i][0])>=0)out.push(i);return out;}
 var u=$('cb-uf').value; if(e==='uf'){for(i=0;i<Z.length;i++)if(Z[i][0]===u)out.push(i);return out;}
 var mun=$('cb-mun').value.trim().toLowerCase(); for(i=0;i<Z.length;i++)if(Z[i][0]===u&&Z[i][1].toLowerCase()===mun&&(e==='mun'||String(Z[i][2])===$('cb-zon').value))out.push(i);return out;}
function fillMun(){var u=$('cb-uf').value,seen={},dl=$('cb-muns');dl.innerHTML='';D.zonas.forEach(function(z){if(z[0]===u&&!seen[z[1]]){seen[z[1]]=1;var o=document.createElement('option');o.value=z[1];dl.appendChild(o);}});}
function fillZon(){var u=$('cb-uf').value,m=$('cb-mun').value.trim().toLowerCase(),s={};D.zonas.forEach(function(z){if(z[0]===u&&z[1].toLowerCase()===m)s[z[2]]=1;});opts($('cb-zon'),Object.keys(s).map(Number).sort(function(a,b){return a-b;}).map(function(z){return [String(z),'Zona '+z];}),true);}
function vis(){var e=$('cb-esc').value;$('cb-l-reg').hidden=e!=='reg';$('cb-l-uf').hidden=!(e==='uf'||e==='mun'||e==='zon');$('cb-l-mun').hidden=!(e==='mun'||e==='zon');$('cb-l-zon').hidden=e!=='zon';}
function inWin(m,k,modo){return modo==='c'?m<=k:modo==='i'?m===k:m>k;}
function sums(){var Z=new Set(zonSel()),k=+$('cb-k').value,modo=$('cb-modo').value,b=D.bmin,t={n:0,L:0,F:0,O:0,B:0,N:0},a={n:0,L:0,F:0,O:0,B:0,N:0},i,z;
 for(i=0;i<D.z.length;i++){z=D.z[i];if(!Z.has(z))continue;var m=D.m[i]+b;
  a.n+=D.n[i];a.L+=D.L[i];a.F+=D.F[i];a.O+=D.O[i];a.B+=D.B[i];a.N+=D.N[i];
  if(inWin(m,k,modo)){t.n+=D.n[i];t.L+=D.L[i];t.F+=D.F[i];t.O+=D.O[i];t.B+=D.B[i];t.N+=D.N[i];}}
 return {w:t,a:a,k:k,modo:modo};}
function desc(k,modo){var s=function(x){return (x>0?'+':'')+x;};return modo==='c'?'urnas fechadas até '+s(k)+' min':modo==='i'?'urnas fechadas no minuto '+s(k):'urnas fechadas depois de '+s(k)+' min';}
function draw(){ if(!D)return; var S=sums(),key=$('cb-ds').value,nm=NAMES[key],all=$('cb-base').value==='t';
 var nr=window.innerWidth<=700,cats=[[nm[0],'L','var(--lula)'],[nr?nm[1].split(' ')[0]:nm[1],'F','var(--flavio)'],['Outros','O','var(--outros)']]; if(all){cats.push(['Brancos','B','var(--bn)']);cats.push(['Nulos','N','var(--abs)']);}
 var tot=function(o){return cats.reduce(function(s,c){return s+o[c[1]];},0);},tw=tot(S.w),ta=tot(S.a);
 $('cb-kv').textContent=(S.k>0?'+':'')+S.k+' min';
 $('cb-leg').innerHTML='<span><i style="background:var(--fg);opacity:.85"></i>Urnas selecionadas</span><span><i style="background:none;border:2px solid var(--fg)"></i>Todas as urnas do recorte (referência)</span>';
 var sv=$('cb-svg'),nar=window.innerWidth<=700,W=nar?Math.max(300,Math.round(sv.getBoundingClientRect().width)||340):1000,H=nar?360:380,fs=nar?12:13,m={l:nar?44:60,r:nar?8:20,t:30,b:70}; sv.setAttribute('viewBox','0 0 '+W+' '+H),pw=W-m.l-m.r,ph=H-m.t-m.b,mx=0;
 cats.forEach(function(c){mx=Math.max(mx,tw?S.w[c[1]]/tw:0,ta?S.a[c[1]]/ta:0);}); mx=Math.min(1,Math.ceil((mx*100+4)/10)*10/100)||1;
 var s='',g;for(g=0;g<=4;g++){var v=mx*g/4,y=m.t+ph*(1-g/4);s+='<line x1="'+m.l+'" x2="'+(W-m.r)+'" y1="'+y+'" y2="'+y+'" stroke="var(--line)"/><text class="m" font-size="'+fs+'" x="'+(m.l-6)+'" y="'+(y+4)+'" text-anchor="end">'+Math.round(v*100)+'%</text>';}
 var bw=pw/cats.length;
 cats.forEach(function(c,i){var vw=tw?S.w[c[1]]/tw:0,va=ta?S.a[c[1]]/ta:0,x=m.l+i*bw+bw*.18,w=bw*.64,h=ph*vw/mx,ha=ph*va/mx;
  s+='<rect x="'+x+'" y="'+(m.t+ph-h)+'" width="'+w+'" height="'+h+'" fill="'+c[2]+'" opacity=".85"/>';
  s+='<rect x="'+x+'" y="'+(m.t+ph-ha)+'" width="'+w+'" height="'+ha+'" fill="none" stroke="var(--fg)" stroke-width="2" stroke-dasharray="5 3"/>';
  s+='<text class="m" font-size="'+fs+'" x="'+(x+w/2)+'" y="'+(m.t+ph-Math.max(h,ha)-8)+'" text-anchor="middle" font-weight="600">'+(tw?p1(vw*100):'—')+'</text>';
  s+='<text class="m" font-size="'+fs+'" x="'+(x+w/2)+'" y="'+(H-m.b+18)+'" text-anchor="middle">'+c[0]+'</text><text class="m" font-size="'+fs+'" x="'+(x+w/2)+'" y="'+(H-m.b+34)+'" text-anchor="middle" opacity=".7">'+(nar?fm(S.w[c[1]]/1000)+' mil':fm(S.w[c[1]])+' votos')+'</text>';});
 $('cb-svg').innerHTML=s;
 var pct=S.a.n?S.w.n/S.a.n*100:0;
 msg(S.w.n?fm(S.w.n)+' urnas selecionadas ('+p1(pct)+' das '+fm(S.a.n)+' do recorte), '+desc(S.k,S.modo)+' após as 17h de Brasília; '+fm(tw)+' votos nas barras. A linha tracejada é o resultado de todas as urnas do recorte.':'Nenhuma urna do recorte se encaixa nesse critério.');}
function chips(){var h='';STEPS.forEach(function(k){h+='<button type="button" data-k="'+k+'">+'+k+'</button>';});
 h+='<button type="button" data-p="c15">Até 15</button><button type="button" data-p="a15">Apenas após 15</button>';$('cb-chips').innerHTML=h;}
function setK(k){k=Math.max(+$('cb-k').min,Math.min(+$('cb-k').max,k));$('cb-k').value=k;draw();}
function setDs(){var key=$('cb-ds').value;load(key,function(d){D=d;opts($('cb-uf'),Object.keys(REG).reduce(function(a,r){return a.concat(REG[r]);},[]).sort().map(function(u){return [u,u];}),true);fillMun();fillZon();draw();});}
window.__barsInit=function(){ if(inited){draw();return;} inited=true;
 opts($('cb-ds'),DS,false); opts($('cb-reg'),Object.keys(REG).map(function(r){return [r,r];}),false); chips();
 $('cb-ds').addEventListener('change',setDs);
 ['cb-esc','cb-reg','cb-uf','cb-zon','cb-base','cb-modo'].forEach(function(i){$(i).addEventListener('change',function(){vis();if(i==='cb-uf'&&D){fillMun();$('cb-mun').value='';fillZon();}draw();});});
 $('cb-mun').addEventListener('input',function(){fillZon();draw();});
 $('cb-k').addEventListener('input',draw);$('cb-m').onclick=function(){setK(+$('cb-k').value-1);};$('cb-p').onclick=function(){setK(+$('cb-k').value+1);};
 $('cb-chips').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;if(b.dataset.p==='c15'){$('cb-modo').value='c';setK(15);}else if(b.dataset.p==='a15'){$('cb-modo').value='a';setK(15);}else setK(+b.dataset.k);});
 vis(); setDs();};
var __oldClose=window.__closeInit;window.__closeInit=function(){if(__oldClose)__oldClose.apply(this,arguments);window.__barsInit();};
window.__barsRedraw=function(){ if(inited)draw(); };
})();
</script>
