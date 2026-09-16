"use strict";

// Paired-seed probability comparison under the unchanged 1/2/1 economy.
// Uses the existing production-SkillEngine validator, not a probability-only model.
const assert = require("node:assert/strict");
const { SKILL_CONFIG } = require("../game/skillConfig");
const { SkillEngine } = require("../game/skills/skillEngine");
const { FORTUNE_CONFIG, setFortuneChanceOverride } = require("../game/skills/fortuneConfig");
const { listSkillDefinitions } = require("../game/skills/definitions");
const { playHand, runMatches, makePlayer, makeRoom, attachTelemetry, mulberry32 } = require("./validate-fortune-debt");

const SEEDS = [20260915, 20260916, 20260917];
const BANDS = [0, 0.25, 0.5, 0.75, 0.9995];
const HANDS = Number(process.env.FB_HANDS || 2000);
const MATCHES = Number(process.env.FB_MATCHES || 100);
const OLD_CHANCES = {
  holeChance: { ...FORTUNE_CONFIG.holeChance, max: 0.20 },
  boardChance: { ...FORTUNE_CONFIG.boardChance, max: 0.12 },
  resourceChance: { ...FORTUNE_CONFIG.resourceChance, max: 0.22 },
};
const round = (n) => Number(n.toFixed(4));

function fixedBand(seed, disadvantage, hands) {
  // Keep nonzero stacks even in the extreme band; never simulate a dead player.
  const chipsB = Math.round(2000 / (2 - disadvantage));
  const chipsA = 2000 - chipsB;
  const engine = attachTelemetry(new SkillEngine({ random: mulberry32(seed) }));
  const a = makePlayer("A", "A", ["FORTUNE"]);
  const b = makePlayer("B", "B", ["RECYCLE"]);
  const room = makeRoom(a, b);
  const stats = { seed, hands, chipsA, chipsB, hole: 0, board: 0, resource: 0,
    energyTotal: 0, negativeHands: 0, longestNegativeRun: 0, energyDistribution: {} };
  let negativeRun = 0;
  for (let i = 0; i < hands; i += 1) {
    const result = playHand(engine, room, {
      chipsA, chipsB, resetChips: true, persistEnergy: true, betting: "none", dealerIndex: i % 2,
    });
    const transforms = room.skillState.transformations.filter((entry) => entry.skillId === "FORTUNE");
    stats.hole += transforms.filter((entry) => entry.node === "HOLE_DEAL").length;
    stats.board += transforms.filter((entry) => entry.node !== "HOLE_DEAL").length;
    stats.resource += Number(result.resourceHit);
    assert.equal(transforms.length, result.rewrites);
    const recovery = result.winnerId == null ? SKILL_CONFIG.ENERGY_TIE_GAIN
      : result.lost ? SKILL_CONFIG.ENERGY_LOSER_GAIN : SKILL_CONFIG.ENERGY_WINNER_GAIN;
    assert.equal(result.energyAfter, Math.min(8, result.energyAtStart - 3 * result.rewrites + recovery + Number(result.resourceHit)));
    assert(result.energyBeforeEnd >= -4 && result.energyAfter <= 8);
    const codes = [...a.cards, ...b.cards, ...room.communityCards, ...room.deck,
      ...room.skillState.burnedCards, ...room.skillState.removedCards].map((card) => card.code);
    assert.equal(codes.length, 52);
    assert.equal(new Set(codes).size, 52);
    assert.equal(a.chips + b.chips + room.pot, 2000);
    stats.energyTotal += result.energyAfter;
    stats.energyDistribution[result.energyAfter] = (stats.energyDistribution[result.energyAfter] || 0) + 1;
    const negative = Math.min(result.energyAtStart, result.energyBeforeEnd, result.energyAfter) < 0;
    stats.negativeHands += Number(negative);
    negativeRun = negative ? negativeRun + 1 : 0;
    stats.longestNegativeRun = Math.max(stats.longestNegativeRun, negativeRun);
  }
  return stats;
}

function summarizeBand(disadvantage, runs) {
  const sum = (key) => runs.reduce((total, row) => total + row[key], 0);
  const hands = sum("hands");
  const per100 = (key) => round(100 * sum(key) / hands);
  const energyDistribution = {};
  runs.forEach((row) => Object.entries(row.energyDistribution).forEach(([energy, count]) => {
    energyDistribution[energy] = (energyDistribution[energy] || 0) + count;
  }));
  return { disadvantage: round((runs[0].chipsB - runs[0].chipsA) / runs[0].chipsB), targetBand: disadvantage,
    hands, holePer100: per100("hole"), boardPer100: per100("board"), resourcePer100: per100("resource"),
    effectiveRewritesPer100: round(per100("hole") + per100("board")),
    averageEnergy: round(sum("energyTotal") / hands), negativeHandsPct: per100("negativeHands"),
    longestNegativeRun: Math.max(...runs.map((row) => row.longestNegativeRun)), energyDistribution, seeds: runs };
}

