"""Gera dados_externos/parciais/orc_beneficios_credito.json (contrato: dados_externos/CONTRATO_DADOS.md).

Fontes (brutos em /mnt/e/EleicoesBrasil_externos/orcamento):
  - social/ipeadata/{VAL,FAM}_PBF.json  : Bolsa Familia/Auxilio Brasil por municipio (Ipeadata/MDS), 2022-2025
  - credito/estban/AAAAMM_ESTBAN_municipio.{zip,csv} : BCB ESTBAN (saldos por municipio x banco)
  - credito/bndes/operacoes-nao-automaticas.csv, bndes/operacoes_indiretas_automaticas.csv : BNDES (contratado/desembolsado)
  - cidades/carteira_investimento_mcid.csv (1,3 GB; lido so por duckdb, agregado por municipio)
PENDENTE (nao baixado ou incompleto): Novo Bolsa Familia e BPC do Portal da Transparencia (so .part/arquivos pre-2022),
  desembolsos-mensais.csv do BNDES. Ver RELATORIO_PARCIAL_orc_beneficios_credito.md.

Uso: /mnt/d/01_claudeCode/10_EleicoesBrasil/.venv/bin/python orc_beneficios_credito_para_parcial.py
"""
import csv, glob, io, json, os, re, sys, unicodedata, zipfile
import duckdb

EXT = "/mnt/e/EleicoesBrasil_externos"
ORC = f"{EXT}/orcamento"
PARC = "/mnt/d/01_claudeCode/10_EleicoesBrasil/dados_externos/parciais"
OUT = f"{PARC}/orc_beneficios_credito.json"
LOC = f"{EXT}/ibge/localidades/municipios_nivelado.json"
MCID_PARQUET = os.environ.get("MCID_PARQUET")  # atalho opcional (cache da agregacao), nao obrigatorio

ANOS = [2022, 2023, 2024, 2025]
G = ("Orçamento e gasto público — {}", "Public budget and spending — {}")

# ---------- base: municipios, populacao, aptos ----------
loc = json.load(open(LOC))
ids = [str(m["municipio-id"]) for m in loc]
_res = set(json.load(open(f"{PARC}/resultados.json"))["ibge"])  # 5.570 municipios do contrato (exclui 5101837, criado depois do Censo/TSE)
MUN = sorted(set(ids) & _res)
IDX = {c: i for i, c in enumerate(MUN)}
N = len(MUN)


def parcial_col(arq, k):
    d = json.load(open(f"{PARC}/{arq}.json"))
    pos = {c: i for i, c in enumerate(d["ibge"])}
    col = d["cols"][k]
    return [col[pos[c]] if c in pos else None for c in MUN]


POP = parcial_col("ibge", "censo_pop")
APT = parcial_col("resultados", "res22_t1_aptos")

VARS, COLS = [], {}


def add(k, pt, en, sub, fonte, unidade, dec, ano, col, nota_pt, nota_en, papel="contexto"):
    gp, ge = G[0].format(sub[0]), G[1].format(sub[1])
    VARS.append(dict(k=k, pt=pt, en=en, grupo_pt=gp, grupo_en=ge, fonte=fonte, unidade=unidade, dec=dec,
                     ano=ano, tipo="num", papel=papel, nota_pt=nota_pt, nota_en=nota_en))
    COLS[k] = col


def ratio(col, den, mult=1.0):
    return [None if (v is None or d in (None, 0)) else v * mult / d for v, d in zip(col, den)]


def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().upper()
    return re.sub(r"[^A-Z0-9]+", " ", s).strip()


def vec(dct, zero=False):
    return [dct.get(c, 0 if zero else None) for c in MUN]


