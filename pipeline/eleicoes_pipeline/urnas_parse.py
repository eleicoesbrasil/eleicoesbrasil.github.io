"""Extrai de cada boletim de urna dos ZIPs 'arquivos transmitidos' (2022 e 2026) os horários de
abertura/fechamento da urna e os votos para presidente. Funciona com os dois formatos (.bu de 2022, -bu.dat de 2026)."""
import re
import sys
import zipfile
from pathlib import Path

import duckdb

from .ber import parse, to_int
from .bu_parser import _walk

TS = re.compile(rb"^\d{8}T\d{6}$")
BASE = Path("/mnt/e/EleicoesBrasil_urnas")
OUT = Path(__file__).resolve().parents[2] / "data" / "urnas_parsed"
NOME = re.compile(r"o(\d+)(?:([a-z]{2}))?(?:-|)(\d{5})(\d{4})(\d{4})(?:-bu\.dat|\.bu)$")


def extrair(dados: bytes) -> dict:
    outer = parse(dados)
    root = parse(outer[0][2][-1][2])[0][2]
    abre = fecha = emissao = None
    for c, tg, v in root:
        if c == 2 and tg == 0 and isinstance(v, list) and len(v) == 2 and all(isinstance(x[2], bytes) and TS.match(x[2]) for x in v):
            abre, fecha = v[0][2].decode(), v[1][2].decode()
        elif c == 0 and tg == 27 and isinstance(v, bytes) and TS.match(v):
            emissao = v.decode()
    cont = next((n[2] for n in root if n[0] == 2 and n[1] == 3), None)
    if cont is None:
        cont = root[-2][2]
    votos, aptos, comp = [], None, None
    for e in cont:
        k = e[2]
        eid = to_int(k[0][2])
        tmp = []
        _walk(k[2:], eid, tmp)
        pres = [v for v in tmp if v.cargo == 1]
        if pres:
            votos = pres
            aptos = to_int(k[1][2])
            comp = sum(v.votos for v in pres)
    return {"abre": abre, "fecha": fecha, "emissao": emissao, "aptos": aptos, "comp": comp,
            "L": sum(v.votos for v in votos if v.numero == 13), "F": sum(v.votos for v in votos if v.numero == 22),
            "B": sum(v.votos for v in votos if v.numero == 95), "N": sum(v.votos for v in votos if v.numero == 96),
            "O": sum(v.votos for v in votos if v.numero not in (13, 22, 95, 96))}


def processar_zip(caminho, limite=None, zf=None):
    nome = Path(str(caminho)).name
    m = re.search(r"_(\d{4})_(1t|2t)_([A-Z]{2})\.zip$", nome)
    ano, turno, uf = int(m.group(1)), m.group(2), m.group(3)
    z = zf or zipfile.ZipFile(caminho)
    rows, erros = [], 0
    alvos = [i for i in z.infolist() if i.filename.endswith("-bu.dat") or i.filename.endswith(".bu")]
    for i in alvos[:limite]:
        mm = re.search(r"(\d{5})(\d{4})(\d{4})(?:-bu\.dat|\.bu)$", i.filename)
        try:
            d = extrair(z.read(i.filename))
        except Exception:
            erros += 1
            continue
        rows.append({"ano": ano, "turno": turno, "uf": uf, "mun": int(mm.group(1)), "zona": int(mm.group(2)), "secao": int(mm.group(3)), **d})
    return rows, erros, len(alvos)


def gravar(rows, destino: Path):
    destino.parent.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect()
    con.execute("create table t(ano int, turno varchar, uf varchar, mun int, zona int, secao int, abre varchar, fecha varchar, emissao varchar, aptos int, comp int, L int, F int, B int, N int, O int)")
    con.executemany("insert into t values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    [[r[k] for k in ("ano", "turno", "uf", "mun", "zona", "secao", "abre", "fecha", "emissao", "aptos", "comp", "L", "F", "B", "N", "O")] for r in rows])
    con.execute(f"copy t to '{destino}' (format parquet, compression zstd)")


def rodar_pendentes():
    """Processa os ZIPs completos (sem .part) que ainda não têm saída."""
    feitos = 0
    for ds in ("resultados-2026-arquivos-transmitidos-para-totalizacao", "resultados-2022-arquivos-transmitidos-para-totalizacao"):
        for zp in sorted((BASE / ds).glob("bu_imgbu_logjez_rdv_vscmr_*.zip")):
            out = OUT / (zp.stem + ".parquet")
            if out.exists():
                continue
            rows, erros, n = processar_zip(zp)
            gravar(rows, out)
            print(f"{zp.name}: {len(rows)}/{n} boletins, {erros} erros", flush=True)
            feitos += 1
    return feitos


if __name__ == "__main__":
    rodar_pendentes()
