# Dashboard CineScope

Dashboard de dos páginas creado con React y Recharts. Presenta el análisis general del catálogo TMDb y los resultados de K-Means. Los datos se preparan en Python mediante `prepare_data.py`; la interfaz lee `public/dashboard-data.json`.

El CSV incluido corresponde al conjunto TMDB 5000 Movie Dataset, atribuido a [Kaggle](https://www.kaggle.com/tmdb/tmdb-movie-metadata?select=tmdb_5000_movies.csv) y a datos recopilados desde la API de TMDb.
## Ejecutar en Windows

Desde esta carpeta se requiere Python 3.10 o posterior y Node.js 22.12 o posterior:

```powershell
python -m pip install -r requirements-python.txt
python prepare_data.py
npm ci
npm run dev
```

El CSV original está junto a este archivo y se llama `tmdb_5000_movies.csv`. El preparador también busca el CSV en la carpeta padre. Para proporcionar otra ruta:

```powershell
python prepare_data.py --csv "C:\ruta\tmdb_5000_movies.csv"
```

La preparación genera `public/dashboard-data.json`, que utiliza React, y `../datos/peliculas_tmdb_clusterizadas.csv`, que conserva el dataset limpio con la etiqueta y el nombre del clúster. Si actualizas el CSV, vuelve a ejecutar `python prepare_data.py`.

## Secciones

- **Análisis general:** indicadores, tendencias por año, calificaciones, géneros y resumen de limpieza.
- **Segmentación K-Means:** distribución, dispersión y centroides, comparaciones, estadísticas por grupo, filtros, hallazgos y evaluación de K.
