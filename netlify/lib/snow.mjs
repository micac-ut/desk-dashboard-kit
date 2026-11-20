// Resort snow. "Last 24h" is measured, real snow depth from a CDEC/NRCS SNOTEL station near each
// resort (day-over-day change in snow-on-the-ground depth), not a model guess: Open-Meteo estimates
// new snowfall from a modeled snow/liquid ratio, which badly undershoots real Sierra powder totals
// in big storms (checked against this one: Open-Meteo said under 1", the station said +19").
// "Next 24h" is still a forecast, so that part comes from Open-Meteo (CDEC can't predict the future).
// OpenSnow itself has no public API. Cached and refreshed every 30 minutes.
import { store, TZ } from './common.mjs';

const CACHE_KEY = 'snow/now';
const MAX_AGE = 30 * 60 * 1000;
const M_TO_FT = 3.28084;
const CM_TO_IN = 0.393701;

// cdecStation: nearest CDEC sensor-18 (snow depth) station that actually reports, by checking
// https://cdec.water.ca.gov/dynamicapp/staSearch -> sensor 18 -> pick the closest with recent data.
// Palisades: the resort's own SNOTEL (SQV). Kirkwood: Caples Lake (CAP), ~2 miles from the resort;
// no station is literally at Kirkwood.
export const RESORTS = [
  { id: 'palisades', name: 'Palisades Tahoe', lat: 39.1967, lon: -120.2374, cdecStation: 'SQV' },
  { id: 'kirkwood', name: 'Kirkwood', lat: 38.6849, lon: -120.0652, cdecStation: 'CAP' }
];

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Snow request failed: ' + res.status + ' ' + url.split('?')[0]);
  return res.json();
}

const in1 = (cm) => (cm == null ? null : Math.round(cm * CM_TO_IN * 10) / 10);

// Most recent day-over-day rise in measured snow depth at the station (inches; CDEC sensor 18
// is already inches). -9999 = not posted yet, so this walks back to the latest valid pair.
// A fall (melt/settling) reads as 0 new snow, not negative.
async function stationNewSnow(stationId) {
  const start = new Date(Date.now() - 8 * 86400000).toISOString().slice(0, 10);
  const end = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const u = `https://cdec.water.ca.gov/dynamicapp/req/JSONDataServlet?Stations=${stationId}&SensorNums=18&dur_code=D&Start=${start}&End=${end}`;
  const rows = (await getJSON(u)).filter((r) => r.value !== -9999 && r.value != null);
  if (rows.length < 2) return { newSnowIn: null, asOf: null };
  rows.sort((a, b) => a.date.localeCompare(b.date));
  const latest = rows[rows.length - 1], prev = rows[rows.length - 2];
  return { newSnowIn: Math.max(0, Math.round((latest.value - prev.value) * 10) / 10), asOf: latest.date.slice(0, 10) };
}

async function oneResort(r) {
  const u = new URL('https://api.open-meteo.com/v1/forecast');
  u.searchParams.set('latitude', r.lat);
  u.searchParams.set('longitude', r.lon);
  u.searchParams.set('current', 'temperature_2m,snowfall,weather_code');
  u.searchParams.set('daily', 'snowfall_sum');
  u.searchParams.set('forecast_days', '2');
  u.searchParams.set('temperature_unit', 'fahrenheit');
  u.searchParams.set('precipitation_unit', 'inch');
  u.searchParams.set('timezone', TZ);

  const [fc, st] = await Promise.allSettled([getJSON(u.toString()), stationNewSnow(r.cdecStation)]);
  if (fc.status !== 'fulfilled') throw fc.reason;
  const d = fc.value;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
  const todayIdx = d.daily.time.indexOf(today);
  const next24 = todayIdx >= 0 ? d.daily.snowfall_sum[todayIdx + 1] : null;
  const station = st.status === 'fulfilled' ? st.value : { newSnowIn: null, asOf: null };

  return {
    id: r.id, name: r.name,
    elevationFt: Math.round(d.elevation * M_TO_FT),
    tempF: Math.round(d.current.temperature_2m),
    nowSnowing: (d.current.snowfall || 0) > 0,
    last24hIn: station.newSnowIn,
    last24hAsOf: station.asOf, // CDEC posts with a lag; this is the date the figure is actually from
    next24hIn: in1(next24)
  };
}

export async function refreshSnow() {
  const results = await Promise.allSettled(RESORTS.map(oneResort));
  const resorts = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  if (!resorts.length) throw results[0].reason;
  const data = {
    resorts,
    errors: results.filter((r) => r.status === 'rejected').map((r) => String(r.reason && r.reason.message)),
    fetchedAt: Date.now()
  };
  await store().setJSON(CACHE_KEY, data);
  return data;
}

export async function getSnow() {
  const cached = await store().get(CACHE_KEY, { type: 'json' });
  if (cached && Date.now() - cached.fetchedAt < MAX_AGE) return cached;
  try {
    return await refreshSnow();
  } catch (err) {
    console.error(err);
    return cached ? { ...cached, stale: true } : null;
  }
}
