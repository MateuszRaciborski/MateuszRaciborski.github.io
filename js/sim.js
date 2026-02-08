// js/sim.js
import { losVisible } from './geometry.js';
import { draw, update, computeHitChance } from './rendering.js';
import { aiPlanMoves } from './ai/attackers.js';
import { enumerateSectorCells } from './sectors.js';
import { CELL } from './constants.js';
import { canEnterToSector } from './rules.js';


/* ============================
 *  Stałe i logging
 * ============================ */
/*
const BULLET_SPEED = 0.5;
const DEF_SHOT_DELAY_MS = 111;
const ATT_SHOT_DELAY_MS = 66;
const HIT_FLASH_MS = 120;
*/

// do trenowania
const BULLET_SPEED = 50;
const DEF_SHOT_DELAY_MS = 1;
const ATT_SHOT_DELAY_MS = 1;
const HIT_FLASH_MS = 1;



// Dodaje wpis do panelu logów w DOM.
function log(game, msg, type = 'info') {
	
	return; //do trenowania
	
  const div = document.createElement('div');
  div.className = `log-entry log-${type}`;
  div.textContent = msg;
  const L = document.getElementById('log');
  if (L) { L.appendChild(div); L.scrollTop = 1e9; }
}

// Dodaje nagłówek rundy do logu.
function logRoundHeader(game) {
	
	return; //do trenowania
	
  const L = document.getElementById('log');
  if (!L) return;
  const div = document.createElement('div');
  div.className = 'log-entry log-victory';
  div.textContent = `RUNDA ${game.round}`;
  L.appendChild(div);
  L.scrollTop = 1e9;
}

// Dodaje wpis o strzale do logu.
function logShot(game, { team, text }) {
	
	return; //do trenowania
	
  const L = document.getElementById('log');
  if (!L) return;
  const div = document.createElement('div');
  div.className = `log-entry log-attack ${team === 'att' ? 'log-red' : 'log-blue'}`;
  div.textContent = text;
  L.appendChild(div);
  L.scrollTop = 1e9;
}

/* ============================
 *  Pociski
 * ============================ */
 
 // Animuje pocisk od strzelającego do celu z opóźnieniem.
function launchProjectileWithDelay(game, shooter, target, delayMs) {
	
	
	if (game.noAnimation) return Promise.resolve({ shooter, target, t:1 });
	
	
  return new Promise(resolve => {
    setTimeout(() => {
      const fx = shooter.x * CELL + CELL / 2;
      const fy = shooter.y * CELL + CELL / 2;
      const tx = target.x  * CELL + CELL / 2;
      const ty = target.y  * CELL + CELL / 2;
      const dist = Math.hypot(tx - fx, ty - fy);
      const dur = Math.max(120, dist / BULLET_SPEED);

      const projectile = { shooter, target, fx, fy, tx, ty, t: 0, start: Date.now(), dur };
      if (!Array.isArray(game.projectiles)) game.projectiles = [];
      game.projectiles.push(projectile);

      function tick() {
        const now = Date.now();
        projectile.t = Math.min(1, (now - projectile.start) / projectile.dur);
        draw(game);
        if (projectile.t < 1) {
          requestAnimationFrame(tick);
        } else {
          const i = game.projectiles.indexOf(projectile);
          if (i >= 0) game.projectiles.splice(i, 1);
          draw(game);
          resolve(projectile);
        }
      }
      requestAnimationFrame(tick);
    }, delayMs);
  });
}

window.launchProjectileWithDelay = launchProjectileWithDelay;

/* ============================
 *  Flagi / wygrana
 * ============================ */
 
// Sprawdza, czy współrzędne (x, y) mieszczą się w 2×2 polu flagi.
function inFlagCell(x, y) { return (x === 16 || x === 17) && (y === 9 || y === 10); }

// sprawdza, czy jacykolwiek atakujący stoją na polu flagi przez kilka kolejnych tur
export function checkFlag(game) {
  const cnt = game.attackers.filter(u => u.hp > 0 && inFlagCell(u.x, u.y)).length;
  if (cnt > 0) {
    game.flagCount++;
    if (game.flagCount >= 5) endGame(game, 'att');
  } else {
    game.flagCount = 0;
  }
}

// sprawdza, czy któraś strona straciła wszystkie jednostki żywe.
export function checkWin(game) {
  const a = game.attackers.filter(u => u.hp > 0).length;
  const d = game.defenders.filter(u => u.hp > 0).length;
  if (a === 0) endGame(game, 'def');
  else if (d === 0) endGame(game, 'att');
}

