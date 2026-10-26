"""Aproxima as áreas dos locais de votação e das zonas eleitorais de cada município (diagrama de Voronoi dos locais,
recortado pelo limite municipal do IBGE) e grava um JSON por município para o mapa do painel.

IMPORTANTE: as áreas são estimativas por proximidade ao local de votação, não limites oficiais de zona.

Uso: python -m eleicoes_pipeline.mapa_secoes [--ufs AC,MG] [--municipios "RIO BRANCO"] [--parquet ...] [--out docs/dados/mapa]
Saída: {out}/{UF}/{cd_municipio}.json e {out}/index.json
"""
import argparse
import json
import math
import time
import unicodedata
from pathlib import Path

import duckdb
import httpx
import numpy as np
import shapely
from pyproj import Transformer
from shapely.geometry import Point, mapping, shape
from shapely.ops import transform, unary_union

UFCOD = {"RO": 11, "AC": 12, "AM": 13, "RR": 14, "PA": 15, "AP": 16, "TO": 17, "MA": 21, "PI": 22, "CE": 23, "RN": 24, "PB": 25, "PE": 26,
         "AL": 27, "SE": 28, "BA": 29, "MG": 31, "ES": 32, "RJ": 33, "SP": 35, "PR": 41, "SC": 42, "RS": 43, "MS": 50, "MT": 51, "GO": 52, "DF": 53}
TO_M = Transformer.from_crs(4674, 5880, always_xy=True).transform   # SIRGAS 2000 / Brasil Policônica
TO_D = Transformer.from_crs(5880, 4674, always_xy=True).transform
IBGE = "https://servicodados.ibge.gov.br/api"


def norm(s):
    return "".join(c for c in unicodedata.normalize("NFD", s.upper()) if unicodedata.category(c) != "Mn").strip()


def baixar(url, dest: Path):
    if dest.exists() and dest.stat().st_size > 0:
        return json.loads(dest.read_text())
    for t in range(4):
        try:
            r = httpx.get(url, timeout=180, follow_redirects=True, headers={"User-Agent": "eleicoesbrasil"})
            r.raise_for_status()
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(r.text)
            return r.json()
        except httpx.HTTPError:
            time.sleep(2 ** t)
    raise RuntimeError(url)


def geom(g, nd=5):
    g = shapely.set_precision(transform(TO_D, g), 10 ** -nd)
    return mapping(g)


def poligonos(g):
    if g.is_empty:
        return g
    if g.geom_type in ("Polygon", "MultiPolygon"):
        return g
    ps = [x for x in getattr(g, "geoms", []) if x.geom_type in ("Polygon", "MultiPolygon")]
    return unary_union(ps) if ps else shapely.Polygon()


