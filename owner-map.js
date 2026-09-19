// Owner Analytics map — lazy ES module, loaded only when the owner opens the Map tab.
//
// A COUNTRY CHOROPLETH on self-hosted MapLibre GL JS (vendor/maplibre, BSD-3-Clause) over OpenFreeMap
// vector tiles. Country borders come from vendor/world/countries.json (Natural Earth 1:50m via
// world-atlas, generated at build time with ISO 3166-1 alpha-2 ids), fetched once when the map opens —
// never on the main screen. Every country is ONE feature (Polygon or MultiPolygon, islands included),
// so hover and selection always light up the whole territory.
//
// The map draws the batch of per-country aggregates the panel already holds (report section
// `countries`): no request per country, no coordinates finer than a border. Colour is a calm blue
// sequential scale (owner-analytics-lib.js choroplethColor); countries without data stay neutral.
const STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};
const WORLD_URL = './vendor/world/countries.json';
const FILL = 'ow-country-fill', LINE = 'ow-country-line', SELECTED = 'ow-country-selected';
const fallbackStyle = (theme) => ({
  version: 8,
  sources: {},
  layers: [{ id: 'ow-bg', type: 'background', paint: { 'background-color': theme === 'dark' ? '#0f1c30' : '#eef4fb' } }],
});
let maplibrePromise = null;
let worldPromise = null;

function loadMaplibre() {
  if (!maplibrePromise) maplibrePromise = import('./vendor/maplibre/maplibre-gl.mjs');
  return maplibrePromise;
}
function ensureCss() {
  if (document.getElementById('ow-maplibre-css')) return;
  const link = document.createElement('link');
  link.id = 'ow-maplibre-css';
  link.rel = 'stylesheet';
  link.href = './vendor/maplibre/maplibre-gl.css';
  document.head.appendChild(link);
}

// Minimal TopoJSON → GeoJSON: quantised, delta-encoded arcs; negative index = reversed arc; the first
// point of every following arc repeats the previous arc's last point and is dropped.
function decodeWorld(bundle) {
  const topology = bundle.topology;
  const [sx, sy] = topology.transform.scale;
  const [tx, ty] = topology.transform.translate;
  const arcs = topology.arcs.map((arc) => {
    let x = 0, y = 0;
    return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; });
  });
  const ring = (indexes) => {
    const points = [];
    indexes.forEach((index, k) => {
      let arc = index < 0 ? arcs[~index].slice().reverse() : arcs[index];
      if (k > 0) arc = arc.slice(1);
      for (const point of arc) points.push(point);
    });
    const first = points[0], last = points[points.length - 1];
    if (first && (first[0] !== last[0] || first[1] !== last[1])) points.push(first);
    return points;
  };
  const features = [];
  for (const geometry of topology.objects.countries.geometries) {
    const iso = geometry.properties && geometry.properties.iso;
    const coordinates = geometry.type === 'Polygon'
      ? geometry.arcs.map(ring)
      : geometry.type === 'MultiPolygon' ? geometry.arcs.map((polygon) => polygon.map(ring)) : null;
    if (!coordinates) continue;
    features.push({
      type: 'Feature',
      properties: { iso: iso || '', name: (geometry.properties && geometry.properties.name) || '', value: 0, color: null, dim: 0 },
      geometry: { type: geometry.type, coordinates },
    });
  }
  return { features, meta: bundle.meta || {}, attribution: bundle.attribution || '' };
}
function loadWorld() {
  if (!worldPromise) {
    worldPromise = fetch(WORLD_URL, { cache: 'force-cache' })
      .then((response) => { if (!response.ok) throw new Error('world_geometry_unavailable'); return response.json(); })
      .then(decodeWorld)
      .catch((error) => { worldPromise = null; throw error; });
  }
  return worldPromise;
}

function bboxOf(features) {
  const box = [180, 90, -180, -90];
  const visit = (coords) => {
    if (typeof coords[0] === 'number') {
      box[0] = Math.min(box[0], coords[0]); box[1] = Math.min(box[1], coords[1]);
      box[2] = Math.max(box[2], coords[0]); box[3] = Math.max(box[3], coords[1]);
    } else for (const c of coords) visit(c);
  };
  for (const feature of features) visit(feature.geometry.coordinates);
  return box[0] <= box[2] ? box : null;
}

