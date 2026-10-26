"""Calcula quantas seções de 2026 · Presidente já estão na base (Parquet por seção) e grava docs/dados/derivados/cobertura.json."""
import json
import sys
import time
from pathlib import Path

import duckdb

DOCS = Path(sys.argv[1] if len(sys.argv) > 1 else "docs")
pq = DOCS / "dados/parquet"
tot_f = DOCS / "dados/derivados/totais_municipais_2026_2t.json"
TOTAL = 499248
if tot_f.exists():
    TOTAL = sum(m["ts"] for m in json.loads(tot_f.read_text())["municipios"]) or TOTAL
con = duckdb.connect()
def n(path):
    if not path.exists():
        return 0
    return con.execute(f"select count(distinct (uf, cd_municipio, zona, secao)) from read_parquet('{path}')").fetchall()[0][0]
r1 = n(pq / "presidente_secoes_2026_1t.parquet")
r2c = n(pq / "presidente_secoes_2026_2t.parquet")
r2p = n(pq / "presidente_secoes_2026_2t_provisorio.parquet")
r2 = r2c or r2p
out = {"total": TOTAL, "r1": r1, "r2": r2, "r2_provisorio": bool(r2p and not r2c),
       "pct": round(100 * (r1 + r2) / (2 * TOTAL), 1), "pct1": round(100 * r1 / TOTAL, 1), "pct2": round(100 * r2 / TOTAL, 1),
       "atualizado": time.strftime("%Y-%m-%d %H:%M"), }
(DOCS / "dados/derivados/cobertura.json").write_text(json.dumps(out))
print(out)
