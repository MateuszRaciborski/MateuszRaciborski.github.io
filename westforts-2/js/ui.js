// js/ui.js
// interfejs użytkownika

import { draw, update, showUnitTooltip, hideUnitTooltip } from './rendering.js';
import { computeFOV } from './geometry.js';
import { getSector, enumerateSectorCells, getAdjacentSectors, canSetInTheSector } from './sectors.js';
import { runTurnPhases, buildUnitsPositions, autoPlaceDefenders } from './sim.js';
import { aiAttackersPlanMovesToSectors, placeAttackersAuto } from './ai/attackers.js';
import { clampInt } from './util.js';
import { CELL, GRID_H, GRID_W } from './constants.js';
import { getAiDefPlan } from './ai/def_controller.js';


// przyjmuje koordynaty komórki i podaje, czy w tej komórce jest jakiś kwadracik; podając exclude nie bierzemy pod uwagę kwadracika z podanym id, np: d1, a2, a5 itd.
export function isCellFree(game, cx, cy, exclude = null){
  return ![...game.attackers, ...game.defenders]
    .some(u => u.hp > 0 && u.x === cx && u.y === cy && u.id !== exclude);
}


function hasEnemyInSector(game, sectorId, team){
  const enemies = team === game.attackersSign ? game.defenders : game.attackers;
  const pos = enumerateSectorCells(sectorId);
  return enemies.some(u => u.hp > 0 && pos.some(([x,y]) => u.x === x && u.y === y));
}

function logUI(msg){
  const L = document.getElementById('log');
  if (!L) return;
  const div = document.createElement('div');
  div.className = 'log-entry log-info';
  div.textContent = msg;
  L.appendChild(div);
  L.scrollTop = 1e9;
}

export function logAttack(game, { shooterTeam, fromId, toId, dmg }){
  const L = document.getElementById('log');
  if (!L) return;
  const div = document.createElement('div');
  div.className = `log-entry log-attack ${shooterTeam === game.attackersSign ? 'log-red' : 'log-blue'}`;
  div.textContent = `Runda ${game.round} ${fromId} → ${toId}: -${dmg}HP`;
  L.appendChild(div);
  L.scrollTop = 1e9;
}



// OK - ustawienia przed grą
function openStartModal(game){
  const modal = document.getElementById('startModal');
  if (!modal) return;

  const attackersNumberInput = document.getElementById('attackersInput');
  const defendersNumberInput = document.getElementById('defendersInput');
  if (attackersNumberInput) attackersNumberInput.value = String(game.defaultNumberOfAttackers);
  if (defendersNumberInput) defendersNumberInput.value = String(game.defaultNumberOfDefenders);

  const topStart = document.getElementById('topStartGameBtn');
  if (topStart) topStart.style.display = 'none';

  modal.style.display = 'flex';
}
// OK

export async function startGame(game){
  game.mode = game.modePlay;
  game.running = true;
  game.timer = game.roundTime;
  game.playerMoved = false;
  game.processingTurn = false;
 
  game.unitsPositions = buildUnitsPositions(game);

  const setup = document.getElementById('setupPhase');
  if (setup) setup.style.display = 'none';

  const topStart = document.getElementById('topStartGameBtn');
  if (topStart) topStart.style.display = 'none';

  update(game);
  draw(game);

  if (game.attackersControl === 'ai') {
		// ustaw strzałki ruchu dla AI atakujących w pierwszej rundzie
		game.aiAttPlansToDraw = aiAttackersPlanMovesToSectors(game) || {};
  } else {
		console.log("ERROR: ui.js startGame atakujący nie jest ai");
  }
  
  if (game.defendersControl === 'ai') {
		// ustaw strzałki ruchu dla AI obrońców w pierwszej rundzie
		game.aiDefPlansToDraw = await getAiDefPlan(game) || {};
  } else {
		//console.log("ui.js startGame obrońca nie jest ai");
  }
  
  update(game);
  draw(game);
}











