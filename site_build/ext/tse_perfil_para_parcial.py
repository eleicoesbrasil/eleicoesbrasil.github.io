"""Gera dados_externos/parciais/tse_perfil.json (prefixo tse22_/tse26_) por município (IBGE 7 dígitos).

Fontes (/mnt/e/EleicoesBrasil_externos/tse/, ZIPs extraídos em TSE_CACHE, uma pasta por ZIP):
  perfil_eleitorado_2022.zip             -> composição do eleitorado 2022 (idade, escolaridade, gênero, biometria, deficiência)
  perfil_comparecimento_abstencao_{2022,2026}.zip -> abstenção por perfil (turnos 1 e 2 em 2022; só 1º turno em 2026) e
                                            composição do eleitorado 2026 (QT_APTOS do 1º turno; perfil_eleitorado_2026 ainda não baixado)
  eleitorado_local_votacao_{2022,2026}.zip -> locais de votação, seções agregadas, acessibilidade (turno 1)
  secoes_agregadas_2022.zip              -> só conferência (as seções agregadas já vêm no arquivo de locais)
Pendentes (não baixados): perfil_eleitorado_2026, perfil_filiacao_partidaria.
Uso: .venv/bin/python site_build/ext/tse_perfil_para_parcial.py   (TSE_CACHE=<dir> opcional)
"""
import json, os, zipfile
from pathlib import Path
import duckdb

ROOT = Path('/mnt/d/01_claudeCode/10_EleicoesBrasil')
TSE = Path('/mnt/e/EleicoesBrasil_externos/tse')
CACHE = Path(os.environ.get('TSE_CACHE', '/mnt/e/EleicoesBrasil_externos/tse/_x'))
CHAVE = '/mnt/e/EleicoesBrasil_externos/chaves/municipios_brasileiros_tse.csv'
PARC = ROOT / 'dados_externos/parciais'
OUT = PARC / 'tse_perfil.json'
MINN = 30   # grupos com menos de 30 aptos -> taxa de abstenção null

def unzip(name):
    d = CACHE / name
    if not d.exists() or not any(d.glob('*.csv')):
        d.mkdir(parents=True, exist_ok=True)
        zipfile.ZipFile(TSE / f'{name}.zip').extractall(d)
    return d

def rd(f):
    return f"read_csv('{f}',delim=';',header=true,all_varchar=true,encoding='latin-1',quote='\"',ignore_errors=true)"

def brasil(d, base):
    f = d / f'{base}_BRASIL.csv'
    return rd(f) if f.exists() else rd(str(d / f'{base}_*.csv').replace('[', '[[]'))

c = duckdb.connect()
c.execute("pragma threads=8")
c.execute(f"create table k as select codigo_tse::int tse, uf, nome_municipio nm, codigo_ibge::varchar ibge from read_csv('{CHAVE}', header=true, all_varchar=true)")
# Boa Esperança do Norte/MT (novo em 2026, desmembrado de Sorriso): TSE 73709 não está na tabela -> soma em Sorriso (como em resultados.json)
c.execute("create table kk as select * from k")
SORRISO = c.execute("select ibge from k where uf='MT' and nm='SORRISO'").fetchone()[0]

IDADE = "case when cd_fx in (1600,1700) then '1617' when cd_fx in (1800,1900,2000,2124) then '1824' when cd_fx in (2529,3034) then '2534' when cd_fx in (3539,4044) then '3544' when cd_fx in (4549,5054,5559) then '4559' when cd_fx in (6064,6569) then '6069' when cd_fx>=7074 then '70p' end"
def esc(col): return f"case when {col} like 'ANALFABETO%' then 'analf' when {col} like 'LE E ESCREVE%' then 'lee' when {col} like 'ENSINO FUNDAMENTAL%' then 'fund' when {col} like 'ENSINO MEDIO%' then 'med' when {col} like 'SUPERIOR%' then 'sup' end"

def tse_to_ibge(tbl):
    """acrescenta coluna ibge; anti-join relatado."""
    c.execute(f"create table {tbl}_i as select t.*, coalesce(k.ibge, case when t.uf='MT' and t.tse=73709 then '{SORRISO}' end) ibge from {tbl} t left join k on k.tse=t.tse and k.uf=t.uf")
    miss = c.execute(f"select uf,tse,count(*) from {tbl}_i where ibge is null and uf<>'ZZ' group by all").fetchall()
    print(tbl, 'sem chave (exceto ZZ):', miss)
    return miss

