"""Gera docs/dados/abst_corr.json: variação da abstenção (2º menos 1º turno de 2026) contra as demais variáveis, por seção.

Entradas : docs/dados/parquet/presidente_secoes_2026_1t.parquet e presidente_secoes_2026_2t[_provisorio].parquet
Saída    : abst_corr.json com (a) médias, desvios, matrizes de correlação de Pearson e Spearman (todas as seções),
           (b) faixas (5, 10 e 20 grupos iguais pela variação da taxa de abstenção) com média e 41 quantis por variável,
           (c) amostra aleatória de seções para o gráfico de dispersão.
Uso      : python gerar_abst_corr.py <pasta docs/dados> [saida.json]
"""
import json
import sys
from pathlib import Path

import duckdb

# (chave, rótulo, grupo, casas decimais)
VARS = [
    ("dabs", "Variação da taxa de abstenção (pontos percentuais)", "Variação (2º − 1º turno)", 2),
    ("dcp", "Variação do comparecimento (votos)", "Variação (2º − 1º turno)", 0),
    ("dcpr", "Variação do comparecimento (%)", "Variação (2º − 1º turno)", 2),
    ("dV", "Variação dos votos válidos", "Variação (2º − 1º turno)", 0),
    ("dL", "Variação dos votos de Lula", "Variação (2º − 1º turno)", 0),
    ("dF", "Variação dos votos de Flávio Bolsonaro", "Variação (2º − 1º turno)", 0),
    ("dLr", "Variação dos votos de Lula (%)", "Variação (2º − 1º turno)", 2),
    ("dFr", "Variação dos votos de Flávio Bolsonaro (%)", "Variação (2º − 1º turno)", 2),
    ("dpL", "Variação da % de válidos de Lula (pontos percentuais)", "Variação (2º − 1º turno)", 2),
    ("dpF", "Variação da % de válidos de Flávio Bolsonaro (pontos percentuais)", "Variação (2º − 1º turno)", 2),
    ("dB", "Variação dos votos em branco", "Variação (2º − 1º turno)", 0),
    ("dN", "Variação dos votos nulos", "Variação (2º − 1º turno)", 0),
    ("dpB", "Variação da % de brancos (pontos percentuais)", "Variação (2º − 1º turno)", 2),
    ("dpN", "Variação da % de nulos (pontos percentuais)", "Variação (2º − 1º turno)", 2),
    ("ap2", "Eleitores aptos", "2º turno", 0),
    ("abs2", "Taxa de abstenção (%)", "2º turno", 2),
    ("cp2", "Total de votos (comparecimento)", "2º turno", 0),
    ("V2", "Votos válidos", "2º turno", 0),
    ("L2", "Votos de Lula", "2º turno", 0),
    ("F2", "Votos de Flávio Bolsonaro", "2º turno", 0),
    ("pL2", "% de válidos de Lula", "2º turno", 2),
    ("pF2", "% de válidos de Flávio Bolsonaro", "2º turno", 2),
    ("B2", "Votos em branco", "2º turno", 0),
    ("N2", "Votos nulos", "2º turno", 0),
    ("pB2", "% de brancos (sobre o comparecimento)", "2º turno", 2),
    ("pN2", "% de nulos (sobre o comparecimento)", "2º turno", 2),
    ("abs1", "Taxa de abstenção (%)", "1º turno", 2),
    ("cp1", "Total de votos (comparecimento)", "1º turno", 0),
    ("L1", "Votos de Lula", "1º turno", 0),
    ("F1", "Votos de Flávio Bolsonaro", "1º turno", 0),
    ("pL1", "% de válidos de Lula", "1º turno", 2),
    ("pF1", "% de válidos de Flávio Bolsonaro", "1º turno", 2),
]
QS = [i / 40 for i in range(41)]
NBS = (5, 10, 20)
SAMPLE = 15000