// ui.js — DODAJ to gdzieś u góry pliku (np. obok importów helperów)
// AUTO-PLACEMENT DEF — analogicznie do placeAttackersAuto, ale dla obrońców
function placeDefendersAuto(game, count) {
  // wybierz komórki blisko flagi (16,9),(17,9),(16,10),(17,10)
  const flagCells = [{x:16,y:9},{x:17,y:9},{x:16,y:10},{x:17,y:10}];
  const dist = (x,y) => Math.min(...flagCells.map(f => Math.abs(f.x - x) + Math.abs(f.y - y)));

  // zbierz WSZYSTKIE komórki mapy posortowane po dystansie do flagi
  const cells = [];
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      cells.push({ x, y, d: dist(x,y) });
    }
  }
  cells.sort((a,b) => a.d - b.d || a.y - b.y || a.x - b.x);

  // pomocnicze: sprawdź czy zajęte przez kogokolwiek (atakujący już istnieją)
  const taken = new Set(
    [...game.attackers, ...game.defenders]
      .filter(u => u && u.hp > 0)
      .map(u => `${u.x}-${u.y}`)
  );

  const out = [];
  for (const c of cells) {
    if (out.length >= count) break;
    const k = `${c.x}-${c.y}`;
    if (taken.has(k)) continue;
    // opcjonalny filtr: nie rozstawiaj poza fortem, jeśli masz taką funkcję:
    // if (!inFortInterior(c.x, c.y)) continue;

    taken.add(k);
    out.push({ x: c.x, y: c.y });
  }
  return out;
}


// === helpers: krótkie funkcje (≤10 linii każda) ===

// 1) Ustawienie trybu setup
function setSetupMode(game) {
  game.mode = game.modeSetup;
}

// 2) Tworzy atakujących wg auto-spawn
function buildAttackers(game) {
  const countAtt = clampInt(
    game.numberOfAttackersFromUser ?? game.defaultNumberOfAttackers,
    1, game.maximumNumberOfAttackers
  );
  const spawns = placeAttackersAuto(game, countAtt);
  game.attackers = spawns.map((p, i) => ({
    id: `a${i+1}`, x: p.x, y: p.y,
    hp: game.HPOfSingleAttacker, maxHp: game.HPOfSingleAttacker,
    team: game.attackersSign,
    alreadyMovedInThisRound: false, alreadyShootedInThisRound: false
  }));
}

// 3) Tworzy obrońców AI na pozycjach (pełna automatyzacja)
function buildDefendersAI(game) {
  const countDef = clampInt(
    game.numberOfDefendersFromUser ?? game.defaultNumberOfDefenders,
    1, game.maximumNumberOfDefenders
  );
  const defSpawns = placeDefendersAuto(game, countDef);
  game.defenders = defSpawns.map((p, i) => ({
    id: `d${i+1}`, x: p.x, y: p.y,
    hp: game.HPOfSingleDefender, maxHp: game.HPOfSingleDefender,
    team: game.defendersSign,
    alreadyMovedInThisRound: false, alreadyShootedInThisRound: false
  }));
}

// 4) Ustaw stan deploy dla trybu HUMAN
function setHumanDefendersDeployState(game) {
  const countDef = clampInt(
    game.numberOfDefendersFromUser ?? game.defaultNumberOfDefenders,
    1, game.maximumNumberOfDefenders
  );
  game._remainingDefendersToDeploy = countDef - game.defenders.length;
}

// 5) Pokaż przycisk start jeśli obrońcy już są ustawieni
function showStartIfReadyForAI(game) {
  game._remainingDefendersToDeploy = 0;
  const btn = document.getElementById('topStartGameBtn');
  if (btn) btn.style.display = 'inline-block';
}

// 6) Zbuduj mapę pozycji i narysuj
function buildMapAndDraw(game) {
  game.unitsPositions = buildUnitsPositions(game);
  draw(game);
}


// === główna funkcja: startSetup (orchestrator, tylko składa kroki) ===
export function startSetup(game) {
  setSetupMode(game);

  // 1) atakujący
  buildAttackers(game);

  // 2) obrońcy: AI vs HUMAN
  if (game.defendersControl === 'ai') {
    buildDefendersAI(game);
    showStartIfReadyForAI(game);
  } else {
    setHumanDefendersDeployState(game);
  }

  // 3) mapa + render (1 raz, na końcu)
  buildMapAndDraw(game);
}

