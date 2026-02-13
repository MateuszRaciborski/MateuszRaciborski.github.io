// js/ai/attackers.js — stabilny, niezawodny ruch czerwonych

import { draw } from "../rendering.js";
import { getAdjacentSectors } from "../sectors.js";
import { canEnterCell } from "../rules.js";
import { enumerateSectorCells } from "../sectors.js";
import { ATTACKER_START_SECTORS, FLAG_CELLS } from "../constants.js";
import { isCellFree } from "../ui.js";




// --- helpery sektorowe ---
function sectorIdAt(game, x, y){
  const sid = game.cellToSector.get(`${x}-${y}`);
  return typeof sid === 'string' ? parseInt(sid, 10) : sid;
}

// --- Stała trasa sektorów do flagi (waypointy) ---
const FLAG_ROUTE = [100, 87, 41, 125, 64, 63];

function findPathAvoidingDefenders(game, src, dst){
  const avoid = new Set(
    game.defenders.filter(u=>u.hp>0)
      .map(u=>String(sectorIdAt(game, u.x, u.y)))
  );
  const S = String(src), D = String(dst);
  const q = [S];
  const prev = new Map([[S, null]]);
  while (q.length){
    const s = q.shift();
    if (s === D) break;
    for (const n of getAdjacentSectors(s, game).map(String)){
      if (avoid.has(n)) continue;
      if (!prev.has(n)){ prev.set(n, s); q.push(n); }
    }
  }
  if (!prev.has(D)) return null;
  const path = [];
  for (let v=D; v; v=prev.get(v)) path.push(v);
  path.reverse();
  return path;
}

export function aiAttackersPlanMovesToSectors(game) {
  const plans = {};
  const lastSec = FLAG_ROUTE[FLAG_ROUTE.length - 1];

  const avoidSet = new Set(
    game.defenders.filter(u => u.hp > 0)
      .map(u => String(sectorIdAt(game, u.x, u.y)))
  );

  for (const a of game.attackers) {
    if (a.hp <= 0) continue;

    let curSec = sectorIdAt(game, a.x, a.y);

    // 1) jeśli już w sektorze flagi — celuj w konkretne pole flagi
    if (curSec === lastSec) {
      let best = null, bd = Infinity;
      for (const c of FLAG_CELLS) {
        const k = `${c.x}-${c.y}`;
        if (String(game.cellToSector.get(k)) !== String(lastSec)) continue;
        const d = Math.abs(c.x - a.x) + Math.abs(c.y - a.y);
        if (d < bd) { bd = d; best = c; }
      }
      plans[a.id] = best ? { x: best.x, y: best.y } : { x: a.x, y: a.y };
      a._lastSec = curSec;
      continue;
    }

    // 2) ścieżka sektorowa do flagi z omijaniem obrońców
    let path = findPathAvoidingDefenders(game, curSec, lastSec);

    // 3) fallback: jeśli brak ścieżki (wszędzie obrońcy), rusz w najlepszy sąsiedni sektor
    if (!path) {
      const neigh = getAdjacentSectors(String(curSec), game).map(s => parseInt(s,10));
      // heurystyka: preferuj sektory bez obrońców
      const filtered = neigh.filter(s => !avoidSet.has(String(s)));
      const cand = (filtered.length ? filtered : neigh);
      if (cand.length) {
        // tiebreak: sektory bliżej flagi (po odległości manhattan do FLAG_CELLS po ich najlepszej kratce)
        const bestNext = cand
          .map(sid => {
            const cells = enumerateSectorCells(String(sid));
            let best = Infinity;
            for (const [x,y] of cells){
              for (const f of FLAG_CELLS){
                const d = Math.abs(x - f.x) + Math.abs(y - f.y);
                if (d < best) best = d;
              }
            }
            return { sid, score: best };
          })
          .sort((a,b)=>a.score - b.score)[0].sid;
        plans[a.id] = { sec: bestNext };
        a._lastSec = curSec;
        continue;
      } else {
        plans[a.id] = { sec: curSec };
        a._lastSec = curSec;
        continue;
      }
    }

    // 4) normalny przypadek: kolejny sektor na ścieżce
    let nextSec = parseInt(path[1], 10);

    // 5) anty‑pętla (unikaj cofania)
    if (a._lastSec != null && nextSec === a._lastSec) {
      const alt = getAdjacentSectors(String(curSec), game)
        .map(s=>parseInt(s,10))
        .filter(s => !avoidSet.has(String(s)) && s !== a._lastSec);
      if (alt.length) nextSec = alt[0];
    }

    plans[a.id] = { sec: nextSec ?? curSec };
    a._lastSec = curSec;
  }

  return plans;
}