# ---------- 1. Bolsa Familia / Auxilio Brasil (Ipeadata/MDS) ----------
SUB_PBF = ("Benefícios sociais (Bolsa Família/Auxílio Brasil)", "Social benefits (Bolsa Família/Auxílio Brasil)")
NP_PBF_PT = ("Fonte: Ipeadata/MDS, séries VAL_PBF (R$ mil) e FAM_PBF (nº de benefícios), município IBGE7; rótulo do ano = posição de "
             "dezembro (confirmado: a série tem 1 ponto por ano, 5.570 municípios). Em 2022 o programa chamava-se Auxílio Brasil (R$ 600 a partir de "
             "ago/2022) e em 2023+ Novo Bolsa Família. Valores nominais, sem deflacionar. ALERTA: o valor médio por benefício de 2022 na série "
             "(R$ 381) é bem menor que o de 2023 (R$ 655), apesar do benefício de R$ 600 em dez/2022: a série de 2022 pode não incluir todo o "
             "complemento do Auxílio Brasil; não compare 2022 x 2023 em valor sem essa ressalva (a contagem de benefícios é comparável). "
             "O arquivo do Portal da Transparência (pagamento por beneficiário) não está baixado para 2022+; ver relatório. "
             "Não somar com BPC (outro benefício) nem com Pé-de-Meia. Sem ausências: todos os 5.570 municípios têm valor (0 = sem benefício).")
NP_PBF_EN = ("Source: Ipeadata/MDS series VAL_PBF (R$ thousand) and FAM_PBF (number of benefits), IBGE7 municipality; the year label = December "
             "position (one point per year, 5,570 municipalities). In 2022 the program was Auxílio Brasil (R$ 600 from Aug/2022); 2023+ is Novo "
             "Bolsa Família. Nominal values, not deflated. WARNING: average value per benefit in 2022 (R$ 381) is far below 2023 (R$ 655) despite "
             "the R$ 600 benefit in Dec/2022: the 2022 series may omit part of the Auxílio Brasil supplement; do not compare 2022 vs 2023 values "
             "without this caveat (benefit counts are comparable). The Portal da Transparência beneficiary-level payments are not downloaded for "
             "2022+; see report. Do not add BPC or Pé-de-Meia. No gaps: all 5,570 municipalities have a value (0 = no benefit).")
pbf = {}
for ser in ("VAL_PBF", "FAM_PBF"):
    d = json.load(open(f"{ORC}/social/ipeadata/{ser}.json"))["value"]
    for x in d:
        if x["NIVNOME"] != "Municípios" or x["VALVALOR"] is None:
            continue
        a = int(x["VALDATA"][:4])
        if a in ANOS:
            pbf.setdefault((ser, a), {})[str(x["TERCODIGO"])] = float(x["VALVALOR"])
for a in ANOS:
    v = vec(pbf.get(("VAL_PBF", a), {}), zero=True)
    v = [x * 1000 for x in v]  # R$ mil -> R$
    f = vec(pbf.get(("FAM_PBF", a), {}), zero=True)
    src = "Ipeadata/MDS (Bolsa Família/Auxílio Brasil)"
    add(f"orc_pbf_val_{a}", f"Bolsa Família/Auxílio Brasil — valor em dezembro de {a} (R$)", f"Bolsa Família/Auxílio Brasil — value in December {a} (R$)",
        SUB_PBF, src, "R$", 0, a, v, NP_PBF_PT, NP_PBF_EN)
    add(f"orc_pbf_val_pc_{a}", f"Bolsa Família/Auxílio Brasil — valor em dez/{a} per capita (R$/hab)", f"Bolsa Família/Auxílio Brasil — Dec/{a} value per capita (R$/inhab.)",
        SUB_PBF, src, "R$/hab", 2, a, ratio(v, POP), "Valor de dezembro dividido pela população do Censo 2022. " + NP_PBF_PT, "December value divided by 2022 Census population. " + NP_PBF_EN)
    add(f"orc_pbf_val_pe_{a}", f"Bolsa Família/Auxílio Brasil — valor em dez/{a} por eleitor apto (R$)", f"Bolsa Família/Auxílio Brasil — Dec/{a} value per eligible voter (R$)",
        SUB_PBF, src, "R$/eleitor", 2, a, ratio(v, APT), "Valor de dezembro dividido pelos eleitores aptos do 1º turno de 2022 (res22_t1_aptos). " + NP_PBF_PT, "December value divided by 2022 first-round eligible voters. " + NP_PBF_EN)
    add(f"orc_pbf_ben_{a}", f"Bolsa Família/Auxílio Brasil — nº de benefícios em dez/{a}", f"Bolsa Família/Auxílio Brasil — number of benefits, Dec/{a}",
        SUB_PBF, src, "benefícios", 0, a, f, "Número de benefícios (famílias). " + NP_PBF_PT, "Number of benefits (families). " + NP_PBF_EN)
    add(f"orc_pbf_ben_pct_pop_{a}", f"Bolsa Família/Auxílio Brasil — benefícios em dez/{a} por 100 habitantes", f"Bolsa Família/Auxílio Brasil — benefits per 100 inhabitants, Dec/{a}",
        SUB_PBF, src, "por 100 hab.", 2, a, ratio(f, POP, 100), "Benefícios (famílias) por 100 habitantes do Censo 2022; pode passar de 30 em municípios muito pobres. " + NP_PBF_PT, "Benefits (families) per 100 inhabitants (2022 Census); can exceed 30 in very poor municipalities. " + NP_PBF_EN)

