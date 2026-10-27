"""Gera dados_externos/parciais/resultados.json (res22_*, res26_*) por município (IBGE 7 dígitos).

Fontes: 2026 -> docs/dados/parquet/presidente_secoes_2026_{1t,2t_provisorio}.parquet (por seção; fecha = encerramento_brasilia)
        2022 -> data/urnas_bweb/2022_{1t,2t}_*.parquet (por seção; fecha local da urna + fuso: AC +120, AM/RO/RR/MT/MS +60)
Chave TSE->IBGE: /mnt/e/EleicoesBrasil_externos/chaves/municipios_brasileiros_tse.csv (validada por anti-join; exterior ZZ fora).
Uso: .venv/bin/python site_build/ext/resultados_para_parcial.py
"""
import json, glob, sys, unicodedata
from pathlib import Path
import duckdb

ROOT = Path('/mnt/d/01_claudeCode/10_EleicoesBrasil')
PQ = ROOT / 'github/eleicoesbrasil/docs/dados/parquet'
BW = ROOT / 'data/urnas_bweb'
CHAVE = '/mnt/e/EleicoesBrasil_externos/chaves/municipios_brasileiros_tse.csv'
OUT = ROOT / 'dados_externos/parciais/resultados.json'
OFF = {'AC': 120, 'AM': 60, 'RO': 60, 'RR': 60, 'MT': 60, 'MS': 60}
DATA = {(2022, '1t'): '2022-10-02', (2022, '2t'): '2022-10-30', (2026, '1t'): '2026-10-04', (2026, '2t'): '2026-10-25'}
DMIN, DMAX = -180, 720   # atraso fora disso = relógio da urna inválido (descartado só no atraso)

c = duckdb.connect()
off = "case " + " ".join(f"when uf='{k}' then {v}" for k, v in OFF.items()) + " else 0 end"
parts = []
for ano, t, f in ((2026, '1t', PQ / 'presidente_secoes_2026_1t.parquet'), (2026, '2t', PQ / 'presidente_secoes_2026_2t_provisorio.parquet')):
    parts.append(f"""select {ano} ano,'{t}' turno,uf,cd_municipio tse,aptos,comparecimento comp,votos_13 L,votos_22 F,votos_outros O,votos_brancos B,votos_nulos N,
      epoch(encerramento_brasilia - timestamp '{DATA[(ano,t)]} 17:00:00')/60.0 delta from read_parquet('{f}')""")
files = sorted(glob.glob(str(BW / '2022_*.parquet')))
parts.append(f"""select ano,turno,uf,mun tse,aptos,comp,L,F,O,B,N,
  epoch(strptime(fecha,'%Y%m%dT%H%M%S') + ({off})*interval 1 minute - (case when turno='1t' then timestamp '2022-10-02 17:00:00' else timestamp '2022-10-30 17:00:00' end))/60.0 delta
  from read_parquet({files!r}, union_by_name=true) where ano=2022""")
c.execute("create table s as select * from (" + " union all ".join(parts) + ") where uf<>'ZZ'")
print('seções:', c.execute("select ano,turno,count(*),sum(L),sum(F) from s group by 1,2 order by 1,2").fetchall())

# ---- chave TSE -> IBGE + anti-join
c.execute(f"create table k as select codigo_tse::int tse, uf, nome_municipio nm, codigo_ibge::varchar ibge from read_csv('{CHAVE}', header=true, all_varchar=true)")
rel = {}
rel['chave_sem_base'] = c.execute("select k.uf,k.tse,k.nm from k anti join (select distinct uf,tse from s) b using(uf,tse)").fetchall()
rel['base_sem_chave'] = c.execute("select ano,turno,uf,tse,count(*) from s anti join k using(uf,tse) group by all").fetchall()
print('anti-join: chave sem base =', len(rel['chave_sem_base']), '| base sem chave =', len(rel['base_sem_chave']))
for r in rel['chave_sem_base'][:20]: print('  chave sem base', r)
for r in rel['base_sem_chave'][:20]: print('  base sem chave', r)
# Boa Esperança do Norte/MT (TSE 73709, novo em 2026, desmembrado de Sorriso) não existe na lista de 5.570 IBGE: soma em Sorriso (TSE 3 ... via nome) para
# preservar totais nacionais e a comparabilidade 2026-2022. Ver RELATORIO_RESULTADOS.md.
c.execute("create table sk as select s.*, k.ibge from s join k using(uf,tse)")
c.execute("insert into sk select s.*, (select ibge from k where uf='MT' and nm='SORRISO') from s where uf='MT' and tse=73709")

# ---- agregação por município/ano/turno
c.execute("""create table m as select ibge, ano, turno, sum(aptos) ap, sum(comp) cp, sum(L) L, sum(F) F, sum(O) O, sum(B) B, sum(N) N,
  avg(greatest(delta,0)) filter(where delta between ? and ?) atr, 100.0*avg((delta>15)::int) filter(where delta between ? and ?) p15
  from sk group by 1,2,3""", [DMIN, DMAX, DMIN, DMAX])
