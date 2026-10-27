/* Biblioteca estatística compartilhada: window.__stats (sem dependências).
   Contrato: dados_externos/CONTRATO_ACHADOS.md. p-valores via beta/gama incompletas regularizadas (fração contínua),
   sempre também em log10 para p minúsculos (nunca p = 0).
   API:
     pCorr(r,n,tipo)     -> {t,df,p,log10p}          teste t bicaudal, df=n-2 (Spearman usa a mesma aproximação t)
     ciCorr(r,n,nivel)   -> [lo,hi]                  Fisher z, erro 1/sqrt(n-3)
     anova(grupos)       -> {F,df1,df2,p,log10p,eta2}
     welch(a,b)          -> {t,df,p,log10p,diff}     diff = média(a) - média(b)
     welchS(m1,v1,n1,m2,v2,n2) -> idem, a partir de resumos (média, variância amostral, n)
     kruskal(grupos)     -> {H,df,p,log10p}          com correção de empates
     fmtP(res|log10p,lang) -> "p < 1e-300" | "p = 0,0123" | "p ≈ 3,2×10⁻⁴⁵"  (PT vírgula, EN ponto)
     fdr(arrayP)         -> arrayQ (Benjamini–Hochberg)
     fdrLog(arrayLog10P,m) -> array de log10 q (BH em escala log; m = tamanho da família, padrão = comprimento)
     holm(arrayP) / holmLog(arrayLog10P) -> p ajustados (Holm–Bonferroni)
     normQuantile(p) -> z. Entradas com NaN/null em grupos são ignoradas. */