def municipio(cd, nome, uf, g, limite, fonte):
    """g: DataFrame dos locais do município. limite: polígono municipal em metros (ou None)."""
    x, y = TO_M(g.lon.values, g.lat.values)
    g = g.assign(x=x, y=y)
    com = g.lat.notna() & g.lon.notna()
    if limite is None:
        pts = shapely.MultiPoint(list(zip(g.x[com], g.y[com])))
        limite = pts.convex_hull.buffer(2500) if com.sum() >= 3 else pts.buffer(2500)
        fonte = "casco dos locais"
    dentro = np.array([limite.buffer(2000).contains(Point(a, b)) if c else False for a, b, c in zip(g.x, g.y, com)])
    ok = g[dentro].copy()
    inval = g[~dentro]
    base = {"cd": int(cd), "nome": nome, "uf": uf, "fonte": fonte, "inval_locais": int(len(inval)), "inval_secoes": int(inval.n_sec.sum())}
    if ok.empty:
        return {**base, "bbox": None, "zonas": [], "locais": []}
    ok["key"] = list(zip(ok.x.round(-1), ok.y.round(-1)))
    sites = ok.groupby("key").agg(x=("x", "mean"), y=("y", "mean")).reset_index()
    if len(sites) == 1:
        cells = {0: limite.intersection(Point(sites.x[0], sites.y[0]).buffer(3000))}
    else:
        env = limite.envelope.buffer(5000)
        vg = list(shapely.voronoi_polygons(shapely.MultiPoint(list(zip(sites.x, sites.y))), extend_to=env).geoms)
        tree = shapely.STRtree(vg)
        ix = tree.query(shapely.points(sites.x.values, sites.y.values), predicate="within")
        cells = {}
        for si, vi in zip(ix[0], ix[1]):
            cells[si] = poligonos(shapely.make_valid(vg[vi]).intersection(limite))
    sid = {k: i for i, k in enumerate(sites.key)}
    ok["sid"] = ok.key.map(sid)
    locais, zon = [], {}
    for s, grp in ok.groupby("sid"):
        c = cells.get(s)
        if c is None or c.is_empty:
            continue
        dom = grp.sort_values("n_sec", ascending=False).iloc[0]
        a = c.area / 1e6
        cs = c.simplify(10)
        w = float(grp.n_sec.sum())
        locais.append({"id": f"{int(dom.zona)}-{int(dom.nr_local)}", "zona": int(dom.zona), "nome": dom.nm_local, "bairro": dom.bairro or "", "nl": int(len(grp)),
                       "s": int(grp.n_sec.sum()), "ap": int(grp.aptos.sum()), "cp": int(grp.comp.sum()), "v13": int(grp.v13.sum()), "v22": int(grp.v22.sum()),
                       "vo": int(grp.vo.sum()), "vb": int(grp.vb.sum()), "vn": int(grp.vn.sum()),
                       "d": round(float((grp.delay * grp.n_sec).sum() / w), 1) if grp.delay.notna().any() else None,
                       "lat": round(float(grp.lat.median()), 5), "lon": round(float(grp.lon.median()), 5), "a": round(a, 2),
                       "u": 2 if a > 25 else 1 if a > 5 else 0, "g": geom(cs)})
        zon.setdefault(int(dom.zona), []).append(c)
    zonas = []
    for z, cs in zon.items():
        u = unary_union(cs)
        sub = g[g.zona == z]
        zonas.append({"zona": z, "locais": int(len(sub)), "secoes": int(sub.n_sec.sum()), "aptos": int(sub.aptos.sum()), "v13": int(sub.v13.sum()), "v22": int(sub.v22.sum()),
                      "desc": bool(u.geom_type == "MultiPolygon" and len(u.geoms) > 1), "g": geom(u.simplify(20))})
    todos = unary_union([c for c in cells.values() if c is not None and not c.is_empty])
    minx, miny, maxx, maxy = transform(TO_D, todos).bounds
    return {**base, "bbox": [round(minx, 4), round(miny, 4), round(maxx, 4), round(maxy, 4)], "zonas": zonas, "locais": locais}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--parquet", default="docs/dados/parquet/presidente_secoes_2026_1t.parquet")
    ap.add_argument("--out", default="docs/dados/mapa")
    ap.add_argument("--cache", default="dados/ibge")
    ap.add_argument("--ufs", default="")
    ap.add_argument("--municipios", default="", help="nomes separados por ; (para testes)")
    ap.add_argument("--qualidade", default="intermediaria")
    a = ap.parse_args()
    out, cache = Path(a.out), Path(a.cache)
    ufs = [u for u in (a.ufs.split(",") if a.ufs else sorted(UFCOD)) if u]
    filtro = {norm(x) for x in a.municipios.split(";") if x}
    con = duckdb.connect()
    indice = {}
    ind_f = out / "index.json"
    if ind_f.exists():
        indice = json.loads(ind_f.read_text())
    for uf in ufs:
        t0 = time.time()
        nomes = {norm(x["nome"]): str(x["id"]) for x in baixar(f"{IBGE}/v1/localidades/estados/{uf}/municipios", cache / f"nomes_{uf}.json")}
        mal = baixar(f"{IBGE}/v3/malhas/estados/{UFCOD[uf]}?intrarregiao=municipio&formato=application/vnd.geo+json&qualidade={a.qualidade}", cache / f"malha_{uf}_{a.qualidade}.json")
        pol = {f["properties"]["codarea"]: f["geometry"] for f in mal["features"]}
        df = con.execute(f"""select cd_municipio, any_value(nm_municipio) nm_mun, zona, nr_local, any_value(nm_local) nm_local, any_value(bairro) bairro,
              count(*) n_sec, sum(aptos) aptos, sum(comparecimento) comp, sum(votos_13) v13, sum(votos_22) v22, sum(votos_outros) vo,
              sum(votos_brancos) vb, sum(votos_nulos) vn, avg(delay) delay, median(lat) lat, median(lon) lon
              from (select *, greatest(-10, least(300, date_diff('second', date_trunc('day', encerramento_brasilia) + interval 17 hour, encerramento_brasilia)/60.0)) delay
                    from read_parquet('{a.parquet}') where uf='{uf}') group by cd_municipio, zona, nr_local""").df()
        lista = []
        (out / uf).mkdir(parents=True, exist_ok=True)
        for cd, g in df.groupby("cd_municipio"):
            nm = g.nm_mun.iloc[0]
            if filtro and norm(nm) not in filtro:
                continue
            ib = nomes.get(norm(nm))
            lim = poligonos(shapely.make_valid(transform(TO_M, shape(pol[ib])))) if ib and ib in pol else None
            try:
                d = municipio(cd, nm, uf, g, lim, "IBGE" if lim is not None else "")
            except Exception as e:
                print(f"  erro {uf} {nm}: {e!r}", flush=True)
                continue
            if not d["locais"]:
                continue
            (out / uf / f"{int(cd)}.json").write_text(json.dumps(d, separators=(",", ":"), ensure_ascii=False))
            lista.append([int(cd), nm, d["bbox"], len(d["locais"]), int(g.n_sec.sum())])
        if not filtro:
            indice[uf] = sorted(lista, key=lambda r: r[1])
        else:
            antigos = {r[0]: r for r in indice.get(uf, [])}
            antigos.update({r[0]: r for r in lista})
            indice[uf] = sorted(antigos.values(), key=lambda r: r[1])
        out.mkdir(parents=True, exist_ok=True)
        ind_f.write_text(json.dumps(indice, separators=(",", ":"), ensure_ascii=False))
        print(f"{uf}: {len(lista)} municípios em {time.time()-t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
