// EDIT FOR YOUR SETUP: which Google calendars the dashboard reads, and how each behaves
// (spec section 6). Calendars are matched by their name as shown in Google Calendar
// ("primary" = your own main calendar), so no calendar IDs or other people's email
// addresses need to live in the repo.
//
// role: 'mine'   shown, triggers alerts, affects the commute "home by" time
//       'family' shown dimmed; counts only if it names you, invites you, or matches a keyword
//       'other'  shown dimmed, never counts
//
// key: picks the color in site/js/config.js -> calendars (work, personal, family, ooo, holiday).
// If two calendars carry the same events (e.g. two copies of a family calendar), they're shown once.
// The shared calendar's name is a Netlify env var (DASH_SHARED_CAL), not committed: it may contain
// personal names. It must match the name shown in Google Calendar exactly.
const SHARED = process.env.DASH_SHARED_CAL || 'Family';

export const CALENDARS = [
  { match: 'primary', key: 'personal', role: 'mine' },
  { match: SHARED, key: 'family', role: 'mine' },                // shared with a partner: everything counts
  { match: 'Holidays in United States', key: 'holiday', role: 'other' }
];

// Events whose title contains one of these words (whole word, any case) get a dog tag on the page and
// always show at full brightness. Add the dog's name in the DASH_DOG_WORDS env var (comma-separated).
export const DOG_WORDS = ['heartworm', 'heart worm', 'flea', 'tick', 'vet', 'groom', 'groomer', 'dog', 'pup', 'puppy',
  'medicine', 'meds']
  .concat((process.env.DASH_DOG_WORDS || '').split(',').map((w) => w.trim()).filter(Boolean));

// A family event counts if its title contains one of these names (whole word, any case)...
export const NAME_VARIANTS = ['YourName', 'Nickname'];
// ...or one of these keywords. Empty by default; add words like 'dinner' as needed.
export const FAMILY_KEYWORDS = [];