(function(){
var LN10=Math.LN10,LN2PI=Math.log(2*Math.PI);
var LC=[0.99999999999980993,676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
function lgam(x){
 if(x<8){var s=0;while(x<8){s+=Math.log(x);x+=1;}return lgam(x)-s;}
 var i2=1/(x*x);
 return (x-.5)*Math.log(x)-x+.5*LN2PI+(1/12-i2*(1/360-i2*(1/1260-i2*(1/1680-i2/1188))))/x;}
/* fração contínua da beta incompleta (Lentz) */
function betacf(x,a,b){
 var TINY=1e-300,qab=a+b,qap=a+1,qam=a-1,c=1,d=1-qab*x/qap,m,aa,del;
 if(Math.abs(d)<TINY)d=TINY;d=1/d;var h=d;
 for(m=1;m<=20000;m++){var m2=2*m;
  aa=m*(b-m)*x/((qam+m2)*(a+m2));d=1+aa*d;if(Math.abs(d)<TINY)d=TINY;c=1+aa/c;if(Math.abs(c)<TINY)c=TINY;d=1/d;h*=d*c;
  aa=-(a+m)*(qab+m)*x/((a+m2)*(qap+m2));d=1+aa*d;if(Math.abs(d)<TINY)d=TINY;c=1+aa/c;if(Math.abs(c)<TINY)c=TINY;d=1/d;del=d*c;h*=del;
  if(Math.abs(del-1)<1e-15)break;}
 return h;}
/* ln I_x(a,b) (cauda inferior regularizada); y = 1-x passado à parte para manter a precisão */
function lnIbeta(x,y,a,b){
 if(x<=0)return -Infinity;if(y<=0)return 0;
 var lf=a*Math.log(x)+b*Math.log(y)-(lgam(a)+lgam(b)-lgam(a+b));
 if(x<(a+1)/(a+b+2))return lf+Math.log(betacf(x,a,b)/a);
 var J=Math.exp(lf)*betacf(y,b,a)/b;
 return J>=1?-Infinity:Math.log1p(-J);}
/* ln Q(a,x), gama incompleta superior regularizada */
function lnQgam(a,x){
 if(x<=0)return 0;
 if(x<a+1){var ap=a,sum=1/a,del=sum,n;for(n=0;n<100000;n++){ap+=1;del*=x/ap;sum+=del;if(Math.abs(del)<Math.abs(sum)*1e-16)break;}
  var lp=-x+a*Math.log(x)-lgam(a)+Math.log(sum);return lp>=0?-Infinity:Math.log1p(-Math.exp(lp));}
 var TINY=1e-300,b=x+1-a,c=1/TINY,d=1/b,h=d,i;
 for(i=1;i<100000;i++){var an=-i*(i-a);b+=2;d=an*d+b;if(Math.abs(d)<TINY)d=TINY;c=b+an/c;if(Math.abs(c)<TINY)c=TINY;d=1/d;var del2=d*c;h*=del2;if(Math.abs(del2-1)<1e-15)break;}
 return -x+a*Math.log(x)-lgam(a)+Math.log(h);}
function mk(lnp,extra){if(!(lnp<0))lnp=lnp>0?0:lnp;if(lnp!==lnp)lnp=NaN;var l10=lnp/LN10,o=extra||{};o.p=Math.pow(10,l10);o.log10p=l10;return o;}
/* cauda bicaudal da t: ln p = ln I_{df/(df+t²)}(df/2,1/2); x e y informados para precisão */
function lnTwoT(t,df){var t2=t*t,x=df/(df+t2),y=t2/(df+t2);return lnIbeta(x,y,df/2,.5);}
function pCorr(r,n,tipo){
 var df=n-2;
 if(!(df>0)||r!==r)return {t:NaN,df:df,p:NaN,log10p:NaN};
 if(Math.abs(r)>=1)return {t:r>0?Infinity:-Infinity,df:df,p:0,log10p:-Infinity};
 var r2=r*r,t=r*Math.sqrt(df/(1-r2)),lp=lnIbeta(1-r2,r2,df/2,.5);   /* x = df/(df+t²) = 1-r² */
 return mk(lp,{t:t,df:df,tipo:tipo||'pearson'});}
/* quantil normal por bissecção em ln Q(1/2,z²/2) = ln(2·sf) */
function normQuantile(p){
 if(!(p>0&&p<1))return NaN;if(p===.5)return 0;
 var q=p<.5?p:1-p,tgt=Math.log(2*q),lo=0,hi=40,mid,i;
 for(i=0;i<200;i++){mid=(lo+hi)/2;if(lnQgam(.5,mid*mid/2)>tgt)lo=mid;else hi=mid;}
 return p<.5?-(lo+hi)/2:(lo+hi)/2;}
function ciCorr(r,n,nivel){
 nivel=nivel||.95;if(!(n>3)||r!==r)return [NaN,NaN];
 if(Math.abs(r)>=1)return [r,r];
 var z=normQuantile(1-(1-nivel)/2),f=Math.atanh(r),se=1/Math.sqrt(n-3);
 return [Math.tanh(f-z*se),Math.tanh(f+z*se)];}
function clean(a){var o=[],i,x;for(i=0;i<a.length;i++){x=a[i];if(typeof x==='number'&&x===x&&isFinite(x))o.push(x);}return o;}
function msv(a){var n=a.length,m=0,i;for(i=0;i<n;i++)m+=a[i];m/=n;var s=0;for(i=0;i<n;i++)s+=(a[i]-m)*(a[i]-m);return {n:n,m:m,v:n>1?s/(n-1):NaN,ss:s};}
function anova(gr){
 var G=gr.map(clean).filter(function(g){return g.length>0;}),k=G.length,N=0,gm=0,i,j;
 G.forEach(function(g){N+=g.length;g.forEach(function(x){gm+=x;});});gm/=N||1;
 var ssb=0,ssw=0;G.forEach(function(g){var s=msv(g);ssb+=g.length*(s.m-gm)*(s.m-gm);ssw+=s.ss;});
 var d1=k-1,d2=N-k;
 if(d1<1||d2<1)return {F:NaN,df1:d1,df2:d2,p:NaN,log10p:NaN,eta2:NaN};
 var sst=ssb+ssw,F=ssw>0?(ssb/d1)/(ssw/d2):Infinity,eta=sst>0?ssb/sst:NaN;
 if(!isFinite(F))return {F:F,df1:d1,df2:d2,p:0,log10p:-Infinity,eta2:eta};
 var u=d1*F,x=d2/(d2+u),y=u/(d2+u);
 return mk(lnIbeta(x,y,d2/2,d1/2),{F:F,df1:d1,df2:d2,eta2:eta});}
function welchS(m1,v1,n1,m2,v2,n2){
 var a=v1/n1,b=v2/n2,se2=a+b,diff=m1-m2;
 if(!(n1>1&&n2>1)||!(se2>0))return {t:NaN,df:NaN,p:NaN,log10p:NaN,diff:diff};
 var t=diff/Math.sqrt(se2),df=se2*se2/(a*a/(n1-1)+b*b/(n2-1));
 return mk(lnTwoT(t,df),{t:t,df:df,diff:diff});}
function welch(A,B){A=clean(A);B=clean(B);var s=msv(A),u=msv(B);return welchS(s.m,s.v,s.n,u.m,u.v,u.n);}
function kruskal(gr){
 var G=gr.map(clean).filter(function(g){return g.length>0;}),k=G.length,all=[],i,j;
 G.forEach(function(g,gi){g.forEach(function(x){all.push([x,gi]);});});
 var N=all.length;all.sort(function(p,q){return p[0]-q[0];});
 var rs=new Array(k).fill(0),ties=0;i=0;
 while(i<N){j=i;while(j+1<N&&all[j+1][0]===all[i][0])j++;var rk=(i+j)/2+1,t=j-i+1;for(var q=i;q<=j;q++)rs[all[q][1]]+=rk;if(t>1)ties+=t*t*t-t;i=j+1;}
 var H=0;for(i=0;i<k;i++)H+=rs[i]*rs[i]/G[i].length;
 H=12/(N*(N+1))*H-3*(N+1);var corr=1-ties/(N*N*N-N);
 var df=k-1;if(df<1||!(corr>0))return {H:NaN,df:df,p:NaN,log10p:NaN};
 H/=corr;return mk(lnQgam(df/2,H/2),{H:H,df:df});}
function sup(s){var m={'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','-':'⁻'};return String(s).replace(/./g,function(c){return m[c]||c;});}
function fmtP(res,lang){
 var l10=(res!==null&&typeof res==='object')?res.log10p:res,en=lang==='en'||(lang===undefined&&window.__LANG==='en');
 if(l10===undefined||l10!==l10)return 'p = –';
 var dec=function(s){return en?s:s.replace('.',',');};
 if(l10<-300)return 'p < 1e-300';
 if(l10>=-3){var p=Math.min(.9999,Math.pow(10,l10));return 'p = '+dec(p.toFixed(4));}
 var e=Math.floor(l10),m=Math.pow(10,l10-e);if(m>=9.95){m=1;e+=1;}
 return 'p ≈ '+dec(m.toFixed(1))+'×10'+sup(e);}
function fdr(P){
 var m=P.length,idx=[],i;for(i=0;i<m;i++)idx.push(i);
 var ok=idx.filter(function(i){return P[i]===P[i]&&P[i]!==null;}).sort(function(a,b){return P[a]-P[b];}),n=ok.length,Q=new Array(m).fill(NaN),run=1;
 for(i=n-1;i>=0;i--){var q=P[ok[i]]*n/(i+1);if(q<run)run=q;Q[ok[i]]=Math.min(1,run);}
 return Q;}
function fdrLog(L,m){
 var M=L.length,ok=[],i;for(i=0;i<M;i++)if(L[i]===L[i]&&L[i]!==null)ok.push(i);
 ok.sort(function(a,b){return L[a]-L[b];});var n=ok.length,fam=Math.max(m||n,n),Q=new Array(M).fill(NaN),run=0;
 for(i=n-1;i>=0;i--){var q=L[ok[i]]+Math.log10(fam/(i+1));if(q<run)run=q;Q[ok[i]]=Math.min(0,run);}
 return Q;}
function holmLog(L){
 var M=L.length,ok=[],i;for(i=0;i<M;i++)if(L[i]===L[i])ok.push(i);ok.sort(function(a,b){return L[a]-L[b];});
 var n=ok.length,Q=new Array(M).fill(NaN),run=-Infinity;
 for(i=0;i<n;i++){var q=Math.min(0,L[ok[i]]+Math.log10(n-i));if(q>run)run=q;Q[ok[i]]=run;}
 return Q;}
function holm(P){return holmLog(P.map(function(p){return p>0?Math.log10(p):-Infinity;})).map(function(l){return Math.pow(10,l);});}
window.__stats={pCorr:pCorr,ciCorr:ciCorr,anova:anova,welch:welch,welchS:welchS,kruskal:kruskal,fmtP:fmtP,fdr:fdr,fdrLog:fdrLog,holm:holm,holmLog:holmLog,normQuantile:normQuantile,_lnIbeta:lnIbeta,_lnQgam:lnQgam};
})();
