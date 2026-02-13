// js/geometry.js
// charakterystyka mapy

import { GRID_W, GRID_H, CELL, fortInterior, GATE_SECTOR_NUMBER, TOWER_NAME, WALL_NAME, FLAG_NAME, AROUND_THE_FLAG_NAME, BUILDING_NAME, GROUND_NAME } from './constants.js';
import { sectors, enumerateSectorCells, getSector, getAdjacentSectors } from './sectors.js';

/* ============================
 *  Wysokości / wnętrze fortu
 * ============================ */
export function getCellHeight(x, y, game){
  const s = getSector(x, y, game);
  if (!s) return 0;
  if (s.type === TOWER_NAME)    return 2;
  if (s.type === WALL_NAME)     return 1.5;
  if (s.type === BUILDING_NAME) return 1;
  return 0;
}

export function getUnitHeightAt(x, y, game){
  const u = [...game.attackers, ...game.defenders].find(u => u.hp > 0 && u.x === x && u.y === y);
  return u ? getCellHeight(x, y, game) : null;
}

export function inFortInterior(x, y){
  return (x >= fortInterior.x[0] && x <= fortInterior.x[1] &&
          y >= fortInterior.y[0] && y <= fortInterior.y[1]);
}

/* ============================
 *  Ray/segment helpers
 * ============================ */
