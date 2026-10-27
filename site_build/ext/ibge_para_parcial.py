"""Gera dados_externos/parciais/ibge.json (contrato: dados_externos/CONTRATO_DADOS.md) com variáveis IBGE por município.

Fontes (todas IBGE; ver dados_externos/CATALOGO_IBGE.md):
  - Censo 2022, agregados por município (CSV do FTP, em /mnt/e/EleicoesBrasil_externos/ibge/censo2022/municipio/*.zip)
  - SIDRA (API): 9923 (situação do domicílio), 10061 (instrução 18+), 9537 (religião), 10281 (rendimento do trabalho),
    9936 (internet), e PNADC por UF: 4099, 8529, 7531, 10367. JSON bruto em .../ibge/sidra/ + _urls.json (URL usada).
  - PIB dos Municípios 2010-2023 (xlsx) e estimativa de população 2026 (xlsx do DOU).

Uso (precisa de pandas e openpyxl):
  uv run --with pandas --with openpyxl python ibge_para_parcial.py [--so-baixar] [--sem-baixar]
Reprodutível: baixa só o que ainda não existe em sidra/ (apague o arquivo para rebaixar). Máx. 2 requisições simultâneas.
"""
import json, math, os, sys, time, zipfile, io, urllib.request, urllib.parse
from concurrent.futures import ThreadPoolExecutor

import pandas as pd
import openpyxl

BASE = "/mnt/e/EleicoesBrasil_externos/ibge"
CENSO = f"{BASE}/censo2022/municipio"
SIDRA = f"{BASE}/sidra"
OUT = "/mnt/d/01_claudeCode/10_EleicoesBrasil/dados_externos/parciais/ibge.json"
PIBZIP = f"{BASE}/pib_municipios/base_de_dados_2010_2023_xlsx.zip"
POPXLS = f"{BASE}/populacao/estimativa_dou_2026.xlsx"
LOC = f"{BASE}/localidades/municipios_nivelado.json"
API = "https://apisidra.ibge.gov.br/values"

UFS = [11, 12, 13, 14, 15, 16, 17, 21, 22, 23, 24, 25, 26, 27, 28, 29, 31, 32, 33, 35, 41, 42, 43, 50, 51, 52, 53]
SIGLA = {11: "RO", 12: "AC", 13: "AM", 14: "RR", 15: "PA", 16: "AP", 17: "TO", 21: "MA", 22: "PI", 23: "CE", 24: "RN", 25: "PB",
         26: "PE", 27: "AL", 28: "SE", 29: "BA", 31: "MG", 32: "ES", 33: "RJ", 35: "SP", 41: "PR", 42: "SC", 43: "RS",
         50: "MS", 51: "MT", 52: "GO", 53: "DF"}

# tabela -> caminho SIDRA (depois de /values/t/{t}/n6/in n3 {uf}/), por município
SIDRA_MUN = {
    "t9923": "9923|v/93|p/2022|c1/6795,1,2",
    "t10061": "10061|v/1002667|p/2022|c1568/all|c58/95253|c2/6794|c86/95251",
    "t9537": "9537|v/140|p/2022|c133/all|c2/6794|c58/95253",
    "t10281": "10281|v/13535,13536,13537|p/2022|c2/6794|c86/95251|c1568/120704|c526/15349",
    "t9936": "9936|v/381|p/2022|c2072/all|c63/95826|c125/2932",
}
# PNADC por UF (n3/all, 1 requisição por tabela)
SIDRA_PNADC = {
    "pnadc_4099": f"{API}/t/4099/n3/all/v/4099,4118/p/202602,202203",
    "pnadc_8529": f"{API}/t/8529/n3/all/v/12466/p/202602,202203",
    "pnadc_7531": f"{API}/t/7531/n3/all/v/10824/p/2025,2022/c1019/49243",
    "pnadc_10367": f"{API}/t/10367/n3/all/v/608/p/2025,2022/c1568/all",
}


def url_mun(spec, uf):
    t, *partes = spec.split("|")
    return f"{API}/t/{t}/n6/in%20n3%20{uf}/" + "/".join(partes)


def baixar():
    os.makedirs(SIDRA, exist_ok=True)
    man_f = f"{SIDRA}/_urls.json"
    man = json.load(open(man_f)) if os.path.exists(man_f) else {}
    tarefas = []
    for nome, spec in SIDRA_MUN.items():
        for uf in UFS:
            tarefas.append((f"{nome}_uf{uf}.json", url_mun(spec, uf)))
    for nome, u in SIDRA_PNADC.items():
        tarefas.append((f"{nome}.json", u))
    tarefas = [(f, u) for f, u in tarefas if not os.path.exists(f"{SIDRA}/{f}") or os.path.getsize(f"{SIDRA}/{f}") < 50]

    def um(t):
        f, u = t
        for tent in range(5):
            try:
                req = urllib.request.Request(u, headers={"User-Agent": "eleicoesbrasil-ibge/1.0"})
                with urllib.request.urlopen(req, timeout=180) as r:
                    b = r.read()
                d = json.loads(b)
                if not isinstance(d, list) or len(d) < 2:
                    raise ValueError("resposta vazia/erro: " + b[:200].decode("utf8", "ignore"))
                open(f"{SIDRA}/{f}", "wb").write(b)
                return f, u, len(d) - 1
            except Exception as e:  # noqa
                print("  retry", f, tent, str(e)[:120], flush=True)
                time.sleep(3 * (tent + 1))
        raise RuntimeError("falhou " + f)

    print(f"SIDRA: {len(tarefas)} requisições a fazer (2 simultâneas)", flush=True)
    with ThreadPoolExecutor(2) as ex:
        for f, u, n in ex.map(um, tarefas):
            man[f] = u
            print("  ok", f, n, "linhas", flush=True)
    # garante URLs de tudo o que já existia
    for nome, spec in SIDRA_MUN.items():
        for uf in UFS:
            man.setdefault(f"{nome}_uf{uf}.json", url_mun(spec, uf))
    for nome, u in SIDRA_PNADC.items():
        man.setdefault(f"{nome}.json", u)
    json.dump(man, open(man_f, "w"), indent=1, ensure_ascii=False)


