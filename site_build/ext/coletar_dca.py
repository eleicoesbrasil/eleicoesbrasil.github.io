"""Coleta a DCA municipal (SICONFI/Tesouro) via API aberta: uma chamada por (município, ano).

Guarda só os anexos I-C (receita), I-D (despesa por categoria) e I-E (despesa por função), em JSON Lines comprimido por ano:
  <dest>/orcamento/siconfi/dca_<ano>.jsonl.gz  (campos: id,ano,anexo,col,conta,v,pop)   e  _feito_<ano>.txt (retomada).
Uso: python coletar_dca.py [--anos 2022 2023 2024 2025] [--dest /mnt/e/EleicoesBrasil_externos] [--conc 4]
Educado com o servidor: poucas conexões, pausa entre chamadas, recuo em 429/5xx. Pode ser interrompido e retomado.
"""
import argparse, asyncio, gzip, json, os, random, time
import httpx

API = "https://apidatalake.tesouro.gov.br/ords/siconfi/tt/dca"
ANEXOS = {"DCA-Anexo I-C": "C", "DCA-Anexo I-D": "D", "DCA-Anexo I-E": "E"}
LOC = "/mnt/e/EleicoesBrasil_externos/ibge/localidades/municipios_nivelado.json"


async def um(c, sem, ano, ide, out, feito, ff, st):
    async with sem:
        for tent in range(6):
            try:
                r = await c.get(API, params={"an_exercicio": ano, "id_ente": ide})
                if r.status_code == 429: await asyncio.sleep(60 + random.random() * 30); continue
                if r.status_code >= 500: await asyncio.sleep(5 * (tent + 1)); continue
                if r.status_code != 200: st["http"][r.status_code] = st["http"].get(r.status_code, 0) + 1; break
                it = r.json().get("items", [])
                for x in it:
                    a = ANEXOS.get(x.get("anexo"))
                    if a: out.write((json.dumps({"id": ide, "ano": ano, "anexo": a, "col": x["coluna"], "conta": x["cod_conta"], "v": x["valor"], "pop": x.get("populacao")}, ensure_ascii=False, separators=(",", ":")) + "\n").encode())
                ff.write(f"{ide}\t{len(it)}\n"); ff.flush(); st["ok"] += 1; break
            except Exception as e:
                await asyncio.sleep(3 * (tent + 1)); st["err"] = st.get("err", 0) + 1
        await asyncio.sleep(0.15)


async def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--anos", nargs="+", type=int, default=[2022, 2023, 2024, 2025])
    ap.add_argument("--dest", default="/mnt/e/EleicoesBrasil_externos"); ap.add_argument("--conc", type=int, default=4); a = ap.parse_args()
    ids = sorted({int(m["municipio-id"]) for m in json.load(open(LOC, encoding="utf-8"))})
    d = os.path.join(a.dest, "orcamento", "siconfi"); os.makedirs(d, exist_ok=True)
    async with httpx.AsyncClient(headers={"User-Agent": "Mozilla/5.0 (compatible; eleicoesbrasil-dados/1.0)"}, timeout=90, follow_redirects=True) as c:
        for ano in a.anos:
            fp = os.path.join(d, f"_feito_{ano}.txt"); feito = set(l.split("\t")[0] for l in open(fp)) if os.path.exists(fp) else set()
            falta = [i for i in ids if str(i) not in feito]
            print(time.strftime("%H:%M:%S"), ano, "faltam", len(falta), flush=True)
            if not falta: continue
            st = {"ok": 0, "http": {}}; sem = asyncio.Semaphore(a.conc)
            with gzip.open(os.path.join(d, f"dca_{ano}.jsonl.gz"), "ab") as out, open(fp, "a") as ff:
                lote = 200
                for i in range(0, len(falta), lote):
                    await asyncio.gather(*[um(c, sem, ano, ide, out, feito, ff, st) for ide in falta[i:i + lote]]); out.flush()
                    print(time.strftime("%H:%M:%S"), ano, f"{min(i + lote, len(falta))}/{len(falta)}", st, flush=True)
    print("concluído", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
