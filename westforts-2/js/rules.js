// js/rules.js
// pomniejsze zasady, raczej rozbudować chcę ten pliczek

// js/rules.js
import { getAdjacentSectors } from './sectors.js';

// helper: sprawdza, czy sektor docelowy jest zajęty przez wroga
function isEnemyInSector(game, team, sectorId) {
  const enemies = (team === game.attackersSign) ? game.defenders : game.attackers;
  const toSecStr = String(sectorId);
  return enemies.some(u => u.hp > 0 && String(game.cellToSector.get(`${u.x}-${u.y}`)) === toSecStr);
}

// helper: rzutuje sektory i sprawdza sąsiedztwo
function sectorsAdjacentOrSame(game, fromSec, toSec) {
  if (!toSec) return false;
  const fs = fromSec != null ? String(fromSec) : null;
  const ts = String(toSec);
  if (fs === ts) return true;
  if (!fs) return false;
  const adjacent = getAdjacentSectors(fs, game).map(String);
  return adjacent.includes(ts);
}

// GŁÓWNA: wejście do sektora (z sąsiedztwem i blokadą wroga)
export function canEnterToSector(game, team, fromX, fromY, toX, toY) {
  const fromSec = game.cellToSector.get(`${fromX}-${fromY}`);
  const toSec   = game.cellToSector.get(`${toX}-${toY}`);
  if (!sectorsAdjacentOrSame(game, fromSec, toSec)) return false;
  return !isEnemyInSector(game, team, toSec);
}

// Prostszą “komórkową” wersję zostaw jako delegującą:
export function canEnterCell(game, team, fromX, fromY, toX, toY) {
  const fromSec = game.cellToSector.get(`${fromX}-${fromY}`);
  const toSec   = game.cellToSector.get(`${toX}-${toY}`);
  if (!toSec) return false;
  // w tym wariancie zezwalamy na ruch tylko w obrębie tego samego sektora lub jeśli sektor nie ma wroga
  if (String(fromSec) === String(toSec)) return true;
  return !isEnemyInSector(game, team, toSec);
}


/*
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
  const enemies = team === game.attackersSign ? game.defenders : game.attackers;
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

*/