export async function createMap({ container, theme = 'light', colorFor, onHover, onSelect, continentOf }) {
  ensureCss();
  const [maplibre, world] = await Promise.all([loadMaplibre(), loadWorld()]);
  const gl = maplibre.default || maplibre;
  // Same-origin worker module: the bundled resolver uses import.meta.url, which is empty inside a
  // native app shell (capacitor://), so it is set explicitly.
  try { if (typeof gl.setWorkerUrl === 'function') gl.setWorkerUrl(new URL('./vendor/maplibre/maplibre-gl-worker.mjs', document.baseURI).href); } catch (_e) {}

  const map = new gl.Map({
    container,
    style: STYLES[theme] || STYLES.light,
    center: [15, 30],
    zoom: 1.4,
    minZoom: 0.8,
    maxZoom: 7,
    renderWorldCopies: false,
    attributionControl: { compact: true, customAttribution: 'IP Geolocation by <a href="https://db-ip.com" target="_blank" rel="noopener">DB-IP</a> · Borders: Natural Earth' },
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
  });
  map.addControl(new gl.NavigationControl({ showCompass: false }), 'top-right');
  try { map.touchZoomRotate.disableRotation(); } catch (_e) {}
  container.setAttribute('role', 'img');
  container.setAttribute('aria-label', 'Карта мира: страны, окрашенные по выбранному показателю');

  const continent = (iso) => (typeof continentOf === 'function' ? continentOf(iso) : ((world.meta[iso] || {}).c || null));
  let state = { rows: [], metric: 'visits_human', theme, continent: 'all', selected: null, hovered: null };
  let ready = false;
  const tooltip = document.createElement('div');
  tooltip.className = 'ow-map-tip';
  tooltip.hidden = true;
  container.appendChild(tooltip);

  function recolor() {
    const byIso = new Map(state.rows.map((row) => [row.country, row]));
    let max = 0;
    for (const row of state.rows) {
      const value = +row[state.metric] || 0;
      if (value > max && (state.continent === 'all' || continent(row.country) === state.continent)) max = value;
    }
    for (const feature of world.features) {
      const iso = feature.properties.iso;
      const row = iso ? byIso.get(iso) : null;
      const value = row ? (+row[state.metric] || 0) : 0;
      const inScope = !iso || state.continent === 'all' || continent(iso) === state.continent;
      feature.properties.value = value;
      feature.properties.color = colorFor(inScope ? value : 0, max, state.theme);
      feature.properties.dim = inScope ? 0 : 1;
    }
    const source = map.getSource('ow-countries');
    if (source) source.setData({ type: 'FeatureCollection', features: world.features });
    return max;
  }
  const outline = () => (state.theme === 'dark' ? 'rgba(200,220,245,.45)' : 'rgba(29,78,216,.35)');
  const accent = () => (state.theme === 'dark' ? '#c3ddfa' : '#1d4ed8');

  function addLayers() {
    map.addSource('ow-countries', { type: 'geojson', data: { type: 'FeatureCollection', features: world.features }, promoteId: 'iso' });
    // Below the base map's labels when the style has them, so country names stay readable.
    const firstSymbol = (map.getStyle().layers || []).find((layer) => layer.type === 'symbol');
    const before = firstSymbol ? firstSymbol.id : undefined;
    map.addLayer({
      id: FILL, type: 'fill', source: 'ow-countries',
      paint: {
        'fill-color': ['coalesce', ['get', 'color'], colorFor(0, 0, state.theme)],
        'fill-opacity': ['case',
          ['==', ['get', 'dim'], 1], 0.18,
          ['boolean', ['feature-state', 'hover'], false], 0.96,
          0.82],
      },
    }, before);
    map.addLayer({
      id: LINE, type: 'line', source: 'ow-countries',
      paint: { 'line-color': outline(), 'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 1.6, 0.6] },
    }, before);
    map.addLayer({
      id: SELECTED, type: 'line', source: 'ow-countries',
      filter: ['==', ['get', 'iso'], state.selected || '__none__'],
      paint: { 'line-color': accent(), 'line-width': 2.6 },
    });
    recolor();
    ready = true;
  }

  function setHover(iso) {
    if (state.hovered === iso) return;
    if (state.hovered) { try { map.setFeatureState({ source: 'ow-countries', id: state.hovered }, { hover: false }); } catch (_e) {} }
    state.hovered = iso;
    if (iso) { try { map.setFeatureState({ source: 'ow-countries', id: iso }, { hover: true }); } catch (_e) {} }
  }
  function featureAt(event) {
    const feature = event.features && event.features[0];
    return feature && feature.properties && feature.properties.iso ? feature : null;
  }
  map.on('mousemove', FILL, (event) => {
    const feature = featureAt(event);
    if (!feature || feature.properties.dim === 1) { setHover(null); tooltip.hidden = true; map.getCanvas().style.cursor = ''; return; }
    map.getCanvas().style.cursor = 'pointer';
    setHover(feature.properties.iso);
    const html = typeof onHover === 'function' ? onHover(feature.properties.iso, state.metric) : '';
    if (!html) { tooltip.hidden = true; return; }
    tooltip.innerHTML = html;
    tooltip.hidden = false;
    const rect = container.getBoundingClientRect();
    const x = Math.min(Math.max(8, event.point.x + 14), rect.width - tooltip.offsetWidth - 8);
    const y = Math.max(8, event.point.y - tooltip.offsetHeight - 12);
    tooltip.style.transform = `translate(${x}px, ${y}px)`;
  });
  map.on('mouseleave', FILL, () => { setHover(null); tooltip.hidden = true; map.getCanvas().style.cursor = ''; });
  map.on('click', FILL, (event) => {
    const feature = featureAt(event);
    if (!feature || feature.properties.dim === 1) return;
    tooltip.hidden = true;
    api.select(feature.properties.iso);
    if (typeof onSelect === 'function') onSelect(feature.properties.iso);
  });

  // The base map is decoration; the countries are the data. If the OpenFreeMap style cannot be
  // fetched (offline, blocked, down), fall back to a plain background and still draw the choropleth.
  let usingFallback = false;
  await new Promise((resolve) => {
    let done = false;
    const finish = () => { if (done) return; done = true; addLayers(); resolve(); };
    map.on('load', finish);
    map.on('error', () => {
      if (done || usingFallback) return;
      if (map.isStyleLoaded && map.isStyleLoaded()) return;      // a tile or glyph failed, not the style
      usingFallback = true;
      map.setStyle(fallbackStyle(state.theme));
      map.once('load', finish);
      map.on('styledata', () => { if (!done && map.isStyleLoaded()) setTimeout(finish, 0); });
    });
    setTimeout(() => { if (!done && !usingFallback) { usingFallback = true; map.setStyle(fallbackStyle(state.theme)); map.once('load', finish); map.on('styledata', () => { if (!done && map.isStyleLoaded()) setTimeout(finish, 0); }); } }, 8000);
  });

  const api = {
    map,
    world,
    setData(rows, metric) {
      state = { ...state, rows: rows || [], metric: metric || state.metric };
      if (ready) recolor();
    },
    setMetric(metric) { state = { ...state, metric }; if (ready) return recolor(); return 0; },
    setContinent(code) {
      state = { ...state, continent: code || 'all' };
      if (!ready) return;
      recolor();
      api.fit();
    },
    select(iso) {
      state = { ...state, selected: iso || null };
      if (map.getLayer(SELECTED)) map.setFilter(SELECTED, ['==', ['get', 'iso'], state.selected || '__none__']);
    },
    async setTheme(next) {
      if (next === state.theme) return;
      state = { ...state, theme: next };
      ready = false;
      await new Promise((resolve) => {
        map.once('styledata', () => { addLayers(); resolve(); });
        map.setStyle(usingFallback ? fallbackStyle(next) : (STYLES[next] || STYLES.light));
      });
    },
    usingFallback() { return usingFallback; },
    fit() {
      const scope = world.features.filter((feature) => feature.properties.iso && feature.properties.dim !== 1 && (state.continent !== 'all' || feature.properties.value > 0));
      const box = bboxOf(scope.length ? scope : world.features.filter((f) => f.properties.iso));
      if (!box) return;
      try { map.fitBounds([[box[0], box[1]], [box[2], box[3]]], { padding: 32, maxZoom: 5, duration: 600 }); } catch (_e) {}
    },
    focus(iso) {
      const feature = world.features.find((f) => f.properties.iso === iso);
      const box = feature ? bboxOf([feature]) : null;
      if (box) { try { map.fitBounds([[box[0], box[1]], [box[2], box[3]]], { padding: 48, maxZoom: 5, duration: 600 }); } catch (_e) {} }
    },
    resize() { try { map.resize(); } catch (_e) {} },
    destroy() { try { tooltip.remove(); map.remove(); } catch (_e) {} },
  };
  return api;
}
