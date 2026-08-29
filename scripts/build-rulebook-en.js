"use strict";

require("../public/i18n/i18n");
require("../public/i18n/skills-en-US");
const fs = require("fs");
const path = require("path");
const zh = require("../public/rulebook-data");
const i18n = globalThis.OverlimitI18n;
i18n.setLocale("en-US", { silent: true });

const SKILL_ID_BY_RULE = {
  "skill-deep-breath": "DEEP_BREATH",
  "skill-recycle": "RECYCLE",
  "skill-intimidation": "INTIMIDATION",
  "skill-desperation": "DESPERATION",
  "skill-blood-battle": "BLOOD_BATTLE",
  "skill-defense": "DEFENSE",
  "skill-perception": "PERCEPTION",
  "skill-intel": "INTEL_ONE",
  "skill-top-secret": "TOP_SECRET",
  "skill-counter": "COUNTER",
  "skill-fairness": "FAIRNESS",
  "skill-cheat": "CHEAT",
  "skill-dead-end": "DEAD_END",
  "skill-clairvoyance": "CLAIRVOYANCE",
  "skill-nullification": "NULLIFICATION",
  "skill-fortune": "FORTUNE",
  "skill-destiny": "DESTINY",
  "skill-loan": "LOAN",
  "skill-alert": "ALERT",
  "skill-retreat": "RETREAT",
  "skill-restart": "RESTART",
  "skill-probe": "PROBE",
  "skill-disguise": "DISGUISE",
  "skill-endgame": "ENDGAME",
};

const META_EN = {
  "负载": "Load",
  "能量": "Energy",
  "主动": "Active",
  "被动": "Passive",
  "秘密": "Secret",
  "公开": "Public",
  "完全秘密": "fully Secret",
  "每手": "per hand",
  "次": "",
  "本人下注回合": "your betting turn",
  "结算公开": "settlement public",
  "条件满足时公开": "public when conditions met",
  "手牌开始判定": "checked at hand start",
  "仅翻牌前放置": "planted Pre-Flop only",
  "可见性混合": "mixed visibility",
  "翻牌及之后": "Flop and later",
};

function translateMeta(items) {
  return (items || []).map((item) => {
    let next = String(item);
    next = next
      .replace(/结算公开/g, "settlement public")
      .replace(/条件满足时公开/g, "public when conditions met")
      .replace(/每手最多成功提示 1 次/g, "at most one successful hint per hand")
      .replace(/每手最多成功 3 次/g, "at most 3 successes per hand")
      .replace(/牌面改良/g, "Board rewrite")
      .replace(/次数由信用决定/g, "uses decided by credit")
      .replace(/合法下注或专属响应窗口/g, "legal betting or exclusive response window")
      .replace(/结束资源/g, "end-of-hand resource")
      .replace(/翻牌及之后/g, "Flop and later")
      .replace(/翻牌前/g, "Pre-Flop")
      .replace(/翻牌/g, "Flop")
      .replace(/转牌后/g, "after Turn")
      .replace(/转牌/g, "Turn")
      .replace(/河牌/g, "River")
      .replace(/负载\s*/g, "Load ")
      .replace(/能量\s*/g, "Energy ")
      .replace(/主动/g, "Active")
      .replace(/被动/g, "Passive")
      .replace(/完全秘密/g, "fully Secret")
      .replace(/秘密/g, "Secret")
      .replace(/公开/g, "Public")
      .replace(/每手/g, "per hand")
      .replace(/本人下注回合/g, "your betting turn")
      .replace(/手牌开始判定/g, "checked at hand start")
      .replace(/仅翻牌前放置/g, "planted Pre-Flop only")
      .replace(/可见性混合/g, "mixed visibility")
      .replace(/翻牌及之后/g, "Flop and later")
      .replace(/转牌后/g, "after Turn")
      .replace(/无固定次数上限/g, "no fixed per-hand cap")
      .replace(/公共牌/g, "Community Card")
      .replace(/底牌/g, "Hole Card")
      .replace(/最多结算 1 次/g, "settles at most once")
      .replace(/最多自动启动 1 次/g, "auto-starts at most once")
      .replace(/4 个节点/g, "4 nodes")
      .replace(/1 次/g, "once");
    return next.replace(/\s+/g, " ").replace(/·/g, "·").trim();
  });
}

