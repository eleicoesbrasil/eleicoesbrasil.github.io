"""Gera dados_externos/parciais/orc_federal.json (contrato: dados_externos/CONTRATO_DADOS.md).

Tema: orçamento federal por município, 2022 em diante.
Fontes (brutos em /mnt/e/EleicoesBrasil_externos/orcamento/):
  1. emendas/EmendasParlamentares.zip (Portal da Transparência/CGU): emendas por município de aplicação, ano, tipo.
  2. emendas/siconv_{proposta,convenio,emenda}.csv.zip (Transferegov legado/SICONV): propostas e convênios/contratos
     de repasse cujo proponente é uma prefeitura (COD_MUNIC_IBGE).
  3. siop/acompanhamento_2022..2025.zip e siop_regionalizacao/regionalizacao_2024.csv (SIOP): execução (liquidado)
     regionalizada por município nas ações que o órgão regionalizou.
  Portal da Transparência "Transferências" mensais e "Despesas - execução": só alguns meses baixados (ver relatório);
  o script calcula totais anuais/% por tipo apenas para anos com os 12 meses presentes (hoje nenhum).
Uso: /mnt/d/01_claudeCode/10_EleicoesBrasil/.venv/bin/python orc_federal_para_parcial.py
"""
import glob, json, os, re, tempfile, unicodedata, zipfile
import duckdb

EXT = "/mnt/e/EleicoesBrasil_externos"
ORC = f"{EXT}/orcamento"
PARC = "/mnt/d/01_claudeCode/10_EleicoesBrasil/dados_externos/parciais"
OUT = f"{PARC}/orc_federal.json"
ANOS = [2022, 2023, 2024, 2025, 2026]
TMP = tempfile.mkdtemp(prefix="orc_federal_")

# ---------------------------------------------------------------- municípios, população, eleitores
res = json.load(open(f"{PARC}/resultados.json"))
ibge_pars = json.load(open(f"{PARC}/ibge.json"))
IBGE = list(res["ibge"])
IDX = {k: i for i, k in enumerate(IBGE)}
N = len(IBGE)
pop_map = dict(zip(ibge_pars["ibge"], ibge_pars["cols"]["censo_pop"]))
POP = [pop_map.get(k) for k in IBGE]
APTOS = res["cols"]["res26_t1_aptos"]  # eleitores aptos 1º turno 2026 (peso para o cumulado 2022-2026)

loc = json.load(open(f"{EXT}/ibge/localidades/municipios_nivelado.json"))


def norm(s):
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode().upper()
    return re.sub(r"[^A-Z0-9]+", " ", s).strip()


NOME2IBGE = {(m["UF-sigla"], norm(m["municipio-nome"])): str(m["municipio-id"]) for m in loc}

# ---------------------------------------------------------------- helpers de variáveis
VARS, COLS = [], {}
G = ("Orçamento e gasto público", "Public budget and spending")


def col_zero():
    return [0.0] * N


def add(k, pt, en, sub_pt, sub_en, fonte, unidade, dec, ano, valores, nota_pt, nota_en):
    VARS.append({"k": k, "pt": pt, "en": en, "grupo_pt": f"{G[0]} — {sub_pt}", "grupo_en": f"{G[1]} — {sub_en}",
                 "fonte": fonte, "unidade": unidade, "dec": dec, "ano": ano, "tipo": "num", "papel": "contexto",
                 "nota_pt": nota_pt, "nota_en": nota_en})
    COLS[k] = valores


def pc(v):
    return [None if (x is None or not p) else x / p for x, p in zip(v, POP)]


def pe(v):
    return [None if (x is None or not p) else x / p for x, p in zip(v, APTOS)]


def pct(a, b):
    return [None if (x is None or not y) else 100.0 * x / y for x, y in zip(a, b)]


def tonum(col):
    # "1234,56" ou "   1234,56" ou "1234.56" -> double (NULL se texto)
    return f"try_cast(replace(trim({col}),',','.') as double)"


def utf8_copy(src, name):
    """Copia para o tmp em UTF-8 (SIOP mistura codificações)."""
    raw = src if isinstance(src, bytes) else open(src, "rb").read()
    try:
        txt = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        txt = raw.decode("latin-1")
    p = f"{TMP}/{name}"
    open(p, "w", encoding="utf-8").write(txt)
    return p


def un(zpath, member=None, dest=None):
    z = zipfile.ZipFile(zpath)
    m = member or z.namelist()[0]
    z.extract(m, dest or TMP)
    return f"{dest or TMP}/{m}"


con = duckdb.connect()


def csv_view(name, path, enc="utf-8"):
    con.execute(f"create or replace view {name} as select * from read_csv('{path}', delim=';', quote='\"', "
                f"all_varchar=true, header=true, strict_mode=false, ignore_errors=true, encoding='{enc}')")


def agg_by_ibge(sql):
    """Executa SQL que devolve (ibge, v1, v2, ...) e devolve dict ibge -> tupla."""
    out = {}
    for r in con.execute(sql).fetchall():
        out[str(r[0])] = r[1:]
    return out


def vec(d, j, zero=True):
    return [(d[k][j] if k in d else (0.0 if zero else None)) for k in IBGE]