# ---------------------------------------------------------------- leitura
def ler_sidra(prefixo, ufs):
    """dict (mun, var, classificações...) -> float|None  (município N6) ou código de UF N3."""
    out = {}
    for uf in ufs:
        f = f"{SIDRA}/{prefixo}_uf{uf}.json" if uf else f"{SIDRA}/{prefixo}.json"
        d = json.load(open(f, encoding="utf8"))
        cab = d[0]
        for r in d[1:]:
            cls = tuple(r[k] for k in sorted(r) if k.startswith("D") and k.endswith("C") and k not in ("D1C", "D2C", "D3C"))
            v = r["V"]
            try:
                x = float(v)
            except ValueError:
                x = None  # "-", "..", "X", "..."
            out[(r["D1C"], r["D2C"], r["D3C"]) + cls] = (x, v)
    return out


def num(v):
    return None if v is None or (isinstance(v, float) and (math.isnan(v) or math.isinf(v))) else float(v)


NOTA_EN_PNADC = {
 "pnadc_desocup_ult": "Table 4099, quarter 2Q2026 (latest available; 3Q2026 not yet released). STATE-level context: the state value is repeated for all its municipalities. PNADC is a sample survey representative only for Brazil, regions and states; not a municipal measure (27 distinct values).",
 "pnadc_desocup_3t22": "Table 4099, 3Q2022. STATE-level context: the state value is repeated for all its municipalities. PNADC is a sample survey representative only for Brazil, regions and states; not a municipal measure (27 distinct values).",
 "pnadc_subutil_ult": "Table 4099, composite underutilization rate, 2Q2026. STATE-level context: the state value is repeated for all its municipalities. PNADC is a sample survey representative only for Brazil, regions and states; not a municipal measure (27 distinct values).",
 "pnadc_subutil_3t22": "Table 4099, composite underutilization rate, 3Q2022. STATE-level context: the state value is repeated for all its municipalities. PNADC is a sample survey representative only for Brazil, regions and states; not a municipal measure (27 distinct values).",
 "pnadc_informal_ult": "Table 8529, 2Q2026. STATE-level context: the state value is repeated for all its municipalities. PNADC is a sample survey representative only for Brazil, regions and states; not a municipal measure (27 distinct values).",
 "pnadc_informal_3t22": "Table 8529, 3Q2022. STATE-level context: the state value is repeated for all its municipalities. PNADC is a sample survey representative only for Brazil, regions and states; not a municipal measure (27 distinct values).",
 "pnadc_renda_pc_2025": "Table 7531, real monthly average at the year's average prices (2025), total. Latest year available. STATE-level context: the state value is repeated for all its municipalities. PNADC is a sample survey representative only for Brazil, regions and states; not a municipal measure (27 distinct values).",
 "pnadc_renda_pc_2022": "Table 7531, real monthly average at 2022 average prices (not directly comparable with the 2025 column without deflating). STATE-level context: the state value is repeated for all its municipalities. PNADC is a sample survey representative only for Brazil, regions and states; not a municipal measure (27 distinct values).",
 "pnadc_pct_superior_2025": "Table 10367, share of the population by education level (completed higher education), 2025. STATE-level context: the state value is repeated for all its municipalities. PNADC is a sample survey representative only for Brazil, regions and states; not a municipal measure (27 distinct values).",
 "pnadc_pct_baixa_instr_2025": "Table 10367: sum of 'no schooling or under 1 year' + 'incomplete primary', 2025. There is no 2022 value in this table (SIDRA returns '...'). STATE-level context: the state value is repeated for all its municipalities. PNADC is a sample survey representative only for Brazil, regions and states; not a municipal measure (27 distinct values)."
}

