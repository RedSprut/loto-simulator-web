// Owner Analytics map — lazy ES module, loaded only when the owner opens the Map tab.
//
// Self-hosted MapLibre GL JS (vendor/maplibre, BSD-3-Clause) + OpenFreeMap vector tiles. Points are
// aggregated server-side to coarse coordinates (0.01° at most, city centroids in practice), so the map
// can show WHERE people are without ever pointing at a home. Clusters and the heatmap work on the
// metric of the selected mode (real people, households, sessions, bots, everything, live).
const STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};
const MODE_METRIC = {
  people: 'people',
  households: 'households',
  sessions: 'sessions',
  devices: 'devices',
  bots: 'bots',
  all: 'total',
};
let maplibrePromise = null;

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

function featureCollection(points, mode) {
  const metric = MODE_METRIC[mode] || 'people';
  return {
    type: 'FeatureCollection',
    features: (points || []).map((point) => {
      const total = (point.people || 0) + (point.unknown_people || 0) + (point.bots || 0);
      const value = metric === 'total' ? total : (point[metric] || 0);
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [Number(point.lon), Number(point.lat)] },
        properties: {
          value,
          people: point.people || 0,
          unknown_people: point.unknown_people || 0,
          households: point.households || 0,
          devices: point.devices || 0,
          sessions: point.sessions || 0,
          bots: point.bots || 0,
          new_people: point.new_people || 0,
          returning_people: point.returning_people || 0,
          city: point.city || '',
          region: point.region || '',
          country: point.country || '',
          resolution: point.resolution || 'unknown',
        },
      };
    }).filter((f) => f.properties.value > 0 && Number.isFinite(f.geometry.coordinates[0]) && Number.isFinite(f.geometry.coordinates[1])),
  };
}

function liveCollection(points) {
  return {
    type: 'FeatureCollection',
    features: (points || []).map((point) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [Number(point.lon), Number(point.lat)] },
      properties: { city: point.city || '', region: point.region || '', country: point.country || '', events: point.events || 1, at: point.at || '' },
    })).filter((f) => Number.isFinite(f.geometry.coordinates[0]) && Number.isFinite(f.geometry.coordinates[1])),
  };
}

