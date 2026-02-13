// js/sim.js
// główna logika

import { losVisible } from './geometry.js';
import { draw, update, computeHitChance } from './rendering.js';
import { aiAttackersPlanMovesToSectors } from './ai/attackers.js';
import { enumerateSectorCells } from './sectors.js';
import { GRID_H, GRID_W, CELL, BULLET_SPEED, DEF_SHOT_DELAY_MS, ATT_SHOT_DELAY_MS, HIT_FLASH_MS } from './constants.js';
import { canEnterToSector } from './rules.js';
import { getAiDefPlan } from './ai/def_controller.js';


function getAllUnits(game) {
  return [...game.attackers, ...game.defenders];
}

// używane tylko na początku gry, po kliknięciu przycisku Rozpocznij grę w startGame(game) w ui.js, do zainicjalizowania na których kratkach stoją gracze
export function buildUnitsPositions(game) {
	const units = getAllUnits(game);
	
  // 1) pusta mapa 0
  const unitsPositions = Array.from({ length: GRID_H }, () => Array(GRID_W).fill(0));

  // 2) zaznacz jednostki
  for (const u of units) {
    if (!u || u.hp <= 0) continue;
    const { x, y } = u;
    if (Number.isFinite(x) && Number.isFinite(y) && y >= 0 && y < GRID_H && x >= 0 && x < GRID_W) {
      unitsPositions[y][x] = 1;
    }
  }

   return unitsPositions;
}


async function shootPhase(game, side /* 'def' | 'att' */) {
  const isDef = side === game.defendersSign;
  const shootersTeam = isDef ? game.defenders : game.attackers;
  const targetsTeam  = isDef ? game.attackers : game.defenders;
  const delayStep    = isDef ? DEF_SHOT_DELAY_MS : ATT_SHOT_DELAY_MS;
  const teamKey      = isDef ? game.defendersSign : game.attackersSign;

  const promises = [];
  let delay = 0;

  const tmpHP = new Map(targetsTeam.map(u => [u.id, u.hp]));
  const shooters = [...shootersTeam]
    .filter(u => u.hp > 0 && !u.alreadyShootedInThisRound)
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
    sh.alreadyShootedInThisRound  = true;
  }

  if (promises.length) await Promise.all(promises);
}





