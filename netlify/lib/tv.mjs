// Next-episode air dates for a couple of shows, via TVmaze's free API (no key).
// Air dates rarely change mid-day, so this is cached for a while.
import { store, TZ } from './common.mjs';

const CACHE_KEY = 'tv/now';
const MAX_AGE = 6 * 3600e3;

// TVmaze show ids (https://api.tvmaze.com/shows/<id>). Add more the same way:
// search https://api.tvmaze.com/search/shows?q=<name> for the id.
export const SHOWS = [
  { id: 114, label: 'Survivor' },
  { id: 58177, label: 'The Traitors' }
];

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('TVmaze ' + res.status + ' ' + url.split('?')[0]);
  return res.json();
}

async function oneShow(s) {
  const d = await getJSON(`https://api.tvmaze.com/shows/${s.id}?embed[]=nextepisode&embed[]=previousepisode`);
  const emb = d._embedded || {};
  const next = emb.nextepisode;
  const prev = emb.previousepisode;
  return {
    id: s.id,
    label: s.label,
    ended: d.status === 'Ended',
    next: next ? { season: next.season, number: next.number, airstamp: next.airstamp, tba: next.name === 'TBA' } : null,
    lastAirstamp: prev ? prev.airstamp : null
  };
}

export async function refreshTv() {
  const results = await Promise.allSettled(SHOWS.map(oneShow));
  const shows = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  const data = { shows, errors: results.filter((r) => r.status === 'rejected').map((r) => String(r.reason && r.reason.message)), fetchedAt: Date.now() };
  await store().setJSON(CACHE_KEY, data);
  return data;
}

export async function getTv() {
  const cached = await store().get(CACHE_KEY, { type: 'json' });
  if (cached && Date.now() - cached.fetchedAt < MAX_AGE) return cached;
  try {
    return await refreshTv();
  } catch (err) {
    console.error(err);
    return cached ? { ...cached, stale: true } : null;
  }
}
