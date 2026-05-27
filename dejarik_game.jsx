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
const aiChooseMove = (darkPieces, lightPieces, allPieces) => {
  const alive = darkPieces.filter(p => p.alive && p.position !== null);
  let best = null, bestScore = -9999;

  for (const piece of alive) {
    const reach = reachableSpaces(piece.position, CREATURES[piece.name].moveRange);
    for (const dest of reach) {
      const occupant = allPieces.find(p => p.position === dest && p.alive);
      if (occupant && occupant.team === "dark") continue;
      let score = 0;
      if (occupant) {
        const wp = CREATURES[piece.name].attack + zoneAtkBonus(dest);
        const winP = wp / (wp + CREATURES[occupant.name].defense);
        score += 100 * winP * (1 - occupant.hp / CREATURES[occupant.name].maxHp + 0.1);
      }
      const dr = ringOf(dest);
      if (["Ng'ok","Molator","Ghhhk"].includes(piece.name)) score += dr * 12;
      if (["Houjix","Savrip"].includes(piece.name)) score -= dr * 6;
      for (const ep of lightPieces.filter(p => p.alive)) {
        const dist = Math.abs(ringOf(dest) - ringOf(ep.position)) +
          Math.min(Math.abs(sectOf(dest) - sectOf(ep.position)), 8 - Math.abs(sectOf(dest) - sectOf(ep.position)));
        score += Math.max(0, 5 - dist);
      }
      if (score > bestScore) { bestScore = score; best = { piece, dest }; }
    }
  }
  return best;
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

      // Bonus move: combat winner gets another turn if on the active team
      if (winner.team === currentActiveTeam) {
        setBonusTurn(true);
        setSelected(null);
        setValidMoves([]);
        setPhase("select");
        const remaining = ps.filter(p => p.team !== currentActiveTeam && p.alive).length;
        setStatusMsg(`🎯 ${winner.name} wins! BONUS MOVE — ${remaining} enemy creature${remaining!==1?"s":""} remain`);
      } else {
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
          {/* piece */}
          {occ && (
            <>
              <text x={x} y={y + 6} textAnchor="middle" fontSize="16"
                style={{ filter: `drop-shadow(0 0 6px ${CREATURES[occ.name].color})` }}>
                {CREATURES[occ.name].emoji}
              </text>
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
            <span style={{ fontSize:14 }}>{CREATURES[p.name].emoji}</span>
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
          }}>
            <span style={{ color:CREATURES[sel.name].color, fontFamily:"'Orbitron',monospace" }}>
              {CREATURES[sel.name].emoji} {sel.name}
            </span>
            &nbsp;&nbsp;ATK: {CREATURES[sel.name].attack}  DEF: {CREATURES[sel.name].defense}  HP: {sel.hp}/{CREATURES[sel.name].maxHp}
            &nbsp;&nbsp;<span style={{ color:"#7b2d8b" }}>✦ {CREATURES[sel.name].special}</span>
            &nbsp;&nbsp;<span style={{ color:"#4a7fa5" }}>Valid moves: {validMoves.join(", ") || "none"}</span>
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
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(160px, 1fr))", gap:6 }}>
          {NAMES.map(name => {
            const d = CREATURES[name];
            return (
              <div key={name} style={{
                padding:"6px 10px", background:"rgba(255,255,255,0.02)", border:`1px solid ${d.color}33`,
                borderRadius:6, fontSize:9,
              }}>
                <div style={{ color:d.color, fontFamily:"monospace", marginBottom:2 }}>{d.emoji} {name}</div>
                <div style={{ color:"#4a7fa5" }}>ATK:{d.attack} DEF:{d.defense} HP:{d.maxHp} MVR:{d.moveRange}</div>
                <div style={{ color:"#2a5a7a", marginTop:2 }}>{d.special}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