// CEL: spójny plan niezależnie od tego, czy podano sektor czy koordynaty
// ARGUMENTY:
// rawPlan: obiekt typu { id : {x,y} } LUB { id : sektorNumber }
// game: potrzebny tylko do getSectorCenter
// ZWRACA: { id: {x,y} }.
// Obsługuje: liczby (sektor), {x,y}, oraz {sec: number}.
function normalizePlan(game, rawPlan) {
  const out = {};
  for (const id in rawPlan) {
    const v = rawPlan[id];
    if (!v) continue;

    // format 1: liczba → sektor
    if (typeof v === "number") {
      const c = getSectorCenter(game, v);
      if (c && Number.isFinite(c.x) && Number.isFinite(c.y)) out[id] = { x: c.x, y: c.y };
      continue;
    }

    // format 2: { x, y }
    if (v.x != null && v.y != null) {
      out[id] = { x: v.x, y: v.y };
      continue;
    }

    // format 3: { sec: number }
    if (v.sec != null && Number.isFinite(v.sec)) {
      const c = getSectorCenter(game, v.sec);
      if (c && Number.isFinite(c.x) && Number.isFinite(c.y)) out[id] = { x: c.x, y: c.y };
      continue;
    }
  }
  return out;
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



// units: tablica obiektów {id, x, y, team}
// plan:  po normalizePlan → { id : {x,y} }
// game:  potrzebne do canEnterToSector
// ZWRACA: tablicę par [["d1","d2"], ...] które mogą rotować
// WARUNKI ROTACJI:
// 1. A chce wejść na kratkę B
// 2. B chce wejść na kratkę A
// 3. A może wejść do sektora B (canEnterToSector)
// 4. B może wejść do sektora A (canEnterToSector)s
function getRotationPairs(units, plan, game) {
  const pos = new Map(units.map(u => [u.id, u]));
  const out = [], seen = new Set();

  for (const a in plan) {
    const aTo = plan[a];
    if (!aTo || aTo.x == null || aTo.y == null) continue;      

    const b = [...pos.values()].find(p => p.x === aTo.x && p.y === aTo.y)?.id;
    if (!b || b === a) continue;

    const bTo = plan[b];
    if (!bTo || bTo.x == null || bTo.y == null) continue;      

    const aPos = pos.get(a), bPos = pos.get(b);
    if (!aPos || !bPos) continue;                              

    if (bTo.x !== aPos.x || bTo.y !== aPos.y) continue;

    if (!canEnterToSector(game, aPos.team, aPos.x, aPos.y, aTo.x, aTo.y)) continue;
    if (!canEnterToSector(game, bPos.team, bPos.x, bPos.y, bTo.x, bTo.y)) continue;

    const key = [a, b].sort().join("|");
    if (!seen.has(key)) { seen.add(key); out.push([a, b]); }
  }
  return out;
}


// ARG: game, type: "def" | "att"
// ZWRACA: żywe jednostki w spójnej kolejności (dla def/att identyczny algorytm)
// FORMAT: [{id, x, y, team, hp}]
function getUnitsSorted(game, teamSign) {
  const source = (teamSign === game.defendersSign) ? game.defenders : game.attackers;

  return source
    .filter(u => u && u.hp > 0)
    .map(u => ({ id: String(u.id), x: u.x, y: u.y, team: u.team, hp: u.hp }))
    .sort((u1, u2) => {
      const [t1, n1] = [u1.id[0], Number(u1.id.slice(1))];
      const [t2, n2] = [u2.id[0], Number(u2.id.slice(1))];
      return (t1 !== t2) ? t1.localeCompare(t2) : (n1 - n2);
    });
}


// rotationPairs: np. [["d1","d2"],["a3","a4"]]
// units: kopie jednostek tylko tej strony (def lub att)
// plan: { id:{x,y} }
// teamSign: "def" | "att"
function applyRotations(game, units, plan, rotationPairs, teamSign) {
	
	/*
	console.log("APPLY ROTATIONS");
	console.log("units = ", units);
	console.log("plan = ", plan);
	console.log("rotationPairs = ", rotationPairs);
	console.log("teamSign = ", teamSign);
	*/
	
	let idStart = null;
	let animBuffer;
	if (teamSign === game.defendersSign) {
		idStart = 'd';
		animBuffer = game.defUnitsMoveAnimations;
	} else if(teamSign === game.attackersSign) {
		idStart = 'a';
		animBuffer = game.attUnitsMoveAnimations;
	} else {
		console.log("ERROR: applyRotations nie rozpoznano teamSign");
		return;
	}
		
  for (const [a, b] of rotationPairs) {
	  
	  //console.log("FOR rotationsPairs");

    // obie jednostki muszą należeć do tej samej strony (id zaczyna się od d lub a)
    if (!a.startsWith(idStart) || !b.startsWith(idStart)) {
      continue;
    }

    const aPos = units.find(u => u.id === a);
    const bPos = units.find(u => u.id === b);
    if (!aPos || !bPos) continue;

    const aTo = plan[a];
    const bTo = plan[b];
    if (!aTo || !bTo) continue;

    // animacja rotacji
    animBuffer.push({ id: a, x: aPos.x, y: aPos.y, toX: aTo.x, toY: aTo.y });
    animBuffer.push({ id: b, x: bPos.x, y: bPos.y, toX: bTo.x, toY: bTo.y });
	
    // aktualizacja mapy
    updateUnitsPositions(game, "delete", aPos.x, aPos.y);
    updateUnitsPositions(game, "delete", bPos.x, bPos.y);
    updateUnitsPositions(game, "set", aTo.x, aTo.y);
    updateUnitsPositions(game, "set", bTo.x, bTo.y);
  }
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


// 1) zrób zbiór ID, które już wykonały rotację
function rotatedIdSet(rotationPairs) {
  const s = new Set();
  for (const [a,b] of rotationPairs) { s.add(String(a)); s.add(String(b)); }
  return s;
}


function removeRotatedInPlace(units, rotationPairs) {
  const ids = rotatedIdSet(rotationPairs);
  for (let i = units.length - 1; i >= 0; i--) {
    if (ids.has(String(units[i].id))) units.splice(i, 1);
  }
}


function isFreeCell(map, x, y) {
  const rows = map.length, cols = map[0].length;
  return y >= 0 && y < rows && x >= 0 && x < cols && map[y][x] === 0;
}

function directTargetCell(map, toX, toY) {
  return isFreeCell(map, toX, toY)
    ? { x: toX, y: toY }
    : null;
}


function bestCellInSector(map, sector, toX, toY) {
  let best = null, bd = Infinity;
  for (const [x, y] of enumerateSectorCells(sector)) {
    if (!isFreeCell(map, x, y)) continue;
    const d = Math.abs(x - toX) + Math.abs(y - toY);
    if (d < bd) { bd = d; best = { x, y }; }
  }
  return best;
}

function bestFreeCellInThisSector(game, sector, toX, toY) {
  const map = game.unitsPositions;
  const direct = directTargetCell(map, toX, toY);
  if (direct) return direct;
  const best = bestCellInSector(map, sector, toX, toY);
  return best || false;
}



// units: tablica jednostek danej strony, BEZ rotujących
// plan: { id: {x,y} }
// game: stan gry (mapa, animacje, itd.)
function runRemainingMovesAfterRotations(game, units, plan) {
  //console.log("=== ROZPATRZANIE POZOSTAŁYCH RUCHÓW ===");

  for (const unit of units) {
    const move = plan[unit.id];

    if (!move) {
      //console.log(`BRAK PLANU (${unit.id}) → zostaje w miejscu`);
      continue;
    }

    //console.log(`--> PRÓBA RUCHU (${unit.id}) do [${move.x},${move.y}]`);
    tryMoveUnit(game, unit, move);
  }

  //console.log("=== KONIEC RUCHÓW ZWYKŁYCH ===");
}

function tryMoveUnit(game, unit, planXY) {
  const fromX = unit.x, fromY = unit.y;
  const toX   = planXY.x, toY = planXY.y;
  
	// przypadek: AI ustawia ruch na siebie — nic nie robimy
	if (fromX === toX && fromY === toY) {
		//console.log(`POMINIĘTO (${unit.id}): ruch na siebie [${fromX},${fromY}]`);
		return;
	}

  if (!checkSectorEntry(game, unit, fromX, fromY, toX, toY)) return;

  const best = findBestCellInSector(game, unit, toX, toY);
  if (!best) return;

  const movedDirect = (best.x === toX && best.y === toY);
  //console.log(movedDirect ? `PRZESUNIĘCIE (${unit.id}): na [${best.x},${best.y}]` : `PRZESUNIĘCIE WARUNKOWE (${unit.id}): na [${best.x},${best.y}]`);

  addMoveAnimation(game, unit, fromX, fromY, best.x, best.y);
  applyMovementToMap(game, fromX, fromY, best.x, best.y);
}

function applyMovementToMap(game, fromX, fromY, toX, toY) {
  updateUnitsPositions(game, "delete", fromX, fromY);
  updateUnitsPositions(game, "set", toX, toY);
}

function addMoveAnimation(game, unit, fromX, fromY, toX, toY) {
  const buff = (unit.team === game.defendersSign)
    ? game.defUnitsMoveAnimations
    : game.attUnitsMoveAnimations;

  buff.push({ id: unit.id, x: fromX, y: fromY, toX, toY });
}

function findBestCellInSector(game, unit, toX, toY) {
  const sectorId = game.cellToSector.get(`${toX}-${toY}`);
  const best = bestFreeCellInThisSector(game, sectorId, toX, toY);

  if (!best) {
    //console.log(`ODMOWA (${unit.id}): brak wolnej kratki w sektorze`);
    return null;
  }
  return best;
}


function checkSectorEntry(game, unit, fromX, fromY, toX, toY) {
  if (!canEnterToSector(game, unit.team, fromX, fromY, toX, toY)) {
    //console.log(`ODMOWA (${unit.id}): sektor blokowany przez wroga`);
    return false;
  }
  return true;
}



// plannedMoves: { id : {x,y} } albo { id : sektor }
// teamSign: game.defendersSign albo game.attackersSign
function runMovementPhase(game, plannedMoves, teamSign) {
  //console.log("=== FAZA RUCHU:", teamSign, "===");

  // 1. Normalizacja planu (zamiana sektorów na koordynaty)
  const plan = normalizePlan(game, plannedMoves);
  //console.log("PLAN NORMALIZED =", plan);

  // 2. Sortowanie jednostek tej strony (kopie, bez niszczenia stanu gry)
  let units = getUnitsSorted(game, teamSign);
  //console.log("UNITS SORTED =", units);

  // 3. Wykrywanie rotacji
  const rotationPairs = getRotationPairs(units, plan, game);
  //console.log("ROTATION PAIRS =", rotationPairs);

  // 4. Rotacje (animacje + aktualizacja mapy)
  applyRotations(game, units, plan, rotationPairs, teamSign);

  /*console.log(
    "ANIMATIONS AFTER ROTATIONS =",
    (teamSign === game.defendersSign
      ? game.defUnitsMoveAnimations
      : game.attUnitsMoveAnimations)
  );*/

  // 5. Usuwamy jednostki rotujące → zostają tylko te, które mają zwykły ruch
  let unitsRemaining = [...units];
  removeRotatedInPlace(unitsRemaining, rotationPairs);
  //console.log("UNITS REMAINING =", unitsRemaining);

  // 6. Normalne ruchy jednostek
  runRemainingMovesAfterRotations(game, unitsRemaining, plan);

  //console.log("=== KONIEC FAZY RUCHU:", teamSign, "===");
}



// 3) (opcjonalnie) Na koniec fazy ruchu obrońców – wyzeruj wszystkie plany człowieka
// Wywołaj po runMovementPhase(...) i playDefAnimations(game) w Phase case 2 (DEF – ruch)
function finalizeDefenderPlansAfterPhase(game) {
  if (game.defendersControl === 'human') {
	  //console.log("finalizeDefenderPlansAfterPhase usuwam plannedMoves po wykonaniu ruchów obrońców");
    game.plannedMoves = {};
  }
}

/* ============================
 *  Główna funkcja fazy
 * ============================ */
export async function phase(game) {

	switch (game.phase) {
		// (1) DEF – strzelanie
		case 1: {
			await shootPhase(game, game.defendersSign);
			break;
		}

		// (2) DEF – ruch
		case 2: {
			//console.log("sim.js, case 2: teraz grą steruje ", game.defendersControl);
			// obrońcami steruje człowiek
			if (game.defendersControl === 'human') {
			
				let plannedMovesByHuman = game.plannedMoves;
				//console.log("plannedMovesByHuman = ", plannedMovesByHuman);
			
				//console.log("START moveDefOrAttAndHumanOrAi");
				//moveDefOrAttAndHumanOrAi(game, plannedMovesByHuman, 'def')
			
			
				//console.log("START runMovementPhase(game, plannedMoves, teamSign)");
				runMovementPhase(game, plannedMovesByHuman, game.defendersSign);
			
				await playDefAnimations(game);
				
				finalizeDefenderPlansAfterPhase(game);

			} else {
				//to ai def plan
				const plannedMovesByAI = await getAiDefPlan(game);
				//console.log("plannedMovesByAI", plannedMovesByAI);
				
				//console.log("START runMovementPhase(game, plannedMoves, teamSign)");
				runMovementPhase(game, plannedMovesByAI, game.defendersSign);
				
				await playDefAnimations(game);
			}
		
			break;
		}

		// (3) ATT – strzelanie
		case 3: {
			await shootPhase(game, game.attackersSign);
			break;
		}

		// (4) ATT – ruch
		case 4: {
			//console.log("game.attackersAIPlannedMoves", game.attackersAIPlannedMoves);
			//console.log("START runMovementPhase(game, plannedMoves, teamSign)");
			runMovementPhase(game, game.attackersAIPlannedMoves, game.attackersSign);
			await playAttAnimations(game);
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

		game.timer = game.roundTime;
		game.selected = null;
		game.hoverCell = null;
		game.hoverFOV = null;

		game.attackers.forEach(u => { u.alreadyMovedInThisRound = false; u.alreadyShootedInThisRound = false; });
		game.defenders.forEach(u => { u.alreadyMovedInThisRound = false; u.alreadyShootedInThisRound = false; });


		if (game.attackersControl === 'ai') {
			//console.log("wygeneruj strzalki dla ai w fazie >4, ale showAIPlans może być false i się nie narysują");
			const aiAttPlans = aiAttackersPlanMovesToSectors(game) || {};
			
			//console.log("aiAttPlans = ", aiAttPlans);
			game.aiAttPlansToDraw = aiAttPlans;
		} else {
			console.log("ERROR: atakującymi nie kieruje AI, brak implementacji tego");
		}
		
		if (game.defendersControl === 'ai') {
			//console.log("wygeneruj strzalki dla ai w fazie >4, ale showAIPlans może być false i się nie narysują");
			const aiDefPlans = await getAiDefPlan(game);
			
			//console.log("aiDefPlans = ", aiDefPlans);
			game.aiDefPlansToDraw = aiDefPlans;
		} else {
			//console.log("obrońcami nie kieruje AI więc nie rysujemy strzałek za pomocą drawAiDefPlans");
		}
		
		game._roundAnnounced = false;
		if (game.round > 55) endGame(game, game.defendersSign);
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
    // PHASE 0 – generowanie planów - obrońcy human generują plany ustawiając strzałki i zapisują się w game.plannedMoves
	// atakujący są AI - generują plan i zapisują go w game.attackersAIPlannedMoves
    {
      if (game.phase === 0 && !game._roundAnnounced) {
        logRoundHeader(game);
        game._roundAnnounced = true;
      }
	  
	  //console.log("teraz jest FAZA 0, czyli planowanie ruchów");
	  
		if (game.attackersControl === 'ai') {
			//console.log("atakującymi kieruje AI");
			const attPlanRaw = aiAttackersPlanMovesToSectors(game) || {};
			
			//console.log("attPlanRaw = ", attPlanRaw);
			//console.log("W fazie zero ustawiam ruchy atakujących do game.attackersAIPlannedMoves");
			
			// to jest przygotowanie ruchów, one się odpalają w fazie 4 za pomocą: runMovementPhase
			game.attackersAIPlannedMoves = attPlanRaw;
		} else {
			console.log("ERROR: atakującymi nie kieruje AI, brak implementacji tego");
		}

      update(game);
      draw(game);
    }

    if (game.phase === 0) game.playerMoved = true;

    await phase(game); if (game.over) return;
    await delay(400); await phase(game); if (game.over) return;
    await delay(400); await phase(game); if (game.over) return;
    await delay(400); await phase(game); if (game.over) return;
    await delay(400); await phase(game);
  } finally {
    game.processingTurn = false;
    update(game);
    draw(game);
  }
}












function animateUnitFrame(anim, t, game) {
  const nx = anim.x + (anim.toX - anim.x) * t;
  const ny = anim.y + (anim.toY - anim.y) * t;

  // zapisujemy chwilową pozycję, żeby draw() narysował to poprawnie
  game.movingUnits[anim.id] = { x: nx, y: ny };
}

async function playAnimationBuffer(game, buffer, teamSign) {
  if (!buffer.length) {
    //console.log("Brak animacji do wykonania");
    return;
  }

  const dur = 350;
  const start = Date.now();
  game.movingUnits = {};

  await new Promise(resolve => {
    function tick() {
      const t = Math.min(1, (Date.now() - start) / dur);

      // animuj każdą jednostkę z bufora
      for (const anim of buffer) {
        animateUnitFrame(anim, t, game);
      }

      draw(game); // Twoja funkcja renderująca

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        // Na końcu ustawiamy finalne pozycje jednostek w stanie gry
        for (const anim of buffer) {
          const arr = (teamSign === game.defendersSign)
            ? game.defenders
            : game.attackers;

          const u = arr.find(z => z.id === anim.id);
          if (u) {
            u.x = anim.toX;
            u.y = anim.toY;
          }
        }

        buffer.length = 0;       // CZYŚCIMY BUFOR animacji
        game.movingUnits = {};   // czyścimy efemeryczne pozycje
        resolve();
      }
    }
    requestAnimationFrame(tick);
  });
}

async function playDefAnimations(game) {
  await playAnimationBuffer(game, game.defUnitsMoveAnimations, game.defendersSign);
}

async function playAttAnimations(game) {
  await playAnimationBuffer(game, game.attUnitsMoveAnimations, game.attackersSign);
}


































function log(game, msg, type = 'info') {
  const div = document.createElement('div');
  div.className = `log-entry log-${type}`;
  div.textContent = msg;
  const L = document.getElementById('log');
  if (L) { L.appendChild(div); L.scrollTop = 1e9; }
}

function logRoundHeader(game) {
  const L = document.getElementById('log');
  if (!L) return;
  const div = document.createElement('div');
  div.className = 'log-entry log-victory';
  div.textContent = `RUNDA ${game.round}`;
  L.appendChild(div);
  L.scrollTop = 1e9;
}

function logShot(game, { team, text }) {
  const L = document.getElementById('log');
  if (!L) return;
  const div = document.createElement('div');
  div.className = `log-entry log-attack ${team === game.attackersSign ? 'log-red' : 'log-blue'}`;
  div.textContent = text;
  L.appendChild(div);
  L.scrollTop = 1e9;
}

/* ============================
 *  Pociski
 * ============================ */
function launchProjectileWithDelay(game, shooter, target, delayMs) {
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



/* ============================
 *  Flaga / wygrana
 * ============================ */
function inFlagCell(x, y) {
	return (x === 16 || x === 17) && (y === 9 || y === 10);
	}

export function checkFlag(game) {
  const numbersOfAttackersOnFlag = game.attackers.filter(u => u.hp > 0 && inFlagCell(u.x, u.y)).length;
  if (numbersOfAttackersOnFlag > 0) {
    game.flagCount++;
    if (game.flagCount >= 5) endGame(game, game.attackersSign);
  } else {
    game.flagCount = 0;
  }
}

export function checkWin(game) {
  const a = game.attackers.filter(u => u.hp > 0).length;
  const d = game.defenders.filter(u => u.hp > 0).length;
  if (a === 0) endGame(game, game.defendersSign);
  else if (d === 0) endGame(game, game.attackersSign);
}

export function endGame(game, winner) {
  game.over = true;
  game.winner = winner;
  const msg = (winner === game.attackersSign) ? 'Atakujący przejęli fort!' : 'Obrońcy utrzymali fort!';
  log(game, msg, 'victory');
  update(game);
}


// Ustaw obrońców automatycznie (AI) – wybiera wolne kratki najbliżej flagi
// Wymaga: GRID_W, GRID_H, game.unitsPositions, game.defenders (hp>0)
// Użycie po wyborze AI w modalu: autoPlaceDefenders(game); update(game); draw(game);

export function autoPlaceDefenders(game) {
  const map = game.unitsPositions;
  if (!map) return;

  // 1) Zwolnij dotychczasowe kratki obrońców (bez ruszania atakujących)
  for (const u of game.defenders) {
    if (u && u.hp > 0 && Number.isFinite(u.x) && Number.isFinite(u.y)) {
      map[u.y][u.x] = 0;
    }
  }

  // 2) Zbierz wszystkie wolne kratki i posortuj po dystansie do pola flagi
  const flagCells = [{x:16,y:9},{x:17,y:9},{x:16,y:10},{x:17,y:10}];
  const distToFlag = (x,y) => Math.min(...flagCells.map(f => Math.abs(f.x - x) + Math.abs(f.y - y)));

  const free = [];
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      if (map[y][x] === 0) free.push({ x, y, d: distToFlag(x,y) });
    }
  }
  free.sort((a,b) => a.d - b.d || a.y - b.y || a.x - b.x);

  // 3) Ustaw obrońców po kolei na najbliższych wolnych kratkach
  let i = 0;
  for (const u of game.defenders) {
    if (!u || u.hp <= 0) continue;
    if (i >= free.length) break;
    const cell = free[i++];
    u.x = cell.x; u.y = cell.y;
    map[cell.y][cell.x] = 1; // zajmij kratkę, żeby kolejni nie nachodzili
  }
}