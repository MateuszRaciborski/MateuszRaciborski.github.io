// js/sectors.js
// Zawiera definicję sektorów oraz funkcje pomocnicze do pracy z mapą sektorów.

import { DEFENDER_START_SECTORS, ATTACKER_START_SECTORS, GRID_W, GRID_H, TOWER_NAME, WALL_NAME, FLAG_NAME, AROUND_THE_FLAG_NAME, BUILDING_NAME, GROUND_NAME} from './constants.js';

// szybkie Set-y do O(1) sprawdzeń
const ATTACKER_SET = new Set(ATTACKER_START_SECTORS.map(String));
const DEFENDER_SET = new Set(DEFENDER_START_SECTORS.map(String));

export const sectors = {
	1: { type: GROUND_NAME, x:[31,33], y:[0,10] },
	2: { type: GROUND_NAME, x:[31,33], y:[11,20] },
	3: { type: GROUND_NAME, x:[23,33], y:[21,23] },
	4: { type: GROUND_NAME, x:[11,22], y:[21,23] },
	5: { type: GROUND_NAME, x:[0,10],  y:[21,23] },
	6: { type: GROUND_NAME, x:[0,2],   y:[11,20] },
	7: { type: GROUND_NAME, x:[0,2],   y:[0,10] },
	8: { type: GROUND_NAME, x:[3,11],  y:[0,2] },
	9: { type: GROUND_NAME, x:[12,21], y:[0,2] },
	10: { type: GROUND_NAME, x:[22,30], y:[0,2] },
	11: { type: GROUND_NAME, x:[28,30], y:[3,7] },
	12: { type: GROUND_NAME, x:[28,30], y:[8,12] },
	13: { type: GROUND_NAME, x:[28,30], y:[13,17] },
	14: { type: GROUND_NAME, x:[26,30], y:[18,20] },
	15: { type: GROUND_NAME, x:[20,25], y:[18,20] },
	16: { type: GROUND_NAME, x:[14,19], y:[18,20] },
	17: { type: GROUND_NAME, x:[8,13],  y:[18,20] },
	18: { type: GROUND_NAME, x:[3,7],   y:[18,20] },
	19: { type: GROUND_NAME, x:[3,5],   y:[13,17] },
	20: { type: GROUND_NAME, x:[3,5],   y:[8,12] },
	21: { type: GROUND_NAME, x:[3,5],   y:[3,7] },
	22:{ type: GROUND_NAME, x:[6,10],  y:[3,4],  extraCells:[[6,5],[7,5]] },
	23:{ type: GROUND_NAME, x:[11,16], y:[3,5] },
	24:{ type: GROUND_NAME, x:[17,22], y:[3,5] },
	25:{ type: GROUND_NAME, x:[23,27], y:[3,4], extraCells:[[26,5],[27,5]] },
	26:{ type: GROUND_NAME, x:[25,27], y:[8,9],  extraCells:[[26,6],[26,7],[27,6],[27,7]] },
	27:{ type: GROUND_NAME, x:[25,27], y:[10,12], extraCells:[[26,13],[26,14],[27,13],[27,14]] },
	28:{ type: GROUND_NAME, x:[23,27], y:[16,17], extraCells:[[26,15],[27,15]] },
	29: { type: GROUND_NAME, x:[17,22], y:[15,17] },
	30: { type: GROUND_NAME, x:[11,16], y:[15,17] },
	31: { type: GROUND_NAME, x:[6,10],  y:[15,17] },
	32: { type: GROUND_NAME, x:[6,8],   y:[10,14] },
	33: { type: GROUND_NAME, x:[6,8],   y:[6,9] },
	34: { type: TOWER_NAME, x:[8,10], y:[5,7], b:{h:20,d:30} },
	35: { type: WALL_NAME, x:[11,16], y:[6,6], b:{h:10,d:15} },
	36: { type: WALL_NAME, x:[17,22], y:[6,6], b:{h:10,d:15} },
	37: { type: TOWER_NAME, x:[23,25], y:[5,7], b:{h:20,d:30} },
	38: { type: WALL_NAME, x:[24,24], y:[8,12], b:{h:10,d:15} },
	39: { type: TOWER_NAME, x:[23,25], y:[13,15], b:{h:20,d:30} },
	40: { type: WALL_NAME, x:[18,22], y:[14,14], b:{h:10,d:15} },
	41: { type: WALL_NAME, x:[16,17], y:[14,14], b:{h:10,d:15} },
	42: { type: WALL_NAME, x:[11,15], y:[14,14], b:{h:10,d:15} },
	43: { type: TOWER_NAME, x:[8,10], y:[13,15], b:{h:20,d:30} },
	44: { type: WALL_NAME, x:[9,9],  y:[8,12], b:{h:10,d:15} },
	45: { type: GROUND_NAME, x:[10,11], y:[7,9] },
	46: { type: GROUND_NAME, x:[10,11], y:[10,13] },
	47: { type: GROUND_NAME, x:[12,14], y:[7,8],  extraCells:[[14,9],[14,10]] },
	48: { type: BUILDING_NAME, x:[12,13], y:[9,11], b:{h:20,d:20} },
	49: { type: GROUND_NAME, x:[12,13], y:[12,13] },
	50: { type: GROUND_NAME, x:[15,16], y:[12,13], extraCells:[[14,11],[14,12],[14,13]] },
	51: { type: GROUND_NAME, x:[17,18], y:[12,13], extraCells:[[19,13],[20,13],[21,13]] },
	52: { type: BUILDING_NAME, x:[19,21], y:[11,12], b:{h:20,d:20} },
	53: { type: GROUND_NAME, x:[22,23], y:[10,12], extraCells:[[22,13]] },
	54: { type: GROUND_NAME, x:[19,21], y:[10,10] },
	55: { type: BUILDING_NAME, x:[19,21], y:[8,9],  b:{h:20,d:20} },
	56: { type: GROUND_NAME, x:[22,23], y:[8,9],  extraCells:[[22,7]] },
	57: { type: GROUND_NAME, x:[19,21], y:[7,7] },
	58: { type: GROUND_NAME, x:[15,18], y:[7,7] },
	59: { type: AROUND_THE_FLAG_NAME, x:[15,16], y:[8,9] },
	60: { type: AROUND_THE_FLAG_NAME, x:[15,16], y:[10,11] },
	61: { type: AROUND_THE_FLAG_NAME, x:[17,18], y:[10,11] },
	62: { type: AROUND_THE_FLAG_NAME, x:[17,18], y:[8,9] },
	63: { type: FLAG_NAME, x:[16,17], y:[9,10], b:{h:0,d:0} },
};

