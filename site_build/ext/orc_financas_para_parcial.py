"""Gera dados_externos/parciais/orc_financas.json (contrato: dados_externos/CONTRATO_DADOS.md).

Finanças municipais por ano (2022+), a partir de:
  - DCA/SICONFI coletada por ext/coletar_dca.py: /mnt/e/EleicoesBrasil_externos/orcamento/siconfi/dca_<ano>.jsonl.gz
    (+ _feito_<ano>.txt = municípios já coletados naquele ano). Anexos I-C (receita), I-D (despesa por categoria).
  - CAPAG (Tesouro): /mnt/e/EleicoesBrasil_externos/orcamento/municipios_financas/capag/*.xlsx

A coleta pode estar em andamento: o script usa só municípios listados em _feito_<ano>.txt, tolera gzip truncado e
imprime/gera (em dados_externos/orc_financas_cobertura.json) quantos municípios existem por ano.
Rode de novo quando a coleta terminar (anos novos viram variáveis automaticamente; ano sem nenhum município é omitido).

Uso: uv run --with pandas --with openpyxl python orc_financas_para_parcial.py
"""
import gzip, json, os, re, zlib

SIC = "/mnt/e/EleicoesBrasil_externos/orcamento/siconfi"
CAPAG = "/mnt/e/EleicoesBrasil_externos/orcamento/municipios_financas/capag"
LOC = "/mnt/e/EleicoesBrasil_externos/ibge/localidades/municipios_nivelado.json"
PARC = "/mnt/d/01_claudeCode/10_EleicoesBrasil/dados_externos/parciais"
OUT = f"{PARC}/orc_financas.json"
ANOS = [2022, 2023, 2024, 2025]

GP, GE = "Orçamento e gasto público — Finanças municipais (DCA/SICONFI)", "Public budget and spending — Municipal finances (DCA/SICONFI)"
GPC, GEC = "Orçamento e gasto público — Capacidade de pagamento (CAPAG)", "Public budget and spending — Payment capacity (CAPAG)"

BRUTA, DFUN, ODED = "Receitas Brutas Realizadas", "Deduções - FUNDEB", "Outras Deduções da Receita"
EMP, PAG, RPNP, RPP = "Despesas Empenhadas", "Despesas Pagas", "Inscrição de Restos a Pagar Não Processados", "Inscrição de Restos a Pagar Processados"


def L2(g, e):  # RO<g>.<e>.0.0.00.0.0
    return f"RO{g}.{e}.0.0.00.0.0"


def L3(g, e, s):  # RO<g>.<e>.<s>.0.00.0.0
    return f"RO{g}.{e}.{s}.0.00.0.0"


C_PROPRIO = [L2(1, 1), L2(1, 2), L2(1, 3), L2(1, 6), L2(1, 9), L2(2, 2), L2(2, 3), L2(2, 9)]
C_FED = [L3(1, 7, 1), L3(2, 4, 1)]
C_EST = [L3(1, 7, 2), L3(2, 4, 2)]
C_FUNDEB = ["RO1.7.5.1.00.0.0"]
C_CRED = [L2(2, 1)]
C_RCORR, C_TOT = "RO1.0.0.0.00.0.0", "ReceitasExcetoIntraOrcamentarias"
C_ICMS, C_IPVA, C_FPM = "RO1.7.2.1.50.0.0", "RO1.7.2.1.51.0.0", "RO1.7.1.1.51.0.0"
C_TRIB = L2(1, 1)
D_TOT, D_INV, D_PES = "TotalDespesas", "DO4.4.00.00.00.00", "DO3.1.00.00.00.00"

CSET_C = set(C_PROPRIO + C_FED + C_EST + C_FUNDEB + C_CRED + [C_RCORR, C_TOT, C_ICMS, C_IPVA, C_FPM])
CSET_D = {D_TOT, D_INV, D_PES}


