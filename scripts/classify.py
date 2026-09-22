"""
classify.py — compara cada ensaio contra a referência (baseline.json) e
gera um status de saúde por ensaio, combinando o desvio de corrente,
vibração e áudio em cada ponto de operação testado.

Uso:
    python scripts/classify.py
Gera:
    data/classificacao.csv
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
POINT_PATH = DATA_DIR / "features_por_ponto.csv"
BASELINE_PATH = DATA_DIR / "baseline.json"
OUT_PATH = DATA_DIR / "classificacao.csv"

REF_COLUMNS = [
    "corrente_a_mean", "potencia_w_mean",
    "accel_resultante_g_mean", "accel_resultante_g_max",
    "audio_rms_mean", "audio_peak_mean",
]

# Acima de quantos desvios-padrão da referência um canal conta como suspeito.
# Ajuste este valor observando a distribuição real dos ensaios conhecidos-bons.
Z_THRESHOLD = 3.0

# Fração de pontos suspeitos acima da qual o ensaio vira "falha provável"
# em vez de apenas "atenção".
FALHA_FRACAO = 0.3


def zscore_point(row, ref):
    key = f"{row.frequencia_hz}_{row.duty_percent}"
    r = ref.get(key)
    if r is None:
        return None  # ponto de operação ainda sem referência
    zscores = {}
    for col in REF_COLUMNS:
        mean = r.get(f"{col}_ref_mean")
        std = r.get(f"{col}_ref_std") or 0.0
        if mean is None:
            continue
        zscores[col] = abs(row[col] - mean) / max(std, 1e-9)
    return zscores


def main():
    point_df = pd.read_csv(POINT_PATH)
    with open(BASELINE_PATH) as f:
        ref = json.load(f)

    rows = []
    for _, row in point_df.iterrows():
        z = zscore_point(row, ref)
        if z is None:
            continue
        n_suspeitos = sum(1 for v in z.values() if v > Z_THRESHOLD)
        rows.append({
            "ensaio": row.ensaio,
            "frequencia_hz": row.frequencia_hz,
            "duty_percent": row.duty_percent,
            "z_max": max(z.values()) if z else np.nan,
            "canais_suspeitos": n_suspeitos,
            **{f"z_{col}": v for col, v in z.items()},
        })

    if not rows:
        raise SystemExit(
            "[classify] Nenhum ponto do dataset bate com pontos de operação da "
            "referência. Rode scripts/baseline.py com ensaios que cubram os "
            "mesmos (frequencia_hz, duty_percent) testados aqui."
        )

    detail_df = pd.DataFrame(rows)

    resumo = detail_df.groupby("ensaio").agg(
        z_max_geral=("z_max", "max"),
        pontos_suspeitos=("canais_suspeitos", lambda s: int((s > 0).sum())),
        pontos_avaliados=("z_max", "count"),
    ).reset_index()

    fracao_suspeita = resumo.pontos_suspeitos / resumo.pontos_avaliados
    resumo["status"] = np.select(
        [resumo.pontos_suspeitos == 0, fracao_suspeita > FALHA_FRACAO],
        ["OK", "FALHA_PROVAVEL"],
        default="ATENCAO",
    )

    resumo.to_csv(OUT_PATH, index=False)
    print(f"[classify] {len(resumo)} ensaios classificados -> {OUT_PATH}")
    print(resumo.status.value_counts().to_string())


if __name__ == "__main__":
    main()