# ---------- 2. ESTBAN ----------
SUB_BC = ("Crédito bancário (BCB ESTBAN)", "Bank credit (BCB ESTBAN)")
VERB = {"cred": "VERBETE_160_OPERACOES_DE_CREDITO", "poup": "VERBETE_420_DEPOSITOS_DE_POUPANCA",
        "ativo": "VERBETE_399_TOTAL_DO_ATIVO"}


def estban_mes(aaaamm):
    cand = glob.glob(f"{ORC}/credito/estban/{aaaamm}_ESTBAN_municipio.*")
    cand = [c for c in cand if not c.endswith(".part")]
    if not cand:
        return None
    p = cand[0]
    if p.lower().endswith(".zip"):
        z = zipfile.ZipFile(p)
        raw = z.read(z.namelist()[0])
    else:
        raw = open(p, "rb").read()
    txt = raw.decode("latin-1")
    lines = txt.split("\n")
    i0 = next(i for i, l in enumerate(lines) if l.startswith("#DATA_BASE"))
    rd = csv.reader(lines[i0:], delimiter=";")
    hdr = next(rd)
    h = {n.strip(): i for i, n in enumerate(hdr)}
    dep_col = next(n for n in h if n.startswith("VERBETE_401_"))
    out = {k: {} for k in ("cred", "poup", "dep", "ativo", "ag")}
    seen = {}  # (mun, cnpj) para agencias
    for r in rd:
        if len(r) < len(hdr) - 1 or not r[0].strip():
            continue
        ibge = r[h["CODMUN_IBGE"]].strip().zfill(7)
        if ibge not in IDX:
            continue

        def num(n):
            try:
                return float(r[h[n]].replace(",", "."))
            except Exception:
                return 0.0
        for k, v in (("cred", num(VERB["cred"])), ("poup", num(VERB["poup"])), ("ativo", num(VERB["ativo"])),
                     ("dep", num(dep_col) + num(VERB["poup"]) + num("VERBETE_432_DEPOSITOS_A_PRAZO"))):
            out[k][ibge] = out[k].get(ibge, 0.0) + v
        out["ag"][ibge] = out["ag"].get(ibge, 0) + int(num("AGEN_PROCESSADAS"))
    return out


NP_E_PT = ("Fonte: BCB ESTBAN (Documento 4500), saldo de fim de mês, em R$ (unidade), soma de todos os bancos com agência no município. "
           "É ESTOQUE (não fluxo) e nominal. O crédito (verbete 160, operações de crédito) é contabilizado no município da AGÊNCIA, não do tomador: "
           "bancos digitais/sedes concentram saldo (distorce capitais) e a ESTBAN cobre bancos comerciais, múltiplos e Caixa, não cooperativas de "
           "crédito. Município sem agência bancária não aparece na fonte: valor ausente (null), não zero. Chave BCB convertida pela coluna CODMUN_IBGE do próprio arquivo (≈60 linhas sem código IBGE, todas com crédito zero, são ignoradas). Não há ESTBAN comparável após abr/2026: em mai-jun/2026 o crédito de Caixa e BB em Brasília salta para ~R$ 1,5 tri cada (quebra de série/reclassificação), por isso o último ponto usado é mar/2026. Depósitos: os rótulos dos verbetes 430-432 são inconsistentes no arquivo; usa-se 401-419 + 420 + 432 (exclui 430/431 interfinanceiros).")