def ler_ano(ano):
    """-> (feito:set[str], dados: dict[id] -> dict[(anexo,col,conta)] = valor, truncado:bool)"""
    fp = f"{SIC}/_feito_{ano}.txt"
    gz = f"{SIC}/dca_{ano}.jsonl.gz"
    if not (os.path.exists(fp) and os.path.exists(gz)):
        return set(), {}, False
    feito = {l.split("\t")[0] for l in open(fp) if l.strip()}
    dados, trunc = {}, False
    try:
        with gzip.open(gz, "rt", encoding="utf-8") as f:
            for l in f:
                try:
                    r = json.loads(l)
                except ValueError:
                    trunc = True; break
                i = str(r["id"])
                if i not in feito: continue
                a, c = r["anexo"], r["conta"]
                if (a == "C" and c in CSET_C) or (a == "D" and c in CSET_D):
                    d = dados.setdefault(i, {})
                    d.setdefault((a, r["col"], c), r["v"])
    except (EOFError, zlib.error, OSError):
        trunc = True
    return feito, dados, trunc


EXCLUIDOS = []


def calc(d, pop):
    """Indicadores de um município-ano; None se a DCA não trouxe receita corrente."""
    g = lambda col, c: d.get(("C", col, c)) or 0.0
    net = lambda c: g(BRUTA, c) - g(DFUN, c) - g(ODED, c)
    if ("C", BRUTA, C_RCORR) not in d: return None
    rcl = net(C_RCORR)                                 # receita corrente líquida de deduções (FUNDEB e outras)
    if pop and rcl / pop > 150000:                     # erro de declaração evidente (ex.: 3305109 em 2023 = R$ 365 bi): descarta o município-ano
        EXCLUIDOS.append(None); return None
    tot = net(C_TOT)
    prop = sum(net(c) for c in C_PROPRIO); fed = sum(net(c) for c in C_FED); est = sum(net(c) for c in C_EST)
    fun = sum(g(BRUTA, c) for c in C_FUNDEB); cre = sum(net(c) for c in C_CRED)
    dep = ("D", EMP, D_TOT) in d
    de = d.get(("D", EMP, D_TOT)) if dep else None
    inv_e, inv_p = d.get(("D", EMP, D_INV)), d.get(("D", PAG, D_INV))
    rp = None
    if dep: rp = (d.get(("D", RPNP, D_TOT)) or 0) + (d.get(("D", RPP, D_TOT)) or 0)
    pct = lambda x: round(100 * x / rcl, 3) if rcl > 0 else None
    pc = lambda x: round(x / pop, 2) if (pop and x is not None) else None
    o = {"rcl": rcl, "rcl_pc": pc(rcl), "trib_pc": pc(net(C_TRIB)),
         "prop_pct": pct(prop), "fed_pct": pct(fed), "est_pct": pct(est), "fundeb_pct": pct(fun), "cred_pct": pct(cre),
         "dep_pct": pct(fed + est + fun),
         "prop_pc": pc(prop), "fed_pc": pc(fed), "est_pc": pc(est), "fundeb_pc": pc(fun), "cred_pc": pc(cre),
         "icms_pc": pc(g(BRUTA, C_ICMS)), "ipva_pc": pc(g(BRUTA, C_IPVA)), "fpm_pc": pc(g(BRUTA, C_FPM)),
         "icms": g(BRUTA, C_ICMS), "ipva": g(BRUTA, C_IPVA),
         "desp_pc": pc(de), "inv_emp_pc": pc(inv_e), "inv_pago_pc": pc(inv_p),
         "inv_pct_desp": round(100 * inv_e / de, 3) if (de and inv_e is not None and de > 0) else None,
         "pes_pct_desp": round(100 * d[("D", EMP, D_PES)] / de, 3) if (de and de > 0 and ("D", EMP, D_PES) in d) else None,
         "rp_pc": pc(rp), "rp_pct_desp": round(100 * rp / de, 3) if (de and rp is not None and de > 0) else None}
    return o


