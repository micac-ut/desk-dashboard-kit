// Resort snow: Open-Meteo forecast at each resort's coordinates (OpenSnow itself has no public
// API). New snow in the last 24h, a 3-day total, and the forecast point's elevation as a rough
// stand-in for base depth. Cached and refreshed every 30 minutes (snow totals move slowly).
import { store, TZ } from './common.mjs';

const CACHE_KEY = 'snow/now';
const MAX_AGE = 30 * 60 * 1000;
const M_TO_FT = 3.28084;
const CM_TO_IN = 0.393701;

export const RESORTS = [
  { id: 'palisades', name: 'Palisades Tahoe', lat: 39.1967, lon: -120.2374 },
  { id: 'kirkwood', name: 'Kirkwood', lat: 38.6849, lon: -120.0652 }
];

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Snow request failed: ' + res.status + ' ' + url.split('?')[0]);
  return res.json();
}

const in1 = (cm) => (cm == null ? null : Math.round(cm * CM_TO_IN * 10) / 10);

async function oneResort(r) {
  const u = new URL('https://api.open-meteo.com/v1/forecast');
  u.searchParams.set('latitude', r.lat);
  u.searchParams.set('longitude', r.lon);
  u.searchParams.set('current', 'temperature_2m,snowfall,weather_code');
  u.searchParams.set('daily', 'snowfall_sum,temperature_2m_max,temperature_2m_min');
  u.searchParams.set('past_days', '2');
  u.searchParams.set('forecast_days', '5');
  u.searchParams.set('temperature_unit', 'fahrenheit');
  u.searchParams.set('precipitation_unit', 'inch');
  u.searchParams.set('timezone', TZ);
  const d = await getJSON(u.toString());

  // past_days gives yesterday + today-so-far; "last 24h" = yesterday's total + today's so far.
  const todayIdx = d.daily.time.indexOf(new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date()));
  const last24 = todayIdx >= 0 ? d.daily.snowfall_sum[todayIdx] : null;
  const next3 = todayIdx >= 0 ? d.daily.snowfall_sum.slice(todayIdx + 1, todayIdx + 4).reduce((a, b) => a + (b || 0), 0) : null;

  return {
    id: r.id, name: r.name,
    elevationFt: Math.round(d.elevation * M_TO_FT),
    tempF: Math.round(d.current.temperature_2m),
    nowSnowing: (d.current.snowfall || 0) > 0,
    last24hIn: in1(last24),
    next3dayIn: in1(next3),
    daily: d.daily.time.slice(todayIdx).map((date, i) => ({
      date, snowIn: in1(d.daily.snowfall_sum[todayIdx + i]),
      hi: Math.round(d.daily.temperature_2m_max[todayIdx + i]), lo: Math.round(d.daily.temperature_2m_min[todayIdx + i])
    }))
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
