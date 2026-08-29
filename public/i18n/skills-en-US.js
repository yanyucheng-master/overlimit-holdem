(function registerEnSkillCopy(root) {
  "use strict";
  const i18n = root.OverlimitI18n || (typeof require === "function" ? require("./i18n") : null);
  if (!i18n) return;
  const protocolRules =
    " Must reach Showdown, and the best five-card hand must be exactly the named category to uniquely win the hand. A Fold win does not trigger. If this hand already has another chip multiplier produced by your own skills (Blood Battle / Desperation / Dead End, etc.), this protocol does not trigger. Multipliers from the opponent do not block this protocol and may still stack by multiplication. The award is standard net winnings ×2.";
  i18n.register("en-US", {
    skills: {
      DEEP_BREATH: {
        name: "Deep Breath",
        catalogSummary: "No more skills this hand; recover 2 Energy at the end",
        shortDescription: "Spend 1 Energy to pause. If you use no other skills this hand, you recover 2 Energy at the end — a net gain of 1.",
        expertDescription: "Active / Secret. Load 1, cost 1, at most once per hand, only on your legal betting action turn, Pre-Flop through River. Pay 1 Energy on use; if no further skill events of your own occur until the hand ends, recover 2 Energy. There is no current-Energy ceiling requirement beyond the actual Energy Cap. A normal Fold does not cancel the recovery; if Deep Breath is followed by no other skill events and you Fold: recover 2, then also gain the losing-hand natural +1. Can be Countered; a cost-1 failed skill refunds 0 after Recycle rounding. Fairness clears the pending recovery and suppresses all end-of-hand Energy recovery this hand."
      },
      RECYCLE: {
        name: "Recycle",
        catalogSummary: "Refund 50% Energy of the costliest failed skill",
        shortDescription: "If a skill already paid Energy but failed this hand, the costliest such use is refunded at half price when the hand ends.",
        expertDescription: "Passive. Load 2, cost 0, settles at most once per hand. At hand end, among skills that passed legality, actually paid Energy, and finally failed, take the highest original Energy cost and refund floor(original cost × 50%). Counts: Countered, blocked by Top Secret, hidden target actually missing, or target left a legal zone. Does not count: illegal rejects before payment, player cancel, network retry, client duplicate request, or a Counter that was placed but never triggered. Does not refund mid-hand."
      },
      INTIMIDATION: {
        name: "Intimidation",
        catalogSummary: "No Fold; both players capped at 500 invested this hand",
        shortDescription: "Nobody may Fold this hand, and each player's standard investment this hand is capped at 500 total.",
        expertDescription: "Active / Public. Load 3, cost 4, at most once per hand, on any of your legal betting action turns. Prerequisite: both players' current cumulative standard betting investment must be ≤ 500. After success until the hand ends: both players cannot Fold; each player's cumulative standard investment is capped at 500; Bet/Raise must leave the opponent a legal Call. ALL IN may still be clicked, but standard investment only rises to a cumulative 500, still recorded as a legal ALL IN action (allInAction=true; stackCommitted=false if chips remain) so ALL IN-dependent skills can trigger. The 500 cap only limits standard betting investment, not extra chip transfers from skill multipliers."
      },
      DESPERATION: {
        name: "Desperation",
        catalogSummary: "Start ≤ 200 chips: win payout ×3 and recover 1 Energy",
        shortDescription: "If you start a hand with 200 chips or fewer, a win triples net chip winnings and recovers 1 extra Energy.",
        expertDescription: "Passive. Load 2, cost 0. At the start of each hand, check the start-of-hand chip snapshot: if your chips <= 200, this hand automatically enters Desperation. Do not trigger from current chips, ALL IN, or being behind mid-hand. If you uniquely win: standard net chip winnings ×3, plus recover 1 Energy. A split pot does not trigger the multiplier."
      },
      BLOOD_BATTLE: {
        name: "Blood Battle",
        catalogSummary: "This hand's chip win/loss ×2; both copies stack to ×4",
        shortDescription: "Final chip win or loss this hand is doubled. If both players launch Blood Battle it becomes ×4, not a cancel.",
        expertDescription: "Active / Public. Load 2, cost 3, at most once per hand, on any legal betting street. Final standard net chip transfer this hand ×2. If both players launch it, ×2 ×2 = ×4, not a cancel. May multiply with legal multipliers other than Protocol, including Desperation and Dead End. Split pots are not multiplied. Final payment still cannot exceed the loser's actually payable chips."
      },
      DEFENSE: {
        name: "Defense",
        catalogSummary: "If you lose without Folding, final loss is halved",
        shortDescription: "Secret padding. If you lose this hand without Folding, the final chip loss is halved.",
        expertDescription: "Active / Secret. Load 3, cost 3, at most once per hand, on any of your legal betting action turns from Pre-Flop through River. If you uniquely lose the hand and did not Fold, final net chip loss is halved; it covers the whole-hand final loss regardless of the street of use. Win, split, or a voluntary Fold yields nothing; the 3 Energy already paid is not refunded. The launch itself is secret; if settlement actually halves a public loss, Defense can then be naturally confirmed."
      },
      PERCEPTION: {
        name: "Perception",
        catalogSummary: "Chance of true/false hole-card intel; likelier when behind",
        shortDescription: "During dealing you may hear a private whisper about the opponent's Hole Cards — true or false, unseen by them.",
        expertDescription: "Passive / fully Secret / Intel. Load 3, cost 0. Check nodes: after Hole Cards, Flop, Turn, River — four independent checks, at most 3 successes per hand. Trigger chance scales with your chip disadvantage between 25% and 50% (FROZEN_V1: spec-25-50). Each success first picks an information category by fixed weights, then 75% true / 25% false, then generates a proposition in that category that satisfies the truth requirement. False information must be chosen from propositions that are actually false in the current true state, never logically impossible or already disprovable by the observer. The same hand avoids identical, equivalent, or directly contradictory propositions. The trigger, content, and truth value are all hidden from the opponent. Clairvoyance can only learn that a Perception event occurred this hand, not the content or truth. Top Secret can block Perception from accessing protected Hole Card information."
      },
      INTEL_ONE: {
        name: "Intel",
        catalogSummary: "See a random opponent Hole Card or a future Community Card",
        shortDescription: "Spend 4 Energy to look: either a random opponent Hole Card, or a Community Card seat that has not been dealt yet.",
        expertDescription: "Active / Secret. Load 3, cost 4, at most once per hand. You must choose a mode before paying. Mode A: the system randomly shows exactly one opponent Hole Card, 100% true, not a left/right choice by the player. Mode B: choose any undealt Community Card seat (including looking at the future River before the Flop) and receive that seat's currently scheduled true card, 100% true. Mode and target must be locked before payment. If the Hole Card mode is blocked by Top Secret the skill fails and cannot be switched to a Community Card look. Future Community Card looks are not affected by Top Secret."
      },
      TOP_SECRET: {
        name: "Top Secret",
        catalogSummary: "Auto-blocks the first Hole Card attack and keeps protecting this hand",
        shortDescription: "The first time someone touches your Hole Cards, if you still have at least 3 Energy, it auto-blocks and then protects your Hole Cards for the rest of the hand.",
        expertDescription: "Passive / Secret / information Defense. Load 3, cost 3, auto-starts at most once per hand. When an enemy skill first tries to read, infer, swap, Nullify, or directly operate on your private Hole Card information, if current Energy >= 3, automatically pay 3 Energy, stop that enemy skill, then keep protecting your private Hole Card information for the rest of the hand without paying 3 again. Insufficient Energy means it does not fire and cannot overdraft. Blocks: Perception Hole Card information, Intel Hole Card mode, Cheat opponent Hole Card mode, Nullification Hole Card mode, and future skills of the same kind. Does not block: Community Card Intel, Clairvoyance, or pure skill meta-information. The first time it actually blocks, the opponent confirms Top Secret exists."
      },
      COUNTER: {
        name: "Counter",
        catalogSummary: "Wastes the opponent's next Active Skill and locks later skills",
        shortDescription: "Pre-Flop you secretly set a trap. The opponent's next real Active Skill pays Energy and fails, and they cannot use skills for the rest of the hand.",
        expertDescription: "Active / Secret / control. Load 4, cost 4, may only be secretly placed Pre-Flop on your legal action turn, at most once per hand. It then captures the opponent's next legal Active Skill: legality passes, Energy is paid normally, Counter fires, that skill fails; then the opponent cannot launch Active Skills or produce new Passive Skill events for the rest of this hand. Completed effects are not rolled back. A Passive Skill itself is not \"the next Active Skill\" that trips Counter. Counter can Counter an opposing Counter being placed. Illegal skill requests cannot consume Counter. Fairness cannot be Countered. If it never triggers, refund 1 Energy at hand end (net empty-set cost 3). The core meaning is stopping the target skill at the trigger instant; it is not weakened against Destiny or similar skills."
      },
      FAIRNESS: {
        name: "Fairness",
        catalogSummary: "Clears unfinished skill states and locks skills and Energy recovery this hand",
        shortDescription: "Immediately clear unfinished skill states on both sides. Nobody may use skills for the rest of the hand, and end-of-hand Energy recovery is cancelled. Completed card swaps do not revert.",
        expertDescription: "Active / Public / global control. Load 4, cost 3, at most once per hand, on any of your legal betting action turns; it does not have to be the first skill this hand. Cannot be stopped by Counter. On success, immediately clear both players' current persistent, planted, pending, and unfinished skill states (including Blood Battle, Defense, Intimidation, Top Secret protection, pending Desperation, Counter traps, pending Deep Breath recovery, Nullification, unpaid Loan debt, Retreat, untriggered Probe, and Disguise); for the rest of this hand neither player may launch Active Skills or produce new Passive Skill events; all end-of-hand Energy recovery this hand is cancelled, including the loser natural +1, Deep Breath recovery, Desperation recovery, Fortune resource recovery, and other skill end-of-hand recovery. Fairness is not a time rewind: it cannot restore already swapped cards, already changed decks, already seen information, already moved chips, or already completed Endgame direct chip transfers. Nullification is a persistent settlement state, so Fairness can cancel it. After Fairness succeeds, Endgame cannot be launched this hand. Fairness can still clear Loan pending repayment and residual debt, but does not roll back chips or Energy already obtained. If it actually clears any Loan debt amount greater than 0, that player's Loan credit is settled by the official Loan rules: normal credit becomes restricted; already restricted stays restricted; defaulted leaves full lockout and becomes restricted, not restored to normal. If no Loan debt exists at launch, credit status must not change."
      },
      CHEAT: {
        name: "Cheat",
        catalogSummary: "Swap one of your Hole Cards with an opponent, Board, or deck card",
        shortDescription: "Swap one of your Hole Cards with an opponent Hole Card seat, a revealed Community Card, an undealt Community Card, the next card, or a non-next hidden deck card.",
        expertDescription: "Active. Load 5, cost 6, at most once per hand, legal from Pre-Flop through River (including after the River is fully public). Choose one of your Hole Cards and swap it with one of: 1) a specified opponent Hole Card seat (unknown rank/suit, protected by Top Secret); 2) any already public Community Card (including after the River is out) — changing a public Community Card naturally reveals Cheat; 3) any undealt future Community Card seat; 4) the deck top / next live deal card; 5) a uniformly random remaining undealt card that is not the top and not the next live deal card, with your old Hole Card returned to that exact original slot. Must keep 52 unique cards. A completed swap is a settled fact; Fairness cannot roll it back."
      },
      DEAD_END: {
        name: "Dead End",
        catalogSummary: "Max All-In and lock opponent skills; their Fold pays ×3",
        shortDescription: "Immediately make the maximum legal ALL IN and lock the opponent out of skills this hand. If they Fold, your net chip winnings this hand become ×3.",
        expertDescription: "Active / Public / ALL IN. Load 4, cost 5, at most once per hand, on any legal betting street. On success, automatically execute the maximum currently legal ALL IN, then the opponent cannot launch Active Skills or produce new Passive Skill events this hand, without cancelling already completed facts. If the opponent later Folds: the Dead End player's standard net winnings ×3. If the opponent Calls and the hand goes to Showdown, Dead End itself does not provide ×3 even if that player wins. Still legal under Intimidation; the ALL IN investment may only reach a cumulative 500 but must still be recorded as an ALL IN. Because Intimidation forbids Fold, Dead End's Fold ×3 branch cannot occur in that case."
      },
      CLAIRVOYANCE: {
        name: "Clairvoyance",
        catalogSummary: "See the opponent's true Energy and skills that already happened this hand",
        shortDescription: "Privately see how much Energy the opponent actually has left, and which skills have already happened this hand, but not those skills' private details.",
        expertDescription: "Active / Secret / meta-intel. Load 3, cost 2, at most once per hand. Privately reads: 1) the opponent's current true Energy, not the frozen public display; 2) skill events the opponent has already completed this hand, including originally secret skills, but not Perception content/truth, which card Intel saw, what hidden cards Cheat swapped, which card Destiny named, what private cards Fortune made, Loan Energy details, or cards Restart drew, nor an unrevealed full Loadout, nor chip amounts through Disguise. The opponent does not know a successful launch. Not blocked by Top Secret. As an Active Skill it can be Countered."
      },
      NULLIFICATION: {
        name: "Nullification",
        catalogSummary: "A chosen Community Card or a random opponent Hole Card does not count this hand",
        shortDescription: "Treat a Community Card or one random opponent Hole Card as missing for this hand's hand ranking. Both players may click the same Community Card; it is revealed only at settlement.",
        expertDescription: "Active / fully Secret. Load 5, at most once per hand, on Flop / Turn / River. Mode A Community Card Nullification costs 6: precisely choose a public or still-undealt Community Card seat; that card is treated as missing for both players' final hand ranking; still legal after all five River cards are public. Mode B Hole Card Nullification costs 7: the system randomly chooses one of the opponent's two Hole Cards so it does not participate in their best five; can be blocked by Top Secret. Launch, mode, and target stay secret until final settlement. Both players may Nullify the same Community Card seat: both skills succeed and pay, that Community Card is invalidated only once, and the other's target is not leaked along the way. Nullification is a persistent state, so Fairness can clear it."
      },
      FORTUNE: {
        name: "Fortune",
        catalogSummary: "Chance to auto-spend Energy for better cards; likelier when behind",
        shortDescription: "Luck may quietly improve your Hole Cards or the next Community Card, or recover 1 Energy at the end. Card changes cost 3 Energy and may go negative.",
        expertDescription: "Passive / fully Secret / luck system. Load 5. Card-rewrite Fortune costs 3 Energy. It auto-checks at several predefined luck nodes; chance is affected by both chip disadvantage and current Energy. Current recommended soft-v1, status FROZEN_V1 (2026-08-20). If Hole Cards are already strong enough, hole-improving Fortune does not fire; if they are weak it may auto-improve. The player cannot choose whether it triggers, which card, or the replacement. You see original → Fortune → new card; the opponent does not know. Only an actual card change pays. Community Card Fortune may only judge what is better for you from your Hole Cards, current Community Cards, and your own state — it must not read the opponent's Hole Cards. Resource Fortune, if it succeeds at hand end, recovers 1 extra Energy, costs no Energy, and cannot recursively trigger another Fortune. Fortune may take Energy down to -4; a paid Fortune that would go below -4 cannot occur. While Energy is negative, no other skill may be launched or auto-trigger a new Passive Skill event except Fortune; completed old effects are not rolled back."
      },
      DESTINY: {
        name: "Destiny",
        catalogSummary: "On the Turn, name the future River card",
        shortDescription: "After the Turn is out, spend 7 Energy to name a card still in the deck and make it the next live River. Equipping this skill raises your Energy Cap to 10.",
        expertDescription: "Active / fully Secret / deck control. Load 5, cost 7. Only legal on the betting street after the Turn is public, on your legal action turn. You choose a specific real poker card; if it is still in the legal operable deck, it is moved immediately to the future River's live deal seat (if a burn exists, it must be the next card that will actually be dealt as the River). This is an immediately completed real deck edit, not a persistent effect, so Fairness cannot roll it back; later deck operations may still change the deck again. If the target is already in the opponent's Hole Cards, a burn, or otherwise out of the controllable deck, 7 Energy is still paid and Destiny fails. Counter can stop Destiny at 100% as normal. The opponent may still Fold normally even after Destiny has named the River; 7 Energy is not refunded. Equipping Destiny raises your personal Energy Cap 8→10; starting Energy is still 4. This is a Loadout attribute; Fairness cannot return the cap from 10 to 8. The opponent's ordinary UI does not directly show the 10 cap."
      },
      LOAN: {
        name: "Loan",
        catalogSummary: "Borrow 100 chips or 5 Energy; next hand repay 150 / 6",
        shortDescription: "Borrow chips or Energy. Chips: take 100 now, repay 150 next hand. Energy: +5 now, repay 6 next hand. If debt is waived instead of really paid, credit becomes restricted.",
        expertDescription: "Active / Resource. Load 2, cost 2. The branch must be locked before payment. Chip Loans and Energy Loans may exist together. On normal credit in one hand: at most 2 Chip Loans, at most 1 Energy Loan, 3 total. Loan has three credit states. NORMAL_CREDIT: uses those normal quotas. RESTRICTED_CREDIT: all Loan modes combined may fire at most once that hand; no Energy+Chip or Chip+Chip. DEFAULTED: while any unreal-repaid residual debt exists, the entire Loan skill cannot fire. Any failed repayment that leaves chip or Energy debt enters default and bans all Loans, without distinguishing debt type. Chip Loan is Public: each time immediately take 100 chips from the opponent, repay 150 at the next hand's end; a second Chip Loan in the same hand takes another 100 and owes another 150, repaid on their own due dates. If the opponent currently has ≤100 chips, take all remaining chips and complete a Loan knockout; if repayment zeros yourself, it can likewise knock you out. Energy Loan is Secret: after paying 2, immediately gain 5 Energy without exceeding your personal cap, then repay 6 at the next hand's end; if short, first drain current Energy and the remainder becomes Energy debt, after which any Energy income pays the debt first. Only a real deduction from the player's chips or Energy counts as repayment. Fairness, match-end expiry, debug reset, state overwrite, or other waivers do not count as real repayment. Fairness may still clear unfulfilled or unpaid Loan debt without rolling back chips or Energy already obtained; if that clears any pending or residual debt amount greater than 0, it is a waiver without real repayment: normal credit becomes restricted; already restricted stays restricted; defaulted leaves default but becomes restricted rather than normal. After restricted credit, you must complete at least one Loan that was newly created while restricted, came due normally, was paid entirely with real resources, had no portion waived, and ended with residual 0, to restore normal credit. After default, if residual is fully repaid for real, restore normal credit; if Fairness clears it, only rise to restricted. If Counter catches Loan: the cost is paid, no resource is gained, no repayment or residual is created, and credit does not change. When a match legally ends, unfinished repayment, residual, and credit are all cleared; the next match starts on normal credit. While Disguise is active, a public Loan only announces the launch, with no chip or debt numbers."
      },
      ALERT: {
        name: "Alert",
        catalogSummary: "Chance to notice a secret action; misses raise the chance",
        shortDescription: "Sometimes, before your next action, you vaguely sense the opponent made a secret play — without learning what it was.",
        expertDescription: "Passive / fully Secret / Intel. Load 1, cost 0. Only listens to enemy legal, formally submitted Active Skill events that are still hidden from you; public Active Skills, Passive Skills, illegal requests, cancels, and network retries do not trigger. Chance ladder: 10%→25%→40%→55%→70%→85%→100%. A miss raises one step; a hit resets to 10%. Sensitivity persists across hands; the current chance is not shown. A success is not shown at the skill instant, but at the start of your next legal betting decision: “You vaguely sense the opponent made a secret play.” It reveals no name, type, count, cost, result, or exact time. At most one successful hint per hand."
      },
      RETREAT: {
        name: "Retreat",
        catalogSummary: "Secret Fold that returns both players' standard investment this hand",
        shortDescription: "Secretly prepare an exit. If you Fold this hand, both players' chips put in the Pot this hand are returned, as if the hand had no winner.",
        expertDescription: "Active / Secret / Defense. Load 2, cost 3, at most once per hand, only on your legal betting action turn. After success, you may Fold immediately in the same betting decision window, or keep the state for a later legal Fold window this hand; no prior-street or minimum delay is required. A Retreat Fold only returns both players' standard betting contributions this hand (blinds, Calls, Raises, and standard ALL IN contributions). Standard net chip transfer is 0, and you do not gain the ordinary loser +1. It does not roll back Loan / Endgame direct skill chip transfers, paid Energy, seen information, or completed swaps. If Countered: 3 Energy is paid, the state is not established, you do not auto-Fold, and you stay in the original betting decision window. Dead End does not clear an existing Retreat, so Retreat then Dead End still allows a Retreat Fold; standard net is then 0, and Dead End's 0 × 3 is still 0. If Dead End is first, a new Retreat cannot be launched. Fairness clears Retreat without refunding 3 Energy. Intimidation forbids Fold, so even an existing state cannot trigger. After Endgame closes betting, Retreat may still exist but has no legal Fold window. A Retreat Fold does not trigger Probe."
      },
      RESTART: {
        name: "Restart",
        catalogSummary: "Shuffle both Hole Cards back and draw 2 new ones",
        shortDescription: "Shuffle both of your Hole Cards back into the remaining deck and randomly draw two new ones. They are not guaranteed to improve, and the originals can come back.",
        expertDescription: "Active / Secret / board rewrite. Load 4, cost 3, at most once per hand, any street including after the River. Shuffle both of your Hole Cards back into the legal remaining deck, then randomly draw two new Hole Cards; both must be redrawn together. The originals enter the random pool first, so the new two may extremely rarely match the originals exactly; there is no “at least different cards” protection. The completed Hole Card change is a settled fact; Fairness cannot roll it back. Must keep 52 unique cards."
      },
      PROBE: {
        name: "Probe",
        catalogSummary: "If the opponent makes a normal Fold, win 50 extra chips",
        shortDescription: "If the opponent later chooses a normal Fold this hand, 50 is added to your base winnings before multipliers.",
        expertDescription: "Active / Secret / mind game. Load 1, cost 2, at most once per hand. On use, establish a Probe state for this hand. If the opponent later voluntarily chooses a normal Fold this hand: this hand's base standard net winnings increase by 50. That 50 is not a separate prize; it must join the base standard winnings before multipliers, e.g. base 100, Probe success plus Blood Battle = (100+50)×2=300. Your own Fold does not trigger your Probe. Skill exits such as Retreat are not treated as a normal Fold. An untriggered Probe state can be cleared by Fairness."
      },
      DISGUISE: {
        name: "Disguise",
        catalogSummary: "Hide both stacks, the Pot, and bet amounts from the opponent",
        shortDescription: "This hand the opponent cannot see stack numbers or exact bet sizes, only that someone bet. You always know whether you are All-In.",
        expertDescription: "Active / Public / chip-information control. Load 4, cost 2, at most once per hand. Every chip-inferable number must be cut from the affected player's view model, including both remaining stacks, this-hand investment, Pot, Bet/Call/Raise amounts, minimum raise, chips to call, and any “short by XXX” hint — CSS hiding alone is not enough. When only one side launches it, the launcher's view stays normal; the affected player's Call button must not show an amount, and Raise must not show a minimum-raise number. Over-input is auto-capped to the true maximum legal investment as a legal ALL IN, without returning a shortfall number. Players always know whether they actually went ALL IN; a normal ALL IN is shown to the opponent only as the ordinary matching action. If both launch it, a dark-chip state begins; each still knows their own ALL IN. Dead End ALL IN is forcibly public. Clairvoyance cannot pierce chip numbers. A public skill does not trigger Alert. After Fairness clears it, future views restore, without backfilling historical numeric logs from hidden moments."
      },
      ENDGAME: {
        name: "Endgame",
        catalogSummary: "Lock bets, seize unmatched opponent chips, and force Showdown",
        shortDescription: "Immediately lock already matched bets, seize the opponent's unmatched extra chips, stop further betting, run out Community Cards, and force Showdown. If the opponent is already All-In at 0, a tied hand rank lets you execute them.",
        expertDescription: "Active / Public / super skill. Load 6, cost 8, the first unique 6-Load skill, at most once per hand. May be launched publicly in your legal betting window, including facing a Bet, Raise, or ordinary ALL IN, and in the exclusive response window after the opponent Calls to 0. That exclusive window is given only to the attacker who just caused Call-to-zero, not by seat order; both players cannot hold it at once. The window must offer a clear launch / skip choice; timeout is a skip. Bots must decide from their visible hand strength and must not auto-fire blindly. Settlement order must be: legality → pay 8 → resolve Counter → public success → compute matched/unmatched → seize only the opponent's unmatched standard contribution (direct skill chip transfer, no multipliers) → record execution eligibility from whether remaining chips were already 0 before launch → deal remaining Community Cards → Showdown. The launcher's own unmatched extra bets are returned by ordinary Hold'em rules and must not enter the seize pool. If Counter hits, 8 Energy is paid and the skill fails: no seize, no betting lock, no execution. Execution only checks whether the opponent's remaining chips==0 from a real standard ALL IN or Call-to-zero. Execution compares official hand-rank levels: Royal Flush 10 outranks Straight Flush 9; different levels compare normally; only when both hand-rank levels are identical does the launcher win outright. The exclusive kill presentation fires only when execution overrode the ordinary internal hand-strength compare (endgameExecutionOverride). Cannot launch after Fairness has taken effect; a completed direct seize cannot be rolled back by Fairness."
      },
      PROTOCOL_HIGH_CARD: {
        name: "High Card Protocol",
        catalogSummary: "Win Showdown with High Card: net chips ×2",
        shortDescription: "If you uniquely win Showdown and the final hand is High Card, net chip winnings are doubled.",
        expertDescription: "If you uniquely win Showdown and the final hand is High Card, net chip winnings are doubled." + protocolRules
      },
      PROTOCOL_PAIR: {
        name: "One Pair Protocol",
        catalogSummary: "Win Showdown with One Pair: net chips ×2",
        shortDescription: "If you uniquely win Showdown and the final hand is exactly One Pair, net chip winnings are doubled.",
        expertDescription: "If you uniquely win Showdown and the final hand is exactly One Pair, net chip winnings are doubled." + protocolRules
      },
      PROTOCOL_TWO_PAIR: {
        name: "Two Pair Protocol",
        catalogSummary: "Win Showdown with Two Pair: net chips ×2",
        shortDescription: "If you uniquely win Showdown and the final hand is exactly Two Pair, net chip winnings are doubled.",
        expertDescription: "If you uniquely win Showdown and the final hand is exactly Two Pair, net chip winnings are doubled." + protocolRules
      },
      PROTOCOL_TRIPS: {
        name: "Three of a Kind Protocol",
        catalogSummary: "Win Showdown with Three of a Kind: net chips ×2",
        shortDescription: "If you uniquely win Showdown and the final hand is exactly Three of a Kind, net chip winnings are doubled.",
        expertDescription: "If you uniquely win Showdown and the final hand is exactly Three of a Kind, net chip winnings are doubled." + protocolRules
      },
      PROTOCOL_STRAIGHT: {
        name: "Straight Protocol",
        catalogSummary: "Win Showdown with Straight: net chips ×2",
        shortDescription: "If you uniquely win Showdown and the final hand is exactly Straight, net chip winnings are doubled.",
        expertDescription: "If you uniquely win Showdown and the final hand is exactly Straight, net chip winnings are doubled." + protocolRules
      },
      PROTOCOL_FLUSH: {
        name: "Flush Protocol",
        catalogSummary: "Win Showdown with Flush: net chips ×2",
        shortDescription: "If you uniquely win Showdown and the final hand is exactly Flush, net chip winnings are doubled.",
        expertDescription: "If you uniquely win Showdown and the final hand is exactly Flush, net chip winnings are doubled." + protocolRules
      },
      PROTOCOL_FULL_HOUSE: {
        name: "Full House Protocol",
        catalogSummary: "Win Showdown with Full House: net chips ×2",
        shortDescription: "If you uniquely win Showdown and the final hand is exactly Full House, net chip winnings are doubled.",
        expertDescription: "If you uniquely win Showdown and the final hand is exactly Full House, net chip winnings are doubled." + protocolRules
      },
      PROTOCOL_QUADS: {
        name: "Four of a Kind Protocol",
        catalogSummary: "Win Showdown with Four of a Kind: net chips ×2",
        shortDescription: "If you uniquely win Showdown and the final hand is exactly Four of a Kind, net chip winnings are doubled.",
        expertDescription: "If you uniquely win Showdown and the final hand is exactly Four of a Kind, net chip winnings are doubled." + protocolRules
      },
      PROTOCOL_STRAIGHT_FLUSH: {
        name: "Straight Flush Protocol",
        catalogSummary: "Win Showdown with Straight Flush: net chips ×2 (includes Royal)",
        shortDescription: "If you uniquely win Showdown and the final hand is exactly Straight Flush, net chip winnings are doubled. A Royal Flush is also handled by this protocol.",
        expertDescription: "If you uniquely win Showdown and the final hand is exactly Straight Flush, net chip winnings are doubled. A Royal Flush is also handled by this protocol." + protocolRules + " A Royal Flush currently has no separate protocol; if the ranking system treats a Royal Flush as a Straight Flush for protocol membership, this protocol handles it."
      }
    }
  });
  if (typeof module === "object" && module.exports) module.exports = i18n;
})(typeof globalThis !== "undefined" ? globalThis : this);
