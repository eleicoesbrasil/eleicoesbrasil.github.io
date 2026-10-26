# Eleições Brasil

Resultados oficiais do TSE por **seção eleitoral**, com código e dados abertos para qualquer pessoa conferir cada número.
Hoje: **2026 · Presidente** (1º e 2º turno, com comparação com 2022). A página de entrada (`docs/index.html`) já traz os
placeholders das outras eleições.

> English summary: official TSE results by polling section (President 2026, with 2022 for comparison), plus scripts to download
> every source file from the TSE open-data portal, rebuild the Parquet files and regenerate the dashboard locally.

## O que tem aqui

| Pasta | Conteúdo |
|---|---|
| `docs/` | Site publicável (GitHub Pages): entrada, painel de 2026 · Presidente e os dados abertos |
| `docs/dados/parquet/` | Presidente por seção, 2022 e 2026 (ver abaixo) |
| `docs/dados/derivados/` | JSON que alimentam os gráficos do painel |
| `scripts/` | `01_baixar_tse.sh`, `02_gerar_parquet.sh`, `03_gerar_site.sh` |
| `pipeline/` | Código Python que lê os arquivos do TSE (boletim de urna, CSVs `bweb`, totais municipais) |
| `site_build/` | Gera os JSON e as páginas HTML |

## Replicar do zero

```bash
./scripts/01_baixar_tse.sh --minimo dados/tse     # ~7 GB, confere sha512 de cada arquivo (--completo traz os arquivos de urna, centenas de GB)
./scripts/02_gerar_parquet.sh dados/tse           # gera docs/dados/parquet/*.parquet
./scripts/03_gerar_site.sh                        # gera docs/dados/derivados e as páginas
```
Requisitos: Linux/macOS (ou WSL), `curl`, `sha512sum`, Python 3.10+ e `uv` (ou `pip install duckdb httpx`).

## Parquet de presidente por seção

* `presidente_secoes_AAAA_Nt.parquet`: uma linha por seção. Comparecimento, abstenções, votos de 13 e 22, outros, brancos e nulos,
  horários da urna (`abertura`, `encerramento`, `emissao_bu`, `recebido_tse`), `encerramento_brasilia` (fuso convertido: Acre +2h;
  Amazonas, Rondônia, Roraima, Mato Grosso e Mato Grosso do Sul +1h) e o local de votação com `lat`/`lon`.
* `presidente_votos_AAAA_Nt.parquet`: formato longo, uma linha por seção e candidato/branco/nulo.

Consulta de exemplo (DuckDB):
```sql
SELECT sum(votos_13) lula, sum(votos_22) flavio FROM 'docs/dados/parquet/presidente_secoes_2026_1t.parquet';
```

## Estado dos dados

* 2022 (1º e 2º turno) e 2026 (1º turno): CSV oficial `bweb` do TSE, 100% das seções.
* **2026, 2º turno: provisório.** O TSE ainda não publicou o CSV de boletim de urna desse turno. O painel usa os totais por município da
  apuração (`totais_municipais_2026_2t.json`) e, para os horários de fechamento, uma amostra aleatória de boletins lidos do portal de
  resultados. Quando o CSV sair, `01_baixar_tse.sh` o baixa sozinho e os scripts regeneram tudo.

## Como conferir

* Cada ZIP é comparado com o `.sha512` publicado pelo TSE.
* Os totais nacionais do 1º turno (Lula 53.879.538; Flávio 56.104.503) e do 2º (Lula 64.256.232; Flávio 59.826.041) devem bater com o TSE.
* A leitura direta dos boletins originais está em `pipeline/eleicoes_pipeline/urnas_parse.py`. O projeto
  [DataUrnas-BR](https://github.com/alissonlinneker/DataUrnas-BR) decodifica os mesmos boletins por outro código, para conferência cruzada.

## Licenças

Código: MIT (`LICENSE`). Dados: Tribunal Superior Eleitoral, Creative Commons Atribuição (CC BY); ver `DADOS.md`.