NP_E_EN = ("Source: BCB ESTBAN (Document 4500), month-end balance in R$ (units), summed over all banks with a branch in the municipality. It is a STOCK "
           "(not a flow), nominal. Credit (item 160, credit operations) is booked at the BRANCH municipality, not the borrower's: digital banks/head offices "
           "concentrate balances (distorts capitals) and ESTBAN covers commercial/multiple banks and Caixa, not credit unions. A municipality without a bank "
           "branch is absent from the source: null, not zero. BCB code converted using the CODMUN_IBGE column of the file itself (~60 rows without IBGE code, all with zero credit, are ignored). No comparable ESTBAN after Apr/2026: in May-Jun/2026 Caixa and BB credit in Brasília jumps to ~R$ 1.5 trillion each (series break/reclassification), so the last point used is Mar/2026. Deposits: item 430-432 labels are inconsistent in the file; uses 401-419 + 420 + 432 (excludes interbank 430/431).")
pontos = [(a, f"{a}12") for a in ANOS] + [(2026, "202603")]
est_nat = {}
for a, ym in pontos:
    e = estban_mes(ym)
    if e is None:
        print("ESTBAN ausente", ym, file=sys.stderr)
        continue
    lab = f"dez/{a}" if ym.endswith("12") else "mar/2026"
    sfx = str(a) if ym.endswith("12") else "2603"
    for k, nm_pt, nm_en in (("cred", "Saldo de operações de crédito", "Credit operations balance"),
                            ("poup", "Saldo de depósitos de poupança", "Savings deposits balance"),
                            ("dep", "Saldo de depósitos de clientes (à vista/outros 401-419 + poupança 420 + a prazo 432)", "Customer deposits balance (demand/other 401-419 + savings 420 + time 432)")):
        v = vec(e[k])
        v = [x if (x is not None and e["ag"].get(c, 0) >= 0) else None for x, c in zip(v, MUN)]
        est_nat[(k, sfx)] = sum(x for x in v if x)
        add(f"orc_estban_{k}_{sfx}", f"{nm_pt} (ESTBAN, {lab}) (R$)", f"{nm_en} (ESTBAN, {lab}) (R$)", SUB_BC, "BCB — ESTBAN", "R$", 0, a, v, NP_E_PT, NP_E_EN)
        add(f"orc_estban_{k}_pc_{sfx}", f"{nm_pt} per capita (ESTBAN, {lab}) (R$/hab)", f"{nm_en} per capita (ESTBAN, {lab}) (R$/inhab.)", SUB_BC, "BCB — ESTBAN", "R$/hab", 0, a, ratio(v, POP),
            "Saldo dividido pela população do Censo 2022. " + NP_E_PT, "Balance divided by 2022 Census population. " + NP_E_EN)
    add(f"orc_estban_ag_{sfx}", f"Agências bancárias processadas na ESTBAN ({lab}), soma dos bancos", f"Bank branches processed in ESTBAN ({lab}), sum over banks", SUB_BC, "BCB — ESTBAN", "agências", 0, a,
        vec(e["ag"]), "Soma de AGEN_PROCESSADAS por banco; município sem registro = null (sem agência). " + NP_E_PT, "Sum of AGEN_PROCESSADAS over banks; municipality missing = null (no branch). " + NP_E_EN)
    if ym == "202412" or ym == "202603":
        cr = vec(e["cred"]); dp = vec(e["dep"])
        add(f"orc_estban_cred_dep_{sfx}", f"Razão crédito/depósitos totais (ESTBAN, {lab}) (%)", f"Credit-to-deposits ratio (ESTBAN, {lab}) (%)", SUB_BC, "BCB — ESTBAN", "%", 1, a,
            ratio(cr, dp, 100), "Operações de crédito ÷ depósitos totais na agência do município. Indica município captador (<100) ou aplicador (>100); sem depósitos = null. " + NP_E_PT,
            "Credit operations ÷ total deposits at the municipality's branches. Net saver (<100) or net lender (>100); no deposits = null. " + NP_E_EN)

