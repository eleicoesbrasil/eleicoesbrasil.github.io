import json, time, os, re, glob, sys
D=sys.argv[1] if len(sys.argv)>1 else 'docs/dados/derivados'   # JSON gerados por gerar_dados_site.py
G=sys.argv[2] if len(sys.argv)>2 else 'dados/geo'          # malha das UFs (IBGE), baixada por 03_gerar_site.sh
OUT=sys.argv[3] if len(sys.argv)>3 else 'docs/2026/presidente/index.html'
M='site_build/modelos'
S='.'
fluxo=json.load(open(f'{D}/mun_fluxo.json'))
bins=json.load(open(f'{D}/abst_bins.json'))
nsec=sum(b['n'] for b in bins)
XY=json.load(open(f'{D}/mun_xy.json'))
IBGE={'11':'RO','12':'AC','13':'AM','14':'RR','15':'PA','16':'AP','17':'TO','21':'MA','22':'PI','23':'CE','24':'RN','25':'PB','26':'PE','27':'AL','28':'SE','29':'BA','31':'MG','32':'ES','33':'RJ','35':'SP','41':'PR','42':'SC','43':'RS','50':'MS','51':'MT','52':'GO','53':'DF'}
mun_arr=[]
for r in fluxo:
    k=f"{r[0]}-{r[1]}"
    if k in XY:
        nm,la,lo=XY[k]
        L1,F1,L2,F2=r[3],r[4],r[11],r[12]
        mun_arr.append([r[2],r[0],round(la,3),round(lo,3),L1,F1,L2,F2,1,1])
def ring(r): return [[round(x,2),round(y,2)] for x,y in r]
ufg=[]
for ft in json.load(open(f'{G}/uf.json'))['features']:
    g=ft['geometry']; polys=[g['coordinates']] if g['type']=='Polygon' else g['coordinates']
    rings=[ring(p[0]) for p in polys]; allp=[c for r in rings for c in r]
    ufg.append({'u':IBGE[ft['properties']['codarea']],'p':rings,'c':[sum(c[0] for c in allp)/len(allp),sum(c[1] for c in allp)/len(allp)]})
heat=open(f'{M}/heat_tpl2.html').read().replace('__MUN__',json.dumps(mun_arr,ensure_ascii=False,separators=(',',':'))).replace('__UFG__',json.dumps(ufg,separators=(',',':')))
i=heat.index('<script>'); heat_html,heat_js=heat[:i],heat[i:]
close_path=f'{D}/close_tab.json'
if os.path.exists(close_path) and os.path.exists(f'{M}/close_tab.html'):
    CL=open(close_path).read(); fech=open(f'{M}/close_tab.html').read(); closejs=open(f'{M}/close_tab.js').read()
    if os.path.exists(f'{M}/close_bars.html'):
        fech=fech.replace('</section>','</section>\n'+open(f'{M}/close_bars.html').read(),1); closejs+=open(f'{M}/close_bars.js').read()
else:
    CL='null'; closejs='<script>window.__closeInit=function(){};</script>'
    fech='<section><h2>Fechamento das urnas</h2><p class="sub">Esta aba depende dos arquivos de urna do TSE (boletins com horário de abertura e fechamento). Eles estão sendo baixados e ainda não há UFs completas para analisar.</p></section>'
t=open(f'{M}/tpl2.html').read().replace('__ABSSIZE__',open(f'{D}/abst_size.json').read() if os.path.exists(f'{D}/abst_size.json') else 'null').replace('__COV__',open(f'{D}/cobertura.json').read() if os.path.exists(f'{D}/cobertura.json') else 'null')
t=(t.replace('__FLUXO__',json.dumps(fluxo,ensure_ascii=False,separators=(',',':'))).replace('__BINS__',json.dumps(bins,separators=(',',':'))).replace('__CLOSE__',CL)
    .replace('__HORA__',time.strftime('%H:%M',time.localtime(time.time()-4*3600))).replace('__NSEC__',f"{nsec:,}".replace(',','.'))
    .replace('__REPLICAR__',open(f'{M}/replicar_tab.html').read()).replace('__SECOES__',open(f'{M}/secoes_tab.html').read()).replace('__SECOESJS__',open(f'{M}/secoes_tab.js').read()).replace('__CRUZ__',open(f'{M}/cruz_tab.html').read()).replace('__CRUZJS__',open(f'{M}/cruz_tab.js').read()).replace('__ACHADOS__',open(f'{M}/achados_tab.html').read()).replace('__ACHADOSJS__',open(f'{M}/achados_tab.js').read()).replace('__FECH__',fech).replace('__HEAT__',heat_html).replace('__HEATJS__',heat_js).replace('__CLOSEJS__',closejs))
import subprocess
subprocess.run([sys.executable,'i18n_dict.py'],check=True,capture_output=True,cwd=M)
if os.path.exists(f'{M}/abst_corr.html'):
    _ac=open(f'{M}/abst_corr.html').read(); _mk=' <section>\n  <h2>Tamanho da seção e variação da abstenção</h2>'
    if _mk in t: t=t.replace(_mk,_ac+open(f'{M}/abst_corr.js').read()+_mk,1)
t=t.replace('__I18N__',open(f'{M}/i18n_tpl.js').read().replace('__I18N_DATA__',open(f'{M}/i18n_data.json').read()))
t=t.replace('<header>\n','<header>\n<a class="back" href="../../">← Eleições Brasil</a>\n',1).replace('</style>','.back{display:inline-block;font-size:13px;color:var(--mute);margin-bottom:8px;text-decoration:none}</style>',1)
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from envelope import envolver
import glob as _g
t=t.replace('/*__CRUZCSS__*/',open(f'{M}/cruz_tab.css').read())
t=t.replace('/*__ACHADOSCSS__*/',open(f'{M}/achados_tab.css').read())
t=t.replace('/*__MOBILE_CSS__*/',''.join(open(f).read()+'\n' for f in sorted(_g.glob(f'{M}/global_*.css'))+sorted(_g.glob(f'{M}/mobile_*.css')))).replace('__MOBILEJS__',''.join('<script>'+open(f).read()+'</script>\n' for f in sorted(_g.glob(f'{M}/global_*.js'))+sorted(_g.glob(f'{M}/mobile_*.js'))))
t=envolver(t)
os.makedirs(os.path.dirname(OUT) or '.',exist_ok=True); open(OUT,'w').write(t)
print(len(t)//1024,'KB')
