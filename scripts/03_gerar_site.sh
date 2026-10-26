#!/usr/bin/env bash
# Gera os dados do painel (docs/dados/derivados) e as páginas (docs/index.html e docs/2026/presidente/index.html).
set -euo pipefail
cd "$(dirname "$0")/.."
if command -v uv >/dev/null; then PY=(uv run --no-project --with duckdb --with httpx python); else PY=(python3); fi
mkdir -p docs/dados/geo docs/dados/derivados
[ -f docs/dados/geo/uf.json ] || curl -fsSL "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?intrarregiao=UF&qualidade=minima&formato=application/vnd.geo+json" -o docs/dados/geo/uf.json
# 2º turno de 2026 ainda sem CSV por seção? usa os totais por município da apuração
if [ ! -f docs/dados/parquet/presidente_secoes_2026_2t.parquet ]; then
  PYTHONPATH=pipeline "${PY[@]}" -m eleicoes_pipeline.totais_municipais docs/dados/derivados/totais_municipais_2026_2t.json
fi
"${PY[@]}" site_build/gerar_dados_site.py docs/dados/parquet docs/dados/derivados
"${PY[@]}" site_build/montar_site.py docs/dados/derivados docs/dados/geo docs/2026/presidente/index.html
"${PY[@]}" site_build/montar_entrada.py docs
echo "Site gerado em docs/. Abra docs/index.html no navegador."