ibge = sorted(r[0] for r in c.execute("select distinct ibge from m").fetchall())
idx = {x: i for i, x in enumerate(ibge)}
M = {}
for r in c.execute("select * from m").fetchall():
    M[(r[0], r[1], r[2])] = r
def div(a, b): return None if not b else 100.0 * a / b
def base(ano, t, i):
    r = M.get((i, ano, t))
    if not r or not r[3]: return None
    _, _, _, ap, cp, L, F, O, B, N, atr, p15 = r
    val = L + F + O
    return dict(aptos=ap, comp=cp, abst=div(ap - cp, ap), brancos=B, nulos=N, lula=L, adv=F, outros=O,
                plula=div(L, val), padv=div(F, val), pbr=div(B, cp), pnu=div(N, cp),
                margem=(div(L, val) - div(F, val)) if val else None, atr=atr, p15=p15)

cols, vars_ = {}, []
def add(k, pt, en, grupo_pt, grupo_en, un, dec, ano, nota_pt, nota_en, fn, papel='resultado'):
    cols[k] = [fn(i) for i in ibge]
    vars_.append(dict(k=k, pt=pt, en=en, grupo_pt=grupo_pt, grupo_en=grupo_en, fonte='TSE (resultados por seção)', unidade=un, dec=dec,
                      ano=ano, tipo='num', papel=papel, nota_pt=nota_pt, nota_en=nota_en))
def g(ano, t, f):
    return lambda i: (lambda b: None if b is None else b[f])(base(ano, t, i))
def dif(a1, t1, f1, a2, t2, f2):
    def h(i):
        x, y = base(a1, t1, i), base(a2, t2, i)
        if x is None or y is None or x[f1] is None or y[f2] is None: return None
        return x[f1] - y[f2]
    return h

PROV_PT = ' PROVISÓRIO: 2º turno de 2026 com ~98% das seções apuradas; valores mudam até a totalização final.'
PROV_EN = ' PROVISIONAL: 2026 runoff with ~98% of polling stations counted; values change until final tally.'
ADV = {2022: ('Bolsonaro', 'Bolsonaro'), 2026: ('Flávio Bolsonaro', 'Flávio Bolsonaro')}
TL = {'t1': (1, '1t', '1º turno', '1st round'), 't2': (2, '2t', '2º turno', 'runoff')}
for ano in (2022, 2026):
    p = f'res{str(ano)[2:]}_'
    advp, adve = ADV[ano]
    gp, ge = f'Resultado presidencial {ano}', f'Presidential result {ano}'
    for tk, (_, t, tp, te) in TL.items():
        prov = ano == 2026 and t == '2t'
        np_ = (PROV_PT if prov else ''); ne = (PROV_EN if prov else '')
        lab = f'{ano} {tp}'; labe = f'{ano} {te}'
        def A(name, pt, en, un, dec, field, npt, nen, papel='resultado'):
            add(f'{p}{tk}_{name}', f'{pt} ({lab})', f'{en} ({labe})', gp, ge, un, dec, ano, npt + np_, nen + ne, g(ano, t, field), papel)
        A('aptos', 'Eleitores aptos', 'Eligible voters', 'eleitores', 0, 'aptos', 'Soma das seções do município (exceto exterior). Peso padrão do painel.', 'Sum of polling stations in the municipality (excl. abroad). Default panel weight.', papel='peso')
        A('comp', 'Comparecimento', 'Turnout (voters)', 'eleitores', 0, 'comp', 'Eleitores que compareceram.', 'Voters who turned out.')
        A('abst', 'Abstenção', 'Abstention', '%', 2, 'abst', '(aptos − comparecimento) / aptos.', '(eligible − turnout) / eligible.')
        A('brancos', 'Votos em branco', 'Blank votes', 'votos', 0, 'brancos', '', '')
        A('nulos', 'Votos nulos', 'Null votes', 'votos', 0, 'nulos', '', '')
        A('lula', 'Votos de Lula', 'Votes for Lula', 'votos', 0, 'lula', 'Candidato nº 13.', 'Candidate no. 13.')
        A('adv', f'Votos de {advp}', f'Votes for {adve}', 'votos', 0, 'adv', 'Principal adversário de Lula (nº 22).', "Lula's main opponent (no. 22).")
        A('outros', 'Votos em outros candidatos', 'Votes for other candidates', 'votos', 0, 'outros', 'Zero no 2º turno.', 'Zero in the runoff.')
        A('plula', 'Lula (% dos válidos)', 'Lula (% of valid votes)', '%', 2, 'plula', 'Válidos = Lula + adversário + outros (sem brancos e nulos).', 'Valid = Lula + opponent + others (excl. blank and null).')
        A('padv', f'{advp} (% dos válidos)', f'{adve} (% of valid votes)', '%', 2, 'padv', 'Válidos = Lula + adversário + outros.', 'Valid = Lula + opponent + others.')
        A('pbr', 'Brancos (% do comparecimento)', 'Blank (% of turnout)', '%', 2, 'pbr', 'Denominador: comparecimento.', 'Denominator: turnout.')
        A('pnu', 'Nulos (% do comparecimento)', 'Null (% of turnout)', '%', 2, 'pnu', 'Denominador: comparecimento.', 'Denominator: turnout.')
        A('margem', 'Margem Lula − adversário', 'Margin Lula − opponent', 'pp', 2, 'margem', 'Diferença em pontos percentuais dos votos válidos (positivo = Lula à frente).', 'Difference in percentage points of valid votes (positive = Lula ahead).')
        A('atraso', 'Atraso médio de fechamento das urnas', 'Mean ballot-box closing delay', 'min', 1, 'atr',
          'Média, por seção, de minutos após 17h de Brasília (fuso: AC +120; AM/RO/RR/MT/MS +60; seções fechadas antes das 17h contam 0; relógios inválidos descartados).',
          'Mean per station of minutes after 17:00 Brasília time (zone offsets applied; early closings count as 0; invalid clocks dropped).')
        A('atraso15', 'Seções fechadas após +15 min', 'Stations closed after +15 min', '% das seções', 1, 'p15', '% de seções que fecharam mais de 15 min depois das 17h de Brasília.', '% of stations that closed more than 15 min after 17:00 Brasília.')
    # variações 2º - 1º
    gv = f'Variação 2º−1º turno {ano}'; gve = f'Change runoff − 1st round {ano}'
    pv = (PROV_PT if ano == 2026 else ''); ev = (PROV_EN if ano == 2026 else '')
    for name, pt, en, un, dec, f in (('abst', 'Abstenção', 'Abstention', 'pp', 2, 'abst'), ('lula', 'Lula (% válidos)', 'Lula (% valid)', 'pp', 2, 'plula'),
                                     ('adv', f'{advp} (% válidos)', f'{adve} (% valid)', 'pp', 2, 'padv'),
                                     ('lula_votos', 'Votos de Lula', 'Votes for Lula', 'votos', 0, 'lula'), ('adv_votos', f'Votos de {advp}', f'Votes for {adve}', 'votos', 0, 'adv')):
        add(f'{p}d21_{name}', f'Δ 2º−1º turno {ano}: {pt}', f'Δ runoff−1st {ano}: {en}', gv, gve, un, dec, ano,
            f'Valor do 2º turno menos o do 1º turno.' + pv, 'Runoff value minus 1st-round value.' + ev, dif(ano, '2t', f, ano, '1t', f))