# ---------- 3. BNDES ----------
SUB_BN = ("Crédito e investimento (BNDES)", "Credit and investment (BNDES)")
con = duckdb.connect()
CSVOPT = "delim=';', header=true, all_varchar=true, ignore_errors=true, quote='\"'"
NP_B_PT = ("Fonte: BNDES dados abertos. Valores nominais (R$ correntes), por ano da DATA DE CONTRATAÇÃO. 'Contratado' = valor da operação; 'desembolsado' = "
           "acumulado liberado até a data do arquivo (contratos recentes ainda estão sendo liberados). Município = o do projeto/cliente/propriedade, não "
           "necessariamente onde o recurso é gasto (sede da empresa em operações corporativas). Operações indiretas passam por agente financeiro. "
           "Município sem operação = 0 (a fonte cobre o Brasil todo; ausência equivale a nenhuma operação contratada naquele ano). "
           "ATENÇÃO dupla contagem: operações diretas/indiretas não automáticas e indiretas automáticas são arquivos distintos (sem sobreposição), mas não some com o "
           "desembolso mensal total do BNDES (não baixado).")
NP_B_EN = ("Source: BNDES open data. Nominal values (current R$), by CONTRACT DATE year. 'Contracted' = operation value; 'disbursed' = cumulative released up to the file "
           "date (recent contracts are still being disbursed). Municipality = the project/client/property location, not necessarily where funds are spent "
           "(company headquarters in corporate operations). Indirect operations go through a financial agent. A municipality without operations = 0 (the source covers "
           "all of Brazil; absence means no operation contracted that year). WARNING: non-automatic and automatic indirect files are distinct (no overlap) but do "
           "not add them to the total monthly BNDES disbursement file (not downloaded).")


def bndes_agg(path, cod, dt, vc, vd, extra=""):
    q = f"""select {cod} as ibge, year(try_cast({dt} as date)) as ano,
        sum(try_cast(replace({vc},',','.') as double)) as contr,
        sum(try_cast(replace({vd},',','.') as double)) as desemb, count(*) as n
        from read_csv('{path}', {CSVOPT}, encoding='utf-8') {extra} group by 1,2"""
    return con.sql(q).fetchall()


def bndes_load(path, cod, dt, vc, vd, extra=""):
    r = {}
    for ibge, ano, c, d, n in bndes_agg(path, cod, dt, vc, vd, extra):
        if ano in ANOS and ibge:
            r.setdefault(ano, {})[str(ibge).strip().zfill(7)] = (c or 0.0, d or 0.0, n)
    return r


na = bndes_load(f"{ORC}/credito/bndes/operacoes-nao-automaticas.csv", "municipio_codigo", "data_da_contratacao",
                "valor_contratado_reais", "valor_desembolsado_reais")
ia = bndes_load(f"{ORC}/bndes/operacoes_indiretas_automaticas.csv", "municipio_codigo", "data_da_contratacao",
                "valor_da_operacao_em_reais", "valor_desembolsado_reais")
bndes_tot = {}
for a in ANOS:
    tot_c = [0.0] * N
    tot_d = [0.0] * N
    for nome, srcd, lab_pt, lab_en in (("na", na, "operações diretas e indiretas não automáticas", "direct and non-automatic indirect operations"),
                                       ("ia", ia, "operações indiretas automáticas", "automatic indirect operations")):
        dd = srcd.get(a, {})
        c = [dd.get(m, (0, 0, 0))[0] for m in MUN]
        d = [dd.get(m, (0, 0, 0))[1] for m in MUN]
        n = [dd.get(m, (0, 0, 0))[2] for m in MUN]
        tot_c = [x + y for x, y in zip(tot_c, c)]
        tot_d = [x + y for x, y in zip(tot_d, d)]
        add(f"orc_bndes_{nome}_contr_{a}", f"BNDES {lab_pt} — valor contratado em {a} (R$)", f"BNDES {lab_en} — value contracted in {a} (R$)", SUB_BN, "BNDES dados abertos", "R$", 0, a, c, NP_B_PT, NP_B_EN)
        add(f"orc_bndes_{nome}_n_{a}", f"BNDES {lab_pt} — nº de operações contratadas em {a}", f"BNDES {lab_en} — number of operations contracted in {a}", SUB_BN, "BNDES dados abertos", "operações", 0, a, n, NP_B_PT, NP_B_EN)
    add(f"orc_bndes_contr_{a}", f"BNDES total (não automáticas + indiretas automáticas) — contratado em {a} (R$)", f"BNDES total (non-automatic + automatic indirect) — contracted in {a} (R$)", SUB_BN, "BNDES dados abertos", "R$", 0, a, tot_c, NP_B_PT, NP_B_EN)
    add(f"orc_bndes_contr_pc_{a}", f"BNDES total contratado em {a} per capita (R$/hab)", f"BNDES total contracted in {a} per capita (R$/inhab.)", SUB_BN, "BNDES dados abertos", "R$/hab", 2, a, ratio(tot_c, POP), "Dividido pela população do Censo 2022. " + NP_B_PT, "Divided by 2022 Census population. " + NP_B_EN)
    add(f"orc_bndes_desemb_{a}", f"BNDES total — desembolsado (até hoje) dos contratos de {a} (R$)", f"BNDES total — disbursed (to date) for {a} contracts (R$)", SUB_BN, "BNDES dados abertos", "R$", 0, a, tot_d, NP_B_PT, NP_B_EN)
    bndes_tot[a] = (sum(tot_c), sum(tot_d))
