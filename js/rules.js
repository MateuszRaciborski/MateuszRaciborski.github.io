// js/rules.js

import { getAdjacentSectors } from './sectors.js';

//sprawdza, czy sektor docelowy graniczy z sektorem startowym i nie jest zajęty przez przeciwnika
export function canEnterToSector(game, team, fromX, fromY, toX, toY) {
  const fromSec = game.cellToSector.get(`${fromX}-${fromY}`);
  const toSec   = game.cellToSector.get(`${toX}-${toY}`);
  if (!toSec) return false;

  // ruch w obrębie tego samego sektora
  if (String(fromSec) === String(toSec)) return true;

  // sektor docelowy musi przylegać do sektora źródłowego
  if (!fromSec) return false;
  const adjacent = getAdjacentSectors(fromSec, game);
  if (!adjacent.includes(toSec)) return false;

  // blokada wejścia do sektora z wrogiem
  const enemies = team === 'att' ? game.defenders : game.attackers;
  return !enemies.some(u => u.hp > 0 && String(game.cellToSector.get(`${u.x}-${u.y}`)) === String(toSec));
}

export function canEnterCell(game, team, fromX, fromY, toX, toY){
  const fromSec = game.cellToSector.get(`${fromX}-${fromY}`);
  const toSec   = game.cellToSector.get(`${toX}-${toY}`);
  if (!toSec) return false;
  // dozwolony ruch w obrębie tego samego sektora
  if (String(fromSec) === String(toSec)) return true;
  // blokada wejścia do sektora z wrogiem
  const enemies = team === 'att' ? game.defenders : game.attackers;
  return !enemies.some(u => u.hp>0 && String(game.cellToSector.get(`${u.x}-${u.y}`)) === String(toSec));
}