// ustawia grę jako zakończoną i wyświetla komunikat o zwycięzcy.
export function endGame(game, winner) {
  game.over = true;
  game.winner = winner;
  const msg = (winner === 'att') ? 'Atakujący przejęli fort!' : 'Obrońcy utrzymali fort!';
  log(game, msg, 'victory');
  update(game);
}


function getAllUnits(game) {
  return [...game.attackers, ...game.defenders];
}

// Zwraca tablicę obiektów żyjących obrońców lub atakujących w kolejności po ID
function getUnitsSorted(game, type) {
  const prefix = type === "att" ? "a" : "d";

  const list = getAllUnits(game).filter(u => u.hp > 0 && u.id.startsWith(prefix));

  return list
    .slice()
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

// używane tylko na początku rozpoczęcia gry, do zainicjalizowania na których kratkach stoją gracze
export function buildUnitsPositions(game) {
	const rows = 24;
	const cols = 34
	const units = getAllUnits(game);
	
  // 1) pusta mapa 0
  const unitsPositions = Array.from({ length: rows }, () => Array(cols).fill(0));

  // 2) zaznacz jednostki (1) – zakładamy u: {x, y, hp}
  for (const u of units) {
    if (!u || u.hp <= 0) continue;
    const { x, y } = u;
    if (Number.isFinite(x) && Number.isFinite(y) && y >= 0 && y < rows && x >= 0 && x < cols) {
      unitsPositions[y][x] = 1;
    }
  }

   return unitsPositions;
}

// type podajemy "att" albo "def"
function moveUnits(game, type) {
  const units = getUnitsSorted(game, type);
  
  //console.log("UNITS"); console.log(units);
  //console.log("PLANNED MOVES"); console.log(game.plannedMoves);
  
  //najpierw sprawdzamy czy ktoś ma rotację zatwierdzoną
  checkRotations(game, type);
  //console.log(game.rotateUnits);
  
  
  for (const unit of units) {
    const plannedMove = game.plannedMoves?.[unit.id];
	
	// tu bierzemy po kolei każdego obrońcę lub atakującego
    if (plannedMove && plannedMove.x != null && plannedMove.y != null) {
      //console.log(`${unit.id} ma ruch do kratki ${plannedMove.x} - ${plannedMove.y}`);
	  
	  // i rozpatrujemy ten pojedynczy ruch
	  considerTheMove(game, unit, plannedMove.x, plannedMove.y);
	  //console.log("game.unitsPositions"); console.log(game.unitsPositions);
    } else {
      //console.log(`${unit.id} nie zaplanował ruchu`);
    }
  }
}

function bestFreeCellInThisSector(game, sector, toX, toY) {
  const map = game.unitsPositions;
  const rows = map.length;
  const cols = map[0]?.length || 0;
  
  let bestCellInThisSector = null;

  const isFree = (x, y) =>
    y >= 0 && y < rows && x >= 0 && x < cols && map[y][x] === 0;

  // 1) Jeśli cel (toX, toY) jest wolny → zwróć go
  if (isFree(toX, toY)) {
	  bestCellInThisSector = { x: toX, y: toY };
	return bestCellInThisSector;
  }	 

  // 2) Szukaj najbliższej wolnej komórki w danym sektorze
  let bd = Infinity;
  for (const [sx, sy] of enumerateSectorCells(sector)) {
	  //console.log("rozpatruję komórkę:"); console.log(sx, sy);
    if (!isFree(sx, sy)) continue;
    const d = Math.abs(sx - toX) + Math.abs(sy - toY);
    if (d < bd) {
		bd = d;
		bestCellInThisSector = { x: sx, y: sy };
	}
  }

	if(bestCellInThisSector) {
		//console.log("bestCellInThisSector"); console.log(bestCellInThisSector);
		return bestCellInThisSector;
	} else{
		//console.log("Nie znaleziono wolnej komórki w sektorze, gracz zostaje na miejscu");
		return false;
	}
}


// Zwraca { x, y } środka sektora (najbliższa komórka do centroidu) albo null, gdy pusty.
function getSectorCenter(game, sectorId) {
  let sumx = 0, sumy = 0, n = 0;
  const cells = [];
  for (const [x, y] of enumerateSectorCells(String(sectorId))) {
    cells.push([x, y]);
    sumx += x; sumy += y; n++;
  }
  if (n === 0) return null;

  const cx = sumx / n, cy = sumy / n; // centroid (float)

  // wybierz komórkę sektora najbliższą centroidowi
  let best = null, bd = Infinity;
  for (const [x, y] of cells) {
    const d = Math.abs(x - cx) + Math.abs(y - cy); // Manhattan do centroidu
    if (d < bd) { bd = d; best = { x, y }; }
  }
  return best;
}


function transformAIAttackersPlanIntoPlannedMoves(game, plan) {
	for (const id in plan) {
	  if (!plan.hasOwnProperty(id)) continue;
	  const data = plan[id];
	  //console.log("PLAN id, data"); console.log(id, data);
	  
	  let sectorCenter = getSectorCenter(game, data['sec']);
	  
	  if (sectorCenter && Number.isFinite(sectorCenter.x) && Number.isFinite(sectorCenter.y)) {
			game.plannedMoves[id] = { x: sectorCenter.x, y: sectorCenter.y };
		}
	}
	
	// console.log("AKTUALIZACJA MAPY przez atakujących");
	moveUnits(game, "att");
	// console.log(game.plannedMoves);
    // console.log(game.unitsPositions);
}


// type "def" lub "att"
function checkRotations(game, type) {
  const team = (type === 'def' ? game.defenders : game.attackers) || [];
  const pm = game.plannedMoves || {};

  // tylko żywi z tej strony
  const alive = team.filter(u => u && u.hp > 0);

  // mapy pomocnicze
  const idByPos = new Map(alive.map(u => [ `${u.x}-${u.y}`, String(u.id) ]));
  const posById = new Map(alive.map(u => [ String(u.id), `${u.x}-${u.y}` ]));

  const unitsToRotate = [];
  const seen = new Set(); // żeby nie dublować tej samej pary

  for (const u of alive) {
    const a = String(u.id);
    const wishA = pm[a];
    if (!wishA || wishA.x == null || wishA.y == null) continue;

    const targetKeyA = `${wishA.x}-${wishA.y}`;
    const b = idByPos.get(targetKeyA);       // kto stoi na polu, na które chce A
    if (!b || b === a) continue;             // brak lub to samo ID

    const wishB = pm[b];
    if (!wishB || wishB.x == null || wishB.y == null) continue;

    const aPosKey = posById.get(a);
    const bWantsA = (`${wishB.x}-${wishB.y}` === aPosKey);
    if (!bWantsA) continue; // nie ma wzajemności

    // unikalność pary
    const key = [a, b].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    unitsToRotate.push(a);
	unitsToRotate.push(b);
  }

  // zapisz wynik
  if (!game.rotateUnits) game.rotateUnits = { };

  game.rotateUnits = unitsToRotate;
  return unitsToRotate;
}

function considerTheMove(game, unit, toX, toY) {
	
  //console.log("considerTheMove");
  //console.log("unit"); console.log(unit);
  
  let unitTeam = unit.team;
  let unitFromX = unit.x;
  let unitFromY = unit.y;
  
  let finalX = unitFromX;
  let finalY = unitFromY;
  
  //najpierw sprawdzamy czy sektor jest wolny
  let canEnterToSectorOrNo = canEnterToSector(game, unitTeam, unitFromX, unitFromY, toX, toY);
  
  //console.log("canEnterToSectorOrNo"); console.log(canEnterToSectorOrNo);
  
  let goingToRotate = Array.isArray(game.rotateUnits) && game.rotateUnits.includes(unit.id);
  
  //console.log("goingToRotate = ", goingToRotate);
  
  if (goingToRotate) {
	  finalX = toX;
	  finalY = toY;
  } else if (canEnterToSectorOrNo) {
	  // można wejść do sektora, sprawdzamy czy kratka celowana jest pusta
	  const targetSectorId = game.cellToSector.get(`${toX}-${toY}`);
	  // console.log("targetSectorId"); console.log(targetSectorId);
	  
	  //console.log("dla gracza: ", unit.id);
	  let canGoToThisSectorAndWhichCellOrNo = bestFreeCellInThisSector(game, targetSectorId, toX, toY);
	  // console.log("canGoToThisSectorAndWhichCellOrNo"); console.log(canGoToThisSectorAndWhichCellOrNo);
		  
	  if (canGoToThisSectorAndWhichCellOrNo) {
		  //console.log("Pujde do tej komorki:"); console.log(canGoToThisSectorAndWhichCellOrNo);
		  finalX = canGoToThisSectorAndWhichCellOrNo.x;
		  finalY = canGoToThisSectorAndWhichCellOrNo.y;
	  }
  }
  
  // plannedMoves po wywołaniu dla atakujących i obrońców ma już prawilne ruchy tylko do wyanimowania ich
  game.plannedMoves[unit.id] = { 'x': finalX, 'y': finalY };
  updateUnitsPositions(game, "delete", unitFromX, unitFromY);
  updateUnitsPositions(game, "set", finalX, finalY);
}

// action: "set" | "delete"
function updateUnitsPositions(game, action, x, y) {
  const map = game.unitsPositions;
  if (!map || !map.length) return false;

  const rows = map.length, cols = map[0].length;
  if (y < 0 || y >= rows || x < 0 || x >= cols) return false;

  map[y][x] = (action === "set") ? 1 : 0;
  return true;
}





// type: 'att' lub 'def'
// Działa TYLKO jako animator: bierze pozycje z game.plannedMoves[id] i
// animuje from -> to, po czym commit (u.x/u.y) = plannedMoves.
export async function moveUnitsFromTeam(game, type) {
  const pm = game.plannedMoves || {};
  const team = (type === 'def' ? game.defenders : game.attackers) || [];

  // zbuduj listę ruchów: id -> {x,y} z plannedMoves
  const moves = {};
  for (const u of team) {
    if (!u || u.hp <= 0) continue;
    const id = String(u.id);
    const wish = pm[id];
    if (!wish || wish.x == null || wish.y == null) continue;
    // jeśli chcesz animować także stanie w miejscu — usuń ten warunek:
    if (u.x === wish.x && u.y === wish.y) continue;
    moves[id] = { x: wish.x, y: wish.y };
  }

  const ids = Object.keys(moves);
  if (!ids.length) return;

  // animacja
  const dur = 350, start = Date.now();
  game.movingUnits = {};
  for (const id of ids) {
    const u = team.find(x => String(x.id) === id && x.hp > 0);
    const d = moves[id];
    if (!u || !d) continue;
    game.movingUnits[id] = { from: { x: u.x, y: u.y }, to: { x: d.x, y: d.y }, t: 0 };
  }

  await new Promise(resolve => {
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / dur);
      for (const id in game.movingUnits) game.movingUnits[id].t = t;
      draw(game);

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        // commit dokładnie do plannedMoves
        for (const id of ids) {
          const u = team.find(x => String(x.id) === id && x.hp > 0);
          const d = moves[id];
          if (!u || !d) continue;
          u.x = d.x;
          u.y = d.y;
          u.m = true;
        }
        game.movingUnits = {};
        resolve();
      }
    };
    requestAnimationFrame(tick);
  });
}