export async function createMap({ container, theme = 'light', onPick }) {
  ensureCss();
  const maplibre = await loadMaplibre();
  const gl = maplibre.default || maplibre;
  // Same-origin worker module: the bundled resolver uses import.meta.url, which is empty inside a
  // native app shell (capacitor://), so it is set explicitly.
  try { if (typeof gl.setWorkerUrl === 'function') gl.setWorkerUrl(new URL('./vendor/maplibre/maplibre-gl-worker.mjs', document.baseURI).href); } catch (_e) {}

  const map = new gl.Map({
    container,
    style: STYLES[theme] || STYLES.light,
    center: [12, 52],
    zoom: 2.4,
    attributionControl: { compact: true, customAttribution: 'IP Geolocation by <a href="https://db-ip.com" target="_blank" rel="noopener">DB-IP</a>' },
    dragRotate: false,
    pitchWithRotate: false,
  });
  map.addControl(new gl.NavigationControl({ showCompass: false }), 'top-right');
  map.addControl(new gl.ScaleControl({ maxWidth: 90, unit: 'metric' }));

  let state = { points: [], live: [], mode: 'people', heatmap: false, theme };
  let ready = false;

  const paintPalette = () => (state.theme === 'dark'
    ? { fill: '#a5316b', text: '#ffffff', live: '#5ad19a', halo: 'rgba(0,0,0,.65)' }
    : { fill: '#b3255f', text: '#ffffff', live: '#0f7a4a', halo: 'rgba(255,255,255,.8)' });

  function addLayers() {
    const palette = paintPalette();
    map.addSource('ow-points', { type: 'geojson', data: featureCollection(state.points, state.mode), cluster: true, clusterRadius: 46, clusterMaxZoom: 9, clusterProperties: { sum: ['+', ['get', 'value']] } });
    map.addSource('ow-live', { type: 'geojson', data: liveCollection(state.live) });

    map.addLayer({
      id: 'ow-heat', type: 'heatmap', source: 'ow-points',
      layout: { visibility: state.heatmap ? 'visible' : 'none' },
      paint: {
        'heatmap-weight': ['interpolate', ['linear'], ['get', 'value'], 0, 0, 20, 1],
        'heatmap-intensity': 0.8,
        'heatmap-radius': 28,
        'heatmap-opacity': 0.75,
      },
    });
    map.addLayer({
      id: 'ow-clusters', type: 'circle', source: 'ow-points', filter: ['has', 'point_count'],
      layout: { visibility: state.heatmap ? 'none' : 'visible' },
      paint: {
        'circle-color': palette.fill,
        'circle-opacity': 0.82,
        'circle-radius': ['interpolate', ['linear'], ['coalesce', ['get', 'sum'], 1], 1, 14, 10, 20, 100, 30, 1000, 42],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': palette.text,
      },
    });
    map.addLayer({
      id: 'ow-cluster-count', type: 'symbol', source: 'ow-points', filter: ['has', 'point_count'],
      layout: { visibility: state.heatmap ? 'none' : 'visible', 'text-field': ['to-string', ['coalesce', ['get', 'sum'], 0]], 'text-size': 12, 'text-font': ['Noto Sans Regular'] },
      paint: { 'text-color': palette.text, 'text-halo-color': palette.halo, 'text-halo-width': 1 },
    });
    map.addLayer({
      id: 'ow-point', type: 'circle', source: 'ow-points', filter: ['!', ['has', 'point_count']],
      layout: { visibility: state.heatmap ? 'none' : 'visible' },
      paint: {
        'circle-color': palette.fill,
        'circle-opacity': 0.85,
        'circle-radius': ['interpolate', ['linear'], ['get', 'value'], 1, 7, 5, 11, 25, 16, 200, 24],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': palette.text,
      },
    });
    map.addLayer({
      id: 'ow-live-pulse', type: 'circle', source: 'ow-live',
      paint: { 'circle-color': palette.live, 'circle-opacity': 0.9, 'circle-radius': 9, 'circle-stroke-width': 3, 'circle-stroke-color': palette.live, 'circle-stroke-opacity': 0.25 },
    });

    map.on('click', 'ow-clusters', (event) => {
      const feature = event.features && event.features[0];
      if (!feature) return;
      map.getSource('ow-points').getClusterExpansionZoom(feature.properties.cluster_id).then((zoom) => {
        map.easeTo({ center: feature.geometry.coordinates, zoom });
      }).catch(() => {});
    });
    for (const layer of ['ow-point', 'ow-live-pulse']) {
      map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
      map.on('click', layer, (event) => {
        const feature = event.features && event.features[0];
        if (!feature || typeof onPick !== 'function') return;
        onPick(feature.properties, feature.geometry.coordinates, layer === 'ow-live-pulse');
      });
    }
    ready = true;
  }

  await new Promise((resolve) => {
    map.on('load', () => { addLayers(); resolve(); });
    map.on('error', () => resolve());
  });

  return {
    map,
    setData(points, live) {
      state = { ...state, points: points || [], live: live || [] };
      if (!ready) return;
      const source = map.getSource('ow-points');
      if (source) source.setData(featureCollection(state.points, state.mode));
      const liveSource = map.getSource('ow-live');
      if (liveSource) liveSource.setData(liveCollection(state.live));
    },
    setMode(mode) {
      state = { ...state, mode };
      const source = map.getSource('ow-points');
      if (source) source.setData(featureCollection(state.points, state.mode));
    },
    setHeatmap(on) {
      state = { ...state, heatmap: !!on };
      if (!ready) return;
      for (const [layer, visible] of [['ow-heat', state.heatmap], ['ow-clusters', !state.heatmap], ['ow-cluster-count', !state.heatmap], ['ow-point', !state.heatmap]]) {
        if (map.getLayer(layer)) map.setLayoutProperty(layer, 'visibility', visible ? 'visible' : 'none');
      }
    },
    async setTheme(next) {
      if (next === state.theme) return;
      state = { ...state, theme: next };
      ready = false;
      await new Promise((resolve) => {
        map.once('styledata', () => { addLayers(); resolve(); });
        map.setStyle(STYLES[next] || STYLES.light);
      });
      const source = map.getSource('ow-points');
      if (source) source.setData(featureCollection(state.points, state.mode));
    },
    fit() {
      const features = featureCollection(state.points, state.mode).features;
      if (!features.length) return;
      const bounds = features.reduce((box, feature) => {
        const [lon, lat] = feature.geometry.coordinates;
        return [Math.min(box[0], lon), Math.min(box[1], lat), Math.max(box[2], lon), Math.max(box[3], lat)];
      }, [180, 90, -180, -90]);
      try { map.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], { padding: 48, maxZoom: 9, duration: 600 }); } catch (_e) {}
    },
    resize() { try { map.resize(); } catch (_e) {} },
    destroy() { try { map.remove(); } catch (_e) {} },
  };
}