# ------------------------------------------------------------------ perfil do eleitorado 2022
d = unzip('perfil_eleitorado_2022')
c.execute(f"""create table p22 as select SG_UF uf, CD_MUNICIPIO::int tse, {IDADE.replace('cd_fx','CD_FAIXA_ETARIA::int')} idade,
  {esc("upper(strip_accents(DS_GRAU_ESCOLARIDADE))")} esc, upper(strip_accents(DS_GENERO)) gen,
  QT_ELEITORES::bigint q, QT_ELEITORES_BIOMETRIA::bigint bio, QT_ELEITORES_DEFICIENCIA::bigint def
  from {brasil(d,'perfil_eleitorado_2022')} where SG_UF<>'ZZ'""")
tse_to_ibge('p22')
c.execute("""create table agg_p22 as select ibge, sum(q) tot, sum(bio) bio, sum(def) def,
  sum(q) filter(where idade is not null) idade_ok,
  sum(q) filter(where gen in ('FEMININO','MASCULINO')) gen_ok,
  sum(q) filter(where esc is not null) esc_ok,
  sum(q) filter(where idade='1617') i1617, sum(q) filter(where idade='1824') i1824, sum(q) filter(where idade='2534') i2534,
  sum(q) filter(where idade='3544') i3544, sum(q) filter(where idade='4559') i4559, sum(q) filter(where idade='6069') i6069, sum(q) filter(where idade='70p') i70p,
  sum(q) filter(where gen='FEMININO') fem, sum(q) filter(where gen='MASCULINO') masc,
  sum(q) filter(where esc='analf') analf, sum(q) filter(where esc='lee') lee, sum(q) filter(where esc='fund') fund, sum(q) filter(where esc='med') med, sum(q) filter(where esc='sup') sup
  from p22_i group by 1""")

# ------------------------------------------------------------------ comparecimento/abstenção por perfil
def load_comp(ano):
    d = unzip(f'perfil_comparecimento_abstencao_{ano}')
    ecol = 'DS_GRAU_ESCOLARIDADE' if ano == 2022 else 'DS_GRAU_INSTRUCAO'
    c.execute(f"""create table c{ano} as select SG_UF uf, CD_MUNICIPIO::int tse, NR_TURNO::int t, {IDADE.replace('cd_fx','CD_FAIXA_ETARIA::int')} idade,
      {esc(f"upper(strip_accents({ecol}))")} esc, upper(strip_accents(DS_GENERO)) gen, upper(strip_accents(DS_COR_RACA)) raca,
      QT_APTOS::bigint ap, QT_COMPARECIMENTO::bigint cp, QT_ABSTENCAO::bigint ab,
      QT_COMPARECIMENTO_DEFICIENCIA::bigint cd_, QT_ABSTENCAO_DEFICIENCIA::bigint ad_,
      QT_COMPAREC_FACULTATIVO::bigint cf, QT_ABST_FACULTATIVO::bigint af, QT_COMPAREC_OBRIGATORIO::bigint co, QT_ABST_OBRIGATORIO::bigint ao
      from {brasil(d, f'perfil_comparecimento_abstencao_{ano}')} where SG_UF<>'ZZ'""")
    tse_to_ibge(f'c{ano}')
for a in (2022, 2026): load_comp(a)