const SECTIONS = {
  "rule-overview": {
    title: "Game Objective",
    shortTitle: "Objective",
    keywords: "OVERLIMIT HOLD'EM heads-up No-Limit Texas Hold'em 1000 25 50 Energy Skill Loadout",
    content: `
      <p><strong>OVERLIMIT: HOLD'EM</strong> is a heads-up No-Limit Texas Hold'em strategy game.</p>
      <p>Players contest chips through betting, Folds, and Showdown. When skills are on, a pre-match Skill Loadout can change resources, information, the Board, the deck, actions, and final settlement.</p>
      <div class="rules-table-wrap">
        <table class="rules-table">
          <caption>Base parameters</caption>
          <tbody>
            <tr><th scope="row">Players</th><td>2</td></tr>
            <tr><th scope="row">Starting stack</th><td>1000 each</td></tr>
            <tr><th scope="row">Small Blind / Big Blind</th><td>25 / 50</td></tr>
            <tr><th scope="row">Starting Energy / ordinary cap</th><td>4 / 8</td></tr>
            <tr><th scope="row">Skill Loadout</th><td>1–4 skills, total Load at most 8</td></tr>
          </tbody>
        </table>
      </div>
      <p>When either stack reaches 0, the match ends and the other player wins. Chips move only between players or between a player and the Pot. Except where a rule says otherwise, the table total stays 2000.</p>
      <aside class="rules-note">Hand Rank Bonus and the base chip economy apply in every game mode, with or without skills.</aside>
    `,
  },
  "rule-modes": {
    title: "Game Modes",
    shortTitle: "Modes",
    keywords: "Standard Overdrive deck skills on off",
    content: `
      <p>Dealing mode and skill mode are independent. Pick a deck type and whether skills are on.</p>
      <section id="rule-mode-standard" data-rule-entry data-rule-entry-title="Standard">
        <h4>Standard</h4>
        <p>A full 52-card random deck. Heads-up No-Limit Texas Hold'em dealing, betting, rankings, and Showdown, plus OVERLIMIT Hand Rank Bonus and base economy.</p>
      </section>
      <section id="rule-mode-overdrive" data-rule-entry data-rule-entry-title="Overdrive">
        <h4>Overdrive</h4>
        <p>A stronger starting-deck generator that leans toward strong-hand fights, River upgrades, River come-from-behind, and high-made boards. Overdrive does not change betting, chips, rankings, Showdown, or Hand Rank Bonus. After a skill changes the deck, candidate boards are not regenerated.</p>
      </section>
      <section id="rule-mode-skills" data-rule-entry data-rule-entry-title="Skills on and off">
        <h4>Skills on and off</h4>
        <p><strong>Skills off:</strong> no Skill Loadout, Energy spend, or skill effects. Hand Rank Bonus still applies.</p>
        <p><strong>Skills on:</strong> finish a Loadout before the match, then use skills, Energy, and special settlement on top of standard Hold'em.</p>
      </section>
    `,
  },
  "rule-blinds": {
    title: "Dealer, Blinds, and Action Order",
    shortTitle: "Dealer and blinds",
    keywords: "Dealer Button Small Blind Big Blind heads-up 25 50",
    content: `
      <p>At the start of each Hand, one player is on the Button and posts the Small Blind 25. The other player posts the Big Blind 50. Blinds are standard betting contributions and enter that hand's Pot.</p>
      <div class="rules-callout-grid">
        <div><span>Pre-Flop</span><strong>The Button / Small Blind acts first.</strong></div>
        <div><span>Flop, Turn, River</span><strong>The Big Blind acts first. The Button acts last post-flop.</strong></div>
      </div>
      <p>The Button swaps after each Hand, so both players take turns as Small Blind and Big Blind.</p>
    `,
  },
  "rule-flow": {
    title: "Hand Flow",
    shortTitle: "Hand flow",
    keywords: "Pre-Flop Flop Turn River Showdown Hole Cards Community Cards",
    content: `
      <p>Each player receives 2 private Hole Cards. Up to 5 Community Cards are dealt and shared.</p>
      <ol class="rules-timeline">
        <li><span>01</span><div><strong>Pre-Flop</strong><p>Hole Cards only. First Betting Round.</p></div></li>
        <li><span>02</span><div><strong>Flop</strong><p>3 Community Cards. Second Betting Round.</p></div></li>
        <li><span>03</span><div><strong>Turn</strong><p>4th Community Card. Third Betting Round.</p></div></li>
        <li><span>04</span><div><strong>River</strong><p>5th Community Card. Fourth Betting Round.</p></div></li>
        <li><span>05</span><div><strong>Showdown</strong><p>If nobody Folded, compare each player's best 5-card hand.</p></div></li>
      </ol>
      <p>A betting street ends when remaining players have acted legally and standard investment meets the current requirement. If no further betting is possible — for example one player is All-In and matched — remaining Community Cards are dealt automatically and the hand goes to Showdown.</p>
    `,
  },
  "rule-actions": {
    title: "Player Actions",
    shortTitle: "Actions",
    keywords: "Check Bet Call Raise Fold All-In timeout",
    content: `
      <p>On your turn you may only take a legal action the server offers for the current state.</p>
      <dl class="rules-dl rules-action-list">
        <div id="rule-action-check" data-rule-entry data-rule-entry-title="Check"><dt>Check</dt><dd>When nothing is owed, put in no extra chips and end this action.</dd></div>
        <div id="rule-action-bet" data-rule-entry data-rule-entry-title="Bet"><dt>Bet</dt><dd>Put chips in when nobody has Bet this street. The usual minimum Bet is the current Big Blind.</dd></div>
        <div id="rule-action-call" data-rule-entry data-rule-entry-title="Call"><dt>Call</dt><dd>Match the opponent's current standard bet. If your remaining chips are short, pay what you can as All-In.</dd></div>
        <div id="rule-action-raise" data-rule-entry data-rule-entry-title="Raise"><dt>Raise</dt><dd>Increase the current bet. The Raise increment is usually at least the last full Bet or full Raise increment this round. An All-In that does not make a full Raise does not reopen Raise rights for a player who already acted.</dd></div>
        <div id="rule-action-fold" data-rule-entry data-rule-entry-title="Fold"><dt>Fold</dt><dd>Give up the hand. The opponent wins immediately. Hands are not compared.</dd></div>
        <div id="rule-action-allin" data-rule-entry data-rule-entry-title="All In"><dt>All In</dt><dd>Put in the maximum chips currently allowed. Unmatched extras follow Chapter 13.</dd></div>
      </dl>
      <section id="rule-action-timeout" data-rule-entry data-rule-entry-title="Action timeout">
        <h4>Action timeout</h4>
        <p>Every human action turn has a server timer. On timeout, the system Checks if Check is legal; otherwise it Folds.</p>
      </section>
    `,
  },
  "rule-showdown": {
    title: "Winning a Hand and Showdown",
    shortTitle: "Showdown",
    keywords: "Fold win Showdown best five kicker Split Pot",
    content: `
      <section id="rule-win-by-fold" data-rule-entry data-rule-entry-title="Fold win">
        <h4>Fold win</h4>
        <p>After a Fold, the opponent wins the hand immediately. Folded hands do not compare rankings and do not pay Hand Rank Bonus.</p>
      </section>
      <section id="rule-showdown-best-five" data-rule-entry data-rule-entry-title="Showdown and best five">
        <h4>Showdown and best five</h4>
        <p>If nobody Folded and betting is complete, the hand goes to Showdown. Each player makes the strongest 5-card hand from 2 Hole Cards and 5 Community Cards.</p>
        <p>You may use 0, 1, or 2 Hole Cards. The stronger best five wins. If both best fives are identical, it is a Split Pot.</p>
      </section>
      <aside class="rules-note">All suits are equal. Suits never break ties.</aside>
    `,
  },
  "rule-hands": {
    title: "Poker Hand Rankings",
    shortTitle: "Hand Rankings",
    keywords: "Royal Flush Straight Flush Four of a Kind Full House Flush Straight Three of a Kind Two Pair One Pair High Card",
    content: `
      <p>Hands rank from high to low as follows. In this game a Royal Flush is an independent rank above a normal Straight Flush.</p>
      <div class="rules-hand-grid">
        <section id="hand-royal-flush" class="rules-hand-item" data-rule-entry data-rule-entry-title="Royal Flush"><div class="rules-hand-rank">01</div><div><h4>Royal Flush</h4><p>A, K, Q, J, 10 of the same suit.</p><div class="rules-card-example" aria-label="A of spades K of spades Q of spades J of spades 10 of spades"><b>A♠</b><b>K♠</b><b>Q♠</b><b>J♠</b><b>10♠</b></div></div></section>
        <section id="hand-straight-flush" class="rules-hand-item" data-rule-entry data-rule-entry-title="Straight Flush"><div class="rules-hand-rank">02</div><div><h4>Straight Flush</h4><p>Five consecutive cards of the same suit. Compare the top card.</p><div class="rules-card-example"><b>9♣</b><b>8♣</b><b>7♣</b><b>6♣</b><b>5♣</b></div></div></section>
        <section id="hand-quads" class="rules-hand-item" data-rule-entry data-rule-entry-title="Four of a Kind"><div class="rules-hand-rank">03</div><div><h4>Four of a Kind</h4><p>Compare the four, then the kicker.</p><div class="rules-card-example"><b>9♠</b><b class="is-red">9♥</b><b class="is-red">9♦</b><b>9♣</b><b>K♠</b></div></div></section>
        <section id="hand-full-house" class="rules-hand-item" data-rule-entry data-rule-entry-title="Full House"><div class="rules-hand-rank">04</div><div><h4>Full House</h4><p>Three of a Kind plus One Pair. Compare the three, then the pair.</p><div class="rules-card-example"><b>K♠</b><b class="is-red">K♥</b><b class="is-red">K♦</b><b>4♣</b><b class="is-red">4♥</b></div></div></section>
        <section id="hand-flush" class="rules-hand-item" data-rule-entry data-rule-entry-title="Flush"><div class="rules-hand-rank">05</div><div><h4>Flush</h4><p>Five of one suit that is not a Straight Flush. Compare from the highest card down.</p><div class="rules-card-example"><b class="is-red">A♥</b><b class="is-red">J♥</b><b class="is-red">8♥</b><b class="is-red">5♥</b><b class="is-red">2♥</b></div></div></section>
        <section id="hand-straight" class="rules-hand-item" data-rule-entry data-rule-entry-title="Straight"><div class="rules-hand-rank">06</div><div><h4>Straight</h4><p>Five consecutive ranks, mixed suits. Compare the top card.</p><div class="rules-card-example"><b>9♠</b><b class="is-red">8♥</b><b class="is-red">7♦</b><b>6♣</b><b>5♠</b></div></div></section>
        <section id="hand-trips" class="rules-hand-item" data-rule-entry data-rule-entry-title="Three of a Kind"><div class="rules-hand-rank">07</div><div><h4>Three of a Kind</h4><p>Compare the three, then the two kickers.</p><div class="rules-card-example"><b>7♠</b><b class="is-red">7♥</b><b class="is-red">7♦</b><b>A♣</b><b>10♠</b></div></div></section>
        <section id="hand-two-pair" class="rules-hand-item" data-rule-entry data-rule-entry-title="Two Pair"><div class="rules-hand-rank">08</div><div><h4>Two Pair</h4><p>Compare the higher pair, the lower pair, then the kicker.</p><div class="rules-card-example"><b>Q♠</b><b class="is-red">Q♥</b><b class="is-red">4♦</b><b>4♣</b><b>A♠</b></div></div></section>
        <section id="hand-pair" class="rules-hand-item" data-rule-entry data-rule-entry-title="One Pair"><div class="rules-hand-rank">09</div><div><h4>One Pair</h4><p>Compare the pair, then the three kickers.</p><div class="rules-card-example"><b>J♠</b><b class="is-red">J♥</b><b>A♣</b><b class="is-red">8♦</b><b>3♠</b></div></div></section>
        <section id="hand-high-card" class="rules-hand-item" data-rule-entry data-rule-entry-title="High Card"><div class="rules-hand-rank">10</div><div><h4>High Card</h4><p>None of the hands above. Compare the best five from the top down.</p><div class="rules-card-example"><b>A♠</b><b class="is-red">J♦</b><b>9♣</b><b class="is-red">6♥</b><b>3♠</b></div></div></section>
      </div>
      <aside class="rules-note"><strong>Ace in straights:</strong> Ace may play in A-K-Q-J-10, or as the low card in A-2-3-4-5. It cannot wheel around as Q-K-A-2-3. Suits never rank hands.</aside>
    `,
  },
  "rule-bonus": {
    title: "Hand Rank Bonus",
    shortTitle: "Hand Rank Bonus",
    keywords: "Hand Rank Bonus Showdown Fold Retreat Split Pot +25 +50 +75 +100 +250 +400 +500",
    content: `
      <div class="rules-rule-tag">Base rule shared by every mode</div>
      <p>Paid only on a unique Showdown win, using the winner's final best five. The loser pays the winner. The bonus joins the standard settlement base before legal multipliers, so it does not increase the table chip total.</p>
      <div class="rules-table-wrap">
        <table class="rules-table rules-bonus-table">
          <caption>Winning hand and base bonus</caption>
          <thead><tr><th>Hand</th><th>Bonus</th><th>Hand</th><th>Bonus</th></tr></thead>
          <tbody>
            <tr><th scope="row">High Card</th><td>+0</td><th scope="row">Flush</th><td>+75</td></tr>
            <tr><th scope="row">One Pair</th><td>+0</td><th scope="row">Full House</th><td>+100</td></tr>
            <tr><th scope="row">Two Pair</th><td>+0</td><th scope="row">Four of a Kind</th><td>+250</td></tr>
            <tr><th scope="row">Three of a Kind</th><td>+25</td><th scope="row">Straight Flush</th><td>+400</td></tr>
            <tr><th scope="row">Straight</th><td>+50</td><th scope="row">Royal Flush</th><td>+500</td></tr>
          </tbody>
        </table>
      </div>
      <aside class="rules-note">A normal Fold, a Retreat Fold, and a Split Pot pay no Hand Rank Bonus. If the loser cannot pay in full, actual payment cannot exceed payable chips.</aside>
    `,
  },
  "rule-loadout": {
    title: "Skill Loadout",
    shortTitle: "Loadout",
    keywords: "Skill Loadout Load 1 to 4 cap 8 Protocols hidden",
    content: `
      <p>When skills are on, finish a Loadout before the match. Once confirmed, it cannot change for that match.</p>
      <div class="rules-callout-grid rules-callout-grid-three">
        <div><span>Skill count</span><strong>1–4</strong></div>
        <div><span>Total Load</span><strong>at most 8</strong></div>
        <div><span>Duplicates</span><strong>not allowed</strong></div>
      </div>
      <p>Protocols also occupy skill slots and Load. At match start the opponent does not learn your equipped count, total Load, or full list. Skills may be confirmed later from their own visibility and actual events.</p>
    `,
  },
  "rule-energy": {
    title: "Energy and Public Energy",
    shortTitle: "Energy",
    keywords: "Energy Energy Cap public energy 4 8 Destiny 10 Fortune -4",
    content: `
      <section id="rule-energy-real" data-rule-entry data-rule-entry-title="True Energy">
        <h4>True Energy</h4>
        <p>A normal Loadout starts at 4 Energy with cap 8. Equipping Destiny raises your true cap to 10. Fortune may take true Energy down to -4. Below 0, no new Active Skill may launch and no new Passive Skill event may fire except Fortune.</p>
      </section>
      <section id="rule-energy-recovery" data-rule-entry data-rule-entry-title="Natural end-of-hand recovery">
        <h4>Natural end-of-hand recovery</h4>
        <div class="rules-table-wrap"><table class="rules-table"><thead><tr><th>Hand result</th><th>Natural recovery</th></tr></thead><tbody><tr><th scope="row">Win</th><td>+0</td></tr><tr><th scope="row">Loss or normal Fold</th><td>+1</td></tr><tr><th scope="row">Split Pot</th><td>+0</td></tr><tr><th scope="row">Retreat Fold</th><td>+0</td></tr></tbody></table></div>
        <p>Extra skill recovery, payment, borrowing, debt, or recovery suppression settle separately.</p>
      </section>
      <section id="rule-energy-public" data-rule-entry data-rule-entry-title="Opponent public Energy">
        <h4>Opponent public Energy</h4>
        <p>Opponent Energy is shown per hand and frozen during the hand: it updates after a hand finishes all resource settlement, then stays still through the next hand. Ordinary public range is 0–8; a true value below 0 shows 0, and 9 or 10 shows 8.</p>
        <p>You always see your own true Energy. Skills such as Clairvoyance can read the opponent's true current Energy.</p>
      </section>
    `,
  },
  "rule-skill-general": {
    title: "Skill General Rules",
    shortTitle: "Skill rules",
    keywords: "Active Skill Passive Skill Public Secret Counter Top Secret Fairness",
    content: `
      <section id="rule-active-skills" data-rule-entry data-rule-entry-title="Active Skills">
        <h4>Active Skills</h4>
        <p>An Active Skill needs a legal street and action window, plus target, use, Energy, and other conditions. After a legal launch the cost is paid, then the skill settles. Unless a skill says otherwise, Active Skills can be Countered.</p>
      </section>
      <section id="rule-passive-skills" data-rule-entry data-rule-entry-title="Passive Skills">
        <h4>Passive Skills</h4>
        <p>Passive Skills are judged automatically when conditions are met. A Passive that never actually fires is not a skill event.</p>
      </section>
      <section id="rule-skill-visibility" data-rule-entry data-rule-entry-title="Public and Secret">
        <h4>Public and Secret</h4>
        <p>A <strong>Public Skill</strong> launch and its main result are public. A <strong>Secret Skill</strong> default result is only for the launcher or holder. If a rule makes part of the effect public, the opponent may confirm that skill from it.</p>
      </section>
      <section id="rule-skill-events" data-rule-entry data-rule-entry-title="Skill events and settled facts">
        <h4>Skill events and settled facts</h4>
        <p>A legal, paid Active launch that enters settlement, or a Passive that actually fires, is a skill event. Information already gained, swaps or deck edits already finished, and direct chip transfers already completed are settled facts. Later state-clears do not roll them back.</p>
      </section>
      <section id="rule-counter-general" data-rule-entry data-rule-entry-title="Counter general">
        <h4>Counter general</h4>
        <p>Counter captures the opponent's next legal Active Skill that has already paid. Illegal requests, cancels, network retries, and unfired Passives do not consume Counter. Fairness cannot be Countered.</p>
      </section>
      <section id="rule-top-secret-general" data-rule-entry data-rule-entry-title="Top Secret general">
        <h4>Top Secret general</h4>
        <p>Top Secret protects the holder's private Hole Card information and direct Hole Card operations, including reads, inference, swaps, Nullification, or other direct Hole Card effects. Community Card Intel, Clairvoyance, and pure skill meta-information are not protected.</p>
      </section>
      <section id="rule-fairness-general" data-rule-entry data-rule-entry-title="Fairness general">
        <h4>Fairness general</h4>
        <p>Fairness clears both players' still-live persistent, planted, and pending skill states, blocks later Active and Passive events this hand, and suppresses all end-of-hand Energy recovery this hand. It does not roll back finished information, card edits, deck edits, or direct chip transfers.</p>
      </section>
    `,
  },
  "rule-settlement": {
    title: "Chips, Pot, and Settlement",
    shortTitle: "Settlement",
    keywords: "Pot standard contribution direct skill transfer multipliers Defense",
    content: `
      <section id="rule-standard-contribution" data-rule-entry data-rule-entry-title="Standard betting contribution">
        <h4>Standard betting contribution</h4>
        <p>Blinds, Bets, Calls, Raises, and standard All-In investment are standard betting contributions. They enter the Pot and ordinary hand settlement.</p>
      </section>
      <section id="rule-direct-transfer" data-rule-entry data-rule-entry-title="Direct skill chip transfers">
        <h4>Direct skill chip transfers</h4>
        <p>Loan take/repay, Endgame seizure of unmatched extras, and other explicitly direct transfers are not standard Pot winnings. Unless a skill says otherwise they skip ordinary chip multipliers and Defense.</p>
      </section>
      <section id="rule-settlement-order" data-rule-entry data-rule-entry-title="Standard settlement order">
        <h4>Standard settlement order</h4>
        <ol class="rules-steps rules-numbered-steps">
          <li>Determine the standard Hold'em net chip transfer;</li>
          <li>Add Hand Rank Bonus;</li>
          <li>Add other legal base extras, such as Probe;</li>
          <li>Apply legal skill multipliers produced by the winner;</li>
          <li>Apply legal multipliers produced by the opponent;</li>
          <li>Apply final standard-loss modifiers such as Defense;</li>
          <li>Cap at the loser's actually payable chips;</li>
          <li>Complete the final integer chip transfer.</li>
        </ol>
      </section>
      <section id="rule-settlement-multipliers" data-rule-entry data-rule-entry-title="Multipliers and Defense">
        <h4>Multipliers and Defense</h4>
        <p>Blood Battle ×2, both Blood Battle ×4, Desperation win ×3, Dead End after a normal Fold ×3, a qualifying Protocol ×2. Legal multipliers stack by multiplication.</p>
        <p>If this hand already has a chip multiplier from the winner's other own skills, that player's Protocol does not trigger. Opponent multipliers do not block a Protocol. Defense is applied after base, extras, and multipliers, and halves the final standard net loss, rounding down.</p>
      </section>
      <aside class="rules-note">Official chip state is always an integer. The smallest unit is 1. No final transfer may take a payer below 0.</aside>
    `,
  },
  "rule-allin": {
    title: "All-In and Unmatched Investment",
    shortTitle: "All-In",
    keywords: "All-In unmatched side pot Endgame",
    content: `
      <p>All-In means putting in the maximum chips currently allowed. After All-In, if neither player has a later legal betting action, remaining Community Cards are dealt and the hand goes to Showdown.</p>
      <section id="rule-unmatched-bet" data-rule-entry data-rule-entry-title="Unmatched investment">
        <h4>Unmatched investment</h4>
        <p>In heads-up, only standard investment both players can match is contested. Extra unmatched standard investment above what the opponent can match is returned before Showdown.</p>
      </section>
      <section id="rule-no-side-pots" data-rule-entry data-rule-entry-title="Heads-up Pot">
        <h4>Heads-up Pot</h4>
        <p>OVERLIMIT: HOLD'EM does not use multi-way side pots. Endgame can explicitly change how unmatched opponent extras are handled; see core skills and key interactions.</p>
      </section>
    `,
  },
  "rule-skills": {
    title: "Core Skills",
    shortTitle: "Core skills",
    keywords: "24 core skills Deep Breath Endgame Loan Nullification Fortune Perception",
    content: "",
    kind: "skills",
  },
  "rule-protocols": {
    title: "Protocols",
    shortTitle: "Protocols",
    keywords: "9 Protocols High Card One Pair Two Pair Three of a Kind Straight Flush Full House Four of a Kind Straight Flush Royal Flush",
    content: "",
    kind: "protocols",
  },
  "rule-interactions": {
    title: "Key Interaction Rulings",
    shortTitle: "Interactions",
    keywords: "Fairness Counter Loan Retreat Disguise Endgame Nullification Clairvoyance Alert Dead End Probe Intimidation Top Secret Destiny Cheat",
    content: `
      <p>The table below records first-wave rulings that are easy to misread. Settled facts and still-live states must be kept distinct.</p>
      <div class="rules-table-wrap">
        <table class="rules-table rules-interaction-table">
          <thead><tr><th>Interaction</th><th>Ruling</th></tr></thead>
          <tbody>
            <tr id="interaction-fair-counter" data-rule-entry data-rule-entry-title="Fairness × Counter"><th scope="row">Fairness × Counter</th><td>Fairness cannot be Countered.</td></tr>
            <tr id="interaction-fair-loan" data-rule-entry data-rule-entry-title="Fairness × Loan"><th scope="row">Fairness × Loan</th><td>Clears unpaid state without refunding resources already taken. If debt is actually cleared, credit enters or stays restricted. Default only rises to restricted, not straight back to normal.</td></tr>
            <tr id="interaction-fair-retreat" data-rule-entry data-rule-entry-title="Fairness × Retreat"><th scope="row">Fairness × Retreat</th><td>Clears Retreat. The 3 Energy already paid is not refunded. A new Retreat cannot launch after Fairness.</td></tr>
            <tr id="interaction-fair-disguise" data-rule-entry data-rule-entry-title="Fairness × Disguise"><th scope="row">Fairness × Disguise</th><td>Clears Disguise. Later displays restore. Historical hidden numbers are not backfilled.</td></tr>
            <tr id="interaction-fair-endgame" data-rule-entry data-rule-entry-title="Fairness × Endgame"><th scope="row">Fairness × Endgame</th><td>Endgame cannot launch after Fairness succeeds. After Endgame closes betting there is no ordinary Fairness window. A completed Endgame seize is not rolled back.</td></tr>
            <tr id="interaction-fair-nullification" data-rule-entry data-rule-entry-title="Fairness × Nullification"><th scope="row">Fairness × Nullification</th><td>Nullification is a persistent state and can be cleared by Fairness.</td></tr>
            <tr id="interaction-disguise-clairvoyance" data-rule-entry data-rule-entry-title="Disguise × Clairvoyance"><th scope="row">Disguise × Clairvoyance</th><td>Clairvoyance can learn that Disguise happened, but cannot read chip, Pot, or bet numbers.</td></tr>
            <tr id="interaction-disguise-alert" data-rule-entry data-rule-entry-title="Disguise × Alert"><th scope="row">Disguise × Alert</th><td>Disguise is a public Active Skill and does not trigger Alert.</td></tr>
            <tr id="interaction-disguise-loan" data-rule-entry data-rule-entry-title="Disguise × Loan"><th scope="row">Disguise × Loan</th><td>A Chip Loan still publicly announces the launch, without publishing take, debt, or knockout numbers.</td></tr>
            <tr id="interaction-disguise-deadend" data-rule-entry data-rule-entry-title="Disguise × Dead End"><th scope="row">Disguise × Dead End</th><td>Dead End All-In is always forced public.</td></tr>
            <tr id="interaction-retreat-deadend" data-rule-entry data-rule-entry-title="Retreat × Dead End"><th scope="row">Retreat × Dead End</th><td>Retreat then Dead End still allows a Retreat Fold in a legal window. Dead End first blocks a new Retreat. A Retreat Fold makes standard net 0, so Dead End's 0 × 3 stays 0.</td></tr>
            <tr id="interaction-retreat-probe" data-rule-entry data-rule-entry-title="Retreat × Probe"><th scope="row">Retreat × Probe</th><td>A Retreat Fold is not a normal Fold and does not trigger Probe.</td></tr>
            <tr id="interaction-retreat-intimidation" data-rule-entry data-rule-entry-title="Retreat × Intimidation"><th scope="row">Retreat × Intimidation</th><td>Intimidation forbids Fold, so a Retreat Fold cannot complete.</td></tr>
            <tr id="interaction-retreat-endgame" data-rule-entry data-rule-entry-title="Retreat × Endgame"><th scope="row">Retreat × Endgame</th><td>After Endgame closes betting there is no Fold window. An existing Retreat need not be deleted, but it cannot be used.</td></tr>
            <tr id="interaction-endgame-counter" data-rule-entry data-rule-entry-title="Endgame × Counter"><th scope="row">Endgame × Counter</th><td>Endgame pays 8 Energy first, then Counter is resolved. If Counter hits: no seize, no betting lock, no execution.</td></tr>
            <tr id="interaction-endgame-multiplier" data-rule-entry data-rule-entry-title="Endgame × multipliers"><th scope="row">Endgame × multipliers</th><td>Endgame's direct seize does not take Blood Battle, Desperation, or Protocol multipliers.</td></tr>
            <tr id="interaction-endgame-protocol" data-rule-entry data-rule-entry-title="Endgame × Protocol"><th scope="row">Endgame × Protocol</th><td>After Endgame names the winner, Protocols still judge independently from the winner's final hand and Protocol conditions.</td></tr>
            <tr id="interaction-nullification-future" data-rule-entry data-rule-entry-title="Nullification × future Community Cards"><th scope="row">Nullification × future Community Cards</th><td>Nullification locks a Community Card seat. Even if Destiny or Cheat later changes that seat's rank/suit, it stays invalid.</td></tr>
            <tr id="interaction-secret-intel" data-rule-entry data-rule-entry-title="Top Secret × Intel"><th scope="row">Top Secret × Intel</th><td>Blocks only the opponent Hole Card branch, not future Community Card looks.</td></tr>
            <tr id="interaction-secret-nullification" data-rule-entry data-rule-entry-title="Top Secret × Nullification"><th scope="row">Top Secret × Nullification</th><td>Protects Hole Card Nullification only, not Community Card seats.</td></tr>
          </tbody>
        </table>
      </div>
    `,
  },
  "rule-match-end": {
    title: "Split Pots, Match End, and Debt Expiry",
    shortTitle: "Match end",
    keywords: "Split Pot odd chip Big Blind game over Loan debt",
    content: `
      <section id="rule-tie" data-rule-entry data-rule-entry-title="Split Pot">
        <h4>Split Pot</h4>
        <p>If both final best fives are identical at Showdown, the hand is a Split Pot. Neither player gets Hand Rank Bonus, ordinary win multipliers, or the ordinary loser +1 Energy.</p>
        <p>Contested chips split evenly. If the Pot is odd, the leftover 1 chip goes to that hand's Big Blind.</p>
      </section>
      <section id="rule-game-over" data-rule-entry data-rule-entry-title="Match end">
        <h4>Match end</h4>
        <p>The system finishes the current hand's settlement and chip update first, then checks true stacks. When either stack is 0, the other player wins the match.</p>
      </section>
      <section id="rule-debt-expiry" data-rule-entry data-rule-entry-title="Loan debt expiry">
        <h4>Loan debt expiry</h4>
        <p>If the match is already over after the current hand settles, unfinished Loans, leftover chip debt, leftover Energy debt, and Loan credit clear immediately. There is no post-match repayment, and post-match debt cannot reverse an already decided result.</p>
        <p>If the match is still live, due repayment follows Loan rules. Repayment can zero a payer and end the match.</p>
      </section>
    `,
  },
  "rule-priority": {
    title: "Rule Priority and System Rulings",
    shortTitle: "Priority",
    keywords: "priority special state skill Overlimit No-Limit Texas Hold'em server",
    content: `
      <p>Standard No-Limit Texas Hold'em is the base. When this game's modes, skills, or special states explicitly change that base, the more specific rule wins.</p>
      <ol class="rules-priority-stack">
        <li><span>01</span><strong>Explicit special states or exception rules</strong></li>
        <li><span>02</span><strong>Specific skill rules</strong></li>
        <li><span>03</span><strong>OVERLIMIT: HOLD'EM base rules</strong></li>
        <li><span>04</span><strong>Standard No-Limit Texas Hold'em</strong></li>
      </ol>
      <p>Players may only take actions or skills the system currently treats as legal. Chips, deck, Energy, skill state, action legality, and final settlement follow the server.</p>
    `,
  },
};

