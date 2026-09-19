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
//
// Antimeridian: Natural Earth rings are NOT split at ±180° — Russia's mainland ring, Fiji and others
// run from lon 179.9 straight to −180 inside one ring. Web Mercator draws that edge as a line across
// the whole world and fills the wedge behind it (the horizontal stripes seen in production). Every
// ring is therefore unwrapped into continuous longitude and clipped at ±180° into an eastern and a
// western polygon before it reaches MapLibre (see splitAtAntimeridian).
const STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};
const WORLD_URL = './vendor/world/countries.json';
// The opening view: every inhabited continent, no Mercator-inflated Arctic, no polar band.
const WORLD_VIEW = [[-168, -56], [180, 78]];
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

// Longitudes made continuous along the ring: a jump of more than 180° between neighbours is a wrap.
function unwrapRing(ring) {
  const out = [[ring[0][0], ring[0][1]]];
  let offset = 0;
  for (let i = 1; i < ring.length; i++) {
    let lon = ring[i][0] + offset;
    const prev = out[i - 1][0];
    if (lon - prev > 180) { offset -= 360; lon -= 360; } else if (prev - lon > 180) { offset += 360; lon += 360; }
    out.push([lon, ring[i][1]]);
  }
  return out;
}
// Sutherland–Hodgman clip of one ring against the half-plane lon <= x (keepWest) or lon >= x.
function clipRing(ring, x, keepWest) {
  const inside = (p) => (keepWest ? p[0] <= x : p[0] >= x);
  const cross = (a, b) => { const t = (x - a[0]) / (b[0] - a[0]); return [x, a[1] + (b[1] - a[1]) * t]; };
  const open = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring;
  const out = [];
  for (let i = 0; i < open.length; i++) {
    const cur = open[i], prev = open[(i + open.length - 1) % open.length];
    if (inside(cur)) { if (!inside(prev)) out.push(cross(prev, cur)); out.push(cur); }
    else if (inside(prev)) out.push(cross(prev, cur));
  }
  if (out.length < 3) return null;
  out.push([out[0][0], out[0][1]]);
  return out;
}
const shiftRing = (ring, d) => ring.map((p) => [p[0] + d, p[1]]);
// One polygon (outer ring + holes) → up to two polygons, each strictly within [−180, 180].
export function splitAtAntimeridian(polygon) {
  const rings = polygon.map(unwrapRing);
  let lo = Infinity, hi = -Infinity;
  for (const p of rings[0]) { lo = Math.min(lo, p[0]); hi = Math.max(hi, p[0]); }
  if (lo >= -180 && hi <= 180) return [rings];
  const result = [];
  const cut = (x, westShift, eastShift) => {
    for (const [keepWest, shift] of [[true, westShift], [false, eastShift]]) {
      const pieces = rings.map((r) => clipRing(r, x, keepWest)).map((r) => (r ? shiftRing(r, shift) : null));
      if (pieces[0]) result.push(pieces.filter(Boolean));
    }
  };
  if (hi > 180) cut(180, 0, -360);
  else cut(-180, 360, 0);
  // A ring that reached past both edges (not in Natural Earth, but cheap to be safe).
  return result.flatMap((poly) => (poly[0].some((p) => p[0] < -180 || p[0] > 180) ? splitAtAntimeridian(poly) : [poly]));
}

// Minimal TopoJSON → GeoJSON: quantised, delta-encoded arcs; negative index = reversed arc; the first
// point of every following arc repeats the previous arc's last point and is dropped.
export function decodeWorld(bundle) {
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
    const polygons = geometry.type === 'Polygon'
      ? [geometry.arcs.map(ring)]
      : geometry.type === 'MultiPolygon' ? geometry.arcs.map((polygon) => polygon.map(ring)) : null;
    if (!polygons) continue;
    const coordinates = polygons.flatMap(splitAtAntimeridian);
    if (!coordinates.length) continue;
    features.push({
      type: 'Feature',
      properties: { iso: iso || '', name: (geometry.properties && geometry.properties.name) || '', value: 0, color: null, dim: 0 },
      geometry: { type: 'MultiPolygon', coordinates },
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

// Continent view: the mainland centroid of every country in it (overseas islands and the far side
// of a dateline split must not stretch Europe to the whole world), covered by the shortest longitude
// interval on the circle. An interval that crosses the dateline (Oceania) is expressed as east > 180,
// which fitBounds understands.
function continentView(features) {
  const points = [];
  for (const feature of features) {
    const mainland = feature.geometry.coordinates.reduce((best, polygon) => (polygon[0].length > best[0].length ? polygon : best));
    const ring = mainland[0];
    let lon = 0, lat = 0;
    for (const p of ring) { lon += p[0]; lat += p[1]; }
    points.push([lon / ring.length, lat / ring.length]);
  }
  if (!points.length) return null;
  const lons = points.map((p) => p[0]).sort((a, b) => a - b);
  let gapStart = 0, gapSize = -1;
  for (let i = 0; i < lons.length; i++) {
    const gap = i + 1 < lons.length ? lons[i + 1] - lons[i] : (lons[0] + 360) - lons[i];
    if (gap > gapSize) { gapSize = gap; gapStart = i; }
  }
  let west = lons[(gapStart + 1) % lons.length], east = lons[gapStart];
  if (east < west) east += 360;
  const lats = points.map((p) => p[1]);
  const pad = 3;
  return [[west - pad, Math.max(-56, Math.min(...lats) - pad)], [east + pad, Math.min(78, Math.max(...lats) + pad)]];
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
    bounds: WORLD_VIEW,
    fitBoundsOptions: { padding: 6 },
    minZoom: -1,              // a phone-wide container still shows the whole world
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
      if (state.continent === 'all') api.fit(); else api.fitContinent(state.continent);
    },
    select(iso) {
      state = { ...state, selected: iso || null };
      if (map.getLayer(SELECTED)) map.setFilter(SELECTED, ['==', ['get', 'iso'], state.selected || '__none__']);
    },
    // Swap the base style and re-add the country layers only once the new style has really loaded
    // (a `styledata` event fires before that; adding layers then throws and leaves an empty map).
    async setTheme(next) {
      if (next === state.theme) return;
      state = { ...state, theme: next };
      ready = false;
      await new Promise((resolve) => {
        let done = false;
        const finish = () => { if (done) return; done = true; if (map.getLayer(FILL)) { resolve(); return; } addLayers(); resolve(); };
        const onData = () => { if (!done && map.isStyleLoaded()) { map.off('styledata', onData); setTimeout(finish, 0); } };
        map.on('styledata', onData);
        map.once('error', () => { if (done) return; usingFallback = true; map.setStyle(fallbackStyle(next)); });
        map.setStyle(usingFallback ? fallbackStyle(next) : (STYLES[next] || STYLES.light));
        setTimeout(() => { if (!done) { usingFallback = true; map.setStyle(fallbackStyle(next)); } }, 8000);
      });
      api.select(state.selected);
    },
    usingFallback() { return usingFallback; },
    // «Show all» and the opening view are always the same world view: fitting to whichever countries
    // happen to have data would zoom into one region and hide the rest of the picture.
    fit() {
      try { map.fitBounds(WORLD_VIEW, { padding: 6, duration: 600 }); } catch (_e) {}
    },
    fitContinent(code) {
      const scope = world.features.filter((feature) => feature.properties.iso && continent(feature.properties.iso) === code);
      const view = continentView(scope);
      if (!view) return api.fit();
      try { map.fitBounds(view, { padding: 24, maxZoom: 4, duration: 600 }); } catch (_e) {}
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