# agregados por município x turno (conditional sums)
def agg_comp(ano):
    cols = ["sum(ap) ap", "sum(cp) cp", "sum(ab) ab", "sum(ap) filter(where idade is not null) ap_i", "sum(ap) filter(where esc is not null) ap_e",
            "sum(ap) filter(where gen in ('FEMININO','MASCULINO')) ap_g",
            "sum(cd_+ad_) apd", "sum(ad_) abd", "sum(cf+af) apf", "sum(af) abf", "sum(co+ao) apo", "sum(ao) abo"]
    for g in ('1617', '1824', '2534', '3544', '4559', '6069', '70p'):
        cols += [f"sum(ap) filter(where idade='{g}') ap_i{g}", f"sum(ab) filter(where idade='{g}') ab_i{g}"]
    for g in ('analf', 'lee', 'fund', 'med', 'sup'):
        cols += [f"sum(ap) filter(where esc='{g}') ap_e{g}", f"sum(ab) filter(where esc='{g}') ab_e{g}"]
    for g, v in (('fem', 'FEMININO'), ('masc', 'MASCULINO')):
        cols += [f"sum(ap) filter(where gen='{v}') ap_g{g}", f"sum(ab) filter(where gen='{v}') ab_g{g}"]
    for g, v in (('branca', 'BRANCA'), ('preta', 'PRETA'), ('parda', 'PARDA'), ('amarela', 'AMARELA'), ('indigena', 'INDIGENA')):
        cols += [f"sum(ap) filter(where raca='{v}') ap_r{g}", f"sum(ab) filter(where raca='{v}') ab_r{g}"]
    cols += ["sum(ap) filter(where raca<>'NAO INFORMADO') ap_r"]
    c.execute(f"create table agg_c{ano} as select ibge, t, {', '.join(cols)} from c{ano}_i group by 1,2")
for a in (2022, 2026): agg_comp(a)

# ------------------------------------------------------------------ locais de votação (turno 1)
def load_loc(ano):
    d = unzip(f'eleitorado_local_votacao_{ano}')
    base = f'eleitorado_local_votacao_{ano}'
    f = d / f'{base}.csv'
    src = rd(f) if f.exists() else brasil(d, base)
    c.execute(f"""create table l{ano} as select SG_UF uf, CD_MUNICIPIO::int tse, NR_ZONA zona, NR_SECAO sec, NR_LOCAL_VOTACAO loc,
      upper(strip_accents(DS_TIPO_SECAO_AGREGADA)) agr, upper(strip_accents(DS_TIPO_LOCAL)) tipo, upper(strip_accents(NM_BAIRRO)) bairro,
      upper(strip_accents(DS_SITU_LOCAL_VOTACAO)) sitl, CD_SITU_SECAO_ACESSIBILIDADE acc, QT_ELEITOR_SECAO::bigint q
      from {src} where NR_TURNO='1' and SG_UF<>'ZZ'""")
    tse_to_ibge(f'l{ano}')
    c.execute(f"""create table agg_l{ano} as select ibge, count(distinct zona||'-'||loc) filter(where tipo='CONVENCIONAL' and q>0) nloc,
      count(*) filter(where q>0) nsec, sum(q) q, sum(q) filter(where tipo='CONVENCIONAL') qconv,
      sum(q) filter(where agr='AGREGADA') qagr, count(*) filter(where agr='AGREGADA') nagr,
      sum(q) filter(where acc='1') qacc, sum(q) filter(where bairro like '%RURAL%') qrur,
      sum(q) filter(where tipo='TEMPORARIO') qtmp, sum(q) filter(where sitl='BLOQUEADO') qblq
      from l{ano}_i group by 1""")
for a in (2022, 2026): load_loc(a)

# conferência seções agregadas 2022
d = unzip('secoes_agregadas_2022')
n_sa = c.execute(f"select count(*) from {rd(d / 'secoes_agregadas_2022.csv')} where UF<>'ZZ'").fetchone()[0]
n_la = c.execute("select count(*) from l2022_i where agr='AGREGADA'").fetchone()[0]
print('seções agregadas 2022: arquivo próprio', n_sa, '| no arquivo de locais', n_la)

# 2026: composição = aptos do 1º turno do perfil de comparecimento (perfil_eleitorado_2026 pendente)
ibge = sorted(r[0] for r in c.execute("select distinct ibge from agg_p22 where ibge is not null").fetchall())
idx = {x: i for i, x in enumerate(ibge)}

def fetch(tbl, where=''):
    cur = c.execute(f"select * from {tbl} {where}")
    names = [x[0] for x in cur.description]
    return {r[0]: dict(zip(names, r)) for r in cur.fetchall() if r[0] is not None}
P = fetch("agg_p22")
CP = {(a, t): fetch(f"agg_c{a}", f'where t={t}') for a, t in ((2022, 1), (2022, 2), (2026, 1))}
LO = {a: fetch(f"agg_l{a}") for a in (2022, 2026)}