# ================================================================= 1. EMENDAS (Portal da Transparência)
FON_EM = "Portal da Transparência (CGU) — EmendasParlamentares"
p = un(f"{ORC}/emendas/EmendasParlamentares.zip", "EmendasParlamentares.csv")
csv_view("e", p, "latin-1")
con.execute(f"""create or replace view em as select "Código da Emenda" cod, "Ano da Emenda"::int ano,
 "Tipo de Emenda" tipo, "Código Município IBGE" mun,
 {tonum('"Valor Empenhado"')} emp, ({tonum('"Valor Pago"')} + {tonum('"Valor Restos A Pagar Pagos"')}) pago
 from e where "Ano da Emenda"::int >= 2022 and length("Código Município IBGE")=7 and "Código Município IBGE" not like '%0000'
 and "Código Município IBGE" in (select unnest(?))""".replace("?", "[" + ",".join(f"'{k}'" for k in IBGE) + "]"))
TIPOS = [("ind_fd", "Emenda Individual - Transferências com Finalidade Definida", "individuais (finalidade definida)",
          "individual (earmarked purpose)"),
         ("pix", "Emenda Individual - Transferências Especiais", "individuais — transferências especiais (Pix)",
          "individual — special transfers (Pix)"),
         ("bancada", "Emenda de Bancada", "de bancada estadual", "state caucus"),
         ("comissao", "Emenda de Comissão", "de comissão", "committee"),
         ("relator", "Emenda de Relator", "de relator (RP9, só 2022)", "rapporteur (RP9, 2022 only)")]
NOTA_EM_PT = ("[Por LOCALIDADE DE APLICAÇÃO — cobertura baixa: a maior parte do valor das emendas é registrada como MÚLTIPLO/UF e não entra; para o valor recebido pela prefeitura use orc_emenda_rec_*.] Emendas parlamentares federais cujo município de aplicação (campo 'Código Município IBGE') é este município. "
              "Valores nominais em R$ (não deflacionados). 'Pago' = Valor Pago + Restos a Pagar Pagos, acumulado até a data do arquivo "
              "(27/10/2026), agrupado pelo ANO DA EMENDA (não pelo ano do pagamento); 2026 está incompleto. Ficam de fora emendas "
              "sem município (localidade MÚLTIPLO, Nacional ou UF/estadual: ~R$ 151 bi de empenho em 2022+ só em 'MÚLTIPLO'), "
              "então o total municipal NÃO fecha com o total nacional de emendas. O município é o de aplicação definido na emenda, "
              "que pode diferir do convenente/favorecido. Ausência de linha no município = 0 (a fonte cobre todas as emendas; "
              "zero = nenhuma emenda localizada no município). ")
NOTA_EM_EN = ("[By APPLICATION LOCALITY — low coverage: most amendment value is recorded as MULTIPLE/state-level and is excluded; for the amount received by the city government use orc_emenda_rec_*.] Federal parliamentary amendments whose application municipality ('Código Município IBGE') is this municipality. "
              "Nominal R$ (not deflated). 'Paid' = Valor Pago + paid carried-over payables, cumulative up to the file date "
              "(2026-10-27), grouped by AMENDMENT YEAR (not payment year); 2026 is incomplete. Amendments without a municipality "
              "(MÚLTIPLO, national or state-level) are excluded, so municipal totals do NOT add up to the national amendment total. "
              "The municipality is the application place set in the amendment, which may differ from the convenor/payee. "
              "Missing row = 0 (the source covers all amendments; zero = no amendment located in the municipality). ")
DUP_PT = ("ATENÇÃO dupla contagem: as emendas 'com finalidade definida' que viram convênio/contrato de repasse também aparecem nas variáveis "
          "orc_siconv_*; e tudo isso pode reaparecer nas transferências do Portal. Não some as fontes.")
DUP_EN = ("WARNING double counting: earmarked amendments that become agreements also appear in the orc_siconv_* variables, and again "
          "in Portal transfers. Do not add the sources.")
SUB = ("Emendas parlamentares", "Parliamentary amendments")


def pm(d, j):
    return vec(d, j)


# por ano
for a in ANOS:
    d = agg_by_ibge(f"select mun, sum(emp), sum(pago) from em where ano={a} group by 1")
    emp, pg = vec(d, 0), vec(d, 1)
    add(f"orc_emloc_emp_{a}", f"Emendas parlamentares empenhadas — emendas de {a} (R$)",
        f"Parliamentary amendments committed — {a} amendments (R$)", *SUB, FON_EM, "R$", 0, a, emp,
        NOTA_EM_PT + "Empenhado = intenção de gasto (pode não ser pago). " + DUP_PT,
        NOTA_EM_EN + "Committed = spending intent (may never be paid). " + DUP_EN)
    add(f"orc_emloc_pago_{a}", f"Emendas parlamentares pagas — emendas de {a} (R$)",
        f"Parliamentary amendments paid — {a} amendments (R$)", *SUB, FON_EM, "R$", 0, a, pg,
        NOTA_EM_PT + DUP_PT, NOTA_EM_EN + DUP_EN)
    add(f"orc_emloc_pago_pc_{a}", f"Emendas pagas per capita — emendas de {a} (R$/hab)",
        f"Amendments paid per capita — {a} amendments (R$/inh.)", *SUB, FON_EM, "R$/hab", 2, a, pc(pg),
        NOTA_EM_PT + "Dividido pela população do Censo 2022.", NOTA_EM_EN + "Divided by 2022 Census population.")

