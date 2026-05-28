import { useState, useEffect, useCallback, useRef } from "react";

// ═══════════════════════════════════════════════════════════════
// BOARD GEOMETRY
// ═══════════════════════════════════════════════════════════════
const ringOf  = s => Math.floor((s - 1) / 8);          // 0=outer,1=mid,2=inner
const sectOf  = s => (s - 1) % 8;                      // 0–7 angular
const zoneOf  = s => s<=8 ? "outer" : s<=16 ? "middle" : "inner";

const adjacentSpaces = (space) => {
  const ring = ringOf(space), sector = sectOf(space);
  const nb = new Set();
  for (const ds of [-1, 0, 1]) {
    if (ds !== 0) nb.add(ring * 8 + ((sector + ds + 8) % 8) + 1);
    if (ring < 2) nb.add((ring+1) * 8 + ((sector + ds + 8) % 8) + 1);
    if (ring > 0) nb.add((ring-1) * 8 + ((sector + ds + 8) % 8) + 1);
  }
  nb.delete(space);
  return [...nb];
};

const reachableSpaces = (space, range) => {
  const visited = new Set([space]);
  let frontier = new Set([space]);
  for (let i = 0; i < range; i++) {
    const next = new Set();
    for (const s of frontier) for (const nb of adjacentSpaces(s))
      if (!visited.has(nb)) { visited.add(nb); next.add(nb); }
    frontier = next;
  }
  visited.delete(space);
  return [...visited];
};

// ═══════════════════════════════════════════════════════════════
// CREATURE DATA
// ═══════════════════════════════════════════════════════════════
const CREATURES = {
  Houjix:     { attack:2,  defense:9,  maxHp:20, moveRange:1, special:"Shield Wall – absorbs 3 dmg/hit",         color:"#4aaeff", emoji:"🛡️" },
  "Ng'ok":    { attack:8,  defense:5,  maxHp:14, moveRange:1, special:"Charge – +3 ATK when advancing",          color:"#ff6b35", emoji:"🦣" },
  "K'lor'slug":{ attack:5, defense:3,  maxHp:10, moveRange:2, special:"Double Move – moves twice per turn",      color:"#9d4edd", emoji:"🐍" },
  Molator:    { attack:9,  defense:2,  maxHp:12, moveRange:1, special:"Stun Strike – enemy skips next turn",     color:"#f72585", emoji:"👊" },
  Ghhhk:      { attack:5,  defense:5,  maxHp:13, moveRange:2, special:"Dodge – 40% chance to avoid 1st hit",    color:"#06d6a0", emoji:"🕷️" },
  Monnok:     { attack:5,  defense:5,  maxHp:14, moveRange:1, special:"Counter – 30% chance to deal bonus dmg", color:"#ffd60a", emoji:"⚔️" },
  Savrip:     { attack:7,  defense:9,  maxHp:22, moveRange:1, special:"Fortified – immune to ATK ≤ 3",          color:"#ff9f1c", emoji:"🗿" },
  Grond:      { attack:5,  defense:5,  maxHp:15, moveRange:1, special:"Lone Wolf – +2 ATK when isolated",       color:"#80b918", emoji:"🐺" },
};

const NAMES = Object.keys(CREATURES);

const STARTING_POSITIONS = {
  light: { Houjix:1, "Ng'ok":3, "K'lor'slug":5, Molator:7, Ghhhk:9, Monnok:11, Savrip:13, Grond:15 },
  dark:  { Houjix:2, "Ng'ok":4, "K'lor'slug":6, Molator:8, Ghhhk:10, Monnok:12, Savrip:14, Grond:16 },
};

// ═══════════════════════════════════════════════════════════════
// SVG CREATURE PORTRAITS — canonical appearances
// Each renders at 32×32 inside a viewBox="0 0 32 32"
// Team tint applied via CSS filter on the <g> wrapper
// ═══════════════════════════════════════════════════════════════
const CreatureSVG = ({ name, size = 32, team }) => {
  const tint = team === "light" ? "drop-shadow(0 0 3px #00e5ff)" : "drop-shadow(0 0 3px #ff4444)";
  const s = size / 32;
  const t = `scale(${s})`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ filter: tint, overflow:"visible" }}>
      <g transform={t}>
        {CREATURE_PATHS[name] || <text x="4" y="22" fontSize="20">👾</text>}
      </g>
    </svg>
  );
};

