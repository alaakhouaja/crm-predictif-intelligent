#!/usr/bin/env python3
"""
Exporte un dataset CSV de leads pour l'IA.

Le script:
- lit DATABASE_URL depuis les variables d'environnement ou `backend/.env`
- récupère les leads depuis PostgreSQL
- calcule des features simples à partir des interactions et des tâches
- génère un CSV prêt pour un premier entraînement CatBoost

Usage:
    python ia/export_leads.py
    python ia/export_leads.py --output ia/datasets/leads_dataset.csv
"""

from __future__ import annotations

import argparse
import csv
import os
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import parse_qsl, urlparse


try:
    import psycopg  # type: ignore
except ImportError:  # pragma: no cover
    psycopg = None

try:
    import psycopg2  # type: ignore
    import psycopg2.extras  # type: ignore
except ImportError:  # pragma: no cover
    psycopg2 = None


PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ENV_FILE = PROJECT_ROOT / "backend" / ".env"
DEFAULT_OUTPUT = PROJECT_ROOT / "ia" / "datasets" / "leads_dataset.csv"


SQL = """
WITH interaction_stats AS (
  SELECT
    i."leadId",
    COUNT(*)::int AS interaction_count,
    COUNT(*) FILTER (WHERE i."type" = 'CALL')::int AS call_count,
    COUNT(*) FILTER (WHERE i."type" = 'EMAIL')::int AS email_interaction_count,
    COUNT(*) FILTER (WHERE i."type" = 'MEETING')::int AS meeting_interaction_count,
    MAX(i."createdAt") AS last_interaction_at
  FROM "Interaction" i
  GROUP BY i."leadId"
),
task_stats AS (
  SELECT
    t."leadId",
    COUNT(*)::int AS task_count,
    COUNT(*) FILTER (WHERE t."status" = 'DONE')::int AS completed_task_count,
    COUNT(*) FILTER (WHERE t."status" IN ('OPEN', 'IN_PROGRESS'))::int AS open_task_count,
    COUNT(*) FILTER (
      WHERE t."status" IN ('OPEN', 'IN_PROGRESS')
      AND t."dueDate" IS NOT NULL
      AND t."dueDate" < NOW()
    )::int AS overdue_task_count,
    COUNT(*) FILTER (WHERE t."type" = 'CALL')::int AS call_task_count,
    COUNT(*) FILTER (WHERE t."type" = 'EMAIL')::int AS email_task_count,
    COUNT(*) FILTER (WHERE t."type" = 'MEETING')::int AS meeting_task_count,
    COUNT(*) FILTER (WHERE t."type" = 'TODO')::int AS todo_task_count,
    COALESCE(AVG(t."progress"), 0)::float AS avg_task_progress,
    MAX(COALESCE(t."completedAt", t."updatedAt", t."createdAt")) AS last_task_activity_at
  FROM "Task" t
  WHERE t."leadId" IS NOT NULL
  GROUP BY t."leadId"
)
SELECT
  l."id" AS lead_id,
  l."firstName" AS first_name,
  l."lastName" AS last_name,
  l."email" AS email,
  COALESCE(l."source", 'unknown') AS source,
  l."stage"::text AS stage,
  CASE WHEN l."company" IS NOT NULL AND l."company" != '' THEN 1 ELSE 0 END AS has_company,
  l."ownerId" AS owner_id,
  u."role"::text AS owner_role,
  l."createdAt" AS created_at,
  l."updatedAt" AS updated_at,
  COALESCE(s1.interaction_count, 0) AS interaction_count,
  COALESCE(s1.call_count, 0) AS call_count,
  COALESCE(s1.email_interaction_count, 0) AS email_interaction_count,
  COALESCE(s1.meeting_interaction_count, 0) AS meeting_interaction_count,
  COALESCE(s2.task_count, 0) AS task_count,
  COALESCE(s2.completed_task_count, 0) AS completed_task_count,
  COALESCE(s2.open_task_count, 0) AS open_task_count,
  COALESCE(s2.overdue_task_count, 0) AS overdue_task_count,
  COALESCE(s2.call_task_count, 0) AS call_task_count,
  COALESCE(s2.email_task_count, 0) AS email_task_count,
  COALESCE(s2.meeting_task_count, 0) AS meeting_task_count,
  COALESCE(s2.todo_task_count, 0) AS todo_task_count,
  COALESCE(s2.avg_task_progress, 0) AS avg_task_progress,
  GREATEST(
    l."updatedAt",
    COALESCE(s1.last_interaction_at, l."createdAt"),
    COALESCE(s2.last_task_activity_at, l."createdAt")
  ) AS last_activity_at,
  EXTRACT(
    DAY FROM NOW() - GREATEST(
      l."updatedAt",
      COALESCE(s1.last_interaction_at, l."createdAt"),
      COALESCE(s2.last_task_activity_at, l."createdAt")
    )
  )::int AS days_since_last_activity,
  EXTRACT(DAY FROM NOW() - l."createdAt")::int AS days_since_creation,
  CASE WHEN l."stage" = 'Gagne' THEN 1 ELSE 0 END AS converted
FROM "Lead" l
JOIN "User" u ON u."id" = l."ownerId"
LEFT JOIN interaction_stats s1 ON s1."leadId" = l."id"
LEFT JOIN task_stats s2 ON s2."leadId" = l."id"
WHERE l."isAnonymized" = false
  AND l."stage" IN ('Gagne', 'Perdu')
ORDER BY l."createdAt" ASC;
"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Exporter un dataset de leads pour l'IA.",
    )
    parser.add_argument(
        "--output",
        default=str(DEFAULT_OUTPUT),
        help="Chemin du CSV de sortie.",
    )
    return parser.parse_args()


def load_database_url() -> str:
    env_url = os.getenv("DATABASE_URL")
    if env_url:
        return env_url

    if BACKEND_ENV_FILE.exists():
        for line in BACKEND_ENV_FILE.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            key, value = stripped.split("=", 1)
            if key.strip() == "DATABASE_URL":
                value = value.strip().strip("'").strip('"')
                if value:
                    os.environ["DATABASE_URL"] = value
                    return value

    raise RuntimeError(
        "DATABASE_URL introuvable. Ajoute-la dans les variables d'environnement "
        "ou dans backend/.env."
    )


def mask_database_url(database_url: str) -> str:
    parsed = urlparse(database_url)
    if not parsed.hostname:
      return "postgresql://***"
    port = f":{parsed.port}" if parsed.port else ""
    db_name = parsed.path.lstrip("/") or "***"
    return f"{parsed.scheme}://***@{parsed.hostname}{port}/{db_name}"


def build_connection_kwargs(database_url: str) -> dict[str, Any]:
    parsed = urlparse(database_url)
    if parsed.scheme not in {"postgresql", "postgres"}:
        raise RuntimeError("DATABASE_URL doit utiliser PostgreSQL.")

    query_params = dict(parse_qsl(parsed.query, keep_blank_values=True))
    options = ""
    if query_params.get("schema"):
        options = f"-c search_path={query_params['schema']}"

    return {
        "dbname": parsed.path.lstrip("/"),
        "user": parsed.username,
        "password": parsed.password,
        "host": parsed.hostname,
        "port": parsed.port,
        "options": options or None,
    }


def fetch_rows(database_url: str) -> list[dict[str, Any]]:
    conn_kwargs = build_connection_kwargs(database_url)
    if psycopg is not None:
        with psycopg.connect(**{k: v for k, v in conn_kwargs.items() if v is not None}) as conn:
            with conn.cursor() as cur:
                cur.execute(SQL)
                columns = [desc.name for desc in cur.description]
                return [dict(zip(columns, row)) for row in cur.fetchall()]

    if psycopg2 is not None:
        with psycopg2.connect(**{k: v for k, v in conn_kwargs.items() if v is not None}) as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(SQL)
                return list(cur.fetchall())

    raise RuntimeError(
        "Aucun driver PostgreSQL Python trouvé. Installe `psycopg` ou `psycopg2-binary`."
    )


def normalize_rows(rows: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for row in rows:
        normalized.append(
            {
                "lead_id": row["lead_id"],
                "source": row["source"],
                "stage": row["stage"],
                "has_company": int(row.get("has_company") or 0),
                "owner_id": row["owner_id"],
                "owner_role": row["owner_role"],
                "created_at": row["created_at"].isoformat() if row["created_at"] else "",
                "updated_at": row["updated_at"].isoformat() if row["updated_at"] else "",
                "interaction_count": row["interaction_count"],
                "call_count": row["call_count"],
                "email_interaction_count": row["email_interaction_count"],
                "meeting_interaction_count": row["meeting_interaction_count"],
                "task_count": row["task_count"],
                "completed_task_count": row["completed_task_count"],
                "open_task_count": row["open_task_count"],
                "overdue_task_count": row["overdue_task_count"],
                "call_task_count": row["call_task_count"],
                "email_task_count": row["email_task_count"],
                "meeting_task_count": row["meeting_task_count"],
                "todo_task_count": row["todo_task_count"],
                "avg_task_progress": round(float(row["avg_task_progress"] or 0), 2),
                "last_activity_at": (
                    row["last_activity_at"].isoformat() if row["last_activity_at"] else ""
                ),
                "days_since_last_activity": row["days_since_last_activity"],
                "days_since_creation": row["days_since_creation"],
                "converted": row["converted"],
            }
        )
    return normalized


def write_csv(rows: list[dict[str, Any]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = list(rows[0].keys()) if rows else [
        "lead_id",
        "source",
        "stage",
        "has_company",
        "owner_id",
        "owner_role",
        "created_at",
        "updated_at",
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
        "last_activity_at",
        "days_since_last_activity",
        "days_since_creation",
        "converted",
    ]

    with output_path.open("w", encoding="utf-8", newline="") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    args = parse_args()
    output_path = Path(args.output).resolve()
    database_url = load_database_url()

    print(f"[INFO] Connexion a {mask_database_url(database_url)}")
    rows = fetch_rows(database_url)
    normalized = normalize_rows(rows)
    write_csv(normalized, output_path)

    converted_count = sum(int(row["converted"]) for row in normalized)
    print(f"[OK] Dataset exporte: {output_path}")
    print(f"[OK] Leads exportes: {len(normalized)}")
    print(f"[OK] Leads convertis: {converted_count}")


if __name__ == "__main__":
    main()