export async function animateAttackerMoves(game, plans) {
	
//console.log('cellToSector:', game.cellToSector instanceof Map, game.cellToSector.size);
//console.log('16-9 →', game.cellToSector.get('16-9')); // powinno być '63'

  const ids = Object.keys(plans);
  if (!ids.length) return;

  const dur = 300;
  const start = Date.now();


  function sectorIdAtLocal(x, y){
    const sid = game.cellToSector.get(`${x}-${y}`);
    return typeof sid === 'string' ? parseInt(sid, 10) : sid;
  }
  function _distToFlag(x, y){
    let best = Infinity;
    for (const f of FLAG_CELLS){
      const d = Math.abs(x - f.x) + Math.abs(y - f.y);
      if (d < best) best = d;
    }
    return best;
  }
  function pickBestCellInSectorTowardsFlag(game, unit, targetSec, reserved){
	 
	 
    const cells = enumerateSectorCells(String(targetSec)) || [];
    const sorted = cells
      .map(([x,y]) => ({ x, y, df: _distToFlag(x,y), du: Math.abs(x-unit.x)+Math.abs(y-unit.y) }))
      .sort((a,b) => (a.df - b.df) || (a.du - b.du));
    for (const c of sorted){
      const key = `${c.x}-${c.y}`;
      if (reserved.has(key)) continue;
      if (isCellFree(game, c.x, c.y, unit.id)) {
        reserved.add(key);
        return { x: c.x, y: c.y };
      }
    }
    return null;
  }

  game.movingUnits = {};
  const reserved = new Set();

  // rozwiąż cele
  for (const id of ids) {
    const u = game.attackers.find(a => String(a.id) === String(id) && a.hp > 0);
    const d = plans[id];
    if (!u || !d) continue;

    if (d.x != null && d.y != null) {
      const key = `${d.x}-${d.y}`;
      if (!isCellFree(game, d.x, d.y, u.id)) continue;
      if (u.x === d.x && u.y === d.y) continue;
      if (reserved.has(key)) continue;
      reserved.add(key);
      game.movingUnits[String(id)] = { from: { x: u.x, y: u.y }, to: { x: d.x, y: d.y }, t: 0 };
      continue;
    }

    if (d.sec != null) {
      const curSec = sectorIdAtLocal(u.x, u.y);
      const targetSec = typeof d.sec === 'string' ? parseInt(d.sec, 10) : d.sec;
      if (curSec === targetSec) continue;

      const cell = pickBestCellInSectorTowardsFlag(game, u, targetSec, reserved);
      if (!cell) continue;
      game.movingUnits[String(id)] = { from: { x: u.x, y: u.y }, to: { x: cell.x, y: cell.y }, t: 0 };
    }
  }

  if (!Object.keys(game.movingUnits).length) return;

  
  /*
  await new Promise(resolve => {
    function tick() {
		console.log("att shot attackers.js");
      const t = Math.min(1, (Date.now() - start) / dur);
      for (const id in game.movingUnits) game.movingUnits[id].t = t;
      draw(game);

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        for (const id in game.movingUnits) {
          const u = game.attackers.find(a => String(a.id) === String(id) && a.hp > 0);
          if (!u) continue;
          const d = game.movingUnits[id].to;
          u.x = d.x; u.y = d.y; u.m = true;
        }
        game.movingUnits = {};
        resolve();
      }
    }
    requestAnimationFrame(tick);
  });
  */
}




