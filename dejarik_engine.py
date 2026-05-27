"""
DEJARIK – Holographic Strategy Game Engine
MotoHov Industries / LTT Programme
Specification derived from the complete Dejarik rulebook (MotoHov/Josef Laspina)

Board: Circular, 24 radial segments across 3 concentric rings
  Outer Ring  (Safe Zone)    : spaces  1–8
  Middle Ring (Neutral Zone) : spaces  9–16
  Inner Ring  (Combat Center): spaces 17–24

Creatures: 8 per side (Light vs Dark)
  Houjix, Ng'ok, K'lor'slug, Molator, Ghhhk, Monnok, Savrip, Grond

Combat: Archon-style – when a piece enters an enemy's space, battle resolves
        via stat comparison + special ability roll.
        Winner stays; loser plays death animation then vanishes.

Winning: Eliminate all 8 enemy creatures.
"""

import random
import math
import time
import sys
from dataclasses import dataclass, field
from typing import Optional
from enum import Enum

# ─────────────────────────────────────────────────────────────────────────────
# ENUMERATIONS
# ─────────────────────────────────────────────────────────────────────────────

class Team(Enum):
    LIGHT = "Light Side"
    DARK  = "Dark Side"

class Zone(Enum):
    OUTER  = "Outer Ring (Safe Zone)"
    MIDDLE = "Middle Ring (Neutral Zone)"
    INNER  = "Inner Ring (Combat Center)"

# ─────────────────────────────────────────────────────────────────────────────
# BOARD GEOMETRY HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def zone_of(space: int) -> Zone:
    """Return the zone for a given space number (1–24)."""
    if 1 <= space <= 8:
        return Zone.OUTER
    elif 9 <= space <= 16:
        return Zone.MIDDLE
    else:
        return Zone.INNER

def ring_of(space: int) -> int:
    """0=outer, 1=middle, 2=inner."""
    return (space - 1) // 8

def sector_of(space: int) -> int:
    """0–7 angular sector within the ring."""
    return (space - 1) % 8

def adjacent_spaces(space: int) -> list[int]:
    """
    Compute adjacency on the 3-ring × 8-sector toroidal board.
    A space is adjacent to:
      - Same ring, neighbouring sectors (±1, wrapping)
      - Adjacent ring, same sector
      - Adjacent ring, neighbouring sector (diagonal)
    Returns sorted list of valid space numbers.
    """
    ring   = ring_of(space)
    sector = sector_of(space)
    neighbours = []

    # Same-ring lateral neighbours
    for ds in (-1, +1):
        neighbours.append(ring * 8 + (sector + ds) % 8 + 1)

    # Inward ring (ring+1) neighbours
    if ring < 2:
        for ds in (-1, 0, +1):
            neighbours.append((ring + 1) * 8 + (sector + ds) % 8 + 1)

    # Outward ring (ring-1) neighbours
    if ring > 0:
        for ds in (-1, 0, +1):
            neighbours.append((ring - 1) * 8 + (sector + ds) % 8 + 1)

    return sorted(set(neighbours))

def spaces_in_range(space: int, move_range: int) -> list[int]:
    """BFS: all spaces reachable within move_range steps."""
    visited = {space}
    frontier = {space}
    for _ in range(move_range):
        next_front = set()
        for s in frontier:
            for nb in adjacent_spaces(s):
                if nb not in visited:
                    visited.add(nb)
                    next_front.add(nb)
        frontier = next_front
    visited.discard(space)
    return sorted(visited)

