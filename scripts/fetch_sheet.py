"""
fetch_sheet.py — baixa os dados publicados do Google Sheets (aba DADOS) e
gera um snapshot local em data/raw_ensaios.csv, descartando leituras em que
algum sensor reportou falha (acs_ok / mpu_ok / audio_ok == 0).

Uso:
    python scripts/fetch_sheet.py
"""
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

SHEET_URL = (
    "https://docs.google.com/spreadsheets/d/e/"
    "2PACX-1vQ1FV5aTG7GK9MAZyC-gswZ30Hi8E2WLaYRHLtUZQdsXi36iobdmBuC10pJ4a8Ckf8oUa0mboZn5zcc/"
    "pub?output=tsv"
)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
RAW_PATH = DATA_DIR / "raw_ensaios.csv"

EXPECTED_COLUMNS = [
    "timestamp", "firmware", "ensaio", "frequencia_hz", "segundo",
    "duty_percent", "tensao_v", "corrente_a", "potencia_w",
    "accel_x_g", "accel_y_g", "accel_z_g", "accel_resultante_g",
    "gyro_x_dps", "gyro_y_dps", "gyro_z_dps",
    "audio_rms", "audio_peak", "audio_freq_hz",
    "wifi_rssi", "acs_ok", "mpu_ok", "audio_ok",
]


def fetch(url: str = SHEET_URL) -> pd.DataFrame:
    df = pd.read_csv(url, sep="\t")
    missing = set(EXPECTED_COLUMNS) - set(df.columns)
    if missing:
        raise ValueError(f"Colunas ausentes na planilha: {missing}")
    return df[EXPECTED_COLUMNS]


def clean(df: pd.DataFrame) -> pd.DataFrame:
    """Remove leituras onde algum sensor reportou falha na hora da coleta."""
    before = len(df)
    df = df[(df.acs_ok == 1) & (df.mpu_ok == 1) & (df.audio_ok == 1)].copy()
    dropped = before - len(df)
    if dropped:
        print(
            f"[fetch_sheet] {dropped} linha(s) descartada(s) por falha de sensor "
            f"(acs_ok/mpu_ok/audio_ok).",
            file=sys.stderr,
        )
    return df


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    df = fetch()
    df = clean(df)
    df.to_csv(RAW_PATH, index=False)
    print(
        f"[fetch_sheet] {len(df)} linhas salvas em {RAW_PATH} "
        f"({df['ensaio'].nunique()} ensaios) — {datetime.now(timezone.utc).isoformat()}"
    )


if __name__ == "__main__":
    main()
