#!/usr/bin/env bash
# Converte os CSVs do TSE baixados em Parquet de presidente por seção (2022 e 2026, 1º e 2º turno).
#   ./scripts/02_gerar_parquet.sh [PASTA_DOS_DADOS_TSE]      (padrão: dados/tse)
set -euo pipefail
cd "$(dirname "$0")/.."
TSE="${1:-dados/tse}"
if command -v uv >/dev/null; then PY=(uv run --no-project --with duckdb --with httpx python); else PY=(python3); fi
PYTHONPATH=pipeline "${PY[@]}" -m eleicoes_pipeline.gerar_secoes --tse "$TSE" --out docs/dados/parquet
echo "Parquet em docs/dados/parquet. Próximo passo: ./scripts/03_gerar_site.sh"
