"""
features.py — constrói a "assinatura" de cada ensaio (motor testado).

Cada ensaio é uma varredura ao longo de (frequencia_hz, duty_percent).
Este script agrega os dados em dois níveis:

1. features_por_ponto.csv  — média/desvio/pico de cada canal em cada
   combinação (ensaio, frequencia_hz, duty_percent). É a "assinatura" fina
   do motor, usada para comparar ponto a ponto contra a referência.
2. features_por_ensaio.csv — um resumo geral por ensaio (picos absolutos,
   duração, variabilidade), útil para uma visão rápida de saúde do motor.

Uso:
    python scripts/features.py
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
    "accel_resultante_g", "gyro_x_dps", "gyro_y_dps", "gyro_z_dps",
    "audio_rms", "audio_peak", "audio_freq_hz",
]


def _agg_spec():
    return {col: ["mean", "std", "max"] for col in SIGNAL_COLUMNS}


def build_point_features(df: pd.DataFrame) -> pd.DataFrame:
    grouped = df.groupby(["ensaio", "frequencia_hz", "duty_percent"]).agg(_agg_spec())
    grouped.columns = ["_".join(c) for c in grouped.columns]
    return grouped.reset_index()


def build_ensaio_features(df: pd.DataFrame) -> pd.DataFrame:
    n_pontos = (
        df.groupby("ensaio")[["frequencia_hz", "duty_percent"]]
        .apply(lambda g: g.drop_duplicates().shape[0])
        .rename("n_pontos_operacao")
    )

    base = df.groupby("ensaio").agg(
        firmware=("firmware", "first"),
        duracao_s=("segundo", "max"),
        n_leituras=("segundo", "count"),
        corrente_a_max=("corrente_a", "max"),
        potencia_w_max=("potencia_w", "max"),
        accel_resultante_g_max=("accel_resultante_g", "max"),
        audio_rms_max=("audio_rms", "max"),
        audio_peak_max=("audio_peak", "max"),
        corrente_a_std_geral=("corrente_a", "std"),
    ).reset_index()

    return base.merge(n_pontos, on="ensaio", how="left")


def main():
    df = pd.read_csv(RAW_PATH)
    point_df = build_point_features(df)
    ensaio_df = build_ensaio_features(df)

    point_df.to_csv(POINT_PATH, index=False)
    ensaio_df.to_csv(ENSAIO_PATH, index=False)
    print(f"[features] {len(point_df)} pontos de operação -> {POINT_PATH}")
    print(f"[features] {len(ensaio_df)} ensaios -> {ENSAIO_PATH}")


if __name__ == "__main__":
    main()