# ─────────────────────────────────────────────────────────────────────────────
# CREATURE DATACLASS
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class Creature:
    name:         str
    team:         Team
    attack:       int          # 1–10 scale
    defense:      int          # 1–10 scale
    max_hp:       int
    hp:           int = field(init=False)
    move_range:   int = 1      # spaces per turn
    special:      str = ""     # description of special ability
    position:     Optional[int] = None
    alive:        bool = True
    emoji:        str = "👾"

    def __post_init__(self):
        self.hp = self.max_hp

    @property
    def zone(self) -> Optional[Zone]:
        return zone_of(self.position) if self.position else None

    def zone_attack_bonus(self) -> int:
        """Combat Center gives +2 attack, Outer gives -1."""
        if self.zone == Zone.INNER:
            return 2
        if self.zone == Zone.OUTER:
            return -1
        return 0

    def effective_attack(self) -> int:
        return max(1, self.attack + self.zone_attack_bonus())

    def is_alone(self, board: "DejarikBoard") -> bool:
        """Grond gains +2 attack when no friendly piece is adjacent."""
        adj = adjacent_spaces(self.position)
        friendlies = [s for s in adj
                      if board.piece_at(s) and board.piece_at(s).team == self.team]
        return len(friendlies) == 0

    def __str__(self):
        status = f"HP:{self.hp}/{self.max_hp}"
        pos    = f"Space {self.position}" if self.position else "dead"
        return f"{self.emoji} {self.name:<12} [{self.team.value[0]}] ATK:{self.attack} DEF:{self.defense} {status} @ {pos}"

# ─────────────────────────────────────────────────────────────────────────────
# CREATURE FACTORY
# ─────────────────────────────────────────────────────────────────────────────

CREATURE_TEMPLATES = {
    "Houjix":    dict(attack=2,  defense=9,  max_hp=20, move_range=1, special="Shield Wall – absorbs 3 extra damage per hit",           emoji="🛡️"),
    "Ng'ok":     dict(attack=8,  defense=5,  max_hp=14, move_range=1, special="Charge – if moving ≥1 space, +3 attack this combat",     emoji="🦣"),
    "K'lor'slug":dict(attack=5,  defense=3,  max_hp=10, move_range=2, special="Double Move – may move twice per turn",                  emoji="🐍"),
    "Molator":   dict(attack=9,  defense=2,  max_hp=12, move_range=1, special="Stun Strike – on hit, enemy loses 1 turn",               emoji="👊"),
    "Ghhhk":     dict(attack=5,  defense=5,  max_hp=13, move_range=2, special="Dodge – 40% chance to avoid one incoming attack",        emoji="🕷️"),
    "Monnok":    dict(attack=5,  defense=5,  max_hp=14, move_range=1, special="Counter – 30% chance to deal damage back when attacked", emoji="⚔️"),
    "Savrip":    dict(attack=7,  defense=9,  max_hp=22, move_range=1, special="Fortified – immune to attacks with ATK ≤ 3",             emoji="🗿"),
    "Grond":     dict(attack=5,  defense=5,  max_hp=15, move_range=1, special="Lone Wolf – +2 ATK when no friendly piece is adjacent",  emoji="🐺"),
}

STARTING_POSITIONS = {
    Team.LIGHT: {"Houjix":1,  "Ng'ok":3,  "K'lor'slug":5, "Molator":7,
                 "Ghhhk":9,  "Monnok":11, "Savrip":13,    "Grond":15},
    Team.DARK:  {"Houjix":2,  "Ng'ok":4,  "K'lor'slug":6, "Molator":8,
                 "Ghhhk":10, "Monnok":12, "Savrip":14,    "Grond":16},
}

def make_creature(name: str, team: Team) -> Creature:
    t = CREATURE_TEMPLATES[name]
    return Creature(name=name, team=team, **t)

def make_team(team: Team) -> list[Creature]:
    pieces = []
    for name, pos in STARTING_POSITIONS[team].items():
        c = make_creature(name, team)
        c.position = pos
        pieces.append(c)
    return pieces

# ─────────────────────────────────────────────────────────────────────────────
# BOARD
# ─────────────────────────────────────────────────────────────────────────────

class DejarikBoard:
    def __init__(self):
        self.grid: dict[int, Optional[Creature]] = {i: None for i in range(1, 25)}

    def place(self, creature: Creature, space: int):
        self.grid[space] = creature
        creature.position = space

    def remove(self, space: int):
        c = self.grid[space]
        if c:
            c.position = None
        self.grid[space] = None

    def move(self, creature: Creature, to: int):
        self.grid[creature.position] = None
        self.grid[to] = creature
        creature.position = to

    def piece_at(self, space: int) -> Optional[Creature]:
        return self.grid.get(space)

    def occupied_by(self, team: Team) -> list[Creature]:
        return [c for c in self.grid.values() if c and c.team == team and c.alive]

    def display(self):
        """ASCII art representation of the 3-ring radial board."""
        print("\n" + "═" * 60)
        print("  DEJARIK BOARD — HOLOGRAPHIC DISPLAY ACTIVE")
        print("═" * 60)
        headers = ["   ", "S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"]
        print("  SECTOR→  " + "  ".join(f"{h:>3}" for h in headers[1:]))
        print("  ─" + "─" * 50)
        ring_labels = ["OUTER ", "MIDDLE", "INNER "]
        for ring in range(3):
            cells = []
            for sector in range(8):
                space = ring * 8 + sector + 1
                c = self.grid[space]
                if c:
                    cells.append(f"{c.emoji[:1]:>3}")
                else:
                    cells.append("  .")
            print(f"  {ring_labels[ring]}  " + "  ".join(cells))
        print("═" * 60)
        print("  Legend: . = empty  (L)=Light  (D)=Dark")
        print()