export function segmentIntersectsRect(x0, y0, x1, y1, rx, ry, rw = 1, rh = 1){
  const x0r = x0 - rx, y0r = y0 - ry, x1r = x1 - rx, y1r = y1 - ry;
  const inRect = (x, y) => x >= 0 && x <= rw && y >= 0 && y <= rh;
  if (inRect(x0r, y0r) || inRect(x1r, y1r)) return true;

  const dx = x1r - x0r, dy = y1r - y0r;
  let t0 = 0, t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [ x0r, rw - x0r, y0r, rh - y0r ];

  for (let i = 0; i < 4; i++){
    const pi = p[i], qi = q[i];
    if (pi === 0){
      if (qi < 0) return false;
    } else {
      const t = qi / pi;
      if (pi < 0){
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return true;
}


function passesThroughGatePrecise(x0, y0, x1, y1){
  const x0c = x0 + 0.5, y0c = y0 + 0.5;
  const x1c = x1 + 0.5, y1c = y1 + 0.5;
  for (const [gx, gy] of enumerateSectorCells(String(GATE_SECTOR_NUMBER))) {
    if (segmentIntersectsRect(x0c, y0c, x1c, y1c, gx, gy, 1, 1)) return true;
  }
  return false;
}

export function rayBlockedPrecise(x0, y0, x1, y1, game, pred){
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const steps = Math.max(dx, dy) * 6 + 6;

  for (let i = 1; i < steps; i++){
    const t = i / steps;
    const xf = x0 + (x1 - x0) * t;
    const yf = y0 + (y1 - y0) * t;
    const cx = Math.floor(xf);
    const cy = Math.floor(yf);

    if (cx === x0 && cy === y0) continue;
    if (cx === x1 && cy === y1) continue;

    const mid = getSector(cx, cy, game);
    if (pred(mid, cx, cy)) return true;
  }
  return false;
}

/* ============================
 *  LOS (z wyjątkami dla murów/baszt/bramy)
 * ============================ */
export function losVisible(x0, y0, x1, y1, game){
  return visibleCore(x0, y0, x1, y1, game, false);

  function heightOf(sec, forGate = false){
    if (!sec) return 0;
    if (sec.type === TOWER_NAME)    return 2;
    if (sec.type === WALL_NAME)     return (forGate && String(sec.id) === GATE_SECTOR_NUMBER ? 0 : 1.5);
    if (sec.type === BUILDING_NAME) return 1;
    return 0;
  }

  function visibleCore(x0, y0, x1, y1, game, recGuard){
    const s0 = getSector(x0, y0, game);
    const s1 = getSector(x1, y1, game);

    const h0 = heightOf(s0, true);
    const h1 = heightOf(s1, true);

    // Symetria: 0 ↔ wysokie
    if (!recGuard && h0 === 0 && h1 > 0){
      return visibleCore(x1, y1, x0, y0, game, true);
    }

    const insideFort = (x1 >= fortInterior.x[0] && x1 <= fortInterior.x[1] &&
                        y1 >= fortInterior.y[0] && y1 <= fortInterior.y[1]);
    const belowGate = (y1 > fortInterior.y[1]);

    // BASZTA jako źródło
    if (s0 && s0.type === TOWER_NAME){
      const id = String(s0.id);
      const isUpper = (y0 <= 7);

      if (id === '39'){ if ((x1 >= 26 && x1 <= 33) || (y1 >= 16 && y1 <= 23)) return true; }
      if (id === '43'){ if ((x1 <= 7)               || (y1 >= 16 && y1 <= 23)) return true; }
      if (id === '37'){ if ((x1 >= 26 && x1 <= 33) || (y1 <= 4)) return true; }
      if (id === '34'){ if ((x1 <= 7)              || (y1 <= 4)) return true; }

      // Do innych wysokich/istotnych obiektów zawsze można "namierzać"
      if (s1 && (
        s1.type === TOWER_NAME ||
        s1.type === WALL_NAME  ||
        s1.type === BUILDING_NAME ||
        String(s1.id) === '63' ||
        ['59', '60','61','62'].includes(String(s1.id))
      )) return true;

      if (insideFort){
        // blokują budynki
        return !rayBlockedPrecise(x0, y0, x1, y1, game, (mid) => mid && mid.type === BUILDING_NAME);
      }

      if (isUpper && passesThroughGatePrecise(x0, y0, x1, y1)) return true;

      if (s1 && s1.type === GROUND_NAME){
        // z baszty blokują mury/baszty
        return !rayBlockedPrecise(x0, y0, x1, y1, game, (mid) => mid && (mid.type === WALL_NAME || mid.type === TOWER_NAME));
      }

      return false;
    }

    // BUDYNEK jako źródło
    if (s0 && s0.type === BUILDING_NAME){
      if (s1 && (s1.type === TOWER_NAME || s1.type === WALL_NAME || s1.type === BUILDING_NAME)) return true;
      if (String(s1?.id) === GATE_SECTOR_NUMBER) return true; // brama
      if (passesThroughGatePrecise(x0, y0, x1, y1)) return true;

      return !rayBlockedPrecise(x0, y0, x1, y1, game, (mid, cx, cy) => {
        if (!mid) return false;
        if (mid.type === BUILDING_NAME && String(mid.id) === String(s0.id)) return false; // własny
        if (mid.type === BUILDING_NAME) return true;
        if (mid.type === WALL_NAME)     return true;
        if (mid.type === TOWER_NAME)    return true;
        return false;
      });
    }

    // MUR/BRAMA jako źródło
    if (s0 && s0.type === WALL_NAME){
      const isGate = (String(s0.id) === GATE_SECTOR_NUMBER);

      if (!isGate){
        if (s1 && (s1.type === WALL_NAME || s1.type === TOWER_NAME || s1.type === BUILDING_NAME)) return true;

        // NOWE: mur → ziemia wewnątrz fortu → budynki blokują zawsze
        if (s1 && s1.type === GROUND_NAME && inFortInterior(x1, y1)) {
          return !rayBlockedPrecise(x0, y0, x1, y1, game, (mid) => mid && mid.type === BUILDING_NAME);
        }

        const blocked = rayBlockedPrecise(x0, y0, x1, y1, game, (mid, cx, cy) => {
          if (mid && heightOf(mid, true) >= Math.max(h0, h1)){
            if (mid.type === WALL_NAME){
              const same = String(mid.id) === String(s0.id);
              const adj  = getAdjacentSectors(String(s0.id), game).map(String).includes(String(mid.id));
              if (same || adj) return false; // własny/adj mur nie blokuje z muru
            }
            return true;
          }
          const uh = getUnitHeightAt(cx, cy, game);
          if (uh !== null && uh > 0){
            if (mid && mid.type === WALL_NAME){
              const same = String(mid.id) === String(s0.id);
              const adj  = getAdjacentSectors(String(s0.id), game).map(String).includes(String(mid.id));
              if (same || adj) return false; // jednostki na murach własnych/adj nie blokują
            }
            return true;
          }
          return false;
        });
        return !blocked;
      }

      // BRAMA
      if (s1 && s1.type === WALL_NAME && y1 === 14 && (x1 === 15 || x1 === 18)) return true;
      if (belowGate) return true;
      if (inFortInterior(x1, y1)){
        return !rayBlockedPrecise(x0, y0, x1, y1, game, (mid) => mid && mid.type === BUILDING_NAME);
      }
      return false;
    }

    // NOWE: ziemia wewnątrz fortu → mur: budynki blokują zawsze
    if (s1 && s1.type === WALL_NAME && inFortInterior(x0, y0)) {
      return !rayBlockedPrecise(x0, y0, x1, y1, game, (mid) => mid && mid.type === BUILDING_NAME);
    }

    // Fallback: blokują obiekty z wysokością > max(h0, h1) oraz wysokie jednostki
    return !rayBlockedPrecise(x0, y0, x1, y1, game, (mid, cx, cy) => {
      if (mid && heightOf(mid, true) > Math.max(h0, h1)) return true;
      const uh = getUnitHeightAt(cx, cy, game);
      if (uh !== null && uh > 0) return true;
      return false;
    });
  }
}

/* ============================
 *  FOV (cache)
 * ============================ */
let _sectorCenters = null;
export function computeSectorCenters(){
  _sectorCenters = {};
  for (const id in sectors){
    const cells = enumerateSectorCells(id);
    if (!cells.length) continue;
    const cx = cells.reduce((a, [x]) => a + x, 0) / cells.length;
    const cy = cells.reduce((a, [, y]) => a + y, 0) / cells.length;
    _sectorCenters[id] = { x: cx * CELL + CELL/2, y: cy * CELL + CELL/2 };
  }
}
export const sectorCenters = {
  get value(){ return _sectorCenters; }
};

const _fovCache = new Map();
function unitsSignature(game){
  const a = game.attackers.filter(u => u.hp > 0).map(u => `${u.id}:${u.x},${u.y}`).sort().join('|');
  const d = game.defenders.filter(u => u.hp > 0).map(u => `${u.id}:${u.x},${u.y}`).sort().join('|');
  return a + '#' + d;
}

export function clearFOVCache(){ _fovCache.clear(); }

export function computeFOV(cx, cy, game){
  const s0 = getSector(cx, cy, game);

  const h0 = (() => {
    if (!s0) return 0;
    if (s0.type === TOWER_NAME)    return 2;
    if (s0.type === WALL_NAME)     return (String(s0.id) === GATE_SECTOR_NUMBER ? 0 : 1.5); // brama ma wysokość 0
    if (s0.type === BUILDING_NAME) return 1;
    return 0;
  })();

  const useCache = (h0 > 0);
  const key = useCache ? `${cx}-${cy}-${unitsSignature(game)}` : null;

  if (useCache && _fovCache.has(key)) return _fovCache.get(key);

  const vis = new Set();
  for (let x = 0; x < GRID_W; x++){
    for (let y = 0; y < GRID_H; y++){
      const sT = getSector(x, y, game);
      const hT = sT
        ? (sT.type === TOWER_NAME ? 2 : sT.type === WALL_NAME ? (String(sT.id) === GATE_SECTOR_NUMBER ? 0 : 1.5) : sT.type === BUILDING_NAME ? 1 : 0)
        : 0;

      if (h0 === 0 && hT > 0){
        if (losVisible(x, y, cx, cy, game)) vis.add(`${x}-${y}`);
      } else {
        if (losVisible(cx, cy, x, y, game)) vis.add(`${x}-${y}`);
      }
    }
  }

  // Baszty: zawsze widać kratki baszt
  if (s0 && s0.type === TOWER_NAME){
    for (const id in sectors){
      const s = sectors[id];
      if (s.type === TOWER_NAME){
        for (const [tx, ty] of enumerateSectorCells(id)) vis.add(`${tx}-${ty}`);
      }
    }
  }

  if (useCache) _fovCache.set(key, vis);
  return vis;
}