// SVG path data for each creature based on canonical appearances
const CREATURE_PATHS = {

  // HOUJIX — stocky quadruped dinosaur, low-slung, wide head
  "Houjix": <>
    {/* body */}
    <ellipse cx="16" cy="20" rx="10" ry="7" fill="#5a8fc4" />
    {/* head */}
    <ellipse cx="24" cy="14" rx="6" ry="5" fill="#5a8fc4" />
    {/* wide jaw */}
    <ellipse cx="25" cy="17" rx="5" ry="3" fill="#3a6fa4" />
    {/* eye */}
    <circle cx="26" cy="12" r="1.5" fill="#fff" />
    <circle cx="26.5" cy="12" r="0.8" fill="#111" />
    {/* front legs */}
    <rect x="8" y="24" width="3" height="6" rx="1.5" fill="#4a7fb4" />
    <rect x="14" y="25" width="3" height="5" rx="1.5" fill="#4a7fb4" />
    {/* back legs */}
    <rect x="20" y="25" width="3" height="5" rx="1.5" fill="#4a7fb4" />
    <rect x="25" y="24" width="3" height="6" rx="1.5" fill="#4a7fb4" />
    {/* tail */}
    <path d="M6 20 Q0 18 1 14" stroke="#4a7fb4" strokeWidth="3" fill="none" strokeLinecap="round"/>
    {/* armour ridge */}
    <path d="M10 14 Q16 10 22 14" stroke="#3a6fa4" strokeWidth="2" fill="none"/>
  </>,

  // NG'OK — serpentine horned beast, rearing up, open jaws
  "Ng'ok": <>
    {/* lower coiled body */}
    <ellipse cx="14" cy="26" rx="8" ry="5" fill="#c45a2a" />
    {/* torso rearing up */}
    <ellipse cx="16" cy="17" rx="5" ry="8" fill="#d4622a" />
    {/* neck */}
    <rect x="14" y="8" width="5" height="6" rx="2" fill="#d4622a" />
    {/* head with open jaw */}
    <ellipse cx="18" cy="6" rx="6" ry="5" fill="#c45a2a" />
    <path d="M14 7 Q18 10 22 7" fill="#8B2200" />
    {/* teeth */}
    <line x1="15" y1="7" x2="15" y2="9" stroke="white" strokeWidth="0.8"/>
    <line x1="17" y1="7" x2="17" y2="9.5" stroke="white" strokeWidth="0.8"/>
    <line x1="19" y1="7" x2="19" y2="9" stroke="white" strokeWidth="0.8"/>
    {/* horns */}
    <line x1="14" y1="3" x2="12" y2="0" stroke="#8B2200" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="18" y1="2" x2="20" y2="0" stroke="#8B2200" strokeWidth="1.5" strokeLinecap="round"/>
    {/* ridged spine */}
    <path d="M16 10 Q14 14 15 18" stroke="#8B2200" strokeWidth="1.5" fill="none"/>
    {/* eye */}
    <circle cx="20" cy="5" r="1.5" fill="#ffcc00" />
    <circle cx="20" cy="5" r="0.7" fill="#111" />
    {/* arm reaching forward */}
    <path d="M20 16 Q26 14 28 18" stroke="#c45a2a" strokeWidth="3" fill="none" strokeLinecap="round"/>
  </>,

  // K'LOR'SLUG — scorpion body with humanoid upper torso, claws
  "K'lor'slug": <>
    {/* scorpion abdomen */}
    <ellipse cx="10" cy="22" rx="8" ry="5" fill="#9b6a2a" />
    {/* scorpion tail curling up */}
    <path d="M16 20 Q22 16 24 10 Q26 6 22 4" stroke="#9b6a2a" strokeWidth="4" fill="none" strokeLinecap="round"/>
    {/* stinger */}
    <circle cx="21" cy="3" r="2" fill="#7b4a1a" />
    {/* humanoid torso */}
    <ellipse cx="12" cy="14" rx="5" ry="6" fill="#b07a3a" />
    {/* humanoid head */}
    <circle cx="12" cy="7" r="4" fill="#b07a3a" />
    {/* alien face */}
    <circle cx="10" cy="6" r="1" fill="#ffcc00" />
    <circle cx="14" cy="6" r="1" fill="#ffcc00" />
    {/* mandibles */}
    <path d="M9 9 Q8 11 7 10" stroke="#7b4a1a" strokeWidth="1.2" fill="none"/>
    <path d="M15 9 Q16 11 17 10" stroke="#7b4a1a" strokeWidth="1.2" fill="none"/>
    {/* claw arms */}
    <path d="M8 14 Q3 12 2 16" stroke="#9b6a2a" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <path d="M2 16 Q1 18 3 18" stroke="#7b4a1a" strokeWidth="1.5" fill="none"/>
    <path d="M16 14 Q21 12 22 16" stroke="#9b6a2a" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    {/* legs */}
    <line x1="6" y1="22" x2="4" y2="28" stroke="#7b4a1a" strokeWidth="2"/>
    <line x1="10" y1="24" x2="9" y2="29" stroke="#7b4a1a" strokeWidth="2"/>
    <line x1="14" y1="24" x2="15" y2="29" stroke="#7b4a1a" strokeWidth="2"/>
  </>,

  // MOLATOR — blue-purple multi-armed crab creature
  "Molator": <>
    {/* central body */}
    <ellipse cx="16" cy="18" rx="9" ry="8" fill="#7a45c4" />
    {/* bulbous head */}
    <ellipse cx="16" cy="10" rx="7" ry="6" fill="#8a55d4" />
    {/* eyes — alien compound */}
    <ellipse cx="12" cy="9" rx="2.5" ry="2" fill="#cc88ff" />
    <ellipse cx="20" cy="9" rx="2.5" ry="2" fill="#cc88ff" />
    <ellipse cx="12" cy="9" rx="1.2" ry="1" fill="#330066" />
    <ellipse cx="20" cy="9" rx="1.2" ry="1" fill="#330066" />
    {/* multiple arms */}
    <path d="M8 14 Q2 10 1 6" stroke="#6a35b4" strokeWidth="3" fill="none" strokeLinecap="round"/>
    <path d="M1 6 Q0 4 2 3" stroke="#5a25a4" strokeWidth="2" fill="none"/>
    <path d="M8 18 Q2 18 0 22" stroke="#6a35b4" strokeWidth="3" fill="none" strokeLinecap="round"/>
    <path d="M24 14 Q30 10 31 6" stroke="#6a35b4" strokeWidth="3" fill="none" strokeLinecap="round"/>
    <path d="M31 6 Q32 4 30 3" stroke="#5a25a4" strokeWidth="2" fill="none"/>
    <path d="M24 18 Q30 18 32 22" stroke="#6a35b4" strokeWidth="3" fill="none" strokeLinecap="round"/>
    {/* spiky protrusions */}
    <line x1="12" y1="5" x2="10" y2="1" stroke="#5a25a4" strokeWidth="1.5"/>
    <line x1="16" y1="4" x2="16" y2="0" stroke="#5a25a4" strokeWidth="1.5"/>
    <line x1="20" y1="5" x2="22" y2="1" stroke="#5a25a4" strokeWidth="1.5"/>
    {/* legs */}
    <line x1="10" y1="24" x2="8" y2="30" stroke="#6a35b4" strokeWidth="2.5"/>
    <line x1="16" y1="26" x2="16" y2="31" stroke="#6a35b4" strokeWidth="2.5"/>
    <line x1="22" y1="24" x2="24" y2="30" stroke="#6a35b4" strokeWidth="2.5"/>
  </>,

  // GHHHK — insectoid, compound eyes, antennae, multi-limbed
  "Ghhhk": <>
    {/* abdomen */}
    <ellipse cx="16" cy="23" rx="7" ry="6" fill="#4a8c5a" />
    {/* thorax */}
    <ellipse cx="16" cy="15" rx="6" ry="5" fill="#5a9c6a" />
    {/* head */}
    <ellipse cx="16" cy="8" rx="5" ry="4" fill="#4a8c5a" />
    {/* antennae */}
    <path d="M13 5 Q10 1 8 0" stroke="#3a7c4a" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
    <path d="M19 5 Q22 1 24 0" stroke="#3a7c4a" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
    <circle cx="8" cy="0" r="1.5" fill="#3a7c4a"/>
    <circle cx="24" cy="0" r="1.5" fill="#3a7c4a"/>
    {/* compound eyes */}
    <ellipse cx="12" cy="8" rx="3" ry="2.5" fill="#aaff44" />
    <ellipse cx="20" cy="8" rx="3" ry="2.5" fill="#aaff44" />
    {/* eye facets */}
    <line x1="10" y1="8" x2="14" y2="8" stroke="#336600" strokeWidth="0.5"/>
    <line x1="12" y1="6" x2="12" y2="10" stroke="#336600" strokeWidth="0.5"/>
    <line x1="18" y1="8" x2="22" y2="8" stroke="#336600" strokeWidth="0.5"/>
    <line x1="20" y1="6" x2="20" y2="10" stroke="#336600" strokeWidth="0.5"/>
    {/* 6 legs */}
    <path d="M10 14 Q5 12 3 15" stroke="#3a7c4a" strokeWidth="2" fill="none"/>
    <path d="M10 17 Q4 17 2 20" stroke="#3a7c4a" strokeWidth="2" fill="none"/>
    <path d="M10 20 Q5 22 4 26" stroke="#3a7c4a" strokeWidth="2" fill="none"/>
    <path d="M22 14 Q27 12 29 15" stroke="#3a7c4a" strokeWidth="2" fill="none"/>
    <path d="M22 17 Q28 17 30 20" stroke="#3a7c4a" strokeWidth="2" fill="none"/>
    <path d="M22 20 Q27 22 28 26" stroke="#3a7c4a" strokeWidth="2" fill="none"/>
  </>,

  // MONNOK — skeletal thin creature with twisted staff/weapon
  "Monnok": <>
    {/* staff / weapon */}
    <path d="M6 2 Q8 16 7 28" stroke="#aa8833" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <path d="M4 4 Q6 2 9 5" stroke="#aa8833" strokeWidth="2" fill="none"/>
    <path d="M4 8 Q6 6 9 9" stroke="#aa8833" strokeWidth="1.5" fill="none"/>
    {/* ribbed torso */}
    <ellipse cx="18" cy="18" rx="5" ry="8" fill="#d4c08a" />
    {/* ribs */}
    <line x1="13" y1="15" x2="23" y2="15" stroke="#b8a060" strokeWidth="1"/>
    <line x1="13" y1="18" x2="23" y2="18" stroke="#b8a060" strokeWidth="1"/>
    <line x1="13" y1="21" x2="23" y2="21" stroke="#b8a060" strokeWidth="1"/>
    {/* skull-like head */}
    <ellipse cx="18" cy="8" rx="5" ry="5" fill="#e4d09a" />
    {/* sunken eyes */}
    <ellipse cx="15" cy="7" rx="1.8" ry="2" fill="#222" />
    <ellipse cx="21" cy="7" rx="1.8" ry="2" fill="#222" />
    {/* prominent ear/horn */}
    <path d="M13 5 Q10 2 12 0" stroke="#c4b07a" strokeWidth="2" fill="none" strokeLinecap="round"/>
    <path d="M23 5 Q26 2 24 0" stroke="#c4b07a" strokeWidth="2" fill="none" strokeLinecap="round"/>
    {/* thin arms */}
    <path d="M13 16 Q8 13 7 16" stroke="#c4a070" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <path d="M23 16 Q28 13 29 17" stroke="#c4a070" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    {/* legs */}
    <line x1="15" y1="26" x2="13" y2="31" stroke="#c4a070" strokeWidth="2.5"/>
    <line x1="21" y1="26" x2="23" y2="31" stroke="#c4a070" strokeWidth="2.5"/>
  </>,

  // SAVRIP (MANTELLIAN SAVRIP) — large armoured bipedal reptile
  "Savrip": <>
    {/* massive armoured torso */}
    <ellipse cx="16" cy="18" rx="11" ry="10" fill="#4a6644" />
    {/* armour plate */}
    <path d="M8 12 Q16 8 24 12 Q26 18 24 24 Q16 26 8 24 Q6 18 8 12Z" fill="#3a5534" stroke="#2a4524" strokeWidth="1"/>
    {/* armour belt */}
    <rect x="8" y="21" width="16" height="3" rx="1" fill="#2a3a24" />
    <circle cx="16" cy="22.5" r="1.5" fill="#4a6644"/>
    <circle cx="11" cy="22.5" r="1" fill="#4a6644"/>
    <circle cx="21" cy="22.5" r="1" fill="#4a6644"/>
    {/* bulldog-like head */}
    <ellipse cx="16" cy="7" rx="8" ry="7" fill="#4a6644" />
    {/* snout */}
    <ellipse cx="16" cy="10" rx="5" ry="3" fill="#3a5534" />
    {/* teeth */}
    <line x1="13" y1="11" x2="13" y2="13" stroke="white" strokeWidth="1.2"/>
    <line x1="16" y1="12" x2="16" y2="14" stroke="white" strokeWidth="1.2"/>
    <line x1="19" y1="11" x2="19" y2="13" stroke="white" strokeWidth="1.2"/>
    {/* eyes */}
    <circle cx="11" cy="5" r="2" fill="#886633" />
    <circle cx="11" cy="5" r="1" fill="#111" />
    <circle cx="21" cy="5" r="2" fill="#886633" />
    <circle cx="21" cy="5" r="1" fill="#111" />
    {/* small ear bumps */}
    <ellipse cx="8" cy="3" rx="2" ry="1.5" fill="#3a5534" />
    <ellipse cx="24" cy="3" rx="2" ry="1.5" fill="#3a5534" />
    {/* heavy arms */}
    <path d="M6 16 Q1 18 1 24" stroke="#3a5534" strokeWidth="5" fill="none" strokeLinecap="round"/>
    <path d="M26 16 Q31 18 31 24" stroke="#3a5534" strokeWidth="5" fill="none" strokeLinecap="round"/>
    {/* fists */}
    <circle cx="1" cy="25" r="3" fill="#3a5534"/>
    <circle cx="31" cy="25" r="3" fill="#3a5534"/>
    {/* legs */}
    <rect x="10" y="26" width="5" height="6" rx="2" fill="#3a5534"/>
    <rect x="17" y="26" width="5" height="6" rx="2" fill="#3a5534"/>
  </>,

  // GROND — electric-discharging creature, glowing crackling energy
  "Grond": <>
    {/* body */}
    <ellipse cx="16" cy="18" rx="8" ry="9" fill="#5a8a18" />
    {/* head */}
    <ellipse cx="16" cy="9" rx="6" ry="5" fill="#6a9a28" />
    {/* eyes glowing */}
    <circle cx="13" cy="8" r="2" fill="#ccff00" />
    <circle cx="13" cy="8" r="1" fill="#fff" />
    <circle cx="19" cy="8" r="2" fill="#ccff00" />
    <circle cx="19" cy="8" r="1" fill="#fff" />
    {/* electric discharge — crackling bolts */}
    <path d="M8 14 L4 10 L6 12 L2 8" stroke="#ccff00" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.9"/>
    <path d="M24 14 L28 10 L26 12 L30 8" stroke="#ccff00" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.9"/>
    <path d="M16 4 L14 0 L16 2 L15 -1" stroke="#ccff00" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.8"/>
    {/* electric aura glow */}
    <ellipse cx="16" cy="16" rx="10" ry="11" fill="none" stroke="#88ff00" strokeWidth="1" opacity="0.4" strokeDasharray="2 3"/>
    {/* arms with sparks at tips */}
    <path d="M8 16 Q3 14 2 18" stroke="#5a8a18" strokeWidth="3" fill="none" strokeLinecap="round"/>
    <circle cx="2" cy="18" r="2" fill="#ccff00" opacity="0.8"/>
    <path d="M24 16 Q29 14 30 18" stroke="#5a8a18" strokeWidth="3" fill="none" strokeLinecap="round"/>
    <circle cx="30" cy="18" r="2" fill="#ccff00" opacity="0.8"/>
    {/* legs */}
    <rect x="11" y="25" width="4" height="6" rx="2" fill="#4a7a18"/>
    <rect x="17" y="25" width="4" height="6" rx="2" fill="#4a7a18"/>
  </>,
};