def main():
    sem_baixar = "--sem-baixar" in sys.argv
    if not sem_baixar:
        baixar()
    if "--so-baixar" in sys.argv:
        return

    # ---------- Censo agregados
    def csv(nome):
        z = zipfile.ZipFile(f"{CENSO}/{nome}")
        n = [x for x in z.namelist() if x.lower().endswith(".csv")][0]
        df = pd.read_csv(z.open(n), sep=";", encoding="latin1", dtype={"CD_MUN": str}, decimal=",", na_values=["X", "."])
        df.columns = [c.upper() for c in df.columns]
        return df.set_index("CD_MUN")

    bas = csv("Agregados_por_municipios_basico_BR_20260520.zip")
    dem = csv("Agregados_por_municipios_demografia_BR.zip")
    cor = csv("Agregados_por_municipios_cor_ou_raca_BR.zip")
    alf = csv("Agregados_por_municipios_alfabetizacao_BR.zip")
    d2 = csv("Agregados_por_municipios_caracteristicas_domicilio2_BR_20250417.zip")
    d1 = csv("Agregados_por_municipios_caracteristicas_domicilio1_BR_20261021.zip")
    obi = csv("Agregados_por_municipios_obitos_BR.zip")
    ren = csv("renda_responsavel_BR_20260508_csv.zip")
    cods = sorted(bas.index)
    assert len(cods) == 5570, len(cods)
    ix = pd.Index(cods)
    for d in (dem, cor, alf, d2, d1, obi, ren):
        assert set(d.index) == set(cods), "municípios diferentes entre arquivos"
    bas, dem, cor, alf, d2, d1, obi, ren = [d.reindex(ix) for d in (bas, dem, cor, alf, d2, d1, obi, ren)]

    def soma(df, a, b):
        return df[[f"V{i:05d}" for i in range(a, b + 1)]].sum(axis=1, min_count=1)

    def pct(a, b):
        r = 100 * a / b
        return r.where(b > 0)

    cols = {}
    pop = bas["V0001"]
    cols["censo_pop"] = pop
    cols["censo_dom"] = bas["V0002"]
    cols["censo_dom_ocup"] = bas["V0007"]
    cols["censo_mor_dom"] = bas["V0005"]
    cols["censo_area_km2"] = bas["AREA_KM2"]
    cols["censo_dens"] = pop / bas["AREA_KM2"]
    cols["censo_razao_sexo"] = 100 * dem["V01007"] / dem["V01008"]
    pdem = dem["V01006"]
    c014 = soma(dem, 1031, 1033); c1524 = soma(dem, 1034, 1035); c2539 = dem["V01036"] + dem["V01037"]
    c4059 = soma(dem, 1038, 1039); c60 = soma(dem, 1040, 1041); c1559 = soma(dem, 1034, 1039)
    cols["censo_pct_0a14"] = pct(c014, pdem)
    cols["censo_pct_15a24"] = pct(c1524, pdem)
    cols["censo_pct_25a39"] = pct(c2539, pdem)
    cols["censo_pct_40a59"] = pct(c4059, pdem)
    cols["censo_pct_60mais"] = pct(c60, pdem)
    cols["censo_pct_70mais"] = pct(dem["V01041"], pdem)
    cols["censo_razao_dep"] = 100 * (c014 + c60) / c1559
    ctot = soma(cor, 1317, 1321)
    cols["censo_pct_preta"] = pct(cor["V01318"], ctot)
    cols["censo_pct_parda"] = pct(cor["V01320"], ctot)
    cols["censo_pct_negra"] = pct(cor["V01318"] + cor["V01320"], ctot)
    cols["censo_pct_branca"] = pct(cor["V01317"], ctot)
    cols["censo_pct_amarela"] = pct(cor["V01319"], ctot)
    cols["censo_pct_indigena"] = pct(cor["V01321"], ctot)
    p15 = soma(dem, 1034, 1041)
    cols["censo_alfab_15"] = pct(soma(alf, 644, 656), p15)
    dppo = d1["V00001"]
    agua_t = soma(d2, 111, 118)
    cols["censo_pct_agua_rede"] = pct(d2["V00111"], agua_t)
    esg_t = soma(d2, 309, 316)
    cols["censo_pct_esgoto_rede"] = pct(d2["V00309"], esg_t)
    cols["censo_pct_esgoto_adeq"] = pct(d2["V00309"] + d2["V00310"], esg_t)
    lixo_t = soma(d2, 397, 402)
    cols["censo_pct_lixo_coletado"] = pct(d2["V00397"] + d2["V00398"], lixo_t)
    ban_t = soma(d2, 232, 238)
    cols["censo_pct_banheiro_excl"] = pct(soma(d2, 232, 235), ban_t)
    cols["censo_renda_resp_media"] = ren["V06004"]
    cols["censo_renda_resp_mediana"] = ren["V06006"]
    cols["censo_obitos_mil"] = 1000 * (obi["V01226"] + obi["V01227"]) / pop
    controle = {"dppo": dppo, "agua_t": agua_t, "esg_t": esg_t, "lixo_t": lixo_t, "ban_t": ban_t, "pdem": pdem, "ctot": ctot}

    # ---------- SIDRA municipais
    s9923 = ler_sidra("t9923", UFS)
    s10061 = ler_sidra("t10061", UFS)
    s9537 = ler_sidra("t9537", UFS)
    s10281 = ler_sidra("t10281", UFS)
    s9936 = ler_sidra("t9936", UFS)

    def g(dic, m, *chave):
        r = dic.get((m,) + chave)
        return None if r is None else r[0]

    urb, pi, ra = [], [], {}
    pu = []
    for m in cods:
        t = g(s9923, m, "93", "2022", "6795"); u = g(s9923, m, "93", "2022", "1")
        pu.append(100 * u / t if t and u is not None else None)
    cols["censo_pct_urbana"] = pd.Series(pu, index=ix)

    def serie(f):
        return pd.Series([f(m) for m in cods], index=ix, dtype="float64")

    # instrução 18+ (%), var 1002667, idade total, sexo total, cor total
    for k, cat in (("censo_pct_instr_baixa", "9493"), ("censo_pct_instr_fund", "9494"), ("censo_pct_instr_medio", "9495"), ("censo_pct_instr_superior", "99713")):
        cols[k] = serie(lambda m, cat=cat: g(s10061, m, "1002667", "2022", cat, "95253", "6794", "95251"))
    # religião: contagem / total 10+
    def rel(cat):
        def f(m):
            t = g(s9537, m, "140", "2022", "95278", "6794", "95253"); c = g(s9537, m, "140", "2022", cat, "6794", "95253")
            return 100 * c / t if t and c is not None else (0.0 if t and (m, "140", "2022", cat, "6794", "95253") in s9537 else None)
        return f
    for k, cat in (("censo_pct_catolica", "95263"), ("censo_pct_evangelica", "95277"), ("censo_pct_sem_religiao", "2836"),
                   ("censo_pct_espirita", "2826"), ("censo_pct_umbanda_candomble", "2827")):
        cols[k] = serie(rel(cat))
    sufx = ("2022", "6794", "95251", "120704", "15349")
    cols["censo_rend_trab_medio"] = serie(lambda m: g(s10281, m, "13536", *sufx))
    cols["censo_rend_trab_mediano"] = serie(lambda m: g(s10281, m, "13537", *sufx))
    cols["censo_ocup_rend"] = serie(lambda m: g(s10281, m, "13535", *sufx))

    def net(m):
        t = g(s9936, m, "381", "2022", "77584", "95826", "2932"); s = g(s9936, m, "381", "2022", "77585", "95826", "2932")
        return 100 * s / t if t and s is not None else None
    cols["censo_pct_internet"] = serie(net)

    # ---------- PIB
    wb = openpyxl.load_workbook(io.BytesIO(zipfile.ZipFile(PIBZIP).read("PIB dos Municípios - base de dados 2010-2023.xlsx")), read_only=True)
    ws = wb["PIB dos Municípios"]
    pib = {}
    for i, r in enumerate(ws.iter_rows(values_only=True)):
        if i == 0 or r[0] is None or r[0] < 2021:
            continue
        pib[(str(r[6]), int(r[0]))] = r
    anos = sorted({a for _, a in pib})
    print("PIB anos lidos:", anos)

    def pibv(m, ano, j):
        r = pib.get((m, ano))
        if r is None or r[j] in (None, ""):
            return None
        try:
            return float(r[j])
        except ValueError:
            return None
    for ano in (2022, 2023):
        cols[f"pib_{ano}"] = serie(lambda m, a=ano: pibv(m, a, 38))
        cols[f"pib_pc_{ano}"] = cols[f"pib_{ano}"] * 1000 / pop
    # VAB setorial: IBGE só divulgou PIB e PIB per capita para 2022-2023 (nota técnica 02/2024); último ano com setores = 2021
    def share(m, ano, j):
        v = pibv(m, ano, j); t = pibv(m, ano, 36)
        comp = [pibv(m, ano, jj) for jj in (32, 33, 34, 35)]
        if any(x is not None and x < 0 for x in comp):  # IBGE publica VAB setorial negativo em casos raros (ex. 5204250 em 2021)
            return None
        return 100 * v / t if v is not None and t else None
    ano_setor = {a: sum(1 for m in cods if pibv(m, a, 36) is not None) for a in (2021, 2022, 2023)}
    print("VAB total preenchido por ano:", ano_setor)
    for a in (2023, 2022):
        if ano_setor[a] > 1000:
            ano_s = a; break
    else:
        ano_s = 2021
    for k, j in (("pib_pct_agro", 32), ("pib_pct_industria", 33), ("pib_pct_servicos", 34), ("pib_pct_adm_publica", 35)):
        cols[f"{k}_{ano_s}"] = serie(lambda m, j=j: share(m, ano_s, j))

    # ---------- população estimada 2026
    loc = json.load(open(LOC, encoding="utf8"))
    validos = {str(x["municipio-id"]) for x in loc}
    ws = openpyxl.load_workbook(POPXLS, read_only=True)["municípios"]
    pe = {}
    for r in ws.iter_rows(min_row=3, values_only=True):
        if r[1] is None or r[2] is None or r[4] is None:
            continue
        try:
            c7 = f"{int(r[1]):02d}{str(r[2]).strip().zfill(5)}"  # COD. UF + COD. MUNIC (5 dígitos, já com DV) = 7 dígitos
            v = r[4]
            if isinstance(v, str):  # ex.: "12.345(1)" → nota de rodapé
                import re
                v = int(re.sub(r"\(.*?\)|\D", "", v))
            assert c7 in validos, c7
            pe[c7] = float(v)
        except (AssertionError, ValueError):
            print("pop26: linha ignorada", r[:5])
    cols["pop_est_2026"] = serie(lambda m: pe.get(m))
    cols["pop_var_2022_2026"] = 100 * (cols["pop_est_2026"] / pop - 1)

    # ---------- PNADC por UF
    p4099 = ler_sidra("pnadc_4099", [None]); p8529 = ler_sidra("pnadc_8529", [None])
    p7531 = ler_sidra("pnadc_7531", [None]); p10367 = ler_sidra("pnadc_10367", [None])

    def uf_serie(dic, var, per, *cls, soma_cls=None):
        def f(m):
            uf = m[:2]
            if soma_cls:
                vs = [g(dic, uf, var, per, *c) for c in soma_cls]
                return None if any(v is None for v in vs) else sum(vs)
            return g(dic, uf, var, per, *cls)
        return serie(f)
    cols["pnadc_desocup_ult"] = uf_serie(p4099, "4099", "202602")
    cols["pnadc_desocup_3t22"] = uf_serie(p4099, "4099", "202203")
    cols["pnadc_subutil_ult"] = uf_serie(p4099, "4118", "202602")
    cols["pnadc_subutil_3t22"] = uf_serie(p4099, "4118", "202203")
    cols["pnadc_informal_ult"] = uf_serie(p8529, "12466", "202602")
    cols["pnadc_informal_3t22"] = uf_serie(p8529, "12466", "202203")
    cols["pnadc_renda_pc_2025"] = uf_serie(p7531, "10824", "2025", "49243")
    cols["pnadc_renda_pc_2022"] = uf_serie(p7531, "10824", "2022", "49243")
    # 10367 não tem 2022 (SIDRA devolve "..."), então só 2025
    for per, sfx in (("2025", "2025"),):
        cols[f"pnadc_pct_superior_{sfx}"] = uf_serie(p10367, "608", per, "11632")
        cols[f"pnadc_pct_baixa_instr_{sfx}"] = uf_serie(p10367, "608", per, soma_cls=[("120706",), ("11779",)])

    # ---------- metadados
    F, FE = "IBGE Censo 2022", "IBGE 2022 Census"
    SIDRA_NOTA = " Fonte: SIDRA/IBGE, tabela {t}."
    V = []

    def add(k, pt, en, gpt, gen, fonte, un, dec, ano, npt, nen, papel="contexto"):
        V.append({"k": k, "pt": pt, "en": en, "grupo_pt": gpt, "grupo_en": gen, "fonte": fonte, "unidade": un, "dec": dec,
                  "ano": ano, "tipo": "num", "papel": papel, "nota_pt": npt, "nota_en": nen})

    D = ("Demografia", "Demographics"); ID = ("Estrutura etária", "Age structure"); CR = ("Cor ou raça", "Race/color")
    ED = ("Educação", "Education"); SAN = ("Saneamento e domicílio", "Sanitation and housing"); RE = ("Renda e trabalho", "Income and labor")
    RL = ("Religião", "Religion"); EC = ("Economia (PIB)", "Economy (GDP)"); TIC = ("Internet", "Internet")
    PN = ("Contexto estadual (PNADC)", "State context (PNADC)")
    add("censo_pop", "População (Censo 2022)", "Population (2022 Census)", *D, F, "pessoas", 0, 2022,
        "População residente em 1/ago/2022 (agregados por município, variável V0001). Soma nacional: ver RELATORIO_IBGE.md.", "Resident population on 1 Aug 2022.", "peso")
    add("censo_dom", "Domicílios (Censo 2022)", "Dwellings (2022 Census)", *D, F, "domicílios", 0, 2022,
        "Total de domicílios (particulares + coletivos), V0002.", "All dwellings (private + collective).")
    add("censo_dom_ocup", "Domicílios particulares ocupados", "Occupied private dwellings", *D, F, "domicílios", 0, 2022,
        "V0007 (DPPO + DPIO).", "Occupied private dwellings.")
    add("censo_mor_dom", "Média de moradores por domicílio", "Average residents per dwelling", *D, F, "pessoas/domicílio", 2, 2022,
        "V0005: moradores em domicílios particulares ocupados / domicílios particulares ocupados.", "Residents per occupied private dwelling.")
    add("censo_area_km2", "Área do município", "Municipal area", *D, F, "km²", 1, 2022,
        "AREA_KM2 do arquivo básico dos agregados (malha municipal 2022).", "Area from the 2022 municipal grid.")
    add("censo_dens", "Densidade demográfica", "Population density", *D, F, "hab/km²", 1, 2022,
        "População do Censo 2022 / área em km².", "Census population / area.")
    add("censo_pct_urbana", "População urbana", "Urban population", *D, F + " (SIDRA 9923)", "%", 1, 2022,
        "Situação do domicílio urbana / total (tabela 9923). Critério de situação do IBGE, não equivale ao perímetro legal." + SIDRA_NOTA.format(t=9923),
        "Share living in urban areas (IBGE classification).")
    add("censo_razao_sexo", "Razão de sexo", "Sex ratio", *D, F, "homens por 100 mulheres", 1, 2022,
        "Homens / mulheres x 100 (V01007/V01008).", "Men per 100 women.")
    for k, pt, en, nota in (
        ("censo_pct_0a14", "% 0 a 14 anos", "% aged 0-14", "Soma V01031 a V01033 / moradores."),
        ("censo_pct_15a24", "% 15 a 24 anos", "% aged 15-24", "Soma V01034 e V01035 / moradores."),
        ("censo_pct_25a39", "% 25 a 39 anos", "% aged 25-39", "V01036 (25-29) + V01037 (30-39) / moradores."),
        ("censo_pct_40a59", "% 40 a 59 anos", "% aged 40-59", "V01038 + V01039 / moradores."),
        ("censo_pct_60mais", "% 60 anos ou mais", "% aged 60+", "V01040 + V01041 / moradores. Idosos: voto facultativo a partir dos 70."),
        ("censo_pct_70mais", "% 70 anos ou mais", "% aged 70+", "V01041 / moradores. Voto facultativo a partir dos 70 anos.")):
        add(k, pt, en, *ID, F, "%", 1, 2022, nota, "Share of residents (age groups from Census aggregates).")
    add("censo_razao_dep", "Razão de dependência", "Dependency ratio", *ID, F, "por 100 em idade ativa", 1, 2022,
        "(0-14 + 60+) / (15-59) x 100. Faixa ativa aproximada 15-59 porque os agregados só trazem 60-69 e 70+ (a razão oficial usa 15-64).",
        "(0-14 + 60+) / (15-59) x 100; approximate working-age band 15-59 (official uses 15-64).")
    for k, pt, en, c in (("censo_pct_preta", "% preta", "% Black (preta)", "V01318"), ("censo_pct_parda", "% parda", "% Brown (parda)", "V01320"),
                         ("censo_pct_negra", "% preta + parda", "% Black + Brown", "V01318+V01320"), ("censo_pct_branca", "% branca", "% White", "V01317"),
                         ("censo_pct_amarela", "% amarela", "% Asian (amarela)", "V01319"), ("censo_pct_indigena", "% indígena", "% Indigenous", "V01321")):
        add(k, pt, en, *CR, F, "%", 1, 2022, f"{c} / soma das 5 categorias (autodeclaração).", "Self-declared; share of the five categories.")
    add("censo_alfab_15", "Alfabetização 15+", "Literacy 15+", *ED, F, "%", 1, 2022,
        "Pessoas de 15+ alfabetizadas (V00644 a V00656) / moradores de 15+ (V01034 a V01041).", "Literate persons aged 15+ / residents aged 15+.")
    for k, pt, en, c in (("censo_pct_instr_baixa", "Instrução 18+: sem instrução ou fundamental incompleto", "Education 18+: none or incomplete primary", "9493"),
                         ("censo_pct_instr_fund", "Instrução 18+: fundamental completo / médio incompleto", "Education 18+: complete primary / incomplete secondary", "9494"),
                         ("censo_pct_instr_medio", "Instrução 18+: médio completo / superior incompleto", "Education 18+: complete secondary / incomplete tertiary", "9495"),
                         ("censo_pct_instr_superior", "Instrução 18+: superior completo", "Education 18+: tertiary completed", "99713")):
        add(k, pt, en, *ED, F + " (SIDRA 10061)", "%", 1, 2022, "Percentual do total de pessoas de 18+ (categoria " + c + ")." + SIDRA_NOTA.format(t=10061),
            "Share of persons aged 18+ by education level.")
    add("censo_pct_agua_rede", "Domicílios com água por rede geral", "Dwellings with piped water (network)", *SAN, F, "%", 1, 2022,
        "V00111 (rede geral de distribuição) / soma V00111 a V00118 (domicílios particulares permanentes ocupados).", "Network water supply share.")
    add("censo_pct_esgoto_rede", "Domicílios com esgoto por rede geral/pluvial", "Dwellings with sewer network", *SAN, F, "%", 1, 2022,
        "V00309 (rede geral ou pluvial) / soma V00309 a V00316.", "Share connected to the general sewer/storm network.")
    add("censo_pct_esgoto_adeq", "Domicílios com esgoto adequado (rede + fossa ligada à rede)", "Dwellings with adequate sewage", *SAN, F, "%", 1, 2022,
        "(V00309 + V00310) / soma V00309 a V00316. Definição própria: não é o indicador oficial de saneamento adequado.", "Network plus septic tank connected to the network.")
    add("censo_pct_lixo_coletado", "Domicílios com lixo coletado", "Dwellings with waste collection", *SAN, F, "%", 1, 2022,
        "(V00397 coletado + V00398 caçamba de serviço de limpeza) / soma V00397 a V00402.", "Collected by service or placed in a service skip.")
    add("censo_pct_banheiro_excl", "Domicílios com banheiro de uso exclusivo", "Dwellings with exclusive bathroom", *SAN, F, "%", 1, 2022,
        "Soma V00232 a V00235 (1 a 4+ banheiros exclusivos com chuveiro e vaso) / soma V00232 a V00238.", "Exclusive bathroom with shower and toilet.")
    add("censo_renda_resp_media", "Rendimento médio do responsável pelo domicílio", "Mean income of household head", *RE, F, "R$ nominais/mês", 2, 2022,
        "V06004: rendimento nominal médio mensal das pessoas responsáveis por domicílio (com rendimento). Valores nominais de 2022, sem correção.", "Nominal 2022 reais per month.")
    add("censo_renda_resp_mediana", "Rendimento mediano do responsável pelo domicílio", "Median income of household head", *RE, F, "R$ nominais/mês", 0, 2022,
        "V06006: mediana nominal mensal (com rendimento). Valores nominais de 2022.", "Nominal 2022 reais per month.")
    add("censo_rend_trab_medio", "Rendimento médio do trabalho (ocupados 14+)", "Mean labor income (employed 14+)", *RE, F + " (SIDRA 10281)", "R$ nominais/mês", 2, 2022,
        "Rendimento nominal mensal médio de todos os trabalhos dos ocupados de 14+ com rendimento de trabalho." + SIDRA_NOTA.format(t=10281), "Nominal 2022 reais/month.")
    add("censo_rend_trab_mediano", "Rendimento mediano do trabalho (ocupados 14+)", "Median labor income (employed 14+)", *RE, F + " (SIDRA 10281)", "R$ nominais/mês", 0, 2022,
        "Mediana do rendimento nominal mensal de todos os trabalhos." + SIDRA_NOTA.format(t=10281), "Nominal 2022 reais/month.")
    add("censo_ocup_rend", "Ocupados 14+ com rendimento de trabalho", "Employed 14+ with labor income", *RE, F + " (SIDRA 10281)", "pessoas", 0, 2022,
        "Denominador dos rendimentos do trabalho." + SIDRA_NOTA.format(t=10281), "Employed persons with labor income.")
    add("censo_obitos_mil", "Óbitos informados no domicílio por mil hab.", "Household-reported deaths per 1,000", *D, F, "por mil hab.", 1, 2022,
        "ATENÇÃO: o Censo perguntou sobre pessoas falecidas de jan/2019 a jul/2022 (3,6 anos), moradoras do domicílio; não é taxa anual e há sub-registro. (V01226+V01227) / população x 1000. Use só como indicador relativo.",
        "Deaths of household members Jan 2019-Jul 2022 as reported in the Census (3.6 years, under-reporting); relative indicator only.")
    for k, pt, en, c in (("censo_pct_catolica", "% católica", "% Catholic", "95263"), ("censo_pct_evangelica", "% evangélica", "% Evangelical", "95277"),
                         ("censo_pct_sem_religiao", "% sem religião", "% no religion", "2836"), ("censo_pct_espirita", "% espírita", "% Spiritist", "2826"),
                         ("censo_pct_umbanda_candomble", "% umbanda e candomblé", "% Umbanda and Candomblé", "2827")):
        add(k, pt, en, *RL, F + " (SIDRA 9537)", "%", 1, 2022,
            "Pessoas de 10+ na religião (cat. " + c + ") / total de pessoas de 10+ (inclui sem declaração e não sabe). Contagens podem ter perturbação estatística em municípios pequenos." + SIDRA_NOTA.format(t=9537),
            "Share of persons aged 10+ (denominator includes undeclared).")
    add("censo_pct_internet", "Domicílios com internet", "Dwellings with internet", *TIC, F + " (SIDRA 9936)", "%", 1, 2022,
        "Domicílios particulares permanentes ocupados com conexão domiciliar à internet / total." + SIDRA_NOTA.format(t=9936), "Share with home internet connection.")
    add("pib_2022", "PIB a preços correntes 2022", "GDP at current prices 2022", *EC, "IBGE PIB dos Municípios", "R$ mil", 0, 2022,
        "Nominal, R$ 1.000 correntes. Dado sujeito a revisão (IBGE).", "Nominal, thousand R$; subject to revision.")
    add("pib_2023", "PIB a preços correntes 2023", "GDP at current prices 2023", *EC, "IBGE PIB dos Municípios", "R$ mil", 0, 2023,
        "Nominal, R$ 1.000 correntes. Dado sujeito a revisão (IBGE).", "Nominal, thousand R$; subject to revision.")
    for a in (2022, 2023):
        add(f"pib_pc_{a}", f"PIB per capita {a}", f"GDP per capita {a}", *EC, "IBGE PIB dos Municípios + Censo 2022", "R$ nominais/hab.", 0, a,
            f"PIB {a} (R$ correntes) / população do Censo 2022. Difere do per capita publicado pelo IBGE (que usa estimativa do ano). Valor nominal. Municípios com PIB muito concentrado (refinarias, usinas, capitais) têm per capita atípico.",
            f"GDP {a} (nominal) / 2022 Census population; differs from the IBGE-published per capita.")
    for k, pt, en in (("pib_pct_agro", "% agropecuária no valor adicionado", "% agriculture in value added"), ("pib_pct_industria", "% indústria no valor adicionado", "% industry in value added"),
                      ("pib_pct_servicos", "% serviços (excl. adm. pública) no valor adicionado", "% services (excl. public admin.) in value added"),
                      ("pib_pct_adm_publica", "% administração pública no valor adicionado", "% public administration in value added")):
        add(f"{k}_{ano_s}", f"{pt} ({ano_s})", f"{en} ({ano_s})", *EC, "IBGE PIB dos Municípios", "%", 1, ano_s,
            f"Participação no valor adicionado bruto total, ano {ano_s} (nulo onde algum componente setorial publicado é negativo). LIMITAÇÃO: para 2022 e 2023 o IBGE divulgou apenas PIB e PIB per capita (nota técnica 02/2024), sem valor adicionado setorial; por isso o ano é o último com setores ({ano_s}).",
            f"Share of gross value added, {ano_s}. LIMITATION: IBGE released only GDP and GDP per capita for 2022-2023; {ano_s} is the latest year with sector detail.")
    add("pop_est_2026", "População estimada 2026", "Estimated population 2026", *D, "IBGE Estimativas de População (DOU 2026)", "pessoas", 0, 2026,
        "Estimativa para 1/jul/2026 publicada no DOU. Não é contagem.", "Estimate for 1 Jul 2026 (DOU).", "peso")
    add("pop_var_2022_2026", "Variação da população 2022-2026", "Population change 2022-2026", *D, "IBGE", "%", 1, 2026,
        "Estimativa 2026 / Censo 2022 - 1. Pode refletir diferenças metodológicas, não só crescimento.", "2026 estimate vs 2022 Census.")
    PNOTA_PT = "Contexto ESTADUAL: o valor da UF é replicado para todos os municípios dela. A PNADC é amostral e representativa apenas para Brasil, regiões e UFs; não mede o município. Só use como variável de contexto de nível 2 (27 valores distintos), sem tratar como dado local."
    PNOTA_EN = "STATE-level context: the state value is repeated for all its municipalities. PNADC is a sample survey representative only for Brazil, regions and states; not a municipal measure (27 distinct values)."
    for k, pt, en, un, dec, ano, extra in (
        ("pnadc_desocup_ult", "PNADC: taxa de desocupação da UF (2º tri 2026)", "PNADC: state unemployment rate (2026 Q2)", "%", 1, 2026, "Tabela 4099, trimestre 2T2026 (último disponível; o 3T2026 ainda não saiu)."),
        ("pnadc_desocup_3t22", "PNADC: taxa de desocupação da UF (3º tri 2022)", "PNADC: state unemployment rate (2022 Q3)", "%", 1, 2022, "Tabela 4099, 3T2022."),
        ("pnadc_subutil_ult", "PNADC: subutilização da força de trabalho na UF (2º tri 2026)", "PNADC: state labor underutilization (2026 Q2)", "%", 1, 2026, "Tabela 4099, taxa composta de subutilização, 2T2026."),
        ("pnadc_subutil_3t22", "PNADC: subutilização da força de trabalho na UF (3º tri 2022)", "PNADC: state labor underutilization (2022 Q3)", "%", 1, 2022, "Tabela 4099, taxa composta de subutilização, 3T2022."),
        ("pnadc_informal_ult", "PNADC: taxa de informalidade na UF (2º tri 2026)", "PNADC: state informality rate (2026 Q2)", "%", 1, 2026, "Tabela 8529, 2T2026."),
        ("pnadc_informal_3t22", "PNADC: taxa de informalidade na UF (3º tri 2022)", "PNADC: state informality rate (2022 Q3)", "%", 1, 2022, "Tabela 8529, 3T2022."),
        ("pnadc_renda_pc_2025", "PNADC: rendimento domiciliar per capita da UF (2025)", "PNADC: state household income per capita (2025)", "R$ reais de 2025/mês", 0, 2025, "Tabela 7531, média mensal real, a preços médios do ano (2025), total. Último ano disponível."),
        ("pnadc_renda_pc_2022", "PNADC: rendimento domiciliar per capita da UF (2022)", "PNADC: state household income per capita (2022)", "R$ reais de 2022/mês", 0, 2022, "Tabela 7531, média mensal real a preços médios de 2022 (não comparável diretamente com a coluna 2025 sem deflacionar)."),
        ("pnadc_pct_superior_2025", "PNADC: % com superior completo na UF (2025)", "PNADC: state % with tertiary degree (2025)", "%", 1, 2025, "Tabela 10367, percentual da população por nível de instrução (superior completo), 2025."),
        ("pnadc_pct_baixa_instr_2025", "PNADC: % sem instrução ou fundamental incompleto na UF (2025)", "PNADC: state % no schooling or incomplete primary (2025)", "%", 1, 2025, "Tabela 10367: soma 'sem instrução e menos de 1 ano' + 'fundamental incompleto', 2025. Não há 2022 nesta tabela (SIDRA retorna '...').")):
        add(k, pt, en, *PN, "IBGE PNADC (SIDRA, nível UF)", un, dec, ano, extra + " " + PNOTA_PT, extra + " " + PNOTA_EN)

    # ---------- saída
    ks = [v["k"] for v in V]
    faltam = [k for k in ks if k not in cols]; sobram = [k for k in cols if k not in ks]
    assert not faltam and not sobram, (faltam, sobram)
    # município criado depois do Censo 2022 (ex.: Boa Esperança do Norte-MT, 5101837): sem Censo/PIB; recebe só população 2026 e PNADC da UF
    extras = sorted(c for c in pe if c not in set(cods))
    print("municípios fora do Censo 2022 com estimativa 2026:", extras)
    ix_full = pd.Index(cods + extras)
    saida_cols = {}
    for v in V:
        s = cols[v["k"]].reindex(ix_full)
        if v["k"] == "pop_est_2026":
            for c in extras:
                s[c] = pe[c]
        if v["k"].startswith("pnadc_"):
            for c in extras:
                s[c] = cols[v["k"]][[m for m in cods if m[:2] == c[:2]][0]]
        arr = []
        for x in s.tolist():
            x = num(x)
            if x is None:
                arr.append(None)
            else:
                arr.append(int(round(x)) if v["dec"] == 0 else round(x, v["dec"] + 2))
        saida_cols[v["k"]] = arr
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    for _v in V:
        if _v["k"] in NOTA_EN_PNADC: _v["nota_en"] = NOTA_EN_PNADC[_v["k"]]
    json.dump({"fonte": "ibge", "ibge": cods + extras, "vars": V, "cols": saida_cols}, open(OUT, "w", encoding="utf8"), ensure_ascii=False, separators=(",", ":"))
    print(f"ok: {len(cods)} + {len(extras)} extra municípios, {len(V)} variáveis -> {OUT}")
    # diagnóstico
    print("soma pop censo:", int(pop.sum()), "| soma pop 2026 (municípios):", int(sum(pe.values())), "| mun. com pop26:", len(pe))
    for k, s in controle.items():
        print("controle", k, "nulos", int(s.isna().sum()))
    pd.Series({k: int(sum(1 for x in a if x is None)) for k, a in saida_cols.items()}).to_csv(sys.stdout, header=False)


if __name__ == "__main__":
    main()