window.moveUnitsFromTeam = moveUnitsFromTeam;


/* ============================
 *  Oznaczanie rotacji w planie na mapie gracza
 * ============================ */
export function markRotationsInPlan(game, plan, side) {
  const p = { ...(plan || {}) };
  const team = side === 'def' ? game.defenders : game.attackers;

  // pozycja -> id tylko dla żywych z tej drużyny
  const pos2Id = new Map(
    team.filter(u => u.hp > 0).map(u => [`${u.x}-${u.y}`, String(u.id)])
  );

  const marked = new Set();

  for (const id of Object.keys(p)) {
    if (marked.has(String(id))) continue;

    const u = team.find(x => String(x.id) === String(id) && x.hp > 0);
    const d = p[id];
    if (!u || !d || d.x == null || d.y == null) continue;

    // kto stoi na polu, na które celuje id?
    const otherId = pos2Id.get(`${d.x}-${d.y}`);
    if (!otherId || String(otherId) === String(id)) continue;

    const v  = team.find(x => String(x.id) === String(otherId) && x.hp > 0);
    const dv = p[otherId];
    if (!v || !dv || dv.x == null || dv.y == null) continue;

    // wzajemność: on chce moje pole, ja chcę jego
    if (dv.x === u.x && dv.y === u.y) {
      p[id]       = { ...d,   rot: true, color: 'green' };
      p[otherId]  = { ...dv,  rot: true, color: 'green' };
      marked.add(String(id));
      marked.add(String(otherId));
    }
  }

  return p;
}



