"use strict";

const OVERLIMIT_RULEBOOK_EN_V1 = Object.freeze({
 
  version: "1.0",
  title: "OVERLIMIT: HOLD'EM Rulebook",
  sections: [
    {
      id: "rule-overview",
      number: "01",
      title: "Game Objective",
      shortTitle: "Objective",
      keywords: "OVERLIMIT HOLD'EM heads-up No-Limit Texas Hold'em 1000 25 50 Energy Skill Loadout",
      content: "\n      <p><strong>OVERLIMIT: HOLD'EM</strong> is a heads-up No-Limit Texas Hold'em strategy game.</p>\n      <p>Players contest chips through betting, Folds, and Showdown. When skills are on, a pre-match Skill Loadout can change resources, information, the Board, the deck, actions, and final settlement.</p>\n      <div class=\"rules-table-wrap\">\n        <table class=\"rules-table\">\n          <caption>Base parameters</caption>\n          <tbody>\n            <tr><th scope=\"row\">Players</th><td>2</td></tr>\n            <tr><th scope=\"row\">Starting stack</th><td>1000 each</td></tr>\n            <tr><th scope=\"row\">Small Blind / Big Blind</th><td>25 / 50</td></tr>\n            <tr><th scope=\"row\">Starting Energy / ordinary cap</th><td>4 / 8</td></tr>\n            <tr><th scope=\"row\">Skill Loadout</th><td>1–4 skills, total Load at most 8</td></tr>\n          </tbody>\n        </table>\n      </div>\n      <p>When either stack reaches 0, the match ends and the other player wins. Chips move only between players or between a player and the Pot. Except where a rule says otherwise, the table total stays 2000.</p>\n      <aside class=\"rules-note\">Hand Rank Bonus and the base chip economy apply in every game mode, with or without skills.</aside>\n    "
    },
    {
      id: "rule-modes",
      number: "02",
      title: "Game Modes",
      shortTitle: "Modes",
      keywords: "Standard Overdrive deck skills on off",
      content: "\n      <p>Dealing mode and skill mode are independent. Pick a deck type and whether skills are on.</p>\n      <section id=\"rule-mode-standard\" data-rule-entry data-rule-entry-title=\"Standard\">\n        <h4>Standard</h4>\n        <p>A full 52-card random deck. Heads-up No-Limit Texas Hold'em dealing, betting, rankings, and Showdown, plus OVERLIMIT Hand Rank Bonus and base economy.</p>\n      </section>\n      <section id=\"rule-mode-overdrive\" data-rule-entry data-rule-entry-title=\"Overdrive\">\n        <h4>Overdrive</h4>\n        <p>A stronger starting-deck generator that leans toward strong-hand fights, River upgrades, River come-from-behind, and high-made boards. Overdrive does not change betting, chips, rankings, Showdown, or Hand Rank Bonus. After a skill changes the deck, candidate boards are not regenerated.</p>\n      </section>\n      <section id=\"rule-mode-skills\" data-rule-entry data-rule-entry-title=\"Skills on and off\">\n        <h4>Skills on and off</h4>\n        <p><strong>Skills off:</strong> no Skill Loadout, Energy spend, or skill effects. Hand Rank Bonus still applies.</p>\n        <p><strong>Skills on:</strong> finish a Loadout before the match, then use skills, Energy, and special settlement on top of standard Hold'em.</p>\n      </section>\n    "
    },
    {
      id: "rule-blinds",
      number: "03",
      title: "Dealer, Blinds, and Action Order",
      shortTitle: "Dealer and blinds",
      keywords: "Dealer Button Small Blind Big Blind heads-up 25 50",
      content: "\n      <p>At the start of each Hand, one player is on the Button and posts the Small Blind 25. The other player posts the Big Blind 50. Blinds are standard betting contributions and enter that hand's Pot.</p>\n      <div class=\"rules-callout-grid\">\n        <div><span>Pre-Flop</span><strong>The Button / Small Blind acts first.</strong></div>\n        <div><span>Flop, Turn, River</span><strong>The Big Blind acts first. The Button acts last post-flop.</strong></div>\n      </div>\n      <p>The Button swaps after each Hand, so both players take turns as Small Blind and Big Blind.</p>\n    "
    },
    {
      id: "rule-flow",
      number: "04",
      title: "Hand Flow",
      shortTitle: "Hand flow",
      keywords: "Pre-Flop Flop Turn River Showdown Hole Cards Community Cards",
      content: "\n      <p>Each player receives 2 private Hole Cards. Up to 5 Community Cards are dealt and shared.</p>\n      <ol class=\"rules-timeline\">\n        <li><span>01</span><div><strong>Pre-Flop</strong><p>Hole Cards only. First Betting Round.</p></div></li>\n        <li><span>02</span><div><strong>Flop</strong><p>3 Community Cards. Second Betting Round.</p></div></li>\n        <li><span>03</span><div><strong>Turn</strong><p>4th Community Card. Third Betting Round.</p></div></li>\n        <li><span>04</span><div><strong>River</strong><p>5th Community Card. Fourth Betting Round.</p></div></li>\n        <li><span>05</span><div><strong>Showdown</strong><p>If nobody Folded, compare each player's best 5-card hand.</p></div></li>\n      </ol>\n      <p>A betting street ends when remaining players have acted legally and standard investment meets the current requirement. If no further betting is possible — for example one player is All-In and matched — remaining Community Cards are dealt automatically and the hand goes to Showdown.</p>\n    "
    },
    {
      id: "rule-actions",
      number: "05",
      title: "Player Actions",
      shortTitle: "Actions",
      keywords: "Check Bet Call Raise Fold All-In timeout",
      content: "\n      <p>On your turn you may only take a legal action the server offers for the current state.</p>\n      <dl class=\"rules-dl rules-action-list\">\n        <div id=\"rule-action-check\" data-rule-entry data-rule-entry-title=\"Check\"><dt>Check</dt><dd>When nothing is owed, put in no extra chips and end this action.</dd></div>\n        <div id=\"rule-action-bet\" data-rule-entry data-rule-entry-title=\"Bet\"><dt>Bet</dt><dd>Put chips in when nobody has Bet this street. The usual minimum Bet is the current Big Blind.</dd></div>\n        <div id=\"rule-action-call\" data-rule-entry data-rule-entry-title=\"Call\"><dt>Call</dt><dd>Match the opponent's current standard bet. If your remaining chips are short, pay what you can as All-In.</dd></div>\n        <div id=\"rule-action-raise\" data-rule-entry data-rule-entry-title=\"Raise\"><dt>Raise</dt><dd>Increase the current bet. The Raise increment is usually at least the last full Bet or full Raise increment this round. An All-In that does not make a full Raise does not reopen Raise rights for a player who already acted.</dd></div>\n        <div id=\"rule-action-fold\" data-rule-entry data-rule-entry-title=\"Fold\"><dt>Fold</dt><dd>Give up the hand. The opponent wins immediately. Hands are not compared.</dd></div>\n        <div id=\"rule-action-allin\" data-rule-entry data-rule-entry-title=\"All In\"><dt>All In</dt><dd>Put in the maximum chips currently allowed. Unmatched extras follow Chapter 13.</dd></div>\n      </dl>\n      <section id=\"rule-action-timeout\" data-rule-entry data-rule-entry-title=\"Action timeout\">\n        <h4>Action timeout</h4>\n        <p>Every human action turn has a server timer. On timeout, the system Checks if Check is legal; otherwise it Folds.</p>\n      </section>\n    "
    },
    {
      id: "rule-showdown",
      number: "06",
      title: "Winning a Hand and Showdown",
      shortTitle: "Showdown",
      keywords: "Fold win Showdown best five kicker Split Pot",
      content: "\n      <section id=\"rule-win-by-fold\" data-rule-entry data-rule-entry-title=\"Fold win\">\n        <h4>Fold win</h4>\n        <p>After a Fold, the opponent wins the hand immediately. Folded hands do not compare rankings and do not pay Hand Rank Bonus.</p>\n      </section>\n      <section id=\"rule-showdown-best-five\" data-rule-entry data-rule-entry-title=\"Showdown and best five\">\n        <h4>Showdown and best five</h4>\n        <p>If nobody Folded and betting is complete, the hand goes to Showdown. Each player makes the strongest 5-card hand from 2 Hole Cards and 5 Community Cards.</p>\n        <p>You may use 0, 1, or 2 Hole Cards. The stronger best five wins. If both best fives are identical, it is a Split Pot.</p>\n      </section>\n      <aside class=\"rules-note\">All suits are equal. Suits never break ties.</aside>\n    "
    },
    {
      id: "rule-hands",
      number: "07",
      title: "Poker Hand Rankings",
      shortTitle: "Hand Rankings",
      keywords: "Royal Flush Straight Flush Four of a Kind Full House Flush Straight Three of a Kind Two Pair One Pair High Card",
      content: "\n      <p>Hands rank from high to low as follows. In this game a Royal Flush is an independent rank above a normal Straight Flush.</p>\n      <div class=\"rules-hand-grid\">\n        <section id=\"hand-royal-flush\" class=\"rules-hand-item\" data-rule-entry data-rule-entry-title=\"Royal Flush\"><div class=\"rules-hand-rank\">01</div><div><h4>Royal Flush</h4><p>A, K, Q, J, 10 of the same suit.</p><div class=\"rules-card-example\" aria-label=\"A of spades K of spades Q of spades J of spades 10 of spades\"><b>A♠</b><b>K♠</b><b>Q♠</b><b>J♠</b><b>10♠</b></div></div></section>\n        <section id=\"hand-straight-flush\" class=\"rules-hand-item\" data-rule-entry data-rule-entry-title=\"Straight Flush\"><div class=\"rules-hand-rank\">02</div><div><h4>Straight Flush</h4><p>Five consecutive cards of the same suit. Compare the top card.</p><div class=\"rules-card-example\"><b>9♣</b><b>8♣</b><b>7♣</b><b>6♣</b><b>5♣</b></div></div></section>\n        <section id=\"hand-quads\" class=\"rules-hand-item\" data-rule-entry data-rule-entry-title=\"Four of a Kind\"><div class=\"rules-hand-rank\">03</div><div><h4>Four of a Kind</h4><p>Compare the four, then the kicker.</p><div class=\"rules-card-example\"><b>9♠</b><b class=\"is-red\">9♥</b><b class=\"is-red\">9♦</b><b>9♣</b><b>K♠</b></div></div></section>\n        <section id=\"hand-full-house\" class=\"rules-hand-item\" data-rule-entry data-rule-entry-title=\"Full House\"><div class=\"rules-hand-rank\">04</div><div><h4>Full House</h4><p>Three of a Kind plus One Pair. Compare the three, then the pair.</p><div class=\"rules-card-example\"><b>K♠</b><b class=\"is-red\">K♥</b><b class=\"is-red\">K♦</b><b>4♣</b><b class=\"is-red\">4♥</b></div></div></section>\n        <section id=\"hand-flush\" class=\"rules-hand-item\" data-rule-entry data-rule-entry-title=\"Flush\"><div class=\"rules-hand-rank\">05</div><div><h4>Flush</h4><p>Five of one suit that is not a Straight Flush. Compare from the highest card down.</p><div class=\"rules-card-example\"><b class=\"is-red\">A♥</b><b class=\"is-red\">J♥</b><b class=\"is-red\">8♥</b><b class=\"is-red\">5♥</b><b class=\"is-red\">2♥</b></div></div></section>\n        <section id=\"hand-straight\" class=\"rules-hand-item\" data-rule-entry data-rule-entry-title=\"Straight\"><div class=\"rules-hand-rank\">06</div><div><h4>Straight</h4><p>Five consecutive ranks, mixed suits. Compare the top card.</p><div class=\"rules-card-example\"><b>9♠</b><b class=\"is-red\">8♥</b><b class=\"is-red\">7♦</b><b>6♣</b><b>5♠</b></div></div></section>\n        <section id=\"hand-trips\" class=\"rules-hand-item\" data-rule-entry data-rule-entry-title=\"Three of a Kind\"><div class=\"rules-hand-rank\">07</div><div><h4>Three of a Kind</h4><p>Compare the three, then the two kickers.</p><div class=\"rules-card-example\"><b>7♠</b><b class=\"is-red\">7♥</b><b class=\"is-red\">7♦</b><b>A♣</b><b>10♠</b></div></div></section>\n        <section id=\"hand-two-pair\" class=\"rules-hand-item\" data-rule-entry data-rule-entry-title=\"Two Pair\"><div class=\"rules-hand-rank\">08</div><div><h4>Two Pair</h4><p>Compare the higher pair, the lower pair, then the kicker.</p><div class=\"rules-card-example\"><b>Q♠</b><b class=\"is-red\">Q♥</b><b class=\"is-red\">4♦</b><b>4♣</b><b>A♠</b></div></div></section>\n        <section id=\"hand-pair\" class=\"rules-hand-item\" data-rule-entry data-rule-entry-title=\"One Pair\"><div class=\"rules-hand-rank\">09</div><div><h4>One Pair</h4><p>Compare the pair, then the three kickers.</p><div class=\"rules-card-example\"><b>J♠</b><b class=\"is-red\">J♥</b><b>A♣</b><b class=\"is-red\">8♦</b><b>3♠</b></div></div></section>\n        <section id=\"hand-high-card\" class=\"rules-hand-item\" data-rule-entry data-rule-entry-title=\"High Card\"><div class=\"rules-hand-rank\">10</div><div><h4>High Card</h4><p>None of the hands above. Compare the best five from the top down.</p><div class=\"rules-card-example\"><b>A♠</b><b class=\"is-red\">J♦</b><b>9♣</b><b class=\"is-red\">6♥</b><b>3♠</b></div></div></section>\n      </div>\n      <aside class=\"rules-note\"><strong>Ace in straights:</strong> Ace may play in A-K-Q-J-10, or as the low card in A-2-3-4-5. It cannot wheel around as Q-K-A-2-3. Suits never rank hands.</aside>\n    "
    },
    {
      id: "rule-bonus",
      number: "08",
      title: "Hand Rank Bonus",
      shortTitle: "Hand Rank Bonus",
      keywords: "Hand Rank Bonus Showdown Fold Retreat Split Pot +25 +50 +75 +100 +250 +400 +500",
      content: "\n      <div class=\"rules-rule-tag\">Base rule shared by every mode</div>\n      <p>Paid only on a unique Showdown win, using the winner's final best five. The loser pays the winner. The bonus joins the standard settlement base before legal multipliers, so it does not increase the table chip total.</p>\n      <div class=\"rules-table-wrap\">\n        <table class=\"rules-table rules-bonus-table\">\n          <caption>Winning hand and base bonus</caption>\n          <thead><tr><th>Hand</th><th>Bonus</th><th>Hand</th><th>Bonus</th></tr></thead>\n          <tbody>\n            <tr><th scope=\"row\">High Card</th><td>+0</td><th scope=\"row\">Flush</th><td>+75</td></tr>\n            <tr><th scope=\"row\">One Pair</th><td>+0</td><th scope=\"row\">Full House</th><td>+100</td></tr>\n            <tr><th scope=\"row\">Two Pair</th><td>+0</td><th scope=\"row\">Four of a Kind</th><td>+250</td></tr>\n            <tr><th scope=\"row\">Three of a Kind</th><td>+25</td><th scope=\"row\">Straight Flush</th><td>+400</td></tr>\n            <tr><th scope=\"row\">Straight</th><td>+50</td><th scope=\"row\">Royal Flush</th><td>+500</td></tr>\n          </tbody>\n        </table>\n      </div>\n      <aside class=\"rules-note\">A normal Fold, a Retreat Fold, and a Split Pot pay no Hand Rank Bonus. If the loser cannot pay in full, actual payment cannot exceed payable chips.</aside>\n    "
    },
    {
      id: "rule-loadout",
      number: "09",
      title: "Skill Loadout",
      shortTitle: "Loadout",
      keywords: "Skill Loadout Load 1 to 4 cap 8 Protocols hidden",
      content: "\n      <p>When skills are on, finish a Loadout before the match. Once confirmed, it cannot change for that match.</p>\n      <div class=\"rules-callout-grid rules-callout-grid-three\">\n        <div><span>Skill count</span><strong>1–4</strong></div>\n        <div><span>Total Load</span><strong>at most 8</strong></div>\n        <div><span>Duplicates</span><strong>not allowed</strong></div>\n      </div>\n      <p>Protocols also occupy skill slots and Load. At match start the opponent does not learn your equipped count, total Load, or full list. Skills may be confirmed later from their own visibility and actual events.</p>\n    "
    },
    {
      id: "rule-energy",
      number: "10",
      title: "Energy and Public Energy",
      shortTitle: "Energy",
      keywords: "Energy Energy Cap public energy 4 8 Destiny 10 Fortune -4",
      content: "\n      <section id=\"rule-energy-real\" data-rule-entry data-rule-entry-title=\"True Energy\">\n        <h4>True Energy</h4>\n        <p>A normal Loadout starts at 4 Energy with cap 8. Equipping Destiny raises your true cap to 10. Fortune may take true Energy down to -4. Below 0, no new Active Skill may launch and no new Passive Skill event may fire except Fortune.</p>\n      </section>\n      <section id=\"rule-energy-recovery\" data-rule-entry data-rule-entry-title=\"Natural end-of-hand recovery\">\n        <h4>Natural end-of-hand recovery</h4>\n        <div class=\"rules-table-wrap\"><table class=\"rules-table\"><thead><tr><th>Hand result</th><th>Natural recovery</th></tr></thead><tbody><tr><th scope=\"row\">Win</th><td>+0</td></tr><tr><th scope=\"row\">Loss or normal Fold</th><td>+1</td></tr><tr><th scope=\"row\">Split Pot</th><td>+0</td></tr><tr><th scope=\"row\">Retreat Fold</th><td>+0</td></tr></tbody></table></div>\n        <p>Extra skill recovery, payment, borrowing, debt, or recovery suppression settle separately.</p>\n      </section>\n      <section id=\"rule-energy-public\" data-rule-entry data-rule-entry-title=\"Opponent public Energy\">\n        <h4>Opponent public Energy</h4>\n        <p>Opponent Energy is shown per hand and frozen during the hand: it updates after a hand finishes all resource settlement, then stays still through the next hand. Ordinary public range is 0–8; a true value below 0 shows 0, and 9 or 10 shows 8.</p>\n        <p>You always see your own true Energy. Skills such as Clairvoyance can read the opponent's true current Energy.</p>\n      </section>\n    "
    },
    {
      id: "rule-skill-general",
      number: "11",
      title: "Skill General Rules",
      shortTitle: "Skill rules",
      keywords: "Active Skill Passive Skill Public Secret Counter Top Secret Fairness",
      content: "\n      <section id=\"rule-active-skills\" data-rule-entry data-rule-entry-title=\"Active Skills\">\n        <h4>Active Skills</h4>\n        <p>An Active Skill needs a legal street and action window, plus target, use, Energy, and other conditions. After a legal launch the cost is paid, then the skill settles. Unless a skill says otherwise, Active Skills can be Countered.</p>\n      </section>\n      <section id=\"rule-passive-skills\" data-rule-entry data-rule-entry-title=\"Passive Skills\">\n        <h4>Passive Skills</h4>\n        <p>Passive Skills are judged automatically when conditions are met. A Passive that never actually fires is not a skill event.</p>\n      </section>\n      <section id=\"rule-skill-visibility\" data-rule-entry data-rule-entry-title=\"Public and Secret\">\n        <h4>Public and Secret</h4>\n        <p>A <strong>Public Skill</strong> launch and its main result are public. A <strong>Secret Skill</strong> default result is only for the launcher or holder. If a rule makes part of the effect public, the opponent may confirm that skill from it.</p>\n      </section>\n      <section id=\"rule-skill-events\" data-rule-entry data-rule-entry-title=\"Skill events and settled facts\">\n        <h4>Skill events and settled facts</h4>\n        <p>A legal, paid Active launch that enters settlement, or a Passive that actually fires, is a skill event. Information already gained, swaps or deck edits already finished, and direct chip transfers already completed are settled facts. Later state-clears do not roll them back.</p>\n      </section>\n      <section id=\"rule-counter-general\" data-rule-entry data-rule-entry-title=\"Counter general\">\n        <h4>Counter general</h4>\n        <p>Counter captures the opponent's next legal Active Skill that has already paid. Illegal requests, cancels, network retries, and unfired Passives do not consume Counter. Fairness cannot be Countered.</p>\n      </section>\n      <section id=\"rule-top-secret-general\" data-rule-entry data-rule-entry-title=\"Top Secret general\">\n        <h4>Top Secret general</h4>\n        <p>Top Secret protects the holder's private Hole Card information and direct Hole Card operations, including reads, inference, swaps, Nullification, or other direct Hole Card effects. Community Card Intel, Clairvoyance, and pure skill meta-information are not protected.</p>\n      </section>\n      <section id=\"rule-fairness-general\" data-rule-entry data-rule-entry-title=\"Fairness general\">\n        <h4>Fairness general</h4>\n        <p>Fairness clears both players' still-live persistent, planted, and pending skill states, blocks later Active and Passive events this hand, and suppresses all end-of-hand Energy recovery this hand. It does not roll back finished information, card edits, deck edits, or direct chip transfers.</p>\n      </section>\n    "
    },
    {
      id: "rule-settlement",
      number: "12",
      title: "Chips, Pot, and Settlement",
      shortTitle: "Settlement",
      keywords: "Pot standard contribution direct skill transfer multipliers Defense",
      content: "\n      <section id=\"rule-standard-contribution\" data-rule-entry data-rule-entry-title=\"Standard betting contribution\">\n        <h4>Standard betting contribution</h4>\n        <p>Blinds, Bets, Calls, Raises, and standard All-In investment are standard betting contributions. They enter the Pot and ordinary hand settlement.</p>\n      </section>\n      <section id=\"rule-direct-transfer\" data-rule-entry data-rule-entry-title=\"Direct skill chip transfers\">\n        <h4>Direct skill chip transfers</h4>\n        <p>Loan take/repay, Endgame seizure of unmatched extras, and other explicitly direct transfers are not standard Pot winnings. Unless a skill says otherwise they skip ordinary chip multipliers and Defense.</p>\n      </section>\n      <section id=\"rule-settlement-order\" data-rule-entry data-rule-entry-title=\"Standard settlement order\">\n        <h4>Standard settlement order</h4>\n        <ol class=\"rules-steps rules-numbered-steps\">\n          <li>Determine the standard Hold'em net chip transfer;</li>\n          <li>Add Hand Rank Bonus;</li>\n          <li>Add other legal base extras, such as Probe;</li>\n          <li>Apply legal skill multipliers produced by the winner;</li>\n          <li>Apply legal multipliers produced by the opponent;</li>\n          <li>Apply final standard-loss modifiers such as Defense;</li>\n          <li>Cap at the loser's actually payable chips;</li>\n          <li>Complete the final integer chip transfer.</li>\n        </ol>\n      </section>\n      <section id=\"rule-settlement-multipliers\" data-rule-entry data-rule-entry-title=\"Multipliers and Defense\">\n        <h4>Multipliers and Defense</h4>\n        <p>Blood Battle ×2, both Blood Battle ×4, Desperation win ×3, Dead End after a normal Fold ×3, a qualifying Protocol ×2. Legal multipliers stack by multiplication.</p>\n        <p>If this hand already has a chip multiplier from the winner's other own skills, that player's Protocol does not trigger. Opponent multipliers do not block a Protocol. Defense is applied after base, extras, and multipliers, and halves the final standard net loss, rounding down.</p>\n      </section>\n      <aside class=\"rules-note\">Official chip state is always an integer. The smallest unit is 1. No final transfer may take a payer below 0.</aside>\n    "
    },
    {
      id: "rule-allin",
      number: "13",
      title: "All-In and Unmatched Investment",
      shortTitle: "All-In",
      keywords: "All-In unmatched side pot Endgame",
      content: "\n      <p>All-In means putting in the maximum chips currently allowed. After All-In, if neither player has a later legal betting action, remaining Community Cards are dealt and the hand goes to Showdown.</p>\n      <section id=\"rule-unmatched-bet\" data-rule-entry data-rule-entry-title=\"Unmatched investment\">\n        <h4>Unmatched investment</h4>\n        <p>In heads-up, only standard investment both players can match is contested. Extra unmatched standard investment above what the opponent can match is returned before Showdown.</p>\n      </section>\n      <section id=\"rule-no-side-pots\" data-rule-entry data-rule-entry-title=\"Heads-up Pot\">\n        <h4>Heads-up Pot</h4>\n        <p>OVERLIMIT: HOLD'EM does not use multi-way side pots. Endgame can explicitly change how unmatched opponent extras are handled; see core skills and key interactions.</p>\n      </section>\n    "
    },
    {
      id: "rule-skills",
      number: "14",
      title: "Core Skills",
      shortTitle: "Core skills",
      keywords: "24 core skills Deep Breath Endgame Loan Nullification Fortune Perception",
      content: "",
      kind: "skills"
    },
    {
      id: "rule-protocols",
      number: "15",
      title: "Protocols",
      shortTitle: "Protocols",
      keywords: "9 Protocols High Card One Pair Two Pair Three of a Kind Straight Flush Full House Four of a Kind Straight Flush Royal Flush",
      content: "",
      kind: "protocols"
    },
    {
      id: "rule-interactions",
      number: "16",
      title: "Key Interaction Rulings",
      shortTitle: "Interactions",
      keywords: "Fairness Counter Loan Retreat Disguise Endgame Nullification Clairvoyance Alert Dead End Probe Intimidation Top Secret Destiny Cheat",
      content: "\n      <p>The table below records first-wave rulings that are easy to misread. Settled facts and still-live states must be kept distinct.</p>\n      <div class=\"rules-table-wrap\">\n        <table class=\"rules-table rules-interaction-table\">\n          <thead><tr><th>Interaction</th><th>Ruling</th></tr></thead>\n          <tbody>\n            <tr id=\"interaction-fair-counter\" data-rule-entry data-rule-entry-title=\"Fairness × Counter\"><th scope=\"row\">Fairness × Counter</th><td>Fairness cannot be Countered.</td></tr>\n            <tr id=\"interaction-fair-loan\" data-rule-entry data-rule-entry-title=\"Fairness × Loan\"><th scope=\"row\">Fairness × Loan</th><td>Clears unpaid state without refunding resources already taken. If debt is actually cleared, credit enters or stays restricted. Default only rises to restricted, not straight back to normal.</td></tr>\n            <tr id=\"interaction-fair-retreat\" data-rule-entry data-rule-entry-title=\"Fairness × Retreat\"><th scope=\"row\">Fairness × Retreat</th><td>Clears Retreat. The 3 Energy already paid is not refunded. A new Retreat cannot launch after Fairness.</td></tr>\n            <tr id=\"interaction-fair-disguise\" data-rule-entry data-rule-entry-title=\"Fairness × Disguise\"><th scope=\"row\">Fairness × Disguise</th><td>Clears Disguise. Later displays restore. Historical hidden numbers are not backfilled.</td></tr>\n            <tr id=\"interaction-fair-endgame\" data-rule-entry data-rule-entry-title=\"Fairness × Endgame\"><th scope=\"row\">Fairness × Endgame</th><td>Endgame cannot launch after Fairness succeeds. After Endgame closes betting there is no ordinary Fairness window. A completed Endgame seize is not rolled back.</td></tr>\n            <tr id=\"interaction-fair-nullification\" data-rule-entry data-rule-entry-title=\"Fairness × Nullification\"><th scope=\"row\">Fairness × Nullification</th><td>Nullification is a persistent state and can be cleared by Fairness.</td></tr>\n            <tr id=\"interaction-disguise-clairvoyance\" data-rule-entry data-rule-entry-title=\"Disguise × Clairvoyance\"><th scope=\"row\">Disguise × Clairvoyance</th><td>Clairvoyance can learn that Disguise happened, but cannot read chip, Pot, or bet numbers.</td></tr>\n            <tr id=\"interaction-disguise-alert\" data-rule-entry data-rule-entry-title=\"Disguise × Alert\"><th scope=\"row\">Disguise × Alert</th><td>Disguise is a public Active Skill and does not trigger Alert.</td></tr>\n            <tr id=\"interaction-disguise-loan\" data-rule-entry data-rule-entry-title=\"Disguise × Loan\"><th scope=\"row\">Disguise × Loan</th><td>A Chip Loan still publicly announces the launch, without publishing take, debt, or knockout numbers.</td></tr>\n            <tr id=\"interaction-disguise-deadend\" data-rule-entry data-rule-entry-title=\"Disguise × Dead End\"><th scope=\"row\">Disguise × Dead End</th><td>Dead End All-In is always forced public.</td></tr>\n            <tr id=\"interaction-retreat-deadend\" data-rule-entry data-rule-entry-title=\"Retreat × Dead End\"><th scope=\"row\">Retreat × Dead End</th><td>Retreat then Dead End still allows a Retreat Fold in a legal window. Dead End first blocks a new Retreat. A Retreat Fold makes standard net 0, so Dead End's 0 × 3 stays 0.</td></tr>\n            <tr id=\"interaction-retreat-probe\" data-rule-entry data-rule-entry-title=\"Retreat × Probe\"><th scope=\"row\">Retreat × Probe</th><td>A Retreat Fold is not a normal Fold and does not trigger Probe.</td></tr>\n            <tr id=\"interaction-retreat-intimidation\" data-rule-entry data-rule-entry-title=\"Retreat × Intimidation\"><th scope=\"row\">Retreat × Intimidation</th><td>Intimidation forbids Fold, so a Retreat Fold cannot complete.</td></tr>\n            <tr id=\"interaction-retreat-endgame\" data-rule-entry data-rule-entry-title=\"Retreat × Endgame\"><th scope=\"row\">Retreat × Endgame</th><td>After Endgame closes betting there is no Fold window. An existing Retreat need not be deleted, but it cannot be used.</td></tr>\n            <tr id=\"interaction-endgame-counter\" data-rule-entry data-rule-entry-title=\"Endgame × Counter\"><th scope=\"row\">Endgame × Counter</th><td>Endgame pays 8 Energy first, then Counter is resolved. If Counter hits: no seize, no betting lock, no execution.</td></tr>\n            <tr id=\"interaction-endgame-multiplier\" data-rule-entry data-rule-entry-title=\"Endgame × multipliers\"><th scope=\"row\">Endgame × multipliers</th><td>Endgame's direct seize does not take Blood Battle, Desperation, or Protocol multipliers.</td></tr>\n            <tr id=\"interaction-endgame-protocol\" data-rule-entry data-rule-entry-title=\"Endgame × Protocol\"><th scope=\"row\">Endgame × Protocol</th><td>After Endgame names the winner, Protocols still judge independently from the winner's final hand and Protocol conditions.</td></tr>\n            <tr id=\"interaction-nullification-future\" data-rule-entry data-rule-entry-title=\"Nullification × future Community Cards\"><th scope=\"row\">Nullification × future Community Cards</th><td>Nullification locks a Community Card seat. Even if Destiny or Cheat later changes that seat's rank/suit, it stays invalid.</td></tr>\n            <tr id=\"interaction-secret-intel\" data-rule-entry data-rule-entry-title=\"Top Secret × Intel\"><th scope=\"row\">Top Secret × Intel</th><td>Blocks only the opponent Hole Card branch, not future Community Card looks.</td></tr>\n            <tr id=\"interaction-secret-nullification\" data-rule-entry data-rule-entry-title=\"Top Secret × Nullification\"><th scope=\"row\">Top Secret × Nullification</th><td>Protects Hole Card Nullification only, not Community Card seats.</td></tr>\n          </tbody>\n        </table>\n      </div>\n    "
    },
    {
      id: "rule-match-end",
      number: "17",
      title: "Split Pots, Match End, and Debt Expiry",
      shortTitle: "Match end",
      keywords: "Split Pot odd chip Big Blind game over Loan debt",
      content: "\n      <section id=\"rule-tie\" data-rule-entry data-rule-entry-title=\"Split Pot\">\n        <h4>Split Pot</h4>\n        <p>If both final best fives are identical at Showdown, the hand is a Split Pot. Neither player gets Hand Rank Bonus, ordinary win multipliers, or the ordinary loser +1 Energy.</p>\n        <p>Contested chips split evenly. If the Pot is odd, the leftover 1 chip goes to that hand's Big Blind.</p>\n      </section>\n      <section id=\"rule-game-over\" data-rule-entry data-rule-entry-title=\"Match end\">\n        <h4>Match end</h4>\n        <p>The system finishes the current hand's settlement and chip update first, then checks true stacks. When either stack is 0, the other player wins the match.</p>\n      </section>\n      <section id=\"rule-debt-expiry\" data-rule-entry data-rule-entry-title=\"Loan debt expiry\">\n        <h4>Loan debt expiry</h4>\n        <p>If the match is already over after the current hand settles, unfinished Loans, leftover chip debt, leftover Energy debt, and Loan credit clear immediately. There is no post-match repayment, and post-match debt cannot reverse an already decided result.</p>\n        <p>If the match is still live, due repayment follows Loan rules. Repayment can zero a payer and end the match.</p>\n      </section>\n    "
    },
    {
      id: "rule-priority",
      number: "18",
      title: "Rule Priority and System Rulings",
      shortTitle: "Priority",
      keywords: "priority special state skill Overlimit No-Limit Texas Hold'em server",
      content: "\n      <p>Standard No-Limit Texas Hold'em is the base. When this game's modes, skills, or special states explicitly change that base, the more specific rule wins.</p>\n      <ol class=\"rules-priority-stack\">\n        <li><span>01</span><strong>Explicit special states or exception rules</strong></li>\n        <li><span>02</span><strong>Specific skill rules</strong></li>\n        <li><span>03</span><strong>OVERLIMIT: HOLD'EM base rules</strong></li>\n        <li><span>04</span><strong>Standard No-Limit Texas Hold'em</strong></li>\n      </ol>\n      <p>Players may only take actions or skills the system currently treats as legal. Chips, deck, Energy, skill state, action legality, and final settlement follow the server.</p>\n    "
    }
  ],
  skills: [
    {
      id: "skill-deep-breath",
      number: "01",
      name: "Deep Breath",
      english: "Deep Breath",
      meta: [
        "Load 1",
        "Energy 1",
        "Active · Secret",
        "per hand once · your betting turn"
      ],
      keywords: "恢复 2 败者 +1 公平 反制",
      content: "<p>Active / Secret. Load 1, cost 1, at most once per hand, only on your legal betting action turn, Pre-Flop through River. Pay 1 Energy on use; if no further skill events of your own occur until the hand ends, recover 2 Energy. There is no current-Energy ceiling requirement beyond the actual Energy Cap. A normal Fold does not cancel the refund; if Deep Breath is followed by no other skill events and you Fold: recover 2, then also gain the losing-hand natural +1. Can be Countered; a cost-1 failed skill refunds 0 after Recycle rounding. Fairness clears the pending refund and suppresses all end-of-hand Energy recovery this hand.</p>"
    },
    {
      id: "skill-recycle",
      number: "02",
      name: "Recycle",
      english: "Recycle",
      meta: [
        "Load 2",
        "Energy 0",
        "Passive · settlement public",
        "settles at most once per hand"
      ],
      keywords: "失败技能 返还 50% 向下取整 反制 绝密",
      content: "<p>Passive. Load 2, cost 0, settles at most once per hand. At hand end, among skills that passed legality, actually paid Energy, and finally failed, take the highest original Energy cost and refund floor(original cost × 50%). Counts: Countered, blocked by Top Secret, hidden target actually missing, or target left a legal zone. Does not count: illegal rejects before payment, player cancel, network retry, client duplicate request, or a Counter that was placed but never triggered. Does not refund mid-hand.</p>"
    },
    {
      id: "skill-intimidation",
      number: "03",
      name: "Intimidation",
      english: "Intimidation",
      meta: [
        "Load 3",
        "Energy 4",
        "Active · Public",
        "per hand once · your betting turn"
      ],
      keywords: "禁止弃牌 500 上限 跟注路径 全下 撤退 绝路",
      content: "<p>Active / Public. Load 3, cost 4, at most once per hand, on any of your legal betting action turns. Prerequisite: both players' current cumulative standard betting investment must be ≤ 500. After success until the hand ends: both players cannot Fold; each player's cumulative standard investment is capped at 500; Bet/Raise must leave the opponent a legal Call. ALL IN may still be clicked, but standard investment only rises to a cumulative 500, still recorded as a legal ALL IN action (allInAction=true; stackCommitted=false if chips remain) so ALL IN-dependent skills can trigger. The 500 cap only limits standard betting investment, not extra chip transfers from skill multipliers.</p>"
    },
    {
      id: "skill-desperation",
      number: "04",
      name: "Desperation",
      english: "Desperation",
      meta: [
        "Load 2",
        "Energy 0",
        "Passive · public when conditions met",
        "checked at hand start"
      ],
      keywords: "200 筹码 标准净收益 x3 ×3 恢复1 平局 公平",
      content: "<p>Passive. Load 2, cost 0. At the start of each hand, check the start-of-hand chip snapshot: if your chips &lt;= 200, this hand automatically enters Desperation. Do not trigger from current chips, ALL IN, or being behind mid-hand. If you uniquely win: standard net chip winnings ×3, plus recover 1 Energy. A split pot does not trigger the multiplier.</p>"
    },
    {
      id: "skill-blood-battle",
      number: "05",
      name: "Blood Battle",
      english: "Blood Battle",
      meta: [
        "Load 2",
        "Energy 3",
        "Active · Public",
        "per hand once · your betting turn"
      ],
      keywords: "输赢翻倍 x2 ×2 双方 x4 ×4 平局 公平",
      content: "<p>Active / Public. Load 2, cost 3, at most once per hand, on any legal betting street. Final standard net chip transfer this hand ×2. If both players launch it, ×2 ×2 = ×4, not a cancel. May multiply with legal multipliers other than Protocol, including Desperation and Dead End. Split pots are not multiplied. Final payment still cannot exceed the loser's actually payable chips.</p>"
    },
    {
      id: "skill-defense",
      number: "06",
      name: "Defense",
      english: "Defense",
      meta: [
        "Load 3",
        "Energy 3",
        "Active · Secret",
        "per hand once · your betting turn"
      ],
      keywords: "损失减半 向下取整 弃牌 直接转移",
      content: "<p>Active / Secret. Load 3, cost 3, at most once per hand, on any of your legal betting action turns from Pre-Flop through River. If you uniquely lose the hand and did not Fold, final net chip loss is halved; it covers the whole-hand final loss regardless of the street of use. Win, split, or a voluntary Fold yields nothing; the 3 Energy already paid is not refunded. The launch itself is secret; if settlement actually halves a public loss, Defense can then be naturally confirmed.</p>"
    },
    {
      id: "skill-perception",
      number: "07",
      name: "Perception",
      english: "Perception",
      meta: [
        "Load 3",
        "Energy 0",
        "Passive · fully Secret",
        "4 nodes · at most 3 successes per hand"
      ],
      keywords: "25% 50% 75%真实 25%错误 底牌 翻牌 转牌 河牌 绝密 灵视",
      content: "<p>Passive / fully Secret / Intel. Load 3, cost 0. Check nodes: after Hole Cards, Flop, Turn, River — four independent checks, at most 3 successes per hand. Trigger chance scales with your chip disadvantage between 25% and 50% (FROZEN_V1: spec-25-50). Each success first picks an information category by fixed weights, then 75% true / 25% false, then generates a proposition in that category that satisfies the truth requirement. False information must be chosen from propositions that are actually false in the current true state, never logically impossible or already disprovable by the observer. The same hand avoids identical, equivalent, or directly contradictory propositions. The trigger, content, and truth value are all hidden from the opponent. Clairvoyance can only learn that a Perception event occurred this hand, not the content or truth. Top Secret can block Perception from accessing protected Hole Card information.</p>"
    },
    {
      id: "skill-intel",
      number: "08",
      name: "Intel",
      english: "Intel",
      meta: [
        "Load 3",
        "Energy 4",
        "Active · Secret",
        "per hand once · your betting turn"
      ],
      keywords: "对手底牌 随机 未来公共牌 Flop Turn River 100%真实 绝密",
      content: "<p>Active / Secret. Load 3, cost 4, at most once per hand. You must choose a mode before paying. Mode A: the system randomly shows exactly one opponent Hole Card, 100% true, not a left/right choice by the player. Mode B: choose any undealt Community Card seat (including looking at the future River before the Flop) and receive that seat's currently scheduled true card, 100% true. Mode and target must be locked before payment. If the Hole Card mode is blocked by Top Secret the skill fails and cannot be switched to a Community Card look. Future Community Card looks are not affected by Top Secret.</p>"
    },
    {
      id: "skill-top-secret",
      number: "09",
      name: "Top Secret",
      english: "Top Secret",
      meta: [
        "Load 3",
        "Energy 3",
        "Passive · Secret",
        "auto-starts at most once per hand"
      ],
      keywords: "底牌保护 读取 推断 交换 零化 情报 千术 感知",
      content: "<p>Passive / Secret / information Defense. Load 3, cost 3, auto-starts at most once per hand. When an enemy skill first tries to read, infer, swap, Nullify, or directly operate on your private Hole Card information, if current Energy &gt;= 3, automatically pay 3 Energy, stop that enemy skill, then keep protecting your private Hole Card information for the rest of the hand without paying 3 again. Insufficient Energy means it does not fire and cannot overdraft. Blocks: Perception Hole Card information, Intel Hole Card mode, Cheat opponent Hole Card mode, Nullification Hole Card mode, and future skills of the same kind. Does not block: Community Card Intel, Clairvoyance, or pure skill meta-information. The first time it actually blocks, the opponent confirms Top Secret exists.</p>"
    },
    {
      id: "skill-counter",
      number: "10",
      name: "Counter",
      english: "Counter",
      meta: [
        "Load 4",
        "Energy 4",
        "Active · Secret",
        "per hand once · planted Pre-Flop only"
      ],
      keywords: "陷阱 下一次主动技能 失败 锁技能 空放返1 公平",
      content: "<p>Active / Secret / control. Load 4, cost 4, may only be secretly placed Pre-Flop on your legal action turn, at most once per hand. It then captures the opponent's next legal Active Skill: legality passes, Energy is paid normally, Counter fires, that skill fails; then the opponent cannot launch Active Skills or produce new Passive Skill events for the rest of this hand. Completed effects are not rolled back. A Passive Skill itself is not \"the next Active Skill\" that trips Counter. Counter can Counter an opposing Counter being placed. Illegal skill requests cannot consume Counter. Fairness cannot be Countered. If it never triggers, refund 1 Energy at hand end (net empty-set cost 3). The core meaning is stopping the target skill at the trigger instant; it is not weakened against Destiny or similar skills.</p>"
    },
    {
      id: "skill-fairness",
      number: "11",
      name: "Fairness",
      english: "Fairness",
      meta: [
        "Load 4",
        "Energy 3",
        "Active · Public",
        "per hand once · your betting turn"
      ],
      keywords: "不能被反制 清除状态 封锁技能 抑制恢复 既定事实 贷款信用",
      content: "<p>Active / Public / global control. Load 4, cost 3, at most once per hand, on any of your legal betting action turns; it does not have to be the first skill this hand. Cannot be stopped by Counter. On success, immediately clear both players' current persistent, planted, pending, and unfinished skill states (including Blood Battle, Defense, Intimidation, Top Secret protection, pending Desperation, Counter traps, pending Deep Breath refunds, Nullification, unpaid Loan debt, Retreat, untriggered Probe, and Disguise); for the rest of this hand neither player may launch Active Skills or produce new Passive Skill events; all end-of-hand Energy recovery this hand is cancelled, including the loser natural +1, Deep Breath refund, Desperation refund, Fortune resource refund, and other skill end-of-hand refunds. Fairness is not a time rewind: it cannot restore already swapped cards, already changed decks, already seen information, already moved chips, or already completed Endgame direct chip transfers. Nullification is a persistent settlement state, so Fairness can cancel it. After Fairness succeeds, Endgame cannot be launched this hand. Fairness can still clear Loan pending repayment and residual debt, but does not roll back chips or Energy already obtained. If it actually clears any Loan debt amount greater than 0, that player's Loan credit is settled by the official Loan rules: normal credit becomes restricted; already restricted stays restricted; defaulted leaves full lockout and becomes restricted, not restored to normal. If no Loan debt exists at launch, credit status must not change.</p>"
    },
    {
      id: "skill-cheat",
      number: "12",
      name: "Cheat",
      english: "Cheat",
      meta: [
        "Load 5",
        "Energy 6",
        "Active · mixed visibility",
        "per hand once · your betting turn"
      ],
      keywords: "交换 自己底牌 对手底牌 公共牌 未来牌 下一张 牌堆 随机 52张唯一",
      content: "<p>Active. Load 5, cost 6, at most once per hand, legal from Pre-Flop through River (including after the River is fully public). Choose one of your Hole Cards and swap it with one of: 1) a specified opponent Hole Card seat (unknown rank/suit, protected by Top Secret); 2) any already public Community Card (including after the River is out) — changing a public Community Card naturally reveals Cheat; 3) any undealt future Community Card seat; 4) the deck top / next live deal card; 5) a uniformly random remaining undealt card that is not the top and not the next live deal card, with your old Hole Card returned to that exact original slot. Must keep 52 unique cards. A completed swap is a settled fact; Fairness cannot roll it back.</p>"
    },
    {
      id: "skill-dead-end",
      number: "13",
      name: "Dead End",
      english: "Dead End",
      meta: [
        "Load 4",
        "Energy 5",
        "Active · Public",
        "per hand once · your betting turn"
      ],
      keywords: "最大合法全下 ALL IN 锁技能 普通弃牌 x3 ×3 摊牌 恐吓 伪装",
      content: "<p>Active / Public / ALL IN. Load 4, cost 5, at most once per hand, on any legal betting street. On success, automatically execute the maximum currently legal ALL IN, then the opponent cannot launch Active Skills or produce new Passive Skill events this hand, without cancelling already completed facts. If the opponent later Folds: the Dead End player's standard net winnings ×3. If the opponent Calls and the hand goes to Showdown, Dead End itself does not provide ×3 even if that player wins. Still legal under Intimidation; the ALL IN investment may only reach a cumulative 500 but must still be recorded as an ALL IN. Because Intimidation forbids Fold, Dead End's Fold ×3 branch cannot occur in that case.</p>"
    },
    {
      id: "skill-clairvoyance",
      number: "14",
      name: "Clairvoyance",
      english: "Clairvoyance",
      meta: [
        "Load 3",
        "Energy 2",
        "Active · Secret",
        "per hand once · your betting turn"
      ],
      keywords: "真实能量 已发生技能事件 负能量 天命 伪装 绝密 反制",
      content: "<p>Active / Secret / meta-intel. Load 3, cost 2, at most once per hand. Privately reads: 1) the opponent's current true Energy, not the frozen public display; 2) skill events the opponent has already completed this hand, including originally secret skills, but not Perception content/truth, which card Intel saw, what hidden cards Cheat swapped, which card Destiny named, what private cards Fortune made, Loan Energy details, or cards Restart drew, nor an unrevealed full Loadout, nor chip amounts through Disguise. The opponent does not know a successful launch. Not blocked by Top Secret. As an Active Skill it can be Countered.</p>"
    },
    {
      id: "skill-nullification",
      number: "15",
      name: "Nullification",
      english: "Nullification",
      meta: [
        "Load 5",
        "Community Card 6 / Hole Card 7",
        "Active · fully Secret",
        "per hand once · Flop and later"
      ],
      keywords: "未来公共牌位置 已公开 公共牌不存在 随机底牌 最佳五张 绝密 公平",
      content: "<p>Active / fully Secret. Load 5, at most once per hand, on Flop / Turn / River. Mode A Community Card Nullification costs 6: precisely choose a public or still-undealt Community Card seat; that card is treated as missing for both players' final hand ranking; still legal after all five River cards are public. Mode B Hole Card Nullification costs 7: the system randomly chooses one of the opponent's two Hole Cards so it does not participate in their best five; can be blocked by Top Secret. Launch, mode, and target stay secret until final settlement. Both players may Nullify the same Community Card seat: both skills succeed and pay, that Community Card is invalidated only once, and the other's target is not leaked along the way. Nullification is a persistent state, so Fairness can clear it.</p>"
    },
    {
      id: "skill-fortune",
      number: "16",
      name: "Fortune",
      english: "Fortune",
      meta: [
        "Load 5",
        "Board rewrite 3",
        "Passive · fully Secret",
        "Hole Card / Flop / Turn / River / end-of-hand resource"
      ],
      keywords: "自动改牌 资源 +1 能量 最低-4 负能量 公共牌 不读对手底牌",
      content: "<p>Passive / fully Secret / luck system. Load 5. Card-rewrite Fortune costs 3 Energy. It auto-checks at several predefined luck nodes; chance is affected by both chip disadvantage and current Energy. Current recommended soft-v1, status FROZEN_V1 (2026-08-20). If Hole Cards are already strong enough, hole-improving Fortune does not fire; if they are weak it may auto-improve. The player cannot choose whether it triggers, which card, or the replacement. You see original → Fortune → new card; the opponent does not know. Only an actual card change pays. Community Card Fortune may only judge what is better for you from your Hole Cards, current Community Cards, and your own state — it must not read the opponent's Hole Cards. Resource Fortune, if it succeeds at hand end, recovers 1 extra Energy, costs no Energy, and cannot recursively trigger another Fortune. Fortune may take Energy down to -4; a paid Fortune that would go below -4 cannot occur. While Energy is negative, no other skill may be launched or auto-trigger a new Passive Skill event except Fortune; completed old effects are not rolled back.</p>"
    },
    {
      id: "skill-destiny",
      number: "17",
      name: "Destiny",
      english: "Destiny",
      meta: [
        "Load 5",
        "Energy 7",
        "Active · fully Secret",
        "after Turn · your betting turn · no fixed per-hand cap"
      ],
      keywords: "点名 精确牌 河牌 River 牌堆 上限10 初始4 反制 公平",
      content: "<p>Active / fully Secret / deck control. Load 5, cost 7. Only legal on the betting street after the Turn is public, on your legal action turn. You choose a specific real poker card; if it is still in the legal operable deck, it is moved immediately to the future River's live deal seat (if a burn exists, it must be the next card that will actually be dealt as the River). This is an immediately completed real deck edit, not a persistent effect, so Fairness cannot roll it back; later deck operations may still change the deck again. If the target is already in the opponent's Hole Cards, a burn, or otherwise out of the controllable deck, 7 Energy is still paid and Destiny fails. Counter can stop Destiny at 100% as normal. The opponent may still Fold normally even after Destiny has named the River; 7 Energy is not refunded. Equipping Destiny raises your personal Energy Cap 8→10; starting Energy is still 4. This is a Loadout attribute; Fairness cannot return the cap from 10 to 8. The opponent's ordinary UI does not directly show the 10 cap.</p>"
    },
    {
      id: "skill-loan",
      number: "18",
      name: "Loan",
      english: "Loan",
      meta: [
        "Load 2",
        "Energy 2",
        "Active · mixed visibility",
        "your betting turn · uses decided by credit"
      ],
      keywords: "筹码贷款 100 150 能量贷款 +5 偿还6 正常信用 信用受限 违约 公平 反制",
      content: "<p>Active / Resource. Load 2, cost 2. The branch must be locked before payment. Chip Loans and Energy Loans may exist together. On normal credit in one hand: at most 2 Chip Loans, at most 1 Energy Loan, 3 total. Loan has three credit states. NORMAL_CREDIT: uses those normal quotas. RESTRICTED_CREDIT: all Loan modes combined may fire at most once that hand; no Energy+Chip or Chip+Chip. DEFAULTED: while any unreal-repaid residual debt exists, the entire Loan skill cannot fire. Any failed repayment that leaves chip or Energy debt enters default and bans all Loans, without distinguishing debt type. Chip Loan is Public: each time immediately take 100 chips from the opponent, repay 150 at the next hand's end; a second Chip Loan in the same hand takes another 100 and owes another 150, repaid on their own due dates. If the opponent currently has ≤100 chips, take all remaining chips and complete a Loan knockout; if repayment zeros yourself, it can likewise knock you out. Energy Loan is Secret: after paying 2, immediately gain 5 Energy without exceeding your personal cap, then repay 6 at the next hand's end; if short, first drain current Energy and the remainder becomes Energy debt, after which any Energy income pays the debt first. Only a real deduction from the player's chips or Energy counts as repayment. Fairness, match-end expiry, debug reset, state overwrite, or other waivers do not count as real repayment. Fairness may still clear unfulfilled or unpaid Loan debt without rolling back chips or Energy already obtained; if that clears any pending or residual debt amount greater than 0, it is a waiver without real repayment: normal credit becomes restricted; already restricted stays restricted; defaulted leaves default but becomes restricted rather than normal. After restricted credit, you must complete at least one Loan that was newly created while restricted, came due normally, was paid entirely with real resources, had no portion waived, and ended with residual 0, to restore normal credit. After default, if residual is fully repaid for real, restore normal credit; if Fairness clears it, only rise to restricted. If Counter catches Loan: the cost is paid, no resource is gained, no repayment or residual is created, and credit does not change. When a match legally ends, unfinished repayment, residual, and credit are all cleared; the next match starts on normal credit. While Disguise is active, a public Loan only announces the launch, with no chip or debt numbers.</p>"
    },
    {
      id: "skill-alert",
      number: "19",
      name: "Alert",
      english: "Alert",
      meta: [
        "Load 1",
        "Energy 0",
        "Passive · fully Secret",
        "at most one successful hint per hand"
      ],
      keywords: "秘密主动技能 10 25 40 55 70 85 100 敏锐度 下一次行动 伪装",
      content: "<p>Passive / fully Secret / Intel. Load 1, cost 0. Only listens to enemy legal, formally submitted Active Skill events that are still hidden from you; public Active Skills, Passive Skills, illegal requests, cancels, and network retries do not trigger. Chance ladder: 10%→25%→40%→55%→70%→85%→100%. A miss raises one step; a hit resets to 10%. Sensitivity persists across hands; the current chance is not shown. A success is not shown at the skill instant, but at the start of your next legal betting decision: “You vaguely sense the opponent made a secret play.” It reveals no name, type, count, cost, result, or exact time. At most one successful hint per hand.</p>"
    },
    {
      id: "skill-retreat",
      number: "20",
      name: "Retreat",
      english: "Retreat",
      meta: [
        "Load 2",
        "Energy 3",
        "Active · Secret",
        "per hand once · your betting turn"
      ],
      keywords: "同一窗口 立即弃牌 Fold 退还贡献 标准净0 败者不回能量 恐吓 试探 绝路",
      content: "<p>Active / Secret / Defense. Load 2, cost 3, at most once per hand, only on your legal betting action turn. After success, you may Fold immediately in the same betting decision window, or keep the state for a later legal Fold window this hand; no prior-street or minimum delay is required. A Retreat Fold only returns both players' standard betting contributions this hand (blinds, Calls, Raises, and standard ALL IN contributions). Standard net chip transfer is 0, and you do not gain the ordinary loser +1. It does not roll back Loan / Endgame direct skill chip transfers, paid Energy, seen information, or completed swaps. If Countered: 3 Energy is paid, the state is not established, you do not auto-Fold, and you stay in the original betting decision window. Dead End does not clear an existing Retreat, so Retreat then Dead End still allows a Retreat Fold; standard net is then 0, and Dead End's 0 × 3 is still 0. If Dead End is first, a new Retreat cannot be launched. Fairness clears Retreat without refunding 3 Energy. Intimidation forbids Fold, so even an existing state cannot trigger. After Endgame closes betting, Retreat may still exist but has no legal Fold window. A Retreat Fold does not trigger Probe.</p>"
    },
    {
      id: "skill-restart",
      number: "21",
      name: "Restart",
      english: "Restart",
      meta: [
        "Load 4",
        "Energy 3",
        "Active · Secret",
        "per hand once · your betting turn"
      ],
      keywords: "两张底牌 洗回牌堆 随机重抽 可抽回原牌 52张唯一 公平",
      content: "<p>Active / Secret / board rewrite. Load 4, cost 3, at most once per hand, any street including after the River. Shuffle both of your Hole Cards back into the legal remaining deck, then randomly draw two new Hole Cards; both must be redrawn together. The originals enter the random pool first, so the new two may extremely rarely match the originals exactly; there is no “at least different cards” protection. The completed Hole Card change is a settled fact; Fairness cannot roll it back. Must keep 52 unique cards.</p>"
    },
    {
      id: "skill-probe",
      number: "22",
      name: "Probe",
      english: "Probe",
      meta: [
        "Load 1",
        "Energy 2",
        "Active · Secret",
        "per hand once · your betting turn"
      ],
      keywords: "对手普通弃牌 基础收益 +50 倍率 撤退 公平",
      content: "<p>Active / Secret / mind game. Load 1, cost 2, at most once per hand. On use, establish a Probe state for this hand. If the opponent later voluntarily chooses a normal Fold this hand: this hand's base standard net winnings increase by 50. That 50 is not a separate prize; it must join the base standard winnings before multipliers, e.g. base 100, Probe success plus Blood Battle = (100+50)×2=300. Your own Fold does not trigger your Probe. Skill exits such as Retreat are not treated as a normal Fold. An untriggered Probe state can be cleared by Fairness.</p>"
    },
    {
      id: "skill-disguise",
      number: "23",
      name: "Disguise",
      english: "Disguise",
      meta: [
        "Load 4",
        "Energy 2",
        "Active · Public",
        "per hand once · your betting turn"
      ],
      keywords: "隐藏筹码 底池 下注 跟注 加注 最小加注 全下 超额输入 灵视 警觉 公平",
      content: "<p>Active / Public / chip-information control. Load 4, cost 2, at most once per hand. Every chip-inferable number must be cut from the affected player's view model, including both remaining stacks, this-hand investment, Pot, Bet/Call/Raise amounts, minimum raise, chips to call, and any “short by XXX” hint — CSS hiding alone is not enough. When only one side launches it, the launcher's view stays normal; the affected player's Call button must not show an amount, and Raise must not show a minimum-raise number. Over-input is auto-capped to the true maximum legal investment as a legal ALL IN, without returning a shortfall number. Players always know whether they actually went ALL IN; a normal ALL IN is shown to the opponent only as the ordinary matching action. If both launch it, a dark-chip state begins; each still knows their own ALL IN. Dead End ALL IN is forcibly public. Clairvoyance cannot pierce chip numbers. A public skill does not trigger Alert. After Fairness clears it, future views restore, without backfilling historical numeric logs from hidden moments.</p>"
    },
    {
      id: "skill-endgame",
      number: "24",
      name: "Endgame",
      english: "Endgame",
      meta: [
        "Load 6",
        "Energy 8",
        "Active · Public",
        "per hand once · legal betting or exclusive response window"
      ],
      keywords: "全下 跟注后筹码归零 未匹配 没收 锁池 处决 同牌型 皇家同花顺 反制 倍率",
      content: "<p>Active / Public / super skill. Load 6, cost 8, the first unique 6-Load skill, at most once per hand. May be launched publicly in your legal betting window, including facing a Bet, Raise, or ordinary ALL IN, and in the exclusive response window after the opponent Calls to 0. That exclusive window is given only to the attacker who just caused Call-to-zero, not by seat order; both players cannot hold it at once. The window must offer a clear launch / skip choice; timeout is a skip. Bots must decide from their visible hand strength and must not auto-fire blindly. Settlement order must be: legality → pay 8 → resolve Counter → public success → compute matched/unmatched → seize only the opponent's unmatched standard contribution (direct skill chip transfer, no multipliers) → record execution eligibility from whether remaining chips were already 0 before launch → deal remaining Community Cards → Showdown. The launcher's own unmatched extra bets are returned by ordinary Hold'em rules and must not enter the seize pool. If Counter hits, 8 Energy is paid and the skill fails: no seize, no betting lock, no execution. Execution only checks whether the opponent's remaining chips==0 from a real standard ALL IN or Call-to-zero. Execution compares official hand-rank levels: Royal Flush 10 outranks Straight Flush 9; different levels compare normally; only when both hand-rank levels are identical does the launcher win outright. The exclusive kill presentation fires only when execution overrode the ordinary internal hand-strength compare (endgameExecutionOverride). Cannot launch after Fairness has taken effect; a completed direct seize cannot be rolled back by Fairness.</p>"
    }
  ],
  protocols: [
    {
      id: "protocol-high-card",
      name: "High Card Protocol",
      english: "High Card Protocol",
      hand: "High Card"
    },
    {
      id: "protocol-pair",
      name: "One Pair Protocol",
      english: "One Pair Protocol",
      hand: "One Pair"
    },
    {
      id: "protocol-two-pair",
      name: "Two Pair Protocol",
      english: "Two Pair Protocol",
      hand: "Two Pair"
    },
    {
      id: "protocol-trips",
      name: "Three of a Kind Protocol",
      english: "Three of a Kind Protocol",
      hand: "Three of a Kind"
    },
    {
      id: "protocol-straight",
      name: "Straight Protocol",
      english: "Straight Protocol",
      hand: "Straight"
    },
    {
      id: "protocol-flush",
      name: "Flush Protocol",
      english: "Flush Protocol",
      hand: "Flush"
    },
    {
      id: "protocol-full-house",
      name: "Full House Protocol",
      english: "Full House Protocol",
      hand: "Full House"
    },
    {
      id: "protocol-quads",
      name: "Four of a Kind Protocol",
      english: "Four of a Kind Protocol",
      hand: "Four of a Kind"
    },
    {
      id: "protocol-straight-flush",
      name: "Straight Flush Protocol",
      english: "Straight Flush Protocol",
      hand: "Straight Flush, Royal Flush"
    }
  ]
});

if (typeof window !== "undefined") window.OVERLIMIT_RULEBOOK_EN_V1 = OVERLIMIT_RULEBOOK_EN_V1;
if (typeof module !== "undefined" && module.exports) module.exports = OVERLIMIT_RULEBOOK_EN_V1;