function confirmStart(game){
  const aEl = document.getElementById('attackersInput');
  const dEl = document.getElementById('defendersInput');
  const atkHpEl = document.getElementById('atkHpInput');
  const defHpEl = document.getElementById('defHpInput');
  const a = clampInt(Number(aEl?.value) || game.defaultNumberOfAttackers, 1, game.maximumNumberOfAttackers);
  const d = clampInt(Number(dEl?.value) || game.defaultNumberOfDefenders, 1, game.maximumNumberOfDefenders);
  const atkHP = clampInt(Number(atkHpEl?.value) || game.defaultHPOfSingleAttacker, 1, game.maximumHPOfSingleShooter);
  const defHP = clampInt(Number(defHpEl?.value) || game.defaultHPOfSingleDefender, 1, game.maximumHPOfSingleShooter);
  game.numberOfAttackersFromUser = a;
  game.numberOfDefendersFromUser = d;
  game.HPOfSingleAttacker = atkHP;
  game.HPOfSingleDefender = defHP;
  const ctrlEl = document.getElementById('defControl');
  game.defendersControl = (ctrlEl?.value === 'ai') ? 'ai' : 'human';
  document.getElementById('startModal').style.display = 'none';
  startSetup(game);
}

export function attachUI(game){
  // Modal start
  document.getElementById('startConfirmBtn')?.addEventListener('click', () => confirmStart(game));

  // Start z top bar
	document.getElementById('topStartGameBtn')?.addEventListener('click', async () => {
		await startGame(game);
	});

  // Górny panel
  document.getElementById('topToggleSectorIdsBtn')?.addEventListener('click', () => {
    game.showSectorIds = !game.showSectorIds; draw(game);
  });
  document.getElementById('topToggleCoordsBtn')?.addEventListener('click', () => {
    game.showCoords = !game.showCoords; draw(game);
  });
  
  document.getElementById('topEndTurnBtn')?.addEventListener('click', () => {
	  
	// po naciśnięciu przycisku końca rundy uruchom rundę i już
    if (game.mode === game.modePlay && game.phase === 0 && !game.playerMoved && !game.processingTurn) {
      game.playerMoved = true;
      runTurnPhases(game);
    }
  });
  
  document.getElementById('topResetBtn')?.addEventListener('click', () => location.reload());

  // Klawisze
  document.addEventListener('keydown', e=>{
    if (e.key==='Enter'){
      const btn = document.getElementById('topEndTurnBtn');
      if (btn && !btn.disabled) btn.click();
    } else if (e.key==='Escape'){
      game.selected=null;
	  game.hoverCell=null;
	  game.hoverFOV=null;
	  update(game);
	  draw(game);
    }
  });






  // Canvas
  const canvas = document.getElementById('canvas');

// === helpers ===
function getClickCell(canvas, e, CELL) {
  const r = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - r.left) / CELL);
  const y = Math.floor((e.clientY - r.top) / CELL);
  return { x, y };
}

function defendersToDeployCount(game) {
  return clampInt(
    game.numberOfDefendersFromUser ?? game.defaultNumberOfDefenders,
    1,
    game.maximumNumberOfDefenders
  );
}

function canDeployHere(game, x, y) {
  const sec = getSector(x, y, game);
  if (!sec) return { ok: false, sec: null };

  const limit = defendersToDeployCount(game);
  const slotsOk = game.defenders.length < limit;
  const sectorOk = canSetInTheSector(game.defendersSign, x, y, game);
  const noEnemies = !hasEnemyInSector(game, sec.id, game.defendersSign);
  const free = isCellFree(game, x, y);

  return { ok: slotsOk && sectorOk && noEnemies && free, sec, limit };
}

function showStartButtonIfReady(game, defendersToDeploy) {
  game._remainingDefendersToDeploy = Math.max(0, defendersToDeploy - game.defenders.length);
  if (game.defenders.length === defendersToDeploy) {
    const topStart = document.getElementById('topStartGameBtn');
    if (topStart) topStart.style.display = 'inline-block';
  }
}

function sameCell(a, b) {
  return a.x === b.x && a.y === b.y;
}

