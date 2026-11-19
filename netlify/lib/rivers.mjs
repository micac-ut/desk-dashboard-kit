// River flows. Primary: Dreamflows' public California Sierra page (one request, parsed for our gauges;
// it also carries Dreamflows' own low / ok / high rating). Fallback: USGS Water Services.
// Dreamflows has no API, so if they change their page layout the parser returns nothing and
// USGS takes over (when the river has a USGS gauge with live data).
import { store } from './common.mjs';

const CACHE_KEY = 'rivers/now';
const HIST_KEY = 'rivers/history';
const MAX_AGE = 25 * 60 * 1000;
const DF_URL = 'https://www.dreamflows.com/flows.php?page=real&zone=canv&form=comp&mark=All';
const UA = 'desk-dashboard (personal, 15-min cache)' + (process.env.DASH_CONTACT ? ' ' + process.env.DASH_CONTACT : '');

// df = Dreamflows site number (the "SiteNNN" anchor on its page). usgs = fallback gauge.
export const RIVERS = [
  { id: 'chili', name: 'Chili Bar', sub: 'South Fork American', df: '075', usgs: '11444500',
    schedule: 'https://www.dreamflows.com/Pages/ChiliBarSchedule.php' },
  { id: 'natoma', name: 'Lower American', sub: 'Below Lake Natoma', df: '076', usgs: '11446500',
    schedule: 'https://www.dreamflows.com/Pages/NatomaSchedule.php' }
];

const RATING = { Lo: 'low', Ok: 'ok', Hi: 'high', Fz: 'flood' };

// Pull "1,070 cfs" and its rating class out of one site's block of the page.
export function parseDreamflows(html, df) {
  const start = html.indexOf("name='Site" + df + "'");
  if (start < 0) return null;
  const next = html.indexOf("<a name='Site", start + 10);
  const seg = html.slice(start, next < 0 ? start + 4000 : next);
  const m = seg.match(/<br>\s*([0-9]{1,2}:[0-9]{2}[ap]m);\s*<span class='Flow([A-Za-z]+)'>([0-9,]+)\s*cfs<\/span>(?:;\s*<span class='Flow[A-Za-z]+'>([0-9.]+)ft<\/span>)?/);
  if (!m) return null;
  return { cfs: Number(m[3].replace(/,/g, '')), rating: RATING[m[2]] || null, readAt: m[1], gageFt: m[4] ? Number(m[4]) : null, source: 'dreamflows' };
}

async function dreamflows() {
  const res = await fetch(DF_URL, { headers: { 'user-agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error('Dreamflows ' + res.status);
  return res.text();
}

async function usgs(site) {
  const u = 'https://waterservices.usgs.gov/nwis/iv/?format=json&parameterCd=00060&period=PT3H&sites=' + site;
  const res = await fetch(u);
  if (!res.ok) throw new Error('USGS ' + res.status);
  const d = await res.json();
  const ts = d.value.timeSeries[0];
  const vals = ts && ts.values[0].value;
  if (!vals || !vals.length) return null;
  const last = vals[vals.length - 1];
  return { cfs: Math.round(Number(last.value)), rating: null, readAt: last.dateTime, source: 'usgs' };
}

export async function refreshRivers() {
  let html = null;
  try { html = await dreamflows(); } catch (err) { console.error(err); }
  const hist = (await store().get(HIST_KEY, { type: 'json' })) || {};
  const now = Date.now();
  const rivers = [];
  for (const r of RIVERS) {
    let v = html ? parseDreamflows(html, r.df) : null;
    if (!v) {
      try { v = await usgs(r.usgs); } catch (err) { console.error(err); }
    }
    if (!v) { rivers.push({ id: r.id, name: r.name, sub: r.sub, cfs: null, schedule: r.schedule }); continue; }
    // Keep ~3 hours of readings to show a trend arrow.
    const h = (hist[r.id] || []).filter((p) => now - p.t < 3 * 3600e3);
    h.push({ t: now, cfs: v.cfs });
    hist[r.id] = h;
    const ref = h.find((p) => now - p.t >= 40 * 60e3) || h[0];
    const delta = v.cfs - ref.cfs;
    const trend = ref === h[h.length - 1] || Math.abs(delta) < Math.max(25, v.cfs * 0.05) ? 'steady' : delta > 0 ? 'rising' : 'falling';
    rivers.push({ id: r.id, name: r.name, sub: r.sub, schedule: r.schedule, ...v, trend });
  }
  await store().setJSON(HIST_KEY, hist);
  const data = { rivers, fetchedAt: now };
  await store().setJSON(CACHE_KEY, data);
  return data;
}

export async function getRivers() {
  const cached = await store().get(CACHE_KEY, { type: 'json' });
  if (cached && Date.now() - cached.fetchedAt < MAX_AGE) return cached;
  try {
    return await refreshRivers();
  } catch (err) {
    console.error(err);
    return cached ? { ...cached, stale: true } : null;
  }
}
