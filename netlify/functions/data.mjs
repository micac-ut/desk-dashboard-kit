// GET /api/data?key=<DASH_KEY>
// Everything the page needs that isn't mock data: weather, Strava, and Google.
import { hasKey, json } from '../lib/common.mjs';
import * as strava from '../lib/strava.mjs';
import * as google from '../lib/google.mjs';
import { getWeather } from '../lib/weather.mjs';
import { getSurf } from '../lib/surf.mjs';
import { getRivers } from '../lib/rivers.mjs';
import { getMuni } from '../lib/muni.mjs';
import { getTv } from '../lib/tv.mjs';
import { getSnow } from '../lib/snow.mjs';

export default async (req) => {
  if (!hasKey(req)) return json({ error: 'unauthorized' }, 401);

  const out = { generatedAt: Date.now(), strava: null, google: null, weather: null, surf: null, rivers: null, muni: null, tv: null, snow: null, status: {} };

  try {
    out.weather = await getWeather();
    out.status.weather = out.weather ? (out.weather.stale ? 'stale' : 'ok') : 'error';
  } catch (err) {
    console.error(err);
    out.status.weather = 'error';
  }

  try {
    out.surf = await getSurf();
    out.status.surf = out.surf ? (out.surf.stale ? 'stale' : 'ok') : 'error';
  } catch (err) {
    console.error(err);
    out.status.surf = 'error';
  }

  try {
    out.muni = await getMuni();
    out.status.muni = out.muni ? (out.muni.stale ? 'stale' : 'ok') : 'not-configured';
  } catch (err) {
    console.error(err);
    out.status.muni = 'error';
  }

  try {
    out.tv = await getTv();
    out.status.tv = out.tv ? (out.tv.stale ? 'stale' : 'ok') : 'error';
  } catch (err) {
    console.error(err);
    out.status.tv = 'error';
  }

  try {
    out.snow = await getSnow();
    out.status.snow = out.snow ? (out.snow.stale ? 'stale' : 'ok') : 'error';
  } catch (err) {
    console.error(err);
    out.status.snow = 'error';
  }

  try {
    out.rivers = await getRivers();
    out.status.rivers = out.rivers ? (out.rivers.stale ? 'stale' : 'ok') : 'error';
  } catch (err) {
    console.error(err);
    out.status.rivers = 'error';
  }

  try {
    if (await strava.isConnected()) {
      out.strava = await strava.getWeek();
      out.status.strava = out.strava ? (out.strava.stale ? 'stale' : 'ok') : 'error';
      if (out.strava) {
        out.strava.year = await strava.getYear();
        out.strava.load = await strava.getLoad();
      }
    } else {
      out.status.strava = 'not-connected';
    }
  } catch (err) {
    console.error(err);
    out.status.strava = 'error';
  }

  try {
    if (await google.isConnected()) {
      out.google = await google.getToday();
      out.status.google = out.google ? (out.google.stale ? 'stale' : 'ok') : 'error';
    } else {
      out.status.google = 'not-connected';
    }
  } catch (err) {
    console.error(err);
    out.status.google = 'error';
  }

  return json(out);
};

export const config = { path: '/api/data' };