function loadoutSpace(deadEndLoad) {
  const catalog = listSkillDefinitions().map((skill) => skill.id === "DEAD_END" ? { ...skill, load: deadEndLoad } : skill);
  const stats = { total: 0, includingDeadEnd: 0, bySize: {} };
  function visit(start, count, load, hasDeadEnd) {
    if (count >= SKILL_CONFIG.MIN_EQUIPPED_SKILLS) {
      stats.total += 1;
      stats.includingDeadEnd += Number(hasDeadEnd);
      stats.bySize[count] = (stats.bySize[count] || 0) + 1;
    }
    if (count === SKILL_CONFIG.MAX_EQUIPPED_SKILLS) return;
    for (let i = start; i < catalog.length; i += 1) {
      if (load + catalog[i].load <= SKILL_CONFIG.MAX_SKILL_LOAD) {
        visit(i + 1, count + 1, load + catalog[i].load, hasDeadEnd || catalog[i].id === "DEAD_END");
      }
    }
  }
  visit(0, 0, 0, false);
  return stats;
}

function main() {
  assert(Number.isSafeInteger(HANDS) && HANDS > 0);
  assert(Number.isSafeInteger(MATCHES) && MATCHES > 0);
  assert.deepEqual([SKILL_CONFIG.ENERGY_WINNER_GAIN, SKILL_CONFIG.ENERGY_LOSER_GAIN, SKILL_CONFIG.ENERGY_TIE_GAIN], [1, 2, 1]);
  const report = { seeds: SEEDS, handsPerBandPerSeed: HANDS, matchesPerSeed: MATCHES,
    economy: { winner: 1, loser: 2, tie: 1 },
    methodology: [
      "Fixed-stack bands isolate Fortune with persistent energy; every hand runs production card rewrites, evaluation and endHand recovery.",
      "The extreme band uses 1/1999 chips, not a zero-stack player. Same seeds are used for both variants; RNG streams may diverge after different proc decisions.",
      "Match wins use the existing public-information fold-policy harness, capped at 80 hands. They are not human win rates or full server-match acceptance.",
      "All comparisons use the new energy economy. These results do not reconstruct the old-economy reference curve.",
    ], variants: {}, loadouts: { previous: loadoutSpace(4), current: loadoutSpace(5) } };
  try {
    for (const [name, override] of [["soft-v1", OLD_CHANCES], [FORTUNE_CONFIG.variant, null]]) {
      setFortuneChanceOverride(override);
      process.stderr.write(`Comparing ${name}\n`);
      const bands = BANDS.map((band) => summarizeBand(band, SEEDS.map((seed) => fixedBand(seed, band, HANDS))));
      const matches = SEEDS.map((seed) => {
        const stats = runMatches(seed, { matches: MATCHES, maxHands: 80,
          loadoutA: ["FORTUNE", "RECYCLE"], loadoutB: ["DEEP_BREATH", "RECYCLE"], betting: "fold" });
        assert.equal(stats.chipResetBugs, 0);
        return { seed, matches: stats.matches, wins: stats.aWins, hands: stats.hands,
          negativeHands: stats.debtHandsAny, rewrites: stats.rewrites };
      });
      report.variants[name] = { bands, matches,
        matchWinRate: round(matches.reduce((n, row) => n + row.wins, 0) / (MATCHES * SEEDS.length)) };
    }
  } finally {
    setFortuneChanceOverride(null);
  }
  const old = report.variants["soft-v1"].bands;
  report.comparison = report.variants[FORTUNE_CONFIG.variant].bands.map((row, i) => ({
    disadvantage: row.disadvantage, previousPer100: old[i].effectiveRewritesPer100,
    currentPer100: row.effectiveRewritesPer100,
    changePct: round(100 * (row.effectiveRewritesPer100 / old[i].effectiveRewritesPer100 - 1)),
  }));
  report.integrity = "PASS: per-hand energy accounting, floor/cap, 52 unique cards, chip conservation";
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (require.main === module) main();

module.exports = { fixedBand, loadoutSpace };
