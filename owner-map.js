// Owner Analytics map — lazy ES module, loaded only when the owner opens the Map tab.
//
// A COUNTRY CHOROPLETH on self-hosted MapLibre GL JS (vendor/maplibre, BSD-3-Clause) drawn ENTIRELY
// from our own geometry: vendor/world/countries.json (Natural Earth 1:50m admin-0 map units, one
// feature per ISO 3166-1 alpha-2 code, generated at build time). No basemap tiles, no glyph server,
// no third-party request of any kind — the map works offline, inside the native shells and behind
// any content blocker, and it never sends the owner's viewport to anyone.
//
// The picture (2026-09-26 redesign):
//   • the ocean is a calm flat colour and every country is drawn on top of it as one closed shape,
//     so the continents read at a glance and every border is crisp;
//   • countries WITHOUT activity are «under glass»: a translucent pale fill and a faint outline —
//     present, recognisable, but quiet;
//   • countries WITH activity carry the sequential blue of the selected metric at full strength, a
//     brighter outline and a soft glow, plus a label pill «Норвегия · 88» at their mainland centre;
//   • hover lifts the country (stronger outline + tooltip), click selects it (accent outline) and
//     opens the country card; the continent filter dims everything outside the continent.
//
// Geometry model: one feature per ISO 3166-1 alpha-2 code from Natural Earth admin-0 MAP UNITS
// (assets/world-units-50m.json). The analytics country key (what GeoIP reports) and the display
// geometry are therefore the same thing: Svalbard is SJ, not a second Norway; French Guiana is GF,
// not France. `meta[iso].parent` records the sovereign for the tooltip; no figure is ever moved from
// a territory to its sovereign or back.
//
// Antimeridian: Natural Earth rings are NOT split at ±180° — Russia's mainland ring, Fiji and others
// run from lon 179.9 straight to −180 inside one ring. Web Mercator draws that edge as a line across
// the whole world and fills the wedge behind it (the horizontal stripes seen in production once).
// Every ring is therefore unwrapped into continuous longitude and clipped at ±180° into an eastern
// and a western polygon before it reaches MapLibre (see splitAtAntimeridian).
const WORLD_URL = './vendor/world/countries.json';
// Build revision of the page (index.html data-build), so the geometry URL changes with every deploy.
const buildRevision = () => { try { return document.documentElement.getAttribute('data-build') || ''; } catch (_e) { return ''; } };
// The opening view: every inhabited continent, no Mercator-inflated Arctic, no polar band.
const WORLD_VIEW = [[-168, -56], [180, 78]];
const SOURCE = 'ow-countries';
const FILL = 'ow-country-fill', LINE = 'ow-country-line', GLOW = 'ow-country-glow', SELECTED = 'ow-country-selected', BG = 'ow-bg';
// Palette of the two panel themes (owner-dashboard.js «Голубая» light / blue night dark).
const THEMES = {
  light: { ocean: '#d6e6f5', glass: 'rgba(255,255,255,0.66)', glassLine: 'rgba(52,96,150,0.32)', dataLine: 'rgba(255,255,255,0.9)', glow: 'rgba(29,78,216,0.35)', hover: '#0f3fa8', accent: '#1d4ed8', dimLine: 'rgba(52,96,150,0.14)' },
  dark: { ocean: '#08131f', glass: 'rgba(150,185,230,0.14)', glassLine: 'rgba(170,200,240,0.28)', dataLine: 'rgba(230,240,255,0.85)', glow: 'rgba(140,193,244,0.45)', hover: '#e6f0fb', accent: '#c3ddfa', dimLine: 'rgba(170,200,240,0.1)' },
};
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