def pct(n, dn, minn=1):
    return None if (n is None or not dn or dn < minn) else 100.0 * n / dn
cols, vars_ = {}, []
GP, GE = 'Perfil do eleitorado (TSE)', 'Electorate profile (TSE)'
def add(k, pt, en, un, dec, ano, fonte, npt, nen, fn, gsub=None, papel='contexto'):
    cols[k] = [fn(i) for i in ibge]
    gp = 'Eleitorado e participação' if gsub is None else gsub[0]
    ge = 'Electorate and turnout' if gsub is None else gsub[1]
    vars_.append(dict(k=k, pt=pt, en=en, grupo_pt=gp, grupo_en=ge, fonte=fonte, unidade=un, dec=dec, ano=ano, tipo='num', papel=papel, nota_pt=npt, nota_en=nen))

FAC_PT = ' 16-17 anos e 70+ anos têm voto facultativo (assim como analfabetos), então a abstenção desses grupos não é comparável à dos demais.'
FAC_EN = ' Ages 16-17 and 70+ (and illiterate voters) have optional voting, so abstention in these groups is not comparable to the rest.'
IDADES = [('1617', '16-17 anos', '16-17 years'), ('1824', '18-24 anos', '18-24 years'), ('2534', '25-34 anos', '25-34 years'), ('3544', '35-44 anos', '35-44 years'),
          ('4559', '45-59 anos', '45-59 years'), ('6069', '60-69 anos', '60-69 years'), ('70p', '70 anos ou mais', '70 years or older')]
ESCS = [('analf', 'analfabeto', 'illiterate'), ('lee', 'lê e escreve', 'reads and writes'), ('fund', 'ensino fundamental (completo ou incompleto)', 'primary/lower-secondary (complete or not)'),
        ('med', 'ensino médio (completo ou incompleto)', 'secondary (complete or not)'), ('sup', 'ensino superior (completo ou incompleto)', 'tertiary (complete or not)')]
RACAS = [('branca', 'branca', 'white'), ('preta', 'preta', 'black'), ('parda', 'parda', 'brown (pardo)'), ('amarela', 'amarela', 'Asian'), ('indigena', 'indígena', 'Indigenous')]
F_PERFIL22 = 'TSE, perfil do eleitorado 2022'
F_COMP22 = 'TSE, perfil de comparecimento e abstenção 2022'
F_COMP26 = 'TSE, perfil de comparecimento e abstenção 2026'
F_LOC = 'TSE, eleitorado e locais de votação'

# --- 2022 composição (perfil_eleitorado_2022)
def pv(num, den):
    return lambda i: (lambda r: None if r is None else pct(r[num], r[den]))(P.get(i))
N22 = ' Base: cadastro eleitoral (foto TSE, arquivo gerado após a eleição de 2022), exterior excluído; denominador = eleitores com a característica informada.'
E22 = ' Base: voter registry (TSE snapshot generated after the 2022 election), abroad excluded; denominator = voters with the characteristic reported.'
add('tse22_perfil_eleitores', 'Eleitores no cadastro (perfil 2022)', 'Registered voters (2022 profile)', 'eleitores', 0, 2022, F_PERFIL22,
    'Total de eleitores do perfil do eleitorado 2022 (soma de zonas; exterior fora).', 'Total voters in the 2022 electorate profile (sum of zones; abroad excluded).',
    lambda i: (P.get(i) or {}).get('tot'))
for g, pt, en in IDADES:
    add(f'tse22_perfil_idade{g}_pct', f'Eleitores {pt} (%) (2022)', f'Voters {en} (%) (2022)', '% do eleitorado', 2, 2022, F_PERFIL22,
        f'Faixas etárias do TSE reagrupadas.' + (FAC_PT if g in ('1617', '70p') else '') + N22,
        'TSE age bands regrouped.' + (FAC_EN if g in ('1617', '70p') else '') + E22, pv('i' + g, 'idade_ok'))
add('tse22_perfil_facult_idade_pct', 'Eleitores com voto facultativo por idade: 16-17 e 70+ (%) (2022)', 'Voters with optional voting by age: 16-17 and 70+ (%) (2022)', '% do eleitorado', 2, 2022, F_PERFIL22,
    'Soma de 16-17 e 70+. Não inclui analfabetos maiores de 18 (também facultativos).' + N22, 'Sum of 16-17 and 70+. Excludes illiterate voters aged 18-69 (also optional).' + E22,
    lambda i: (lambda r: None if r is None else pct(r['i1617'] + r['i70p'], r['idade_ok']))(P.get(i)))
