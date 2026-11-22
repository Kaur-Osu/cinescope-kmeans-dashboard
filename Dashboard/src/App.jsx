import React, { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart,
  Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";
import {
  Activity, BarChart3, CalendarDays, Check, ChevronDown, CircleHelp,
  Clapperboard, Clock3, Database, Download, Film, Filter, Layers3, LayoutDashboard,
  ListFilter, LoaderCircle, RotateCcw, SlidersHorizontal, Sparkles, Star, TrendingUp,
} from "lucide-react";

const COLORS = ["#7467F0", "#24A99A", "#F2A34A", "#42A6D8", "#E36C8B", "#87B85B"];
const FEATURE_LABELS = {
  runtime: "Duración (min)",
  popularity: "Popularidad TMDb",
  vote_average: "Calificación",
};
const nf = new Intl.NumberFormat("es-MX");
const dec = (value, digits = 1) =>
  Number.isFinite(Number(value))
    ? new Intl.NumberFormat("es-MX", { maximumFractionDigits: digits }).format(Number(value))
    : "—";

function describe(values) {
  if (!values.length) return { count: 0, mean: 0, median: 0, std: 0, min: 0, max: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  const variance = sorted.length > 1
    ? sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (sorted.length - 1)
    : 0;
  return { count: sorted.length, mean, median, std: Math.sqrt(variance), min: sorted[0], max: sorted.at(-1) };
}

function MultiSelect({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="multi-select">
      <span className="filter-label">{label}</span>
      <button className={`select-trigger ${open ? "is-open" : ""}`} onClick={() => setOpen(!open)}>
        <span>{selected.length ? `${selected.length} seleccionados` : "Todos los géneros"}</span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="select-menu">
          <button className="select-clear" onClick={() => onChange([])}>Limpiar selección</button>
          <div className="select-options">
            {options.map((option) => (
              <label className="check-option" key={option}>
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  onChange={(event) => onChange(
                    event.target.checked
                      ? [...selected, option]
                      : selected.filter((item) => item !== option),
                  )}
                />
                <span>{option}</span>
                {selected.includes(option) && <Check size={14} />}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RangeFilter({ label, low, high, min, max, step, setRange, suffix = "" }) {
  const lowNumber = Number(low);
  const highNumber = Number(high);
  return (
    <div className="range-filter">
      <div className="range-heading">
        <span className="filter-label">{label}</span>
        <span className="range-readout">{dec(lowNumber, 1)}{suffix} — {dec(highNumber, 1)}{suffix}</span>
      </div>
      <input
        aria-label={`${label}: mínimo`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={lowNumber}
        onChange={(event) => setRange([Math.min(Number(event.target.value), highNumber), highNumber])}
      />
      <input
        aria-label={`${label}: máximo`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={highNumber}
        onChange={(event) => setRange([lowNumber, Math.max(Number(event.target.value), lowNumber)])}
      />
      <div className="range-endpoints"><span>{dec(min, 1)}{suffix}</span><span>{dec(max, 1)}{suffix}</span></div>
    </div>
  );
}

function CustomTooltip({ active, payload, label, format = (value) => nf.format(value) }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      {label !== undefined && <strong>{label}</strong>}
      {payload.map((entry, index) => (
        <div className="tooltip-row" key={`${entry.name}-${index}`}>
          <i style={{ background: entry.color || entry.fill }} />
          <span>{entry.name || entry.dataKey}</span>
          <b>{format(entry.value)}</b>
        </div>
      ))}
    </div>
  );
}

function ChartCard({ title, subtitle, icon: Icon, children, className = "" }) {
  return (
    <section className={`panel chart-card ${className}`}>
      <div className="panel-heading">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {Icon && <span className="panel-icon"><Icon size={17} /></span>}
      </div>
      {children}
    </section>
  );
}

function KpiCard({ icon: Icon, label, value, detail, tone, delay = 0 }) {
  return (
    <article className={`kpi-card tone-${tone}`} style={{ animationDelay: `${delay}ms` }}>
      <div className="kpi-top"><span className="kpi-icon"><Icon size={18} /></span><span className="kpi-detail">{detail}</span></div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
    </article>
  );
}

function CrossMark({ cx, cy }) {
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  return (
    <g stroke="#f05b5b" strokeWidth="3.5" strokeLinecap="round">
      <line x1={cx - 7} y1={cy - 7} x2={cx + 7} y2={cy + 7} />
      <line x1={cx + 7} y1={cy - 7} x2={cx - 7} y2={cy + 7} />
    </g>
  );
}

const FilterControls = React.memo(function FilterControls({ yearBounds, ratingBounds, genreOptions, appliedFilters, onApply, isApplying }) {
  const [draftFilters, setDraftFilters] = useState(appliedFilters);

  useEffect(() => {
    setDraftFilters({
      years: [...appliedFilters.years],
      ratings: [...appliedFilters.ratings],
      genres: [...appliedFilters.genres],
    });
  }, [appliedFilters]);

  const changed = JSON.stringify(draftFilters) !== JSON.stringify(appliedFilters);
  const reset = () => setDraftFilters({ years: yearBounds, ratings: ratingBounds, genres: [] });
  const setYears = (years) => setDraftFilters((old) => ({ ...old, years }));
  const setRatings = (ratings) => setDraftFilters((old) => ({ ...old, ratings }));
  const setGenres = (genres) => setDraftFilters((old) => ({ ...old, genres }));

  return (
    <div className="filters-stack">
      <RangeFilter label="Año de estreno" low={draftFilters.years[0]} high={draftFilters.years[1]} min={yearBounds[0]} max={yearBounds[1]} step={1} setRange={setYears} />
      <MultiSelect label="Género" options={genreOptions} selected={draftFilters.genres} onChange={setGenres} />
      <RangeFilter label="Calificación promedio" low={draftFilters.ratings[0]} high={draftFilters.ratings[1]} min={ratingBounds[0]} max={ratingBounds[1]} step={0.1} setRange={setRatings} />
      <div className="filter-actions">
        <button className="apply-filters-button" onClick={() => onApply(draftFilters)} disabled={!changed || isApplying}>
          {isApplying ? <LoaderCircle size={15} className="spin-icon" /> : <Filter size={15} />}
          {isApplying ? "Aplicando…" : "Aplicar filtros"}
        </button>
        <button className="reset-button" onClick={reset} disabled={isApplying}><RotateCcw size={14} /> Restablecer</button>
      </div>
      {changed && <div className="pending-filters"><span /> Cambios pendientes de aplicar</div>}
    </div>
  );
});

function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState("general");
  const [appliedFilters, setAppliedFilters] = useState({ years: [0, 0], ratings: [0, 10], genres: [] });
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    fetch("/dashboard-data.json")
      .then((response) => {
        if (!response.ok) throw new Error("No se encontró dashboard-data.json.");
        return response.json();
      })
      .then((payload) => {
        setData(payload);
        const years = payload.rows.map((row) => row.year).filter(Number.isFinite);
        const ratings = payload.rows.map((row) => row.vote_average).filter(Number.isFinite);
        const initialFilters = {
          years: [Math.min(...years), Math.max(...years)],
          ratings: [Math.min(...ratings), Math.max(...ratings)],
          genres: [],
        };
        setAppliedFilters(initialFilters);
      })
      .catch((reason) => setError(reason.message));
  }, []);

  const yearBounds = useMemo(() => {
    const years = data?.rows.map((row) => row.year).filter(Number.isFinite) ?? [];
    return years.length ? [Math.min(...years), Math.max(...years)] : [0, 0];
  }, [data]);
  const ratingBounds = useMemo(() => {
    const values = data?.rows.map((row) => row.vote_average).filter(Number.isFinite) ?? [];
    return values.length ? [Math.min(...values), Math.max(...values)] : [0, 10];
  }, [data]);
  const genreOptions = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.rows.flatMap((row) => row.genres))].sort((a, b) => a.localeCompare(b, "es"));
  }, [data]);

  const visibleRows = useMemo(() => {
    if (!data) return [];
    const allYears = appliedFilters.years[0] === yearBounds[0] && appliedFilters.years[1] === yearBounds[1];
    const selectedGenres = new Set(appliedFilters.genres);
    return data.rows.filter((row) => {
      const yearMatches = row.year == null
        ? allYears
        : row.year >= appliedFilters.years[0] && row.year <= appliedFilters.years[1];
      const ratingMatches = row.vote_average >= appliedFilters.ratings[0] && row.vote_average <= appliedFilters.ratings[1];
      const genreMatches = !selectedGenres.size || row.genres.some((genre) => selectedGenres.has(genre));
      return yearMatches && ratingMatches && genreMatches;
    });
  }, [data, appliedFilters, yearBounds]);

  const groupRows = useMemo(() => {
    if (!data) return [];
    return data.groups.map((group) => {
      const items = visibleRows.filter((row) => row.cluster === group.id);
      const stats = Object.fromEntries(
        ["runtime", "popularity", "vote_average"].map((feature) => [
          feature,
          describe(items.map((row) => row[feature]).filter(Number.isFinite)),
        ]),
      );
      return { ...group, visibleCount: items.length, visibleShare: visibleRows.length ? items.length / visibleRows.length * 100 : 0, stats, rows: items };
    });
  }, [data, visibleRows]);

  const yearChart = useMemo(() => {
    const counts = new Map();
    visibleRows.forEach((row) => {
      if (row.year != null) counts.set(row.year, (counts.get(row.year) ?? 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([year, movies]) => ({ year, movies }));
  }, [visibleRows]);

  const ratingChart = useMemo(() => {
    const counts = new Map();
    visibleRows.forEach((row) => {
      const start = Math.floor(row.vote_average * 2) / 2;
      counts.set(start, (counts.get(start) ?? 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([start, movies]) => ({
      interval: `${start.toFixed(1)}–${(start + 0.5).toFixed(1)}`,
      movies,
    }));
  }, [visibleRows]);

  const genreChart = useMemo(() => {
    const counts = new Map();
    visibleRows.forEach((row) => row.genres.forEach((genre) => counts.set(genre, (counts.get(genre) ?? 0) + 1)));
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([genre, movies]) => ({ genre, movies }));
  }, [visibleRows]);

  const applyFilters = useCallback((nextFilters) => {
    if (isApplying) return;
    setIsApplying(true);
    window.setTimeout(() => {
      startTransition(() => setAppliedFilters({
        years: [...nextFilters.years],
        ratings: [...nextFilters.ratings],
        genres: [...nextFilters.genres],
      }));
    }, 180);
  }, [isApplying]);

  useEffect(() => {
    if (!isApplying) return undefined;
    const timer = window.setTimeout(() => setIsApplying(false), 650);
    return () => window.clearTimeout(timer);
  }, [appliedFilters, isApplying]);

  const averages = useMemo(() => ({
    runtime: visibleRows.length ? visibleRows.reduce((sum, row) => sum + row.runtime, 0) / visibleRows.length : 0,
    popularity: visibleRows.length ? visibleRows.reduce((sum, row) => sum + row.popularity, 0) / visibleRows.length : 0,
    vote_average: visibleRows.length ? visibleRows.reduce((sum, row) => sum + row.vote_average, 0) / visibleRows.length : 0,
  }), [visibleRows]);

  if (error) {
    return (
      <div className="startup-state">
        <span className="startup-mark"><Database size={26} /></span>
        <h1>No se pudieron cargar los datos</h1>
        <p>{error} Ejecuta primero <code>python prepare_data.py</code> para generar el archivo procesado por Python.</p>
      </div>
    );
  }
  if (!data) {
    return <div className="startup-state"><span className="loader" /><h1>Preparando CineScope…</h1><p>Cargando el dataset y el análisis K-Means.</p></div>;
  }

  const activePageTitle = page === "general" ? "Análisis general" : "Segmentación K-Means";
  const percentVisible = data.rows.length ? visibleRows.length / data.rows.length * 100 : 0;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-symbol"><Clapperboard size={21} /></div>
          <div><strong>CineScope</strong><span>TMDb INSIGHTS</span></div>
        </div>

        <div className="side-caption">ESPACIO DE ANÁLISIS</div>
        <nav className="side-nav" aria-label="Páginas del dashboard">
          <button className={page === "general" ? "active" : ""} onClick={() => setPage("general")}>
            <LayoutDashboard size={18} /><span>Análisis general</span><i>01</i>
          </button>
          <button className={page === "clusters" ? "active" : ""} onClick={() => setPage("clusters")}>
            <Layers3 size={18} /><span>Segmentación K-Means</span><i>02</i>
          </button>
        </nav>

        <div className="side-divider" />
        <div className="filter-title"><div><SlidersHorizontal size={17} /><span>Filtros</span></div><span className="live-dot">ACTIVOS</span></div>
        <FilterControls
          yearBounds={yearBounds}
          ratingBounds={ratingBounds}
          genreOptions={genreOptions}
          appliedFilters={appliedFilters}
          onApply={applyFilters}
          isApplying={isApplying}
        />

        <div className="sidebar-spacer" />
        <div className="dataset-mini-card">
          <div className="dataset-mini-top"><span className="mini-database"><Database size={15} /></span><span>DATASET ACTIVO</span><span className="status-pulse" /></div>
          <strong>TMDb 5000 Movies</strong>
          <p>{nf.format(data.clean_rows)} películas preparadas en Python</p>
          <div className="mini-progress"><span style={{ width: `${Math.max(2, percentVisible)}%` }} /></div>
          <small>{nf.format(visibleRows.length)} visibles · {dec(percentVisible, 1)}%</small>
        </div>
        <div className="sidebar-foot"><span>Proyecto de minería de datos</span><CircleHelp size={15} /></div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>Dashboard</span><b>/</b><strong>{activePageTitle}</strong></div>
          <div className="topbar-right"><span className="data-status"><i />Datos de Python activos</span><span className="avatar">CM</span></div>
        </header>
        <div className="page-content" key={page}>
          {page === "general" ? (
            <GeneralPage
              data={data} rows={visibleRows} averages={averages}
              yearChart={yearChart} ratingChart={ratingChart} genreChart={genreChart}
              percentVisible={percentVisible}
            />
          ) : (
            <ClustersPage data={data} rows={visibleRows} groups={groupRows} />
          )}
        </div>
        <footer className="app-footer"><span>© Proyecto de extracción de conocimiento · TMDb 5000 Movies</span><span>Python · Scikit-learn · React</span></footer>
      </main>
      {isApplying && (
        <div className="loading-overlay" role="status" aria-live="polite">
          <div className="loading-panel">
            <span className="loading-orbit"><LoaderCircle size={29} className="spin-icon" /></span>
            <span className="loading-eyebrow">ACTUALIZACIÓN EN CURSO</span>
            <h2>Aplicando filtros</h2>
            <p>Actualizando indicadores, estadísticas y gráficas…</p>
            <div className="loading-progress"><span /></div>
          </div>
        </div>
      )}
    </div>
  );
}

function PageHeading({ eyebrow, title, subtitle, right }) {
  return (
    <div className="page-heading">
      <div><div className="eyebrow"><span />{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>
      {right && <div className="heading-side">{right}</div>}
    </div>
  );
}

const GeneralPage = React.memo(function GeneralPage({ data, rows, averages, yearChart, ratingChart, genreChart, percentVisible }) {
  const kpis = [
    { icon: Film, label: "Películas analizadas", value: nf.format(rows.length), detail: `${dec(percentVisible, 1)}% del conjunto`, tone: "violet" },
    { icon: Star, label: "Calificación media", value: <>{dec(averages.vote_average, 2)}<small>/10</small></>, detail: "Promedio visible", tone: "amber" },
    { icon: Clock3, label: "Duración promedio", value: <>{dec(averages.runtime, 1)}<small> min</small></>, detail: "Tiempo en pantalla", tone: "blue" },
    { icon: TrendingUp, label: "Popularidad media", value: dec(averages.popularity, 2), detail: "Índice TMDb", tone: "mint" },
  ];
  return (
    <>
      <PageHeading
        eyebrow="PÁGINA 01 · VISTA DEL DATASET"
        title="El mapa de las películas"
        subtitle="Explora el catálogo TMDb y observa cómo cambian sus características al aplicar filtros."
        right={<span className="period-pill"><CalendarDays size={15} /> Dataset seleccionado</span>}
      />
      <div className="kpi-grid">
        {kpis.map((item, index) => <KpiCard key={item.label} {...item} delay={index * 55} />)}
      </div>

      <div className="section-intro"><div><span className="section-kicker">01 · PANORAMA</span><h2>Una mirada al catálogo</h2></div><span className="subtle-pill"><Activity size={14} /> Se actualiza con los filtros</span></div>
      <div className="chart-grid two-col">
        <ChartCard title="Películas a través del tiempo" subtitle="Cantidad de registros por año de estreno" icon={CalendarDays}>
          <div className="chart-wrap chart-medium">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={yearChart} margin={{ top: 12, right: 10, bottom: 0, left: -14 }}>
                <defs><linearGradient id="yearFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7568f2" stopOpacity={0.27} /><stop offset="100%" stopColor="#7568f2" stopOpacity={0.01} /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="#e9edf4" strokeDasharray="4 5" />
                <XAxis dataKey="year" tick={{ fill: "#657187", fontSize: 12 }} tickLine={false} axisLine={false} minTickGap={22} />
                <YAxis tick={{ fill: "#657187", fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="movies" name="Películas" stroke="#7568f2" strokeWidth={2.5} fill="url(#yearFill)" activeDot={{ r: 5, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-footnote"><span className="legend-dot violet" />Registros en el rango seleccionado</div>
        </ChartCard>

        <ChartCard title="Cómo se distribuyen las calificaciones" subtitle="Frecuencia de puntuaciones promedio" icon={Star}>
          <div className="chart-wrap chart-medium">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ratingChart} margin={{ top: 12, right: 6, bottom: 0, left: -16 }}>
                <CartesianGrid vertical={false} stroke="#e9edf4" strokeDasharray="4 5" />
                <XAxis dataKey="interval" tick={{ fill: "#657187", fontSize: 12 }} tickLine={false} axisLine={false} interval={1} angle={-25} textAnchor="end" height={48} />
                <YAxis tick={{ fill: "#657187", fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="movies" name="Películas" fill="#24a99a" radius={[5, 5, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-footnote"><span className="legend-dot mint" />Calificación promedio TMDb, agrupada en intervalos de 0.5</div>
        </ChartCard>
      </div>

      <div className="section-intro"><div><span className="section-kicker">02 · COMPOSICIÓN DEL CATÁLOGO</span><h2>Géneros y calidad de los datos</h2></div><span className="subtle-pill"><Database size={14} /> Datos preparados en Python</span></div>
      <div className="chart-grid general-bottom">
        <ChartCard title="Géneros más frecuentes" subtitle="Un título puede pertenecer a más de un género" icon={Clapperboard}>
          <div className="chart-wrap chart-genres">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={genreChart} layout="vertical" margin={{ top: 2, right: 22, bottom: 0, left: 5 }}>
                <CartesianGrid horizontal={false} stroke="#e9edf4" strokeDasharray="4 5" />
                <XAxis type="number" tick={{ fill: "#657187", fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="genre" width={112} tick={{ fill: "#69748a", fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="movies" name="Películas" fill="#42a6d8" radius={[0, 5, 5, 0]} maxBarSize={17} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <section className="panel dataset-panel">
          <div className="panel-heading"><div><h3>Datos listos para el análisis</h3><p>Preparación aplicada en Python antes de visualizar</p></div><span className="panel-icon"><Database size={17} /></span></div>
          <div className="dataset-stat"><span>Registros originales</span><b>{nf.format(data.original_rows)}</b></div>
          <div className="dataset-stat"><span>Películas utilizables</span><b>{nf.format(data.clean_rows)}</b></div>
          <div className="dataset-stat"><span>Duplicados completos quitados</span><b>{nf.format(data.cleaning.duplicate_rows_removed)}</b></div>
          <div className="dataset-stat"><span>ID repetidos quitados</span><b>{nf.format(data.cleaning.duplicate_ids_removed)}</b></div>
          <div className="dataset-stat"><span>Registros sin variables válidas</span><b>{nf.format(data.cleaning.invalid_rows_removed)}</b></div>
          <div className="feature-chips"><span>runtime</span><span>popularity</span><span>vote_average</span></div>
          <p className="dataset-note">Las tres variables se convirtieron a formato numérico, se validaron y se escalaron con StandardScaler para el agrupamiento.</p>
        </section>
      </div>
      <div className="insight-strip"><span className="insight-icon"><Sparkles size={18} /></span><div><strong>Explora antes de agrupar</strong><p>Los filtros de la izquierda sirven para revisar subconjuntos por periodo, género y calificación. La asignación K-Means se calcula con el dataset limpio completo.</p></div></div>
    </>
  );
});

const ClustersPage = React.memo(function ClustersPage({ data, rows, groups }) {
  const groupColors = Object.fromEntries(data.groups.map((group, index) => [group.id, COLORS[index % COLORS.length]]));
  const pieData = groups.map((group) => ({ name: `Grupo ${group.id}`, count: group.visibleCount, id: group.id }));
  const durationData = groups.map((group) => ({ group: `Grupo ${group.id}`, media: group.stats.runtime.mean, mediana: group.stats.runtime.median, id: group.id }));
  const ratingData = groups.map((group) => ({ group: `Grupo ${group.id}`, media: group.stats.vote_average.mean, mediana: group.stats.vote_average.median, id: group.id }));
  const scatterData = groups.map((group) => group.rows.map((row) => ({
    x: row.runtime,
    y: row.popularity,
    title: row.title,
    rating: row.vote_average,
    cluster: row.cluster,
  })));
  const centerPoints = data.centers.map((center) => ({ x: center.runtime, y: center.popularity, cluster: center.id }));

  const tableRows = groups.flatMap((group) => [
    { group: `Grupo ${group.id}`, clusterName: group.name, n: group.visibleCount, share: group.visibleShare, feature: "Duración (min)", ...group.stats.runtime },
    { group: `Grupo ${group.id}`, clusterName: group.name, n: group.visibleCount, share: group.visibleShare, feature: "Popularidad", ...group.stats.popularity },
    { group: `Grupo ${group.id}`, clusterName: group.name, n: group.visibleCount, share: group.visibleShare, feature: "Calificación", ...group.stats.vote_average },
  ]);

  const low = data.groups.find((group) => group.id === 0);
  const high = data.groups.find((group) => group.id === 1);
  const deltas = low && high ? {
    runtime: high.stats.runtime.mean - low.stats.runtime.mean,
    popularity: high.stats.popularity.mean - low.stats.popularity.mean,
    vote_average: high.stats.vote_average.mean - low.stats.vote_average.mean,
  } : null;

  const downloadCsv = () => {
    const headers = ["title", "year", "genres", "runtime", "popularity", "vote_average", "cluster"];
    const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [headers.join(","), ...rows.map((row) => headers.map((key) => escape(key === "genres" ? row.genres.join("; ") : row[key])).join(","))].join("\r\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "peliculas_filtradas_tmdb.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeading
        eyebrow="PÁGINA 02 · APRENDIZAJE NO SUPERVISADO"
        title="Dos perfiles, un catálogo"
        subtitle="K-Means agrupa películas por duración, popularidad y calificación promedio."
        right={<button className="export-button" onClick={downloadCsv}><Download size={15} /> Exportar vista</button>}
      />

      <div className="model-banner">
        <div className="model-mark"><Layers3 size={20} /></div>
        <div className="model-copy"><span>MODELO FINAL · K-MEANS</span><strong>Segmentación seleccionada: K = {data.selected_k}</strong><p>Entrenamiento en Python con StandardScaler y random_state = 42.</p></div>
        <div className="model-metric"><span>SILHOUETTE</span><b>{dec(data.silhouette, 3)}</b><small>mejor valor entre K=2 y K=6</small></div>
        <div className="model-metric"><span>PELÍCULAS</span><b>{nf.format(data.clean_rows)}</b><small>usadas en el entrenamiento</small></div>
      </div>

      <div className="section-intro cluster-intro"><div><span className="section-kicker">01 · RESULTADOS DEL MODELO</span><h2>Cómo se reparten los grupos</h2></div><span className="subtle-pill"><ListFilter size={14} /> {nf.format(rows.length)} con filtros</span></div>
      <div className="cluster-top-grid">
        <ChartCard title="Registros por clúster" subtitle="Cantidad visible dentro del filtro seleccionado" icon={Layers3}>
          <div className="chart-wrap chart-counts">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pieData} margin={{ top: 16, right: 20, bottom: 2, left: -8 }}>
                <CartesianGrid vertical={false} stroke="#e9edf4" strokeDasharray="4 5" />
                <XAxis dataKey="name" tick={{ fill: "#657187", fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "#657187", fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Películas" radius={[7, 7, 0, 0]} maxBarSize={68}>
                  {pieData.map((item) => <Cell key={item.id} fill={groupColors[item.id]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="group-legend">{groups.map((group) => <div key={group.id}><i style={{ background: groupColors[group.id] }} /><span>Grupo {group.id}</span><b>{nf.format(group.visibleCount)}</b><small>{dec(group.visibleShare, 1)}%</small></div>)}</div>
        </ChartCard>

        <ChartCard title="Dispersión de las películas" subtitle="Duración frente a popularidad; cada punto conserva su clúster" icon={Activity}>
          <div className="chart-wrap chart-counts scatter-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 14, right: 20, bottom: 10, left: -4 }}>
                <CartesianGrid stroke="#edf0f6" strokeDasharray="4 5" />
                <XAxis type="number" dataKey="x" name="Duración" tick={{ fill: "#657187", fontSize: 12 }} tickLine={false} axisLine={false} label={{ value: "Duración (min)", position: "insideBottom", offset: -4, fill: "#69748a", fontSize: 12 }} />
                <YAxis type="number" dataKey="y" name="Popularidad" tick={{ fill: "#657187", fontSize: 12 }} tickLine={false} axisLine={false} />
                <ZAxis range={[25, 25]} />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ active, payload }) => active && payload?.length ? <div className="chart-tooltip"><strong>{payload[0].payload.title}</strong><div className="tooltip-row"><span>Duración</span><b>{dec(payload[0].payload.x, 1)} min</b></div><div className="tooltip-row"><span>Popularidad</span><b>{dec(payload[0].payload.y, 2)}</b></div><div className="tooltip-row"><span>Calificación</span><b>{dec(payload[0].payload.rating, 2)}</b></div><div className="tooltip-row"><span>Clúster</span><b>{payload[0].payload.cluster}</b></div></div> : null} />
                {groups.map((group) => <Scatter key={group.id} name={`Grupo ${group.id}`} data={scatterData[group.id]} fill={groupColors[group.id]} fillOpacity={0.54} />)}
                <Scatter name="Centroides" data={centerPoints} shape={<CrossMark />} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-footnote"><span className="legend-cross">×</span>Centroide en unidades originales · pasa el cursor sobre un punto para ver la película</div>
        </ChartCard>
      </div>

      <div className="section-intro compact-intro"><div><span className="section-kicker">02 · COMPARACIÓN DE VARIABLES</span><h2>Qué diferencia a cada grupo</h2></div></div>
      <div className="chart-grid two-col compare-grid">
        <ChartCard title="Duración de las películas" subtitle="Media y mediana por grupo" icon={Clock3}>
          <div className="chart-wrap chart-small">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={durationData} margin={{ top: 12, right: 10, bottom: 0, left: -12 }}>
                <CartesianGrid vertical={false} stroke="#e9edf4" strokeDasharray="4 5" />
                <XAxis dataKey="group" tick={{ fill: "#657187", fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "#657187", fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip format={(value) => `${dec(value, 1)} min`} />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: "#647089" }} />
                <Bar dataKey="media" name="Media" fill="#7568f2" radius={[5, 5, 0, 0]} maxBarSize={36} />
                <Bar dataKey="mediana" name="Mediana" fill="#b6b0fb" radius={[5, 5, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <ChartCard title="Calificación promedio" subtitle="Media y mediana por grupo" icon={Star}>
          <div className="chart-wrap chart-small">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ratingData} margin={{ top: 12, right: 10, bottom: 0, left: -12 }}>
                <CartesianGrid vertical={false} stroke="#e9edf4" strokeDasharray="4 5" />
                <XAxis dataKey="group" tick={{ fill: "#657187", fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 10]} tick={{ fill: "#657187", fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip format={(value) => `${dec(value, 2)} / 10`} />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: "#647089" }} />
                <Bar dataKey="media" name="Media" fill="#24a99a" radius={[5, 5, 0, 0]} maxBarSize={36} />
                <Bar dataKey="mediana" name="Mediana" fill="#9addd3" radius={[5, 5, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="section-intro compact-intro"><div><span className="section-kicker">03 · PERFILES DE LOS CLÚSTERES</span><h2>Dentro de cada grupo</h2></div></div>
      <div className="profile-grid">
        {groups.map((group) => (
          <article className="profile-card" key={group.id} style={{ "--group-color": groupColors[group.id] }}>
            <div className="profile-top"><span className="profile-badge"><i /> GRUPO {group.id}</span><span className="profile-size">{nf.format(group.count)} películas · {dec(group.share, 1)}%</span></div>
            <h3>{group.name}</h3>
            <p>Centroide: {dec(group.centroid.runtime, 1)} min · popularidad {dec(group.centroid.popularity, 2)} · calificación {dec(group.centroid.vote_average, 2)}</p>
            <div className="profile-stats"><div><span>Duración media</span><b>{dec(group.stats.runtime.mean, 1)} min</b></div><div><span>Popularidad media</span><b>{dec(group.stats.popularity.mean, 2)}</b></div><div><span>Calificación media</span><b>{dec(group.stats.vote_average.mean, 2)}</b></div></div>
          </article>
        ))}
      </div>

      <div className="section-intro compact-intro"><div><span className="section-kicker">04 · ESTADÍSTICAS</span><h2>Tabla comparativa de grupos</h2></div></div>
      <ChartCard title="Estadísticas descriptivas por variable" subtitle="Las estadísticas cambian con los filtros; la asignación de clústeres se conserva" icon={BarChart3} className="table-card">
        <div className="table-scroll">
          <table className="stats-table">
            <thead><tr><th>Clúster</th><th>Nombre del perfil</th><th>Variable</th><th>Registros</th><th>Media</th><th>Mediana</th><th>Desv. estándar</th><th>Mínimo</th><th>Máximo</th></tr></thead>
            <tbody>{tableRows.map((row, index) => <tr key={`${row.group}-${row.feature}-${index}`}><td><span className="table-group"><i style={{ background: groupColors[groups.find((group) => `Grupo ${group.id}` === row.group)?.id] }} />{row.group}</span></td><td>{row.clusterName}</td><td>{row.feature}</td><td>{nf.format(row.n)}</td><td>{dec(row.mean, 2)}</td><td>{dec(row.median, 2)}</td><td>{dec(row.std, 2)}</td><td>{dec(row.min, 2)}</td><td>{dec(row.max, 2)}</td></tr>)}</tbody>
          </table>
        </div>
      </ChartCard>

      <div className="section-intro compact-intro"><div><span className="section-kicker">05 · INTERPRETACIÓN</span><h2>Hallazgos y recomendaciones</h2></div></div>
      <div className="analysis-grid">
        <section className="panel analysis-panel">
          <div className="panel-heading"><div><span className="section-kicker">LECTURA DE RESULTADOS</span><h3>Hallazgos principales</h3></div><span className="panel-icon"><Sparkles size={17} /></span></div>
          <div className="finding-list">
            {low && <div className="finding-item"><span className="finding-number">01</span><p>El Grupo 0 contiene <b>{nf.format(low.count)} películas ({dec(low.share, 1)}%)</b>, mientras que el Grupo 1 reúne <b>{nf.format(high?.count ?? 0)} ({dec(high?.share ?? 0, 1)}%)</b>.</p></div>}
            {deltas && <div className="finding-item"><span className="finding-number">02</span><p>Las medias del Grupo 1 son mayores: <b>{dec(deltas.runtime, 1)} minutos</b> más de duración, <b>{dec(deltas.popularity, 2)}</b> puntos de popularidad y <b>{dec(deltas.vote_average, 2)}</b> puntos de calificación.</p></div>}
            <div className="finding-item"><span className="finding-number">03</span><p>El Silhouette de <b>{dec(data.silhouette, 3)}</b> y el traslape entre rangos indican tendencias distinguibles, pero no categorías completamente separadas.</p></div>
          </div>
        </section>
        <section className="panel analysis-panel recommendations-panel">
          <div className="panel-heading"><div><span className="section-kicker">SIGUIENTES PASOS</span><h3>Recomendaciones</h3></div><span className="panel-icon"><TrendingUp size={17} /></span></div>
          <div className="recommendation-list"><div><span>↗</span><p>Usar los grupos como punto de partida y combinar la consulta con filtros de género y año.</p></div><div><span>↗</span><p>Revisar `vote_count` antes de destacar una calificación alta; esa variable no participa en K-Means.</p></div><div><span>↗</span><p>Actualizar el conjunto y comparar de nuevo Silhouette si se agregan datos o variables.</p></div></div>
        </section>
      </div>

      <div className="section-intro compact-intro"><div><span className="section-kicker">06 · SELECCIÓN DEL MODELO</span><h2>Comparación de valores de K</h2></div></div>
      <ChartCard title="Evaluación de configuraciones K" subtitle="Silhouette e inercia calculados por Python sobre el dataset limpio" icon={Activity}>
        <div className="evaluation-layout">
          <div className="chart-wrap chart-evaluation"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.evaluation} margin={{ top: 10, right: 18, bottom: 0, left: -10 }}><CartesianGrid vertical={false} stroke="#e9edf4" strokeDasharray="4 5" /><XAxis dataKey="k" tickFormatter={(value) => `K=${value}`} tick={{ fill: "#657187", fontSize: 12 }} tickLine={false} axisLine={false} /><YAxis tick={{ fill: "#657187", fontSize: 12 }} tickLine={false} axisLine={false} /><Tooltip content={<CustomTooltip format={(value) => dec(value, 3)} />} /><ReferenceLine x={data.selected_k} stroke="#a8a2f6" strokeDasharray="4 4" /><Line type="monotone" dataKey="silhouette" name="Silhouette" stroke="#7568f2" strokeWidth={2.5} dot={{ r: 4, fill: "#7568f2" }} activeDot={{ r: 6 }} /></LineChart></ResponsiveContainer></div>
          <div className="evaluation-list">{data.evaluation.map((item) => <div key={item.k} className={item.k === data.selected_k ? "selected" : ""}><span>K = {item.k}</span><b>{dec(item.silhouette, 3)}</b><small>Silhouette</small></div>)}</div>
        </div>
        <div className="chart-footnote"><span className="legend-dot violet" />Se eligió K={data.selected_k} porque tuvo el coeficiente Silhouette más alto entre K=2 y K=6. La inercia baja al aumentar K y no se interpreta sola.</div>
      </ChartCard>
      <div className="note-strip"><CircleHelp size={16} /><span>Los filtros ajustan los conteos y estadísticas mostradas. Centroides y etiquetas se calcularon en Python con el conjunto limpio completo para mantener comparables los grupos.</span></div>
    </>
  );
});

export default App;
