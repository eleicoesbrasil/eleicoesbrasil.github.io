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
            ordem = pg.evaluate("[...document.querySelectorAll('nav.tabs button')].map(b=>b.id)")
            if ordem.index("t-relacoes") != ordem.index("t-fechamento") + 1: falhas.append(f"{w}px: Relações não vem logo depois de Fechamento: {ordem}")
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
            # escala log (1º destaque de 2026: PIB per capita, todos > 0) e recorte por região
            pg.click('#rel-root .rel-seg button[data-sc="2026"]'); pg.wait_for_timeout(300)
            e26 = rel["escopos"]["2026"][0]; card0 = pg.locator("#rel-list .rel-card").first
            xs = cols[e26["preditor"]]; ys = cols[e26["alvo"]]; mm = np.isfinite(xs) & np.isfinite(ys) & (xs > 0)
            r_log = float(np.corrcoef(np.log(xs[mm]), ys[mm])[0, 1])
            card0.locator('button[data-act=log]').click(); pg.wait_for_timeout(300)
            r_shown = num(pg.locator("#rel-list .rel-card").first.locator(".rel-dl dd").first.text_content())
            if r_shown is None or abs(r_shown - round(r_log, 2)) > 0.0051: falhas.append(f"{w}px: r em log exibido {r_shown} != {r_log:.3f}")
            if "log" not in pg.locator("#rel-list .rel-card").first.inner_text().lower(): falhas.append(f"{w}px: texto de escala log ausente")
            pg.locator("#rel-list .rel-card").first.locator('button[data-act=log]').click(); pg.wait_for_timeout(300)
            reg = np.array(mun["reg"]); mr = np.isfinite(xs) & np.isfinite(ys) & (reg == "Sul")
            r_sul = float(np.corrcoef(xs[mr], ys[mr])[0, 1])
            pg.select_option("#rel-reg", "Sul"); pg.wait_for_timeout(500)
            r_shown = num(pg.locator("#rel-list .rel-card").first.locator(".rel-dl dd").first.text_content())
            if r_shown is None or abs(r_shown - round(r_sul, 2)) > 0.0051: falhas.append(f"{w}px: r da região Sul exibido {r_shown} != {r_sul:.3f}")
            if "Sul" not in pg.locator("#rel-list .rel-card").first.inner_text(): falhas.append(f"{w}px: selo/frase da região ausente")
            pg.select_option("#rel-reg", ""); pg.wait_for_timeout(500)
            r_shown = num(pg.locator("#rel-list .rel-card").first.locator(".rel-dl dd").first.text_content())
            if abs(r_shown - round(e26["pearson"], 2)) > 0.0051: falhas.append(f"{w}px: r não voltou ao padrão")
            # modo livre: escolhe o mesmo par do 1º destaque de 2022 e confere r calculado no navegador
            e = rel["escopos"]["2022"][0]
            for w_, key in (("x", e["preditor"]), ("y", e["alvo"])):
                pg.click(f"#rel-{w_}"); pg.fill(f"#rel-{w_}", key); pg.click(f'#rel-{w_}-list [data-k="{key}"]'); pg.wait_for_timeout(250)
            # busca sem acento e por texto: "populacao" deve achar opções
            pg.click("#rel-x"); pg.fill("#rel-x", "populacao")
            if pg.locator("#rel-x-list [role=option]").count() == 0: falhas.append(f"{w}px: busca 'populacao' sem resultados")
            pg.fill("#rel-x", "zzzzqq")
            if pg.locator("#rel-x-list [role=option]").count() != 0: falhas.append(f"{w}px: busca inexistente devolveu opções")
            pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
            if pg.input_value("#rel-x") == "zzzzqq": falhas.append(f"{w}px: Esc não restaurou o rótulo")
            rfree = num(pg.query_selector("#rel-free-card .rel-dl dd").text_content())
            if abs(rfree - round(r_ind(e["preditor"], e["alvo"]), 2)) > 0.0051: falhas.append(f"{w}px livre: r {rfree} != recálculo")
            # legenda das regiões repetida na área livre; largura variável sem mudar a altura; atalho quadrado; download de SVG
            if pg.locator("#rel-free-leg span").count() != 5: falhas.append(f"{w}px: legenda das regiões ausente na área livre")
            box = pg.locator("#rel-free-card .rel-plot"); cvh = pg.locator("#rel-free-card canvas")
            avail = pg.evaluate("document.querySelector('#rel-free-card .rel-card').clientWidth - 28")
            h0 = cvh.evaluate("c=>c.clientHeight"); w100 = box.evaluate("b=>b.clientWidth")
            pg.evaluate("(()=>{const r=document.getElementById('rel-w');r.value=50;r.dispatchEvent(new Event('input',{bubbles:true}));})()"); pg.wait_for_timeout(200)
            w50 = box.evaluate("b=>b.clientWidth"); h50 = cvh.evaluate("c=>c.clientHeight")
            if not (0.4 * w100 < w50 < 0.6 * w100): falhas.append(f"{w}px: largura 50% = {w50} (100% = {w100})")
            if h50 != h0: falhas.append(f"{w}px: altura mudou {h0} -> {h50}")
            pg.click("#rel-sq"); pg.wait_for_timeout(200)
            wsq = box.evaluate("b=>b.clientWidth"); hsq = cvh.evaluate("c=>c.clientHeight")
            if wsq != min(314, avail) or hsq != h0: falhas.append(f"{w}px: quadrado largura {wsq} (esperado {min(314, avail)}), altura {hsq}")
            if avail >= 314:   # área de plot (sem margens): pw = w - L - 10, ph = h - 50, com L = 54 para w<420
                if wsq - 54 - 10 != hsq - 8 - 42: falhas.append(f"{w}px: área de plot não quadrada")
            with pg.expect_download() as dl: pg.click("#rel-free-card button[data-act=svg]")
            svg = open(dl.value.path(), encoding="utf-8").read()
            if not svg.startswith("<svg") or svg.count("<circle") < 500 or "<line" not in svg: falhas.append(f"{w}px: SVG inválido ({len(svg)} bytes)")
            if "var(--" in svg: falhas.append(f"{w}px: SVG com variáveis CSS não resolvidas")
            with pg.expect_download() as dl2: pg.click("#rel-list .rel-card:first-child button[data-act=svg]")
            if not open(dl2.value.path(), encoding="utf-8").read().startswith("<svg"): falhas.append(f"{w}px: SVG do destaque inválido")
            pg.click("#rel-sq")   # desliga o quadrado
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
