# Importar las librerías necesarias
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score
from pathlib import Path

# Seleccionar y cargar el dataset desde la carpeta del programa o Dashboard
carpeta_proyecto = Path(__file__).resolve().parent
posibles_csv = [
    carpeta_proyecto / "Dashboard" / "tmdb_5000_movies.csv",
    carpeta_proyecto / "tmdb_5000_movies.csv",
]
archivo_csv = next((ruta for ruta in posibles_csv if ruta.exists()), None)
if archivo_csv is None:
    raise FileNotFoundError(
        "No se encontró tmdb_5000_movies.csv en la raíz del proyecto ni en Dashboard."
    )
df = pd.read_csv(archivo_csv)
print(f"Archivo CSV cargado: {archivo_csv}")

# Mostrar los datos originales
print("\nDatos originales:")
print(df)

# Identificar la fuente de obtención de los datos
print("\nFuente de obtención de los datos:")
print(
    "Se utilizará el conjunto TMDb 5000 Movies, publicado originalmente "
    "en Kaggle con información de películas recopilada de The Movie Database (TMDb)."
)

# Mostrar los primeros 10 registros
print("\nPrimeros 10 registros:")
print(df.head(10))

# Mostrar el número de filas y columnas
print("\nDimensiones del dataset:")
print(f"Filas: {df.shape[0]}")
print(f"Columnas: {df.shape[1]}")

# Mostrar los nombres de las columnas
print("\nColumnas del dataset:")
print(df.columns.tolist())

# Mostrar el tipo de dato de cada columna
print("\nTipos de datos:")
print(df.dtypes)

# Obtener estadísticas descriptivas de las columnas numéricas
print("\nEstadísticas descriptivas:")
print(df.describe().round(2))

# Identificar los valores nulos por columna
print("\nValores nulos por columna:")
print(df.isnull().sum().sort_values(ascending=False))

# Contar todas las celdas nulas
print("\nTotal de celdas nulas:")
print(df.isnull().sum().sum())

# Contar filas duplicadas completas
print("\nFilas duplicadas:")
print(df.duplicated().sum())

# Contar identificadores de película duplicados
print("\nIDs de película duplicados:")
print(df["id"].duplicated().sum())

# Crear una copia para limpiar sin modificar los datos originales
df_limpio = df.copy()

# Tratar las cadenas vacías o con espacios como valores nulos
df_limpio = df_limpio.replace(r"^\s*$", pd.NA, regex=True)

# Quitar espacios al inicio y al final de los datos de texto
for columna in df_limpio.select_dtypes(include=["object", "str"]).columns:
    df_limpio[columna] = df_limpio[columna].str.strip()

# Eliminar filas completamente duplicadas
filas_antes = len(df_limpio)
df_limpio = df_limpio.drop_duplicates()
duplicados_completos_eliminados = filas_antes - len(df_limpio)

# Eliminar identificadores duplicados y conservar la primera película
filas_antes = len(df_limpio)
df_limpio = df_limpio.drop_duplicates(subset="id", keep="first")
ids_duplicados_eliminados = filas_antes - len(df_limpio)

# Seleccionar las tres variables que se utilizarán en el agrupamiento
# runtime representa duración; popularity, popularidad; vote_average, calificación
variables = ["runtime", "popularity", "vote_average"]

# Convertir las variables del modelo a valores numéricos
# Los valores que no puedan convertirse se tratarán como nulos
valores_no_numericos = {}

for variable in variables:
    valores_originales = df_limpio[variable].notna()
    df_limpio[variable] = pd.to_numeric(
        df_limpio[variable],
        errors="coerce"
    )
    valores_no_numericos[variable] = (
        valores_originales & df_limpio[variable].isna()
    ).sum()

# Marcar como nulos los valores cero o negativos de las variables del modelo
valores_no_positivos = {}