# acumulado 2022-2026
d = agg_by_ibge("select mun, sum(emp), sum(pago), count(distinct cod) from em group by 1")
EMP, PAGO, NEM = vec(d, 0), vec(d, 1), vec(d, 2)
add("orc_emloc_emp_2226", "Emendas empenhadas, 2022-2026 (R$)", "Amendments committed, 2022-2026 (R$)", *SUB, FON_EM,
    "R$", 0, "2022-2026", EMP, NOTA_EM_PT + "Soma das emendas dos anos 2022 a 2026. " + DUP_PT,
    NOTA_EM_EN + "Sum of 2022-2026 amendments. " + DUP_EN)
add("orc_emloc_pago_2226", "Emendas pagas, 2022-2026 (R$)", "Amendments paid, 2022-2026 (R$)", *SUB, FON_EM,
    "R$", 0, "2022-2026", PAGO, NOTA_EM_PT + "Soma das emendas dos anos 2022 a 2026. " + DUP_PT,
    NOTA_EM_EN + "Sum of 2022-2026 amendments. " + DUP_EN)
add("orc_emloc_emp_pc_2226", "Emendas empenhadas per capita, 2022-2026 (R$/hab)",
    "Amendments committed per capita, 2022-2026 (R$/inh.)", *SUB, FON_EM, "R$/hab", 2, "2022-2026", pc(EMP),
    NOTA_EM_PT + "Dividido pela população do Censo 2022 (um valor acumulado de 5 anos, não anual).",
    NOTA_EM_EN + "Divided by 2022 Census population (5-year cumulative, not annual).")
add("orc_emloc_pago_pc_2226", "Emendas pagas per capita, 2022-2026 (R$/hab)",
    "Amendments paid per capita, 2022-2026 (R$/inh.)", *SUB, FON_EM, "R$/hab", 2, "2022-2026", pc(PAGO),
    NOTA_EM_PT + "Dividido pela população do Censo 2022 (acumulado de 5 anos).",
    NOTA_EM_EN + "Divided by 2022 Census population (5-year cumulative).")
add("orc_emloc_emp_pe_2226", "Emendas empenhadas por eleitor apto, 2022-2026 (R$/eleitor)",
    "Amendments committed per eligible voter, 2022-2026 (R$/voter)", *SUB, FON_EM, "R$/eleitor", 2, "2022-2026", pe(EMP),
    NOTA_EM_PT + "Dividido pelos eleitores aptos do 1º turno de 2026 (res26_t1_aptos).",
    NOTA_EM_EN + "Divided by eligible voters in the 2026 first round (res26_t1_aptos).")
add("orc_emloc_pago_pe_2226", "Emendas pagas por eleitor apto, 2022-2026 (R$/eleitor)",
    "Amendments paid per eligible voter, 2022-2026 (R$/voter)", *SUB, FON_EM, "R$/eleitor", 2, "2022-2026", pe(PAGO),
    NOTA_EM_PT + "Dividido pelos eleitores aptos do 1º turno de 2026 (res26_t1_aptos).",
    NOTA_EM_EN + "Divided by eligible voters in the 2026 first round (res26_t1_aptos).")
add("orc_emloc_n_2226", "Nº de emendas distintas aplicadas no município, 2022-2026",
    "Distinct amendments applied in the municipality, 2022-2026", *SUB, FON_EM, "emendas", 0, "2022-2026",
    [float(x) for x in NEM], NOTA_EM_PT + "Contagem de códigos de emenda distintos (uma emenda pode ter várias linhas/ações).",
    NOTA_EM_EN + "Count of distinct amendment codes (one amendment can have several lines/actions).")

# por tipo
for sig, nome, lab_pt, lab_en in TIPOS:
    d = agg_by_ibge(f"select mun, sum(pago) from em where tipo='{nome}' group by 1")
    v = vec(d, 0)
    add(f"orc_emloc_{sig}_pago_2226", f"Emendas {lab_pt} pagas, 2022-2026 (R$)", f"Amendments paid — {lab_en}, 2022-2026 (R$)",
        *SUB, FON_EM, "R$", 0, "2022-2026", v,
        NOTA_EM_PT + f"Tipo: '{nome}'. " + DUP_PT, NOTA_EM_EN + f"Type: '{nome}'. " + DUP_EN)
    add(f"orc_emloc_{sig}_pago_pc_2226", f"Emendas {lab_pt} pagas per capita, 2022-2026 (R$/hab)",
        f"Amendments paid per capita — {lab_en}, 2022-2026 (R$/inh.)", *SUB, FON_EM, "R$/hab", 2, "2022-2026", pc(v),
        NOTA_EM_PT + f"Tipo: '{nome}'. Dividido pela população do Censo 2022.",
        NOTA_EM_EN + f"Type: '{nome}'. Divided by 2022 Census population.")
    add(f"orc_emloc_{sig}_pct_2226", f"% das emendas pagas que são {lab_pt}", f"% of paid amendments that are {lab_en}",
        *SUB, FON_EM, "%", 1, "2022-2026", pct(v, PAGO),
        NOTA_EM_PT + f"Tipo: '{nome}'. Participação no total pago do município; nulo se o município não recebeu emendas pagas.",
        NOTA_EM_EN + f"Type: '{nome}'. Share of the municipality's paid total; null if no paid amendments.")


