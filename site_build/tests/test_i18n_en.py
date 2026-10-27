"""Teste do modo inglês: abre cada aba com a página em EN e procura texto visível ainda em português.

Uso: uv run --with playwright python site_build/tests/test_i18n_en.py [--docs docs] [--viewport 390x844] [--verbose]
  --docs   pasta servida (precisa conter 2026/presidente/index.html e dados/); padrão: docs do repositório
Sai com código 1 se houver texto em português visível (ou erro de JS) em modo EN.
Heurística: um texto é "português" se tiver palavra-chave portuguesa (seção, votos, para, de/da/do...) ou caractere acentuado
fora da lista de nomes próprios (ALLOW). Ajuste ALLOW/PT_WORDS ao incluir novos nomes.
"""
import argparse, functools, glob, http.server, os, re, socketserver, sys, threading
from playwright.sync_api import sync_playwright

TABS = ["fluxo", "abstencao", "fechamento", "mapa", "secoes", "replicar"]
# nomes próprios e termos que ficam iguais nos dois idiomas
ALLOW = re.compile(r"(Flávio|Bolsonaro|Lula|Brasília|Eleições Brasil|São Paulo|Pará|Paraná|Amapá|Ceará|Piauí|Maranhão|Goiás|Rondônia|Paraíba|Espírito Santo|"
                   r"Mato Grosso|Amazônia|Tocantins|Distrito Federal|Zanin|Bahia|Pernambuco|Alagoas|Sergipe|Acre|Roraima|Rio Grande|Minas Gerais|Santa Catarina|"
                   r"Centro-Oeste|Nordeste|Sudeste|Norte|Sul|Pearson|Spearman|TSE|BU|CSV|Parquet|DuckDB|GitHub|Python|Português|©)", re.I)
PT_WORDS = re.compile(r"\b(seção|seções|votos|voto|eleitores|eleitor|abstenção|município|municípios|estado|estados|região|turno|urnas?|fechadas?|"
                      r"para|com|sem|dos|das|uma|não|até|após|depois|mais|menos|dados|escolha|toque|selecione|carregando|variação|média|mediana|"
                      r"faixa|faixas|ordenar|colunas|mostrar|fechar|aplicar|copiar|baixar|aptos|brancos|nulos|válidos|comparecimento|resultado|horário|"
                      r"pontos|percentuais|primeiro|segundo|terceiro|quartil|amostra|tamanho|atraso|mapa|candidato)\b", re.I)
ACCENT = re.compile(r"[ãõçáéíóúâêôà]", re.I)

JS = r"""() => {
  const out = new Set();
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && (r.width > 0 || r.height > 0) && !el.closest('[hidden]'); };
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n; while ((n = w.nextNode())) { const t = n.nodeValue.replace(/\s+/g, ' ').trim(); if (!t) continue;
    const p = n.parentElement; if (!p || ['SCRIPT','STYLE','NOSCRIPT'].includes(p.tagName) || p.closest('pre,code')) continue;
    if (p.tagName === 'OPTION' || p.tagName === 'OPTGROUP') { const sel = p.closest('select'); if (!sel || !vis(sel)) continue; }
    else if (!vis(p)) continue;
    out.add(t); }
  document.querySelectorAll('[aria-label],[placeholder],[title]').forEach(el => { if (!vis(el) || el.closest('pre,code')) return;
    ['aria-label','placeholder','title'].forEach(a => { const v = el.getAttribute(a); if (v) out.add('[' + a + '] ' + v); }); });
  document.querySelectorAll('select').forEach(s => { if (!vis(s)) return; s.querySelectorAll('optgroup').forEach(g => out.add(g.label)); });
  return [...out];
}"""


def suspeito(t):
    base = ALLOW.sub(" ", t)
    return bool(PT_WORDS.search(base) or ACCENT.search(base))


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--docs", default=os.path.join(os.path.dirname(__file__), "..", "..", "docs"))
    ap.add_argument("--viewport", default="390x844"); ap.add_argument("--verbose", action="store_true"); a = ap.parse_args()
    docs = os.path.abspath(a.docs); w, h = map(int, a.viewport.split("x"))
    H = functools.partial(http.server.SimpleHTTPRequestHandler, directory=docs)
    H.log_message = lambda *args, **kw: None
    srv = socketserver.TCPServer(("127.0.0.1", 0), H); port = srv.server_address[1]; threading.Thread(target=srv.serve_forever, daemon=True).start()
    exe = (glob.glob(os.path.expanduser("~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome")) or [None])[0]
    bad = {}; errs = []
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=exe, args=["--no-sandbox"])
        pg = b.new_page(viewport={"width": w, "height": h}, is_mobile=w < 700, has_touch=w < 700)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        url = f"http://127.0.0.1:{port}/2026/presidente/index.html"
        pg.goto(url); pg.wait_for_timeout(1500)
        en = pg.query_selector("#lg-en")
        if not en: print("sem botão #lg-en"); sys.exit(2)
        en.click(); pg.wait_for_timeout(1000)
        for tab in TABS:
            pg.click(f"#t-{tab}"); pg.wait_for_timeout(1200)
            if tab == "abstencao":   # carrega a seção de correlação (carga sob demanda) e passa pelos dois modos
                pg.query_selector("#ac-sec").scroll_into_view_if_needed(); pg.wait_for_timeout(2500)
            if tab == "fechamento":
                pg.query_selector("#cb-sec").scroll_into_view_if_needed(); pg.wait_for_timeout(2500)
            texts = pg.evaluate(JS)
            if tab == "abstencao":
                pg.click("#ac-m-s"); pg.wait_for_timeout(800); texts += pg.evaluate(JS)
            for t in set(texts):
                if suspeito(t): bad.setdefault(tab, set()).add(t)
            if a.verbose: print(f"{tab}: {len(set(texts))} textos verificados")
        b.close()
    n = sum(len(v) for v in bad.values())
    for tab, ts in bad.items():
        print(f"\n== {tab}: {len(ts)} texto(s) possivelmente em português")
        for t in sorted(ts): print("  ·", t[:int(os.environ.get("MAXLEN","160"))])
    real = [e for e in errs if "404" not in e]
    if real: print("\nerros de JS:", real)
    print(f"\n{'FALHOU' if (n or real) else 'OK'}: {n} texto(s) suspeito(s) em modo EN")
    sys.exit(1 if (n or real) else 0)


if __name__ == "__main__":
    main()