# 2022+ acumulado
cum = [sum(COLS[f"orc_bndes_contr_{a}"][i] for a in ANOS) for i in range(N)]
add("orc_bndes_contr_2225", "BNDES total contratado 2022-2025 (R$)", "BNDES total contracted 2022-2025 (R$)", SUB_BN, "BNDES dados abertos", "R$", 0, 2225, cum, NP_B_PT, NP_B_EN)
add("orc_bndes_contr_pc_2225", "BNDES total contratado 2022-2025 per capita (R$/hab)", "BNDES total contracted 2022-2025 per capita (R$/inhab.)", SUB_BN, "BNDES dados abertos", "R$/hab", 2, 2225, ratio(cum, POP), "Dividido pela população do Censo 2022. " + NP_B_PT, "Divided by 2022 Census population. " + NP_B_EN)
add("orc_bndes_contr_pe_2225", "BNDES total contratado 2022-2025 por eleitor apto (R$)", "BNDES total contracted 2022-2025 per eligible voter (R$)", SUB_BN, "BNDES dados abertos", "R$/eleitor", 2, 2225, ratio(cum, APT), "Dividido pelos aptos do 1º turno 2022. " + NP_B_PT, "Divided by 2022 first-round eligible voters. " + NP_B_EN)

# ---------- 4. Carteira MCID ----------
SUB_MC = ("Habitação e obras (Carteira Ministério das Cidades)", "Housing and works (Ministry of Cities portfolio)")
MC_CSV = f"{ORC}/cidades/carteira_investimento_mcid.csv"
MC_KEEP = ["cod_tci", "txt_origem", "cod_ibge_7dig", "dte_assinatura_contrato", "bln_emenda", "bln_pac", "bln_carteira_mcid",
           "dsc_situacao_atual", "vlr_investimento", "vlr_repasse", "vlr_empenhado", "vlr_desembolsado", "vlr_pago", "qtd_uh", "qtd_entregues"]
SLIM = os.environ.get("MCID_SLIM", "/tmp/mcid_slim.csv")
if not os.path.exists(SLIM) or os.path.getmtime(SLIM) < os.path.getmtime(MC_CSV):
    # arquivo em cp1252/latin-1 com bytes invalidos em UTF-8: reduz as colunas em streaming (nunca carrega tudo em memoria)
    with open(MC_CSV, "r", encoding="latin-1", newline="") as fi, open(SLIM + ".tmp", "w", encoding="utf-8", newline="") as fo:
        rd = csv.reader(fi, delimiter=";")
        hd = next(rd)
        ix = [hd.index(c) for c in MC_KEEP]
        w = csv.writer(fo)
        w.writerow(MC_KEEP)
        for r in rd:
            if len(r) == len(hd):
                w.writerow([r[i].strip() for i in ix])
    os.replace(SLIM + ".tmp", SLIM)
