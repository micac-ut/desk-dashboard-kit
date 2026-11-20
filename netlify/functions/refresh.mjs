// Scheduled every 15 minutes: refresh cached data so page requests stay fast and cheap.
import * as strava from '../lib/strava.mjs';
import * as google from '../lib/google.mjs';
import { refreshWeather } from '../lib/weather.mjs';
import { refreshSurf } from '../lib/surf.mjs';
import { refreshRivers } from '../lib/rivers.mjs';
import { getMuni } from '../lib/muni.mjs';

export default async () => {
  try {
    await refreshWeather();
  } catch (err) {
    console.error('Weather refresh failed', err);
  }
  try {
    await refreshSurf();
  } catch (err) {
    console.error('Surf refresh failed', err);
  }
  try {
    await getMuni(); // respects the cache, so it stays inside 511's request limit
  } catch (err) {
    console.error('Muni refresh failed', err);
  }
  try {
    await refreshRivers();
  } catch (err) {
    console.error('Rivers refresh failed', err);
  }
  try {
    if (await strava.isConnected()) await strava.refreshWeek();
  } catch (err) {
    console.error('Strava refresh failed', err);
  }
  try {
    if (await google.isConnected()) await google.refreshToday();
  } catch (err) {
    console.error('Google refresh failed', err);
  }
};

export const config = { schedule: '*/15 * * * *' };