# ================================================================= 1b. EMENDAS — valor RECEBIDO pelo ente municipal (PorFavorecido)
FON_FV = "Portal da Transparência (CGU) — EmendasParlamentares_PorFavorecido"
pf = un(f"{ORC}/emendas/EmendasParlamentares.zip", "EmendasParlamentares_PorFavorecido.csv")
csv_view("fv", pf, "latin-1")
fvrows = con.execute(f"""select "UF Favorecido" uf, "Município Favorecido" nm, "Tipo de Emenda" tp, left("Ano/Mês",4)::int ano,
   sum({tonum('"Valor Recebido"')}) v from fv
   where left("Ano/Mês",4)::int>=2022 and ("Natureza Jurídica" in ('Município','Órgão Público do Poder Executivo Municipal')
     or "Natureza Jurídica" like '%Municipal%')
   group by 1,2,3,4""").fetchall()
FV = {}
fv_unm = {}
for uf, nm, tp, ano, v in fvrows:
    k = NOME2IBGE.get((uf, norm(nm)))
    if k is None:
        fv_unm[(uf, nm)] = fv_unm.get((uf, nm), 0.0) + (v or 0.0)
        continue
    FV[(k, tp, ano)] = FV.get((k, tp, ano), 0.0) + (v or 0.0)
FV_TOT_NAC = sum(v for *_, v in fvrows)
FV_FORA = {k: v for k, v in FV.items() if k[0] not in IDX}
NOTA_FV_PT = ("Valor PAGO a favorecidos que são a administração municipal do município (prefeitura, fundos municipais de saúde/educação etc.: "
              "natureza jurídica 'Município', 'Fundo Público da Administração Direta Municipal' ou 'Órgão Público do Poder Executivo Municipal'), "
              "por ano do pagamento (campo Ano/Mês) e soma de todos os tipos de emenda (a menos que o nome da variável indique o tipo). "
              "Município do favorecido obtido por UF + nome normalizado. Nominal em R$. Inclui pagamentos de restos a pagar de emendas de anos "
              "anteriores. Exclui valores pagos a ONGs, empresas, estados e Caixa/BB (que podem executar obras no município). Mede o "
              "que a prefeitura recebeu por emenda, mesmo quando a emenda foi registrada como MÚLTIPLO. 2026 incompleto (até out/2026). "
              "Ausência = 0 (a fonte cobre todos os favorecidos). Dupla contagem com orc_emloc_*, orc_siconv_* e transferências do Portal: não some. ")
NOTA_FV_EN = ("Amount PAID to payees that are the municipal administration (city hall, municipal health/education funds etc.: legal nature "
              "'Município', 'Fundo Público da Administração Direta Municipal' or 'Órgão Público do Poder Executivo Municipal'), by payment year "
              "(Ano/Mês) and summed over all amendment types (unless the variable name states the type). Payee municipality by state + "
              "normalized name. Nominal R$. Includes payments of carried-over payables of earlier amendments. Excludes amounts paid to NGOs, "
              "companies, states and Caixa/BB (which may run works in the municipality). Measures what the city received through amendments even "
              "when the amendment was recorded as MULTIPLE. 2026 incomplete (to Oct 2026). Missing = 0 (source covers all payees). "
              "Double counting with orc_emloc_*, orc_siconv_* and Portal transfers: do not add. ")
SUBF = ("Emendas parlamentares", "Parliamentary amendments")


def fvvec(tp=None, anos=ANOS):
    out = [0.0] * N
    for (k, t, a), v in FV.items():
        if (tp is None or t == tp) and a in anos and k in IDX:
            out[IDX[k]] += v
    return out


for a in ANOS:
    v = fvvec(anos=[a])
    add(f"orc_emenda_rec_{a}", f"Emendas recebidas pela prefeitura, pagas em {a} (R$)", f"Amendments received by the city government, paid in {a} (R$)",
        *SUBF, FON_FV, "R$", 0, a, v, NOTA_FV_PT, NOTA_FV_EN)
    add(f"orc_emenda_rec_pc_{a}", f"Emendas recebidas pela prefeitura per capita, pagas em {a} (R$/hab)",
        f"Amendments received by the city government per capita, paid in {a} (R$/inh.)", *SUBF, FON_FV, "R$/hab", 2, a, pc(v),
        NOTA_FV_PT + "Dividido pela população do Censo 2022.", NOTA_FV_EN + "Divided by 2022 Census population.")
RECT = fvvec()
add("orc_emenda_rec_2226", "Emendas recebidas pela prefeitura, pagas 2022-2026 (R$)", "Amendments received by the city government, paid 2022-2026 (R$)",
    *SUBF, FON_FV, "R$", 0, "2022-2026", RECT, NOTA_FV_PT, NOTA_FV_EN)
add("orc_emenda_rec_pc_2226", "Emendas recebidas pela prefeitura per capita, 2022-2026 (R$/hab)",
    "Amendments received by the city government per capita, 2022-2026 (R$/inh.)", *SUBF, FON_FV, "R$/hab", 2, "2022-2026", pc(RECT),
    NOTA_FV_PT + "Dividido pela população do Censo 2022 (acumulado de 5 anos).", NOTA_FV_EN + "Divided by 2022 Census population (5-year cumulative).")