// The point a label sits on: the area-weighted centre of the mainland (largest) polygon's outer ring.
// For the few strongly concave mainlands (Chile, Norway, Vietnam) the centroid still lands on land.
export function labelPoint(feature) {
  const mainland = feature.geometry.coordinates.reduce((best, polygon) => (polygon[0].length > best[0].length ? polygon : best));
  const ring = mainland[0];
  let area = 0, cx = 0, cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    area += f; cx += (ring[j][0] + ring[i][0]) * f; cy += (ring[j][1] + ring[i][1]) * f;
  }
  if (Math.abs(area) < 1e-9) return [ring[0][0], ring[0][1]];
  return [cx / (3 * area), cy / (3 * area)];
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
    // Simplification can collapse a speck of an island to two or three points: not a ring.
    return points.length >= 4 ? points : null;
  };
  const polygonOf = (ringIndexes) => {
    const outer = ring(ringIndexes[0]);
    if (!outer) return null;
    return [outer].concat(ringIndexes.slice(1).map(ring).filter(Boolean));
  };
  const features = [];
  for (const geometry of topology.objects.countries.geometries) {
    const iso = geometry.properties && geometry.properties.iso;
    const polygons = geometry.type === 'Polygon'
      ? [polygonOf(geometry.arcs)]
      : geometry.type === 'MultiPolygon' ? geometry.arcs.map(polygonOf) : null;
    if (!polygons) continue;
    const coordinates = polygons.filter(Boolean).flatMap(splitAtAntimeridian);
    if (!coordinates.length) continue;
    features.push({
      type: 'Feature',
      properties: {
        iso: iso || '', name: (geometry.properties && geometry.properties.name) || '',
        parent: (geometry.properties && geometry.properties.parent) || '', value: 0, color: null, dim: 0, has: 0,
      },
      geometry: { type: 'MultiPolygon', coordinates },
    });
  }
  return { features, meta: bundle.meta || {}, attribution: bundle.attribution || '' };
}
function loadWorld() {
  if (!worldPromise) {
    const revision = buildRevision();
    // Versioned URL + default cache mode: force-cache kept the previous deploy's geometry for as long
    // as the browser held it, which is how an owner could keep seeing an already-fixed map.
    worldPromise = fetch(WORLD_URL + (revision ? '?v=' + encodeURIComponent(revision) : ''), { cache: 'default' })
      .then((response) => { if (!response.ok) throw new Error('world_geometry_unavailable'); return response.json(); })
      .then(decodeWorld)
      .catch((error) => { worldPromise = null; throw error; });
  }
  return worldPromise;
}

