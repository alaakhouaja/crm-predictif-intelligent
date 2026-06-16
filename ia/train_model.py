#!/usr/bin/env python3
"""
Entraîne un premier modèle CatBoost pour prédire la conversion des leads.

Fonctionnalités:
- lit le dataset exporté depuis `ia/datasets/leads_dataset.csv`
- sélectionne les colonnes utiles pour l'IA
- gère le déséquilibre des classes avec `class_weights`
- entraîne un `CatBoostClassifier`
- calcule les métriques principales
- sauvegarde le modèle, les features importances et un rapport JSON

Usage:
    python ia/train_model.py
    python ia/train_model.py --input ia/datasets/leads_dataset.csv
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

try:
    from sklearn.metrics import (
        accuracy_score,
        confusion_matrix,
        f1_score,
        precision_score,
        recall_score,
        roc_auc_score,
    )
    from sklearn.model_selection import train_test_split
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Le package `scikit-learn` est requis. Installe-le avec "
        "`pip install scikit-learn`."
    ) from exc


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = PROJECT_ROOT / "ia" / "datasets" / "leads_dataset.csv"
MODEL_DIR = PROJECT_ROOT / "ia" / "models"
REPORT_DIR = PROJECT_ROOT / "ia" / "reports"

TARGET_COLUMN = "converted"
FEATURE_COLUMNS = [
    "source",
    "has_company",
    "owner_role",
    "interaction_count",
    "call_count",
    "email_interaction_count",
    "meeting_interaction_count",
    "task_count",
    "completed_task_count",
    "open_task_count",
    "overdue_task_count",
    "call_task_count",
    "email_task_count",
    "meeting_task_count",
    "todo_task_count",
    "avg_task_progress",
    "days_since_last_activity",
    "days_since_creation",
]
CATEGORICAL_COLUMNS = ["source", "owner_role"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Entraîner un modèle CatBoost pour scorer les leads.",
    )
    parser.add_argument(
        "--input",
        default=str(DEFAULT_INPUT),
        help="Chemin vers le CSV exporté.",
    )
    parser.add_argument(
        "--test-size",
        type=float,
        default=0.2,
        help="Part du dataset réservée au test.",
    )
    parser.add_argument(
        "--random-state",
        type=int,
        default=42,
        help="Graine aléatoire pour reproductibilité.",
    )
    return parser.parse_args()


def ensure_columns(df: pd.DataFrame) -> None:
    required = set(FEATURE_COLUMNS + [TARGET_COLUMN])
    # has_company can be derived from company for backward-compatible CSVs
    if "has_company" in required and "has_company" not in df.columns and "company" in df.columns:
        required.discard("has_company")
    missing = sorted(required.difference(df.columns))
    if missing:
        raise RuntimeError(f"Colonnes manquantes dans le CSV: {', '.join(missing)}")


def prepare_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    # Derive has_company before selecting FEATURE_COLUMNS so it is available in df
    if "has_company" not in df.columns:
        if "company" in df.columns:
            df = df.copy()
            df["has_company"] = df["company"].notna().apply(
                lambda v: 0 if str(v).strip() in ("", "unknown", "nan") else 1
            )
        else:
            df = df.copy()
            df["has_company"] = 0

    dataset = df[FEATURE_COLUMNS + [TARGET_COLUMN]].copy()

    for col in CATEGORICAL_COLUMNS:
        dataset[col] = dataset[col].fillna("unknown").astype(str)

    # has_company: 1 if company is non-empty, 0 otherwise (replaces high-cardinality company feature)
    if "company" in df.columns:
        dataset["has_company"] = df["company"].notna().apply(lambda v: 0 if str(v).strip() in ("", "unknown", "nan") else 1)
    elif "has_company" not in dataset.columns:
        dataset["has_company"] = 0

    numeric_columns = [col for col in FEATURE_COLUMNS if col not in CATEGORICAL_COLUMNS]
    for col in numeric_columns:
        dataset[col] = pd.to_numeric(dataset[col], errors="coerce").fillna(0)

    dataset[TARGET_COLUMN] = pd.to_numeric(dataset[TARGET_COLUMN], errors="coerce").fillna(0).astype(int)
    return dataset


def compute_class_weights(y: pd.Series) -> list[float]:
    class_counts = y.value_counts().to_dict()
    negatives = float(class_counts.get(0, 0))
    positives = float(class_counts.get(1, 0))

    if positives == 0:
        raise RuntimeError("Aucun lead converti trouvé dans le dataset.")
    if negatives == 0:
        return [1.0, 1.0]

    positive_weight = negatives / positives
    return [1.0, round(positive_weight, 4)]


def find_best_threshold(
    y_true: pd.Series,
    probabilities: Any,
) -> tuple[float, dict[str, float | list[list[int]]]]:
    thresholds = sorted({round(float(prob), 4) for prob in probabilities})
    if 0.5 not in thresholds:
        thresholds.append(0.5)
        thresholds.sort()

    best_threshold = 0.5
    best_metrics: dict[str, float | list[list[int]]] = {
        "accuracy": 0.0,
        "precision": 0.0,
        "recall": 0.0,
        "f1_score": -1.0,
        "confusion_matrix": [[0, 0], [0, 0]],
    }

    for threshold in thresholds:
        predictions = (probabilities >= threshold).astype(int)
        current_metrics: dict[str, float | list[list[int]]] = {
            "accuracy": float(accuracy_score(y_true, predictions)),
            "precision": float(precision_score(y_true, predictions, zero_division=0)),
            "recall": float(recall_score(y_true, predictions, zero_division=0)),
            "f1_score": float(f1_score(y_true, predictions, zero_division=0)),
            "confusion_matrix": confusion_matrix(y_true, predictions).tolist(),
        }

        current_f1 = float(current_metrics["f1_score"])
        best_f1 = float(best_metrics["f1_score"])
        current_precision = float(current_metrics["precision"])
        best_precision = float(best_metrics["precision"])

        if current_f1 > best_f1 or (
            current_f1 == best_f1 and current_precision > best_precision
        ):
            best_threshold = threshold
            best_metrics = current_metrics

    return best_threshold, best_metrics


def train_model(
    df: pd.DataFrame,
    test_size: float,
    random_state: int,
) -> tuple[CatBoostClassifier, dict[str, Any], pd.DataFrame]:
    X = df[FEATURE_COLUMNS]
    y = df[TARGET_COLUMN]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=test_size,
        random_state=random_state,
        stratify=y,
    )

    class_weights = compute_class_weights(y_train)

    train_pool = Pool(X_train, y_train, cat_features=CATEGORICAL_COLUMNS)
    test_pool = Pool(X_test, y_test, cat_features=CATEGORICAL_COLUMNS)

    model = CatBoostClassifier(
        iterations=400,
        depth=6,
        learning_rate=0.05,
        loss_function="Logloss",
        eval_metric="AUC",
        class_weights=class_weights,
        random_seed=random_state,
        verbose=50,
    )

    model.fit(train_pool, eval_set=test_pool, use_best_model=True)

    probabilities = model.predict_proba(X_test)[:, 1]
    best_threshold, threshold_metrics = find_best_threshold(y_test, probabilities)

    metrics = {
        "train_size": int(len(X_train)),
        "test_size": int(len(X_test)),
        "positive_train_count": int(y_train.sum()),
        "positive_test_count": int(y_test.sum()),
        "negative_train_count": int((y_train == 0).sum()),
        "negative_test_count": int((y_test == 0).sum()),
        "class_weights": class_weights,
        "best_threshold": float(best_threshold),
        "accuracy": float(threshold_metrics["accuracy"]),
        "precision": float(threshold_metrics["precision"]),
        "recall": float(threshold_metrics["recall"]),
        "f1_score": float(threshold_metrics["f1_score"]),
        "roc_auc": float(roc_auc_score(y_test, probabilities)),
        "confusion_matrix": threshold_metrics["confusion_matrix"],
    }

    feature_importance = pd.DataFrame(
        {
            "feature": FEATURE_COLUMNS,
            "importance": model.get_feature_importance(train_pool),
        }
    ).sort_values(by="importance", ascending=False)

    return model, metrics, feature_importance


def save_outputs(
    model: CatBoostClassifier,
    metrics: dict[str, Any],
    feature_importance: pd.DataFrame,
) -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    model_path = MODEL_DIR / "lead_conversion_catboost.cbm"
    metrics_path = REPORT_DIR / "training_metrics.json"
    feature_path = REPORT_DIR / "feature_importance.csv"

    model.save_model(str(model_path))
    feature_importance.to_csv(feature_path, index=False, encoding="utf-8")

    report = {
        "model_type": "CatBoostClassifier",
        "target": TARGET_COLUMN,
        "features": FEATURE_COLUMNS,
        "categorical_features": CATEGORICAL_COLUMNS,
        "metrics": metrics,
        "model_path": model_path.relative_to(PROJECT_ROOT).as_posix(),
        "feature_importance_path": str(feature_path),
    }
    metrics_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")


def print_summary(metrics: dict[str, Any]) -> None:
    print("[OK] Entraînement terminé")
    print(f"[INFO] Train size: {metrics['train_size']}")
    print(f"[INFO] Test size: {metrics['test_size']}")
    print(f"[INFO] Class weights: {metrics['class_weights']}")
    print(f"[INFO] Best threshold: {metrics['best_threshold']:.4f}")
    print(f"[INFO] Accuracy: {metrics['accuracy']:.4f}")
    print(f"[INFO] Precision: {metrics['precision']:.4f}")
    print(f"[INFO] Recall: {metrics['recall']:.4f}")
    print(f"[INFO] F1-score: {metrics['f1_score']:.4f}")
    print(f"[INFO] ROC-AUC: {metrics['roc_auc']:.4f}")
    print(f"[INFO] Confusion matrix: {metrics['confusion_matrix']}")


def main() -> None:
    args = parse_args()
    input_path = Path(args.input).resolve()
    if not input_path.exists():
        raise RuntimeError(f"Dataset introuvable: {input_path}")

    df = pd.read_csv(input_path)
    ensure_columns(df)
    prepared = prepare_dataframe(df)

    model, metrics, feature_importance = train_model(
        prepared,
        test_size=args.test_size,
        random_state=args.random_state,
    )
    save_outputs(model, metrics, feature_importance)
    print_summary(metrics)


if __name__ == "__main__":
    main()