add("orc_emenda_rec_pe_2226", "Emendas recebidas pela prefeitura por eleitor apto, 2022-2026 (R$/eleitor)",
    "Amendments received by the city government per eligible voter, 2022-2026 (R$/voter)", *SUBF, FON_FV, "R$/eleitor", 2, "2022-2026", pe(RECT),
    NOTA_FV_PT + "Dividido pelos eleitores aptos do 1º turno de 2026.", NOTA_FV_EN + "Divided by eligible voters in the 2026 first round.")
for sig, nome, lab_pt, lab_en in TIPOS:
    v = fvvec(tp=nome)
    add(f"orc_emenda_rec_{sig}_2226", f"Emendas {lab_pt} recebidas pela prefeitura, 2022-2026 (R$)",
        f"Amendments received by the city government — {lab_en}, 2022-2026 (R$)", *SUBF, FON_FV, "R$", 0, "2022-2026", v,
        NOTA_FV_PT + f"Tipo: '{nome}'.", NOTA_FV_EN + f"Type: '{nome}'.")
    add(f"orc_emenda_rec_{sig}_pc_2226", f"Emendas {lab_pt} recebidas pela prefeitura per capita, 2022-2026 (R$/hab)",
        f"Amendments received by the city government per capita — {lab_en}, 2022-2026 (R$/inh.)", *SUBF, FON_FV, "R$/hab", 2, "2022-2026", pc(v),
        NOTA_FV_PT + f"Tipo: '{nome}'. Dividido pela população do Censo 2022.", NOTA_FV_EN + f"Type: '{nome}'. Divided by 2022 Census population.")
    add(f"orc_emenda_rec_{sig}_pct_2226", f"% das emendas recebidas que são {lab_pt}", f"% of received amendments that are {lab_en}",
        *SUBF, FON_FV, "%", 1, "2022-2026", pct(v, RECT),
        NOTA_FV_PT + f"Tipo: '{nome}'. Participação no total recebido; nulo se a prefeitura não recebeu emendas.",
        NOTA_FV_EN + f"Type: '{nome}'. Share of total received; null if no amendments received.")

# ================================================================= 2. TRANSFEREGOV / SICONV
FON_SI = "Transferegov (ex-SICONV) — dados abertos legados"
SD = f"{TMP}/siconv"
os.makedirs(SD, exist_ok=True)
for nm in ("proposta", "convenio", "emenda"):
    csv_view({"proposta": "p", "convenio": "cv", "emenda": "sem"}[nm], un(f"{ORC}/emendas/siconv_{nm}.csv.zip", dest=SD))
con.execute(f"""create or replace view pm as select ID_PROPOSTA id, COD_MUNIC_IBGE mun, ANO_PROP::int ano,
 {tonum('VL_REPASSE_PROP')} vrep from p where NATUREZA_JURIDICA like 'Administra%Municipal' and ANO_PROP::int>=2022
 and length(COD_MUNIC_IBGE)=7""")
con.execute(f"""create or replace view cm as select cv.ID_PROPOSTA id, p.COD_MUNIC_IBGE mun, cv.ANO::int ano,
 {tonum('cv.VL_REPASSE_CONV')} vrep, {tonum('cv.VL_DESEMBOLSADO_CONV')} vdes
 from cv join p on p.ID_PROPOSTA=cv.ID_PROPOSTA where p.NATUREZA_JURIDICA like 'Administra%Municipal' and cv.ANO::int>=2022
 and length(p.COD_MUNIC_IBGE)=7""")
con.execute(f"""create or replace view emv as select ID_PROPOSTA id, sum({tonum('VALOR_REPASSE_EMENDA')}) vem,
 sum(case when TIPO_PARLAMENTAR='INDIVIDUAL' then {tonum('VALOR_REPASSE_EMENDA')} else 0 end) vind
 from sem group by 1""")
SUB2 = ("Convênios e contratos de repasse (Transferegov)", "Agreements and transfer contracts (Transferegov)")
NOTA_SI_PT = ("Instrumentos do Transferegov/SICONV (carga legada de jul/2026) cujo PROPONENTE é a administração pública municipal "
              "do município (COD_MUNIC_IBGE do proponente; o local da obra pode ser outro, e ONGs/estados com sede no município "
              "ficam de fora). Valores nominais em R$. 'Repasse' = valor da União (exclui contrapartida do município). "
              "Cobre todas as modalidades (convênio, contrato de repasse, termo de compromisso etc.). Ausência = 0 (a fonte cobre todos "
              "os proponentes; zero = nenhum instrumento no período). " )
NOTA_SI_EN = ("Transferegov/SICONV instruments (legacy dump of Jul/2026) whose PROPONENT is the municipal government "
              "(proponent's COD_MUNIC_IBGE; the works site may be elsewhere; NGOs/states headquartered in the municipality are excluded). "
              "Nominal R$. 'Transfer' = federal amount (excludes municipal counterpart). All modalities. Missing = 0 (source covers all "
              "proponents; zero = no instrument in the period). ")
SI_DUP_PT = ("ATENÇÃO dupla contagem: parte do repasse vem de emendas parlamentares (orc_emenda_rec_* / orc_emloc_*) e também aparece nas transferências do Portal; "
             "não some as fontes.")