// Continent views: fixed frames for the six inhabited continents (Europe is Europe, not Europe plus
// Siberia because Russia's mainland centroid sits at 97°E; Oceania crosses the dateline, expressed as
// east > 180, which fitBounds understands). Unknown codes fall back to the computed frame below.
const CONTINENT_VIEWS = {
  EU: [[-25, 34], [45, 72]],
  AS: [[26, -11], [150, 60]],
  NA: [[-170, 5], [-50, 75]],
  SA: [[-92, -56], [-32, 13]],
  AF: [[-20, -36], [52, 38]],
  OC: [[110, -48], [190, 2]],
};
// Computed continent view: the mainland centroid of every country in it (overseas islands and the
// far side of a dateline split must not stretch a continent to the whole world), covered by the
// shortest longitude interval on the circle.
function continentView(features) {
  const points = features.map(labelPoint);
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
// Bounds of ONE feature: the shortest longitude interval on the circle that covers all its pieces
// (so the USA with the Aleutians east of the dateline is not "the whole world") and the latitude
// extent of those pieces. East may exceed 180 for a dateline country; fitBounds accepts that.
export function featureBounds(feature) {
  const spans = [];
  let south = 90, north = -90;
  for (const polygon of feature.geometry.coordinates) {
    let lo = 180, hi = -180;
    for (const p of polygon[0]) { lo = Math.min(lo, p[0]); hi = Math.max(hi, p[0]); south = Math.min(south, p[1]); north = Math.max(north, p[1]); }
    spans.push([lo, hi]);
  }
  if (!spans.length) return null;
  spans.sort((a, b) => a[0] - b[0]);
  const merged = [spans[0].slice()];
  for (const [lo, hi] of spans.slice(1)) { const last = merged[merged.length - 1]; if (lo <= last[1] + 0.001) last[1] = Math.max(last[1], hi); else merged.push([lo, hi]); }
  let gapStart = merged.length - 1, gapSize = (merged[0][0] + 360) - merged[merged.length - 1][1];
  for (let i = 0; i + 1 < merged.length; i++) { const gap = merged[i + 1][0] - merged[i][1]; if (gap > gapSize) { gapSize = gap; gapStart = i; } }
  let west = merged[(gapStart + 1) % merged.length][0], east = merged[gapStart][1];
  if (east < west) east += 360;
  return [[west, south], [east, north]];
}

// The whole style is ours: a background and our country source. Nothing is fetched from anywhere.
function styleFor(theme, features) {
  const t = THEMES[theme] || THEMES.light;
  return {
    version: 8,
    sources: { [SOURCE]: { type: 'geojson', data: { type: 'FeatureCollection', features }, promoteId: 'iso' } },
    layers: [{ id: BG, type: 'background', paint: { 'background-color': t.ocean } }],
  };
}

export async function createMap({ container, theme = 'light', colorFor, onHover, onSelect, continentOf, nameOf: nameOfOpt, labels = true }) {
  ensureCss();
  const [maplibre, world] = await Promise.all([loadMaplibre(), loadWorld()]);
  const gl = maplibre.default || maplibre;
  // Same-origin worker module: the bundled resolver uses import.meta.url, which is empty inside a
  // native app shell (capacitor://), so it is set explicitly.
  try { if (typeof gl.setWorkerUrl === 'function') gl.setWorkerUrl(new URL('./vendor/maplibre/maplibre-gl-worker.mjs', document.baseURI).href); } catch (_e) {}

  const map = new gl.Map({
    container,
    style: styleFor(theme, world.features),
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
  const palette = () => THEMES[state.theme] || THEMES.light;
  const nameOf = (iso, fallback) => {
    if (typeof nameOfOpt === 'function') { try { const n = nameOfOpt(iso); if (n && n !== iso) return n; } catch (_e) {} }
    const m = world.meta[iso] || {}; return m.ru || m.n || fallback || iso;
  };

  // Label pills for the countries that carry data: an HTML marker each (no glyph server needed),
  // the biggest values first, capped so a busy day never becomes a wall of pills.
  const markers = new Map();
  const MAX_LABELS = 40;
  function relabel() {
    if (!labels) return;
    const wanted = state.rows
      .filter((row) => row.country && (+row[state.metric] || 0) > 0 && (state.continent === 'all' || continent(row.country) === state.continent))
      .sort((a, b) => (+b[state.metric] || 0) - (+a[state.metric] || 0))
      .slice(0, MAX_LABELS);
    const keep = new Set();
    for (const row of wanted) {
      const feature = world.features.find((f) => f.properties.iso === row.country);
      if (!feature) continue;
      keep.add(row.country);
      const text = nameOf(row.country, feature.properties.name) + ' · ' + (+row[state.metric] || 0).toLocaleString('ru-RU');
      let marker = markers.get(row.country);
      if (!marker) {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'ow-map-pill';
        el.addEventListener('click', (event) => { event.stopPropagation(); api.select(row.country); if (typeof onSelect === 'function') onSelect(row.country); });
        el.addEventListener('mouseenter', () => setHover(row.country));
        el.addEventListener('mouseleave', () => setHover(null));
        marker = new gl.Marker({ element: el, anchor: 'center' }).setLngLat(labelPoint(feature)).addTo(map);
        markers.set(row.country, marker);
      }
      const el = marker.getElement();
      if (el.textContent !== text) el.textContent = text;
      el.setAttribute('data-iso', row.country);
      el.setAttribute('aria-label', text);
    }
    for (const [iso, marker] of markers) if (!keep.has(iso)) { marker.remove(); markers.delete(iso); }
    declutter();
  }
  // Pills must never pile up: at the current zoom the bigger value wins and an overlapping pill hides
  // (its country is still coloured and still answers hover / click). Re-run after every move.
  function declutter() {
    if (!markers.size) return;
    const placed = [];
    const order = [...markers.entries()].sort((a, b) => (+((state.rows.find((r) => r.country === b[0]) || {})[state.metric]) || 0) - (+((state.rows.find((r) => r.country === a[0]) || {})[state.metric]) || 0));
    const rect = container.getBoundingClientRect();
    for (const [, marker] of order) {
      const el = marker.getElement();
      const p = map.project(marker.getLngLat());
      const w = Math.max(40, el.textContent.length * 6.4 + 18), h = 20;
      const box = { l: p.x - w / 2, r: p.x + w / 2, t: p.y - h / 2, b: p.y + h / 2 };
      // A pill that would be cut by the edge of the box is hidden rather than clipped.
      const offscreen = box.l < 0 || box.r > rect.width || box.t < 0 || box.b > rect.height;
      const collides = placed.some((o) => !(box.r < o.l || box.l > o.r || box.b < o.t || box.t > o.b));
      const hide = offscreen || collides;
      el.classList.toggle('is-hidden', hide);
      if (!hide) placed.push(box);
    }
  }
  let declutterTimer = null;
  map.on('move', () => { if (declutterTimer) return; declutterTimer = setTimeout(() => { declutterTimer = null; declutter(); }, 80); });
  map.on('moveend', declutter);
  map.on('resize', declutter);

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
      feature.properties.has = inScope && value > 0 ? 1 : 0;
    }
    const source = map.getSource(SOURCE);
    if (source) source.setData({ type: 'FeatureCollection', features: world.features });
    relabel();
    return max;
  }

  function paintTheme() {
    const t = palette();
    if (map.getLayer(BG)) map.setPaintProperty(BG, 'background-color', t.ocean);
    if (map.getLayer(FILL)) map.setPaintProperty(FILL, 'fill-color', ['case', ['==', ['get', 'has'], 1], ['coalesce', ['get', 'color'], t.glass], t.glass]);
    if (map.getLayer(LINE)) {
      map.setPaintProperty(LINE, 'line-color', ['case',
        ['boolean', ['feature-state', 'hover'], false], t.hover,
        ['==', ['get', 'dim'], 1], t.dimLine,
        ['==', ['get', 'has'], 1], t.dataLine,
        t.glassLine]);
    }
    if (map.getLayer(GLOW)) map.setPaintProperty(GLOW, 'line-color', t.glow);
    if (map.getLayer(SELECTED)) map.setPaintProperty(SELECTED, 'line-color', t.accent);
    container.setAttribute('data-ow-map-theme', state.theme);
  }

  function addLayers() {
    const t = palette();
    // Every country is drawn: «under glass» when it has no activity, in the metric's blue when it has.
    map.addLayer({
      id: FILL, type: 'fill', source: SOURCE,
      paint: {
        'fill-color': ['case', ['==', ['get', 'has'], 1], ['coalesce', ['get', 'color'], t.glass], t.glass],
        'fill-opacity': ['case',
          ['==', ['get', 'dim'], 1], 0.22,
          ['==', ['get', 'has'], 1], ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0.96],
          ['case', ['boolean', ['feature-state', 'hover'], false], 0.92, 0.72]],
        'fill-antialias': true,
      },
    });
    // A soft glow around active countries so they stand out at any zoom.
    map.addLayer({
      id: GLOW, type: 'line', source: SOURCE,
      filter: ['all', ['==', ['get', 'has'], 1], ['==', ['get', 'dim'], 0]],
      paint: { 'line-color': t.glow, 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 3, 4, 7], 'line-blur': ['interpolate', ['linear'], ['zoom'], 0, 3, 4, 6], 'line-opacity': 0.9 },
    });
    map.addLayer({
      id: LINE, type: 'line', source: SOURCE,
      paint: {
        'line-color': ['case',
          ['boolean', ['feature-state', 'hover'], false], t.hover,
          ['==', ['get', 'dim'], 1], t.dimLine,
          ['==', ['get', 'has'], 1], t.dataLine,
          t.glassLine],
        // One zoom curve per expression (MapLibre allows a single zoom-based interpolate), the
        // hover / data / glass choice inside each stop.
        'line-width': ['interpolate', ['linear'], ['zoom'],
          0, ['case', ['boolean', ['feature-state', 'hover'], false], 2.2, ['==', ['get', 'has'], 1], 0.9, 0.55],
          4, ['case', ['boolean', ['feature-state', 'hover'], false], 2.6, ['==', ['get', 'has'], 1], 1.4, 0.9]],
      },
    });
    map.addLayer({
      id: SELECTED, type: 'line', source: SOURCE,
      filter: ['==', ['get', 'iso'], state.selected || '__none__'],
      paint: { 'line-color': t.accent, 'line-width': 3 },
    });
    recolor();
    paintTheme();
    ready = true;
  }

  function setHover(iso) {
    if (state.hovered === iso) return;
    if (state.hovered) { try { map.setFeatureState({ source: SOURCE, id: state.hovered }, { hover: false }); } catch (_e) {} }
    state.hovered = iso;
    if (iso) { try { map.setFeatureState({ source: SOURCE, id: iso }, { hover: true }); } catch (_e) {} }
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

  await new Promise((resolve) => {
    let done = false;
    const finish = () => { if (done) return; done = true; addLayers(); resolve(); };
    if (map.loaded && map.loaded()) finish(); else map.on('load', finish);
    // The style is inline and the only source is ours, so nothing can fail to arrive; this is a belt.
    setTimeout(() => { if (!done && map.isStyleLoaded && map.isStyleLoaded()) finish(); }, 4000);
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
      for (const [code, marker] of markers) marker.getElement().classList.toggle('is-selected', code === state.selected);
    },
    // The palette swap is a paint update, not a style reload: no flash, no re-fetch, no empty map.
    async setTheme(next) {
      if (next === state.theme) return;
      state = { ...state, theme: next };
      if (ready) { recolor(); paintTheme(); }
    },
    usingFallback() { return false; },
    // «Show all» and the opening view are always the same world view: fitting to whichever countries
    // happen to have data would zoom into one region and hide the rest of the picture.
    fit() {
      try { map.fitBounds(WORLD_VIEW, { padding: 6, duration: 600 }); } catch (_e) {}
    },
    fitContinent(code) {
      const scope = world.features.filter((feature) => feature.properties.iso && continent(feature.properties.iso) === code);
      const view = CONTINENT_VIEWS[code] || continentView(scope);
      if (!view) return api.fit();
      try { map.fitBounds(view, { padding: 24, maxZoom: 4, duration: 600 }); } catch (_e) {}
    },
    focus(iso) {
      const feature = world.features.find((f) => f.properties.iso === iso);
      const bounds = feature ? featureBounds(feature) : null;
      if (bounds) { try { map.fitBounds(bounds, { padding: 48, maxZoom: 5, duration: 600 }); } catch (_e) {} }
    },
    bounds(iso) { const feature = world.features.find((f) => f.properties.iso === iso); return feature ? featureBounds(feature) : null; },
    labels() { return [...markers.keys()]; },
    resize() { try { map.resize(); } catch (_e) {} },
    destroy() { try { for (const marker of markers.values()) marker.remove(); markers.clear(); tooltip.remove(); map.remove(); } catch (_e) {} },
  };
  return api;
}