/** Rozstaw startowych atakujących w najlepszym sektorze startowym (klastrowo) */
export function placeAttackersClustered(game, count = 5){
  const startSectors = ATTACKER_START_SECTORS.map(String);

  function sectorScore(sid){
    const cells = enumerateSectorCells(sid).filter(([x,y]) => isCellFree(game, x, y));
    if (!cells.length) return -Infinity;
    const flag = { x:16.5, y:9.5 };
    const gatePts = [{x:16,y:14},{x:17,y:14}];

    const avgDistFlag = cells
      .map(([x,y]) => Math.abs(x - flag.x) + Math.abs(y - flag.y))
      .reduce((a,b)=>a+b,0) / cells.length;

    const avgDistGate = cells
      .map(([x,y]) => Math.min(
        Math.abs(x - gatePts[0].x) + Math.abs(y - gatePts[0].y),
        Math.abs(x - gatePts[1].x) + Math.abs(y - gatePts[1].y)
      ))
      .reduce((a,b)=>a+b,0) / cells.length;

    return cells.length * 5 - avgDistFlag * 2 - avgDistGate * 3;
  }

  const chosenSector = startSectors
    .map(sid => ({ sid, score: sectorScore(sid) }))
    .sort((a,b)=> b.score - a.score)[0]?.sid;

  if (!chosenSector) return [];

  const gatePts = [{x:16,y:14},{x:17,y:14}];
  const free = enumerateSectorCells(chosenSector)
    .filter(([x,y]) => isCellFree(game, x, y))
    .sort((a,b)=>{
      const da = Math.min(
        Math.abs(a[0]-gatePts[0].x)+Math.abs(a[1]-gatePts[0].y),
        Math.abs(a[0]-gatePts[1].x)+Math.abs(a[1]-gatePts[1].y)
      );
      const db = Math.min(
        Math.abs(b[0]-gatePts[0].x)+Math.abs(b[1]-gatePts[0].y),
        Math.abs(b[0]-gatePts[1].x)+Math.abs(b[1]-gatePts[1].y)
      );
      return da - db;
    });

  return free.slice(0, count).map(([x,y]) => ({ x, y }));
}




















function _rng(){
  let s = (Date.now() & 0xffffffff) >>> 0;
  return () => (s = (1664525 * s + 1013904223) >>> 0) / 2**32;
}
function _shuffle(arr, rnd){
  for (let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}





function _sectorsOrderFromBestStart(game){
  const allowed = ATTACKER_START_SECTORS.map(String);
  const rnd = _rng();
  if (!allowed.length) return [];

  // czysty los startowego sektora z allowed
  const bestStart = allowed[Math.floor(rnd() * allowed.length)];

  // BFS tylko po allowed, z losowym tasowaniem sąsiadów
  const allowedSet = new Set(allowed);
  const q = [bestStart];
  const vis = new Set([bestStart]);
  const order = [];
  while (q.length){
    const s = q.shift();
    order.push(s);
    const neigh = getAdjacentSectors(String(s), game)
      .map(String)
      .filter(n => allowedSet.has(n));
    _shuffle(neigh, rnd);
    for (const n of neigh){
      if (!vis.has(n)) { vis.add(n); q.push(n); }
    }
  }
  return order;
}




// === PATCH 2: rozstawienie tylko w allowed; miękkie przycięcie do pojemności ===
export function placeAttackersAuto(game, count = 5){
  const want = Math.max(1, Math.min(50, count));
  const sectorsOrder = _sectorsOrderFromBestStart(game);
  if (!sectorsOrder.length) return [];

  const gatePts = [{x:16,y:14},{x:17,y:14}];
  const byGate = (secId) => {
    const cells = enumerateSectorCells(secId)
      .filter(([x,y]) => isCellFree(game, x, y));
    cells.sort((a,b)=>{
      const da = Math.min(
        Math.abs(a[0]-gatePts[0].x)+Math.abs(a[1]-gatePts[0].y),
        Math.abs(a[0]-gatePts[1].x)+Math.abs(a[1]-gatePts[1].y)
      );
      const db = Math.min(
        Math.abs(b[0]-gatePts[0].x)+Math.abs(b[1]-gatePts[0].y),
        Math.abs(b[0]-gatePts[1].x)+Math.abs(b[1]-gatePts[1].y)
      );
      return da - db;
    });
    return cells;
  };

  const out = [];
  for (const sec of sectorsOrder){
    if (out.length >= want) break;
    for (const [x,y] of byGate(sec)){
      if (out.length >= want) break;
      if (isCellFree(game, x, y)) out.push({ x, y });
    }
  }

  // jeśli zabrakło miejsca w allowed – przytnij (bez wychodzenia poza listę)
  return out.slice(0, want);
}



