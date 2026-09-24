# Jiga Ruído Motor — Olsen

Pipeline de análise dos ensaios da jiga de motores (Bosch) para classificar
motores com base em corrente, tensão, potência, vibração (IMU) e áudio
capturado durante o teste (dois microfones).

## Fonte de dados

Planilha Google Sheets publicada, aba **DADOS**:

https://docs.google.com/spreadsheets/d/e/2PACX-1vQ1FV5aTG7GK9MAZyC-gswZ30Hi8E2WLaYRHLtUZQdsXi36iobdmBuC10pJ4a8Ckf8oUa0mboZn5zcc/pub?gid=335307542&single=true&output=csv


Cada linha é uma leitura (1x por segundo) dentro de um `ensaio`. Um `ensaio`
varre diferentes `frequencia_hz` de chaveamento do motor.

### Dicionário de colunas (a partir do firmware V0.02)

| Coluna | Descrição |
|---|---|
| `timestamp` | Data/hora da leitura |
| `firmware` | Versão do firmware da jiga |
| `ensaio` | Identificador do teste (mesmo motor = mesmo número) |
| `frequencia_hz` | Frequência de chaveamento aplicada |
| `segundo` | Segundo decorrido dentro do ensaio |
| `tensao_v`, `corrente_a`, `potencia_w` | Grandezas elétricas medidas |
| `accel_x/y/z_g`, `accel_resultante_g` | Vibração (IMU), os 3 eixos e a resultante |
| `gyro_x/y/z_dps` | Giroscópio (IMU) |
| `audio1_dbfs`, `audio1_peak_dbfs` | Microfone 1 — nível médio e pico, em dBFS |
| `audio2_dbfs`, `audio2_peak_dbfs` | Microfone 2 — nível médio e pico, em dBFS |

> Colunas antigas removidas no V0.02: `duty_percent`, `audio_rms`,
> `audio_peak`, `audio_freq_hz`, `wifi_rssi`, `acs_ok`, `mpu_ok`, `audio_ok`
> (o firmware não envia mais flags de saúde de sensor por leitura).

## Pipeline

```bash
pip install -r requirements.txt

# 1. Baixa os dados publicados
python scripts/fetch_sheet.py

# 2. Constrói a "assinatura" de cada ensaio por frequência
python scripts/features.py

# 3. Constrói a referência a partir de ensaios CONFIRMADOS como motor bom
#    (troque os números pelos ensaios reais já validados)
python scripts/baseline.py --good 1 2 3

# 4. Classifica todos os ensaios contra a referência
python scripts/classify.py
```

Isso gera em `data/`:
- `raw_ensaios.csv` — snapshot da planilha
- `features_por_ponto.csv` — média/desvio/pico por (ensaio, frequência)
- `features_por_ensaio.csv` — resumo geral por ensaio
- `baseline.json` — referência de motor saudável por frequência
- `classificacao.csv` — status final: `OK`, `ATENCAO` ou `FALHA_PROVAVEL`

## Como funciona a classificação

Sem rótulos de falha confirmados ainda, a abordagem inicial é baseada em
desvio estatístico:

1. `baseline.py` usa um conjunto de ensaios que você já sabe serem de
   motores bons para calcular média/desvio-padrão de corrente, potência,
   vibração e áudio (dos dois microfones) em cada frequência testada.
2. `classify.py` calcula o z-score de cada ensaio novo contra essa
   referência, frequência a frequência, e resume em um status.
3. `Z_THRESHOLD` e `FALHA_FRACAO` no topo de `classify.py` são os únicos
   parâmetros a ajustar — comece rodando `classify.py` nos próprios ensaios
   usados no baseline para calibrar o threshold antes de usar em motores
   desconhecidos.

Conforme forem surgindo motores com falha **confirmada** (desmontados ou
inspecionados), vale considerar migrar para um classificador supervisionado
(Random Forest, por exemplo) treinado em `features_por_ensaio.csv` +
`features_por_ponto.csv`, usando esse método estatístico como gerador de
rótulos iniciais.

## Dashboard

`dashboard/index.html` (Chart.js + PapaParse) busca os dados direto da
planilha publicada (não depende de `data/raw_ensaios.csv` estar commitado)
e tem 3 abas:

- **Ensaio individual**: classificação, comparação entre frequências (todos
  os pontos coletados, uma linha por frequência) e detalhamento por
  frequência, para as 11 grandezas monitoradas (elétricas, 3 eixos de
  vibração + resultante, 2 microfones).
- **Comparar ensaios**: escolhe quais ensaios comparar, um bloco por
  frequência com uma linha por ensaio.
- **Correlações**: dispersão entre pares de grandezas (ex: corrente ×
  vibração, os dois microfones entre si), colorido por ensaio.

A classificação (`data/classificacao.csv`) continua vindo de um arquivo do
repositório, gerado localmente pelo pipeline Python.

## Próximos ajustes a validar com você

- Confirmar quais `ensaio`s já são motores conhecidos-bons para o baseline.
- Calibrar `Z_THRESHOLD` observando a distribuição real dos ensaios bons.
- Definir se algum tipo de filtro de qualidade de leitura (agora que não há
  mais `acs_ok`/`mpu_ok`/`audio_ok`) é necessário no novo firmware.