// ═══════════════════════════════════════════════════════════════
// COMBAT ENGINE
// ═══════════════════════════════════════════════════════════════
const zoneAtkBonus = (space) => {
  const z = zoneOf(space);
  if (z === "inner") return 2;
  if (z === "outer") return -1;
  return 0;
};

const isAlone = (creature, pieces) => {
  const adj = adjacentSpaces(creature.position);
  return !adj.some(s => pieces.find(p => p.team === creature.team && p.position === s && p.alive));
};

const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

const resolveCombat = (attacker, defender, pieces) => {
  const log = [];
  let atkHp = attacker.hp, defHp = defender.hp;
  const atkData = CREATURES[attacker.name], defData = CREATURES[defender.name];

  let atkPow = atkData.attack + zoneAtkBonus(attacker.position);
  if (attacker.name === "Grond" && isAlone(attacker, pieces)) { atkPow += 2; log.push("🐺 Grond Lone Wolf: +2 ATK"); }
  if (defender.name === "Savrip" && atkPow <= 3) { log.push("🗿 Savrip deflects the weak attack!"); return { winnerId: defender.id, loserId: attacker.id, log }; }

  let dodgePending = defender.name === "Ghhhk" && Math.random() < 0.40;
  if (dodgePending) log.push("🕷️ Ghhhk DODGES the first strike!");

  let stun = 0;

  for (let round = 1; round <= 20 && atkHp > 0 && defHp > 0; round++) {
    // Attacker hits
    if (!dodgePending) {
      const chargeBonus = attacker.name === "Ng'ok" && round === 1 ? 3 : 0;
      if (chargeBonus) log.push("🦣 Ng'ok Charge: +3 ATK this round!");
      let dmg = Math.max(1, atkPow + chargeBonus - Math.floor(defData.defense / 2) + rnd(-1, 2));
      if (defender.name === "Houjix") { dmg = Math.max(0, dmg - 3); log.push("🛡️ Houjix absorbs 3 dmg"); }
      defHp -= dmg;
      log.push(`Rnd ${round}: ${attacker.name} → ${defender.name}  −${dmg} HP  (${Math.max(0, defHp)} left)`);
      if (attacker.name === "Molator" && round === 1) { stun = 1; log.push("👊 Molator STUNS — defender skips counterattack!"); }
    } else { dodgePending = false; }

    if (defHp <= 0) break;

    // Defender counter-hits
    if (stun > 0) { stun--; continue; }
    let defPow = defData.attack + zoneAtkBonus(defender.position);
    if (defender.name === "Grond" && isAlone(defender, pieces)) defPow += 2;
    let dmg2 = Math.max(1, defPow - Math.floor(atkData.defense / 2) + rnd(-1, 2));
    if (attacker.name === "Houjix") dmg2 = Math.max(0, dmg2 - 3);
    const monnok = defender.name === "Monnok" && Math.random() < 0.30;
    if (monnok) { const b = Math.floor(defPow / 2); dmg2 += b; log.push(`⚔️ Monnok Counter: +${b} bonus!`); }
    atkHp -= dmg2;
    log.push(`Rnd ${round}: ${defender.name} ↩ ${attacker.name}  −${dmg2} HP  (${Math.max(0, atkHp)} left)`);
  }

  const atkWins = atkHp > 0;
  log.push(`💀 ${atkWins ? defender.name : attacker.name} collapses and vanishes!`);
  log.push(`🏆 ${atkWins ? attacker.name : defender.name} stands victorious!`);
  return {
    winnerId: atkWins ? attacker.id : defender.id,
    loserId:  atkWins ? defender.id : attacker.id,
    winnerHp: Math.max(1, atkWins ? atkHp : defHp),
    log,
  };
};

