"""
features.py — constrói a "assinatura" de cada ensaio (motor testado).

A varredura agora é só por frequência (sem duty_percent), então agrupamos
por (ensaio, frequência).

Uso:
    python scripts/features.py
Gera:
    data/features_por_ponto.csv   (um resumo por ensaio + frequência)
    data/features_por_ensaio.csv  (um resumo por ensaio, agregando tudo)
"""
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
RAW_PATH = DATA_DIR / "raw_ensaios.csv"
POINT_PATH = DATA_DIR / "features_por_ponto.csv"
ENSAIO_PATH = DATA_DIR / "features_por_ensaio.csv"

# Canais numéricos que fazem sentido resumir com média/desvio/pico
SIGNAL_COLUMNS = [
    "tensao_v", "corrente_a", "potencia_w",
    "accel_x_g", "accel_y_g", "accel_z_g", "accel_resultante_g",
    "gyro_x_dps", "gyro_y_dps", "gyro_z_dps",
    "audio1_dbfs", "audio1_peak_dbfs", "audio2_dbfs", "audio2_peak_dbfs",
]


def _agg_spec():
    return {col: ["mean", "std", "max"] for col in SIGNAL_COLUMNS}


def build_point_features(df: pd.DataFrame) -> pd.DataFrame:
    grouped = df.groupby(["ensaio", "frequencia_hz"]).agg(_agg_spec())
    grouped.columns = ["_".join(c) for c in grouped.columns]
    return grouped.reset_index()


def build_ensaio_features(df: pd.DataFrame) -> pd.DataFrame:
    n_freqs = df.groupby("ensaio")["frequencia_hz"].nunique().rename("n_frequencias")

    base = df.groupby("ensaio").agg(
        firmware=("firmware", "first"),
        duracao_s=("segundo", "max"),
        n_leituras=("segundo", "count"),
        corrente_a_max=("corrente_a", "max"),
        potencia_w_max=("potencia_w", "max"),
        accel_resultante_g_max=("accel_resultante_g", "max"),
        audio1_peak_dbfs_max=("audio1_peak_dbfs", "max"),
        audio2_peak_dbfs_max=("audio2_peak_dbfs", "max"),
        corrente_a_std_geral=("corrente_a", "std"),
    ).reset_index()

    return base.merge(n_freqs, on="ensaio", how="left")


def main():
    df = pd.read_csv(RAW_PATH)
    point_df = build_point_features(df)
    ensaio_df = build_ensaio_features(df)

    point_df.to_csv(POINT_PATH, index=False)
    ensaio_df.to_csv(ENSAIO_PATH, index=False)
    print(f"[features] {len(point_df)} pontos (ensaio+frequência) -> {POINT_PATH}")
    print(f"[features] {len(ensaio_df)} ensaios -> {ENSAIO_PATH}")


if __name__ == "__main__":
    main()