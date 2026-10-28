"""Teste da aba Relações: r exibido == relacoes.json == recálculo independente (numpy); modo livre recalcula no navegador;
capturas de tela e ausência de rolagem horizontal.

Uso: uv run --with playwright --with numpy python site_build/tests/test_relacoes.py [--docs docs] [--shots pasta]
"""
import argparse, functools, glob, http.server, json, os, re, socketserver, sys, threading
import numpy as np
from playwright.sync_api import sync_playwright


def num(txt):
    m = re.search(r"([+−-]\d+[.,]\d+)", txt)
    return float(m.group(1).replace("−", "-").replace(",", ".")) if m else None


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--docs", default=os.path.join(os.path.dirname(__file__), "..", "..", "docs"))
    ap.add_argument("--shots", default=None); a = ap.parse_args(); docs = os.path.abspath(a.docs)
    rel = json.load(open(f"{docs}/dados/relacoes.json")); mun = json.load(open(f"{docs}/dados/ext/municipios.json"))
    H = functools.partial(http.server.SimpleHTTPRequestHandler, directory=docs); H.log_message = lambda *x, **k: None
    srv = socketserver.TCPServer(("127.0.0.1", 0), H); port = srv.server_address[1]; threading.Thread(target=srv.serve_forever, daemon=True).start()
    exe = (glob.glob(os.path.expanduser("~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome")) or [None])[0]
    erros = []; falhas = []
    cols = {}
    for k, c in mun["cols"].items():
        try: cols[k] = np.array([np.nan if v is None else v for v in c], float)
        except (ValueError, TypeError): pass   # colunas de texto (categóricas)
    def r_ind(x, y):
        m = np.isfinite(cols[x]) & np.isfinite(cols[y]); return float(np.corrcoef(cols[x][m], cols[y][m])[0, 1])
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=exe, args=["--no-sandbox"])
        for (w, h) in ((390, 844), (1280, 800)):
            pg = b.new_page(viewport={"width": w, "height": h}, is_mobile=w < 700, has_touch=w < 700)
            pg.on("pageerror", lambda e: erros.append(str(e)))
            pg.goto(f"http://127.0.0.1:{port}/2026/presidente/index.html"); pg.wait_for_timeout(1200)
            pg.click("#t-relacoes")
            pg.wait_for_function("document.querySelector('#rel-root').dataset.ready", timeout=30000); pg.wait_for_timeout(1000)
            for sc, label in (("2026", "2026"), ("2022", "2022"), ("d2622", "2026 vs 2022")):
                pg.click(f'#rel-root .rel-seg button[data-sc="{sc}"]'); pg.wait_for_timeout(600)
                cards = pg.query_selector_all("#rel-list .rel-card")
                esperado = rel["escopos"][sc]
                if len(cards) != len(esperado): falhas.append(f"{w}px {sc}: {len(cards)} cartões != {len(esperado)}")
                e = esperado[0]; c = cards[0]
                shown = num(c.query_selector(".rel-dl dd").text_content())
                if abs(shown - round(e["pearson"], 2)) > 0.0051: falhas.append(f"{w}px {sc}: r exibido {shown} != json {e['pearson']}")
                ri = r_ind(e["preditor"], e["alvo"])
                if abs(ri - e["pearson"]) > 1e-3: falhas.append(f"{w}px {sc}: r json {e['pearson']} != recálculo {ri:.4f}")
                if not c.query_selector("canvas").evaluate("c=>c.width>0&&c.height>0"): falhas.append(f"{w}px {sc}: canvas vazio")
                if len({x["preditor"] for x in esperado}) != len(esperado): falhas.append(f"{sc}: preditor repetido")
            # modo livre: escolhe o mesmo par do 1º destaque de 2022 e confere r calculado no navegador
            e = rel["escopos"]["2022"][0]
            pg.select_option("#rel-x", e["preditor"]); pg.select_option("#rel-y", e["alvo"]); pg.wait_for_timeout(500)
            rfree = num(pg.query_selector("#rel-free-card .rel-dl dd").text_content())
            if abs(rfree - round(r_ind(e["preditor"], e["alvo"]), 2)) > 0.0051: falhas.append(f"{w}px livre: r {rfree} != recálculo")
            # toque num ponto mostra município
            cv = pg.query_selector("#rel-free-card canvas"); cv.scroll_into_view_if_needed(); pg.wait_for_timeout(200); bx = cv.bounding_box()
            hint = ""
            for fx in (0.3, 0.5, 0.7):
                for fy in (0.3, 0.5, 0.7):
                    pg.mouse.move(bx["x"] + bx["width"] * fx, bx["y"] + bx["height"] * fy); pg.wait_for_timeout(60)
                    hint = pg.inner_text("#rel-free-card .rel-hint")
                    if "(" in hint and "·" in hint: break
                if "(" in hint and "·" in hint: break
            if "·" not in hint: falhas.append(f"{w}px: dica de município não apareceu ({hint!r})")
            if pg.evaluate("document.documentElement.scrollWidth>document.documentElement.clientWidth+1"): falhas.append(f"{w}px: rolagem horizontal")
            if a.shots:
                os.makedirs(a.shots, exist_ok=True); pg.query_selector("#rel-root").scroll_into_view_if_needed()
                pg.screenshot(path=f"{a.shots}/relacoes_{w}.png", full_page=False)
            pg.close()
        b.close()
    for e in erros: falhas.append("erro JS: " + e)
    if falhas:
        print("FALHOU:"); [print("  -", f) for f in falhas]; sys.exit(1)
    print("OK: aba Relações confere (r exibido = json = recálculo; modo livre; dica; sem rolagem horizontal)")


if __name__ == "__main__":
    main()
