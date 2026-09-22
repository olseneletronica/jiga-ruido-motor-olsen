"""
baseline.py — a partir de uma lista de ensaios confirmados como "motor bom",
constrói a referência (média + desvio padrão) de cada canal em cada ponto de
operação (frequencia_hz, duty_percent). Essa referência é usada por
classify.py para pontuar ensaios novos.

Uso:
    python scripts/baseline.py --good 12 13 14 18 21
"""
import argparse
import json
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
POINT_PATH = DATA_DIR / "features_por_ponto.csv"
BASELINE_PATH = DATA_DIR / "baseline.json"

REF_COLUMNS = [
    "corrente_a_mean", "potencia_w_mean",
    "accel_resultante_g_mean", "accel_resultante_g_max",
    "audio_rms_mean", "audio_peak_mean",
]


def build_baseline(point_df: pd.DataFrame, good_ensaios: list[int]) -> dict:
    subset = point_df[point_df.ensaio.isin(good_ensaios)]
    if subset.empty:
        raise ValueError(
            "Nenhum dos ensaios informados foi encontrado em features_por_ponto.csv "
            "(rode scripts/features.py antes)."
        )

    ref = {}
    for (freq, duty), grp in subset.groupby(["frequencia_hz", "duty_percent"]):
        key = f"{freq}_{duty}"
        entry = {
            "frequencia_hz": freq,
            "duty_percent": duty,
            "n_ensaios": int(grp.ensaio.nunique()),
        }
        for col in REF_COLUMNS:
            entry[f"{col}_ref_mean"] = float(grp[col].mean())
            entry[f"{col}_ref_std"] = float(grp[col].std(ddof=0)) if len(grp) > 1 else 0.0
        ref[key] = entry
    return ref


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--good", nargs="+", type=int, required=True,
        help="Números dos ensaios confirmados como motor bom",
    )
    args = parser.parse_args()

    point_df = pd.read_csv(POINT_PATH)
    ref = build_baseline(point_df, args.good)

    with open(BASELINE_PATH, "w") as f:
        json.dump(ref, f, indent=2, ensure_ascii=False)

    print(
        f"[baseline] Referência construída a partir de {len(args.good)} ensaio(s) "
        f"-> {BASELINE_PATH} ({len(ref)} pontos de operação)"
    )


if __name__ == "__main__":
    main()