# (sufixo, pt, en, unidade, dec, nota_pt, nota_en)
NOTA_REC = ("Receita corrente líquida = receitas correntes brutas realizadas (RO1.0) menos deduções FUNDEB e outras deduções; "
            "numeradores também líquidos das deduções na própria linha. Valores nominais do ano.",
            "Net current revenue = gross realized current revenue (RO1.0) minus FUNDEB and other deductions; numerators are also net of deductions on their own line. Nominal values for the year.")
ESPEC = [
    ("rcl", "Receita corrente líquida", "Net current revenue", "R$", 0, "Receitas correntes brutas menos deduções (FUNDEB e outras). DCA I-C. Nominal.", "Gross current revenue minus deductions (FUNDEB and other). DCA I-C. Nominal."),
    ("rcl_pc", "Receita corrente líquida per capita", "Net current revenue per capita", "R$/hab.", 0, "Dividida pela população do Censo 2022 (mesma população em todos os anos). Nominal.", "Divided by 2022 Census population (same denominator in every year). Nominal."),
    ("trib_pc", "Receita tributária própria per capita (impostos, taxas, contrib. melhoria)", "Own tax revenue per capita (taxes, fees, betterment levies)", "R$/hab.", 0, "RO1.1: IPTU, ISS, ITBI, IRRF, taxas. Líquida de restituições/deduções.", "RO1.1: property, service and transfer taxes, income tax withheld, fees. Net of refunds/deductions."),
    ("prop_pct", "Receita própria (% da receita corrente líquida)", "Own revenue (% of net current revenue)", "%", 1, "Própria = RO1.1 + 1.2 (inclui COSIP e contribuições previdenciárias do RPPS) + 1.3 + 1.6 + 1.9 + capital RO2.2/2.3/2.9 (alienações, amortizações, outras). Numerador inclui receitas de capital, denominador só correntes: pode passar de 100 em casos extremos.", "Own = RO1.1+1.2 (includes street-lighting levy and pension-scheme contributions)+1.3+1.6+1.9 + capital RO2.2/2.3/2.9. Numerator includes capital items, denominator only current revenue."),
    ("fed_pct", "Transferências da União (% da receita corrente líquida)", "Federal transfers (% of net current revenue)", "%", 1, "RO1.7.1 (FPM, ITR, SUS, FNDE, FNAS, convênios) + RO2.4.1 (capital: convênios, Transferência Especial). Inclui transferências constitucionais (FPM) e voluntárias/emendas, sem separar. Líquida da dedução FUNDEB (20% do FPM/ITR retidos).", "RO1.7.1 (FPM, ITR, health, FNDE, social assistance, agreements) + RO2.4.1 (capital). Mixes constitutional (FPM) and voluntary/earmarked transfers. Net of FUNDEB deduction."),
    ("est_pct", "Transferências do estado (% da receita corrente líquida)", "State transfers (% of net current revenue)", "%", 1, "RO1.7.2 (cota-parte ICMS, IPVA, IPI-exportação, convênios, SUS estadual) + RO2.4.2. Líquida da dedução FUNDEB.", "RO1.7.2 (ICMS, IPVA, IPI shares, agreements, state health) + RO2.4.2. Net of FUNDEB deduction."),
    ("fundeb_pct", "Receita do FUNDEB (% da receita corrente líquida)", "FUNDEB inflow (% of net current revenue)", "%", 1, "RO1.7.5.1, valor recebido do fundo (fundo multigovernamental: inclui complementação da União). Não é federal nem estadual puro. Parte das receitas federais/estaduais já foi retida para formar o fundo (dedução).", "RO1.7.5.1, amount received from the multi-government fund (includes federal top-up). Neither purely federal nor state."),
    ("cred_pct", "Operações de crédito (% da receita corrente líquida)", "Credit operations (% of net current revenue)", "%", 2, "RO2.1 (empréstimos/financiamentos). Receita de capital sobre receita corrente.", "RO2.1 (loans). Capital revenue over current revenue."),
    ("dep_pct", "Dependência de transferências: União + estado + FUNDEB (% da receita corrente líquida)", "Transfer dependence: federal + state + FUNDEB (% of net current revenue)", "%", 1, "Soma das três categorias acima. Outras transferências (consórcios, privadas) ficam fora.", "Sum of the three categories above. Other transfers (consortia, private) are excluded."),
    ("prop_pc", "Receita própria per capita", "Own revenue per capita", "R$/hab.", 0, "Mesma definição de receita própria (inclui capital).", "Same own-revenue definition (includes capital)."),
    ("fed_pc", "Transferências da União per capita", "Federal transfers per capita", "R$/hab.", 0, "RO1.7.1 + RO2.4.1, líquidas de dedução FUNDEB. Nominal.", "RO1.7.1 + RO2.4.1, net of FUNDEB deduction. Nominal."),
    ("est_pc", "Transferências do estado per capita", "State transfers per capita", "R$/hab.", 0, "RO1.7.2 + RO2.4.2, líquidas de dedução FUNDEB. Nominal.", "RO1.7.2 + RO2.4.2, net of FUNDEB deduction. Nominal."),
    ("fundeb_pc", "Receita do FUNDEB per capita", "FUNDEB inflow per capita", "R$/hab.", 0, "RO1.7.5.1 recebido. Nominal.", "RO1.7.5.1 received. Nominal."),
    ("cred_pc", "Operações de crédito per capita", "Credit operations per capita", "R$/hab.", 1, "RO2.1. Zero real para a maioria dos municípios.", "RO2.1. Zero for most municipalities."),
    ("icms_pc", "Cota-parte do ICMS per capita (bruta)", "ICMS share per capita (gross)", "R$/hab.", 0, "RO1.7.2.1.50, bruta (antes da retenção de 20% para o FUNDEB). Cota-parte municipal do ICMS recebida do estado, não é a arrecadação de ICMS no município.", "RO1.7.2.1.50, gross (before 20% FUNDEB retention). ICMS share received from the state, not ICMS collected in the municipality."),
    ("ipva_pc", "Cota-parte do IPVA per capita (bruta)", "IPVA share per capita (gross)", "R$/hab.", 0, "RO1.7.2.1.51, bruta. Metade do IPVA do veículo emplacado no município.", "RO1.7.2.1.51, gross. Half of IPVA from vehicles registered in the municipality."),
    ("fpm_pc", "FPM per capita (bruto)", "FPM (municipal participation fund) per capita (gross)", "R$/hab.", 0, "RO1.7.1.1.51, bruto (antes da retenção FUNDEB).", "RO1.7.1.1.51, gross."),
    ("icms", "Cota-parte do ICMS (bruta)", "ICMS share (gross)", "R$", 0, "RO1.7.2.1.50.", "RO1.7.2.1.50."),
    ("ipva", "Cota-parte do IPVA (bruta)", "IPVA share (gross)", "R$", 0, "RO1.7.2.1.51.", "RO1.7.2.1.51."),
    ("desp_pc", "Despesa total empenhada per capita", "Total committed expenditure per capita", "R$/hab.", 0, "I-D TotalDespesas, coluna Empenhada. Nominal.", "DCA I-D total, committed. Nominal."),
    ("inv_emp_pc", "Investimento empenhado per capita", "Committed investment per capita", "R$/hab.", 0, "Grupo 4.4 (Investimentos: obras 4.4.90.51, equipamentos 4.4.90.52...). Empenhado reflete decisão no ano; DCA não informa a fonte do recurso.", "Group 4.4 (investments). Committed shows the decision in the year; DCA does not say the funding source."),
    ("inv_pago_pc", "Investimento pago per capita", "Paid investment per capita", "R$/hab.", 0, "Grupo 4.4, coluna Paga (restos a pagar quitados no ano seguinte não entram no ano da inscrição).", "Group 4.4, paid column (carry-over paid next year is not included)."),
    ("inv_pct_desp", "Investimento empenhado (% da despesa empenhada)", "Committed investment (% of committed expenditure)", "%", 1, "Grupo 4.4 / total.", "Group 4.4 / total."),
    ("pes_pct_desp", "Pessoal e encargos (% da despesa empenhada)", "Personnel (% of committed expenditure)", "%", 1, "Grupo 3.1 / total.", "Group 3.1 / total."),
    ("rp_pc", "Restos a pagar inscritos per capita", "Payables carried over (inscribed) per capita", "R$/hab.", 0, "Inscrição de restos a pagar processados + não processados no ano (I-D total). É fluxo de inscrição, não o estoque.", "Processed + unprocessed carry-over inscribed in the year (flow, not stock)."),
    ("rp_pct_desp", "Restos a pagar inscritos (% da despesa empenhada)", "Payables carried over (% of committed expenditure)", "%", 1, "Inscrição / despesa empenhada.", "Inscribed / committed."),
]
ESPEC = [e for e in ESPEC if e[0] not in ("icms", "ipva")] + [e for e in ESPEC if e[0] in ("icms", "ipva")]