add('tse22_perfil_fem_pct', 'Eleitoras mulheres (%) (2022)', 'Women (%) (2022)', '% do eleitorado', 2, 2022, F_PERFIL22, 'Denominador: feminino + masculino.' + N22, 'Denominator: female + male.' + E22, pv('fem', 'gen_ok'))
add('tse22_perfil_masc_pct', 'Eleitores homens (%) (2022)', 'Men (%) (2022)', '% do eleitorado', 2, 2022, F_PERFIL22, 'Denominador: feminino + masculino.' + N22, 'Denominator: female + male.' + E22, pv('masc', 'gen_ok'))
for g, pt, en in ESCS:
    add(f'tse22_perfil_esc_{g}_pct', f'Escolaridade: {pt} (%) (2022)', f'Education: {en} (%) (2022)', '% do eleitorado', 2, 2022, F_PERFIL22,
        'Grau de escolaridade declarado no cadastro (denominador: escolaridade informada).' + N22, 'Education level declared in the registry (denominator: education reported).' + E22, pv(g, 'esc_ok'))
add('tse22_perfil_biometria_pct', 'Eleitores com biometria (%) (2022)', 'Voters with biometrics (%) (2022)', '% do eleitorado', 2, 2022, F_PERFIL22, 'Eleitores com biometria coletada.' + N22, 'Voters with biometrics collected.' + E22, pv('bio', 'tot'))
add('tse22_perfil_deficiencia_pct', 'Eleitores com deficiência (%) (2022)', 'Voters with disability (%) (2022)', '% do eleitorado', 2, 2022, F_PERFIL22, 'Eleitores com deficiência declarada.' + N22, 'Voters with declared disability.' + E22, pv('def', 'tot'))
add('tse22_perfil_raca_ni_pct', 'Raça/cor não informada (%) (2022)', 'Race/colour not reported (%) (2022)', '% do eleitorado', 2, 2022, F_COMP22,
    'O campo raça/cor é novo no cadastro e em 2022 vem 100% "não informado" no perfil do TSE; por isso não há variáveis de raça/cor para 2022 (ver tse26_).',
    'Race/colour is a new registry field and is 100% "not reported" in the 2022 TSE data; hence no 2022 race variables (see tse26_).',
    lambda i: (lambda r: None if r is None else pct(r['ap'] - (r['ap_r'] or 0), r['ap']))(CP[(2022, 1)].get(i)))

# --- 2026 composição (aptos do 1º turno do perfil de comparecimento)
C26 = CP[(2026, 1)]
N26 = ' Base: eleitores aptos do 1º turno 2026 (perfil de comparecimento e abstenção, gerado em 13/10/2026), exterior excluído; denominador = eleitores com a característica informada. perfil_eleitorado_2026 ainda não baixado (sem biometria).'
E26 = ' Base: eligible voters in the 2026 first round (turnout/abstention profile, generated 2026-10-13), abroad excluded; denominator = voters with the characteristic reported. perfil_eleitorado_2026 not downloaded yet (no biometrics).'
def pc(num, den, tbl=C26):
    return lambda i: (lambda r: None if r is None else pct(r[num], r[den]))(tbl.get(i))
add('tse26_perfil_eleitores', 'Eleitores aptos 1º turno (perfil 2026)', 'Eligible voters 1st round (2026 profile)', 'eleitores', 0, 2026, F_COMP26,
    'Soma de QT_APTOS do 1º turno 2026 (exterior fora).', 'Sum of QT_APTOS, 2026 first round (abroad excluded).', lambda i: (C26.get(i) or {}).get('ap'))
for g, pt, en in IDADES:
    add(f'tse26_perfil_idade{g}_pct', f'Eleitores {pt} (%) (2026)', f'Voters {en} (%) (2026)', '% do eleitorado', 2, 2026, F_COMP26,
        'Faixas etárias do TSE reagrupadas.' + (FAC_PT if g in ('1617', '70p') else '') + N26, 'TSE age bands regrouped.' + (FAC_EN if g in ('1617', '70p') else '') + E26, pc('ap_i' + g, 'ap_i'))