const PROTOCOL_HAND = {
  "protocol-high-card": "High Card",
  "protocol-pair": "One Pair",
  "protocol-two-pair": "Two Pair",
  "protocol-trips": "Three of a Kind",
  "protocol-straight": "Straight",
  "protocol-flush": "Flush",
  "protocol-full-house": "Full House",
  "protocol-quads": "Four of a Kind",
  "protocol-straight-flush": "Straight Flush, Royal Flush",
};

function quote(value) {
  return JSON.stringify(value);
}

const sections = zh.sections.map((section) => {
  const overlay = SECTIONS[section.id];
  if (!overlay) throw new Error("missing English section " + section.id);
  return Object.assign({}, section, overlay);
});

const skills = zh.skills.map((skill) => {
  const id = SKILL_ID_BY_RULE[skill.id];
  if (!id) throw new Error("missing skill map " + skill.id);
  const name = i18n.t("skills." + id + ".name");
  const expert = i18n.t("skills." + id + ".expertDescription");
  return Object.assign({}, skill, {
    name,
    english: name,
    meta: translateMeta(skill.meta),
    content: "<p>" + expert.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</p>",
    keywords: skill.keywords,
  });
});

const protocols = zh.protocols.map((protocol) => {
  const id = protocol.id.replace("protocol-", "PROTOCOL_").replace("high-card", "HIGH_CARD").replace("two-pair", "TWO_PAIR").replace("straight-flush", "STRAIGHT_FLUSH").replace("full-house", "FULL_HOUSE").replace("pair", "PAIR").replace("trips", "TRIPS").replace("straight", "STRAIGHT").replace("flush", "FLUSH").replace("quads", "QUADS");
  const map = {
    "protocol-high-card": "PROTOCOL_HIGH_CARD",
    "protocol-pair": "PROTOCOL_PAIR",
    "protocol-two-pair": "PROTOCOL_TWO_PAIR",
    "protocol-trips": "PROTOCOL_TRIPS",
    "protocol-straight": "PROTOCOL_STRAIGHT",
    "protocol-flush": "PROTOCOL_FLUSH",
    "protocol-full-house": "PROTOCOL_FULL_HOUSE",
    "protocol-quads": "PROTOCOL_QUADS",
    "protocol-straight-flush": "PROTOCOL_STRAIGHT_FLUSH",
  };
  const skillId = map[protocol.id];
  const name = i18n.t("skills." + skillId + ".name");
  return {
    id: protocol.id,
    name,
    english: name,
    hand: PROTOCOL_HAND[protocol.id],
  };
});