SI_DUP_EN = ("WARNING double counting: part of the transfers come from parliamentary amendments (orc_emenda_rec_* / orc_emloc_*) and also appear in Portal "
             "transfers; do not add the sources.")

d = agg_by_ibge("select mun, count(*), sum(vrep) from pm group by 1")
NP, VP = vec(d, 0), vec(d, 1)
add("orc_siconv_nprop_2226", "Propostas de convênio/repasse da prefeitura, 2022-2026 (nº)",
    "Municipal agreement proposals, 2022-2026 (count)", *SUB2, FON_SI, "propostas", 0, "2022-2026", NP,
    NOTA_SI_PT + "Conta propostas por ano de cadastro, em qualquer situação (inclui rejeitadas, canceladas e em análise): é esforço de captação, não recurso obtido. " + SI_DUP_PT,
    NOTA_SI_EN + "Counts proposals by registration year in any status (rejected, cancelled, pending): fundraising effort, not funds obtained. " + SI_DUP_EN)
add("orc_siconv_vprop_2226", "Repasse solicitado nas propostas da prefeitura, 2022-2026 (R$)",
    "Transfer requested in municipal proposals, 2022-2026 (R$)", *SUB2, FON_SI, "R$", 0, "2022-2026", VP,
    NOTA_SI_PT + "Soma de VL_REPASSE_PROP de todas as propostas (inclusive rejeitadas): NÃO é dinheiro recebido. " + SI_DUP_PT,
    NOTA_SI_EN + "Sum of VL_REPASSE_PROP of all proposals (including rejected): NOT money received. " + SI_DUP_EN)
d = agg_by_ibge("select mun, count(*), sum(vrep), sum(vdes) from cm group by 1")
NC, VC, VD = vec(d, 0), vec(d, 1), vec(d, 2)
add("orc_siconv_nconv_2226", "Convênios/contratos de repasse firmados com a prefeitura, 2022-2026 (nº)",
    "Agreements/transfer contracts signed with the municipality, 2022-2026 (count)", *SUB2, FON_SI, "instrumentos", 0,
    "2022-2026", NC, NOTA_SI_PT + "Instrumentos assinados (ANO = ano da assinatura). " + SI_DUP_PT,
    NOTA_SI_EN + "Signed instruments (ANO = signing year). " + SI_DUP_EN)
add("orc_siconv_vconv_2226", "Repasse federal em convênios/contratos firmados, 2022-2026 (R$)",
    "Federal transfer in signed agreements/contracts, 2022-2026 (R$)", *SUB2, FON_SI, "R$", 0, "2022-2026", VC,
    NOTA_SI_PT + "VL_REPASSE_CONV: valor pactuado (não é o efetivamente liberado). " + SI_DUP_PT,
    NOTA_SI_EN + "VL_REPASSE_CONV: agreed amount (not necessarily released). " + SI_DUP_EN)
add("orc_siconv_vdesemb_2226", "Repasse federal desembolsado em convênios firmados, 2022-2026 (R$)",
    "Federal transfer disbursed in signed agreements, 2022-2026 (R$)", *SUB2, FON_SI, "R$", 0, "2022-2026", VD,
    NOTA_SI_PT + "VL_DESEMBOLSADO_CONV acumulado até a carga; instrumentos recentes ainda têm pouco desembolso. " + SI_DUP_PT,
    NOTA_SI_EN + "VL_DESEMBOLSADO_CONV cumulative up to the dump; recent instruments have little disbursement. " + SI_DUP_EN)
add("orc_siconv_vconv_pc_2226", "Repasse em convênios firmados per capita, 2022-2026 (R$/hab)",
    "Transfer in signed agreements per capita, 2022-2026 (R$/inh.)", *SUB2, FON_SI, "R$/hab", 2, "2022-2026", pc(VC),
    NOTA_SI_PT + "Dividido pela população do Censo 2022 (acumulado de 5 anos).", NOTA_SI_EN + "Divided by 2022 Census population (5-year cumulative).")
add("orc_siconv_vconv_pe_2226", "Repasse em convênios firmados por eleitor apto, 2022-2026 (R$/eleitor)",
    "Transfer in signed agreements per eligible voter, 2022-2026 (R$/voter)", *SUB2, FON_SI, "R$/eleitor", 2, "2022-2026", pe(VC),
    NOTA_SI_PT + "Dividido pelos eleitores aptos do 1º turno de 2026.", NOTA_SI_EN + "Divided by eligible voters in the 2026 first round.")
for a in ANOS:
    d = agg_by_ibge(f"select mun, sum(vrep) from cm where ano={a} group by 1")
    add(f"orc_siconv_vconv_{a}", f"Repasse federal em convênios firmados em {a} (R$)",
        f"Federal transfer in agreements signed in {a} (R$)", *SUB2, FON_SI, "R$", 0, a, vec(d, 0),
        NOTA_SI_PT + ("2026 incompleto. " if a == 2026 else "") + SI_DUP_PT, NOTA_SI_EN + ("2026 incomplete. " if a == 2026 else "") + SI_DUP_EN)
