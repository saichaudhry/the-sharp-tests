// Pure betting rules: stake checks, payouts, grading, record. No database, no imports.
// Moved out of picks.js, settle.js and player.js (HW9) so it can be tested with `node --test`.

export const MAX_STAKE = 500;

export const round2 = (n) => Math.round(n * 100) / 100;

// Validates a stake the client sent. Returns { stake } (rounded to cents) or
// { error } with the message the API shows. Checks run in this order on purpose.
export function checkStake(rawStake, bankroll) {
  const stake = Math.round(Number(rawStake) * 100) / 100;
  if (!Number.isFinite(stake) || stake < 1) return { error: 'Minimum stake is $1.' };
  if (stake > MAX_STAKE) return { error: `Max stake is $${MAX_STAKE}. Lou has limits.` };
  if (stake > Number(bankroll)) return { error: "You don't have that much." };
  return { stake };
}

// Profit on a winning bet at American odds.
export function profitOn(stake, price) {
  return price > 0 ? stake * (price / 100) : stake * (100 / -price);
}

// Turns a Kalshi result into our pick result.
export function grade(pick, result) {
  const stake = Number(pick.stake);
  if (result === 'yes') return { status: 'won', payout: round2(stake + profitOn(stake, pick.price)) };
  if (result === 'no') return { status: 'lost', payout: 0 };
  if (result === 'void') return { status: 'push', payout: stake };
  return null;
}

// Win/loss record and profit, computed from the player's settled picks.
export function summarize(picks) {
  const settled = picks.filter((p) => p.status !== 'pending');
  const won = settled.filter((p) => p.status === 'won').length;
  const lost = settled.filter((p) => p.status === 'lost').length;
  const push = settled.filter((p) => p.status === 'push').length;
  const staked = settled.reduce((s, p) => s + Number(p.stake), 0);
  const profit = settled.reduce((s, p) => s + Number(p.payout) - Number(p.stake), 0);
  return {
    won, lost, push,
    pending: picks.length - settled.length,
    profit: round2(profit),
    roi: staked > 0 ? round2((profit / staked) * 100) : 0,
  };
}
