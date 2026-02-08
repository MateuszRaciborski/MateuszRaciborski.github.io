// js/sectors.js
// Zawiera definicję sektorów oraz funkcje pomocnicze do pracy z mapą sektorów.

import { GRID_W, GRID_H } from './constants.js';

export const sectors = {
  34: { type:'tower', x:[8,10], y:[5,7], b:{h:20,d:30} },
  37: { type:'tower', x:[23,25], y:[5,7], b:{h:20,d:30} },
  43: { type:'tower', x:[8,10], y:[13,15], b:{h:20,d:30} },
  39: { type:'tower', x:[23,25], y:[13,15], b:{h:20,d:30} },

  35: { type:'wall', x:[11,16], y:[6,6], b:{h:10,d:15} },
  36: { type:'wall', x:[17,22], y:[6,6], b:{h:10,d:15} },
  42: { type:'wall', x:[11,15], y:[14,14], b:{h:10,d:15} },
  40: { type:'wall', x:[16,17], y:[14,14], b:{h:10,d:15} },
  41: { type:'wall', x:[18,22], y:[14,14], b:{h:10,d:15} },
  45: { type:'wall', x:[9,9],  y:[8,12], b:{h:10,d:15} },
  38: { type:'wall', x:[24,24], y:[8,12], b:{h:10,d:15} },

  63: { type:'flag', x:[16,17], y:[9,10], b:{h:0,d:0} },

  60: { type:'yellow', x:[15,16], y:[8,9] },
  61: { type:'yellow', x:[15,16], y:[10,11] },
  62: { type:'yellow', x:[17,18], y:[8,9] },
  64: { type:'yellow', x:[17,18], y:[10,11] },

  56: { type:'building', x:[12,13], y:[9,11], b:{h:20,d:20} },
  57: { type:'building', x:[19,21], y:[8,9],  b:{h:20,d:20} },
  58: { type:'building', x:[19,21], y:[11,12], b:{h:20,d:20} },

  99: { type:'zone', x:[0,2],   y:[0,10] },
  98: { type:'zone', x:[0,2],   y:[11,20] },
  97: { type:'zone', x:[3,5],   y:[3,7] },
  96: { type:'zone', x:[3,5],   y:[8,12] },
  91: { type:'zone', x:[3,5],   y:[13,17] },
  90: { type:'zone', x:[3,7],   y:[18,20] },
  95: { type:'zone', x:[0,10],  y:[21,23] },

  94: { type:'zone', x:[6,8],   y:[6,9],  shape:'custom1' },
  93: { type:'zone', x:[6,8],   y:[10,14], shape:'custom2' },
  92: { type:'zone', x:[6,10],  y:[15,17], shape:'custom3' },

  89: { type:'zone', x:[11,16], y:[15,17] },
  88: { type:'zone', x:[8,13],  y:[18,20] },
  87: { type:'zone', x:[17,22], y:[15,17] },

  86: { type:'zone', x:[10,11], y:[7,9],  shape:'custom4' },
  85: { type:'zone', x:[10,11], y:[10,13], shape:'custom5' },

  100:{ type:'zone', x:[14,19], y:[18,20] },
  101:{ type:'zone', x:[11,22], y:[21,23] },
  102:{ type:'zone', x:[23,33], y:[21,23] },
  103:{ type:'zone', x:[20,25], y:[18,20] },
  104:{ type:'zone', x:[26,30], y:[18,20] },
  105:{ type:'zone', x:[31,33], y:[11,20] },
  106:{ type:'zone', x:[23,27], y:[16,17], extraCells:[[26,15],[27,15]] },

  107:{ type:'zone', x:[3,11],  y:[0,2] },
  108:{ type:'zone', x:[6,10],  y:[3,4],  extraCells:[[6,5],[7,5]] },

  110:{ type:'zone', x:[25,27], y:[10,12], extraCells:[[26,13],[26,14],[27,13],[27,14]] },
  111:{ type:'zone', x:[25,27], y:[8,9],  extraCells:[[26,6],[26,7],[27,6],[27,7]] },

  112:{ type:'zone', x:[11,16], y:[3,5] },
  113:{ type:'zone', x:[17,22], y:[3,5] },
  114:{ type:'zone', x:[12,21], y:[0,2] },
  115:{ type:'zone', x:[22,30], y:[0,2] },
  116:{ type:'zone', x:[23,27], y:[3,4], extraCells:[[26,5],[27,5]] },

  117:{ type:'zone', x:[28,30], y:[13,17] },
  118:{ type:'zone', x:[28,30], y:[8,12] },
  119:{ type:'zone', x:[28,30], y:[3,7] },
  120:{ type:'zone', x:[31,33], y:[0,10] },

  121:{ type:'zone', x:[12,14], y:[7,8],  extraCells:[[14,9],[14,10]] },
  122:{ type:'zone', x:[15,18], y:[7,7] },
  123:{ type:'zone', x:[12,13], y:[12,13] },
  124:{ type:'zone', x:[15,16], y:[12,13], extraCells:[[14,11],[14,12],[14,13]] },
  125:{ type:'zone', x:[17,18], y:[12,13], extraCells:[[19,13],[20,13],[21,13]] },
  126:{ type:'zone', x:[19,21], y:[10,10] },
  127:{ type:'zone', x:[22,23], y:[8,9],  extraCells:[[22,7]] },
  128:{ type:'zone', x:[22,23], y:[10,12], extraCells:[[22,13]] },
  129:{ type:'zone', x:[19,21], y:[7,7] },
};

