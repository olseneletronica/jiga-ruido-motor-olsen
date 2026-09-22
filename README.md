# Jiga Ruído Motor — Olsen

Pipeline de análise dos ensaios da jiga de motores (Bosch) para classificar
motores com base em corrente, tensão, potência, vibração (IMU) e áudio
capturado durante o teste.

## Fonte de dados

Planilha Google Sheets publicada, aba **DADOS**:
```
https://docs.google.com/spreadsheets/d/e/2PACX-1vQ1FV5aTG7GK9MAZyC-gswZ30Hi8E2WLaYRHLtUZQdsXi36iobdmBuC10pJ4a8Ckf8oUa0mboZn5zcc/pub?output=tsv
```

Cada linha é uma leitura (1x por segundo) dentro de um `ensaio`. Um `ensaio`
varre combinações de `frequencia_hz` × `duty_percent` de chaveamento do motor.

### Dicionário de colunas

| Coluna | Descrição |
|---|---|
| `timestamp` | Data/hora da leitura |
| `firmware` | Versão do firmware da jiga |
| `ensaio` | Identificador do teste (mesmo motor = mesmo número) |
| `frequencia_hz` | Frequência de chaveamento aplicada |
| `segundo` | Segundo decorrido dentro do ensaio |
| `duty_percent` | Duty cycle do PWM aplicado |
| `tensao_v`, `corrente_a`, `potencia_w` | Grandezas elétricas medidas |
| `accel_x/y/z_g`, `accel_resultante_g` | Vibração (IMU) |
| `gyro_x/y/z_dps` | Giroscópio (IMU) |
| `audio_rms`, `audio_peak`, `audio_freq_hz` | Ruído captado por microfone |
| `wifi_rssi` | Qualidade do link Wi-Fi da jiga (diagnóstico, não é saúde do motor) |
| `acs_ok`, `mpu_ok`, `audio_ok` | Flags de saúde dos sensores na leitura |

## Pipeline

```bash
pip install -r requirements.txt

# 1. Baixa e limpa os dados publicados (descarta linhas com sensor com falha)
python scripts/fetch_sheet.py

# 2. Constrói a "assinatura" de cada ensaio por ponto de operação
python scripts/features.py

# 3. Constrói a referência a partir de ensaios CONFIRMADOS como motor bom
#    (troque os números pelos ensaios reais já validados)
python scripts/baseline.py --good 12 13 14 18 21

# 4. Classifica todos os ensaios contra a referência
python scripts/classify.py
```

Isso gera em `data/`:
- `raw_ensaios.csv` — snapshot limpo da planilha
- `features_por_ponto.csv` — média/desvio/pico por (ensaio, frequência, duty)
- `features_por_ensaio.csv` — resumo geral por ensaio
- `baseline.json` — referência de motor saudável por ponto de operação
- `classificacao.csv` — status final: `OK`, `ATENCAO` ou `FALHA_PROVAVEL`

## Como funciona a classificação

Sem rótulos de falha confirmados ainda, a abordagem inicial é baseada em
desvio estatístico:

1. `baseline.py` usa um conjunto de ensaios que você já sabe serem de
   motores bons para calcular média/desvio-padrão de corrente, potência,
   vibração e áudio em cada ponto de operação testado.
2. `classify.py` calcula o z-score de cada ensaio novo contra essa
   referência, ponto a ponto, e resume em um status.
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

`dashboard/index.html` (Chart.js + PapaParse, mesmo padrão do dashboard de
durabilidade dos motores) lê os CSVs de `data/` e mostra, por ensaio:
corrente, vibração e áudio ao longo do tempo, além da tabela de
classificação. Publique o repo inteiro no GitHub Pages — o dashboard
referencia `../data/*.csv` diretamente.

## Próximos ajustes a validar com você

- Confirmar quais `ensaio`s já são motores conhecidos-bons para o baseline.
- Definir se `frequencia_hz`/`duty_percent` seguem sempre o mesmo roteiro de
  varredura entre ensaios (senão `classify.py` vai descartar pontos sem
  referência direta — dá pra evoluir para interpolação se for o caso).
- Calibrar `Z_THRESHOLD` observando a distribuição real dos ensaios bons.