/**
 * Zwraca listę wszystkich kratek należących do danego sektora.
 * Uwzględnia special-case'y (żółte pola oraz kształty custom).
 */
 const _sectorCellsCache = new Map();
export function enumerateSectorCells(id){
	
if (_sectorCellsCache.has(id)) return _sectorCellsCache.get(id);

  const s = sectors[id];
  let cells = [];
  if (!s) { _sectorCellsCache.set(id, cells); return cells; }

  // prostokąt bazowy
  for (let x = s.x[0]; x <= s.x[1]; x++){
    for (let y = s.y[0]; y <= s.y[1]; y++){
      cells.push([x,y]);
    }
  }

  // dodatkowe niestandardowe kratki
  if (s.extraCells) cells.push(...s.extraCells);

  // korekty dla żółtych dookoła flagi
  if (s.type === 'around_flag'){
    const sid = String(id);
    if (sid === '59') cells = [[15,8],[15,9],[16,8]];
    if (sid === '62') cells = [[15,10],[15,11],[16,11]];
    if (sid === '60') cells = [[17,8],[18,8],[18,9]];
    if (sid === '61') cells = [[17,11],[18,10],[18,11]];
  }

  // kształty custom
  if (String(id) === '33'){
    cells = [[6,6],[6,7],[6,8],[6,9],[7,6],[7,7],[7,8],[7,9],[8,8],[8,9]];
  }
  if (String(id) === '32'){
    cells = [];
    for (let x=6; x<=7; x++) for (let y=10; y<=14; y++) cells.push([x,y]);
    for (let y=10; y<=12; y++) cells.push([8,y]);
  }
  if (String(id) === '31'){
    cells = [[6,15],[7,15]];
    for (let x=6; x<=10; x++) for (let y=16; y<=17; y++) cells.push([x,y]);
  }
  if (String(id) === '45'){
    cells = [[11,7],[10,8],[10,9],[11,8],[11,9]];
  }
  if (String(id) === '46'){
    cells = [[10,10],[10,11],[10,12],[11,10],[11,11],[11,12],[11,13]];
  }

  
// deduplikacja (gdyby coś się nakładało)
  const uniq = Array.from(new Set(cells.map(([x,y])=>`${x}-${y}`)))
                    .map(k => k.split('-').map(Number));

  _sectorCellsCache.set(id, uniq);
  return uniq;

}

