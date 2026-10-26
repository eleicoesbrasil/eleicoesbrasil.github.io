# Origem e licença dos dados

Todos os dados de votação vêm do **Tribunal Superior Eleitoral (TSE)**, portal de dados abertos
(<https://dadosabertos.tse.jus.br>), publicados sob licença Creative Commons Atribuição (CC BY).

* Boletim de urna em CSV (`bweb`): conjuntos "Resultados 2022/2026 - Boletim de Urna".
* Locais de votação com coordenadas: `eleitorado_local_votacao_AAAA.zip`.
* Totais por município do 2º turno de 2026: portal de resultados, `resultados.tse.jus.br/oficial/ele2026/6258/dados/`.
* Malha das UFs: IBGE (servicodados.ibge.gov.br, malhas).

Os arquivos em `docs/dados/` são derivados desses dados (recortes, agregações e conversão de formato). Cite o TSE como fonte original.
