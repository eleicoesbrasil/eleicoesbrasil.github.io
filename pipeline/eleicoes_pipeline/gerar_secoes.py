"""Gera os Parquet de presidente por seção a partir dos CSVs 'bweb' (boletim de urna web) do TSE.

Saídas em --out:
  presidente_secoes_{ano}_{turno}.parquet   uma linha por seção: comparecimento, votos de 13/22/outros/brancos/nulos,
                                            horários da urna (abertura, encerramento, emissão do BU, recebimento no TSE)
                                            e local de votação com coordenadas.
  presidente_votos_{ano}_{turno}.parquet    formato longo: uma linha por seção e candidato/branco/nulo.
Horários: a urna grava o relógio local; 'encerramento_brasilia' converte para Brasília
(Acre +2h; Amazonas, Rondônia, Roraima, Mato Grosso e Mato Grosso do Sul +1h; demais 0).
"""
import argparse
import re
import shutil
import zipfile
from pathlib import Path

import duckdb

OFFSET_MIN = {"AC": 120, "AM": 60, "RO": 60, "RR": 60, "MT": 60, "MS": 60}


def _extrai(zp: Path, tmp: Path, padrao: str):
    with zipfile.ZipFile(zp) as z:
        nome = next(n for n in z.namelist() if re.search(padrao, n))
        z.extract(nome, tmp)
    return tmp / nome


def _locais(con, tse: Path, ano: int, tmp: Path):
    zs = list(tse.rglob(f"eleitorado_local_votacao_{ano}.zip"))
    if not zs:
        return False
    with zipfile.ZipFile(zs[0]) as z:
        alvo = next((n for n in z.namelist() if n.endswith("_BRASIL.csv")), None)
        nomes = [alvo] if alvo else [n for n in z.namelist() if n.lower().endswith(".csv")]
        for n in nomes:
            z.extract(n, tmp)
    arq = [str(tmp / n) for n in nomes]
    con.execute(f"""create or replace table loc as select * from (
        select SG_UF uf, CD_MUNICIPIO::int cd_municipio, NR_ZONA::int zona, NR_SECAO::int secao,
          NR_LOCAL_VOTACAO::int nr_local, NM_LOCAL_VOTACAO nm_local, DS_ENDERECO endereco, NM_BAIRRO bairro,
          try_cast(replace(NR_LATITUDE,',','.') as double) lat, try_cast(replace(NR_LONGITUDE,',','.') as double) lon
        from read_csv(?, delim=';', encoding='latin-1', all_varchar=true, union_by_name=true)
        qualify row_number() over (partition by SG_UF, CD_MUNICIPIO, NR_ZONA, NR_SECAO order by NR_TURNO)=1)
        where lat is null or (lat between -34 and 6 and lon between -74 and -32)""", [arq])
    for p in nomes:
        (tmp / p).unlink(missing_ok=True)
    return True


