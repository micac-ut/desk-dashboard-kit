// Muni (SF) via the 511.org Open Data API: service alerts for the N Judah, and next arrivals at the
// stops we care about. Needs a free key in the DASH_511 env var (DASH_511_KEY also works).
// 511 allows 60 requests/hour per key. Budget: ~4 stop requests every 6 minutes (only stops that
// serve our lines, found by an occasional full scan) + 1 alerts request every 15 minutes.
import { store } from './common.mjs';

const CACHE_KEY = 'muni/now';
const STOPS_KEY = 'muni/stops';
const USEFUL_KEY = 'muni/useful';
const MAX_AGE = 6 * 60 * 1000;           // arrivals
const ALERTS_AGE = 15 * 60 * 1000;       // service alerts change slowly
const STOPS_MAX_AGE = 30 * 24 * 3600e3;  // stop locations
const USEFUL_AGE = 6 * 3600e3;           // which nearby stops actually serve our lines
const USEFUL_EMPTY_AGE = 30 * 60 * 1000; // re-scan sooner if a place had nothing running
const BASE = 'https://api.511.org/transit';

// Public intersection coordinates. Stops are found by distance, so no stop codes live in the repo.
//   lines: only these lines (null = every line; Church Station is limited to the Metro lines, not the F or buses)   dir: 'IB' inbound (toward downtown, i.e. east),
//   'OB' outbound, or null for both
export const ALERT_LINE = 'N';
export const PLACES = [
  { id: 'duboce', name: 'Church & Duboce', lat: 37.7692, lon: -122.4291, radiusM: 90, lines: ['N'], dir: null },
  { id: 'church', name: 'Church Station', lat: 37.7673, lon: -122.4290, radiusM: 90, lines: ['J', 'K', 'L', 'M', 'N', 'T'], dir: 'IB' }
];

const key = () => process.env.DASH_511_KEY || process.env.DASH_511 || '';

// 511 JSON starts with a byte-order mark that breaks JSON.parse.
async function get(path, params) {
  const u = new URL(BASE + path);
  u.searchParams.set('api_key', key());
  u.searchParams.set('format', 'json');
  for (const [k, v] of Object.entries(params || {})) u.searchParams.set(k, v);
  const res = await fetch(u.toString());
  if (!res.ok) throw new Error('511 ' + res.status + ' ' + path);
  return JSON.parse((await res.text()).replace(/^﻿/, ''));
}

const arr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);

function metersBetween(lat1, lon1, lat2, lon2) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Which stop codes are within radiusM of each place. Cached for a month (stops rarely move).
export function pickStops(stopList, places) {
  const out = {};
  for (const p of places) {
    out[p.id] = stopList
      .map((s) => ({
        code: String(s.id), name: s.Name,
        m: metersBetween(p.lat, p.lon, Number(s.Location && s.Location.Latitude), Number(s.Location && s.Location.Longitude))
      }))
      .filter((s) => Number.isFinite(s.m) && s.m <= p.radiusM)
      .sort((a, b) => a.m - b.m)
      .slice(0, 6)
      .map((s) => ({ code: s.code, name: s.name }));
  }
  return out;
}

async function stopsFor(places) {
  const cached = await store().get(STOPS_KEY, { type: 'json' });
  if (cached && Date.now() - cached.at < STOPS_MAX_AGE) return cached.picks;
  const d = await get('/stops', { operator_id: 'SF' });
  const list = arr(d.Contents && d.Contents.dataObjects && d.Contents.dataObjects.ScheduledStopPoint);
  const picks = pickStops(list, places);
  await store().setJSON(STOPS_KEY, { at: Date.now(), picks });
  return picks;
}

// MonitoredStopVisit[] -> [{ line, dir, dest, t }] (t = expected arrival, epoch ms)
export function parseVisits(d) {
  const visits = arr(d && d.ServiceDelivery && d.ServiceDelivery.StopMonitoringDelivery &&
    d.ServiceDelivery.StopMonitoringDelivery.MonitoredStopVisit);
  const out = [];
  for (const v of visits) {
    const j = v.MonitoredVehicleJourney || {}, c = j.MonitoredCall || {};
    const t = Date.parse(c.ExpectedArrivalTime || c.AimedArrivalTime || c.ExpectedDepartureTime || '');
    if (!Number.isFinite(t)) continue;
    out.push({ line: String(j.LineRef || ''), dir: String(j.DirectionRef || ''), dest: String(j.DestinationName || ''), t });
  }
  return out;
}