function isLegalSectorMove(game, fromSecId, toSecId) {
  if (!fromSecId || !toSecId) return false;
  if (String(fromSecId) === String(toSecId)) return true;
  const adj = getAdjacentSectors(String(fromSecId), game).map(String);
  return adj.includes(String(toSecId));
}

// === SETUP: rozstawianie obrońców ===
function handleSetupClick(game, x, y) {
	
	if (game.defendersControl === 'ai') return;
	
  const { ok, limit } = canDeployHere(game, x, y);
  if (!ok) return;

  const id = 'd' + (game.defenders.length + 1);
  game.defenders.push({
    id, x, y,
    hp: game.HPOfSingleDefender,
    maxHp: game.HPOfSingleDefender,
    team: game.defendersSign,
    alreadyMovedInThisRound: false,
    alreadyShootedInThisRound: false
  });

  showStartButtonIfReady(game, limit);
  draw(game);
}

// === PLAY: wybór jednostki i plan ruchu ===
function trySelectDefender(game, x, y) {
  const clickDef = game.defenders.find(u => u.hp > 0 && u.x === x && u.y === y);
  if (!clickDef) return false;
  game.selected = clickDef;
  update(game);
  draw(game);
  return true;
}

function tryCancelPlanIfSameCell(game, x, y) {
  if (!game.selected) return false;
  if (!sameCell({ x, y }, { x: game.selected.x, y: game.selected.y })) return false;

  if (game.plannedMoves && game.plannedMoves[game.selected.id]) {
	  //console.log("usuwam plan dla id = ", game.selected.id, " plan = ", game.plannedMoves[game.selected.id]);
    delete game.plannedMoves[game.selected.id];
  }
  game.selected = null;
  update(game);
  draw(game);
  return true;
}

function tryPlanMoveIfLegal(game, x, y) {
  if (!game.selected || game.selected.team !== game.defendersSign || game.selected.hp <= 0) return;

  const tSec = getSector(x, y, game);
  const cSec = getSector(game.selected.x, game.selected.y, game);
  if (!tSec || !cSec) return;
  if (!isLegalSectorMove(game, cSec.id, tSec.id)) return;

  game.plannedMoves = game.plannedMoves || {};
  game.plannedMoves[game.selected.id] = { x, y };
  
  console.log("Ustawiono ruch: ", game.selected.id, " do x = ", x, " oraz y = ", y);
  game.selected = null;
  update(game);
  draw(game);
}

function handlePlayClick(game, x, y) {
  if (game.defendersControl === 'ai') return;

  if (!game.selected) {
    // próba zaznaczenia obrońcy
    trySelectDefender(game, x, y);
    return;
  }

  // anulowanie planu, jeśli kliknięto w to samo pole
  if (tryCancelPlanIfSameCell(game, x, y)) return;

  // zaplanowanie ruchu, jeśli legalny
  tryPlanMoveIfLegal(game, x, y);
}