d = agg_by_ibge("select cm.mun, sum(emv.vem), sum(emv.vind) from cm join emv on emv.id=cm.id group by 1")
VE = vec(d, 0)
add("orc_siconv_vemenda_2226", "Parte do repasse dos convênios firmados que veio de emendas, 2022-2026 (R$)",
    "Part of signed-agreement transfers funded by amendments, 2022-2026 (R$)", *SUB2, FON_SI, "R$", 0, "2022-2026", VE,
    NOTA_SI_PT + "Soma de VALOR_REPASSE_EMENDA (siconv_emenda) das propostas que viraram convênio; inclui bancada, comissão, relator e individuais. "
    "Já está dentro de orc_siconv_vconv_2226 e de orc_emenda_rec_*/orc_emloc_*: NÃO some.", NOTA_SI_EN + "Sum of VALOR_REPASSE_EMENDA of proposals that became agreements; includes caucus, committee, rapporteur and individual. "
    "Already inside orc_siconv_vconv_2226 and orc_emenda_rec_*/orc_emloc_*: do NOT add.")
add("orc_siconv_pct_emenda_2226", "% do repasse em convênios firmados que veio de emendas",
    "% of signed-agreement transfers funded by amendments", *SUB2, FON_SI, "%", 1, "2022-2026", pct(VE, VC),
    NOTA_SI_PT + "Pode passar de 100% em casos raros (soma de emendas por proposta > repasse do convênio, p. ex. cancelamentos); nulo sem convênios.",
    NOTA_SI_EN + "Can exceed 100% in rare cases; null when no agreements.")

# ================================================================= 3. SIOP: execução regionalizada por município
FON_SIOP = "SIOP — Acompanhamento orçamentário / regionalização da execução"
SUB3 = ("Execução federal regionalizada (SIOP)", "Federal execution regionalized (SIOP)")
rows_ibge = {}  # ano -> {ibge: (liq, n)}
unm = {}
# 2024 (arquivo de regionalização com código IBGE) e 2025 (idem) dentro dos zips de acompanhamento
for a, memb in ((2024, "AcompanhamentoOrcamentario_2024JanDez_20260707_ascii_Regionalizacao.csv"),
                (2025, "AcompanhamentoOrcamentario_2025JanDez_20260522_ascii_Regionalizacao.csv")):
    z = zipfile.ZipFile(f"{ORC}/siop/acompanhamento_{a}.zip")
    pth = utf8_copy(z.read(memb), f"reg{a}.csv")
    csv_view(f"r{a}", pth)
    d = agg_by_ibge(f"""select regionalizacao_execucao_codigoibgemunicipio, sum({tonum('regionalizacao_execucao_liquidado')}), count(*)
      from r{a} where length(regionalizacao_execucao_codigoibgemunicipio)=7 group by 1""")
    rows_ibge[a] = d
# 2022 e 2023: só nome do município + UF -> casamento por nome normalizado
for a, memb in ((2022, "AcompanhamentoOrcamentario_2022JanDez_20230217_ascii.csv"),
                (2023, "AcompanhamentoOrcamentario_2023JanDez_20250317_ascii.csv")):
    z = zipfile.ZipFile(f"{ORC}/siop/acompanhamento_{a}.zip")
    pth = utf8_copy(z.read(memb), f"reg{a}.csv")
    csv_view(f"r{a}", pth)
    rr = con.execute(f"""select regionalizacao_execucao_siglauf uf, regionalizacao_execucao_descricaomunicipio nm,
       sum({tonum('regionalizacao_execucao_liquidado')}), count(*) from r{a}
       where regionalizacao_execucao_descricaomunicipio not in ('','Não definido','Nao definido') and regionalizacao_execucao_descricaomunicipio is not null
       group by 1,2""").fetchall()
    d = {}
    for uf, nm, v, n in rr:
        k = NOME2IBGE.get((uf, norm(nm)))
        if k is None:
            unm.setdefault(a, []).append((uf, nm, v))
            continue
        o = d.get(k, (0.0, 0))
        d[k] = (o[0] + (v or 0.0), o[1] + n)
    rows_ibge[a] = d
NOTA_SIOP_PT = ("Valor LIQUIDADO (R$ nominais) que o órgão gestor informou na regionalização da execução para este município, somado "
                "sobre as ações que foram regionalizadas por município. Só uma parte do orçamento federal é regionalizada (poucas centenas de municípios, "
                "com forte peso de capitais e sedes de órgãos, p. ex. Brasília, Rio de Janeiro); municípios sem registro ficam NULOS "
                "(ausência NÃO significa zero gasto). Não é emenda nem transferência: é gasto/localização informada pelo órgão, e pode "
                "se sobrepor a emendas, convênios e transferências. Não use como medida de repasse ao município. ")
NOTA_SIOP_EN = ("LIQUIDATED amount (nominal R$) reported by the managing body in the execution regionalization for this municipality, "
                "summed over the actions regionalized by municipality. Only part of the federal budget is regionalized (a few hundred "
                "municipalities, dominated by capitals and agency headquarters, e.g. Brasília, Rio de Janeiro); municipalities without records are NULL "
                "(absence does NOT mean zero spending). Not an amendment or transfer: location as reported by the body; may overlap with "
                "amendments, agreements and transfers. Do not use as a measure of transfers to the municipality. ")