/**
 * Zwraca listę wszystkich kratek należących do danego sektora.
 * Uwzględnia special-case'y (żółte pola oraz kształty custom).
 */
export function enumerateSectorCells(id){
  const s = sectors[id];
  let cells = [];
  if (!s) return cells;

  // prostokąt bazowy
  for (let x = s.x[0]; x <= s.x[1]; x++){
    for (let y = s.y[0]; y <= s.y[1]; y++){
      cells.push([x,y]);
    }
  }

  // dodatkowe niestandardowe kratki
  if (s.extraCells) cells.push(...s.extraCells);

  // korekty dla żółtych
  if (s.type === 'yellow'){
    const sid = String(id);
    if (sid === '60') cells = [[15,8],[15,9],[16,8]];
    if (sid === '61') cells = [[15,10],[15,11],[16,11]];
    if (sid === '62') cells = [[17,8],[18,8],[18,9]];
    if (sid === '64') cells = [[17,11],[18,10],[18,11]];
  }

  // kształty custom
  if (String(id) === '94'){
    cells = [[6,6],[6,7],[6,8],[6,9],[7,6],[7,7],[7,8],[7,9],[8,8],[8,9]];
  }
  if (String(id) === '93'){
    cells = [];
    for (let x=6; x<=7; x++) for (let y=10; y<=14; y++) cells.push([x,y]);
    for (let y=10; y<=12; y++) cells.push([8,y]);
  }
  if (String(id) === '92'){
    cells = [[6,15],[7,15]];
    for (let x=6; x<=10; x++) for (let y=16; y<=17; y++) cells.push([x,y]);
  }
  if (String(id) === '86'){
    cells = [[11,7],[10,8],[10,9],[11,8],[11,9]];
  }
  if (String(id) === '85'){
    cells = [[10,10],[10,11],[10,12],[11,10],[11,11],[11,12],[11,13]];
  }

  return cells;
}

/**
 * Buduje mapę komórka -> sektor w obiekcie stanu gry.
 * Mutuje: game.cellToSector (Map<string, string>).
 */
export function buildCellMap(game){
  game.cellToSector.clear();
  for (const id in sectors){
    for (const [x,y] of enumerateSectorCells(id)){
      game.cellToSector.set(`${x}-${y}`, id);
    }
  }
  // korekta: 24-13 należy do sektora 39 (baszta)
  game.cellToSector.set('24-13','39');
}

/**
 * Zwraca szczegóły sektora dla danej komórki (x,y), albo null.
 */
export function getSector(x, y, game){
  const id = game.cellToSector.get(`${x}-${y}`);
  return id ? { id, ...sectors[id] } : null;
}

/**
 * Zwraca listę ID sektorów sąsiadujących (4-neighbour) z podanym sektorem.
 * Wykorzystuje faktyczne sąsiedztwo komórek na siatce (GRID_W x GRID_H).
 */
export function getAdjacentSectors(sectorId, game){
  const cur = sectors[sectorId];
  if (!cur) return [];
  const adj = new Set();

  for (const [x,y] of enumerateSectorCells(sectorId)){
    const neigh = [[0,1],[0,-1],[1,0],[-1,0]];
    for (const [dx,dy] of neigh){
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) continue;
      const sid = game.cellToSector.get(`${nx}-${ny}`);
      if (sid && sid !== sectorId) adj.add(sid);
    }
  }
  return Array.from(adj);
}






function buildAdjacencyListing(game){
  buildCellMap(game);
  const result = {};
  for (const id in sectors){
    const adj = getAdjacentSectors(id, game).map(String).sort((a,b)=>+a-+b);
    result[id] = adj;
  }
  return result; // { "34": ["35","45","56", ...], ... }
}

// przykład użycia graniczenia sektorów:
//const game = { cellToSector: new Map() };
//const adjacency = buildAdjacencyListing(game);
//console.log(JSON.stringify(adjacency, null, 2));







// start-sectors.js

export const ATTACKER_START_SECTORS = [120, 105, 102, 101, 95, 98, 99];

export const DEFENDER_START_SECTORS = [
  34, 35, 36, 37, 38, 39, 41, 40, 42, 43, 45,
  86, 85, 121, 56, 123, 124, 122,
  60, 62, 63, 61, 64, 125, 129, 57, 126, 58, 127, 128
];

// szybkie Set-y do O(1) sprawdzeń
const ATTACKER_SET = new Set(ATTACKER_START_SECTORS.map(String));
const DEFENDER_SET = new Set(DEFENDER_START_SECTORS.map(String));

/**
 * Zwraca true, jeśli kratka (x,y) należy do sektora startowego danej strony.
 * Wymaga: buildCellMap(game) wcześniej wywołane.
 * side: 'attacker' | 'defender'
 */
export function canPlaceOnCell(side, x, y, game){
  const sid = game.cellToSector.get(`${x}-${y}`); // string ID sektora
  if (!sid) return false;
  return side === 'attacker' ? ATTACKER_SET.has(sid) : DEFENDER_SET.has(sid);
}

/**
 * Zwraca listę wszystkich kratek dozwolonych dla danej strony (prekompilacja).
 * Przydatne do podświetlania.
 */
export function enumerateAllowedCells(side, game, enumerateSectorCells){
  const ids = side === 'attacker' ? ATTACKER_START_SECTORS : DEFENDER_START_SECTORS;
  const out = [];
  for (const id of ids){
    for (const [x,y] of enumerateSectorCells(String(id))){
      out.push([x,y]);
    }
  }
  return out;
}