// ═══════════════════════════════════════════════════════════════
// AI (Wookiee difficulty)
// ═══════════════════════════════════════════════════════════════
// ── Easy AI ──────────────────────────────────────────────────
// Picks a random valid move. Prefers attacking an enemy with 50% probability.
// Simple and reliable — no complex scoring that could produce edge-case stalls.
const aiChooseMove = (darkPieces, lightPieces, allPieces) => {
  const alive = darkPieces.filter(p => p.alive && p.position !== null);
  if (!alive.length) return null;

  const allMoves = [];
  const attackMoves = [];

  for (const piece of alive) {
    const reach = reachableSpaces(piece.position, CREATURES[piece.name].moveRange);
    for (const dest of reach) {
      const occupant = allPieces.find(p => p.position === dest && p.alive);
      if (occupant && occupant.team === "dark") continue;
      const move = { piece, dest };
      allMoves.push(move);
      if (occupant && occupant.team === "light") attackMoves.push(move);
    }
  }

  if (!allMoves.length) return null;

  // 50% chance to attack if possible, otherwise move randomly
  if (attackMoves.length && Math.random() < 0.5) {
    return attackMoves[Math.floor(Math.random() * attackMoves.length)];
  }
  return allMoves[Math.floor(Math.random() * allMoves.length)];
};
// ═══════════════════════════════════════════════════════════════
// INITIAL GAME STATE
// ═══════════════════════════════════════════════════════════════
let _id = 0;
const mkPiece = (name, team, pos) => ({ id: _id++, name, team, position: pos, alive: true, hp: CREATURES[name].maxHp });

const initPieces = () => [
  ...Object.entries(STARTING_POSITIONS.light).map(([n, p]) => mkPiece(n, "light", p)),
  ...Object.entries(STARTING_POSITIONS.dark).map(([n, p]) => mkPiece(n, "dark", p)),
];

// ═══════════════════════════════════════════════════════════════
// BOARD COORDINATES (polar → cartesian for rendering)
// ═══════════════════════════════════════════════════════════════
const RING_RADII = [0.74, 0.48, 0.22];  // as fraction of board radius

