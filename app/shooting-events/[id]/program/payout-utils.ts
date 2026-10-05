export type WinnerMode = "fraction" | "fixed" | "all";

export type PayoutConfig = {
  payoutPercentage: number;
  winnerMode: WinnerMode;
  winnerNumerator?: number | null;
  winnerDenominator?: number | null;
  fixedWinnerCount?: number | null;
  minimumFirst?: number | null;
  minimumSecond?: number | null;
  minimumThird?: number | null;
  minimumLast?: number | null;
  payoutStep: number;
  curveExponent?: number | null;
  instantPayoutMax?: number | null;
};

export type RankPayout = {
  rank: number;
  amount: number;
};

export type PayoutCalculation = {
  winnerCount: number;
  grossPrizePool: number;
  rankingPrizePool: number;
  payouts: RankPayout[];
  distributed: number;
  remainder: number;
  warnings: string[];
};

const EPSILON = 0.000001;

function cents(value: number) {
  return Math.round(value * 100) / 100;
}

function floorToStep(value: number, step: number) {
  if (step <= 0) throw new Error("Die Auszahlungsschrittgroesse muss groesser als 0 sein.");
  return cents(Math.floor((value + EPSILON) / step) * step);
}

export function getWinnerCount(participantCount: number, config: PayoutConfig) {
  if (participantCount <= 0) return 0;

  if (config.winnerMode === "all") return participantCount;

  if (config.winnerMode === "fixed") {
    return Math.max(0, Math.min(participantCount, Math.floor(config.fixedWinnerCount ?? 0)));
  }

  const numerator = Math.max(0, config.winnerNumerator ?? 0);
  const denominator = Math.max(1, config.winnerDenominator ?? 1);

  return Math.max(
    0,
    Math.min(participantCount, Math.floor((participantCount * numerator) / denominator))
  );
}

function minimumForRank(rank: number, winnerCount: number, config: PayoutConfig) {
  const last = Math.max(0, config.minimumLast ?? 0);
  if (rank === 1 && config.minimumFirst != null) return Math.max(last, config.minimumFirst);
  if (rank === 2 && config.minimumSecond != null) return Math.max(last, config.minimumSecond);
  if (rank === 3 && config.minimumThird != null) return Math.max(last, config.minimumThird);
  if (rank <= winnerCount) return last;
  return 0;
}

export function calculateRankingPayouts(args: {
  participantCount: number;
  revenueChf: number;
  instantPayoutTotalChf: number;
  config: PayoutConfig;
}): PayoutCalculation {
  const { participantCount, revenueChf, instantPayoutTotalChf, config } = args;
  const warnings: string[] = [];
  const winnerCount = getWinnerCount(participantCount, config);
  // Sofortauszahlungen werden zuerst von den Einnahmen abgezogen.
  // Die Ausschüttungsquote bezieht sich anschliessend auf den noch verfügbaren Betrag.
  const availableAfterInstant = cents(
    Math.max(0, Math.max(0, revenueChf) - Math.max(0, instantPayoutTotalChf))
  );
  const grossPrizePool = cents(
    availableAfterInstant * (Math.max(0, config.payoutPercentage) / 100)
  );
  const rankingPrizePool = grossPrizePool;

  if (winnerCount === 0 || rankingPrizePool <= 0) {
    return { winnerCount, grossPrizePool, rankingPrizePool, payouts: [], distributed: 0, remainder: rankingPrizePool, warnings };
  }

  const step = config.payoutStep;
  const minimums = Array.from({ length: winnerCount }, (_, index) =>
    floorToStep(minimumForRank(index + 1, winnerCount, config), step)
  );

  const minimumTotal = cents(minimums.reduce((sum, amount) => sum + amount, 0));
  if (minimumTotal > rankingPrizePool + EPSILON) {
    warnings.push(
      `Die Mindestpreise benoetigen CHF ${minimumTotal.toFixed(2)}, verfuegbar sind aber nur CHF ${rankingPrizePool.toFixed(2)}.`
    );
    return {
      winnerCount,
      grossPrizePool,
      rankingPrizePool,
      payouts: minimums.map((amount, index) => ({ rank: index + 1, amount })),
      distributed: minimumTotal,
      remainder: cents(rankingPrizePool - minimumTotal),
      warnings,
    };
  }

  const remaining = cents(rankingPrizePool - minimumTotal);
  const exponent = Math.max(0.05, config.curveExponent ?? 0.6);
  const weights = Array.from({ length: winnerCount }, (_, index) =>
    1 / Math.pow(index + 1, exponent)
  );
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);

  const payouts = minimums.map((minimum, index) => {
    const extraRaw = remaining * (weights[index] / weightTotal);
    return floorToStep(minimum + extraRaw, step);
  });

  // Preserve non-increasing payouts after rounding/minimum constraints.
  for (let i = 1; i < payouts.length; i += 1) {
    payouts[i] = Math.min(payouts[i], payouts[i - 1]);
    payouts[i] = Math.max(payouts[i], minimums[i]);
  }

  let distributed = cents(payouts.reduce((sum, amount) => sum + amount, 0));
  let remainder = cents(rankingPrizePool - distributed);

  // Distribute the remaining full steps from the top down.
  let guard = 0;
  while (remainder + EPSILON >= step && guard < 100000) {
    let changed = false;
    for (let i = 0; i < payouts.length && remainder + EPSILON >= step; i += 1) {
      const proposed = cents(payouts[i] + step);
      const previous = i === 0 ? Number.POSITIVE_INFINITY : payouts[i - 1];
      if (proposed <= previous + EPSILON) {
        payouts[i] = proposed;
        remainder = cents(remainder - step);
        changed = true;
      }
    }
    if (!changed) break;
    guard += 1;
  }

  distributed = cents(payouts.reduce((sum, amount) => sum + amount, 0));
  remainder = cents(rankingPrizePool - distributed);

  return {
    winnerCount,
    grossPrizePool,
    rankingPrizePool,
    payouts: payouts.map((amount, index) => ({ rank: index + 1, amount })),
    distributed,
    remainder,
    warnings,
  };
}

