// Surf: Open-Meteo Marine (swell) + Open-Meteo wind + NOAA tide predictions, per spot.
// Cached in Blobs, refreshed every 15 minutes. No keys needed. Ratings are our own (see rate()).
import { store, TZ } from './common.mjs';

const CACHE_KEY = 'surf/now';
const MAX_AGE = 25 * 60 * 1000;

// offshore = the wind direction (degrees, "from") that grooms the waves.
// swell = the swell directions (degrees) that work well at that break.
// tide = NOAA CO-OPS station for the nearest predictions.
// Marine model points sit just offshore (the model grid is coarse), not on the beach.
export const SPOTS = [
  { id: 'jacks',   name: 'Jacks',      area: 'Santa Cruz', lat: 36.94, lon: -122.01, tide: '9413745', offshore: 355, swell: [200, 300] },
  { id: 'ob',      name: 'Ocean Beach', area: 'San Francisco', lat: 37.76, lon: -122.60, tide: '9414290', offshore: 80,  swell: [250, 310] },
  { id: 'pacifica', name: 'Pacifica',   area: 'Linda Mar', lat: 37.59, lon: -122.57, tide: '9414131', offshore: 75,  swell: [240, 300] }
];

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Surf request failed: ' + res.status + ' ' + url.split('?')[0]);
  return res.json();
}

const M_TO_FT = 3.28084;
const ft1 = (m) => (m == null ? null : Math.round(m * M_TO_FT * 10) / 10);

async function swell(s) {
  const u = new URL('https://marine-api.open-meteo.com/v1/marine');
  u.searchParams.set('latitude', s.lat);
  u.searchParams.set('longitude', s.lon);
  u.searchParams.set('current', 'wave_height,wave_period,wave_direction,swell_wave_height,swell_wave_period,swell_wave_direction');
  u.searchParams.set('hourly', 'wave_height,wave_period');
  u.searchParams.set('forecast_days', '2');
  u.searchParams.set('timezone', TZ);
  const d = await getJSON(u.toString());
  const c = d.current;
  // Wave height at +3h and +6h from now, for the trend arrow ("building" / "dropping").
  const idx = d.hourly.time.findIndex((t) => t >= c.time.slice(0, 13));
  const at = (h) => (idx >= 0 ? d.hourly.wave_height[idx + h] : null);
  return {
    hsFt: ft1(c.wave_height),
    periodS: c.wave_period == null ? null : Math.round(c.wave_period),
    dirDeg: c.wave_direction == null ? null : Math.round(c.wave_direction),
    swellFt: ft1(c.swell_wave_height),
    swellPeriodS: c.swell_wave_period == null ? null : Math.round(c.swell_wave_period),
    swellDirDeg: c.swell_wave_direction == null ? null : Math.round(c.swell_wave_direction),
    next: [ft1(at(3)), ft1(at(6))]
  };
}

async function wind(s) {
  const u = new URL('https://api.open-meteo.com/v1/forecast');
  u.searchParams.set('latitude', s.lat);
  u.searchParams.set('longitude', s.lon);
  u.searchParams.set('current', 'wind_speed_10m,wind_direction_10m,wind_gusts_10m');
  u.searchParams.set('wind_speed_unit', 'mph');
  const d = await getJSON(u.toString());
  return {
    mph: Math.round(d.current.wind_speed_10m),
    gustMph: Math.round(d.current.wind_gusts_10m),
    fromDeg: Math.round(d.current.wind_direction_10m)
  };
}

// High/low tides for today and tomorrow, local clock strings ("2026-11-18 04:55").
async function tides(station) {
  const u = new URL('https://api.tidesandcurrents.noaa.gov/api/prod/datagetter');
  u.searchParams.set('product', 'predictions');
  u.searchParams.set('station', station);
  u.searchParams.set('date', 'today');
  u.searchParams.set('range', '48');
  u.searchParams.set('datum', 'MLLW');
  u.searchParams.set('time_zone', 'lst_ldt');
  u.searchParams.set('units', 'english');
  u.searchParams.set('interval', 'hilo');
  u.searchParams.set('format', 'json');
  u.searchParams.set('application', 'desk-dashboard');
  const d = await getJSON(u.toString());
  return (d.predictions || []).map((p) => ({ t: p.t, ft: Math.round(Number(p.v) * 10) / 10, hi: p.type === 'H' }));
}

const angDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

// Our own 3-level rating from size, period, wind and swell direction. Tune the numbers to taste.
export function rate(s, sw, wd) {
  if (sw.hsFt == null) return null;
  let pts = 0;
  const h = sw.hsFt;
  pts += h < 2 ? 0 : h < 3 ? 1 : h <= 8 ? 2 : h <= 12 ? 1.5 : 0.5;          // size
  pts += sw.periodS == null ? 0 : sw.periodS < 8 ? 0 : sw.periodS < 11 ? 1 : 1.5; // period
  if (wd) {
    const off = angDiff(wd.fromDeg, s.offshore);
    if (wd.mph <= 6 || (off <= 70 && wd.mph <= 18)) pts += 2;              // glassy or offshore
    else if (off <= 110 && wd.mph <= 12) pts += 1;                          // light cross
    else if (wd.mph > 15) pts -= 1;                                          // blown out
  }
  const dir = sw.swellDirDeg == null ? sw.dirDeg : sw.swellDirDeg;
  if (dir != null && dir >= s.swell[0] && dir <= s.swell[1]) pts += 0.5;     // right swell window
  return pts >= 4 ? 'good' : pts >= 2.5 ? 'fair' : 'poor';
}

async function oneSpot(s) {
  const [sw, wd, td] = await Promise.allSettled([swell(s), wind(s), tides(s.tide)]);
  if (sw.status !== 'fulfilled') throw sw.reason;
  const w = wd.status === 'fulfilled' ? wd.value : null;
  return {
    id: s.id, name: s.name, area: s.area,
    swell: sw.value, wind: w,
    offshoreDeg: s.offshore,
    rating: rate(s, sw.value, w),
    tides: td.status === 'fulfilled' ? td.value : []
  };
}

export async function refreshSurf() {
  const results = await Promise.allSettled(SPOTS.map(oneSpot));
  const spots = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  if (!spots.length) throw results[0].reason;
  const data = {
    spots,
    errors: results.filter((r) => r.status === 'rejected').map((r) => String(r.reason && r.reason.message)),
    fetchedAt: Date.now()
  };
  await store().setJSON(CACHE_KEY, data);
  return data;
}

export async function getSurf() {
  const cached = await store().get(CACHE_KEY, { type: 'json' });
  if (cached && Date.now() - cached.fetchedAt < MAX_AGE) return cached;
  try {
    return await refreshSurf();
  } catch (err) {
    console.error(err);
    return cached ? { ...cached, stale: true } : null;
  }
}
