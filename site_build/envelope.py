"""Envolve o fragmento do painel (sem <html>/<head>) num documento completo, com viewport para celular."""
RESET = ('<style>html{-webkit-text-size-adjust:100%;text-size-adjust:100%}body{margin:0}img,svg,canvas{max-width:100%}'
         '[hidden]{display:none!important}</style>')


def envolver(frag: str) -> str:
    if frag.lstrip().lower().startswith('<!doctype'):
        return frag
    head = ('<!doctype html>\n<html lang="pt-BR"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' + RESET + '\n')
    i = frag.find('<main>')
    if i < 0:
        return head + '</head><body>' + frag + '</body></html>'
    return head + frag[:i] + '</head><body>\n' + frag[i:] + '\n</body></html>\n'