def main(dados: Path, out: Path):
    pq = dados / "parquet"
    p1 = pq / "presidente_secoes_2026_1t.parquet"
    p2 = next((p for p in (pq / "presidente_secoes_2026_2t.parquet", pq / "presidente_secoes_2026_2t_provisorio.parquet") if p.exists()), None)
    if not p1.exists() or p2 is None:
        print("abst_corr: faltam Parquet de 2026 (1t e 2t)"); return
    con = duckdb.connect()
    con.execute(f"""create table s as select
        b.aptos ap2, a.aptos ap1, a.comparecimento cp1, b.comparecimento cp2,
        a.votos_13 L1, a.votos_22 F1, a.votos_outros O1, a.votos_brancos B1, a.votos_nulos N1,
        b.votos_13 L2, b.votos_22 F2, b.votos_outros O2, b.votos_brancos B2, b.votos_nulos N2
        from read_parquet('{p1}') a join read_parquet('{p2}') b using (uf, cd_municipio, zona, secao)
        where a.aptos>0 and b.aptos>0""")
    con.execute("""create table t as select *, L1+F1+O1 V1, L2+F2+O2 V2 from s""")
    con.execute("""create table x as select
        ((1-cp2*1.0/ap2)-(1-cp1*1.0/ap1))*100 dabs, cp2-cp1 dcp, (cp2-cp1)*100.0/cp1 dcpr, V2-V1 dV, L2-L1 dL, F2-F1 dF,
        (L2-L1)*100.0/L1 dLr, (F2-F1)*100.0/F1 dFr, (L2*100.0/V2-L1*100.0/V1) dpL, (F2*100.0/V2-F1*100.0/V1) dpF,
        B2-B1 dB, N2-N1 dN, (B2*100.0/cp2-B1*100.0/cp1) dpB, (N2*100.0/cp2-N1*100.0/cp1) dpN,
        ap2, (1-cp2*1.0/ap2)*100 abs2, cp2, V2, L2, F2, L2*100.0/V2 pL2, F2*100.0/V2 pF2, B2, N2, B2*100.0/cp2 pB2, N2*100.0/cp2 pN2,
        (1-cp1*1.0/ap1)*100 abs1, cp1, L1, F1, L1*100.0/V1 pL1, F1*100.0/V1 pF1
        from t where cp1>0 and cp2>0 and V1>0 and V2>0 and L1>0 and F1>0""")
    keys = [v[0] for v in VARS]
    n = con.execute("select count(*) from x").fetchall()[0][0]
    ranks = ", ".join(f"rank() over (order by {k}) r_{k}" for k in keys)
    con.execute(f"create table r as select {ranks} from x")
    pairs = [(a, b) for i, a in enumerate(keys) for b in keys[i:]]
    def matrix(tab, pre):
        row = con.execute("select " + ", ".join(f"corr({pre}{a},{pre}{b})" for a, b in pairs) + f" from {tab}").fetchall()[0]
        m = {k: {} for k in keys}
        for (a, b), v in zip(pairs, row):
            v = 0.0 if v is None else float(v); m[a][b] = v; m[b][a] = v
        return [[round(m[a][b], 4) for b in keys] for a in keys]
    st = con.execute("select " + ", ".join(f"avg({k}), stddev_samp({k}), quantile_cont({k},0.01), quantile_cont({k},0.99)" for k in keys) + " from x").fetchall()[0]
    mean = [st[4 * i] for i in range(len(keys))]; sd = [st[4 * i + 1] for i in range(len(keys))]
    p01 = [[st[4 * i + 2], st[4 * i + 3]] for i in range(len(keys))]
    out_d = {"n": n, "vars": [{"k": k, "l": l, "g": g, "d": d} for k, l, g, d in VARS], "mean": mean, "sd": sd, "p": p01,
             "rP": matrix("x", ""), "rS": matrix("r", "r_"), "bins": {}}
    for nb in NBS:
        con.execute(f"create or replace table xb as select *, ntile({nb}) over (order by dabs) bin from x")
        cols = ", ".join(f"avg({k}), quantile_cont({k}, {QS})" for k in keys)
        rows = con.execute(f"select bin, count(*), min(dabs), max(dabs), {cols} from xb group by bin order by bin").fetchall()
        out_d["bins"][str(nb)] = {"n": [r[1] for r in rows], "lo": [r[2] for r in rows], "hi": [r[3] for r in rows],
            "mean": [[r[4 + 2 * i] for i in range(len(keys))] for r in rows],
            "q": [[[round(q, 4) for q in r[5 + 2 * i]] for i in range(len(keys))] for r in rows]}
    smp = con.execute(f"select * from x using sample {SAMPLE} rows (reservoir, 7)").fetchall()
    out_d["sample"] = [[round(row[i], d) if d else int(round(row[i])) for row in smp] for i, (_, _, _, d) in enumerate(VARS)]
    out.write_text(json.dumps(out_d, separators=(",", ":"), allow_nan=False))
    print("abst_corr: seções", n, "->", out, out.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    d = Path(sys.argv[1]); main(d, Path(sys.argv[2]) if len(sys.argv) > 2 else d / "abst_corr.json")