/*
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

  // korekty dla żółtych dookoła flagi
  if (s.type === 'around_flag'){
    const sid = String(id);
    if (sid === '59') cells = [[15,8],[15,9],[16,8]];
    if (sid === '62') cells = [[15,10],[15,11],[16,11]];
    if (sid === '60') cells = [[17,8],[18,8],[18,9]];
    if (sid === '61') cells = [[17,11],[18,10],[18,11]];
  }

  // kształty custom
  if (String(id) === '33'){
    cells = [[6,6],[6,7],[6,8],[6,9],[7,6],[7,7],[7,8],[7,9],[8,8],[8,9]];
  }
  if (String(id) === '32'){
    cells = [];
    for (let x=6; x<=7; x++) for (let y=10; y<=14; y++) cells.push([x,y]);
    for (let y=10; y<=12; y++) cells.push([8,y]);
  }
  if (String(id) === '31'){
    cells = [[6,15],[7,15]];
    for (let x=6; x<=10; x++) for (let y=16; y<=17; y++) cells.push([x,y]);
  }
  if (String(id) === '45'){
    cells = [[11,7],[10,8],[10,9],[11,8],[11,9]];
  }
  if (String(id) === '46'){
    cells = [[10,10],[10,11],[10,12],[11,10],[11,11],[11,12],[11,13]];
  }

  return cells;
}

*/



/**
 * Buduje mapę komórka -> sektor w obiekcie stanu gry.
 * Mutuje: game.cellToSector (Map<string, string>).
 */
export function buildCellMap(game){
  game.cellToSector.clear();
  _sectorCellsCache?.clear?.(); // wyczyść cache jeśli zmieniasz geometrię sektorów

  for (const id in sectors){
    for (const [x,y] of enumerateSectorCells(id)){
      game.cellToSector.set(`${x}-${y}`, id);
    }
  }
}

/*
export function buildCellMap(game){
  game.cellToSector.clear();
  for (const id in sectors){
    for (const [x,y] of enumerateSectorCells(id)){
      game.cellToSector.set(`${x}-${y}`, id);
    }
  }

  //console.log("function buildCellMap, kratka 24-13 należy do sektora: ", game.cellToSector.get('24-13'));
}
*/

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
const _adjCache = new Map();

export function getAdjacentSectors(sectorId, game){
  const key = sectorId;
  if (_adjCache.has(key)) return _adjCache.get(key);

  const cur = sectors[sectorId];
  if (!cur) return [];

  const adj = new Set();
  for (const [x,y] of enumerateSectorCells(sectorId)){
    for (const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0]]){
      const nx = x + dx, ny = y + dy;
      if (nx<0 || nx>=GRID_W || ny<0 || ny>=GRID_H) continue;
      const sid = game.cellToSector.get(`${nx}-${ny}`);
      if (sid && sid !== sectorId) adj.add(sid);
    }
  }
  const res = Array.from(adj);
  _adjCache.set(key, res);
  return res;
}

/*
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
*/


/**
 * Zwraca true, jeśli kratka (x,y) należy do sektora startowego danej strony.
 * side: 'att' | 'def'
 */
export function canSetInTheSector(side, x, y, game){
  const sid = game.cellToSector.get(`${x}-${y}`); // string ID sektora
  if (!sid) return false;
  return side === game.attackersSign ? ATTACKER_SET.has(sid) : DEFENDER_SET.has(sid);
}


function buildAdjacencyListing(game){
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