function print(value, indent) {
  const pad = " ".repeat(indent);
  if (Array.isArray(value)) {
    return "[\n" + value.map((item) => pad + "  " + print(item, indent + 2)).join(",\n") + "\n" + pad + "]";
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value);
    return "{\n" + keys.map((key) => pad + "  " + key + ": " + print(value[key], indent + 2)).join(",\n") + "\n" + pad + "}";
  }
  return quote(value);
}

const book = {
  version: "1.0",
  title: "OVERLIMIT: HOLD'EM Rulebook",
  sections,
  skills,
  protocols,
};

const out = `"use strict";

const OVERLIMIT_RULEBOOK_EN_V1 = Object.freeze(${print(book, 0).replace(/^\{/, "{\n ").replace(/\n\}/, "\n}")});

if (typeof window !== "undefined") window.OVERLIMIT_RULEBOOK_EN_V1 = OVERLIMIT_RULEBOOK_EN_V1;
if (typeof module !== "undefined" && module.exports) module.exports = OVERLIMIT_RULEBOOK_EN_V1;
`;

fs.writeFileSync(path.join(__dirname, "..", "public", "i18n", "rulebook-en-US.js"), out, "utf8");
console.log("wrote rulebook-en-US.js", sections.length, "sections", skills.length, "skills", protocols.length, "protocols");