add('tse26_perfil_facult_idade_pct', 'Eleitores com voto facultativo por idade: 16-17 e 70+ (%) (2026)', 'Voters with optional voting by age: 16-17 and 70+ (%) (2026)', '% do eleitorado', 2, 2026, F_COMP26,
    'Soma de 16-17 e 70+.' + N26, 'Sum of 16-17 and 70+.' + E26, lambda i: (lambda r: None if r is None else pct(r['ap_i1617'] + r['ap_i70p'], r['ap_i']))(C26.get(i)))
add('tse26_perfil_fem_pct', 'Eleitoras mulheres (%) (2026)', 'Women (%) (2026)', '% do eleitorado', 2, 2026, F_COMP26, 'Denominador: feminino + masculino.' + N26, 'Denominator: female + male.' + E26, pc('ap_gfem', 'ap_g'))
add('tse26_perfil_masc_pct', 'Eleitores homens (%) (2026)', 'Men (%) (2026)', '% do eleitorado', 2, 2026, F_COMP26, 'Denominador: feminino + masculino.' + N26, 'Denominator: female + male.' + E26, pc('ap_gmasc', 'ap_g'))
for g, pt, en in ESCS:
    add(f'tse26_perfil_esc_{g}_pct', f'Escolaridade: {pt} (%) (2026)', f'Education: {en} (%) (2026)', '% do eleitorado', 2, 2026, F_COMP26,
        'Grau de instrução declarado no cadastro (denominador: informado).' + N26, 'Education level declared in the registry (denominator: reported).' + E26, pc('ap_e' + g, 'ap_e'))
add('tse26_perfil_deficiencia_pct', 'Eleitores com deficiência (%) (2026)', 'Voters with disability (%) (2026)', '% do eleitorado', 2, 2026, F_COMP26,
    'Aptos com deficiência = comparecimento + abstenção de eleitores com deficiência.' + N26, 'Eligible voters with disability = turnout + abstention of voters with disability.' + E26, pc('apd', 'ap'))
add('tse26_perfil_raca_ni_pct', 'Raça/cor não informada (%) (2026)', 'Race/colour not reported (%) (2026)', '% do eleitorado', 2, 2026, F_COMP26,
    'Raça/cor é campo novo e declaratório: muitos eleitores ainda não informaram. Interprete os percentuais de raça/cor com esta cobertura em mente.' , 'Race/colour is a new self-declared field: many voters have not reported it yet. Read the race shares with this coverage in mind.',
    lambda i: (lambda r: None if r is None else pct(r['ap'] - (r['ap_r'] or 0), r['ap']))(C26.get(i)))
for g, pt, en in RACAS:
    add(f'tse26_perfil_raca_{g}_pct', f'Raça/cor {pt} (% dos que informaram) (2026)', f'Race/colour {en} (% of those reporting) (2026)', '% dos que informaram', 2, 2026, F_COMP26,
        'Denominador: eleitores com raça/cor informada (campo novo; cobertura parcial, ver tse26_perfil_raca_ni_pct). Pode ser enviesado para quem atualizou o cadastro.' + N26.split('denominador')[0].rstrip(' ;,') ,
        'Denominator: voters with race/colour reported (new field; partial coverage, see tse26_perfil_raca_ni_pct). May be biased toward voters who updated their registry.',
        pc('ap_r' + g, 'ap_r'))

