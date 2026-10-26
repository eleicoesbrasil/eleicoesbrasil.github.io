"""Gera os JSON do painel (data/derivados) a partir dos Parquet de presidente por seção.

Entradas : data/parquet/presidente_secoes_{2022,2026}_{1t,2t}.parquet  (ver scripts/02_gerar_parquet.sh)
Saídas   : data/derivados/{mun_fluxo,abst_bins,close_tab,mun_xy}.json
Sem os Parquet do 2º turno de 2026 (o TSE ainda não publicou o CSV) o fluxo usa data/derivados/totais_municipais_2026_2t.json.
"""
import json
import sys
from pathlib import Path

import duckdb

XMIN, XMAX = -120, 360
LAB = {(2022, "1t"): ("2022 · 1º turno", "Bolsonaro"), (2022, "2t"): ("2022 · 2º turno", "Bolsonaro"),
       (2026, "1t"): ("2026 · 1º turno", "Flávio"), (2026, "2t"): ("2026 · 2º turno", "Flávio")}


def main(pq: Path, out: Path):
    out.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect()
    ok = {(a, t): pq / f"presidente_secoes_{a}_{t}.parquet" for (a, t) in LAB if (pq / f"presidente_secoes_{a}_{t}.parquet").exists()}
    print("conjuntos disponíveis:", sorted(ok))

    # ---- fluxo por município (2026 1º e 2º turno)
    def mun(path):
        return con.execute(f"""select uf, cd_municipio, any_value(nm_municipio) nm, sum(votos_13) L, sum(votos_22) F, sum(votos_outros) O,
            sum(votos_brancos) B, sum(votos_nulos) N, sum(aptos) ap, sum(comparecimento) cp, sum(abstencoes) ab
            from read_parquet('{path}') group by 1,2""").fetchall()
    if (2026, "1t") in ok:
        m1 = {(r[0], r[1]): r for r in mun(ok[(2026, "1t")])}
        if (2026, "2t") in ok:
            m2 = {(r[0], r[1]): r for r in mun(ok[(2026, "2t")])}
        else:
            j = out / "totais_municipais_2026_2t.json"
            tm = json.loads(j.read_text())["municipios"] if j.exists() else []
            m2 = {(m["uf"], m["mun"]): (m["uf"], m["mun"], m["nm"], m["l2"], m["f2"], 0, m["b2"], m["n2"], m["aptos2"], m["comp2"], m["abst2"]) for m in tm}
        fl = []
        for k, a in m1.items():
            b = m2.get(k)
            if b:
                fl.append([a[0], a[1], a[2].title(), a[3], a[4], a[5], a[6], a[7], a[8], a[9], a[10], b[3], b[4], b[6], b[7], b[8], b[9], b[10]])
        (out / "mun_fluxo.json").write_text(json.dumps(fl, ensure_ascii=False))
        print("mun_fluxo:", len(fl), "municípios")

    # ---- abstenção: decis de seções por variação da taxa (precisa dos dois turnos de 2026 por seção)
    if (2026, "1t") in ok and (2026, "2t") in ok:
        con.execute(f"""create or replace table sec as select a.uf, a.cd_municipio, a.zona, a.secao, a.votos_13 L1, a.votos_22 F1, a.votos_outros O1,
            a.votos_brancos+a.votos_nulos BN1, a.aptos ap1, a.comparecimento cp1, b.votos_13 L2, b.votos_22 F2, b.votos_brancos+b.votos_nulos BN2,
            b.aptos ap2, b.comparecimento cp2 from read_parquet('{ok[(2026,'1t')]}') a join read_parquet('{ok[(2026,'2t')]}') b using (uf, cd_municipio, zona, secao)
            where a.aptos>0 and b.aptos>0""")
        con.execute("""create or replace table bb as select *, (1-cp2*1.0/ap2)-(1-cp1*1.0/ap1) dabs, ntile(10) over (order by (1-cp2*1.0/ap2)-(1-cp1*1.0/ap1)) bin from sec""")
        rows = con.execute("""select bin, count(*), min(dabs)*100, max(dabs)*100, sum(ap1), sum(ap2), sum(L1), sum(F1), sum(O1), sum(BN1), sum(ap1-cp1),
            sum(L2), sum(F2), sum(BN2), sum(ap2-cp2) from bb group by bin order by bin""").fetchall()
        cols = ["bin", "n", "lo", "hi", "ap1", "ap2", "L1", "F1", "O1", "BN1", "A1", "L2", "F2", "BN2", "A2"]
        (out / "abst_bins.json").write_text(json.dumps([dict(zip(cols, [float(x) if isinstance(x, float) else int(x) for x in r])) for r in rows]))
        print("abst_bins: seções cruzadas", sum(r[1] for r in rows))

    # ---- fechamento das urnas: bins de 1 minuto por UF, relativo às 17h de Brasília
    ds = {}
    for (a, t), p in ok.items():
        lab, cand = LAB[(a, t)]
        con.execute(f"""create or replace table t as select uf, cd_municipio mun, votos_13 L, votos_22 F,
            date_diff('second', date_trunc('day', encerramento_brasilia) + interval 17 hour, encerramento_brasilia)/60.0 delta
            from read_parquet('{p}') where uf<>'ZZ' and encerramento_brasilia is not null""")
        n = con.execute("select count(*) from t").fetchall()[0][0]
        if not n:
            continue
        ufs = {}
        for uf in [r[0] for r in con.execute("select distinct uf from t").fetchall()]:
            L = [0] * (XMAX - XMIN + 1); F = list(L); N = list(L)
            for d, nn, l, f in con.execute("select greatest(?,least(?,floor(delta)))::int, count(*), sum(L), sum(F) from t where uf=? group by 1", [XMIN, XMAX, uf]).fetchall():
                N[d - XMIN] = nn; L[d - XMIN] = int(l or 0); F[d - XMIN] = int(f or 0)
            tot = sum(N)
            ufs[uf] = {"n": N, "L": L, "F": F, "fator": 1.0, "amostra": tot, "total": tot}
        rows = con.execute("""with b as (select *, case when delta<=15 then 0 when delta<=30 then 1 when delta<=60 then 2 when delta<=90 then 3 else 4 end fx from t),
            m as (select uf, mun, sum(L) filter(where fx=0) L0, sum(F) filter(where fx=0) F0 from b group by 1,2)
            select b.fx, count(*) n, sum(b.L), sum(b.F), 0, sum((b.L+b.F)*m.L0*1.0/nullif(m.L0+m.F0,0)) filter(where m.L0+m.F0>0),
              sum(b.L) filter(where m.L0+m.F0>0), sum(b.L+b.F) filter(where m.L0+m.F0>0) from b join m using (uf, mun) group by 1 order by 1""").fetchall()
        faixas = [dict(zip(["f", "n", "L", "F", "comp", "expL", "Lc", "LFc"], [(float(x) if isinstance(x, float) else int(x or 0)) for x in r])) for r in rows]
        ds[f"{a}_{t}"] = {"label": lab, "cand": cand, "ufs": ufs, "faixas": faixas, "n": n}
    (out / "close_tab.json").write_text(json.dumps({"datasets": ds, "xmin": XMIN, "xmax": XMAX}, separators=(",", ":")))
    print("close_tab:", {k: v["n"] for k, v in ds.items()})

    # ---- centro de gravidade dos locais de votação por município (mapa de calor)
    if (2026, "1t") in ok:
        rows = con.execute(f"""select uf, cd_municipio, any_value(nm_municipio), sum(aptos*lat)/sum(aptos), sum(aptos*lon)/sum(aptos)
            from read_parquet('{ok[(2026,'1t')]}') where lat is not null and uf<>'ZZ' group by 1,2""").fetchall()
        (out / "mun_xy.json").write_text(json.dumps({f"{u}-{m}": [n, round(la, 4), round(lo, 4)] for u, m, n, la, lo in rows}, ensure_ascii=False))
        print("mun_xy:", len(rows))


if __name__ == "__main__":
    main(Path(sys.argv[1] if len(sys.argv) > 1 else "docs/dados/parquet"), Path(sys.argv[2] if len(sys.argv) > 2 else "docs/dados/derivados"))