NUM = lambda c: f"try_cast(replace(nullif({c},''),',','.') as double)"
mc = con.sql(f"""select cod_ibge_7dig as ibge, year(try_cast(dte_assinatura_contrato as date)) as ano,
    count(distinct cod_tci) n, sum({NUM('vlr_investimento')}) inv, sum({NUM('vlr_repasse')}) rep, sum({NUM('vlr_pago')}) pago,
    sum({NUM('vlr_desembolsado')}) des, sum({NUM('qtd_uh')}) uh, sum({NUM('qtd_entregues')}) ent
    from read_csv('{SLIM}', header=true, all_varchar=true) group by 1,2""").fetchall()
mcd = {}
for ibge, ano, n, inv, rep, pago, des, uh, ent in mc:
    if ibge and ano and 2022 <= ano <= 2026:
        mcd.setdefault(str(ibge).zfill(7), {})[ano] = (n, inv or 0, rep or 0, pago or 0, des or 0, uh or 0, ent or 0)
NP_M_PT = ("Fonte: Carteira de Investimentos do Ministério das Cidades (contratos de repasse, MCMV, PAC; arquivo de 03/07/2026), agregada por município "
           "(cod_ibge_7dig) e por ANO DE ASSINATURA do contrato (2022 a 2026; 2026 incompleto). Valores nominais. 'Investimento' = valor total do contrato "
           "(repasse federal + contrapartida + financiamento); 'repasse' = parte federal; 'pago' = efetivamente pago até a data do arquivo (menor que o contratado "
           "em obras em andamento). UH = unidades habitacionais contratadas (MCMV). Sem contrato assinado no ano = 0 (a fonte é a carteira completa; ausência = nenhum contrato). "
           "ATENÇÃO dupla contagem: contratos de repasse podem coincidir com emendas parlamentares/convênios do Transferegov (orc_emenda_*, orc_siconv_*), "
           "e investimento inclui recursos não federais; não some com outras variáveis federais.")
NP_M_EN = ("Source: Ministry of Cities Investment Portfolio (transfer contracts, MCMV, PAC; file dated 2026-07-03), aggregated by municipality (cod_ibge_7dig) and by "
           "contract SIGNATURE YEAR (2022 to 2026; 2026 incomplete). Nominal values. 'Investment' = total contract value (federal transfer + counterpart + financing); "
           "'transfer' = federal share; 'paid' = actually paid up to the file date (lower than contracted for ongoing works). UH = contracted housing units (MCMV). "
           "No contract signed in the year = 0 (full portfolio; absence = no contract). WARNING double counting: transfer contracts may coincide with parliamentary "
           "amendments/Transferegov agreements (orc_emenda_*, orc_siconv_*), and investment includes non-federal funds; do not add to other federal variables.")
mc_nat = {}
for a in [2022, 2023, 2024, 2025, 2026]:
    g = lambda j: [mcd.get(m, {}).get(a, (0,) * 7)[j] for m in MUN]
    inv, rep, pago, uh = g(1), g(2), g(3), g(5)
    mc_nat[a] = (sum(g(0)), sum(inv), sum(pago), sum(uh))
    s = "Habitação e obras (Carteira Ministério das Cidades)"
    f = "Carteira Min. Cidades"
    add(f"orc_mcid_n_{a}", f"Carteira Min. Cidades — contratos assinados em {a} (nº)", f"Ministry of Cities portfolio — contracts signed in {a} (count)", SUB_MC, f, "contratos", 0, a, g(0), NP_M_PT, NP_M_EN)
    add(f"orc_mcid_inv_{a}", f"Carteira Min. Cidades — investimento dos contratos assinados em {a} (R$)", f"Ministry of Cities portfolio — investment of contracts signed in {a} (R$)", SUB_MC, f, "R$", 0, a, inv, NP_M_PT, NP_M_EN)
    add(f"orc_mcid_rep_{a}", f"Carteira Min. Cidades — repasse federal dos contratos assinados em {a} (R$)", f"Ministry of Cities portfolio — federal transfer of contracts signed in {a} (R$)", SUB_MC, f, "R$", 0, a, rep, NP_M_PT, NP_M_EN)
    add(f"orc_mcid_pago_{a}", f"Carteira Min. Cidades — valor pago dos contratos assinados em {a} (R$)", f"Ministry of Cities portfolio — amount paid on contracts signed in {a} (R$)", SUB_MC, f, "R$", 0, a, pago, NP_M_PT, NP_M_EN)
    add(f"orc_mcid_uh_{a}", f"Carteira Min. Cidades — unidades habitacionais dos contratos assinados em {a}", f"Ministry of Cities portfolio — housing units of contracts signed in {a}", SUB_MC, f, "UH", 0, a, uh, NP_M_PT, NP_M_EN)