# --- abstenção por perfil
def abst(ano, t):
    p = f'tse{str(ano)[2:]}_abst_t{t}_'
    tbl = CP[(ano, t)]
    lab, labe = f'{ano} {t}º turno', f'{ano} round {t}'
    F = F_COMP22 if ano == 2022 else F_COMP26
    G = ('Abstenção por perfil (TSE)', 'Abstention by profile (TSE)')
    nota = f' Taxa = abstenção / aptos do grupo no município; null se o grupo tem menos de {MINN} aptos. Exterior fora.'
    notae = f' Rate = abstentions / eligible in the group in the municipality; null if the group has fewer than {MINN} eligible. Abroad excluded.'
    if ano == 2026: nota += ' Somente 1º turno (arquivo gerado em 13/10/2026; 2º turno pendente).'; notae += ' First round only (file generated 2026-10-13; runoff pending).'
    def A(name, pt, en, ab_, ap_, extra='', extrae=''):
        add(p + name, f'Abstenção: {pt} ({lab})', f'Abstention: {en} ({labe})', '% dos aptos do grupo', 2, ano, F, 'Abstenção do grupo.' + extra + nota, 'Abstention of the group.' + extrae + notae,
            lambda i: (lambda r: None if r is None else pct(r[ab_], r[ap_], MINN))(tbl.get(i)), G, 'resultado')
    A('geral', 'geral', 'overall', 'ab', 'ap', ' Confere com res_*_abst do TSE de resultados.', ' Matches TSE results abstention.')
    for g, pt, en in IDADES: A(f'idade{g}', pt, en, 'ab_i' + g, 'ap_i' + g, FAC_PT if g in ('1617', '70p') else '', FAC_EN if g in ('1617', '70p') else '')
    for g, pt, en in ESCS: A(f'esc_{g}', pt, en, 'ab_e' + g, 'ap_e' + g, FAC_PT if g == 'analf' else '', FAC_EN if g == 'analf' else '')
    A('fem', 'mulheres', 'women', 'ab_gfem', 'ap_gfem'); A('masc', 'homens', 'men', 'ab_gmasc', 'ap_gmasc')
    A('deficiencia', 'eleitores com deficiência', 'voters with disability', 'abd', 'apd')
    A('facultativo', 'voto facultativo', 'optional voting', 'abf', 'apf', ' Eleitores com voto facultativo (jovens 16-17, 70+, analfabetos).', ' Voters with optional voting (16-17, 70+, illiterate).')
    A('obrigatorio', 'voto obrigatório', 'mandatory voting', 'abo', 'apo')
    if ano == 2026:
        for g, pt, en in RACAS[:3]: A(f'raca_{g}', f'raça/cor {pt}', f'race/colour {en}', 'ab_r' + g, 'ap_r' + g, ' Raça/cor é campo novo, com muitos "não informado".', ' Race/colour is a new field with many "not reported".')
abst(2022, 1); abst(2022, 2); abst(2026, 1)

# --- locais de votação
def locs(ano):
    p = f'tse{str(ano)[2:]}_loc_'
    L = LO[ano]
    G = ('Locais de votação (TSE)', 'Polling places (TSE)')
    F = F_LOC + f' {ano}'
    nb = f' Base: arquivo de locais/seções do 1º turno {ano}, exterior fora; local = zona + número do local, só tipo convencional com eleitores (exclui temporário, preso provisório, voto em trânsito).' + (' Arquivo gerado em 25/10/2026.' if ano == 2026 else ' Arquivo gerado em 30/09/2024.')
    nbe = f' Base: polling-place/section file, {ano} first round, abroad excluded; place = zone + place number, conventional type with voters only (excludes temporary, pre-trial detainees, transit voting).'
    g = lambda f: (lambda i: (lambda r: None if r is None else f(r))(L.get(i)))
    add(p + 'locais', f'Locais de votação ({ano})', f'Polling places ({ano})', 'locais', 0, ano, F, 'Número de locais de votação convencionais.' + nb, 'Number of conventional polling places.' + nbe, g(lambda r: r['nloc']), G)
    add(p + 'secoes', f'Seções eleitorais ({ano})', f'Polling stations ({ano})', 'seções', 0, ano, F, 'Seções com eleitores (inclui agregadas).' + nb, 'Stations with voters (incl. merged).' + nbe, g(lambda r: r['nsec']), G)
    add(p + 'eleit_por_local', f'Eleitores por local de votação ({ano})', f'Voters per polling place ({ano})', 'eleitores/local', 1, ano, F,
        'Eleitores de locais convencionais / número de locais.' + nb, 'Voters in conventional places / number of places.' + nbe, g(lambda r: None if not r['nloc'] else r['qconv'] / r['nloc']), G)
    add(p + 'eleit_por_secao', f'Eleitores por seção ({ano})', f'Voters per station ({ano})', 'eleitores/seção', 1, ano, F, 'Eleitores / seções com eleitores.' + nb, 'Voters / stations with voters.' + nbe, g(lambda r: None if not r['nsec'] else r['q'] / r['nsec']), G)
    add(p + 'agregadas_pct', f'Eleitores em seções agregadas ({ano}) (%)', f'Voters in merged stations ({ano}) (%)', '% do eleitorado', 2, ano, F,
        'Seções agregadas (funcionam junto à seção principal, em geral zona rural/poucos eleitores) / eleitores totais do município. 2022 confere com secoes_agregadas_2022.' + nb, 'Merged stations (run together with a main station, typically rural/small) / total voters. 2022 matches secoes_agregadas_2022.' + nbe, g(lambda r: pct(r['qagr'], r['q'])), G)
    add(p + 'rural_pct', f'Eleitores em locais de zona rural ({ano}) (%)', f'Voters in rural-zone places ({ano}) (%)', '% do eleitorado', 2, ano, F,
        'Proxy: bairro do local contém "RURAL" (ex. "ZONA RURAL"); SUBESTIMA o rural, pois muitos locais rurais têm povoado/localidade no campo bairro.' + nb, 'Proxy: place neighbourhood contains "RURAL"; UNDERSTATES rural voters since many rural places list a hamlet name instead.' + nbe, g(lambda r: pct(r['qrur'], r['q'])), G)
    add(p + 'acessib_pct', f'Eleitores em seções com acessibilidade ({ano}) (%)', f'Voters in accessible stations ({ano}) (%)', '% do eleitorado', 2, ano, F,
        'Situação de acessibilidade da seção (com/sem).' + nb, 'Station accessibility status (with/without).' + nbe, g(lambda r: pct(r['qacc'], r['q'])), G)
    add(p + 'temporarios_pct', f'Eleitores em locais temporários ({ano}) (%)', f'Voters in temporary places ({ano}) (%)', '% do eleitorado', 2, ano, F,
        'Locais de tipo temporário.' + nb, 'Temporary place type.' + nbe, g(lambda r: pct(r['qtmp'], r['q'])), G)