const isInbound = (d) => /^(ib|in|inbound|e|east)/i.test(d);
const isOutbound = (d) => /^(ob|out|outbound|w|west)/i.test(d);

export function filterArrivals(list, place) {
  return list
    .filter((a) => !place.lines || place.lines.indexOf(a.line) !== -1)
    .filter((a) => !place.dir || (place.dir === 'IB' ? isInbound(a.dir) : isOutbound(a.dir)))
    .map((a) => ({ ...a, dir: isInbound(a.dir) ? 'IB' : isOutbound(a.dir) ? 'OB' : a.dir }))
    .sort((a, b) => a.t - b.t);
}

// Active alerts that mention our line.
export function parseAlerts(d, line) {
  const out = [];
  for (const e of arr(d && d.Entities)) {
    const al = e.Alert || {};
    const hit = arr(al.InformedEntity).some((x) => String(x.RouteId || (x.Route && x.Route.RouteId) || '') === line);
    if (!hit) continue;
    const text = (t) => (arr(t && t.Translation)[0] || {}).Text || '';
    out.push({ header: text(al.HeaderText).slice(0, 140), effect: al.Effect || '' });
  }
  return out;
}

export async function refreshMuni() {
  if (!key()) return null;
  const st = store();
  const picks = await stopsFor(PLACES);
  const useful = await st.get(USEFUL_KEY, { type: 'json' });
  const scan = !(useful && Date.now() - useful.at < (useful.empty ? USEFUL_EMPTY_AGE : USEFUL_AGE));

  // Which stop codes to ask about: everything nearby on a full scan, otherwise only the useful ones.
  const codesFor = (p) => (scan ? picks[p.id].map((s) => s.code) : (useful.codes[p.id] || []));
  const wanted = [...new Set(PLACES.flatMap(codesFor))];
  const errors = [];
  const visitsByCode = {};
  await Promise.all(wanted.map(async (code) => {
    try { visitsByCode[code] = parseVisits(await get('/StopMonitoring', { agency: 'SF', stopCode: code })); }
    catch (err) { errors.push(String(err && err.message)); }
  }));

  const places = [], usefulCodes = {};
  let anyEmpty = false;
  for (const p of PLACES) {
    let all = [];
    usefulCodes[p.id] = [];
    for (const code of codesFor(p)) {
      const v = visitsByCode[code];
      if (!v) continue;
      all = all.concat(v);
      if (filterArrivals(v, p).length) usefulCodes[p.id].push(code);
    }
    if (!usefulCodes[p.id].length) anyEmpty = true;
    places.push({ id: p.id, name: p.name, stops: codesFor(p).length, arrivals: filterArrivals(all, p).slice(0, 6) });
  }
  if (scan && !errors.length) await st.setJSON(USEFUL_KEY, { at: Date.now(), codes: usefulCodes, empty: anyEmpty });
  if (!wanted.some((c) => visitsByCode[c]) && errors.length) throw new Error(errors[0]);

  // Alerts: reuse the last fetch if it is recent.
  const prev = await st.get(CACHE_KEY, { type: 'json' });
  let alerts = prev ? prev.alerts : null, alertsAt = prev ? prev.alertsAt || 0 : 0;
  if (!prev || alerts == null || Date.now() - alertsAt > ALERTS_AGE) {
    try {
      alerts = parseAlerts(await get('/servicealerts', { agency: 'SF' }), ALERT_LINE);
      alertsAt = Date.now();
    } catch (err) { errors.push(String(err && err.message)); }
  }
  const data = { line: ALERT_LINE, alerts, alertsAt, places, errors, fetchedAt: Date.now() };
  await st.setJSON(CACHE_KEY, data);
  return data;
}

export async function getMuni() {
  if (!key()) return null;
  const cached = await store().get(CACHE_KEY, { type: 'json' });
  if (cached && Date.now() - cached.fetchedAt < MAX_AGE) return cached;
  try {
    return await refreshMuni();
  } catch (err) {
    console.error(err);
    return cached ? { ...cached, stale: true } : null;
  }
}