tot = lambda j: [sum(mcd.get(m, {}).get(a, (0,) * 7)[j] for a in range(2022, 2027)) for m in MUN]
inv_t, rep_t, pago_t, uh_t = tot(1), tot(2), tot(3), tot(5)
f = "Carteira Min. Cidades"
add("orc_mcid_inv_2226", "Carteira Min. Cidades — investimento dos contratos assinados 2022-2026 (R$)", "Ministry of Cities portfolio — investment of contracts signed 2022-2026 (R$)", SUB_MC, f, "R$", 0, 2226, inv_t, NP_M_PT, NP_M_EN)
add("orc_mcid_inv_pc_2226", "Carteira Min. Cidades — investimento 2022-2026 per capita (R$/hab)", "Ministry of Cities portfolio — investment 2022-2026 per capita (R$/inhab.)", SUB_MC, f, "R$/hab", 2, 2226, ratio(inv_t, POP), "Dividido pela população do Censo 2022. " + NP_M_PT, "Divided by 2022 Census population. " + NP_M_EN)
add("orc_mcid_inv_pe_2226", "Carteira Min. Cidades — investimento 2022-2026 por eleitor apto (R$)", "Ministry of Cities portfolio — investment 2022-2026 per eligible voter (R$)", SUB_MC, f, "R$/eleitor", 2, 2226, ratio(inv_t, APT), "Dividido pelos aptos do 1º turno 2022. " + NP_M_PT, "Divided by 2022 first-round eligible voters. " + NP_M_EN)
add("orc_mcid_rep_pc_2226", "Carteira Min. Cidades — repasse federal 2022-2026 per capita (R$/hab)", "Ministry of Cities portfolio — federal transfer 2022-2026 per capita (R$/inhab.)", SUB_MC, f, "R$/hab", 2, 2226, ratio(rep_t, POP), "Dividido pela população do Censo 2022. " + NP_M_PT, "Divided by 2022 Census population. " + NP_M_EN)
add("orc_mcid_pago_pc_2226", "Carteira Min. Cidades — valor pago 2022-2026 per capita (R$/hab)", "Ministry of Cities portfolio — amount paid 2022-2026 per capita (R$/inhab.)", SUB_MC, f, "R$/hab", 2, 2226, ratio(pago_t, POP), "Dividido pela população do Censo 2022. " + NP_M_PT, "Divided by 2022 Census population. " + NP_M_EN)
add("orc_mcid_uh_2226", "Carteira Min. Cidades — unidades habitacionais contratadas 2022-2026", "Ministry of Cities portfolio — housing units contracted 2022-2026", SUB_MC, f, "UH", 0, 2226, uh_t, NP_M_PT, NP_M_EN)
add("orc_mcid_uh_pmil_2226", "Carteira Min. Cidades — UH contratadas 2022-2026 por mil habitantes", "Ministry of Cities portfolio — housing units contracted 2022-2026 per 1,000 inhabitants", SUB_MC, f, "UH/mil hab.", 2, 2226, ratio(uh_t, POP, 1000), NP_M_PT, NP_M_EN)

json.dump({"fonte": "orc_beneficios_credito", "ibge": MUN, "vars": VARS, "cols": COLS}, open(OUT, "w"), ensure_ascii=False)
for a, v in mc_nat.items():
    print("MCID", a, "contratos %d inv %.0f pago %.0f uh %.0f" % v)
print("vars", len(VARS), "municipios", N, "->", OUT)
for k, v in est_nat.items():
    print("ESTBAN nacional", k, f"{v:,.0f}")
for a, v in bndes_tot.items():
    print("BNDES nacional", a, f"contr {v[0]:,.0f} desemb {v[1]:,.0f}")
