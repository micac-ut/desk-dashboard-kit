/*
 * Mock data in the shape the scheduled function will produce (phase 3+).
 * Built relative to "today" so the mock always looks current.
 * Event "counts" is decided server-side in the real version (section 6 rules).
 */
window.buildMockData = function (base) {
  function t(h, m) {
    return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0).getTime();
  }

  // Tide time as the server sends it: local clock string.
  function tide(h, m, ft, hi) {
    function p(n) { return n < 10 ? '0' + n : '' + n; }
    return { t: base.getFullYear() + '-' + p(base.getMonth() + 1) + '-' + p(base.getDate()) + ' ' + p(h) + ':' + p(m), ft: ft, hi: hi };
  }

  var weekIdx = (base.getDay() + 6) % 7; // Monday = 0
  var sample = [14.2, 0, 18.6, 12.3, 9.8, 32.5, 21.0];
  var daily = [];
  var miles = 0;
  for (var i = 0; i < 7; i++) {
    var v = i <= weekIdx ? sample[i] : null; // null = future day
    daily.push(v);
    if (v) { miles += v; }
  }

  var conds = ['partly', 'clear', 'clear', 'cloudy', 'snow', 'snow', 'partly', 'clear', 'rain', 'clear'];
  var highs = [52, 58, 61, 49, 34, 31, 42, 55, 47, 53];
  var lows  = [31, 33, 36, 29, 21, 18, 24, 30, 32, 29];
  var days = [];
  for (var d = 0; d < 10; d++) {
    days.push({
      date: new Date(base.getFullYear(), base.getMonth(), base.getDate() + d).getTime(),
      cond: conds[d], hi: highs[d], lo: lows[d]
    });
  }

  return {
    generatedAt: base.getTime(),

    events: [
      { id: 'e0', cal: 'family',   title: 'Heartworm pill', allDay: true, dog: true, start: t(0, 0), end: t(23, 59) },
      { id: 'e1', cal: 'work',     title: 'Standup', type: 'meeting', start: t(9, 0), end: t(9, 30), where: 'Google Meet', counts: true },
      { id: 'e2', cal: 'personal', title: 'Lunch with a friend', type: 'lunch', start: t(11, 30), end: t(12, 30), where: 'Downtown', counts: true },
      { id: 'e3', cal: 'work',     title: 'Design review', type: 'meeting', start: t(14, 0), end: t(14, 45), where: 'Zoom', counts: true, link: 'https://www.google.com/calendar/' },
      { id: 'e3b', cal: 'family',  title: 'Dog meds', type: 'meeting', start: t(15, 30), end: t(15, 45), where: '', counts: true, dog: true },
      { id: 'e4', cal: 'work',     title: 'Vendor call', type: 'call', start: t(16, 15), end: t(16, 45), where: 'Phone', counts: true },
      { id: 'e5', cal: 'family',   title: "Kid's soccer", type: 'meeting', start: t(17, 0), end: t(18, 0), where: 'Rec center', counts: false },
      { id: 'e6', cal: 'work',     title: 'Call with Dana', type: 'call', start: t(17, 30), end: t(17, 45), where: 'Phone', counts: true },
      { id: 'e7', cal: 'family',   title: 'Dinner with the Hendersons', type: 'lunch', start: t(19, 0), end: t(21, 0), where: 'Home', counts: true },
      // Tomorrow (shown below today; scroll to see).
      { id: 'e8', cal: 'work',     title: 'Team meeting', type: 'meeting', start: t(24 + 10, 0), end: t(24 + 10, 15), where: 'Google Meet', counts: true },
      { id: 'e9', cal: 'work',     title: 'Weekly 1:1', type: 'meeting', start: t(24 + 10, 30), end: t(24 + 11, 0), where: 'Google Meet', counts: true },
      { id: 'e10', cal: 'family',  title: 'Piano lesson', type: 'meeting', start: t(24 + 16, 0), end: t(24 + 17, 0), where: '', counts: false }
    ],

    tasks: [
      { title: 'Order chain lube', done: true },
      { title: 'Send invoices', done: false },
      { title: 'Review radar tile terms', done: false },
      { title: 'Book bike tune-up', done: true },
      { title: 'Reply to the contractor', done: false },
      { title: 'Post demo bikes', done: false },
      { title: 'Ricky bid', done: false },
      { title: 'Fix Woo deposit system', done: false },
      { title: 'Flat Tops edit', done: false }
    ],

    strava: {
      goalMi: window.DASH_CONFIG.strava.weeklyGoalMi,
      miles: Math.round(miles * 10) / 10,
      movingSec: Math.round(miles * 4.1 * 60),
      climbFt: Math.round(miles * 52),
      daily: daily,
      year: { year: base.getFullYear(), miles: 2187, rides: 143 },
      load: { ctl: 48, atl: 57, tsb: -9 }
    },

    surf: {
      fetchedAt: base.getTime(),
      spots: [
        { id: 'jacks', name: 'Jacks', area: 'Santa Cruz', lat: 36.95, lon: -121.97, rating: 'big', offshoreDeg: 355,
          swell: { hsFt: 10.2, periodS: 12, dirDeg: 285, swellFt: 4.8, swellPeriodS: 12, swellDirDeg: 285, next: [5.8, 6.2] },
          wind: { mph: 5, gustMph: 9, fromDeg: 350 },
          tides: [tide(5, 51, 4.3, true), tide(11, 46, 2.4, false), tide(16, 56, 3.6, true), tide(23, 17, 1.0, false)] },
        { id: 'ob', name: 'Ocean Beach', area: 'San Francisco', lat: 37.76, lon: -122.51, rating: 'good', offshoreDeg: 80,
          swell: { hsFt: 6.1, periodS: 14, dirDeg: 288, swellFt: 5.6, swellPeriodS: 14, swellDirDeg: 288, next: [6.4, 6.0] },
          wind: { mph: 7, gustMph: 12, fromDeg: 70 },
          tides: [tide(6, 45, 4.9, true), tide(12, 45, 2.4, false), tide(18, 3, 4.1, true), tide(23, 59, 0.9, false)] },
        { id: 'pacifica', name: 'Pacifica', area: 'Linda Mar', lat: 37.60, lon: -122.50, rating: 'poor', offshoreDeg: 75,
          swell: { hsFt: 3.2, periodS: 8, dirDeg: 270, swellFt: 2.9, swellPeriodS: 8, swellDirDeg: 270, next: [3.0, 2.6] },
          wind: { mph: 14, gustMph: 21, fromDeg: 260 },
          tides: [tide(5, 54, 4.6, true), tide(11, 59, 2.4, false), tide(17, 9, 3.9, true), tide(23, 32, 1.1, false)] }
      ]
    },

    muni: {
      line: 'N', alerts: [], fetchedAt: base.getTime(),
      places: [
        { id: 'duboce', name: 'Church & Duboce', arrivals: [
          { line: 'N', dir: 'OB', dest: 'Ocean Beach', t: base.getTime() + 4 * 60000 },
          { line: 'N', dir: 'IB', dest: 'Caltrain', t: base.getTime() + 9 * 60000 },
          { line: 'N', dir: 'OB', dest: 'Ocean Beach', t: base.getTime() + 13 * 60000 },
          { line: 'N', dir: 'IB', dest: 'Caltrain', t: base.getTime() + 19 * 60000 } ] },
        { id: 'church', name: 'Church Station east', arrivals: [
          { line: 'J', dir: 'IB', dest: 'Embarcadero', t: base.getTime() + 3 * 60000 },
          { line: 'N', dir: 'IB', dest: 'Caltrain', t: base.getTime() + 9 * 60000 },
          { line: 'K', dir: 'IB', dest: 'Embarcadero', t: base.getTime() + 12 * 60000 },
          { line: 'M', dir: 'IB', dest: 'Embarcadero', t: base.getTime() + 16 * 60000 } ] }
      ]
    },

    tv: {
      fetchedAt: base.getTime(),
      shows: [
        { id: 114, label: 'Survivor', ended: false, next: { season: 51, number: 10, airstamp: new Date(base.getTime() + 3 * 86400000).toISOString(), tba: false } },
        { id: 58177, label: 'The Traitors', ended: false, next: { season: 6, number: 1, airstamp: new Date(base.getTime() + 40 * 86400000).toISOString(), tba: true } }
      ]
    },

    snow: {
      fetchedAt: base.getTime(),
      resorts: [
        { id: 'palisades', name: 'Palisades Tahoe', elevationFt: 6211, tempF: 19, nowSnowing: false, last24hIn: 0.8, next24hIn: 1.2, next3dayIn: 0.6 },
        { id: 'kirkwood', name: 'Kirkwood', elevationFt: 7795, tempF: 16, nowSnowing: true, last24hIn: 0.4, next24hIn: 0.5, next3dayIn: 1.7 }
      ]
    },

    rivers: {
      fetchedAt: base.getTime(),
      rivers: [
        { id: 'chili', name: 'Chili Bar', sub: 'South Fork American', cfs: 1070, rating: 'ok', trend: 'steady', readAt: '8:15pm', source: 'mock' },
        { id: 'natoma', name: 'Lower American', sub: 'Below Lake Natoma', cfs: 1260, rating: 'ok', trend: 'falling', readAt: '8:00pm', source: 'mock' }
      ]
    },

    weather: {
      current: { tempF: 48, feelsF: 44, cond: 'partly', code: 2, windMph: 12, windFrom: 315, gustMph: 19,
        cloudCover: 45, precipIn: 0, isDay: true },
      aqi: { value: 42 },
      alerts: [{ event: 'Winter Weather Advisory', severity: 'moderate' }],
      daily: days
    }
  };
};