for a in (2022, 2023, 2024, 2025):
    d = rows_ibge[a]
    v = [d[k][0] if k in d else None for k in IBGE]
    extra_pt = ("Município obtido por nome normalizado + UF (a base de 2022/2023 não traz código IBGE). " if a < 2024 else
                "Município pelo código IBGE da própria base. ")
    extra_en = ("Municipality matched by normalized name + state (the 2022/2023 file has no IBGE code). " if a < 2024 else
                "Municipality from the file's own IBGE code. ")
    add(f"orc_siop_reg_liq_{a}", f"Execução federal regionalizada no município, liquidado {a} (R$)",
        f"Federal execution regionalized to the municipality, liquidated {a} (R$)", *SUB3, FON_SIOP, "R$", 0, a, v,
        NOTA_SIOP_PT + extra_pt, NOTA_SIOP_EN + extra_en)
    add(f"orc_siop_reg_liq_pc_{a}", f"Execução federal regionalizada per capita, liquidado {a} (R$/hab)",
        f"Federal execution regionalized per capita, liquidated {a} (R$/inh.)", *SUB3, FON_SIOP, "R$/hab", 2, a, pc(v),
        NOTA_SIOP_PT + extra_pt + "Dividido pela população do Censo 2022.", NOTA_SIOP_EN + extra_en + "Divided by 2022 Census population.")

# ================================================================= 4. PORTAL: transferências mensais (só anos completos)
FON_TR = "Portal da Transparência (CGU) — Transferências de recursos"
meses = {}
for f in glob.glob(f"{ORC}/portal_transferencias/*_Transferencias.zip"):
    m = os.path.basename(f)[:6]
    if m >= "202201":
        meses.setdefault(m[:4], []).append(f)
anos_ok = [y for y, fs in sorted(meses.items()) if len(fs) == 12]
PEND_TR = {y: len(fs) for y, fs in meses.items() if len(fs) != 12}
if anos_ok:
    # SIAFI -> IBGE por tabmun.csv (Tesouro) ou nome+UF; implementação só roda quando houver 12 meses
    TR = {}
    for y in anos_ok:
        for f in meses[y]:
            pth = un(f, dest=f"{TMP}/tr")
            csv_view("t", pth, "latin-1")
            hdr = [r[0] for r in con.execute("describe t").fetchall()]
            cm_ = [h for h in hdr if "MUNIC" in h.upper() and "NOME" in h.upper()][0]
            ct_ = [h for h in hdr if "TIPO TRANSFER" in h.upper()][0]
            cu_ = [h for h in hdr if h.upper() == "UF"][0]
            cv_ = [h for h in hdr if "VALOR" in h.upper()][0]
            for uf, nm, tp, v in con.execute(f'select "{cu_}", "{cm_}", "{ct_}", sum({tonum(chr(34)+cv_+chr(34))}) from t '
                                             f'where "{cm_}" is not null and "{cm_}"<>\'\' group by 1,2,3').fetchall():
                k = NOME2IBGE.get((uf, norm(nm)))
                if k:
                    TR.setdefault((y, k), {}).setdefault(tp, 0.0)
                    TR[(y, k)][tp] += v or 0.0
    for y in anos_ok:
        tot = [sum(TR.get((y, k), {}).values()) if (y, k) in TR else None for k in IBGE]
        cr = [TR.get((y, k), {}).get("Constitucionais e Royalties") if (y, k) in TR else None for k in IBGE]
        add(f"orc_transf_total_{y}", f"Transferências federais ao município, {y} (R$)", f"Federal transfers to the municipality, {y} (R$)",
            "Transferências federais", "Federal transfers", FON_TR, "R$", 0, int(y), tot,
            "Soma mensal; casamento SIAFI->IBGE por nome+UF. Sobrepõe emendas e convênios.", "Monthly sum; SIAFI->IBGE by name+state. Overlaps amendments and agreements.")
        add(f"orc_transf_const_pct_{y}", f"% das transferências que são constitucionais e royalties, {y}",
            f"% of transfers that are constitutional and royalties, {y}", "Transferências federais", "Federal transfers", FON_TR,
            "%", 1, int(y), pct(cr, tot), "Tipo 'Constitucionais e Royalties' sobre o total.", "'Constitutional and royalties' type over total.")

# ================================================================= saída
for k in COLS:
    assert len(COLS[k]) == N, k
    COLS[k] = [None if x is None else (round(float(x), 4)) for x in COLS[k]]
out = {"fonte": "orc_federal", "ibge": IBGE, "vars": VARS, "cols": COLS}
json.dump(out, open(OUT, "w"), ensure_ascii=False)

# resumo/checagens para o relatório
if __name__ == "__main__":
    print("variáveis:", len(VARS), "municípios:", N)
    for v in VARS:
        k = v["k"]
        c = [x for x in COLS[k] if x is not None]
        print(f"{k:34s} n={len(c):5d} nz={sum(1 for x in c if x):5d} soma={sum(c):.4g}")
    print("pendência transferências (meses por ano):", PEND_TR)
    print("fora da lista 5570:", FV_FORA)
    print("PorFavorecido: total municipal nacional", FV_TOT_NAC, "sem casamento", len(fv_unm), sorted(fv_unm.items(), key=lambda t:-t[1])[:12], "soma nao casada", sum(fv_unm.values()))
    for a, l in unm.items():
        print("SIOP", a, "sem casamento:", len(l), sorted(l, key=lambda t: -(t[2] or 0))[:10])
    tot = con.execute("select sum(emp), sum(pago) from e_all").fetchall() if False else None