for variable in variables:
    mascara = (
        df_limpio[variable].notna()
        & (df_limpio[variable] <= 0)
    )
    valores_no_positivos[variable] = mascara.sum()
    df_limpio.loc[mascara, variable] = pd.NA

# Rellenar los datos faltantes de texto con una etiqueta descriptiva
columnas_texto = df_limpio.select_dtypes(include=["object", "str"]).columns
df_limpio[columnas_texto] = df_limpio[columnas_texto].fillna(
    "Sin información"
)

# Eliminar películas que no tengan datos válidos en las variables del modelo
filas_antes = len(df_limpio)
df_limpio = df_limpio.dropna(subset=variables).copy()
filas_invalidas_eliminadas = filas_antes - len(df_limpio)

# Asegurar que las variables del modelo sean numéricas
df_limpio[variables] = df_limpio[variables].astype(float)

# Usar los datos limpios para el análisis y las gráficas
datos_grafica = df_limpio.copy()

# Mostrar los resultados de la limpieza
print("\nResultados de la limpieza:")
print(f"Filas originales: {len(df)}")
print(
    "Filas duplicadas completas eliminadas: "
    f"{duplicados_completos_eliminados}"
)
print(f"IDs duplicados eliminados: {ids_duplicados_eliminados}")
print(
    "Filas sin datos válidos para el modelo eliminadas: "
    f"{filas_invalidas_eliminadas}"
)
print(f"Registros finales: {len(datos_grafica)}")
print(f"Dimensiones finales: {datos_grafica.shape}")
print(f"Celdas nulas restantes: {datos_grafica.isnull().sum().sum()}")

# Mostrar los tipos de datos corregidos de las variables del modelo
print("\nTipos de datos de las variables del modelo:")
print(datos_grafica[variables].dtypes)

# Mostrar los valores no numéricos convertidos a nulos
print("\nValores no numéricos convertidos a nulos:")
print(valores_no_numericos)

# Mostrar los valores cero o negativos tratados como inválidos
print("\nValores cero o negativos tratados como inválidos:")
print(valores_no_positivos)

# Identificar valores atípicos usando el rango intercuartílico
# Se conservan porque pueden corresponder a películas reales
print("\nValores atípicos identificados con el método IQR:")

for variable in variables:
    q1 = datos_grafica[variable].quantile(0.25)
    q3 = datos_grafica[variable].quantile(0.75)
    rango_intercuartilico = q3 - q1
    limite_inferior = q1 - 1.5 * rango_intercuartilico
    limite_superior = q3 + 1.5 * rango_intercuartilico

    atipicos = (
        (datos_grafica[variable] < limite_inferior)
        | (datos_grafica[variable] > limite_superior)
    ).sum()

    print(f"{variable}: {atipicos}")

# Preparar las variables y escalarlas para que tengan una escala comparable
X = datos_grafica[variables]
escalador = StandardScaler()
X_escalado = escalador.fit_transform(X)

# Mostrar las estadísticas de los datos escalados
print("\nPromedios y desviaciones de las variables escaladas:")
print(
    pd.DataFrame(X_escalado, columns=variables)
    .describe()
    .loc[["mean", "std"]]
    .round(2)
)

# Evaluar cinco valores de K, desde 2 hasta 6
valores_k = range(2, 7)
resultados_k = []
etiquetas_por_k = {}

for k in valores_k:
    # Crear y entrenar un modelo de prueba para el valor actual de K
    modelo_prueba = KMeans(
        n_clusters=k,
        random_state=42,
        n_init=10
    )

    # Asignar un grupo a cada película para este valor de K
    etiquetas = modelo_prueba.fit_predict(X_escalado)
    etiquetas_por_k[k] = etiquetas

    # Calcular la inercia y el coeficiente Silhouette
    inercia = modelo_prueba.inertia_
    silueta = silhouette_score(X_escalado, etiquetas)

    # Guardar las métricas de este valor de K
    resultados_k.append({
        "K": k,
        "Inercia": inercia,
        "Silhouette": silueta
    })

