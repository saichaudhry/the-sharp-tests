// Pure pricing logic for Kalshi markets: no network, no database, no imports.
// Moved out of odds.js (HW9) so it can be tested on its own with `node --test`.

// "KXNFLGAME-26OCT05ATLNO" -> "20261005" (the game's date, US Eastern)
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export function tickerDate(eventTicker) {
  const m = eventTicker.split('-')[1]?.match(/^(\d{2})([A-Z]{3})(\d{2})/);
  const month = m && MONTHS.indexOf(m[2]);
  if (!m || month < 0) return null;
  return `20${m[1]}${String(month + 1).padStart(2, '0')}${m[3]}`;
}

// Price rule: pay the ask when the market is tight (spread <= 5¢);
// otherwise use the midpoint, so one thin order doesn't set a silly price.
export function yesPrice(m) {
  const bid = Number(m.yes_bid_dollars) || 0;
  const ask = Number(m.yes_ask_dollars) || 0;
  if (bid > 0 && ask > 0) return ask - bid <= 0.05 ? ask : (ask + bid) / 2;
  return Number(m.last_price_dollars) || null;
}

// 0.54 -> -117, 0.40 -> +150. The rest of the app (bet slip, payouts) works in American odds.
export function toAmerican(p) {
  return p >= 0.5 ? -Math.round((100 * p) / (1 - p)) : Math.round((100 * (1 - p)) / p);
}

const norm = (s = '') => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

// How well a Kalshi side ("NYJ", "New York J") matches an ESPN team. 0 = no match.
export function matchScore(side, team) {
  let score = 0;
  if (side.abbr === team.abbr) score += 3;
  const n = norm(side.name);
  if (n && (norm(team.name).startsWith(n) || norm(team.short) === n)) score += 2; // "New York J" -> "New York Jets"
  else if (n && norm(team.location) && n.startsWith(norm(team.location))) score += 1; // "Chicago WS" -> "Chicago" (weak)
  return score;
}

// How a pick's market settled: 'yes', 'no', 'void', or null if it isn't final yet.
export function resultOf(market) {
  if (!market || !['finalized', 'settled'].includes(market.status)) return null;
  if (market.result === 'yes' || market.result === 'no') return market.result;
  return 'void';
}

// What the market says now, in cents (for "you got 47¢, it's 52¢ now").
export function liveCents(market) {
  const p = market && yesPrice(market);
  return p ? Math.round(p * 100) : null;
}
