# DEJARIK — Holographic Strategy Combat Game

> *"Let the Wookiee win."* — Han Solo

A fully playable implementation of **Dejarik** (holochess), the holographic strategy game seen aboard the Millennium Falcon in Star Wars. Rules, board geometry, creature abilities, and combat mechanics devised and specified by **Josef Laspina / MotoHov Industries** under the **Levitation Transport Technologies (LTT) Programme**.

Holographic display technology underpinning this project is documented at:
[levitationtransporttechnologies.wordpress.com](https://levitationtransporttechnologies.wordpress.com/spodugraphate-r-in-efabrics-and-smart-materials-patented-3d-holographic-displays/)

---

## Contents

| File | Description |
|------|-------------|
| `dejarik_engine.py` | Full Python game engine — CLI play + AI vs AI simulation |
| `dejarik_game.jsx` | React browser game — holographic UI, Wookiee AI opponent |

---

## The Board

- **Shape:** Circular, 50 cm diameter (physical reference)
- **Spaces:** 24 radial segments numbered 1–24 clockwise
- **3 Concentric Rings:**

| Ring | Spaces | Zone | Effect |
|------|--------|------|--------|
| Outer | 1–8 | Safe Zone | −1 ATK (defensive advantage) |
| Middle | 9–16 | Neutral Zone | No modifier |
| Inner | 17–24 | Combat Center | +2 ATK (offensive advantage) |

---

## Creatures

Each player commands **8 creatures**. Starting positions are symmetrical — Light Side on odd spaces, Dark Side on even spaces.

| Creature | ATK | DEF | HP | Move | Special Ability |
|----------|-----|-----|----|------|-----------------|
| 🛡️ Houjix | 2 | 9 | 20 | 1 | **Shield Wall** — absorbs 3 damage per hit |
| 🦣 Ng'ok | 8 | 5 | 14 | 1 | **Charge** — +3 ATK when advancing into combat |
| 🐍 K'lor'slug | 5 | 3 | 10 | 2 | **Double Move** — may move twice per turn |
| 👊 Molator | 9 | 2 | 12 | 1 | **Stun Strike** — enemy skips counterattack on first round |
| 🕷️ Ghhhk | 5 | 5 | 13 | 2 | **Dodge** — 40% chance to avoid the first incoming attack |
| ⚔️ Monnok | 5 | 5 | 14 | 1 | **Counter** — 30% chance to deal bonus damage when struck |
| 🗿 Savrip | 7 | 9 | 22 | 1 | **Fortified** — immune to attacks with effective ATK ≤ 3 |
| 🐺 Grond | 5 | 5 | 15 | 1 | **Lone Wolf** — +2 ATK when no friendly piece is adjacent |

---

## Rules Summary

### Turn Structure
- Players alternate turns; **Light Side moves first**
- Each turn: move one creature to an adjacent or reachable space
- Creatures **cannot move through** occupied spaces
- If a creature wins combat, it is **granted a bonus move**

### Combat (Archon-style)
When a creature enters a space occupied by an enemy:
1. A combat phase initiates automatically
2. Attacker strikes first; defender counter-strikes each round
3. Combat continues until one creature's HP reaches zero
4. The **loser collapses dramatically then disappears**
5. The **winner remains** on the board and earns a bonus turn

### Zone Bonuses
- Creatures in the **Inner Ring** gain **+2 effective ATK**
- Creatures in the **Outer Ring** suffer **−1 effective ATK**

### Winning Condition
**Eliminate all 8 enemy creatures.** Last side standing wins.

---

## Strategy Notes

**Aggressive (Combat Center control)**
- Rush Ng'ok, Molator, and Ghhhk toward spaces 17–24 early
- Inner ring creatures gain +2 ATK — ideal for heavy hitters
- Use K'lor'slug's double-move to flank and pressure

**Defensive (Outer Rim holding)**
- Station Houjix and Savrip in spaces 1–8
- Force the opponent to overextend into bad positions
- Lure attackers into range of your counterattacking pieces (Monnok)

**Mixed**
- Grond is powerful when isolated — advance alone for maximum Lone Wolf bonus
- Savrip is nearly untouchable by weak pieces — use as an immovable anchor

---

## Running the Python Engine

```bash
# AI vs AI demonstration
python dejarik_engine.py sim

# Human vs Wookiee AI (interactive CLI)
python dejarik_engine.py pve
```

Requires Python 3.10+ (uses `list[int]` type hints). No external dependencies.

---

## Running the React Game

Drop `dejarik_game.jsx` into any React 18+ project, or open it directly as a Claude artifact on [claude.ai](https://claude.ai).

**Dependencies used (all standard):**
- React 18 (useState, useEffect, useCallback, useRef)
- No external libraries required

**Features:**
- Interactive holographic board with 24 spaces
- Legal move highlighting
- Full Archon-style combat with all special abilities
- Wookiee AI opponent (Player vs AI mode)
- Player vs Player mode (local)
- Combat log
- Creature reference panel
- Zone bonus indicators

---

## Credits & Intellectual Origin

**Game rules, board specification, creature roster, and combat mechanics:**
Josef Laspina — MotoHov Industries (Malta)
Levitation Transport Technologies (LTT) Programme

**Holographic display technology (SUMLUTEGO / voxel projection):**
Documented at [levitationtransporttechnologies.wordpress.com](https://levitationtransporttechnologies.wordpress.com)

**Software implementation:**
Developed with AI assistance (Claude, Anthropic)

*Dejarik is a fictional game from the Star Wars universe (Lucasfilm/Disney).
This implementation is a fan/research project and is not affiliated with or endorsed by Lucasfilm Ltd.*

---

## Licence

MIT — free to use, modify, and distribute with attribution to MotoHov Industries / Josef Laspina.
