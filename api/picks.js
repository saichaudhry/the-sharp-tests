// GET  /api/picks -> your open picks with Kalshi's price right now
// POST /api/picks {sport, eventId, team, stake} -> place a play-money pick
//
// The client only says WHICH game and side. The price comes from our own
// (cached) copy of the Kalshi prices, so nobody can POST themselves +10000 odds.
import { db, handle, HttpError, unwrap } from './_lib/db.js';
import { requirePlayer } from './_lib/player.js';
import { findGame, liveCents, marketFor, SPORTS } from './_lib/odds.js';
import { loadProfile } from './me.js';
import { checkStake } from './_lib/betting.js';

export default handle({
  // Open picks + where the market is now: "you got 47¢, it's 52¢ now".
  async GET(req) {
    const player = await requirePlayer(req);
    const open = unwrap(await db().from('picks').select('*')
      .eq('player_id', player.id).eq('status', 'pending').order('commence_time'));
    const live = await Promise.all(open.map(async (p) => {
      const market = await marketFor(p).catch(() => null);
      return { id: p.id, cents: liveCents(market), status: market?.status || null };
    }));
    return { live };
  },

  async POST(req) {
    const player = await requirePlayer(req);
    const { sport, eventId, team } = req.body || {};

    if (!SPORTS[sport] || typeof eventId !== 'string') throw new HttpError(400, 'Bad game.');
    const { stake, error: stakeError } = checkStake(req.body?.stake, player.bankroll);
    if (stakeError) throw new HttpError(400, stakeError);

    const game = await findGame(sport, eventId);
    if (!game) throw new HttpError(409, 'That game is no longer on the board (it may have started).');
    if (team !== game.home && team !== game.away) throw new HttpError(400, 'Pick one of the two teams.');

    const { error } = await db().rpc('place_pick', {
      p_player: player.id, p_event: game.id, p_sport: sport,
      p_home: game.home, p_away: game.away, p_commence: game.commence,
      p_team: team, p_price: game.prices[team], p_stake: stake,
    });
    if (error?.message?.includes('INSUFFICIENT_FUNDS')) throw new HttpError(400, "You don't have that much.");
    if (error) throw error;

    return loadProfile(await requirePlayer(req));
  },
});