// === REJESTRACJA LISTENERA ===
canvas.addEventListener('click', e => {
  const { x, y } = getClickCell(canvas, e, CELL);

  // SETUP
  if (game.mode === game.modeSetup) {
    handleSetupClick(game, x, y);
    return;
  }

  // PLAY: faza planu
  if (game.mode === game.modePlay && game.phase === 0 && !game.over) {
    handlePlayClick(game, x, y);
    return;
  }
});






  // pokaż info o kwadraciku oraz pole widzenia kwadracika
  canvas.addEventListener('mousemove', e=>{
    const r = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / CELL);
    const y = Math.floor((e.clientY - r.top) / CELL);

    const unitHover = [...game.attackers, ...game.defenders].find(u=>u.hp>0 && u.x===x && u.y===y);
    if (unitHover) showUnitTooltip(unitHover, game); else hideUnitTooltip();

    const DEBUG_FOV = false;

    const cellChanged = !game.hoverCell || game.hoverCell.x!==x || game.hoverCell.y!==y;
    if (cellChanged){
      game.hoverCell = { x, y };

      const t0 = performance.now();
      try {
        game.hoverFOV  = computeFOV(x, y, game);
      } catch (err) {
        console.error('[FOV] computeFOV threw error at', {x,y}, err);
        game.hoverFOV = null;
      }
      const t1 = performance.now();

      if (DEBUG_FOV) {
        const sz = game.hoverFOV ? game.hoverFOV.size : 0;
        console.groupCollapsed(`[FOV] mouse @(${x},${y}) → size=${sz} in ${Math.round(t1-t0)}ms`);
        console.debug('hoverCell:', game.hoverCell);
        console.debug('hoverFOV sample (first 20):',
          game.hoverFOV ? Array.from(game.hoverFOV).slice(0, 20) : null);
        console.debug('cellToSector.size:', game.cellToSector?.size, '(should be > 0)');
        console.groupEnd();
      }

      draw(game, { debugFOV: DEBUG_FOV });
    }
  });

	// ukrywanie info o kwadraciku
  canvas.addEventListener('mouseleave', ()=>{
    hideUnitTooltip();
    if (game.hoverFOV){
      // console.debug('[FOV] mouseleave → clear hoverFOV');
      game.hoverCell=null; game.hoverFOV=null; draw(game);
    }
  });
  
  // TIMER (tick co 1s)
  setInterval(() => {
  if (!game.running || game.over || game.mode !== game.modePlay) return;

  const inPlanPhase = (game.phase === 0);
  const canAct = inPlanPhase && !game.playerMoved && !game.processingTurn;

  if (game.aiAutomaticallyEndTurns) {
    if (game.defendersControl === 'ai' && canAct) {
      game.playerMoved = true;
      runTurnPhases(game);
      return;
    }
  } else {
    if (game.timer === 0 && game.defendersControl === 'ai' && canAct) {
      game.playerMoved = true;
      runTurnPhases(game);
      return;
    }
  }

  // odliczanie
  if (game.timer > 0) game.timer = Math.max(0, game.timer - 1);

  // auto-end również dla człowieka po timerze (jeśli tak chcesz)
  if (game.timer === 0 && canAct) {
    game.playerMoved = true;
    runTurnPhases(game);
  }

  update(game);
}, 1000);


	/*setInterval(() => {

	  // gra musi być aktywna
	  if (!game.running || game.over || game.mode !== game.modePlay) return;

	  const inPlanPhase = (game.phase === 0);
	  const canAct = inPlanPhase && !game.playerMoved && !game.processingTurn;


		if (game.aiAutomaticallyEndTurns) {
			if (game.defendersControl === 'ai' && canAct) {
			game.playerMoved = true;
			runTurnPhases(game);
			return;
		}
		} else {
			if (game.timer === 0 && game.defendersControl === 'ai' && canAct) {
				game.playerMoved = true;
			runTurnPhases(game);
			return;
			}
		}
	  
	  //if (game.timer === 0 && game.defendersControl === 'ai' && canAct) { // podmień żeby automatycznie AI kończyło rundy
		//if (game.defendersControl === 'ai' && canAct) {
		//	game.playerMoved = true;
		//	runTurnPhases(game);
		//	return;
		//}

	  // --- odliczanie ---
	  if (game.timer > 0) {
		game.timer = Math.max(0, game.timer - 1);
	  }

	  if (game.timer === 0 && canAct) {
		game.playerMoved = true;
		runTurnPhases(game);
	  }

	  update(game);

	}, 1000);
	
	
	*/

  // Start

  const log = document.getElementById('log');
  if (log) log.innerHTML = '';
  update(game);
  draw(game);
  openStartModal(game);
}

export function logSectorDistance(game, fromSec = 120, toSec = 63){
  const src = String(fromSec), dst = String(toSec);
  if (src === dst) { console.log(`[SEC] ${src}→${dst}: 0`); return 0; }

  const q = [src];
  const dist = new Map([[src, 0]]);
  while (q.length){
    const s = q.shift();
    const d = dist.get(s);
    for (const n of getAdjacentSectors(s, game).map(String)){
      if (!dist.has(n)){
        dist.set(n, d + 1);
        if (n === dst){
          const hops = d + 1;
          console.log(`[SEC] ${src}→${dst}: ${hops} krawędzi`);
          return hops;
        }
        q.push(n);
      }
    }
  }
  console.log(`[SEC] ${src}→${dst}: brak ścieżki`);
  return null;
}