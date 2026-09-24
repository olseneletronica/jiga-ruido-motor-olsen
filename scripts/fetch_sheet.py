"""
fetch_sheet.py — baixa os dados publicados do Google Sheets (aba DADOS) e
gera um snapshot local em data/raw_ensaios.csv.

A partir do firmware V0.02 a jiga não envia mais duty_percent nem os flags
de saúde de sensor (acs_ok/mpu_ok/audio_ok) — e passou a ter dois
microfones (audio1_dbfs/audio1_peak_dbfs, audio2_dbfs/audio2_peak_dbfs).

Uso:
    python scripts/fetch_sheet.py
"""
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

SHEET_URL = (
    "https://docs.google.com/spreadsheets/d/e/"
    "2PACX-1vQ1FV5aTG7GK9MAZyC-gswZ30Hi8E2WLaYRHLtUZQdsXi36iobdmBuC10pJ4a8Ckf8oUa0mboZn5zcc/"
    "pub?gid=335307542&single=true&output=csv"
)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
RAW_PATH = DATA_DIR / "raw_ensaios.csv"

EXPECTED_COLUMNS = [
    "timestamp", "firmware", "ensaio", "frequencia_hz", "segundo",
    "tensao_v", "corrente_a", "potencia_w",
    "accel_x_g", "accel_y_g", "accel_z_g", "accel_resultante_g",
    "gyro_x_dps", "gyro_y_dps", "gyro_z_dps",
    "audio1_dbfs", "audio1_peak_dbfs", "audio2_dbfs", "audio2_peak_dbfs",
]


def fetch(url: str = SHEET_URL) -> pd.DataFrame:
    # A planilha publicada usa vírgula como separador decimal (locale BR),
    # mesmo exportando em CSV (vírgula como delimitador de campo).
    df = pd.read_csv(url, decimal=",")
    missing = set(EXPECTED_COLUMNS) - set(df.columns)
    if missing:
        raise ValueError(f"Colunas ausentes na planilha: {missing}")
    return df[EXPECTED_COLUMNS]


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    df = fetch()
    df.to_csv(RAW_PATH, index=False)
    print(
        f"[fetch_sheet] {len(df)} linhas salvas em {RAW_PATH} "
        f"({df['ensaio'].nunique()} ensaios) — {datetime.now(timezone.utc).isoformat()}"
    )


if __name__ == "__main__":
    main()