const spaceCoords = (space, cx, cy, R) => {
  const ring = ringOf(space), sector = sectOf(space);
  const angle = (sector / 8) * 2 * Math.PI - Math.PI / 2 + (Math.PI / 8);
  const r = RING_RADII[ring] * R;
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function DejarikGame() {
  const [pieces, setPieces]           = useState(initPieces);
  const [selected, setSelected]       = useState(null);      // piece id
  const [validMoves, setValidMoves]   = useState([]);
  const [activeTeam, setActiveTeam]   = useState("light");
  const [mode, setMode]               = useState("menu");    // menu | pvp | pve
  const [phase, setPhase]             = useState("select");  // select | move | combat | over
  const [combatLog, setCombatLog]     = useState([]);
  const [showLog, setShowLog]         = useState(false);
  const [winner, setWinner]           = useState(null);
  const [statusMsg, setStatusMsg]     = useState("");
  const [bonusTurn, setBonusTurn]     = useState(false);
  const [stunned, setStunned]         = useState({});        // pieceId → turns
  const [animSpace, setAnimSpace]     = useState(null);
  // aiThinkingRef removed — AI flow handled by effect dependencies only

  const boardSize   = 420;
  const cx          = boardSize / 2;
  const cy          = boardSize / 2;
  const R           = boardSize / 2 - 24;
  const cellR       = 22;

  // ── helpers ────────────────────────────────────────────────
  const pieceAt   = useCallback((space, ps = pieces) => ps.find(p => p.position === space && p.alive) || null, [pieces]);
  const aliveOf   = (team, ps = pieces) => ps.filter(p => p.team === team && p.alive);
  // checkWin: always pass the fresh ps array — never relies on stale closure
  // Returns winning team only when the ENTIRE enemy roster is eliminated (all 8 dead)
  const checkWin  = (ps) => {
    const lightAlive = ps.filter(p => p.team === "light" && p.alive).length;
    const darkAlive  = ps.filter(p => p.team === "dark"  && p.alive).length;
    if (lightAlive === 0) return "dark";
    if (darkAlive  === 0) return "light";
    return null;  // game continues — creatures still standing on both sides
  };

  const endTurn = (ps, nextTeam, log = []) => {
    const w = checkWin(ps);
    if (w) { setWinner(w); setPhase("over"); setStatusMsg(`${w === "light" ? "☀️ Light Side" : "🌑 Dark Side"} WINS!`); return; }
    setActiveTeam(nextTeam);
    setSelected(null);
    setValidMoves([]);
    setPhase("select");
    setStatusMsg(nextTeam === "light" ? "☀️ Light Side — choose your piece" : "🌑 Dark Side — choose your piece");
    if (log.length) { setCombatLog(prev => [...prev, ...log]); setShowLog(true); }
  };

  // ── piece selection ────────────────────────────────────────
  const selectPiece = (piece) => {
    if (phase !== "select") return;
    if (piece.team !== activeTeam) return;
    setSelected(piece.id);
    const reach = reachableSpaces(piece.position, CREATURES[piece.name].moveRange);
    const legal = reach.filter(s => { const occ = pieceAt(s); return !occ || occ.team !== piece.team; });
    setValidMoves(legal);
    setStatusMsg(`${piece.emoji || CREATURES[piece.name].emoji} ${piece.name} selected — choose destination`);
  };

  // ── execute move ────────────────────────────────────────────
  const executeMove = useCallback((pieceId, dest, currentPieces, currentActiveTeam) => {
    const ps = currentPieces.map(p => ({ ...p }));
    const piece = ps.find(p => p.id === pieceId);
    if (!piece || !piece.alive) return;

    piece.position = dest;
    setAnimSpace(dest);
    setTimeout(() => setAnimSpace(null), 600);

    const occupant = ps.find(p => p.id !== piece.id && p.position === dest && p.alive);

    if (occupant) {
      // COMBAT
      const result = resolveCombat(piece, occupant, ps);
      const loser = ps.find(p => p.id === result.loserId);
      const winner = ps.find(p => p.id === result.winnerId);
      loser.alive    = false;
      loser.position = null;
      loser.hp       = 0;
      winner.hp      = result.winnerHp ?? Math.max(1, winner.hp);
      winner.position = dest;

      // Stun from Molator
      if (piece.name === "Molator" && result.winnerId === piece.id) {
        setStunned(prev => ({ ...prev, [occupant.id]: 1 }));
      }

      setPieces(ps);
      setCombatLog(prev => [...prev, "── COMBAT ──", ...result.log]);
      setShowLog(true);

      // Check win ONLY after updating — game ends when ALL 8 enemy pieces are gone
      const newWinner = checkWin(ps);
      if (newWinner) {
        setWinner(newWinner);
        setPhase("over");
        setStatusMsg(`${newWinner === "light" ? "☀️ Light Side" : "🌑 Dark Side"} WINS — all enemy creatures eliminated!`);
        return;
      }

      // Bonus move: only grant to human player (light side)
      // AI (dark) always ends turn immediately after combat to avoid effect stall
      if (winner.team === currentActiveTeam && currentActiveTeam === "light") {
        setBonusTurn(true);
        setSelected(null);
        setValidMoves([]);
        setPhase("select");
        const remaining = ps.filter(p => p.team !== currentActiveTeam && p.alive).length;
        setStatusMsg(`🎯 ${winner.name} wins! BONUS MOVE — ${remaining} enemy creature${remaining!==1?"s":""} remain`);
      } else {
        // AI won combat OR defender won — always end turn and switch sides
        const next = currentActiveTeam === "light" ? "dark" : "light";
        endTurn(ps, next, []);
      }
    } else {
      // Simple move, no combat
      setPieces(ps);
      const next = currentActiveTeam === "light" ? "dark" : "light";
      endTurn(ps, next);
    }
  // eslint-disable-next-line
  }, []);

  // ── handle space click ─────────────────────────────────────
  const handleSpaceClick = (space) => {
    if (phase === "over") return;
    if (mode === "pve" && activeTeam === "dark") return;

    const occ = pieceAt(space);

    if (selected === null) {
      if (occ && occ.team === activeTeam) selectPiece(occ);
      return;
    }

    // Deselect if clicking same piece
    const sel = pieces.find(p => p.id === selected);
    if (occ && occ.id === selected) { setSelected(null); setValidMoves([]); setStatusMsg(""); return; }

    // Re-select own piece
    if (occ && occ.team === activeTeam && occ.id !== selected) { selectPiece(occ); return; }

    if (validMoves.includes(space)) {
      setPhase("move");
      executeMove(selected, space, pieces, activeTeam);
      setBonusTurn(false);
    }
  };

  // ── AI turn ────────────────────────────────────────────────
  // Single flat effect — no nested timeouts, no ref guards.
  // Fires whenever activeTeam=dark AND phase=select AND pieces state changes.
  // The pieces fingerprint ensures it re-fires after every combat (kill or bonus turn).
  useEffect(() => {
    if (mode !== "pve") return;
    if (activeTeam !== "dark") return;
    if (phase !== "select") return;
    if (winner) return;

    // Snapshot piece state at effect-fire time
    const currentPieces = pieces;
    const dark  = currentPieces.filter(p => p.team === "dark"  && p.alive);
    const light = currentPieces.filter(p => p.team === "light" && p.alive);

    setStatusMsg("🤖 Wookiee AI is calculating…");

    const timer = setTimeout(() => {
      const move = aiChooseMove(dark, light, currentPieces);

      if (!move) {
        // No valid move — hand turn to light
        setActiveTeam("light");
        setPhase("select");
        setSelected(null);
        setValidMoves([]);
        setStatusMsg("☀️ Light Side — choose your piece");
        return;
      }

      // Execute move immediately — executeMove handles setPieces + endTurn/bonus internally
      setSelected(move.piece.id);
      executeMove(move.piece.id, move.dest, currentPieces, "dark");
      setSelected(null);
      setValidMoves([]);
    }, 900);

    return () => clearTimeout(timer);
  // pieces fingerprint: re-fire after every kill or move (alive count + hp sum)
  // eslint-disable-next-line
  }, [activeTeam, phase, mode, winner,
      pieces.filter(p=>p.alive).length,
      pieces.reduce((a,p)=>a+p.hp,0)]);

  // ── restart ────────────────────────────────────────────────
  const restart = (m) => {
    _id = 0;
    setPieces(initPieces());
    setSelected(null); setValidMoves([]); setActiveTeam("light");
    setPhase("select"); setCombatLog([]); setShowLog(false); setWinner(null);
    setStunned({}); setBonusTurn(false);
    setMode(m);
    setStatusMsg("☀️ Light Side — choose your piece");
  };

  // ── render board spaces ────────────────────────────────────
  const renderBoard = () => {
    const cells = [];
    for (let s = 1; s <= 24; s++) {
      const { x, y } = spaceCoords(s, cx, cy, R);
      const occ = pieceAt(s);
      const isValid   = validMoves.includes(s);
      const isSelected = occ && occ.id === selected;
      const zone = zoneOf(s);
      const zoneColors = { outer:"#0a1628", middle:"#0d1f3c", inner:"#111b3a" };
      const zoneBorders = { outer:"#1e3a5f", middle:"#234466", inner:"#7b2d8b" };

      cells.push(
        <g key={s} onClick={() => handleSpaceClick(s)} style={{ cursor: "pointer" }}>
          {/* glow for valid moves */}
          {isValid && (
            <circle cx={x} cy={y} r={cellR + 6}
              fill="none" stroke="#00ffcc" strokeWidth="2" opacity="0.6"
              style={{ animation: "pulse 1s ease-in-out infinite alternate" }} />
          )}
          {/* cell background */}
          <circle cx={x} cy={y} r={cellR}
            fill={isSelected ? "#1a3a5c" : animSpace === s ? "#1a4a3a" : zoneColors[zone]}
            stroke={isSelected ? "#00e5ff" : isValid ? "#00ffcc" : zoneBorders[zone]}
            strokeWidth={isSelected || isValid ? 2 : 1}
            opacity={0.92}
          />
          {/* space number */}
          <text x={x} y={y - 8} textAnchor="middle" fontSize="8" fill="#4a7fa5" fontFamily="monospace">{s}</text>
          {/* piece — SVG portrait */}
          {occ && (
            <>
              <foreignObject x={x - 14} y={y - 16} width={28} height={28}>
                <div xmlns="http://www.w3.org/1999/xhtml">
                  <CreatureSVG name={occ.name} size={28} team={occ.team} />
                </div>
              </foreignObject>
              {/* HP bar */}
              <rect x={x - 12} y={y + 14} width={24} height={3} rx={1} fill="#1a1a2e" />
              <rect x={x - 12} y={y + 14}
                width={Math.max(0, 24 * (occ.hp / CREATURES[occ.name].maxHp))} height={3} rx={1}
                fill={occ.team === "light" ? "#00e5ff" : "#ff4444"} />
              {/* team dot */}
              <circle cx={x + 13} cy={y - 13} r={4}
                fill={occ.team === "light" ? "#00e5ff" : "#ff4444"}
                stroke="#000" strokeWidth={0.5} />
            </>
          )}
        </g>
      );
    }
    return cells;
  };

  // ── radial sector dividers ─────────────────────────────────
  const renderGrid = () => {
    const lines = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * 2 * Math.PI - Math.PI / 2;
      const inner = (RING_RADII[2] - 0.06) * R;
      const outer = (RING_RADII[0] + 0.08) * R;
      lines.push(
        <line key={i}
          x1={cx + inner * Math.cos(angle)} y1={cy + inner * Math.sin(angle)}
          x2={cx + outer * Math.cos(angle)} y2={cy + outer * Math.sin(angle)}
          stroke="#1e3a5f" strokeWidth="1" opacity="0.5" />
      );
    }
    for (const fr of RING_RADII) {
      lines.push(
        <circle key={fr} cx={cx} cy={cy} r={fr * R}
          fill="none" stroke="#1e3a5f" strokeWidth="1" opacity="0.4" strokeDasharray="4 4" />
      );
    }
    return lines;
  };

  // ── piece list sidebar ─────────────────────────────────────
  const PieceList = ({ team }) => {
    const alive = aliveOf(team);
    const dead  = pieces.filter(p => p.team === team && !p.alive);
    const isActive = activeTeam === team;
    return (
      <div style={{ flex: 1, minWidth: 160, maxWidth: 200 }}>
        <div style={{
          padding: "8px 12px", marginBottom: 8,
          background: isActive ? (team === "light" ? "rgba(0,229,255,0.15)" : "rgba(255,68,68,0.15)") : "rgba(255,255,255,0.03)",
          border: `1px solid ${isActive ? (team==="light"?"#00e5ff":"#ff4444") : "#1e3a5f"}`,
          borderRadius: 8, fontFamily:"'Orbitron', monospace", fontSize:11,
          color: team === "light" ? "#00e5ff" : "#ff6b6b",
          textTransform:"uppercase", letterSpacing:1,
        }}>
          {team === "light" ? "☀️ Light Side" : "🌑 Dark Side"} {isActive ? "▶" : ""}
        </div>
        {alive.map(p => (
          <div key={p.id}
            onClick={() => { if (p.team === activeTeam) selectPiece(p); }}
            style={{
              display:"flex", alignItems:"center", gap:6,
              padding:"5px 8px", marginBottom:3, borderRadius:6, cursor:"pointer",
              background: selected === p.id ? "rgba(0,229,255,0.12)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${selected===p.id ? "#00e5ff" : "#1e2a4a"}`,
              transition:"all 0.15s",
            }}>
            <CreatureSVG name={p.name} size={28} team={p.team} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:10, color:"#c0d8f0", fontFamily:"monospace", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{p.name}</div>
              <div style={{ height:3, background:"#1a1a2e", borderRadius:2, marginTop:2 }}>
                <div style={{ height:"100%", width:`${(p.hp/CREATURES[p.name].maxHp)*100}%`, background:CREATURES[p.name].color, borderRadius:2 }} />
              </div>
              <div style={{ fontSize:9, color:"#4a7fa5", fontFamily:"monospace" }}>{p.hp}/{CREATURES[p.name].maxHp} HP · S{p.position}</div>
            </div>
          </div>
        ))}
        {dead.length > 0 && (
          <div style={{ marginTop:8, fontSize:9, color:"#4a4a6a", fontFamily:"monospace" }}>
            💀 {dead.map(p => p.name).join(", ")}
          </div>
        )}
      </div>
    );
  };

  // ── MENU SCREEN ────────────────────────────────────────────
  if (mode === "menu") return (
    <div style={{
      minHeight:"100vh", background:"#050a14",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      fontFamily:"monospace", color:"#c0d8f0",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');
        @keyframes pulse { from { opacity:0.4; r:26px } to { opacity:1; r:30px } }
        @keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
        @keyframes flicker { 0%,95%{opacity:1} 96%{opacity:0.8} 100%{opacity:1} }
        @keyframes glow { 0%,100%{text-shadow:0 0 10px #00e5ff,0 0 20px #00e5ff} 50%{text-shadow:0 0 20px #00e5ff,0 0 40px #7b2fff,0 0 60px #00e5ff} }
      `}</style>
      <div style={{ position:"absolute", inset:0, overflow:"hidden", pointerEvents:"none" }}>
        <div style={{ position:"absolute", width:"100%", height:2, background:"rgba(0,229,255,0.04)", animation:"scanline 4s linear infinite" }} />
      </div>
      <div style={{ textAlign:"center", animation:"flicker 8s ease-in-out infinite" }}>
        <div style={{ fontFamily:"'Orbitron',monospace", fontSize:42, fontWeight:900, color:"#00e5ff", animation:"glow 3s ease-in-out infinite", marginBottom:8 }}>
          DEJARIK
        </div>
        <div style={{ fontSize:12, color:"#4a8fbf", letterSpacing:4, marginBottom:4 }}>HOLOGRAPHIC STRATEGY COMBAT</div>
        <div style={{ fontSize:10, color:"#2a5f7f", letterSpacing:2, marginBottom:48 }}>MILLENNIUM FALCON · YT-1300 FREIGHTER · LOUNGE DECK</div>

        <div style={{ display:"flex", gap:20, justifyContent:"center", marginBottom:40 }}>
          {[["pvp","⚔️ PLAYER vs PLAYER","Two humans face off"],["pve","🤖 vs WOOKIEE AI","Challenge the Chewbacca AI"]].map(([m, label, sub]) => (
            <button key={m} onClick={() => restart(m)} style={{
              padding:"18px 32px", background:"rgba(0,229,255,0.07)",
              border:"1px solid #00e5ff", borderRadius:8, color:"#00e5ff",
              fontFamily:"'Orbitron',monospace", fontSize:13, cursor:"pointer",
              transition:"all 0.2s", letterSpacing:1,
            }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(0,229,255,0.18)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(0,229,255,0.07)"}>
              <div>{label}</div>
              <div style={{ fontSize:9, color:"#4a8fbf", marginTop:4 }}>{sub}</div>
            </button>
          ))}
        </div>

        <div style={{ fontSize:10, color:"#2a4a6a", maxWidth:480, lineHeight:1.8, letterSpacing:0.5 }}>
          <div style={{ color:"#4a7fa5", marginBottom:8 }}>QUICK RULES</div>
          Circular board · 24 spaces · 3 rings · 8 pieces per side<br/>
          Enter an enemy's space to trigger combat · Winner gets a bonus move<br/>
          Outer Ring: defensive advantage · Inner Ring: +2 ATK bonus<br/>
          Eliminate all enemy creatures to win
        </div>
      </div>
    </div>
  );

  // ── GAME SCREEN ────────────────────────────────────────────
  return (
    <div style={{
      minHeight:"100vh", background:"#050a14", color:"#c0d8f0",
      display:"flex", flexDirection:"column", alignItems:"center",
      padding:"16px 8px", fontFamily:"monospace",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');
        @keyframes pulse { from { opacity:0.5 } to { opacity:1 } }
        @keyframes glow { 0%,100%{box-shadow:0 0 8px #00e5ff44} 50%{box-shadow:0 0 20px #00e5ff88} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:20, marginBottom:12, width:"100%", maxWidth:820, justifyContent:"space-between" }}>
        <div style={{ fontFamily:"'Orbitron',monospace", fontSize:20, fontWeight:700, color:"#00e5ff", letterSpacing:2 }}>DEJARIK</div>
        <div style={{ fontSize:10, color:"#4a7fa5", textAlign:"center" }}>
          {mode === "pve" ? "vs WOOKIEE AI" : "PLAYER vs PLAYER"} · Turn {Math.floor(pieces.filter(p=>!p.alive).length / 2) + 1}
        </div>
        <button onClick={() => setMode("menu")} style={{
          padding:"4px 14px", background:"transparent", border:"1px solid #1e3a5f",
          borderRadius:4, color:"#4a7fa5", cursor:"pointer", fontSize:10, fontFamily:"monospace",
        }}>MENU</button>
      </div>

      {/* Status bar */}
      <div style={{
        width:"100%", maxWidth:820, padding:"8px 16px", marginBottom:12,
        background: winner ? "rgba(255,215,0,0.1)" : activeTeam==="light" ? "rgba(0,229,255,0.07)" : "rgba(255,68,68,0.07)",
        border:`1px solid ${winner?"#ffd700":activeTeam==="light"?"#00e5ff":"#ff4444"}`,
        borderRadius:6, fontSize:11, textAlign:"center", fontFamily:"'Orbitron',monospace",
        color: winner?"#ffd700":activeTeam==="light"?"#00e5ff":"#ff6b6b",
        letterSpacing:1, animation:"glow 2s ease-in-out infinite",
      }}>
        {winner ? `🏆 ${winner.toUpperCase() === "LIGHT" ? "☀️ LIGHT SIDE" : "🌑 DARK SIDE"} WINS! — ${statusMsg}` : statusMsg || "Select a piece"}
      </div>

      {/* Main layout */}
      <div style={{ display:"flex", gap:16, alignItems:"flex-start", flexWrap:"wrap", justifyContent:"center", width:"100%", maxWidth:820 }}>

        {/* Light side pieces */}
        <PieceList team="light" />

        {/* Board */}
        <div style={{ position:"relative" }}>
          <svg width={boardSize} height={boardSize} style={{ borderRadius:"50%", border:"2px solid #1e3a5f", background:"radial-gradient(circle at 50% 50%, #0a1628 0%, #050a14 70%)" }}>
            {/* decorative outer ring */}
            <circle cx={cx} cy={cy} r={R + 18} fill="none" stroke="#1e3a5f" strokeWidth="16" opacity="0.5" />
            <circle cx={cx} cy={cy} r={R + 18} fill="none" stroke="#00e5ff" strokeWidth="1" opacity="0.3" />
            {/* control panel dots */}
            {Array.from({length:24}, (_,i) => {
              const angle = (i/24)*2*Math.PI;
              const r2 = R + 18;
              return <circle key={i} cx={cx+r2*Math.cos(angle)} cy={cy+r2*Math.sin(angle)} r={3} fill="#00e5ff" opacity="0.5" />;
            })}
            {renderGrid()}
            {renderBoard()}
            {/* center glyph */}
            <circle cx={cx} cy={cy} r={12} fill="#0a1628" stroke="#7b2d8b" strokeWidth="1" />
            <text x={cx} y={cy+5} textAnchor="middle" fontSize="14" fill="#7b2d8b">✦</text>
          </svg>

          {/* Zone legend */}
          <div style={{ display:"flex", gap:12, justifyContent:"center", marginTop:8, fontSize:9, color:"#4a7fa5" }}>
            {[["outer","OUTER – DEF +1","#1e3a5f"],["middle","MIDDLE – NEUTRAL","#234466"],["inner","INNER – ATK +2","#7b2d8b"]].map(([z,l,c]) => (
              <div key={z} style={{ display:"flex", alignItems:"center", gap:4 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:c }} />{l}
              </div>
            ))}
          </div>
        </div>

        {/* Dark side pieces */}
        <PieceList team="dark" />
      </div>

      {/* Selected piece info */}
      {selected !== null && (() => {
        const sel = pieces.find(p => p.id === selected);
        if (!sel) return null;
        return (
          <div style={{
            marginTop:12, padding:"10px 18px", width:"100%", maxWidth:820,
            background:"rgba(0,229,255,0.05)", border:"1px solid #1e3a5f", borderRadius:6,
            fontSize:10, color:"#a0c4e0", animation:"fadeIn 0.2s ease-out",
            display:"flex", alignItems:"center", gap:10,
          }}>
            <CreatureSVG name={sel.name} size={36} team={sel.team} />
            <div>
              <span style={{ color:CREATURES[sel.name].color, fontFamily:"'Orbitron',monospace" }}>
                {sel.name}
              </span>
              &nbsp;&nbsp;ATK: {CREATURES[sel.name].attack}  DEF: {CREATURES[sel.name].defense}  HP: {sel.hp}/{CREATURES[sel.name].maxHp}
              &nbsp;&nbsp;<span style={{ color:"#7b2d8b" }}>✦ {CREATURES[sel.name].special}</span>
              &nbsp;&nbsp;<span style={{ color:"#4a7fa5" }}>Valid moves: {validMoves.join(", ") || "none"}</span>
            </div>
          </div>
        );
      })()}

      {/* Winner screen */}
      {winner && (
        <div style={{ marginTop:16, textAlign:"center" }}>
          <div style={{ fontFamily:"'Orbitron',monospace", fontSize:28, color:"#ffd700", marginBottom:12 }}>
            {winner === "light" ? "☀️ LIGHT SIDE WINS" : "🌑 DARK SIDE WINS"}
          </div>
          <button onClick={() => restart(mode)} style={{
            padding:"10px 28px", background:"rgba(0,229,255,0.1)", border:"1px solid #00e5ff",
            borderRadius:6, color:"#00e5ff", fontFamily:"'Orbitron',monospace", cursor:"pointer", fontSize:12,
          }}>PLAY AGAIN</button>
        </div>
      )}

      {/* Combat log toggle */}
      <div style={{ marginTop:12, width:"100%", maxWidth:820 }}>
        <button onClick={() => setShowLog(p => !p)} style={{
          padding:"5px 14px", background:"transparent", border:"1px solid #1e3a5f",
          borderRadius:4, color:"#4a7fa5", cursor:"pointer", fontSize:9, fontFamily:"monospace", letterSpacing:1,
        }}>
          {showLog ? "▲ HIDE" : "▼ SHOW"} COMBAT LOG ({combatLog.length} entries)
        </button>
        {showLog && (
          <div style={{
            marginTop:6, padding:"10px 14px", background:"rgba(0,0,0,0.4)", border:"1px solid #1e3a5f",
            borderRadius:6, maxHeight:180, overflowY:"auto", fontSize:10, fontFamily:"monospace",
            color:"#6a9fbf", lineHeight:1.7,
          }}>
            {combatLog.length === 0 ? "No combat yet." : [...combatLog].reverse().map((l, i) => (
              <div key={i} style={{ color: l.startsWith("🏆") ? "#ffd700" : l.startsWith("💀") ? "#ff6b6b" : "#6a9fbf" }}>{l}</div>
            ))}
          </div>
        )}
      </div>

      {/* Creature reference */}
      <div style={{ marginTop:16, width:"100%", maxWidth:820 }}>
        <div style={{ fontSize:9, color:"#2a4a6a", marginBottom:6, fontFamily:"'Orbitron',monospace", letterSpacing:1 }}>CREATURE REFERENCE</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(170px, 1fr))", gap:6 }}>
          {NAMES.map(name => {
            const d = CREATURES[name];
            return (
              <div key={name} style={{
                padding:"8px 10px", background:"rgba(255,255,255,0.02)", border:`1px solid ${d.color}33`,
                borderRadius:6, fontSize:9, display:"flex", gap:8, alignItems:"flex-start",
              }}>
                <CreatureSVG name={name} size={40} team="light" />
                <div>
                  <div style={{ color:d.color, fontFamily:"monospace", marginBottom:2 }}>{name}</div>
                  <div style={{ color:"#4a7fa5" }}>ATK:{d.attack} DEF:{d.defense} HP:{d.maxHp} MVR:{d.moveRange}</div>
                  <div style={{ color:"#2a5a7a", marginTop:2 }}>{d.special}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
