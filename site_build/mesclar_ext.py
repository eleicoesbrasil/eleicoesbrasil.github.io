"""Junta os arquivos parciais de dados externos (dados_externos/parciais/*.json) em docs/dados/ext/municipios.json.

Uso: python mesclar_ext.py [pasta_parciais] [saida.json]
Contrato: dados_externos/CONTRATO_DADOS.md. Lista mestra de municípios: IBGE localidades (municipios_nivelado.json).
"""
import glob, json, math, os, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
PARC = sys.argv[1] if len(sys.argv) > 1 else "/mnt/d/01_claudeCode/10_EleicoesBrasil/dados_externos/parciais"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(AQUI, "..", "docs", "dados", "ext", "municipios.json")
LOC = os.environ.get("LOCALIDADES", "/mnt/e/EleicoesBrasil_externos/ibge/localidades/municipios_nivelado.json")


def main():
    loc = json.load(open(LOC, encoding="utf-8"))
    mestre = {}
    for m in loc:
        cod = str(m.get("municipio-id"))
        mestre[cod] = (m.get("municipio-nome"), m.get("UF-sigla"), m.get("regiao-nome"))
    cods = sorted(mestre)
    idx = {c: i for i, c in enumerate(cods)}
    vars_, cols, vistos = [], {}, set()
    for f in sorted(glob.glob(os.path.join(PARC, "*.json"))):
        p = json.load(open(f, encoding="utf-8"))
        ib = [str(x) for x in p["ibge"]]
        for v in p["vars"]:
            k = v["k"]
            if k in vistos:
                print("aviso: variável repetida ignorada:", k, "em", os.path.basename(f)); continue
            vistos.add(k)
            arr = [None] * len(cods); dec = v.get("dec", 2); src = p["cols"].get(k)
            if src is None: print("aviso: sem coluna", k); continue
            for c, val in zip(ib, src):
                i = idx.get(c)
                if i is None or val is None: continue
                if v.get("tipo", "num") == "num":
                    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)): continue
                    val = round(val, dec) if dec else int(round(val))
                arr[i] = val
            v = dict(v); v["fonte_arquivo"] = p.get("fonte", os.path.basename(f))
            v["n"] = sum(1 for x in arr if x is not None)
            vars_.append(v); cols[k] = arr
    out = {"n": len(cods), "ibge": cods, "nome": [mestre[c][0] for c in cods], "uf": [mestre[c][1] for c in cods],
           "reg": [mestre[c][2] for c in cods], "vars": vars_, "cols": cols}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"ext: {len(cods)} municípios, {len(vars_)} variáveis -> {OUT} ({os.path.getsize(OUT)//1024} KB)")


if __name__ == "__main__":
    main()