# ─────────────────────────────────────────────────────────────────────────────
# COMBAT ENGINE
# ─────────────────────────────────────────────────────────────────────────────

class CombatResult:
    def __init__(self, winner: Creature, loser: Creature, log: list[str]):
        self.winner = winner
        self.loser  = loser
        self.log    = log

def resolve_combat(attacker: Creature, defender: Creature,
                   board: DejarikBoard) -> CombatResult:
    """
    Archon-style real-time combat resolved as a stat-based duel.
    Returns CombatResult. Both creatures' HP are modified in place.
    """
    log = []
    log.append(f"\n{'─'*50}")
    log.append(f"  ⚔️  COMBAT: {attacker.emoji}{attacker.name} [{attacker.team.value}]")
    log.append(f"       vs.   {defender.emoji}{defender.name} [{defender.team.value}]")
    log.append(f"{'─'*50}")

    # Base effective stats
    atk_power = attacker.effective_attack()
    def_power = defender.defense

    # Grond lone-wolf bonus
    if attacker.name == "Grond" and attacker.is_alone(board):
        atk_power += 2
        log.append(f"  🐺 Grond Lone Wolf: +2 ATK → {atk_power}")

    # Savrip immunity: immune to attacks with effective ATK ≤ 3
    if defender.name == "Savrip" and atk_power <= 3:
        log.append(f"  🗿 Savrip Fortified: attack too weak – DEFLECTED!")
        return CombatResult(defender, attacker, log)

    # Ghhhk dodge check (40%)
    dodge_blocked = False
    if defender.name == "Ghhhk" and random.random() < 0.40:
        log.append(f"  🕷️ Ghhhk DODGES the first attack!")
        dodge_blocked = True

    # Combat rounds: attacker hits first, then defender counter-hits
    rounds = 0
    stun_turns = 0
    while attacker.hp > 0 and defender.hp > 0 and rounds < 20:
        rounds += 1

        # ── ATTACKER STRIKES ──────────────────────────────────
        if not dodge_blocked:
            # Ng'ok Charge (attacker is charger)
            charge_bonus = 3 if attacker.name == "Ng'ok" else 0
            raw_dmg = max(1, atk_power + charge_bonus - def_power // 2 + random.randint(-1, 2))

            # Houjix shield wall (defender)
            if defender.name == "Houjix":
                raw_dmg = max(0, raw_dmg - 3)
                log.append(f"  🛡️ Houjix Shield Wall absorbs 3 dmg")

            defender.hp -= raw_dmg
            log.append(f"  Rnd {rounds}: {attacker.name} → {defender.name} for {raw_dmg} dmg  "
                       f"({defender.name} HP: {max(0,defender.hp)})")

            # Molator stun
            if attacker.name == "Molator" and rounds == 1:
                log.append(f"  👊 Molator STUN: {defender.name} skips counterattack this round!")
                stun_turns = 1
        else:
            dodge_blocked = False  # dodge only works once

        if defender.hp <= 0:
            break

        # ── DEFENDER COUNTER-STRIKES ───────────────────────────
        if stun_turns > 0:
            stun_turns -= 1
        else:
            def_atk = defender.effective_attack()
            if defender.name == "Grond" and defender.is_alone(board):
                def_atk += 2
            raw_dmg2 = max(1, def_atk - attacker.defense // 2 + random.randint(-1, 2))

            if attacker.name == "Houjix":
                raw_dmg2 = max(0, raw_dmg2 - 3)

            # Monnok counter (defender counter-attacks for bonus)
            monnok_bonus = 0
            if defender.name == "Monnok" and random.random() < 0.30:
                monnok_bonus = def_atk // 2
                log.append(f"  ⚔️ Monnok COUNTER activates: +{monnok_bonus} bonus damage!")

            attacker.hp -= (raw_dmg2 + monnok_bonus)
            log.append(f"  Rnd {rounds}: {defender.name} ↩ {attacker.name} for "
                       f"{raw_dmg2+monnok_bonus} dmg  ({attacker.name} HP: {max(0,attacker.hp)})")

        if attacker.hp <= 0:
            break

    # Determine winner
    if attacker.hp > 0 and defender.hp <= 0:
        winner, loser = attacker, defender
    elif defender.hp > 0 and attacker.hp <= 0:
        winner, loser = defender, attacker
    else:
        # Both dead (rare): attacker wins on tiebreak (moved aggressively)
        winner, loser = attacker, defender

    winner.hp = max(1, winner.hp)   # winner survives with at least 1 HP
    loser.hp  = 0

    log.append(f"\n  💀 {loser.emoji}{loser.name} collapses dramatically... vanishing!")
    log.append(f"  🏆 {winner.emoji}{winner.name} stands victorious! (HP: {winner.hp})")
    log.append(f"{'─'*50}\n")

    return CombatResult(winner, loser, log)

# ─────────────────────────────────────────────────────────────────────────────
# AI OPPONENT (DARK SIDE)
# ─────────────────────────────────────────────────────────────────────────────

class DejarikAI:
    """
    Wookiee-grade AI (Chewbacca difficulty).
    Strategy:
      - Prioritise capturing weakened enemy pieces.
      - Move heavy attackers toward the Combat Center (spaces 17–24).
      - Keep tanks (Houjix, Savrip) in outer/middle ring.
      - Use K'lor'slug speed to flank.
    """

    def __init__(self, team: Team, board: "DejarikBoard"):
        self.team  = team
        self.enemy = Team.LIGHT if team == Team.DARK else Team.DARK
        self.board = board

    def choose_move(self, pieces: list[Creature]) -> tuple[Creature, int]:
        alive = [p for p in pieces if p.alive and p.position]
        enemy_pieces = self.board.occupied_by(self.enemy)

        best_move = None
        best_score = -9999

        for piece in alive:
            reachable = self._reachable(piece)

            for dest in reachable:
                score = self._score_move(piece, dest, enemy_pieces)
                if score > best_score:
                    best_score = score
                    best_move  = (piece, dest)

        if best_move is None:
            # Fallback: random valid move
            for piece in alive:
                reachable = self._reachable(piece)
                if reachable:
                    return piece, random.choice(reachable)

        return best_move

    def _reachable(self, piece: Creature) -> list[int]:
        """All spaces reachable by this piece that are not occupied by own team."""
        candidates = spaces_in_range(piece.position, piece.move_range)
        return [s for s in candidates
                if not self.board.piece_at(s) or
                   (self.board.piece_at(s) and self.board.piece_at(s).team != self.team)]

    def _score_move(self, piece: Creature, dest: int, enemy_pieces: list[Creature]) -> float:
        score = 0.0
        occupant = self.board.piece_at(dest)

        # Strong incentive to attack a weakened enemy
        if occupant and occupant.team == self.enemy:
            hp_ratio = occupant.hp / occupant.max_hp
            win_prob  = piece.effective_attack() / (piece.effective_attack() + occupant.defense)
            score += 100 * win_prob * (1 - hp_ratio + 0.1)

        # Move attackers toward Combat Center
        dest_ring = ring_of(dest)
        if piece.name in ("Ng'ok", "Molator", "Ghhhk"):
            score += dest_ring * 10  # inner ring = ring 2 = +20

        # Keep tanks on outer/middle
        if piece.name in ("Houjix", "Savrip"):
            score -= dest_ring * 5

        # Slight bonus for proximity to enemies (pressure)
        for ep in enemy_pieces:
            dist = abs(ring_of(dest) - ring_of(ep.position)) + \
                   min(abs(sector_of(dest) - sector_of(ep.position)),
                       8 - abs(sector_of(dest) - sector_of(ep.position)))
            score += max(0, 5 - dist)

        return score

# ─────────────────────────────────────────────────────────────────────────────
# GAME ENGINE
# ─────────────────────────────────────────────────────────────────────────────

class DejarikGame:
    def __init__(self, mode: str = "pvp"):
        """
        mode: 'pvp' (two human players) or 'pve' (human vs Wookiee AI)
        """
        self.board  = DejarikBoard()
        self.mode   = mode
        self.turn   = 0
        self.active = Team.LIGHT
        self.winner : Optional[Team] = None
        self.stunned: dict[str, int] = {}  # creature name → turns stunned remaining

        # Initialise teams
        self.light_pieces = make_team(Team.LIGHT)
        self.dark_pieces  = make_team(Team.DARK)

        for c in self.light_pieces + self.dark_pieces:
            self.board.place(c, c.position)

        # AI (Wookiee difficulty)
        self.ai = DejarikAI(Team.DARK, self.board) if mode == "pve" else None

        print("\n" + "╔" + "═"*56 + "╗")
        print("║" + "  DEJARIK – HOLOGRAPHIC STRATEGY GAME".center(56) + "║")
        print("║" + "  MotoHov Industries / LTT Programme".center(56) + "║")
        print("╚" + "═"*56 + "╝")
        print(f"\n  Mode: {'Player vs. Wookiee AI' if mode=='pve' else 'Player vs. Player'}")
        print("  Light Side plays first.\n")

    # ── Public interface ──────────────────────────────────────────────────────

    def get_alive(self, team: Team) -> list[Creature]:
        pieces = self.light_pieces if team == Team.LIGHT else self.dark_pieces
        return [c for c in pieces if c.alive]

    def legal_moves(self, piece: Creature) -> list[int]:
        """Spaces this piece can legally move to."""
        candidates = spaces_in_range(piece.position, piece.move_range)
        return [s for s in candidates
                if not self.board.piece_at(s) or
                   self.board.piece_at(s).team != piece.team]

    def execute_move(self, piece: Creature, destination: int) -> list[str]:
        """
        Move piece to destination. If occupied by enemy, trigger combat.
        Returns a log of events. Also handles stun skip.
        """
        log = []

        # Stun check
        if piece.name in self.stunned and self.stunned[piece.name] > 0:
            self.stunned[piece.name] -= 1
            log.append(f"  😵 {piece.name} is stunned and skips this turn!")
            self._end_turn()
            return log

        occupant = self.board.piece_at(destination)

        if occupant and occupant.team == piece.team:
            log.append("  ❌ Cannot move onto friendly piece.")
            return log

        if destination not in self.legal_moves(piece):
            log.append(f"  ❌ Space {destination} is not reachable by {piece.name}.")
            return log

        # Move piece
        from_space = piece.position
        self.board.move(piece, destination)
        log.append(f"  ➡️  {piece.emoji}{piece.name} moves {from_space} → {destination} "
                   f"[{zone_of(destination).value.split('(')[0].strip()}]")

        if occupant:
            # ── COMBAT ──────────────────────────────────────────
            result = resolve_combat(piece, occupant, self.board)
            log.extend(result.log)

            if result.loser == occupant:
                # Attacker won: loser (defender) removed
                occupant.alive = False
                self.board.remove(destination)
                # Re-place attacker at destination (already there via move)
            else:
                # Defender won: attacker returns to previous space?
                # Rule: winner stays at destination, loser vanishes.
                piece.alive = False
                self.board.remove(destination)
                self.board.place(result.winner, destination)
                result.winner.hp = max(1, result.winner.hp)

            # Stun if Molator was the winner
            if result.winner.name == "Molator":
                # Stun applied already in combat, tracked here for next move
                pass  # handled in combat resolution

            # Winner gets bonus move (per rulebook: "winner takes another turn")
            if result.winner.alive and result.winner.team == self.active:
                log.append(f"  🎯 {result.winner.name} wins combat → BONUS MOVE granted!")
                self._grant_bonus_turn()
                return log  # caller must prompt for bonus move

        self._end_turn()
        return log

    def _end_turn(self):
        self.turn += 1
        self.active = Team.DARK if self.active == Team.LIGHT else Team.LIGHT
        self._check_winner()

    def _grant_bonus_turn(self):
        # Do not switch active team — same player moves again
        pass  # active stays the same

    def _check_winner(self):
        """
        Game ends ONLY when one side has lost ALL 8 creatures.
        A single kill does not end the game — play continues until full elimination.
        """
        light_alive = self.get_alive(Team.LIGHT)
        dark_alive  = self.get_alive(Team.DARK)
        if len(light_alive) == 0:
            self.winner = Team.DARK
        elif len(dark_alive) == 0:
            self.winner = Team.LIGHT
        # else: both sides still have creatures — game continues

    def is_over(self) -> bool:
        return self.winner is not None

    def status(self):
        """Print current board and piece status."""
        self.board.display()
        print(f"  Turn {self.turn+1} — {self.active.value} to move\n")

        for team, pieces_list in [(Team.LIGHT, self.light_pieces), (Team.DARK, self.dark_pieces)]:
            print(f"  {'☀️' if team==Team.LIGHT else '🌑'} {team.value}")
            for c in pieces_list:
                if c.alive:
                    print(f"    {c}")
            print()

    # ── CLI Play Loop ─────────────────────────────────────────────────────────

    def play_cli(self):
        """Interactive terminal play loop."""
        while not self.is_over():
            self.status()

            if self.mode == "pve" and self.active == Team.DARK:
                print("  🤖 Wookiee AI is calculating...")
                time.sleep(0.8)
                piece, dest = self.ai.choose_move(self.dark_pieces)
                print(f"  AI chooses: {piece.name} → Space {dest}")
                logs = self.execute_move(piece, dest)
                for l in logs: print(l)
            else:
                # Human input
                alive = self.get_alive(self.active)
                print(f"  Your pieces: {', '.join(c.name for c in alive)}")
                piece_name = input("  Choose piece (name): ").strip()
                piece = next((c for c in alive if c.name.lower() == piece_name.lower()), None)
                if not piece:
                    print("  ❌ Piece not found. Try again.")
                    continue

                moves = self.legal_moves(piece)
                print(f"  Legal moves for {piece.name}: {moves}")
                try:
                    dest = int(input("  Destination space: ").strip())
                except ValueError:
                    print("  ❌ Invalid space number.")
                    continue

                logs = self.execute_move(piece, dest)
                for l in logs: print(l)

        print("\n" + "★"*50)
        print(f"  🏆  GAME OVER — {self.winner.value} WINS!")
        print("★"*50 + "\n")


# ─────────────────────────────────────────────────────────────────────────────
# QUICK SIMULATION — DEMO / UNIT TEST
# ─────────────────────────────────────────────────────────────────────────────

def run_simulation(verbose: bool = True) -> Team:
    """
    Simulate a full Wookiee-vs-Wookiee AI game to verify engine correctness.
    Returns the winning team.
    """
    game = DejarikGame(mode="pvp")

    # Both sides controlled by AI for headless sim
    ai_light = DejarikAI(Team.LIGHT, game.board)
    ai_dark  = DejarikAI(Team.DARK,  game.board)

    max_turns = 200
    t = 0

    while not game.is_over() and t < max_turns:
        ai = ai_light if game.active == Team.LIGHT else ai_dark
        pieces = game.light_pieces if game.active == Team.LIGHT else game.dark_pieces

        result = ai.choose_move(pieces)
        if result is None:
            game._end_turn()
            t += 1
            continue

        piece, dest = result
        logs = game.execute_move(piece, dest)

        if verbose:
            for l in logs: print(l)
        t += 1

    if verbose:
        game.status()
        print(f"\n  Simulation complete in {t} turns.")
        if game.winner:
            print(f"  Winner: {game.winner.value}")
        else:
            print("  Result: Draw (max turns reached)")

    return game.winner


# ─────────────────────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "sim":
        print("\n  Running AI vs AI simulation...\n")
        run_simulation(verbose=True)
    elif len(sys.argv) > 1 and sys.argv[1] == "pve":
        g = DejarikGame(mode="pve")
        g.play_cli()
    else:
        print("\n  Usage:")
        print("    python dejarik_engine.py sim    # AI vs AI demonstration")
        print("    python dejarik_engine.py pve    # Human vs Wookiee AI")
        print()
        print("  Running AI demonstration by default...\n")
        run_simulation(verbose=True)