async function shootPhase(game, side /* 'def' | 'att' */) {
  const isDef = side === 'def';
  const shootersTeam = isDef ? game.defenders : game.attackers;
  const targetsTeam  = isDef ? game.attackers : game.defenders;
  const delayStep    = isDef ? DEF_SHOT_DELAY_MS : ATT_SHOT_DELAY_MS;
  const teamKey      = isDef ? 'def' : 'att';

  const promises = [];
  let delay = 0;

  const tmpHP = new Map(targetsTeam.map(u => [u.id, u.hp]));
  const shooters = [...shootersTeam]
    .filter(u => u.hp > 0 && !u.s)
    .sort((a, b) => ('' + a.id).localeCompare('' + b.id));

  for (const sh of shooters) {
    const visible = targetsTeam.filter(t =>
      tmpHP.get(t.id) > 0 &&
      t.hp > 0 &&
      losVisible(sh.x, sh.y, t.x, t.y, game)
    );
    if (!visible.length) continue;

    const target = visible.reduce((c, e) => {
      const d1 = Math.abs(e.x - sh.x) + Math.abs(e.y - sh.y);
      const d2 = Math.abs(c.x - sh.x) + Math.abs(c.y - sh.y);
      return d1 < d2 ? e : c;
    });

    const chance = computeHitChance(game, sh, target);
    const hit = Math.random() * 100 < chance;
    const dmg = hit ? (120 + Math.floor(Math.random() * 81)) : 0;

    if (hit) tmpHP.set(target.id, tmpHP.get(target.id) - dmg);

    if (hit) {
      target.hp -= dmg;
      if (target.hp <= 0 && !target.deadPending) target.deadPending = true;
      logShot(game, { team: teamKey, text: `${sh.id} → ${target.id}: -${dmg}HP` });
      if (target.hp <= 0) logShot(game, { team: teamKey, text: `${target.id} wyeliminowany` });
    } else {
      logShot(game, { team: teamKey, text: `${sh.id} → ${target.id}: pudło (${chance}%)` });
    }

    update(game);
    draw(game);

    const p = launchProjectileWithDelay(game, sh, target, delay)
      .then(() => {
        if (hit) {
          game.hitFlashes[target.id] = { start: Date.now(), dur: HIT_FLASH_MS };
          if (target.deadPending) {
            target.hp = 0;
            target.deadPending = false;

            // zwolnij pole na mapie po śmierci
            updateUnitsPositions(game, "delete", target.x, target.y);
          }
          update(game);
          draw(game);
        }
      });

    promises.push(p);
    delay += delayStep;
    sh.s = true;
  }

  if (promises.length) await Promise.all(promises);
}