def capag():
    """-> lista de (ano_base, dict ibge7 -> (nota, i1, i2, i3), rotulo_arquivo)"""
    import pandas as pd
    res = []
    f = pd.read_excel(f"{CAPAG}/capag-municipios-2023.xlsx", sheet_name=0)
    res.append((2022, {str(int(r["Cod.IBGE"])): (r["CAPAG_Oficial"], r["Indicador_1"], r["Indicador_2"], r["Indicador_3"]) for _, r in f.iterrows()}, "capag-municipios-2023.xlsx"))
    for ab, nome in [(2023, "capag-municipios-2024-10-15.xlsx"), (2024, "capag-municipios-posicao-2025-nov.xlsx"), (2025, "capag-municipios-posicao-2026-set.xlsx")]:
        f = pd.read_excel(f"{CAPAG}/{nome}", sheet_name="Prévia da CAPAG", header=2)
        f = f[f["Código Município Completo"].notna()]
        res.append((ab, {str(int(r["Código Município Completo"])): (r["CAPAG"], r["Indicador 1"], r["Indicador 2"], r["Indicador 3"]) for _, r in f.iterrows()}, nome))
    return res


def num(x):
    try:
        x = float(x)
        return None if x != x else x
    except (TypeError, ValueError):
        return None


def main():
    loc = json.load(open(LOC, encoding="utf-8"))
    ibge = sorted({str(m["municipio-id"]) for m in loc})
    pop = {}
    p = json.load(open(f"{PARC}/ibge.json"))
    for i, v in zip(p["ibge"], p["cols"]["censo_pop"]): pop[i] = v
    vars_, cols, cob = [], {}, {}

    for ano in ANOS:
        feito, dados, trunc = ler_ano(ano)
        EXCLUIDOS.clear()
        res = {i: calc(dados[i], pop.get(i)) for i in dados}
        n_excl = len(EXCLUIDOS)
        res = {i: r for i, r in res.items() if r}
        cob[ano] = {"municipios_no_feito": len(feito), "municipios_com_receita": len(res), "arquivo_truncado": trunc,
                    "completo": len(feito) >= 5570, "de": len(ibge), "excluidos_receita_pc_absurda": n_excl}
        print(ano, cob[ano], flush=True)
        if not res: continue
        stat = "completo" if len(feito) >= 5570 else f"PARCIAL ({len(res)} municípios coletados até a geração)"
        for suf, pt, en, un, dec, npt, nen in ESPEC:
            k = f"orc_fin_{suf}_{ano}"
            vars_.append({"k": k, "pt": f"{pt} ({ano})", "en": f"{en} ({ano})", "grupo_pt": GP, "grupo_en": GE,
                          "fonte": "Tesouro Nacional — DCA/SICONFI", "unidade": un, "dec": dec, "ano": ano, "tipo": "num", "papel": "contexto",
                          "nota_pt": f"{npt} Cobertura {ano}: {stat}. Município sem DCA = vazio (não zero); município-ano com receita corrente > R$ 150 mil/hab. (erro de declaração) foi descartado.",
                          "nota_en": f"{nen} Coverage {ano}: {'complete' if len(feito) >= 5570 else 'PARTIAL (' + str(len(res)) + ' municipalities collected at build time)'}. Municipality without DCA = empty (not zero)."})
            cols[k] = [(res[i].get(suf) if i in res else None) for i in ibge]

    # CAPAG
    for ab, dic, nome in capag():
        cats = ["A+", "A", "B+", "B", "C", "D", "n.d.", "n.e."]
        k = f"orc_capag_nota_ab{ab}"
        vals = []
        for i in ibge:
            r = dic.get(i)
            v = str(r[0]).strip() if r and r[0] == r[0] and r[0] is not None else None
            vals.append(v)
        usados = sorted({v for v in vals if v})
        vars_.append({"k": k, "pt": f"CAPAG — nota (ano-base {ab})", "en": f"CAPAG — rating (base year {ab})", "grupo_pt": GPC, "grupo_en": GEC,
                      "fonte": f"Tesouro Nacional — CAPAG ({nome})", "unidade": "classe", "dec": 0, "ano": ab, "tipo": "cat", "papel": "contexto",
                      "categorias": [c for c in cats if c in usados] + [c for c in usados if c not in cats],
                      "nota_pt": f"Capacidade de pagamento do município com DCA de {ab}. n.d. = sem dados/DCA não entregue; n.e. = não enviado/enquadrado. Edição {nome}; até a posição 2025 a nota pode ser a 'prévia'.",
                      "nota_en": f"Municipal payment capacity using {ab} DCA data. n.d. = no data; n.e. = not submitted. File {nome}."})
        cols[k] = vals
        for j, (suf, pt, en) in enumerate([("endiv", "Indicador 1 — endividamento (dívida consolidada/RCL)", "Indicator 1 — indebtedness (debt/net revenue)"),
                                           ("poup", "Indicador 2 — poupança corrente (despesa corrente/receita ajustada)", "Indicator 2 — current savings (current spending/adjusted revenue)"),
                                           ("liq", "Indicador 3 — índice de liquidez (obrigações/disponibilidade de caixa)", "Indicator 3 — liquidity index")], start=1):
            kk = f"orc_capag_{suf}_ab{ab}"
            vars_.append({"k": kk, "pt": f"CAPAG — {pt} (ano-base {ab})", "en": f"CAPAG — {en} (base year {ab})", "grupo_pt": GPC, "grupo_en": GEC,
                          "fonte": f"Tesouro Nacional — CAPAG ({nome})", "unidade": "razão", "dec": 3, "ano": ab, "tipo": "num", "papel": "contexto",
                          "nota_pt": "Razão da metodologia CAPAG (menor é melhor nos indicadores 1 e 2; no 3 a escala mudou em 2024: 'Indicador 3 Antigo' não usado).",
                          "nota_en": "CAPAG methodology ratio; the scale of indicator 3 changed in 2024."})
            cols[kk] = [num(dic[i][j]) if i in dic else None for i in ibge]
        cob[f"capag_{ab}"] = {"municipios": sum(1 for v in cols[k] if v), "arquivo": nome}

    json.dump({"fonte": "orc_financas", "ibge": ibge, "vars": vars_, "cols": cols}, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    json.dump(cob, open("/mnt/d/01_claudeCode/10_EleicoesBrasil/dados_externos/orc_financas_cobertura.json", "w"), indent=1)
    print("vars", len(vars_), "->", OUT)


if __name__ == "__main__":
    main()