locs(2022); locs(2026)

# ------------------------------------------------------------------ saída
dec = {v['k']: v['dec'] for v in vars_}
for k in cols: cols[k] = [None if x is None else (round(float(x), dec[k]) if dec[k] else int(round(x))) for x in cols[k]]
OUT.parent.mkdir(parents=True, exist_ok=True)
json.dump({'fonte': 'tse_perfil', 'ibge': ibge, 'vars': vars_, 'cols': cols}, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))

# ------------------------------------------------------------------ checagens
print('municípios:', len(ibge), '| vars:', len(vars_))
print('perfil 2022 total:', c.execute("select sum(tot) from agg_p22").fetchone(), '| aptos comparecimento 2022 t1/t2:', c.execute("select t,sum(ap),sum(cp),sum(ab) from agg_c2022 group by 1 order by 1").fetchall())
print('2026 t1:', c.execute("select t,sum(ap),sum(cp),sum(ab) from agg_c2026 group by 1 order by 1").fetchall())
print('locais:', c.execute("select '2022', sum(nloc),sum(nsec),sum(q),sum(qagr) from agg_l2022 union all select '2026',sum(nloc),sum(nsec),sum(q),sum(qagr) from agg_l2026").fetchall())
for k in ('tse22_abst_t1_geral', 'tse22_abst_t2_geral', 'tse26_abst_t1_geral'):
    v = [x for x in cols[k] if x is not None]; print(k, len(v), 'média simples', round(sum(v) / len(v), 2))
try:
    r = json.load(open(PARC / 'resultados.json'))
    ri = {x: j for j, x in enumerate(r['ibge'])}
    for k, kr in (('tse22_abst_t1_geral', 'res22_t1_abst'), ('tse22_abst_t2_geral', 'res22_t2_abst'), ('tse26_abst_t1_geral', 'res26_t1_abst')):
        dif = [abs(cols[k][idx[i]] - r['cols'][kr][ri[i]]) for i in ibge if i in ri and cols[k][idx[i]] is not None and r['cols'][kr][ri[i]] is not None]
        print(f'{k} vs {kr}: n={len(dif)} dif média {sum(dif)/len(dif):.3f} pp, máx {max(dif):.2f} pp')
except Exception as e:
    print('conferência com resultados.json falhou:', e)