export function splitTiedRankPayout(args: {
  payoutByRank: Map<number, number>;
  startRank: number;
  tiedCount: number;
  lastPaidRank: number;
  payoutStep: number;
}) {
  const { payoutByRank, startRank, tiedCount, lastPaidRank, payoutStep } = args;
  const coveredRanks = Math.max(0, Math.min(tiedCount, lastPaidRank - startRank + 1));
  if (coveredRanks === 0) return { amountEach: 0, consumed: 0, remainder: 0 };

  let pot = 0;
  for (let rank = startRank; rank < startRank + coveredRanks; rank += 1) {
    pot += payoutByRank.get(rank) ?? 0;
  }

  const amountEach = floorToStep(pot / tiedCount, payoutStep);
  const consumed = cents(amountEach * tiedCount);
  return { amountEach, consumed, remainder: cents(pot - consumed) };
}


export function getRemainingInstantPayoutBudget(args: {
  alreadyPaidChf: number;
  instantPayoutMax?: number | null;
}) {
  const { alreadyPaidChf, instantPayoutMax } = args;

  if (instantPayoutMax == null) return Number.POSITIVE_INFINITY;

  return cents(Math.max(0, instantPayoutMax - Math.max(0, alreadyPaidChf)));
}

export function getAllowedInstantPayoutAmount(args: {
  requestedAmountChf: number;
  alreadyPaidChf: number;
  instantPayoutMax?: number | null;
}) {
  const remaining = getRemainingInstantPayoutBudget({
    alreadyPaidChf: args.alreadyPaidChf,
    instantPayoutMax: args.instantPayoutMax,
  });

  if (!Number.isFinite(remaining)) {
    return cents(Math.max(0, args.requestedAmountChf));
  }

  return cents(Math.min(Math.max(0, args.requestedAmountChf), remaining));
}

export type InstantPayoutRule = {
  score: number;
  firstAmountChf: number;
  repeatAmountChf: number;
};

/**
 * Berechnet die naechste Sofortauszahlung fuer EINEN Schuetzen in EINEM Stich.
 * scoreOccurrenceForShooter ist 1 beim ersten gleichen Resultat dieses Schuetzen,
 * 2 beim zweiten usw. Ab dem zweiten Vorkommen gilt immer repeatAmountChf.
 * alreadyPaidForShooterChf ist nur die bisherige Sofortauszahlung dieses Schuetzen
 * in diesem Stich. Das optionale Maximum gilt daher je Schuetze und Stich.
 */
export function calculateInstantPayoutForShooter(args: {
  rule: InstantPayoutRule;
  scoreOccurrenceForShooter: number;
  alreadyPaidForShooterChf: number;
  instantPayoutMaxPerShooterChf?: number | null;
}) {
  const requestedAmountChf =
    args.scoreOccurrenceForShooter <= 1
      ? args.rule.firstAmountChf
      : args.rule.repeatAmountChf;

  return getAllowedInstantPayoutAmount({
    requestedAmountChf,
    alreadyPaidChf: args.alreadyPaidForShooterChf,
    instantPayoutMax: args.instantPayoutMaxPerShooterChf,
  });
}
