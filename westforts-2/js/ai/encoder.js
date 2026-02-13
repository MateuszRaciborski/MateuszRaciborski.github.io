// js/ai/encoder.js

import { GRID_W as W, GRID_H as H } from '../constants.js';
import { sectors, enumerateSectorCells } from '../sectors.js';
import { canEnterCell } from '../rules.js';
import { getAdjacentSectors } from '../sectors.js';

// -------------------------------
// UWAGA: Model został wytrenowany na A=64
// czyli 63 sektory + STAY = 64 akcji
// -------------------------------

export const ALL_SECTORS = [
  "34","35","36","37","38","39","40","41","42","43","45",
  "56","57","58",
  "60","61","62","63","64",
  "85","86",
  "87","88","89",
  "90","91","92","93","94","95","96","97","98","99",
  "100","101","102","103","104","105","106","107","108",
  "110","111",
  "112","113","114","115","116",
  "117","118","119","120",
  "121","122","123","124","125","126","127","128","129"
];
// 63 sektorów

export const NUM_ACTIONS = 64;  // 63 sektory + STAY
export const STAY_IDX = 63;     // ostatnia akcja


export function buildObsGlobal(game) {
  const out = new Float32Array(2 * W * H + 2);
  let k = 0;

  for (let y=0; y<H; y++) for (let x=0; x<W; x++)
    out[k++] = game.defenders.some(u => u.hp>0 && u.x===x && u.y===y) ? 1 : 0;

  for (let y=0; y<H; y++) for (let x=0; x<W; x++)
    out[k++] = game.attackers.some(u => u.hp>0 && u.x===x && u.y===y) ? 1 : 0;

  out[k++] = (game.flagCount ?? 0) / 5;
  out[k++] = (game.round ?? 0) / 60;

  return out;
}

export function buildUnitFeat(d) {
  return new Float32Array([
    d.x / W,
    d.y / H,
    (d.hp||0) / (d.maxHp||1),
  ]);
}



export function buildMask(game, defender) {
  const mask = new Uint8Array(NUM_ACTIONS);

  const cellToSector = game.cellToSector;
  const curSector = String(cellToSector.get(`${defender.x}-${defender.y}`));

  // 1) wróg – sektory zajęte przez attackerów
  const enemySectors = new Set(
    game.attackers
      .filter(a => a.hp > 0)
      .map(a => String(cellToSector.get(`${a.x}-${a.y}`)))
  );

  // 2) wolne kratki (occ)
  const occupied = new Set(
    [...game.attackers, ...game.defenders]
      .filter(u => u.hp > 0)
      .map(u => `${u.x}-${u.y}`)
  );

  // 3) zawsze wolno własny sektor (jeśli istnieje)
  if (ALL_SECTORS.includes(curSector)) {
    const idx = ALL_SECTORS.indexOf(curSector);
    mask[idx] = 1;
  }

  // 4) sektory sąsiadujące – TYLKO JEŚLI NIE MA tam atakującego
  const adj = getAdjacentSectors(curSector, game);
  for (const sid of adj) {
    const ss = String(sid);
    if (!ALL_SECTORS.includes(ss)) continue;
    if (enemySectors.has(ss)) continue;

    const idx = ALL_SECTORS.indexOf(ss);

    // sprawdzamy czy istnieje legalna kratka wejścia
    let ok = false;
    for (const [sx, sy] of enumerateSectorCells(ss)) {
      const key = `${sx}-${sy}`;
      if (occupied.has(key)) continue;
      if (!canEnterCell(game, 'def', defender.x, defender.y, sx, sy)) continue;
      ok = true;
      break;
    }
    if (ok) mask[idx] = 1;
  }

  // 5) akcja STAY
  mask[STAY_IDX] = 1;

  return mask;
}


export function logDefenderMaskInfo(game, defender, mask, chosenAction) {
  const cellToSector = game.cellToSector;
  const id = defender.id;
  const x = defender.x;
  const y = defender.y;

  const curSector = cellToSector.get(`${x}-${y}`) ?? "UNKNOWN";

  // lista sektorów z maski
  const legal = [];
  for (let i = 0; i < NUM_ACTIONS; i++) {
    if (!mask[i]) continue;
    if (i === STAY_IDX) legal.push("STAY");
    else legal.push(ALL_SECTORS[i]);
  }

  // akcja wybrana
  let chosen = "STAY";
  if (chosenAction !== STAY_IDX) {
    chosen = ALL_SECTORS[chosenAction];
  }

	
  console.log(
    `chosenAction = ${chosenAction}. Obrońca ${id} stoi w kratce (${x}, ${y}), ` +
    `to jest sektor ${curSector}. ` +
    `Może w tej rundzie przejść do: [${legal.join(", ")}]. ` +
    `Wybiera akcję: ${chosen}.`
  );
}