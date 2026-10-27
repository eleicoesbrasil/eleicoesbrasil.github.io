# Correções de tradução EN para textos montados dinamicamente (frases com números) e atributos aria-label.
# PAIRS_EXTRA: trechos longos (aplicados antes das trocas de palavras curtas); RX_EXTRA: regras com número (aplicadas primeiro).
PAIRS_EXTRA = [
 (' apuradas), mas os dados por seção (como horário de fechamento e abstenção seção a seção) vêm de uma amostra aleatória do 2º turno, que cresce a cada atualização. Os dados por seção do 1º turno de 2026 e de 2022 vêm do CSV oficial do TSE e são incluídos aos poucos.',
  ' counted), but the section-level data (such as closing time and section-by-section abstention) come from a random sample of the 2nd round, which grows with each update. Section-level data for the 2026 1st round and for 2022 come from the official TSE CSV and are being added gradually.'),
 ('apuração fechada', 'count closed'),
 ('Cada linha mostra os votos válidos acumulados do candidato, como porcentagem do total de votos válidos, conforme o horário em que a urna fechou (minutos a partir das 17h de Brasília).',
  "Each line shows the candidate's cumulative valid votes as a percentage of all valid votes, by the time the ballot box closed (minutes after 17:00 Brasília time)."),
 ('Toque e arraste sobre o gráfico para ver os valores exatos.', 'Touch and drag on the chart to see the exact values.'),
 ('Os valores são os dos boletins lidos, sem estimativa.', 'The values are those of the ballot reports read, with no estimates.'),
 ('minutos em relação às 17h de Brasília (0 = horário previsto de fechamento)', 'minutes relative to 17:00 Brasília time (0 = scheduled closing time)'),
 ('ou mais novo', 'or newer'),
 ('endereço do repositório', 'repository URL'),
]
RX_EXTRA = [
 (r'([\d.,]+) locais \(([\d.,]+) seções\) ficaram de fora por falta de coordenada válida\.', '', r'$1 polling places ($2 sections) were left out for lack of valid coordinates.'),
]
EX_EXTRA = {
 'Modo': 'Mode', 'Anterior': 'Previous', 'Próximo': 'Next',
 'Violinos da variável escolhida por faixa de variação da abstenção': 'Violins of the chosen variable by abstention-change bracket',
 'Dispersão por seção': 'Scatter plot by section',
 'Correlação de cada variável com a variável do eixo X': 'Correlation of each variable with the X-axis variable',
 '−1 minuto': '−1 minute', '+1 minuto': '+1 minute', 'Velocidade': 'Speed',
 'Minutos após o horário previsto': 'Minutes after the scheduled time',
 'Resultado das urnas selecionadas por horário de fechamento': 'Result of the selected ballot boxes by closing time',
 'Parcela acumulada de cada candidato por minuto de fechamento': 'Cumulative share of each candidate by closing minute',
}