# Organizar y mostrar los resultados de la evaluación
resultados_k = pd.DataFrame(resultados_k)

print("\nEvaluación de cinco valores de K:")
print(resultados_k.round(3).to_string(index=False))

# Seleccionar el valor de K con el coeficiente Silhouette más alto
fila_mejor = resultados_k["Silhouette"].idxmax()
mejor_k = int(resultados_k.loc[fila_mejor, "K"])
mejor_silueta = resultados_k.loc[fila_mejor, "Silhouette"]

print(f"\nNúmero de clústeres seleccionado: K = {mejor_k}")
print(f"Coeficiente Silhouette: {mejor_silueta:.3f}")
print(
    "Se selecciona este K porque obtuvo el coeficiente Silhouette "
    "más alto entre los valores evaluados."
)

# Graficar la inercia y Silhouette para comparar los valores de K
figura, ejes = plt.subplots(1, 2, figsize=(12, 5))

ejes[0].plot(
    resultados_k["K"],
    resultados_k["Inercia"],
    marker="o"
)
ejes[0].set_title("Método del codo")
ejes[0].set_xlabel("Número de clústeres (K)")
ejes[0].set_ylabel("Inercia")
ejes[0].grid(True)

ejes[1].plot(
    resultados_k["K"],
    resultados_k["Silhouette"],
    marker="o",
    color="green"
)
ejes[1].set_title("Coeficiente Silhouette")
ejes[1].set_xlabel("Número de clústeres (K)")
ejes[1].set_ylabel("Silhouette")
ejes[1].grid(True)

plt.tight_layout()
plt.show()

# Comparar el K seleccionado con K=3
# Si el seleccionado ya es 3, se compara con K=2
if mejor_k == 3:
    k_alternativo = 2
else:
    k_alternativo = 3

print("\nComparación de dos configuraciones:")

for k in [k_alternativo, mejor_k]:
    resultado = resultados_k[resultados_k["K"] == k].iloc[0]
    cantidades = (
        pd.Series(etiquetas_por_k[k])
        .value_counts()
        .sort_index()
    )

    print(f"\nConfiguración con K = {k}:")
    print(f"Inercia: {resultado['Inercia']:.2f}")
    print(f"Silhouette: {resultado['Silhouette']:.3f}")
    print("Películas por grupo:")
    print(cantidades.to_string())

# Mostrar la diferencia entre las dos configuraciones
silueta_alternativa = resultados_k.loc[
    resultados_k["K"] == k_alternativo,
    "Silhouette"
].iloc[0]

diferencia_silueta = mejor_silueta - silueta_alternativa

print(
    f"\nK = {mejor_k} obtuvo un Silhouette "
    f"{diferencia_silueta:.3f} puntos mayor que K = {k_alternativo}."
)
print(
    "Una configuración con más clústeres puede separar los datos en "
    "grupos más específicos. La métrica Silhouette ayuda a comparar "
    "si esa separación mejora."
)

# Entrenar el modelo final utilizando el K seleccionado
modelo = KMeans(
    n_clusters=mejor_k,
    random_state=42,
    n_init=10
)

# Asignar un clúster final a cada película mediante fit_predict()
datos_grafica["Grupo"] = modelo.fit_predict(X_escalado)

# Convertir los centroides a las unidades originales
centroides = pd.DataFrame(
    escalador.inverse_transform(modelo.cluster_centers_),
    columns=variables
)
centroides.index.name = "Grupo"

# Asignar un nombre descriptivo a cada grupo, basado en sus promedios
nombres_grupos = {
    0: "Medias más bajas en las variables",
    1: "Medias más altas en las variables"
}
datos_grafica["NombreGrupo"] = datos_grafica["Grupo"].map(nombres_grupos)