/* ============================
 *  Główna funkcja fazy
 * ============================ */
export async function phase(game) {
  switch (game.phase) {
    // (1) DEF – strzelanie
    case 1: {
      await shootPhase(game, 'def');
      break;
    }

    // (2) DEF – ruch
    case 2: {
      moveUnits(game, "def");
      const raw = game.plannedMoves || {};
      if (Object.keys(raw).length > 0) {
        await moveUnitsFromTeam(game, "def");
      }

      // reset, aby faza 4 nie zrobiła ponownie rotacji
      game.plannedMoves = {};
      if (game.turnPlans?.def) game.turnPlans.def = {};
      if (game.ui?.plannedMoves) game.ui.plannedMoves = {};
      break;
    }

    // (3) ATT – strzelanie
    case 3: {
      await shootPhase(game, 'att');
      break;
    }

    // (4) ATT – ruch
    case 4: {
      transformAIAttackersPlanIntoPlannedMoves(game, game.turnPlans.att);
      await await moveUnitsFromTeam(game, "att");
      checkFlag(game);
      break;
    }
  }

  // --- KONIEC FAZY ---
  checkWin(game);

  // następna faza
  game.phase++;

  // reset po fazie 4
  if (game.phase > 4) {
    game.phase = 0;
    game.round++;

    game.playerMoved = false;

    game.timer = 65;
    game.selected = null;
    game.hoverCell = null;
    game.hoverFOV = null;

    game.attackers.forEach(u => { u.m = false; u.s = false; });
    game.defenders.forEach(u => { u.m = false; u.s = false; });

    const attPlanPreview = aiPlanMoves(game) || {};
    game.turnPlans = {
      def: {},
      att: markRotationsInPlan(game, attPlanPreview, 'att')
    };

    game._roundAnnounced = false;

    if (game.round > 55) endGame(game, 'def');
  }

  update(game);
  draw(game);
}

