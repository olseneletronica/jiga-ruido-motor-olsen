# Contexto do projeto — Jiga Ruído Motor (Olsen)

Projeto irmão do `motor-durability-bushing` (mesmo padrão: dashboard GitHub
Pages + Chart.js, dados vindos de Google Sheets publicado).

- Objetivo: classificar motores (Bosch) testados na jiga como saudáveis ou
  com possível falha, a partir de corrente, tensão, potência, vibração
  (IMU) e áudio captados durante ensaios de varredura frequência × duty.
- Fonte de dados: aba "DADOS" da planilha publicada (ver README.md).
- Pipeline: `scripts/fetch_sheet.py` → `scripts/features.py` →
  `scripts/baseline.py --good <ensaios>` → `scripts/classify.py`.
- Classificação atual é estatística (z-score contra referência de motores
  bons), sem modelo supervisionado ainda — não há rótulos de falha
  confirmados no dataset.
- Dashboard estático em `dashboard/`, sem build step, lê os CSVs de `data/`
  diretamente via fetch + PapaParse.
- Ao editar os scripts, manter a lista `EXPECTED_COLUMNS` em
  `fetch_sheet.py` sincronizada com o cabeçalho real da planilha.
