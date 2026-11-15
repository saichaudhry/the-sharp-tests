// Identity: the browser makes a random UUID once, keeps it in localStorage,
// and sends it as the `x-player-id` header. A v4 UUID has 122 random bits, so
// it works like an unguessable bearer token. That's fine for play money; a
// real-money app would use proper auth (Supabase Auth, OAuth, etc.).
import { db, HttpError, unwrap } from './db.js';

// summarize() and round2() live in betting.js (HW9); re-exported so existing imports keep working.
export { round2, summarize } from './betting.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const STARTING_BANKROLL = 1000;

export function playerIdFrom(req) {
  const id = req.headers['x-player-id'];
  if (typeof id !== 'string' || !UUID_RE.test(id)) {
    throw new HttpError(401, 'Missing or invalid player id.');
  }
  return id.toLowerCase();
}

export async function requirePlayer(req) {
  const id = playerIdFrom(req);
  const player = unwrap(await db().from('players').select('*').eq('id', id).maybeSingle());
  if (!player) throw new HttpError(404, 'Player not found.');
  return player;
}
