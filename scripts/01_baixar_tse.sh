#!/usr/bin/env bash
# Baixa os dados abertos do TSE necessários para reproduzir este repositório.
#
#   ./scripts/01_baixar_tse.sh [--minimo|--completo] [DESTINO]
#
#   --minimo   (padrão, ~7 GB)   boletim de urna em CSV (bweb), locais de votação, votação por seção e detalhe de 2022/2026.
#   --completo (~300 GB)         além do mínimo, os pacotes de arquivos de urna (bu, rdv, log, vscmr, imgbu) por UF.
#
# Os links são lidos da API pública do portal de dados abertos (CKAN), então o script pega sozinho
# os arquivos do 2º turno de 2026 quando o TSE publicar. Cada arquivo é conferido com o .sha512 do TSE.
# O download é sequencial, com pausa e retomada (curl -C -), para não sobrecarregar o servidor do TSE.
set -euo pipefail

MODO="minimo"; DEST="dados/tse"
for a in "$@"; do case "$a" in --minimo) MODO=minimo;; --completo) MODO=completo;; *) DEST="$a";; esac; done
PAUSA="${PAUSA:-2}"            # segundos entre arquivos
CKAN="https://dadosabertos.tse.jus.br/api/3/action/package_show?id="
UA="Mozilla/5.0 (eleicoes-brasil-secoes)"

DATASETS=(resultados-2022-boletim-de-urna resultados-2026-boletim-de-urna resultados-2022 resultados-2026)
[ "$MODO" = "completo" ] && DATASETS+=(resultados-2022-arquivos-transmitidos-para-totalizacao resultados-2026-arquivos-transmitidos-para-totalizacao)

# No modo mínimo, dos datasets "resultados-AAAA" só interessam votação por seção, detalhe por seção e locais de votação.
filtra() {
  if [ "$MODO" = "minimo" ]; then grep -E 'buweb/bweb_|votacao_secao/|detalhe_votacao_secao/|eleitorado_locais_votacao/'; else cat; fi
}

mkdir -p "$DEST"
LISTA="$DEST/_lista_urls.txt"; : > "$LISTA"
for ds in "${DATASETS[@]}"; do
  curl -fsS -A "$UA" "$CKAN$ds" | grep -oE 'https://cdn\.tse\.jus\.br/[^"\\]+\.(zip|sha512)' | sort -u | filtra >> "$LISTA" || true
done
# arquivos de locais de votação (coordenadas), que ficam fora dos datasets acima
for ano in 2022 2026; do echo "https://cdn.tse.jus.br/estatistica/sead/odsele/eleitorado_locais_votacao/eleitorado_local_votacao_${ano}.zip" >> "$LISTA"; done
sort -u "$LISTA" -o "$LISTA"
echo "$(grep -c '\.zip$' "$LISTA") arquivos .zip na lista ($MODO). Destino: $DEST"

while read -r url; do
  [[ "$url" == *.sha512 ]] && continue
  nome="${url##*/}"; sub=$(echo "$url" | sed -E 's#https://cdn\.tse\.jus\.br/estatistica/sead/##; s#/[^/]+$##' | tr '/' '_')
  mkdir -p "$DEST/$sub"; alvo="$DEST/$sub/$nome"
  if [ -f "$alvo" ] && [ ! -f "$alvo.part" ]; then echo "ok (já existe) $nome"; continue; fi
  echo "baixando $nome"
  curl -fL -A "$UA" -C - --retry 5 --retry-delay 10 -o "$alvo.part" "$url" && mv "$alvo.part" "$alvo"
  # confere o hash quando o TSE publica
  if curl -fsS -A "$UA" -o "$alvo.sha512" "$url.sha512" 2>/dev/null; then
    esperado=$(awk '{print tolower($1)}' "$alvo.sha512" | head -1)
    obtido=$(sha512sum "$alvo" | awk '{print $1}')
    [ "$esperado" = "$obtido" ] && echo "   sha512 OK" || { echo "   SHA512 DIVERGENTE em $nome" >&2; mv "$alvo" "$alvo.divergente"; }
  fi
  sleep "$PAUSA"
done < <(sort -u "$LISTA")
echo "Concluído. Próximo passo: ./scripts/02_gerar_parquet.sh $DEST"
