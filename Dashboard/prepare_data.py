"""Limpia tmdb_5000_movies.csv, ejecuta K-Means y exporta los datos del dashboard."""

from __future__ import annotations

import argparse
import ast
import json
import math
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler


FEATURES = ["runtime", "popularity", "vote_average"]


def parse_genres(value: object) -> list[str]:
    if not isinstance(value, str) or not value.strip():
        return ["Sin información"]
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        try:
            parsed = ast.literal_eval(value)
        except (ValueError, SyntaxError):
            return ["Sin información"]
    if not isinstance(parsed, list):
        return ["Sin información"]
    names = [item.get("name") for item in parsed if isinstance(item, dict)]
    names = [str(name).strip() for name in names if name]
    return names or ["Sin información"]


def number(value: object) -> float | None:
    if pd.isna(value):
        return None
    result = float(value)
    return result if math.isfinite(result) else None


def choose_csv(explicit_path: str | None, dashboard_dir: Path) -> Path:
    if explicit_path:
        path = Path(explicit_path).expanduser().resolve()
        if path.exists():
            return path
        raise FileNotFoundError(f"No existe el CSV indicado: {path}")

    candidates = [
        dashboard_dir / "tmdb_5000_movies.csv",
        dashboard_dir.parent / "tmdb_5000_movies.csv",
    ]
    for path in candidates:
        if path.exists():
            return path
    raise FileNotFoundError(
        "No se encontró tmdb_5000_movies.csv. Colócalo en Dashboard o en la carpeta del proyecto."
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", help="Ruta al archivo tmdb_5000_movies.csv")
    args = parser.parse_args()

    dashboard_dir = Path(__file__).resolve().parent
    csv_path = choose_csv(args.csv, dashboard_dir)
    original = pd.read_csv(csv_path)
    clean = original.copy()

    # Convertir cadenas vacías en nulos y quitar espacios de los textos.
    clean = clean.replace(r"^\s*$", pd.NA, regex=True)
    for column in clean.select_dtypes(include=["object", "str"]).columns:
        clean[column] = clean[column].str.strip()

    # Eliminar filas completas repetidas e identificadores duplicados.
    rows_before = len(clean)
    clean = clean.drop_duplicates()
    duplicate_rows_removed = rows_before - len(clean)
    rows_before = len(clean)
    clean = clean.drop_duplicates(subset="id", keep="first")
    duplicate_ids_removed = rows_before - len(clean)

    # Convertir a numéricas las variables de entrenamiento y marcar valores no válidos.
    for feature in FEATURES:
        clean[feature] = pd.to_numeric(clean[feature], errors="coerce")
        clean.loc[clean[feature] <= 0, feature] = pd.NA

    # Completar textos faltantes y descartar películas sin variables válidas para K-Means.
    text_columns = clean.select_dtypes(include=["object", "str"]).columns
    clean[text_columns] = clean[text_columns].fillna("Sin información")
    before_valid_features = len(clean)
    clean = clean.dropna(subset=FEATURES).copy()
    invalid_rows_removed = before_valid_features - len(clean)
    clean[FEATURES] = clean[FEATURES].astype(float)

    # Preparar fechas y escalamiento con el mismo conjunto de variables de Proyecto.py.
    clean["release_date"] = pd.to_datetime(clean["release_date"], errors="coerce")
    clean["release_year"] = clean["release_date"].dt.year.astype("Int64")
    scaler = StandardScaler()
    x_scaled = scaler.fit_transform(clean[FEATURES])

    # Comparar K=2, 3, 4, 5 y 6 y elegir el mayor coeficiente Silhouette.
    evaluation = []
    for k in range(2, 7):
        trial = KMeans(n_clusters=k, random_state=42, n_init=10)
        labels = trial.fit_predict(x_scaled)
        evaluation.append(
            {
                "k": k,
                "inertia": number(trial.inertia_),
                "silhouette": number(silhouette_score(x_scaled, labels)),
            }
        )
    best_k = max(evaluation, key=lambda item: item["silhouette"])["k"]

    # Entrenar el modelo final, asignar cada película y regresar centroides a unidades originales.
    model = KMeans(n_clusters=best_k, random_state=42, n_init=10)
    clean["cluster"] = model.fit_predict(x_scaled)
    centers_original = scaler.inverse_transform(model.cluster_centers_)
    centers = pd.DataFrame(centers_original, columns=FEATURES)
    centers_scaled = model.cluster_centers_

    # Dar nombres descriptivos según el nivel relativo de los centroides estandarizados.
    group_scores = centers_scaled.mean(axis=1)
    ordered_groups = sorted(range(best_k), key=lambda group: group_scores[group])
    if best_k == 2:
        names = {
            ordered_groups[0]: "Medias más bajas en las variables",
            ordered_groups[1]: "Medias más altas en las variables",
        }
    else:
        names = {
            group: f"Grupo {group} · perfil {rank + 1} de {best_k}"
            for rank, group in enumerate(ordered_groups)
        }
    clean["cluster_name"] = clean["cluster"].map(names)

    groups = []
    for group_id in range(best_k):
        subset = clean.loc[clean["cluster"] == group_id]
        feature_stats = {}
        for feature in FEATURES:
            values = subset[feature]
            feature_stats[feature] = {
                "count": int(values.count()),
                "mean": number(values.mean()),
                "median": number(values.median()),
                "std": number(values.std()),
                "min": number(values.min()),
                "max": number(values.max()),
            }
        groups.append(
            {
                "id": group_id,
                "name": names[group_id],
                "count": int(len(subset)),
                "share": number(len(subset) / len(clean) * 100),
                "centroid": {
                    feature: number(centers.loc[group_id, feature])
                    for feature in FEATURES
                },
                "stats": feature_stats,
            }
        )

    # Exportar un registro compacto por película para que React filtre y grafique los datos reales.
    rows = []
    for row in clean.itertuples(index=False):
        row_values = row._asdict()
        raw_genres = row_values.get("genres")
        raw_year = row_values.get("release_year")
        raw_id = row_values.get("id")
        rows.append(
            {
                "id": int(raw_id) if pd.notna(raw_id) else None,
                "title": str(row_values.get("title") or "Sin título"),
                "year": int(raw_year) if pd.notna(raw_year) else None,
                "genres": parse_genres(raw_genres),
                "runtime": number(row_values.get("runtime")),
                "popularity": number(row_values.get("popularity")),
                "vote_average": number(row_values.get("vote_average")),
                "vote_count": number(row_values.get("vote_count")),
                "cluster": int(row_values["cluster"]),
                "cluster_name": str(row_values["cluster_name"]),
            }
        )

    payload = {
        "source": csv_path.name,
        "original_rows": int(len(original)),
        "clean_rows": int(len(clean)),
        "features": FEATURES,
        "selected_k": int(best_k),
        "silhouette": number(
            next(item["silhouette"] for item in evaluation if item["k"] == best_k)
        ),
        "inertia": number(
            next(item["inertia"] for item in evaluation if item["k"] == best_k)
        ),
        "evaluation": evaluation,
        "centers": [
            {
                "id": group_id,
                "name": names[group_id],
                **{feature: number(centers.loc[group_id, feature]) for feature in FEATURES},
            }
            for group_id in range(best_k)
        ],
        "groups": groups,
        "cleaning": {
            "duplicate_rows_removed": int(duplicate_rows_removed),
            "duplicate_ids_removed": int(duplicate_ids_removed),
            "invalid_rows_removed": int(invalid_rows_removed),
        },
        "rows": rows,
    }

    output_dir = dashboard_dir / "public"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / "dashboard-data.json"
    processed_dir = dashboard_dir.parent / "datos"
    processed_dir.mkdir(parents=True, exist_ok=True)
    processed_csv_path = processed_dir / "peliculas_tmdb_clusterizadas.csv"
    clean.to_csv(processed_csv_path, index=False, encoding="utf-8-sig")
    output_path.write_text(
        json.dumps(payload, ensure_ascii=False, allow_nan=False, separators=(",", ":")),
        encoding="utf-8",
    )

    print(f"CSV procesado: {csv_path}")
    print(f"Registros limpios: {len(clean):,}")
    print(f"K seleccionado: {best_k} · Silhouette: {payload['silhouette']:.3f}")
    print(f"Dataset procesado CSV: {processed_csv_path}")
    print(f"Datos para React: {output_path}")


if __name__ == "__main__":
    main()
