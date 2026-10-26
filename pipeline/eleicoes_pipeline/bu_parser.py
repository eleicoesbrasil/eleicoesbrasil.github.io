"""Extrai votos de um boletim de urna (bu.dat, BER) do TSE.

Layout (derivado por engenharia reversa e validado contra o CSV oficial):
 arquivo = SEQ{ ..., [0:4] OCTET STRING -> BER do boletim }
 boletim = SEQ{ ..., [0:2] comparecimento, ..., SEQ(eleições), SEQ(hash) }
 eleição = SEQ{ id, aptos, ?, ?, SEQ(agrupamentos) }
 linha de voto = SEQ{ [2:1] tipo (1 nominal,2 branco,3 nulo,4 legenda), [2:2] qtd, [2:3]{partido, número}? }
 cargo = SEQ{ [2:1] cd_cargo, [0:2] nº linhas, SEQ(linhas) }
"""
from dataclasses import dataclass, field

from .ber import parse, to_int

NR_BRANCO, NR_NULO = 95, 96


@dataclass
class Voto:
    eleicao: int
    cargo: int
    numero: int  # número do candidato/partido, 95 branco, 96 nulo
    tipo: int
    votos: int


@dataclass
class Boletim:
    comparecimento: int
    aptos: dict = field(default_factory=dict)  # eleicao -> aptos
    votos: list = field(default_factory=list)


def _is(n, cls, tag):
    return n[0] == cls and n[1] == tag


def _linha(l):
    kids = l[2]
    tipo = qtd = None
    num = None
    for c in kids:
        if _is(c, 2, 1):
            tipo = to_int(c[2])
        elif _is(c, 2, 2):
            qtd = to_int(c[2])
        elif _is(c, 2, 3) and c[2]:
            num = to_int(c[2][-1][2])
    return tipo, qtd, num


def _walk(node_list, eleicao, out):
    for n in node_list:
        if not isinstance(n[2], list):
            continue
        kids = n[2]
        cargo_tag = next((k for k in kids if _is(k, 2, 1)), None)
        lines = kids[-1] if kids and isinstance(kids[-1][2], list) else None
        if (cargo_tag is not None and lines is not None and not any(_is(k, 2, 2) for k in kids)
                and lines[2] and all(isinstance(x[2], list) and any(_is(y, 2, 2) for y in x[2]) for x in lines[2])):
            cargo = to_int(cargo_tag[2])
            for l in lines[2]:
                tipo, qtd, num = _linha(l)
                if tipo == 2:
                    num = NR_BRANCO
                elif tipo == 3:
                    num = NR_NULO
                out.append(Voto(eleicao, cargo, num, tipo, qtd))
        else:
            _walk(kids, eleicao, out)


def parse_bu(dados: bytes) -> Boletim:
    outer = parse(dados)
    root = parse(outer[0][2][-1][2])[0][2]
    comp = next(to_int(n[2]) for n in root if _is(n, 0, 2))
    b = Boletim(comparecimento=comp)
    for e in root[-2][2]:
        k = e[2]
        eid = to_int(k[0][2])
        b.aptos[eid] = to_int(k[1][2])
        _walk(k[4][2] if isinstance(k[4][2], list) else [], eid, b.votos)
    return b