def processar(tse: Path, out: Path, anos, ufs=None):
    out.mkdir(parents=True, exist_ok=True)
    tmp = out / "_tmp"
    tmp.mkdir(exist_ok=True)
    con = duckdb.connect()
    con.execute(f"SET memory_limit='4GB'; SET temp_directory='{tmp}/duck'")
    off = "case " + " ".join(f"when uf='{k}' then {v}" for k, v in OFFSET_MIN.items()) + " else 0 end"
    for ano in anos:
        tem_loc = _locais(con, tse, ano, tmp)
        for turno in ("1t", "2t"):
            zips = sorted(p for p in tse.rglob(f"bweb_{turno}_*.zip") if f"eleicoes{ano}" in str(p) or f"{ano}-boletim" in str(p))
            if ufs:
                zips = [z for z in zips if re.match(rf"bweb_{turno}_({'|'.join(ufs)})_", z.name)]
            if not zips:
                print(f"{ano} {turno}: sem arquivos bweb (ainda não publicado?)")
                continue
            con.execute("drop table if exists b")
            primeiro = True
            for zp in zips:
                csv = _extrai(zp, tmp, r"\.csv$")
                uf = re.match(r"bweb_\dt_([A-Z]{2})_", zp.name).group(1)
                sql = f"""select '{uf}' uf, CD_MUNICIPIO::int cd_municipio, NM_MUNICIPIO nm_municipio, NR_ZONA::int zona, NR_SECAO::int secao,
                    NR_LOCAL_VOTACAO::int nr_local_bu, NR_URNA_EFETIVADA nr_urna, DS_TIPO_URNA tipo_urna,
                    coalesce(try_strptime(DT_ABERTURA,'%d/%m/%Y %H:%M:%S'), try_strptime(DT_ABERTURA,'%Y-%m-%d %H:%M:%S')) abertura, coalesce(try_strptime(DT_ENCERRAMENTO,'%d/%m/%Y %H:%M:%S'), try_strptime(DT_ENCERRAMENTO,'%Y-%m-%d %H:%M:%S')) encerramento,
                    coalesce(try_strptime(DT_EMISSAO_BU,'%d/%m/%Y %H:%M:%S'), try_strptime(DT_EMISSAO_BU,'%Y-%m-%d %H:%M:%S')) emissao_bu, coalesce(try_strptime(DT_BU_RECEBIDO,'%d/%m/%Y %H:%M:%S'), try_strptime(DT_BU_RECEBIDO,'%Y-%m-%d %H:%M:%S')) recebido_tse,
                    QT_APTOS::int aptos, QT_COMPARECIMENTO::int comparecimento, QT_ABSTENCOES::int abstencoes,
                    NR_VOTAVEL::int nr_votavel, NM_VOTAVEL nm_votavel, DS_TIPO_VOTAVEL tipo_votavel, QT_VOTOS::int votos
                  from read_csv('{csv}', delim=';', encoding='latin-1', all_varchar=true, quote='"')
                  where DS_CARGO_PERGUNTA='Presidente'"""
                con.execute(("create table b as " if primeiro else "insert into b ") + sql)
                primeiro = False
                csv.unlink()
            tt = turno
            # formato longo
            con.execute(f"""copy (select {ano} ano, '{tt}' turno, uf, cd_municipio, zona, secao, nr_votavel, nm_votavel, tipo_votavel, votos
                from b where upper(tipo_urna)='APURADA') to '{out}/presidente_votos_{ano}_{tt}.parquet' (format parquet, compression zstd)""")
            # uma linha por seção
            join = "left join loc using (uf, cd_municipio, zona, secao)" if tem_loc else ""
            cols_loc = ", nr_local, nm_local, endereco, bairro, lat, lon" if tem_loc else ""
            con.execute(f"""copy (
                with s as (select uf, cd_municipio, any_value(nm_municipio) nm_municipio, zona, secao, nr_urna,
                    any_value(abertura) abertura, any_value(encerramento) encerramento, any_value(emissao_bu) emissao_bu,
                    any_value(recebido_tse) recebido_tse, any_value(aptos) aptos, any_value(comparecimento) comparecimento,
                    any_value(abstencoes) abstencoes,
                    coalesce(sum(votos) filter (where nr_votavel=13),0)::int votos_13, coalesce(sum(votos) filter (where nr_votavel=22),0)::int votos_22,
                    coalesce(sum(votos) filter (where nr_votavel not in (13,22,95,96)),0)::int votos_outros,
                    coalesce(sum(votos) filter (where nr_votavel=95),0)::int votos_brancos, coalesce(sum(votos) filter (where nr_votavel=96),0)::int votos_nulos
                  from b where upper(tipo_urna)='APURADA' group by uf, cd_municipio, zona, secao, nr_urna)
                select {ano} ano, '{tt}' turno, s.*, s.encerramento + ({off.replace('uf=', 's.uf=')})*interval 1 minute encerramento_brasilia{cols_loc}
                from s {join.replace('using (uf, cd_municipio, zona, secao)', 'using (uf, cd_municipio, zona, secao)')}
              ) to '{out}/presidente_secoes_{ano}_{tt}.parquet' (format parquet, compression zstd)""")
            n = con.execute(f"select count(*) from read_parquet('{out}/presidente_secoes_{ano}_{tt}.parquet')").fetchall()[0][0]
            print(f"{ano} {tt}: {n} seções -> presidente_secoes_{ano}_{tt}.parquet", flush=True)
        con.execute("drop table if exists loc")
    shutil.rmtree(tmp, ignore_errors=True)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--tse", default="dados/tse", help="pasta com os arquivos baixados do TSE")
    p.add_argument("--out", default="docs/dados/parquet")
    p.add_argument("--anos", default="2022,2026")
    p.add_argument("--ufs", default="", help="opcional, ex.: AC,AL (para testes)")
    a = p.parse_args()
    processar(Path(a.tse), Path(a.out), [int(x) for x in a.anos.split(",")], a.ufs.split(",") if a.ufs else None)


if __name__ == "__main__":
    main()
