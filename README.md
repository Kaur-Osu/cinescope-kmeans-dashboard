# CineScope: análisis y segmentación de películas TMDb

Proyecto de minería de datos que agrupa películas del conjunto TMDb 5000 Movies mediante K-Means y presenta los resultados en un dashboard interactivo desarrollado con React.

## Contenido del repositorio

- **Documentación:** informe final en PDF dentro de `documentacion/`.
- **Código del análisis:** `Proyecto.py`, con limpieza, evaluación de K, entrenamiento final, gráficas y exportación del dataset con clústeres.
- **Dataset original:** `Dashboard/tmdb_5000_movies.csv`.
- **Dataset procesado:** `datos/peliculas_tmdb_clusterizadas.csv`, con las etiquetas de clúster.
- **Dashboard:** aplicación React/Vite en `Dashboard/`. El archivo `Dashboard/public/dashboard-data.json` contiene los registros procesados que carga la aplicación.

## Fuente del dataset

El proyecto utiliza la copia de tmdb_5000_movies.csv incluida en este repositorio. El conjunto TMDB 5000 Movie Dataset se atribuye a [Kaggle](https://www.kaggle.com/tmdb/tmdb-movie-metadata?select=tmdb_5000_movies.csv) y a información recopilada mediante la API de The Movie Database (TMDb). La copia del CSV publicada aquí es la utilizada para producir los resultados de este análisis.
## Herramientas

- Python, Pandas, NumPy, Matplotlib y Scikit-learn.
- React, Vite, Recharts y Lucide.
- Node.js 22.12 o posterior.

## Estructura

```text
.
├── Proyecto.py
├── README.md
├── datos/
│   └── peliculas_tmdb_clusterizadas.csv
├── documentacion/
│   └── Proyecto K-means.pdf
└── Dashboard/
    ├── tmdb_5000_movies.csv
    ├── prepare_data.py
    ├── public/
    │   └── dashboard-data.json
    ├── src/
    ├── package.json
    └── requirements-python.txt
```

## Preparar los datos y ejecutar el análisis

Desde la carpeta raíz del repositorio, crea y activa un entorno virtual e instala las dependencias:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r Dashboard/requirements-python.txt
```

El CSV original está dentro de `Dashboard`. El código principal lo localiza allí automáticamente. Para volver a limpiar los datos, comparar K y generar `datos/peliculas_tmdb_clusterizadas.csv`, ejecuta:

```powershell
python Proyecto.py
```

Este programa también muestra las gráficas del análisis. Para regenerar los archivos que usa el dashboard, ejecuta:

```powershell
python Dashboard/prepare_data.py
```

Se actualizarán `Dashboard/public/dashboard-data.json` y `datos/peliculas_tmdb_clusterizadas.csv`.

## Iniciar el dashboard

Desde la carpeta raíz:

```powershell
cd Dashboard
npm ci
npm run dev
```

Abre en el navegador la dirección local que indique Vite. El dashboard tiene secciones de análisis general y segmentación K-Means. Los filtros de año, género y calificación se aplican al pulsar **Aplicar filtros**.

Si cambias el CSV, vuelve a ejecutar `python prepare_data.py` desde `Dashboard` (o `python Dashboard/prepare_data.py` desde la raíz) antes de abrir o actualizar la página.
