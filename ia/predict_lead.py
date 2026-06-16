#!/usr/bin/env python3
"""
Prédit la probabilité de conversion d'un lead à partir du modèle CatBoost entraîné.

Fonctionnalités:
- charge le modèle sauvegardé `lead_conversion_catboost.cbm`
- lit la configuration depuis `ia/reports/training_metrics.json`
- accepte les features d'un lead via JSON direct ou fichier JSON
- retourne une probabilité, un score /100 et un label métier
- utilise le seuil optimisé sauvegardé pendant l'entraînement

Usage:
    python ia/predict_lead.py --features '{"source":"site web","company":"ACME"}'
    python ia/predict_lead.py --features-file ia/sample_lead.json
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

try:
    import pandas as pd  # type: ignore
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Le package `pandas` est requis. Installe-le avec `pip install pandas`."
    ) from exc

try:
    from catboost import CatBoostClassifier, Pool  # type: ignore
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Le package `catboost` est requis. Installe-le avec `pip install catboost`."
    ) from exc


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REPORT = PROJECT_ROOT / "ia" / "reports" / "training_metrics.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Prédire la conversion d'un lead avec le modèle CatBoost.",
    )
    source_group = parser.add_mutually_exclusive_group(required=True)
    source_group.add_argument(
        "--features",
        help="Features du lead au format JSON.",
    )
    source_group.add_argument(
        "--features-file",
        help="Chemin vers un fichier JSON contenant les features du lead.",
    )
    parser.add_argument(
        "--report",
        default=str(DEFAULT_REPORT),
        help="Chemin vers le fichier training_metrics.json.",
    )
    return parser.parse_args()


def load_json_payload(args: argparse.Namespace) -> dict[str, Any]:
    try:
        if args.features:
            payload = json.loads(args.features)
        else:
            features_path = Path(args.features_file).resolve()
            payload = json.loads(features_path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise RuntimeError(f"Fichier JSON introuvable: {exc.filename}") from exc
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"JSON invalide: {exc.msg}") from exc

    if not isinstance(payload, dict):
        raise RuntimeError("Les features doivent être fournies sous forme d'objet JSON.")

    return payload


def load_training_config(
    report_path: Path,
) -> tuple[list[str], list[str], float, Path]:
    if not report_path.exists():
        raise RuntimeError(f"Rapport d'entraînement introuvable: {report_path}")

    report = json.loads(report_path.read_text(encoding="utf-8"))
    features = report.get("features")
    categorical_features = report.get("categorical_features")
    model_path_raw = report.get("model_path")
    metrics = report.get("metrics", {})
    best_threshold = metrics.get("best_threshold")

    if not isinstance(features, list) or not features:
        raise RuntimeError("Le rapport ne contient pas une liste de features valide.")
    if not isinstance(categorical_features, list):
        raise RuntimeError(
            "Le rapport ne contient pas une liste de features catégorielles valide."
        )
    if not isinstance(model_path_raw, str) or not model_path_raw:
        raise RuntimeError("Le rapport ne contient pas de chemin de modèle valide.")
    if not isinstance(best_threshold, (int, float)):
        raise RuntimeError("Le rapport ne contient pas de seuil optimisé valide.")

    candidate = Path(model_path_raw)
    model_path = candidate if candidate.is_absolute() else PROJECT_ROOT / candidate
    if not model_path.exists():
        raise RuntimeError(f"Modèle introuvable: {model_path}")

    return features, categorical_features, float(best_threshold), model_path


def normalize_numeric(value: Any) -> float:
    if value is None or value == "":
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def prepare_input_frame(
    payload: dict[str, Any],
    features: list[str],
    categorical_features: list[str],
) -> pd.DataFrame:
    row: dict[str, Any] = {}

    for feature in features:
        raw_value = payload.get(feature)
        if feature in categorical_features:
            row[feature] = "unknown" if raw_value is None or raw_value == "" else str(raw_value)
        else:
            row[feature] = normalize_numeric(raw_value)

    return pd.DataFrame([row], columns=features)


_HIGH_LABEL_OFFSET = 0.15   # How far above threshold to qualify as "Élevée"
_HIGH_LABEL_MIN = 0.75       # Minimum threshold for "Élevée"
_HIGH_LABEL_MAX = 0.95       # Maximum threshold for "Élevée"


def probability_to_label(probability: float, threshold: float) -> str:
    high_threshold = min(_HIGH_LABEL_MAX, max(_HIGH_LABEL_MIN, threshold + _HIGH_LABEL_OFFSET))

    if probability >= high_threshold:
        return "Élevée"
    if probability >= threshold:
        return "Moyenne"
    return "Faible"


def predict_lead(
    payload: dict[str, Any],
    report_path: Path,
    *,
    preloaded_model: "CatBoostClassifier | None" = None,
    preloaded_config: "tuple[list[str], list[str], float, Path] | None" = None,
) -> dict[str, Any]:
    if preloaded_config is not None:
        features, categorical_features, threshold, model_path = preloaded_config
    else:
        features, categorical_features, threshold, model_path = load_training_config(report_path)

    input_frame = prepare_input_frame(payload, features, categorical_features)

    model = preloaded_model
    if model is None:
        model = CatBoostClassifier()
        model.load_model(str(model_path))
    pool = Pool(input_frame, cat_features=categorical_features)
    probability = float(model.predict_proba(pool)[0][1])
    score = round(probability * 100, 2)
    label = probability_to_label(probability, threshold)

    return {
        "probability": round(probability, 6),
        "score": score,
        "label": label,
        "threshold": round(threshold, 4),
        "above_threshold": probability >= threshold,
        "features_used": input_frame.iloc[0].to_dict(),
    }


def main() -> None:
    args = parse_args()
    payload = load_json_payload(args)
    report_path = Path(args.report).resolve()
    prediction = predict_lead(payload, report_path)
    print(json.dumps(prediction, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