# variações 2026 - 2022 (guardadas em res26_)
for tk, (_, t, tp, te) in TL.items():
    for name, pt, en, f in (('lula', 'Lula (% válidos)', 'Lula (% valid)', 'plula'), ('adv', 'adversário (% válidos)', 'opponent (% valid)', 'padv'), ('abst', 'Abstenção', 'Abstention', 'abst')):
        pv = PROV_PT if t == '2t' else ''; ev = PROV_EN if t == '2t' else ''
        add(f'res26_d2622_{tk}_{name}', f'Δ 2026−2022, {tp}: {pt}', f'Δ 2026−2022, {te}: {en}', 'Variação 2026−2022', 'Change 2026−2022', 'pp', 2, 2026,
            f'Mesmo turno: 2026 menos 2022, em pontos percentuais. Adversário: Flávio Bolsonaro (2026) vs Jair Bolsonaro (2022).' + pv,
            'Same round: 2026 minus 2022, percentage points. Opponent: Flávio Bolsonaro (2026) vs Jair Bolsonaro (2022).' + ev, dif(2026, t, f, 2022, t, f))

def rnd(v, d): return None if v is None else round(v, d)
dec = {v['k']: v['dec'] for v in vars_}
for k in cols: cols[k] = [rnd(x, dec[k]) if dec[k] else (None if x is None else int(round(x))) for x in cols[k]]
OUT.parent.mkdir(parents=True, exist_ok=True)
json.dump({'fonte': 'resultados_tse', 'ibge': ibge, 'vars': vars_, 'cols': cols}, open(OUT, "w"), ensure_ascii=False, separators=(',', ':'))

# ---- validação nacional
print('municípios:', len(ibge), '| vars:', len(vars_))
for ano in (2022, 2026):
    for t in ('1t', '2t'):
        print(ano, t, c.execute("select count(distinct ibge), sum(L), sum(F), sum(O), sum(B), sum(N), sum(ap), sum(cp) from m where ano=? and turno=?", [ano, t]).fetchall())
print('atraso:', c.execute("select ano,turno,round(avg(atr),1),round(avg(p15),1),count(*) from m group by 1,2 order by 1,2").fetchall())
print('relógios descartados:', c.execute("select ano,turno,count(*) from sk where delta is null or delta not between ? and ? group by 1,2 order by 1,2", [DMIN, DMAX]).fetchall())
json.dump(rel, open('/tmp/claude-1000/-mnt-d-01-claudeCode/754ceff2-2ff7-4533-8e1a-9a081ffc0768/scratchpad/anti_join.json', 'w'), default=str)