/* ============================
 *  Orkiestracja tury
 * ============================ */
export const delay = ms => new Promise(r => setTimeout(r, ms));


export async function runTurnPhases(game) {
  if (game.processingTurn || game.over) return;
  game.processingTurn = true;

  try {
    // PHASE 0 – generowanie planów (z zaznaczeniem rotacji)
    {
      if (game.phase === 0 && !game._roundAnnounced) {
        logRoundHeader(game);
        game._roundAnnounced = true;
      }

      const attPlanRaw = aiPlanMoves(game) || {};
      const attPlan = markRotationsInPlan(game, attPlanRaw, 'att');
	  const defPlan = markRotationsInPlan(game, game.plannedMoves || {}, 'def');
	  
      game.turnPlans = { def: defPlan, att: attPlan };
	  
	  if (!game.movingUnits) game.movingUnits = {};

      update(game);
      draw(game);
    }

    if (game.phase === 0) game.playerMoved = true;

	/*
    await phase(game); if (game.over) return;
    await delay(400); await phase(game); if (game.over) return;
    await delay(400); await phase(game); if (game.over) return;
    await delay(400); await phase(game); if (game.over) return;
    await delay(400); await phase(game);
	*/
	
	// do trenowania
	await phase(game); if (game.over) return;
    await phase(game); if (game.over) return;
    await phase(game); if (game.over) return;
    await phase(game); if (game.over) return;
    await phase(game);
	
	
  } finally {
    game.processingTurn = false;
    update(game);
    draw(game);
  }
}

window.runTurnPhases = runTurnPhases;


function translateDefSectorPlanToCells(game, rawPlan) {
  // helpery
  const getSectorId = (x, y) => {
    const v = game.cellToSector.get(`${x}-${y}`);
    return v ? String(v) : null;
  };

  const sectorCells = (sid) => {
    const out = [];
    const want = String(sid);
    for (const [k, v] of game.cellToSector.entries()) {
      if (String(v) === want) {
        const [sx, sy] = k.split('-').map(Number);
        out.push([sx, sy]);
      }
    }
    return out;
  };

  const isOccupied = (x, y) => {
    for (const u of [...game.attackers, ...game.defenders]) {
      if (u.hp > 0 && u.x === x && u.y === y) return true;
    }
    return false;
  };

  const bestFreeCellInSectorNear = (sid, refx, refy, reserved = new Set()) => {
    let best = null, bd = Infinity;
    for (const [sx, sy] of sectorCells(sid)) {
      const key = `${sx}-${sy}`;
      if (reserved.has(key)) continue;
      if (isOccupied(sx, sy)) continue;
      const d = Math.abs(sx - refx) + Math.abs(sy - refy);
      if (d < bd) { bd = d; best = { x: sx, y: sy }; }
    }
    return best;
  };

  // sektory zablokowane przez ATT (jak w moveDefenders)
  const blockedSectors = new Set();
  for (const a of game.attackers) {
    if (a.hp <= 0) continue;
    const s = getSectorId(a.x, a.y);
    if (s != null) blockedSectors.add(String(s));
  }

  const out = {};
  const reserved = new Set();

  for (const d of game.defenders) {
    if (d.hp <= 0) continue;
    const id = String(d.id);
    const wish = rawPlan?.[id];
    if (!wish) continue;

    // wspieramy dwa formaty: {"sec": "..."} (nowy) oraz {"x":..,"y":..} (stary)
    let toSec = null;
    if (wish.sec != null) {
      toSec = String(wish.sec);
    } else if (wish.x != null && wish.y != null) {
      toSec = getSectorId(wish.x, wish.y);
    }
    if (!toSec) continue;

    const fromSec = getSectorId(d.x, d.y);

    // zakaz wejścia do sektora z ATT, jeśli to inny sektor
    if (toSec !== fromSec && blockedSectors.has(String(toSec))) {
      continue;
    }

    const target = bestFreeCellInSectorNear(toSec, d.x, d.y, reserved);
    if (target) {
      const key = `${target.x}-${target.y}`;
      if (!reserved.has(key) && !isOccupied(target.x, target.y)) {
        out[id] = { x: target.x, y: target.y };
        reserved.add(key);
      }
    }
  }

  // jeśli nic nie przetłumaczono (np. brak wolnych pól), zwróć oryginał
  return Object.keys(out).length ? out : (rawPlan || {});
}