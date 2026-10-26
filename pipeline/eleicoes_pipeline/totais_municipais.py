"""Baixa os totais por município do 2º turno de 2026 publicados na apuração (resultados.tse.jus.br).

Uso: python -m eleicoes_pipeline.totais_municipais [saida.json]
Um GET por UF (lista de municípios) e um por município (JSON de totais). É a fonte usada pelo painel
enquanto o TSE não publica o CSV de boletim de urna do 2º turno.
"""
import asyncio
import json
import sys

import httpx

BASE = "https://resultados.tse.jus.br/oficial/ele2026"
UFS = "ac al am ap ba ce df es go ma mg ms mt pa pb pe pi pr rj rn ro rr rs sc se sp to zz".split()
UA = {"User-Agent": "Mozilla/5.0 (eleicoesbrasil)"}


async def get(c, url):
    for t in range(4):
        try:
            r = await c.get(url)
            if r.status_code == 404:
                return None
            r.raise_for_status()
            return r.json()
        except httpx.HTTPError:
            await asyncio.sleep(1.5 ** t)


def cand_votos(d):
    out = {}
    for car in d.get("carg", []):
        if car["cd"] == "1":
            for agr in car.get("agr", []):
                for par in agr.get("par", []):
                    for c in par.get("cand", []):
                        out[int(c["n"])] = int(c.get("vap") or 0)
    return out


async def main(saida):
    res, sem = [], asyncio.Semaphore(32)
    async with httpx.AsyncClient(headers=UA, timeout=30, limits=httpx.Limits(max_connections=32)) as c:
        async def mun(uf, mu):
            async with sem:
                d = await get(c, f"{BASE}/6258/dados/{uf}/{uf}{mu['cd']}-c0001-e006258-u.json")
            if not d:
                return
            v, s, e = d["v"], d["s"], d["e"]
            k = cand_votos(d)
            res.append({"uf": uf.upper(), "mun": int(mu["cd"]), "nm": mu["nm"], "ts": int(s["ts"]), "st": int(s["st"]),
                        "l2": k.get(13, 0), "f2": k.get(22, 0), "b2": int(v["vb"]), "n2": int(v["vn"]),
                        "aptos2": int(e["te"]), "comp2": int(e["c"]), "abst2": int(e["a"]), "hg_json": d["hg"]})

        async def uf_run(uf):
            cs = await get(c, f"{BASE}/arquivo-urna/3221/config/{uf}/{uf}-p003221-cs.json")
            if cs:
                await asyncio.gather(*[mun(uf, m) for m in cs["abr"][0]["mu"]])
        await asyncio.gather(*[uf_run(u) for u in UFS])
    json.dump({"municipios": res}, open(saida, "w"), ensure_ascii=False)
    print(len(res), "municípios;", sum(m["st"] for m in res), "de", sum(m["ts"] for m in res), "seções apuradas")


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "docs/dados/derivados/totais_municipais_2026_2t.json"))
