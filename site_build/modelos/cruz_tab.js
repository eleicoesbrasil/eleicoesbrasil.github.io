<script>
/* Aba "Cruzamento": cruza variáveis externas por município em gráficos de barras (cliente, arrays tipados).
   Dados: dados/ext/municipios.json (contrato em dados_externos/CONTRATO_DADOS.md), carregado sob demanda.
   API: window.__cruzInit (ao abrir a aba). Textos dinâmicos via S(pt,en) com window.__LANG; estáticos via i18n_extra_cruz.py. */
(function(){
var root=document.getElementById('cz-root');if(!root)return;
function $(i){return document.getElementById(i);}
function en(){return window.__LANG==='en';}
function S(p,e){return en()?e:p;}
function MQ(){return window.innerWidth<=700;}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function base(){return window.__DADOS_BASE||'../../dados/';}
var D=null,V=[],KI={},N=0,NC={},CC={},OC={},RGc=null,UFc=null,loadTried=false;
var MAXG=40;
/* ---------------- estado ---------------- */
var C={g:{v:'@reg',m:'q5',cuts:'',wq:false},g2:{v:'@none',m:'q5',cuts:''},lay:'grp',meas:[{v:null,a:'wmean',den:null,mul:100}],w:'',sc:'val',ord:'nat',top:0,ci:true,
 flt:{reg:[],uf:[],porte:'',rng:[]},rkN:20,rkW:false,rkX:true};
var sel={key:null},selR={key:null},M=null,RK={tok:0,res:[],total:0},curMask=null,curW=null,lastW=0,dirtyLang=false,timer=0;
var fav=[];try{fav=JSON.parse(localStorage.getItem('cz_fav')||'[]')||[];}catch(e){fav=[];}
function saveFav(){try{localStorage.setItem('cz_fav',JSON.stringify(fav));}catch(e){}}
/* ---------------- formatação ---------------- */
function nf(v,d,mn){return v.toLocaleString(window.__LOC||'pt-BR',{minimumFractionDigits:mn===undefined?d:mn,maximumFractionDigits:d});}
function fv(v,dec,sum){if(v==null||!isFinite(v))return '–';var a=Math.abs(v),d;dec=dec||0;
 if(sum)d=Math.min(dec,a>=1000?0:dec);else d=a>=1000?Math.min(dec,1):Math.max(dec,a>=100?1:a>=10?1:2);
 return nf(v,Math.min(3,d));}
function cp(v){var a=Math.abs(v),s=v<0?'−':'';if(a>=1e9)return s+nf(a/1e9,1)+S(' bi','B');if(a>=1e6)return s+nf(a/1e6,a>=1e7?0:1)+S(' mi','M');if(a>=1e4)return s+nf(a/1e3,0)+S(' mil','k');
 if(a>=1000)return s+nf(a,0);return s+nf(a,a>=100?0:a>=10?1:2,0);}
function fr(r){return r==null||!isFinite(r)?'–':(r>=0?'+':'−')+nf(Math.abs(r),3);}
/* ---------------- variáveis ---------------- */
var RN={'Norte':'North','Nordeste':'Northeast','Centro-Oeste':'Central-West','Sudeste':'Southeast','Sul':'South'};
function rl(s){return en()&&RN[s]?RN[s]:s;}
var SPN={'@none':['Nenhum (todos os municípios juntos)','None (all municipalities together)'],'@reg':['Região','Region'],'@uf':['UF (estado)','State (UF)'],'@porte_pop':['Porte do município (população)','Municipality size (population)'],'@porte_apt':['Porte do município (eleitorado apto)','Municipality size (eligible voters)']};
function V_(k){return k&&k[0]!=='@'?V[KI[k]]:null;}
function vn(k){if(!k)return '';if(k[0]==='@')return S(SPN[k][0],SPN[k][1]);var v=V_(k);return v?(en()&&v.en?v.en:v.pt):k;}
function vnote(v){return en()?(v.nota_en||v.nota_pt||''):(v.nota_pt||'');}
function fonteOf(v){return en()?(v.fonte_en||''):(v.fonte||'');}
function vgrp(v){return en()?(v.grupo_en||v.grupo_pt||''):(v.grupo_pt||'');}
function isNum(k){var v=V_(k);return !!v&&v.tipo!=='cat';}
function isCat(k){var v=V_(k);return !!v&&v.tipo==='cat';}
function prov(k){var v=V_(k);return !!v&&/provis/i.test((v.nota_pt||'')+' '+(v.nota_en||''));}
function num(k){if(NC[k])return NC[k];var a=D.cols[k]||[],f=new Float64Array(N),i,x;for(i=0;i<N;i++){x=a[i];f[i]=(typeof x==='number'&&isFinite(x))?x:NaN;}return NC[k]=f;}
function cat(k){if(CC[k])return CC[k];var a=D.cols[k]||[],v=V_(k),lab=(v.categorias&&v.categorias.slice())||null,m={},i,x;
 if(!lab){var u={};for(i=0;i<N;i++)if(a[i]!=null)u[a[i]]=1;lab=Object.keys(u).sort();}
 lab.forEach(function(l,j){m[l]=j;});var c=new Int16Array(N);for(i=0;i<N;i++){x=a[i];c[i]=(x!=null&&m[x]!==undefined)?m[x]:-1;}return CC[k]={codes:c,labels:lab};}
function ord(k,arr){if(k&&OC[k])return OC[k];var x=arr||num(k),idx=[],i;for(i=0;i<N;i++)if(x[i]===x[i])idx.push(i);idx.sort(function(a,b){return x[a]-x[b];});var o=Int32Array.from(idx);if(k)OC[k]=o;return o;}
function popVar(){if(KI.censo_pop!==undefined)return 'censo_pop';for(var i=0;i<V.length;i++)if(V[i].tipo!=='cat'&&/^(censo|sidra|ibge)_pop(ulacao)?(_|$)/.test(V[i].k))return V[i].k;return null;}
function aptVar(){var c=['res26_t1_aptos','res26_t2_aptos','res22_t2_aptos','res22_t1_aptos'];for(var i=0;i<c.length;i++)if(KI[c[i]]!==undefined)return c[i];
 for(i=0;i<V.length;i++)if(V[i].tipo!=='cat'&&/aptos$/.test(V[i].k))return V[i].k;return null;}
function weightVars(){var o=[];V.forEach(function(v){if(v.tipo!=='cat'&&(v.papel==='peso'||/^(censo|sidra|ibge)_pop(ulacao)?$/.test(v.k)))o.push(v.k);});return o;}
function initRegions(){var m={},l=[],c=new Int8Array(N),i;for(i=0;i<N;i++){var r=D.reg[i]||'';if(m[r]===undefined){m[r]=l.length;l.push(r);}c[i]=m[r];}
 var pref=['Norte','Nordeste','Centro-Oeste','Sudeste','Sul'],o=l.map(function(_,j){return j;}).sort(function(a,b){var pa=pref.indexOf(l[a]),pb=pref.indexOf(l[b]);return (pa<0?9:pa)-(pb<0?9:pb)||(l[a]<l[b]?-1:1);});
 var re=[];o.forEach(function(j,p){re[j]=p;});RGc={codes:c.map?Int8Array.from(c,function(x){return re[x];}):c,labels:o.map(function(j){return l[j];})};
 var u={};for(i=0;i<N;i++)u[D.uf[i]||'']=1;var ul=Object.keys(u).filter(Boolean).sort(),um={};ul.forEach(function(s,j){um[s]=j;});
 var uc=new Int8Array(N);for(i=0;i<N;i++){var q=um[D.uf[i]];uc[i]=q===undefined?-1:q;}UFc={codes:uc,labels:ul};}
/* ---------------- filtro (máscara) ---------------- */
function porteDef(which){var k=which==='pop'?popVar():aptVar();if(!k)return null;var e=which==='pop'?[5000,10000,20000,50000,100000,500000]:[4000,8000,15000,40000,80000,400000];
 var f=function(x){return x>=1000?nf(x/1000,0)+S(' mil','k'):nf(x,0);},lb=[];
 for(var i=0;i<=e.length;i++)lb.push(i===0?'≤ '+f(e[0]):i===e.length?'> '+f(e[i-1]):f(e[i-1])+'–'+f(e[i]));
 return {k:k,edges:e,labels:lb};}
function bandOf(x,e){var j=0;while(j<e.length&&x>e[j])j++;return j;}
function buildMask(){var m=new Uint8Array(N),i,F=C.flt;m.fill(1);
 if(F.reg.length){var s={};F.reg.forEach(function(r){s[r]=1;});for(i=0;i<N;i++)if(!s[RGc.labels[RGc.codes[i]]])m[i]=0;}
 if(F.uf.length){var u={};F.uf.forEach(function(r){u[r]=1;});for(i=0;i<N;i++)if(m[i]&&!u[D.uf[i]])m[i]=0;}
 if(F.porte!==''){var pd=porteDef('pop')||porteDef('apt');if(pd){var x=num(pd.k),b=+F.porte;for(i=0;i<N;i++)if(m[i]&&!(x[i]===x[i]&&bandOf(x[i],pd.edges)===b))m[i]=0;}}
 F.rng.forEach(function(r){if(!r.v||!isNum(r.v))return;var x=num(r.v),lo=r.min,hi=r.max;
  for(i=0;i<N;i++)if(m[i]){var t=x[i];if(!(t===t)||(lo!=null&&t<lo)||(hi!=null&&t>hi))m[i]=0;}});
 return m;}
function wArr(){if(!C.w||!isNum(C.w))return null;return num(C.w);}
/* ---------------- grupos ---------------- */
function parseCuts(s){if(!s)return [];var p=s.indexOf(';')>=0?s.split(';').map(function(t){return t.replace(',','.');}):s.split(/[\s,]+/);
 return p.map(function(t){return parseFloat(t);}).filter(function(t){return isFinite(t);}).sort(function(a,b){return a-b;}).filter(function(c,i,a){return i===0||c>a[i-1];});}
function rangeFmt(dec){return function(x){var a=Math.abs(x);return a>=1e6?cp(x):a>=1e4?cp(x):nf(x,a>=100?Math.min(dec,0):Math.max(dec,a>=10?1:2));};}
var QP={3:'T',4:'Q',5:'Q',10:'D',20:'V'};
function groups(spec,mask,W){
 var g=new Int16Array(N).fill(-1),k=spec.v,o={g:g,K:1,labels:[],ordered:false,num:null,miss:0,key:k,note:null,cat:false},i;
 if(!k||k==='@none'){for(i=0;i<N;i++)if(mask[i])g[i]=0;o.labels=[{t:S('Todos os municípios','All municipalities')}];o.none=true;return o;}
 if(k==='@reg'||k==='@uf'){var cc=k==='@reg'?RGc:UFc;o.K=cc.labels.length;o.cat=true;o.labels=cc.labels.map(function(l){return {t:k==='@reg'?rl(l):l};});
  for(i=0;i<N;i++)if(mask[i]){if(cc.codes[i]>=0)g[i]=cc.codes[i];else o.miss++;}return o;}
 if(k==='@porte_pop'||k==='@porte_apt'){var pd=porteDef(k==='@porte_pop'?'pop':'apt');if(!pd)return o;var x=num(pd.k);o.K=pd.labels.length;o.ordered=true;o.num=x;o.labels=pd.labels.map(function(l,j){return {t:S('Porte ','Size ')+(j+1),r:l};});
  for(i=0;i<N;i++)if(mask[i]){if(x[i]===x[i])g[i]=bandOf(x[i],pd.edges);else o.miss++;}return o;}
 var v=V_(k);if(!v)return o;
 if(v.tipo==='cat'){var c=cat(k),cnt=new Array(c.labels.length).fill(0);for(i=0;i<N;i++)if(mask[i]&&c.codes[i]>=0)cnt[c.codes[i]]++;
  var idx=cnt.map(function(_,j){return j;}).filter(function(j){return cnt[j]>0;});
  if(idx.length>MAXG){idx.sort(function(a,b){return cnt[b]-cnt[a];});idx=idx.slice(0,MAXG);o.note=S('Há mais de '+MAXG+' categorias; foram mantidas as '+MAXG+' maiores.','There are more than '+MAXG+' categories; the '+MAXG+' largest were kept.');idx.sort(function(a,b){return a-b;});}
  var mp={};idx.forEach(function(j,p){mp[j]=p;});o.K=idx.length;o.cat=true;o.labels=idx.map(function(j){return {t:c.labels[j]};});
  for(i=0;i<N;i++)if(mask[i]){var q=c.codes[i];if(q>=0&&mp[q]!==undefined)g[i]=mp[q];else o.miss++;}return o;}
 var x2=num(k);o.num=x2;o.ordered=true;var cuts,pre;
 if(spec.m==='man'){cuts=parseCuts(spec.cuts);pre=S('F','B');}
 else{var q=+spec.m.slice(1);pre=QP[q]||'Q';var ob=ord(k),xs=[],ws=[],tot=0,w=(spec.wq&&W)?W:null;
  for(var t=0;t<ob.length;t++){i=ob[t];if(!mask[i])continue;var wi=w?w[i]:1;if(!(wi>0))continue;xs.push(x2[i]);ws.push(wi);tot+=wi;}
  cuts=[];var cum=0,j=1;for(t=0;t<xs.length&&j<q;t++){cum+=ws[t];while(j<q&&cum>=tot*j/q-1e-12){cuts.push(xs[t]);j++;}}
  cuts=cuts.filter(function(c2,p,a){return p===0||c2>a[p-1];});
  /* o último corte iguala o máximo: descarta para não criar grupo vazio */
  if(xs.length&&cuts.length&&cuts[cuts.length-1]>=xs[xs.length-1])cuts.pop();}
 o.K=cuts.length+1;var f=rangeFmt(v.dec||0);
 o.labels=[];for(i=0;i<o.K;i++)o.labels.push({t:pre+(i+1),r:o.K===1?S('todos','all'):i===0?'≤ '+f(cuts[0]):i===o.K-1?'> '+f(cuts[i-1]):f(cuts[i-1])+'–'+f(cuts[i])});
 o.cuts=cuts;
 for(i=0;i<N;i++)if(mask[i]){var t2=x2[i];if(t2===t2){var gi=0;while(gi<cuts.length&&t2>cuts[gi])gi++;g[i]=gi;}else o.miss++;}
 return o;}
/* ---------------- agregação ---------------- */
function tcrit(df){var z=1.959964,d=Math.max(1,df);return z+(z*z*z+z)/(4*d)+(5*Math.pow(z,5)+16*z*z*z+3*z)/(96*d*d);}
function measArr(m){if(m.a==='ratio'){if(!m.v||!m.den)return null;var a=num(m.v),b=num(m.den),f=new Float64Array(N),i;for(i=0;i<N;i++)f[i]=(a[i]===a[i]&&b[i]===b[i]&&b[i]!==0)?a[i]/b[i]*m.mul:NaN;return f;}
 return m.v&&isNum(m.v)?num(m.v):null;}
function aggregate(m,G1,G2,mask,W){
 var K1=G1.K,K2=G2?G2.K:1,K=K1*K2,g1=G1.g,g2=G2?G2.g:null,x=null,y=null,i,c;
 var weighted=(m.a==='wmean'||m.a==='wmedian');var w=weighted&&W?W:null;
 if(m.a==='ratio'){if(!m.v||!m.den)return null;x=num(m.v);y=num(m.den);}else{x=measArr(m);if(!x)return null;}
 var n=new Float64Array(K),sw=new Float64Array(K),swx=new Float64Array(K),sw2=new Float64Array(K),sy=new Float64Array(K),lst=(m.a==='median'||m.a==='wmedian')?[]:null;
 if(lst)for(c=0;c<K;c++)lst.push([]);
 for(i=0;i<N;i++){if(!mask[i])continue;var a=g1[i];if(a<0)continue;var b=g2?g2[i]:0;if(b<0)continue;var xv=x[i];if(!(xv===xv))continue;
  var wv=1;if(m.a==='ratio'){wv=1;var yv=y[i];if(!(yv===yv))continue;sy[a*K2+b]+=yv;}else if(w){wv=w[i];if(!(wv>0))continue;}
  c=a*K2+b;n[c]++;sw[c]+=wv;swx[c]+=wv*xv;sw2[c]+=wv*wv;if(lst)lst[c].push(xv,wv);}
 var swd=new Float64Array(K);
 var out=[];
 for(c=0;c<K;c++){var o={n:n[c],v:NaN,se:NaN};
  if(n[c]>0){
   if(m.a==='sum'){o.v=swx[c];}
   else if(m.a==='ratio'){o.v=sy[c]!==0?swx[c]/sy[c]*m.mul:NaN;}
   else if(m.a==='mean'||m.a==='wmean'){o.v=swx[c]/sw[c];}
   else{var L=lst[c],pr=[],t;for(t=0;t<L.length;t+=2)pr.push([L[t],L[t+1]]);pr.sort(function(p,q){return p[0]-q[0];});
    if(m.a==='median'||!w){var h=pr.length;o.v=h%2?pr[(h-1)/2][0]:(pr[h/2-1][0]+pr[h/2][0])/2;}
    else{var tw=0;pr.forEach(function(p){tw+=p[1];});var cu=0;for(t=0;t<pr.length;t++){cu+=pr[t][1];if(cu>=tw/2-1e-12){o.v=(Math.abs(cu-tw/2)<1e-9&&t+1<pr.length)?(pr[t][0]+pr[t+1][0])/2:pr[t][0];break;}}}
    o.mn=swx[c]/sw[c];}
  }
  out.push(o);}
 /* segunda passada: variância para o erro-padrão */
 if(m.a!=='sum'){
  var swr=new Float64Array(K);
  for(i=0;i<N;i++){if(!mask[i])continue;var a2=g1[i];if(a2<0)continue;var b2=g2?g2[i]:0;if(b2<0)continue;var xv2=x[i];if(!(xv2===xv2))continue;c=a2*K2+b2;
   if(m.a==='ratio'){var yv2=y[i];if(!(yv2===yv2)||sy[c]===0)continue;var R=swx[c]/sy[c],d=xv2-R*yv2;swr[c]+=d*d;}
   else{var wv2=w?w[i]:1;if(w&&!(wv2>0))continue;var mm=swx[c]/sw[c];swd[c]+=wv2*(xv2-mm)*(xv2-mm);}}
  for(c=0;c<K;c++){var oo=out[c];if(n[c]<2)continue;
   if(m.a==='ratio'){oo.se=sy[c]!==0?m.mul*Math.sqrt(n[c]/(n[c]-1)*swr[c])/Math.abs(sy[c]):NaN;oo.neff=n[c];}
   else{var neff=sw[c]*sw[c]/sw2[c],s2=swd[c]/sw[c]*(neff>1?neff/(neff-1):1);oo.neff=neff;oo.se=Math.sqrt(s2/neff);if(m.a==='median'||m.a==='wmedian')oo.se*=1.2533;}
   if(isFinite(oo.se))oo.hw=tcrit((oo.neff||n[c])-1)*oo.se;}}
 return out;}
/* contagem e peso total por célula (independe da medida) */
function cellCounts(G1,G2,mask,W){var K2=G2?G2.K:1,K=G1.K*K2,n=new Float64Array(K),w=new Float64Array(K),i;
 for(i=0;i<N;i++){if(!mask[i])continue;var a=G1.g[i];if(a<0)continue;var b=G2?G2.g[i]:0;if(b<0)continue;n[a*K2+b]++;if(W&&W[i]>0)w[a*K2+b]+=W[i];}return {n:n,w:w};}
/* ---------------- modelo do gráfico ---------------- */
var AGN={mean:['média','mean'],wmean:['média ponderada','weighted mean'],median:['mediana','median'],wmedian:['mediana ponderada','weighted median'],sum:['soma','sum'],ratio:['razão de somas','ratio of sums']};
function aggName(a){return S(AGN[a][0],AGN[a][1]);}
function mname(m){if(m.a==='ratio')return (m.v?vn(m.v):'…')+' ÷ '+(m.den?vn(m.den):'…');return vn(m.v);}
function mdec(m){if(m.a==='ratio')return m.mul>=100?1:2;var v=V_(m.v);return v?v.dec||0:0;}
function seriesColor(i,n,ordered){if(ordered&&n>3){var p=n<=1?0:Math.round(100*(1-i/(n-1)));return 'color-mix(in srgb,var(--cz-lo) '+p+'%,var(--cz-hi))';}return 'var(--cz-'+((i%8)+1)+')';}
function build(){
 var mask=buildMask(),W=wArr();curMask=mask;curW=W;var cntMask=0,i;for(i=0;i<N;i++)cntMask+=mask[i];
 var meas=C.meas.filter(function(m){return measArr(m);});
 var out={cntMask:cntMask,warn:[],rows:[],series:[],meas:meas,mask:mask,W:W,empty:null};
 if(!meas.length){out.empty=S('Escolha uma medida para montar o gráfico.','Pick a measure to build the chart.');return out;}
 if(!cntMask){out.empty=S('Nenhum município passa pelos filtros.','No municipality passes the filters.');return out;}
 var G1=groups(C.g,mask,W),G2=(C.g2.v&&C.g2.v!=='@none')?groups(C.g2,mask,W):null;out.G1=G1;out.G2=G2;
 if(G1.note)out.warn.push(G1.note);if(G2&&G2.note)out.warn.push(G2.note);
 if(G1.miss)out.warn.push(S(nf(G1.miss,0)+' município(s) do recorte não têm valor na variável de agrupamento e ficaram fora das barras.',nf(G1.miss,0)+' municipalities in the selection have no value for the grouping variable and are left out.'));
 if(G2&&G2.miss)out.warn.push(S(nf(G2.miss,0)+' município(s) não têm valor no segundo agrupamento e ficaram fora.',nf(G2.miss,0)+' municipalities have no value for the second grouping and are left out.'));
 var useM=G2?[meas[0]]:meas;if(G2&&meas.length>1)out.warn.push(S('Com segundo agrupamento só a 1ª medida é usada.','With a second grouping only the 1st measure is used.'));
 var cc=cellCounts(G1,G2,mask,W),K2=G2?G2.K:1,K1=G1.K;
 var ALL={g:new Int16Array(N),K:1};for(i=0;i<N;i++)ALL.g[i]=mask[i]?0:-1;
 var sers=[];
 useM.forEach(function(m,mi){var a=aggregate(m,G1,G2,mask,W),tot=aggregate(m,ALL,null,mask,W);if(!a)return;
  if(!G2)sers.push({m:m,mi:mi,cells:a.map(function(o,r){return {o:o,r:r};}),tot:tot&&tot[0],name:mname(m)});
  else for(var b=0;b<K2;b++){var cs=[];for(var r=0;r<K1;r++)cs.push({o:a[r*K2+b],r:r,c:r*K2+b});sers.push({m:m,mi:mi,cells:cs,tot:tot&&tot[0],name:(G2.labels[b].t+(G2.labels[b].r?' '+G2.labels[b].r:'')),b:b});}});
 /* linhas = grupos do 1º agrupamento com algum município */
 var rowsAll=[];for(var r=0;r<K1;r++){var n=0,w=0;for(var b2=0;b2<K2;b2++){n+=cc.n[r*K2+b2];w+=cc.w[r*K2+b2];}if(n>0)rowsAll.push({r:r,t:G1.labels[r].t,l2:G1.labels[r].r||'',n:n,w:w});}
 if(!rowsAll.length){out.empty=S('Nenhum município com valor para o agrupamento escolhido.','No municipality has a value for the chosen grouping.');return out;}
 if(useM.length>1&&C.sc==='val'){var mxs=sers.map(function(se){var mx=0;se.cells.forEach(function(c){if(isFinite(c.o.v))mx=Math.max(mx,Math.abs(c.o.v));});return mx;}).filter(function(x){return x>0;});if(mxs.length>1&&Math.max.apply(null,mxs)/Math.min.apply(null,mxs)>20)out.warn.push(S('As medidas estão em escalas muito diferentes; use a escala “% do total” ou “Índice” para compará-las.','The measures are on very different scales; use the “% of total” or “Index” scale to compare them.'));}
 /* normalização */
 sers.forEach(function(s){var tot=0;s.cells.forEach(function(c){if(isFinite(c.o.v))tot+=Math.abs(c.o.v);});
  s.cells.forEach(function(c){var o=c.o;c.raw=o.v;var sc=1;
   if(C.sc==='pct'){sc=tot?100/tot:NaN;}else if(C.sc==='idx'){sc=(s.tot&&isFinite(s.tot.v)&&s.tot.v!==0)?100/s.tot.v:NaN;}
   c.v=isFinite(o.v)?o.v*sc:NaN;c.hw=(C.ci&&o.hw!=null&&isFinite(o.hw))?Math.abs(o.hw*sc):null;c.n=o.n;});
  if(C.sc==='idx'&&!(s.tot&&isFinite(s.tot.v)&&s.tot.v!==0))out.warn.push(S('Índice indisponível: o valor do conjunto filtrado é zero ou ausente.','Index unavailable: the filtered-set value is zero or missing.'));});
 /* ordenação e top-N */
 var key0=function(row){var s=sers[0];if(!s)return NaN;if(C.lay==='stk'&&sers.length>1){var t=0;sers.forEach(function(q){var v=q.cells[row.r].v;if(isFinite(v))t+=v;});return t;}return s.cells[row.r].v;};
 var o2=C.ord;
 if(o2==='vd'||o2==='va'){rowsAll.sort(function(a,b){var x=key0(a),y=key0(b);x=isFinite(x)?x:-Infinity;y=isFinite(y)?y:-Infinity;return o2==='vd'?y-x:x-y;});}
 else if(o2==='lab')rowsAll.sort(function(a,b){return (a.t+a.l2).localeCompare(b.t+b.l2,window.__LOC||'pt-BR',{numeric:true});});
 else if(o2==='nd')rowsAll.sort(function(a,b){return b.n-a.n;});
 if(C.top>0&&rowsAll.length>C.top)rowsAll=rowsAll.slice(0,C.top);
 out.rows=rowsAll;out.series=sers;out.cc=cc;out.K2=K2;
 /* avisos */
 var small=rowsAll.filter(function(r){return r.n<30;}).length;
 if(small)out.warn.push(S(small+' grupo(s) com menos de 30 municípios (barra tracejada); com menos de 5 aparece o aviso ⚠. Interprete com cuidado.',small+' group(s) with fewer than 30 municipalities (dashed bar); fewer than 5 show the ⚠ warning. Read with caution.'));
 useM.forEach(function(m){[m.v,m.den].forEach(function(k,ix){if(!k||!isNum(k))return;var x=num(k),bad=0;for(var i3=0;i3<N;i3++)if(mask[i3]&&!(x[i3]===x[i3]))bad++;
   if(bad>0.2*cntMask)out.warn.push(S('“'+vn(k)+'” não tem valor em '+nf(100*bad/cntMask,0)+'% dos municípios do recorte; só os que têm entram na barra (veja o n).','“'+vn(k)+'” has no value in '+nf(100*bad/cntMask,0)+'% of the municipalities in the selection; only those with values enter the bar (see n).'));
   if(prov(k)&&!out['p'+k]){out['p'+k]=1;out.warn.push(S('Dado provisório: “'+vn(k)+'” vem do 2º turno de 2026 ainda em apuração e pode mudar.','Provisional data: “'+vn(k)+'” comes from the 2026 runoff, still being counted, and may change.'));}});});
 [C.g.v,C.g2.v].forEach(function(k){if(k&&k[0]!=='@'&&prov(k)&&!out['p'+k]){out['p'+k]=1;out.warn.push(S('Dado provisório: “'+vn(k)+'” vem do 2º turno de 2026 ainda em apuração.','Provisional data: “'+vn(k)+'” comes from the 2026 runoff, still being counted.'));}});
 if(useM.some(function(m){return m.a==='wmean'||m.a==='wmedian';})&&!W)out.warn.push(S('Sem peso escolhido: médias e medianas ponderadas viram média e mediana simples (cada município vale 1).','No weight chosen: weighted means and medians fall back to simple ones (each municipality counts 1).'));
 if(C.lay==='stk'&&(useM.some(function(m){return m.a!=='sum';})&&C.sc==='val'))out.warn.push(S('Barras empilhadas somam valores; faz sentido sobretudo para somas ou para % do total.','Stacked bars add values up; this mostly makes sense for sums or for % of total.'));
 return out;}
/* ---------------- SVG do gráfico principal ---------------- */
function svgW(el){var w=el.parentNode.clientWidth;return Math.max(300,w||340);}
function nice(lo,hi,cnt){var sp=(hi-lo)||1,st=Math.pow(10,Math.floor(Math.log10(sp/cnt))),m=sp/cnt/st;st*=m>5?10:m>2?5:m>1?2:1;var t=[],v=Math.ceil(lo/st-1e-9)*st;for(;v<=hi+st*1e-6;v+=st)t.push(Math.abs(v)<st*1e-9?0:v);return t;}
function trunc(s,mx){return s.length>mx?s.slice(0,Math.max(1,mx-1))+'…':s;}
function stackMode(){return C.lay==='stk'&&M&&M.series.length>1;}
function draw(){
 var svg=$('cz-svg'),leg=$('cz-leg'),cap=$('cz-cap');
 if(!M||M.empty||!M.rows.length){var W0=svgW(svg);svg.setAttribute('viewBox','0 0 '+W0+' 120');svg.innerHTML='<text class="m" x="'+W0/2+'" y="62" text-anchor="middle" style="font-size:14px">'+esc(M&&M.empty||'')+'</text>';leg.innerHTML='';cap.textContent='';clearCard(true);return;}
 var mob=MQ(),W=svgW(svg),rows=M.rows,ser=M.series,nS=ser.length,stk=stackMode();
 var labW=mob?Math.min(124,Math.round(W*.36)):Math.min(210,Math.round(W*.22)),padR=mob?60:70,padT=30,padB=8,x0=labW,x1=W-padR;
 var barH=mob?(nS>2?14:16):(nS>2?16:20),gp=3,hasL2=rows.some(function(r){return r.l2;});
 var lines=2+(hasL2?1:0);var rowH=Math.max(nS*(barH+gp)-gp+14,lines*14+10);if(stk)rowH=Math.max(barH+16,lines*14+10);
 var H=padT+rows.length*rowH+padB;
 /* domínio */
 var lo=0,hi=0;
 if(stk){rows.forEach(function(r){var p=0,q=0;ser.forEach(function(s){var c=s.cells[r.r],v=c.v;if(!isFinite(v))return;if(v>=0)p+=v;else q+=v;});hi=Math.max(hi,p);lo=Math.min(lo,q);});}
 else rows.forEach(function(r){ser.forEach(function(s){var c=s.cells[r.r];if(!isFinite(c.v))return;var h=c.hw||0;lo=Math.min(lo,c.v-h);hi=Math.max(hi,c.v+h);});});
 if(hi===lo){hi=lo+1;}var pad=(hi-lo)*.02;if(lo<0)lo-=pad;hi+=pad;
 var X=function(v){return x0+(x1-x0)*(v-lo)/(hi-lo);};
 var s='',ticks=nice(lo,hi,mob?3:6),suf=C.sc==='pct'?'%':'';
 ticks.forEach(function(t){var xx=X(t);s+='<line x1="'+xx+'" x2="'+xx+'" y1="'+(padT-4)+'" y2="'+(H-padB)+'" stroke="var(--line)"/><text class="m" x="'+xx+'" y="'+(padT-10)+'" text-anchor="middle">'+cp(t)+suf+'</text>';});
 s+='<line x1="'+X(0)+'" x2="'+X(0)+'" y1="'+(padT-4)+'" y2="'+(H-padB)+'" stroke="var(--mute)"/>';
 if(C.sc==='idx'&&100>lo&&100<hi)s+='<line x1="'+X(100)+'" x2="'+X(100)+'" y1="'+(padT-4)+'" y2="'+(H-padB)+'" stroke="var(--fg)" stroke-dasharray="5 4" opacity=".6"/>';
 var labCh=Math.floor(labW/(mob?6.6:7.2));
 rows.forEach(function(r,ri){
  var y0=padT+ri*rowH,isSel=sel.key===r.r;
  s+='<g data-r="'+r.r+'"><rect class="hit'+(isSel?' sel':'')+'" x="1" y="'+y0+'" width="'+(W-2)+'" height="'+rowH+'" rx="4"/>';
  var ty=y0+rowH/2-((lines-1)*7)+4,warn=r.n<5?'⚠ ':'';
  s+='<text class="l" x="6" y="'+ty+'" style="font-weight:600">'+esc(warn+trunc(r.t,labCh-(warn?2:0)))+'</text>';var ln=1;
  if(r.l2){s+='<text class="m" x="6" y="'+(ty+14*ln)+'" style="font-size:12px">'+esc(trunc(r.l2,labCh))+'</text>';ln++;}
  s+='<text class="m" x="6" y="'+(ty+14*ln)+'" style="font-size:12px">n='+nf(r.n,0)+'</text>';
  if(stk){var p=0,q=0,by=y0+(rowH-barH)/2;ser.forEach(function(se,si){var c=se.cells[r.r],v=c.v;if(!isFinite(v))return;var a,b;if(v>=0){a=p;p+=v;b=p;}else{b=q;q+=v;a=q;}
    s+='<rect x="'+X(Math.min(a,b))+'" y="'+by+'" width="'+Math.max(.5,Math.abs(X(b)-X(a)))+'" height="'+barH+'" fill="'+seriesColor(se.b!==undefined?se.b:si,se.b!==undefined?(M.G2?M.G2.K:nS):nS,se.b!==undefined&&M.G2&&M.G2.ordered)+'"/>';});
   s+='<text x="'+(X(p)+5)+'" y="'+(by+barH/2+4)+'">'+cp(p)+suf+'</text>';}
  else ser.forEach(function(se,si){var c=se.cells[r.r],v=c.v,by=y0+(rowH-(nS*(barH+gp)-gp))/2+si*(barH+gp);if(!isFinite(v))return;
   var col=seriesColor(se.b!==undefined?se.b:si,se.b!==undefined?(M.G2?M.G2.K:nS):nS,se.b!==undefined&&M.G2&&M.G2.ordered);
   var small=c.n<30,tiny=c.n<5,xa=Math.min(X(0),X(v)),wd=Math.max(1,Math.abs(X(v)-X(0)));
   s+='<rect x="'+xa+'" y="'+by+'" width="'+wd+'" height="'+barH+'" rx="2" fill="'+col+'" fill-opacity="'+(tiny?.3:small?.55:1)+'"'+(small?' stroke="'+col+'" stroke-width="1.5" stroke-dasharray="4 3"':'')+'/>';
   var end=v>=0?X(v):X(v);
   if(c.hw){var a2=X(v-c.hw),b2=X(v+c.hw),cy=by+barH/2;s+='<g stroke="var(--fg)" stroke-width="1.6" opacity=".85" fill="none"><line x1="'+a2+'" x2="'+b2+'" y1="'+cy+'" y2="'+cy+'"/><line x1="'+a2+'" x2="'+a2+'" y1="'+(cy-4)+'" y2="'+(cy+4)+'"/><line x1="'+b2+'" x2="'+b2+'" y1="'+(cy-4)+'" y2="'+(cy+4)+'"/></g>';end=v>=0?Math.max(end,b2):Math.min(end,a2);}
   var txt=fv(v,mdec(se.m)+(C.sc==='val'?0:0),se.m.a==='sum')+suf;
   if(C.sc==='pct')txt=nf(v,1)+'%';else if(C.sc==='idx')txt=nf(v,0);
   if(v>=0&&end+6+txt.length*7>W-2)s+='<text x="'+(end-4)+'" y="'+(by+barH/2+4)+'" text-anchor="end" style="fill:var(--bg);paint-order:stroke;stroke:var(--fg);stroke-width:3px">'+txt+'</text>';
   else s+='<text x="'+(v>=0?end+5:end-5)+'" y="'+(by+barH/2+4)+'" text-anchor="'+(v>=0?'start':'end')+'">'+txt+'</text>';});
  s+='</g>';});
 svg.setAttribute('viewBox','0 0 '+W+' '+H);svg.setAttribute('height',H);svg.innerHTML=s;
 /* legenda e legenda do eixo */
 var lg='';ser.forEach(function(se,si){var col=seriesColor(se.b!==undefined?se.b:si,se.b!==undefined?(M.G2?M.G2.K:nS):nS,se.b!==undefined&&M.G2&&M.G2.ordered);
  lg+='<span><i style="background:'+col+'"></i>'+esc(se.name)+(se.b===undefined?' <span class="cz-mute">('+esc(aggName(se.m.a))+')</span>':'')+'</span>';});
 if(M.G2)lg='<span class="cz-mute">'+esc(vn(C.g2.v))+': </span>'+lg;
 leg.innerHTML=lg;
 var m0=M.meas[0],c1=[];c1.push(S('Barras: ','Bars: ')+(M.G2?aggName(m0.a)+' · '+mname(m0):''));
 var scn=C.sc==='pct'?S('% do total das barras','% of the bars’ total'):C.sc==='idx'?S('índice, 100 = conjunto filtrado','index, 100 = filtered set'):S('valor','value');
 var wtxt=(M.series.some(function(s){return s.m.a==='wmean'||s.m.a==='wmedian';})&&M.W)?S(' · peso: ',' · weight: ')+vn(C.w):'';
 cap.textContent=(M.G2?aggName(m0.a)+' · ':'')+S('escala: ','scale: ')+scn+wtxt+(C.ci?S(' · linha: IC 95% aproximado',' · whisker: approximate 95% CI'):'')+' · '+nf(M.cntMask,0)+S(' municípios no recorte',' municipalities in the selection');
 refreshCard();}
/* ---------------- cartão persistente ---------------- */
function clearCard(force){var c=$('cz-card');c.classList.add('cz-empty');if(force)sel.key=null;c.querySelector('.cz-sub3').textContent=S('Toque numa barra (ou use ◀ ▶) para ler os valores, o n e o intervalo de confiança.','Tap a bar (or use ◀ ▶) to read the values, n and confidence interval.');}
function refreshCard(){var c=$('cz-card'),rows=M&&M.rows;if(!rows||!rows.length){clearCard(true);return;}
 var ri=-1;rows.forEach(function(r,i){if(r.r===sel.key)ri=i;});if(ri<0){sel.key=null;clearCard();return;}
 var r=rows[ri];c.classList.remove('cz-empty');c.querySelector('.cz-ttl').textContent=r.t+(r.l2?' · '+r.l2:'');
 c.querySelector('.cz-sub3').textContent=S('Município(s): ','Municipalities: ')+nf(r.n,0)+(M.W?S(' · peso total: ',' · total weight: ')+cp(r.w)+' ('+vn(C.w)+')':'')+(r.n<5?' · ⚠ '+S('n muito pequeno','very small n'):r.n<30?' · '+S('n pequeno','small n'):'')+'  ('+(ri+1)+'/'+rows.length+')';
 var h='';M.series.forEach(function(se,si){var cl=se.cells[r.r];var col=seriesColor(se.b!==undefined?se.b:si,se.b!==undefined?(M.G2?M.G2.K:M.series.length):M.series.length,se.b!==undefined&&M.G2&&M.G2.ordered);
  var txt=isFinite(cl.v)?(C.sc==='pct'?nf(cl.v,1)+'%':C.sc==='idx'?nf(cl.v,1):fv(cl.v,mdec(se.m),se.m.a==='sum')):'–';
  if(cl.hw&&isFinite(cl.v))txt+=' (±'+(C.sc==='val'?fv(cl.hw,mdec(se.m)):nf(cl.hw,C.sc==='pct'?2:1))+')';
  h+='<div class="cz-r"><span class="l"><i class="cz-sw" style="background:'+col+'"></i>'+esc(se.name)+(se.b!==undefined?' · '+esc(mname(se.m)):'')+'</span><span class="v">'+txt+'</span></div>';
  var det=S('n válidos: ','valid n: ')+nf(cl.n,0)+(C.sc!=='val'&&isFinite(cl.raw)?' · '+S('valor bruto: ','raw value: ')+fv(cl.raw,mdec(se.m),se.m.a==='sum'):'')+(cl.o&&cl.o.se!=null&&isFinite(cl.o.se)?' · '+S('erro-padrão: ','std. error: ')+fv(cl.o.se,Math.max(mdec(se.m),2)):'');
  h+='<div class="cz-r sm"><span class="l">'+esc(aggName(se.m.a))+' · '+det+'</span></div>';});
 c.querySelector('.cz-rows').innerHTML=h;}
function stepSel(d){if(!M||!M.rows.length)return;var rows=M.rows,i=-1;rows.forEach(function(r,j){if(r.r===sel.key)i=j;});i=i<0?(d>0?0:rows.length-1):(i+d+rows.length)%rows.length;sel.key=rows[i].r;draw();var g=$('cz-svg').querySelector('.sel');if(g&&g.scrollIntoView&&!MQ())g.scrollIntoView({block:'nearest'});}
/* ---------------- CSV ---------------- */
function csvCell(s){s=String(s);return /[",\n;]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
function buildCsv(){if(!M||M.empty||!M.rows.length)return '';
 var L=[['grupo','faixa','serie','agregacao','valor_exibido','valor_bruto','n_municipios','n_validos','peso_total','erro_padrao','ic95_inf','ic95_sup'].join(',')];
 M.rows.forEach(function(r){M.series.forEach(function(se){var c=se.cells[r.r];var hw=(c.o&&c.o.hw!=null&&isFinite(c.o.hw))?c.o.hw:'';var scl=(isFinite(c.raw)&&c.raw!==0&&isFinite(c.v))?c.v/c.raw:1;
  L.push([csvCell(r.t),csvCell(r.l2),csvCell(se.name+(se.b!==undefined?' | '+mname(se.m):'')),se.m.a,isFinite(c.v)?+c.v.toFixed(6):'',isFinite(c.raw)?+c.raw.toFixed(6):'',r.n,c.n,M.W?Math.round(r.w):'',c.o&&isFinite(c.o.se)?+c.o.se.toFixed(6):'',hw===''?'':+(c.raw-hw).toFixed(6),hw===''?'':+(c.raw+hw).toFixed(6)].join(','));});});
 return L.join('\n');}
function copyCsv(){var t=buildCsv(),msg=$('cz-csv-msg'),box=$('cz-csv-box'),ta=$('cz-csv-ta');if(!t){msg.textContent=S('Nada para copiar.','Nothing to copy.');return;}
 ta.value=t;var done=function(ok){msg.textContent=ok?S('Copiado: ','Copied: ')+(t.split('\n').length-1)+S(' linhas.',' rows.'):S('Não foi possível copiar automaticamente; selecione o texto abaixo e copie.','Could not copy automatically; select the text below and copy it.');box.hidden=ok;if(!ok){ta.focus();ta.select();}};
 var fb=function(){var ok=false;try{ta.hidden=false;box.hidden=false;ta.focus();ta.select();ok=document.execCommand('copy');}catch(e){}done(ok);};
 if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(function(){done(true);},fb);}else fb();}
/* ---------------- correlação ---------------- */
function corr(x,y,w,sel_){var n=0,sw=0,mx=0,my=0,i,wi;
 for(i=0;i<N;i++){if(!sel_[i])continue;wi=w?w[i]:1;n++;sw+=wi;mx+=wi*x[i];my+=wi*y[i];}
 if(n<3||sw<=0)return {r:NaN,n:n};mx/=sw;my/=sw;var sxx=0,syy=0,sxy=0;
 for(i=0;i<N;i++){if(!sel_[i])continue;wi=w?w[i]:1;var dx=x[i]-mx,dy=y[i]-my;sxx+=wi*dx*dx;syy+=wi*dy*dy;sxy+=wi*dx*dy;}
 return {r:(sxx>0&&syy>0)?sxy/Math.sqrt(sxx*syy):NaN,n:n};}
function rankArr(x,o,sel_,out){var pos=0,t=0,L=o.length;
 while(t<L){var i=o[t];if(!sel_[i]){t++;continue;}var v=x[i],u=t,cnt=0,ids=[];
  while(u<L){var k=o[u];if(!sel_[k]){u++;continue;}if(x[k]!==v)break;ids.push(k);cnt++;u++;}
  var rk=pos+(cnt+1)/2;for(var q=0;q<ids.length;q++)out[ids[q]]=rk;pos+=cnt;t=u;}
 return out;}
function pairSel(x,y,mask,w){var s=new Uint8Array(N),i;for(i=0;i<N;i++)s[i]=(mask[i]&&x[i]===x[i]&&y[i]===y[i]&&(!w||w[i]>0))?1:0;return s;}
function corr4(x,y,ox,oy,mask,W){var res={},s=pairSel(x,y,mask,null),rx=new Float64Array(N),ry=new Float64Array(N);
 var p=corr(x,y,null,s);res.p=p.r;res.n=p.n;rankArr(x,ox,s,rx);rankArr(y,oy,s,ry);res.s=corr(rx,ry,null,s).r;
 if(W){var sw=pairSel(x,y,mask,W);res.nw=0;res.pw=corr(x,y,W,sw).r;rankArr(x,ox,sw,rx);rankArr(y,oy,sw,ry);res.sw=corr(rx,ry,W,sw).r;}
 return res;}
function eta2(G,x,mask){var K=G.K,n=new Float64Array(K),s=new Float64Array(K),i,tn=0,ts=0,ts2=0;
 for(i=0;i<N;i++){if(!mask[i]||G.g[i]<0||!(x[i]===x[i]))continue;n[G.g[i]]++;s[G.g[i]]+=x[i];tn++;ts+=x[i];ts2+=x[i]*x[i];}
 if(tn<3)return NaN;var m=ts/tn,sst=ts2-tn*m*m,ssb=0;for(var g=0;g<K;g++)if(n[g])ssb+=n[g]*Math.pow(s[g]/n[g]-m,2);return sst>0?ssb/sst:NaN;}
function corrPanel(){
 var cards=$('cz-cor-cards'),mx=$('cz-mx');cards.innerHTML='';mx.innerHTML='';
 if(!M||M.empty||!M.meas.length){cards.innerHTML='<div><span>'+esc(S('Escolha uma medida para ver as correlações.','Pick a measure to see the correlations.'))+'</span></div>';return;}
 var m0=M.meas[0],y=measArr(m0),yo=ord(m0.a==='ratio'?null:m0.v,y),mask=M.mask,W=M.W,G=M.G1,arrs=[],nms=[],h='';
 var xk=C.g.v;
 if(G&&G.num){
  var x=G.num,xo=ord(xk[0]==='@'?null:xk,x),c=corr4(x,y,xo,yo,mask,W);
  h+='<div><b>'+fr(c.p)+'</b><span>Pearson · n='+nf(c.n,0)+'</span></div><div><b>'+fr(c.s)+'</b><span>Spearman</span></div>';
  if(W)h+='<div><b>'+fr(c.pw)+'</b><span>'+esc(S('Pearson ponderado','Weighted Pearson'))+'</span></div><div><b>'+fr(c.sw)+'</b><span>'+esc(S('Spearman ponderado','Weighted Spearman'))+'</span></div>';
  h+='<div class="cz-note" style="grid-column:1/-1;border:0;background:none;padding:0"><span>'+esc(S('Entre “','Between “')+vn(xk)+S('” e “','” and “')+mname(m0)+'”.'+S(' Municípios com os dois valores.',' Municipalities with both values.'))+'</span></div>';
  arrs.push(x);nms.push(vn(xk));}
 else h+='<div style="grid-column:1/-1"><span>'+esc(S('A variável de agrupamento não é numérica; a associação é medida pela variância explicada (η²) e pelo ranking abaixo.','The grouping variable is not numeric; association is shown as explained variance (η²) and in the ranking below.'))+'</span></div>';
 if(G&&!G.none){var e=eta2(G,y,mask);h+='<div><b>'+(isFinite(e)?nf(e*100,1)+'%':'–')+'</b><span>'+esc(S('Variância da medida entre municípios explicada pelos grupos (η²)','Variance of the measure across municipalities explained by the groups (η²)'))+'</span></div>';}
 cards.innerHTML=h;
 M.meas.forEach(function(m){var a=measArr(m);if(a){arrs.push(a);nms.push(mname(m));}});
 if(arrs.length>=2){var t='<table><tr><th></th>'+nms.map(function(n_,i){return '<th>'+esc(trunc(n_,26))+'</th>';}).join('')+'</tr>';
  for(var i=0;i<arrs.length;i++){t+='<tr><th>'+esc(trunc(nms[i],26))+'</th>';for(var j=0;j<arrs.length;j++){var r=i===j?1:corr(arrs[i],arrs[j],null,pairSel(arrs[i],arrs[j],mask,null)).r;
   var al=isFinite(r)?Math.min(.75,Math.abs(r)*.75):0;t+='<td style="background:color-mix(in srgb,'+(r>=0?'var(--cz-1)':'var(--cz-5)')+' '+Math.round(al*100)+'%,var(--surface))">'+fr(r)+'</td>';}t+='</tr>';}
  mx.innerHTML='<div class="cz-lab" style="margin:6px 0 4px">'+esc(S('Matriz de Pearson entre as variáveis em uso','Pearson matrix among the variables in use'))+'</div>'+t+'</table>';}}
/* ranking de correlações (assíncrono, em fatias) */
function rankStart(){
 var st=$('cz-rk-st');if(!M||M.empty||!M.meas.length){RK.res=[];RK.tok++;$('cz-rk-name').textContent='';drawRank();return;}
 var m0=M.meas[0],y=measArr(m0),tokk=++RK.tok;$('cz-rk-name').textContent='“'+mname(m0)+'”';
 var yo=ord(m0.a==='ratio'?null:m0.v,y),list=[],i;for(i=0;i<V.length;i++)if(V[i].tipo!=='cat'&&V[i].k!==m0.v&&!(m0.a==='ratio'&&V[i].k===m0.den)&&!(C.rkX&&m0.a!=='ratio'&&V_(m0.v)&&V[i].grupo_pt&&V[i].grupo_pt===V_(m0.v).grupo_pt))list.push(V[i].k);
 var mask=M.mask,W=C.rkW?M.W:null,res=[],idx=0,t0=performance.now();RK.res=[];RK.total=list.length;
 var rx=new Float64Array(N),ry=new Float64Array(N);
 function slice(){if(tokk!==RK.tok)return;var ts=performance.now();
  while(idx<list.length&&performance.now()-ts<14){var k=list[idx++],x=num(k),s=pairSel(x,y,mask,W),cn=0;for(var q=0;q<N;q++)cn+=s[q];if(cn<20)continue;
   var p=corr(x,y,W,s).r;if(!isFinite(p))continue;var xo=ord(k);rankArr(x,xo,s,rx);rankArr(y,yo,s,ry);var sp=corr(rx,ry,W,s).r;res.push({k:k,r:p,rho:sp,n:cn});}
  RK.res=res;st.textContent=idx<list.length?S('Calculando… ','Computing… ')+idx+'/'+list.length:'';
  if(idx<list.length){if(idx%30<3||true)drawRank();setTimeout(slice,0);}else{drawRank();}}
 st.textContent=S('Calculando… ','Computing… ')+'0/'+list.length;setTimeout(slice,0);}
function drawRank(){
 var svg=$('cz-rk'),W=svgW(svg),mob=MQ(),res=RK.res.slice().sort(function(a,b){return Math.abs(b.r)-Math.abs(a.r);}).slice(0,C.rkN);
 if(!res.length){svg.setAttribute('viewBox','0 0 '+W+' 100');svg.setAttribute('height',100);svg.innerHTML='<text class="m" x="'+W/2+'" y="54" text-anchor="middle" style="font-size:14px">'+esc(RK.tok&&M&&!M.empty?S('Calculando…','Computing…'):S('Escolha uma medida.','Pick a measure.'))+'</text>';return;}
 var rowH=mob?46:40,padT=22,H=padT+res.length*rowH+6,x0=8,x1=W-8,X=function(v){return x0+(x1-x0)*(v+1)/2;},s='';
 [-1,-.5,0,.5,1].forEach(function(t){s+='<line x1="'+X(t)+'" x2="'+X(t)+'" y1="'+(padT-4)+'" y2="'+(H-4)+'" stroke="'+(t===0?'var(--mute)':'var(--line)')+'"/><text class="m" x="'+Math.max(14,Math.min(W-14,X(t)))+'" y="'+(padT-8)+'" text-anchor="middle">'+nf(t,t%1?1:0)+'</text>';});
 var ch=Math.floor((W-16)/(mob?6.9:7.4));
 res.forEach(function(r,i){var y0=padT+i*rowH,isS=selR.key===r.k,p=r.r>=0;
  s+='<g data-k="'+esc(r.k)+'"><rect class="hit'+(isS?' sel':'')+'" x="1" y="'+y0+'" width="'+(W-2)+'" height="'+rowH+'" rx="4"/>';
  s+='<text class="l" x="6" y="'+(y0+14)+'" text-anchor="start" style="font-size:'+(mob?12.5:13)+'px">'+esc(trunc(vn(r.k),Math.min(ch-18,48)))+'</text>';
  var col=p?'var(--cz-1)':'var(--cz-5)';
  s+='<rect x="'+Math.min(X(0),X(r.r))+'" y="'+(y0+19)+'" width="'+Math.max(1,Math.abs(X(r.r)-X(0)))+'" height="9" rx="1.5" fill="'+col+'"/>';
  s+='<rect x="'+Math.min(X(0),X(r.rho))+'" y="'+(y0+30)+'" width="'+Math.max(1,Math.abs(X(r.rho)-X(0)))+'" height="7" rx="1.5" fill="none" stroke="'+col+'" stroke-width="1.5"/>';
  s+='<text class="m" x="'+(W-6)+'" y="'+(y0+14)+'" text-anchor="end" style="font-size:12px">'+fr(r.r)+' · '+fr(r.rho)+'</text></g>';});
 svg.setAttribute('viewBox','0 0 '+W+' '+H);svg.setAttribute('height',H);svg.innerHTML=s;refreshRCard();}
function refreshRCard(){var c=$('cz-rcard'),list=rkList(),i=-1;list.forEach(function(r,j){if(r.k===selR.key)i=j;});
 if(i<0){c.classList.add('cz-empty');c.querySelector('.cz-sub3').textContent=S('Toque numa linha (ou use ◀ ▶) para ver Pearson, Spearman, n e usar a variável.','Tap a row (or use ◀ ▶) to see Pearson, Spearman, n and use the variable.');return;}
 var r=list[i],v=V_(r.k);c.classList.remove('cz-empty');c.querySelector('.cz-ttl').textContent=vn(r.k);
 c.querySelector('.cz-sub3').textContent=vgrp(v)+' · '+fonteOf(v)+(v.ano?' · '+v.ano:'')+'  ('+(i+1)+'/'+list.length+')';
 c.querySelector('.cz-rows').innerHTML='<div class="cz-r"><span class="l">Pearson</span><span class="v">'+fr(r.r)+'</span></div><div class="cz-r"><span class="l">Spearman</span><span class="v">'+fr(r.rho)+'</span></div><div class="cz-r sm"><span class="l">'+esc(S('Municípios com os dois valores: ','Municipalities with both values: ')+nf(r.n,0)+(C.rkW?S(' · ponderado',' · weighted'):''))+'</span></div>'+(vnote(v)?'<div class="cz-r sm"><span class="l">'+esc(vnote(v))+'</span></div>':'');}
function rkList(){return RK.res.slice().sort(function(a,b){return Math.abs(b.r)-Math.abs(a.r);}).slice(0,C.rkN);}
/* ---------------- seletor de variáveis ---------------- */
var PK={cb:null,items:[],cur:null,q:'',timer:0,lastFocus:null};
function pickItems(kind){var it=[];
 if(kind==='group'||kind==='group2'){var sp=kind==='group'?['@reg','@uf']:['@none','@reg','@uf'];if(kind==='group')sp=['@reg','@uf'];
  if(popVar())sp.push('@porte_pop');if(aptVar())sp.push('@porte_apt');if(kind==='group2')sp.unshift('@none');else sp.push('@none');
  sp.forEach(function(k){it.push({k:k,sp:1});});}
 V.forEach(function(v){if(kind==='num'&&v.tipo==='cat')return;it.push({k:v.k,v:v});});return it;}
function openPick(kind,cur,cb){PK.cb=cb;PK.kind=kind;PK.cur=cur;PK.items=pickItems(kind);PK.q='';PK.lastFocus=document.activeElement;$('cz-pk-q').value='';$('cz-pick').hidden=false;renderPick();setTimeout(function(){try{$('cz-pk-q').focus();}catch(e){}},30);}
function closePick(){$('cz-pick').hidden=true;try{if(PK.lastFocus&&PK.lastFocus.focus)PK.lastFocus.focus();}catch(e){}}
function itemText(it){if(it.sp)return vn(it.k);var v=it.v;return ((v.pt||'')+' '+(v.en||'')+' '+v.k+' '+(v.grupo_pt||'')+' '+(v.grupo_en||'')+' '+(v.fonte||'')).toLowerCase();}
function norm(s){return s.toLowerCase().normalize?s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''):s.toLowerCase();}
function renderPick(){
 var q=norm(PK.q.trim()),terms=q?q.split(/\s+/):[],list=PK.items.filter(function(it){if(!terms.length)return true;var t=norm(it.sp?(SPN[it.k][0]+' '+SPN[it.k][1]):itemText(it));return terms.every(function(w){return t.indexOf(w)>=0;});});
 var groups=[],gm={};
 function add(g,it){if(!gm[g]){gm[g]={name:g,items:[]};groups.push(gm[g]);}gm[g].items.push(it);}
 var spl=list.filter(function(i){return i.sp;});if(spl.length)add(S('Agrupamentos prontos','Ready-made groupings'),null),gm[S('Agrupamentos prontos','Ready-made groupings')].items=spl;
 if(!q){var fl=list.filter(function(i){return !i.sp&&fav.indexOf(i.k)>=0;});if(fl.length){groups.push({name:'★ '+S('Favoritas','Favorites'),items:fl});}}
 list.filter(function(i){return !i.sp;}).forEach(function(i){add(vgrp(i.v)||S('Outras','Other'),i);});
 var h='',cnt=0;
 groups.forEach(function(g){if(!g.items.length)return;h+='<div class="cz-pk-g">'+esc(g.name)+' <span style="font-weight:400">('+g.items.length+')</span></div>';
  g.items.forEach(function(it){cnt++;var k=it.k,isF=fav.indexOf(k)>=0,v=it.v,cur=PK.cur===k;
   if(it.sp){h+='<div class="cz-pk-it'+(cur?' cur':'')+'" role="option"><div class="main" tabindex="0" data-pk="'+esc(k)+'"><div class="nm">'+esc(vn(k))+'</div></div></div>';return;}
   var nt=vnote(v),mt=[vgrp(v),fonteOf(v),v.ano,v.tipo==='cat'?S('categórica','categorical'):'',prov(k)?S('provisório','provisional'):''].filter(Boolean).join(' · ');
   h+='<div class="cz-pk-it'+(cur?' cur':'')+'" role="option"><div class="main" tabindex="0" data-pk="'+esc(k)+'" title="'+esc(nt)+'"><div class="nm">'+esc(vn(k))+'</div><div class="mt">'+esc(mt)+'</div>'+(nt?'<div class="mt nt">'+esc(nt)+'</div>':'')+'</div><button type="button" class="st" data-fav="'+esc(k)+'" aria-pressed="'+isF+'" aria-label="'+esc(S('Favorita','Favorite'))+'">'+(isF?'★':'☆')+'</button></div>';});});
 if(!cnt)h='<div class="cz-pk-none">'+esc(S('Nenhuma variável encontrada.','No variable found.'))+'</div>';
 $('cz-pk-list').innerHTML=h;$('cz-pk-meta').textContent=nf(cnt,0)+S(' de ',' of ')+nf(PK.items.length,0)+S(' variáveis',' variables')+(fav.length?' · ★ '+fav.length:'');}
function pickChoose(k){var cb=PK.cb;closePick();if(cb)cb(k);}
/* ---------------- interface dinâmica ---------------- */
function vbtn(id,k,placeholder){var b=$(id);b.innerHTML='<span>'+esc(k?vn(k):placeholder)+'</span>';b.title=k&&V_(k)?vnote(V_(k)):'';}
var AGOPT=[['wmean','média ponderada','weighted mean'],['mean','média simples','simple mean'],['wmedian','mediana ponderada','weighted median'],['median','mediana','median'],['sum','soma','sum'],['ratio','razão de somas','ratio of sums']];
function buildMeas(){var box=$('cz-meas'),h='';
 C.meas.forEach(function(m,i){var col='var(--cz-'+(i+1)+')';
  h+='<div class="cz-mrow" data-i="'+i+'"><button type="button" class="cz-vb cz-mv" data-i="'+i+'" title="'+esc(m.v&&V_(m.v)?vnote(V_(m.v)):'')+'"><span><i class="cz-sw" style="background:'+col+'"></i>'+esc(m.a==='ratio'?(m.v?vn(m.v):S('Numerador…','Numerator…')):(m.v?vn(m.v):S('Escolher variável…','Pick a variable…')))+'</span></button>'
  +'<select class="cz-ag" data-i="'+i+'" aria-label="'+esc(S('Agregação','Aggregation'))+'">'+AGOPT.map(function(o){return '<option value="'+o[0]+'"'+(o[0]===m.a?' selected':'')+'>'+esc(S(o[1],o[2]))+'</option>';}).join('')+'</select>'
  +'<button type="button" class="cz-btn cz-rm" data-i="'+i+'" aria-label="'+esc(S('Remover medida','Remove measure'))+'"'+(C.meas.length<2?' disabled':'')+'>✕</button>'
  +'<div class="cz-den"'+(m.a==='ratio'?'':' hidden')+'><span>'+esc(S('dividido por','divided by'))+'</span><button type="button" class="cz-vb cz-dv" data-i="'+i+'"><span>'+esc(m.den?vn(m.den):S('Denominador…','Denominator…'))+'</span></button><select class="cz-mul" data-i="'+i+'" aria-label="'+esc(S('Multiplicador','Multiplier'))+'">'+[1,100,1000].map(function(u){return '<option value="'+u+'"'+(u===m.mul?' selected':'')+'>×'+u+'</option>';}).join('')+'</select></div></div>';});
 box.innerHTML=h;$('cz-addm').hidden=C.meas.length>=3;}
function buildWeights(){var s=$('cz-w'),h='<option value="">'+esc(S('Sem peso (cada município vale 1)','No weight (each municipality counts 1)'))+'</option>';
 weightVars().forEach(function(k){h+='<option value="'+esc(k)+'"'+(k===C.w?' selected':'')+'>'+esc(vn(k))+'</option>';});s.innerHTML=h;s.value=C.w;}
function buildPorte(){var s=$('cz-f-porte'),pd=porteDef('pop')||porteDef('apt'),h='<option value="">'+esc(S('Todos os portes','All sizes'))+'</option>';
 if(pd)pd.labels.forEach(function(l,i){h+='<option value="'+i+'">'+esc(l)+'</option>';});s.innerHTML=h;s.value=C.flt.porte;s.parentNode.hidden=!pd;}
function buildChips(){var r=$('cz-f-reg'),u=$('cz-f-uf'),h='';
 RGc.labels.forEach(function(l){h+='<button type="button" class="cz-chip" data-reg="'+esc(l)+'" aria-pressed="'+(C.flt.reg.indexOf(l)>=0)+'">'+esc(rl(l))+'</button>';});r.innerHTML=h;h='';
 UFc.labels.forEach(function(l){h+='<button type="button" class="cz-chip" data-uf="'+esc(l)+'" aria-pressed="'+(C.flt.uf.indexOf(l)>=0)+'">'+esc(l)+'</button>';});u.innerHTML=h;}
function buildRng(){var b=$('cz-f-rng'),h='';
 C.flt.rng.forEach(function(r,i){h+='<div class="cz-rng" data-i="'+i+'"><button type="button" class="cz-vb cz-rv" data-i="'+i+'"><span>'+esc(r.v?vn(r.v):S('Variável…','Variable…'))+'</span></button><input type="text" inputmode="decimal" class="cz-rmin" data-i="'+i+'" placeholder="'+esc(S('mínimo','min'))+'" value="'+(r.min!=null?String(r.min).replace('.',(window.__DEC||',')):'')+'" aria-label="'+esc(S('Valor mínimo','Minimum value'))+'"><input type="text" inputmode="decimal" class="cz-rmax" data-i="'+i+'" placeholder="'+esc(S('máximo','max'))+'" value="'+(r.max!=null?String(r.max).replace('.',(window.__DEC||',')):'')+'" aria-label="'+esc(S('Valor máximo','Maximum value'))+'"><button type="button" class="cz-btn cz-rm" data-i="'+i+'" aria-label="'+esc(S('Remover filtro','Remove filter'))+'">✕</button></div>';});b.innerHTML=h;}
/* receitas */
function findVar(spec){if(!spec)return null;if(typeof spec==='string')return KI[spec]!==undefined?spec:null;
 for(var i=0;i<V.length;i++){var t=V[i].k+' '+(V[i].pt||'')+' '+(V[i].en||'');if(spec.test(t)&&V[i].tipo!=='cat')return V[i].k;}return null;}
var RECIPES=[
 {pt:'Voto Lula 2022 (2º turno) por quintil de renda do responsável',en:'Lula vote 2022 (runoff) by quintile of household-head income',g:/renda.*respons|respons.*renda|renda_resp/i,gm:'q5',m:['res22_t2_plula']},
 {pt:'Abstenção 2026 (2º turno) por decil de % de evangélicos',en:'2026 abstention (runoff) by decile of % evangelicals',g:/evang/i,gm:'q10',m:['res26_t2_abst']},
 {pt:'Δ Lula 2º−1º turno 2026 por região',en:'Δ Lula runoff−1st round 2026 by region',g:'@reg',m:['res26_d21_lula']},
 {pt:'Atraso de fechamento das urnas (2026, 1º turno) por porte do município',en:'Ballot-box closing delay (2026, 1st round) by municipality size',g:'@porte_pop',m:['res26_t1_atraso','res26_t1_atraso15']},
 {pt:'Lula 2022 × 2026 (2º turno) por UF',en:'Lula 2022 × 2026 (runoff) by state',g:'@uf',m:['res22_t2_plula','res26_t2_plula']},
 {pt:'Lula 2026 (2º turno) por quintil de renda dentro de cada região',en:'Lula 2026 (runoff) by income quintile within each region',g:'@reg',g2:/renda.*respons|respons.*renda|renda_resp/i,g2m:'q5',m:['res26_t2_plula']},
 {pt:'Δ Lula 2026−2022 (2º turno) por tercil de % de pretos e pardos',en:'Δ Lula 2026−2022 (runoff) by tercile of % Black and mixed-race',g:/preta|parda|negr/i,gm:'q3',m:['res26_d2622_t2_lula']},
 {pt:'Abstenção 2026 por porte (população) e região, em barras empilhadas de % do total',en:'2026 abstention by size (population) and region',g:'@porte_pop',g2:'@reg',m:['res26_t2_abst']},
 {pt:'Lula 2026 por quintil de Bolsa Família / transferências',en:'Lula 2026 by quintile of Bolsa Família / transfers',g:/bolsa|(^|_)bf_/i,gm:'q5',m:['res26_t2_plula']}];
function buildRecipes(){var h='',n=0;RECIPES.forEach(function(r,i){var g=findVar(r.g.test?r.g:r.g),ok=typeof r.g==='string'?(r.g[0]==='@'?(r.g==='@porte_pop'?!!popVar():true):false):!!g;
  var mm=r.m.map(findVar);if(!ok||mm.some(function(x){return !x;}))return;if(r.g2&&typeof r.g2!=='string'&&!findVar(r.g2))return;
  n++;h+='<button type="button" class="cz-chip" data-rec="'+i+'">'+esc(S(r.pt,r.en))+'</button>';});
 $('cz-rec').innerHTML=h||'<span class="cz-mute">'+esc(S('Nenhuma receita disponível com as variáveis carregadas.','No recipe available with the loaded variables.'))+'</span>';}
function applyRecipe(i){var r=RECIPES[i];C.g={v:typeof r.g==='string'?r.g:findVar(r.g),m:r.gm||'q5',cuts:'',wq:false};
 C.g2={v:r.g2?(typeof r.g2==='string'?r.g2:findVar(r.g2)):'@none',m:r.g2m||'q5',cuts:''};C.lay=r.g2?'grp':'grp';
 if(r.pt.indexOf('empilhadas')>=0){C.lay='stk';C.sc='pct';}else C.sc='val';
 C.meas=r.m.map(function(k){return {v:findVar(k),a:'wmean',den:null,mul:100};});C.ord='nat';C.top=0;C.flt={reg:[],uf:[],porte:'',rng:[]};sel.key=null;selR.key=null;syncUI();update();}
/* sincroniza controles estáticos com o estado */
function syncUI(){
 vbtn('cz-g-btn',C.g.v,S('Escolher…','Pick…'));vbtn('cz-g2-btn',C.g2.v,S('Escolher…','Pick…'));
 var gn=isNum(C.g.v);$('cz-g-opt').hidden=!gn;$('cz-g-m').value=C.g.m;$('cz-g-cuts').hidden=!(gn&&C.g.m==='man');$('cz-g-cuts').value=C.g.cuts;$('cz-g-wq').checked=C.g.wq;$('cz-g-wq').parentNode.hidden=!(gn&&C.g.m!=='man');
 var g2n=isNum(C.g2.v),g2on=C.g2.v&&C.g2.v!=='@none';$('cz-g2-opt').hidden=!g2on;$('cz-g2-m').parentNode.querySelectorAll('#cz-g2-m,#cz-g2-cuts').forEach(function(e){e.hidden=!g2n;});$('cz-g2-m').value=C.g2.m;$('cz-g2-cuts').hidden=!(g2n&&C.g2.m==='man');$('cz-g2-cuts').value=C.g2.cuts;$('cz-lay').value=C.lay;
 $('cz-sc').value=C.sc;$('cz-ord').value=C.ord;$('cz-top').value=String(C.top);$('cz-ci').checked=C.ci;$('cz-rk-n').value=String(C.rkN);$('cz-rk-w').checked=C.rkW;$('cz-rk-x').checked=C.rkX;
 buildMeas();buildWeights();buildPorte();buildChips();buildRng();buildRecipes();}
/* ---------------- ciclo ---------------- */
function update(){if(!D)return;M=build();
 var f=C.flt,nf_=f.reg.length+f.uf.length+(f.porte!==''?1:0)+f.rng.filter(function(r){return r.v;}).length;
 $('cz-count').textContent=nf(M.cntMask,0)+S(' de ',' of ')+nf(N,0)+S(' municípios no recorte',' municipalities in the selection')+(nf_?S(' ('+nf_+' filtro(s))',' ('+nf_+' filter(s))'):'');
 $('cz-warn').innerHTML=M.warn.map(function(w){return '<p>'+esc(w)+'</p>';}).join('');
 draw();corrPanel();clearTimeout(timer);timer=setTimeout(rankStart,180);}
function sched(){clearTimeout(sched.t);sched.t=setTimeout(update,25);}
function flag(k){root.dataset.ready=k;}
/* ---------------- eventos ---------------- */
function bindAll(){
 root.addEventListener('click',function(e){var t=e.target.closest('button,[data-r],[data-k],[data-pk]');if(!t)return;
  if(t.id==='cz-g-btn'){openPick('group',C.g.v,function(k){C.g.v=k;if(C.g.m!=='man'&&!/^q/.test(C.g.m))C.g.m='q5';sel.key=null;syncUI();update();});return;}
  if(t.id==='cz-g2-btn'){openPick('group2',C.g2.v,function(k){C.g2.v=k;sel.key=null;syncUI();update();});return;}
  if(t.classList.contains('cz-mv')){var i=+t.dataset.i;openPick('num',C.meas[i].v,function(k){C.meas[i].v=k;buildMeas();update();});return;}
  if(t.classList.contains('cz-dv')){var i2=+t.dataset.i;openPick('num',C.meas[i2].den,function(k){C.meas[i2].den=k;buildMeas();update();});return;}
  if(t.classList.contains('cz-rv')){var i3=+t.dataset.i;openPick('num',C.flt.rng[i3].v,function(k){C.flt.rng[i3].v=k;buildRng();update();});return;}
  if(t.id==='cz-addm'){C.meas.push({v:null,a:'wmean',den:null,mul:100});buildMeas();openPick('num',null,function(k){C.meas[C.meas.length-1].v=k;buildMeas();update();});return;}
  if(t.classList.contains('cz-rm')&&t.closest('#cz-meas')){C.meas.splice(+t.dataset.i,1);buildMeas();update();return;}
  if(t.classList.contains('cz-rm')&&t.closest('#cz-f-rng')){C.flt.rng.splice(+t.dataset.i,1);buildRng();update();return;}
  if(t.id==='cz-f-add'){C.flt.rng.push({v:null,min:null,max:null});buildRng();openPick('num',null,function(k){C.flt.rng[C.flt.rng.length-1].v=k;buildRng();update();});return;}
  if(t.id==='cz-f-clr'){C.flt={reg:[],uf:[],porte:'',rng:[]};buildChips();buildRng();buildPorte();update();return;}
  if(t.dataset.reg!==undefined){toggle(C.flt.reg,t.dataset.reg);t.setAttribute('aria-pressed',C.flt.reg.indexOf(t.dataset.reg)>=0);update();return;}
  if(t.dataset.uf!==undefined){toggle(C.flt.uf,t.dataset.uf);t.setAttribute('aria-pressed',C.flt.uf.indexOf(t.dataset.uf)>=0);update();return;}
  if(t.dataset.rec!==undefined){applyRecipe(+t.dataset.rec);return;}
  if(t.id==='cz-csv'){copyCsv();return;}
  var card=t.closest('#cz-card');
  if(card){if(t.classList.contains('cz-prev'))stepSel(-1);else if(t.classList.contains('cz-next'))stepSel(1);else if(t.classList.contains('cz-x')){sel.key=null;draw();}return;}
  var rc=t.closest('#cz-rcard');
  if(rc){var L=rkList(),ix=-1;L.forEach(function(r,j){if(r.k===selR.key)ix=j;});
   if(t.classList.contains('cz-prev')||t.classList.contains('cz-next')){if(!L.length)return;ix=ix<0?0:(ix+(t.classList.contains('cz-next')?1:-1)+L.length)%L.length;selR.key=L[ix].k;drawRank();}
   else if(t.classList.contains('cz-x')){selR.key=null;drawRank();}
   else if(t.id==='cz-r-g'&&selR.key){C.g.v=selR.key;C.g.m='q5';sel.key=null;syncUI();update();$('cz-svg').scrollIntoView({behavior:'smooth',block:'center'});}
   else if(t.id==='cz-r-m'&&selR.key){if(C.meas.length>=3)C.meas.pop();C.meas.push({v:selR.key,a:'wmean',den:null,mul:100});syncUI();update();$('cz-svg').scrollIntoView({behavior:'smooth',block:'center'});}return;}
  var gr=t.closest('#cz-svg [data-r]');if(gr){var rr=+gr.dataset.r;sel.key=sel.key===rr&&!MQ()?null:rr;draw();return;}
  var gk=t.closest('#cz-rk [data-k]');if(gk){selR.key=gk.dataset.k;drawRank();return;}
 });
 root.addEventListener('change',function(e){var t=e.target,i=+t.dataset.i;
  if(t.classList.contains('cz-ag')){C.meas[i].a=t.value;buildMeas();update();return;}
  if(t.classList.contains('cz-mul')){C.meas[i].mul=+t.value;update();return;}
  if(t.classList.contains('cz-rmin')||t.classList.contains('cz-rmax')){var v=parseFloat(String(t.value).replace(',','.'));C.flt.rng[i][t.classList.contains('cz-rmin')?'min':'max']=isFinite(v)?v:null;update();return;}
  var m={ 'cz-g-m':function(){C.g.m=t.value;syncUI();},'cz-g-cuts':function(){C.g.cuts=t.value;},'cz-g-wq':function(){C.g.wq=t.checked;},'cz-g2-m':function(){C.g2.m=t.value;syncUI();},'cz-g2-cuts':function(){C.g2.cuts=t.value;},
   'cz-lay':function(){C.lay=t.value;},'cz-w':function(){C.w=t.value;},'cz-sc':function(){C.sc=t.value;},'cz-ord':function(){C.ord=t.value;},'cz-top':function(){C.top=+t.value;},'cz-ci':function(){C.ci=t.checked;},
   'cz-f-porte':function(){C.flt.porte=t.value;},'cz-rk-n':function(){C.rkN=+t.value;drawRank();return 1;},'cz-rk-w':function(){C.rkW=t.checked;},'cz-rk-x':function(){C.rkX=t.checked;}};
  if(m[t.id]){var stop=m[t.id]();if(!stop)update();}});
 $('cz-g-cuts').addEventListener('input',function(){C.g.cuts=this.value;sched();});$('cz-g2-cuts').addEventListener('input',function(){C.g2.cuts=this.value;sched();});
 $('cz-svg').addEventListener('keydown',function(e){var k=e.key;if(k==='ArrowDown'||k==='ArrowRight'){stepSel(1);e.preventDefault();}else if(k==='ArrowUp'||k==='ArrowLeft'){stepSel(-1);e.preventDefault();}else if(k==='Escape'){sel.key=null;draw();}});
 /* seletor */
 $('cz-pk-bd').addEventListener('click',closePick);$('cz-pk-x').addEventListener('click',closePick);
 $('cz-pk-q').addEventListener('input',function(){PK.q=this.value;clearTimeout(PK.timer);PK.timer=setTimeout(renderPick,90);});
 $('cz-pick').addEventListener('click',function(e){var f=e.target.closest('[data-fav]');if(f){var k=f.dataset.fav,ix=fav.indexOf(k);if(ix>=0)fav.splice(ix,1);else fav.push(k);saveFav();var sc=$('cz-pk-list').scrollTop;renderPick();$('cz-pk-list').scrollTop=sc;return;}
  var p=e.target.closest('[data-pk]');if(p)pickChoose(p.dataset.pk);});
 $('cz-pick').addEventListener('keydown',function(e){if(e.key==='Escape')closePick();else if((e.key==='Enter'||e.key===' ')&&e.target.dataset&&e.target.dataset.pk){e.preventDefault();pickChoose(e.target.dataset.pk);}});
 if(window.ResizeObserver){var lw=0;new ResizeObserver(function(){var w=$('cz-wrap').clientWidth;if(w&&Math.abs(w-lw)>2){lw=w;if(D&&!$('p-cruzamento').hidden){draw();drawRank();}}}).observe($('cz-wrap'));}
}
function toggle(a,v){var i=a.indexOf(v);if(i>=0)a.splice(i,1);else a.push(v);}
/* ---------------- carga ---------------- */
function msg(t,err){var s=$('cz-status');s.textContent=t;s.classList.toggle('err',!!err);}
function defaults(){
 var wv=weightVars(),a=['res26_t1_aptos','res26_t2_aptos'].filter(function(k){return KI[k]!==undefined;})[0]||wv.filter(function(k){return /aptos/.test(k);})[0]||wv[0]||'';C.w=a;
 var m=findVar('res22_t2_plula')||findVar('res26_t2_plula')||findVar('res26_t2_abst');
 if(!m){for(var i=0;i<V.length;i++)if(V[i].tipo!=='cat'&&V[i].papel==='resultado'){m=V[i].k;break;}}
 if(!m)for(i=0;i<V.length;i++)if(V[i].tipo!=='cat'){m=V[i].k;break;}
 C.meas=[{v:m,a:'wmean',den:null,mul:100}];C.g={v:'@reg',m:'q5',cuts:'',wq:false};}
function ready(d){D=d;V=d.vars||[];N=d.n||(d.ibge||[]).length;V.forEach(function(v,i){KI[v.k]=i;});initRegions();defaults();
 $('cz-main').hidden=false;msg('');bindAll();syncUI();flag('1');update();}
window.__cruzInit=function(){
 if(D){if(dirtyLang){dirtyLang=false;syncUI();}update();return;}
 if(loadTried)return;loadTried=true;msg(S('Carregando os dados por município (uma vez só)…','Loading municipality-level data (once)…'));
 var get=function(u){return fetch(u).then(function(r){if(!r.ok)throw 0;return r.json();});};
 get(base()+'ext/municipios.json').catch(function(){return get('dados/ext/municipios.json');}).then(function(d){
  if(!d||!d.vars||!d.vars.length)throw 0;ready(d);}).catch(function(){loadTried=false;flag('err');msg(S('Os dados externos por município ainda não foram publicados. Quando o arquivo dados/ext/municipios.json existir, esta aba funcionará automaticamente.','The external municipality-level data have not been published yet. When the file dados/ext/municipios.json exists, this tab will work automatically.'),true);});};
var rr=window.__rerender;window.__rerender=function(){if(rr)rr.apply(this,arguments);if(!D){if(loadTried===false&&root.dataset.ready==='err'){/* mantém mensagem */}return;}
 var vis=!$('p-cruzamento').hidden;if(vis){syncUI();update();}else dirtyLang=true;
 if(!$('cz-pick').hidden)renderPick();};
})();
</script>
