/*
 * EDIT FOR YOUR SETUP: the dashboard's page settings (see docs/SETUP.md step 2).
 * This file is served publicly, so keep coordinates rounded and nothing secret here.
 * Server settings (keys, calendars) live in Netlify env vars and netlify/lib/calendars.mjs.
 * ES5 only: the frame's WebView is old.
 */
window.DASH_CONFIG = {
  // IANA time zone. The page uses the frame's clock (set the frame to this zone); the server uses DASH_TZ.
  timeZone: 'America/Los_Angeles',

  // Turn whole sections on or off. The calendar and commute code stays in place, just hidden.
  features: { calendar: false, tasks: false, commute: false, alerts: false, strava: false, surf: true, rivers: true },

  // Recurring reminders shown as a banner under the clock, on the due day only (set daysBefore: 1 to
  // also get a heads-up the day before). dayOfMonth is clamped to the month's last day. Tap the banner on the day to mark it done; it
  // stays hidden until the next one. Add the pet's name to the label if you like (this file is public).
  reminders: [
    { id: 'heartworm', label: 'Heartworm meds', dayOfMonth: 8, daysBefore: 0 }
  ],

  // Surf and river cards (data comes from /api/data; spots and gauges are set in netlify/lib/surf.mjs and rivers.mjs).
  surf: { goodColor: '#8fd8a8', fairColor: '#f2b36b', poorColor: '#9a9a96', bigColor: '#f28b82' },

  calendars: {
    work:     { name: 'Work', color: '#F26A2E', mine: true },
    personal: { name: 'Personal', color: '#8fd8a8', mine: true },
    family:   { name: 'Family',   color: '#5b8def', mine: false },
    ooo:      { name: 'Out of office', color: '#9a9a96', mine: false },
    holiday:  { name: 'Holiday',  color: '#9a9a96', mine: false }
  },

  commute: {
    days: [1, 2, 3, 4, 5],            // 0 = Sunday ... 6 = Saturday
    homeBy: '18:30',
    packMin: 10,
    defaultBufferMin: 30,
    keywordBuffers: { dinner: 45 },
    takeoverWindowMin: 20,            // how long the commute takeover stays up
    routes: [
      { id: 'quick',  name: 'Quick',    min: 40 },
      { id: 'middle', name: 'Middle',   min: 50 },
      { id: 'long',   name: 'Long way', min: 70 }
    ]
  },

  takeover: { firstMin: 30, pulseMin: 5, snoozeMin: 10 },

  night: { start: '19:00', end: '06:00', promptSec: 120, stayOnMin: 60 },

  // Living-sky header (js/sky.js). Leaves blow past when wind (or 85% of gusts) reaches leafMph.
  // Icicles at or below 20°F; lightning on thunderstorm codes or NWS thunderstorm/tornado alerts.
  sky: { leafMph: 12 },

  strava: {
    weeklyGoalMi: 150,
    showLoad: true             // CTL/ATL/TSB line; the switch on the strip overrides this per screen
  },

  map: {
    // Work and home for the map markers. ROUNDED to 2 decimals (~1 km): this file is public.
    // Keep exact coordinates out of the repo (e.g. in git-ignored private/).
    locations: {
      // EDIT: your own, 2 decimals. Placeholders: central San Francisco.
      work: { name: 'Work', lat: 37.79, lon: -122.40 },
      home: { name: 'Home', lat: 37.76, lon: -122.44 }
    },
    // Show the work/home markers and the dashed line between them. Off: the map frames the surf spots instead.
    showWorkHome: false,
    minZoom: 5,
    maxZoom: 13,
    idleReturnSec: 60,         // snap back to the home view after this long untouched

    // OpenStreetMap standard tiles, darkened in CSS (.dark-tiles). No key; follow the
    // OSM tile usage policy (light use, attribution shown). CARTO Dark Matter would
    // look cleaner but now requires an API key (carto.com/basemaps).
    base: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    baseAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',

    // NWS NEXRAD composite, served as map tiles by the Iowa Environmental Mesonet. US only, no key.
    radar: {
      url: 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png',
      opacity: 0.65,
      refreshMin: 5,
      attribution: 'Radar: NWS via <a href="https://mesonet.agron.iastate.edu/">IEM</a>'
    },

    // Wind from Open-Meteo, sampled on a grid over the visible map.
    wind: {
      enabled: false,          // false: no wind layer at all (no fetching, no animation, no arrows)
      grid: 6,                 // 6 x 6 = 36 points per fetch
      refreshMin: 15,
      animate: true,           // animated streaks; ?wind=static turns them off for testing
      fps: 10,                 // ambient rate (halved from 20: ~30% CPU on the frame at 20 fps)
      boostFps: 30,            // while the map is being touched, until it resets after idleReturnSec
      pxPerParticle: 900,      // lower = denser
      speedScale: 0.6,         // pixels per frame per mph (doubled with the halved fps: same speed)
      fade: 0.7                // trail length: closer to 1 = longer trails (lower to match bigger steps)
    }
  }
};