# Guardar el dataset limpio con las etiquetas asignadas por K-Means
carpeta_datos = carpeta_proyecto / "datos"
carpeta_datos.mkdir(parents=True, exist_ok=True)
archivo_procesado = carpeta_datos / "peliculas_tmdb_clusterizadas.csv"
datos_exportar = datos_grafica.rename(
    columns={"Grupo": "cluster", "NombreGrupo": "cluster_name"}
)
datos_exportar.to_csv(archivo_procesado, index=False, encoding="utf-8-sig")
print(f"\nDataset procesado guardado en: {archivo_procesado}")

# Calcular estadísticas descriptivas para cada grupo
estadisticas_por_grupo = datos_grafica.groupby("Grupo")[variables].agg(
    ["count", "mean", "median", "std", "min", "max"]
).round(2)

print("\nEstadísticas descriptivas por grupo:")
print(estadisticas_por_grupo)

# Crear una tabla comparativa con cantidad, porcentaje y promedios
tabla_comparativa = datos_grafica.groupby("Grupo").agg(
    Peliculas=("Grupo", "size"),
    Duracion_promedio=("runtime", "mean"),
    Popularidad_promedio=("popularity", "mean"),
    Calificacion_promedio=("vote_average", "mean")
)

tabla_comparativa.insert(
    0,
    "Nombre del grupo",
    tabla_comparativa.index.map(nombres_grupos)
)
tabla_comparativa["Porcentaje"] = (
    tabla_comparativa["Peliculas"] / len(datos_grafica) * 100
)

print("\nTabla comparativa de los grupos:")
print(tabla_comparativa.round(2))

# Mostrar la cantidad de películas pertenecientes a cada clúster
print(f"\nPelículas por grupo en el modelo final (K = {mejor_k}):")
print(datos_grafica["Grupo"].value_counts().sort_index())

# Mostrar los centroides en las unidades originales
print("\nCentroides del modelo final en unidades originales:")
print(centroides.round(2))

# Mostrar la inercia del modelo final
print("\nInercia del modelo final:")
print(round(modelo.inertia_, 2))

# Graficar duración y popularidad con los centroides
plt.figure(figsize=(10, 5))

plt.scatter(
    datos_grafica["runtime"],
    datos_grafica["popularity"],
    c=datos_grafica["Grupo"],
    cmap="viridis",
    s=60,
    label="Películas"
)

plt.scatter(
    centroides["runtime"],
    centroides["popularity"],
    color="red",
    marker="X",
    s=250,
    label="Centroides"
)

plt.title(f"Agrupación de películas con K-Means (K={mejor_k})")
plt.xlabel("Duración en minutos")
plt.ylabel("Popularidad TMDb")
plt.legend()
plt.grid(True)
plt.tight_layout()
plt.show()

# Graficar duración y calificación con los centroides
plt.figure(figsize=(10, 5))

plt.scatter(
    datos_grafica["runtime"],
    datos_grafica["vote_average"],
    c=datos_grafica["Grupo"],
    cmap="viridis",
    s=60,
    label="Películas"
)

plt.scatter(
    centroides["runtime"],
    centroides["vote_average"],
    color="red",
    marker="X",
    s=250,
    label="Centroides"
)

plt.title(f"Agrupación de películas con K-Means (K={mejor_k})")
plt.xlabel("Duración en minutos")
plt.ylabel("Calificación promedio")
plt.legend()
plt.grid(True)
plt.tight_layout()
plt.show()

# Graficar popularidad y calificación con los centroides
plt.figure(figsize=(10, 5))

plt.scatter(
    datos_grafica["popularity"],
    datos_grafica["vote_average"],
    c=datos_grafica["Grupo"],
    cmap="viridis",
    s=60,
    label="Películas"
)

plt.scatter(
    centroides["popularity"],
    centroides["vote_average"],
    color="red",
    marker="X",
    s=250,
    label="Centroides"
)

plt.title(f"Agrupación de películas con K-Means (K={mejor_k})")
plt.xlabel("Popularidad TMDb")
plt.ylabel("Calificación promedio")
plt.legend()
plt.grid(True)
plt.tight_layout()
plt.show()
