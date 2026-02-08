// js/ui.js

import { draw, update, showUnitTooltip, hideUnitTooltip } from './rendering.js';
import { computeFOV } from './geometry.js';
import { buildCellMap, getSector, enumerateSectorCells, getAdjacentSectors, canPlaceOnCell, ATTACKER_START_SECTORS } from './sectors.js';
import { runTurnPhases, buildUnitsPositions } from './sim.js';
import { aiPlanMoves, placeAttackersAuto } from './ai/attackers.js';
import { clampInt } from './util.js';
import { ATT_START_SECTORS, CELL } from './constants.js';


function isCellFree(game, cx, cy, exclude = null){
  return ![...game.attackers, ...game.defenders]
    .some(u => u.hp > 0 && u.x === cx && u.y === cy && u.id !== exclude);
}

function hasEnemyInSector(game, sectorId, team){
  const enemies = team === 'att' ? game.defenders : game.attackers;
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
  div.className = `log-entry log-attack ${shooterTeam === 'att' ? 'log-red' : 'log-blue'}`;
  div.textContent = `Runda ${game.round} ${fromId} → ${toId}: -${dmg}HP`;
  L.appendChild(div);
  L.scrollTop = 1e9;
}

function openStartModal(game){
  const modal = document.getElementById('startModal');
  if (!modal) return;

  const aIn = document.getElementById('attackersInput');
  const dIn = document.getElementById('defendersInput');
  if (aIn) aIn.value = String(game.attackersTarget ?? 5);
  if (dIn) dIn.value = String(game.defendersTarget ?? 4);

  const topStart = document.getElementById('topStartGameBtn');
  if (topStart) topStart.style.display = 'none';

  modal.style.display = 'flex';
}

window.openStartModal = openStartModal;

function startGame(game){
  game.mode = 'play';
  game.running = true;
  game.timer = 65;
  game.playerMoved = false;
  game.processingTurn = false;
  
  
  
  

  const setup = document.getElementById('setupPhase');
  if (setup) setup.style.display = 'none';

  const topStart = document.getElementById('topStartGameBtn');
  if (topStart) topStart.style.display = 'none';

  update(game);
  draw(game);
  
  game.unitsPositions = buildUnitsPositions(game);
  //console.log("game.unitsPositions from ui.js startGame()"); console.log(game.unitsPositions);

  // prewka: strzałki planu AI w fazie 0 tuż po starcie
  game.turnPlans = game.turnPlans || { def:{}, att:{} };
  game.turnPlans.att = aiPlanMoves(game) || {};
  update(game);
  draw(game);
}

export function startSetup(game){
  game.mode = 'setup';

  const countAtt = clampInt(game.attackersTarget ?? 5, 1, 50);
  const spawns = placeAttackersAuto(game, countAtt);
  game.attackers = spawns.map((p,i)=>({
    id:`a${i+1}`,
    x:p.x, y:p.y,
    hp: game.attackersHP,
    maxHp: game.attackersHP,
    team:'att', m:false, s:false
  }));

  game._remainingDefenders = clampInt(game.defendersTarget ?? 4, 1, 42) - game.defenders.length;
  draw(game);
}

function confirmStart(game){
  const aEl = document.getElementById('attackersInput');
  const dEl = document.getElementById('defendersInput');
  const atkHpEl = document.getElementById('atkHpInput');
  const defHpEl = document.getElementById('defHpInput');
  const a = clampInt(Number(aEl?.value) || 10, 1, 50);
  const d = clampInt(Number(dEl?.value) || 7, 1, 42);
  const atkHP = clampInt(Number(atkHpEl?.value) || 1700, 1, 35000);
  const defHP = clampInt(Number(defHpEl?.value) || 2000, 1, 35000);
  game.attackersTarget = a;
  game.defendersTarget = d;
  game.attackersHP = atkHP;
  game.defendersHP = defHP;
  document.getElementById('startModal').style.display = 'none';
  startSetup(game);
}

export function attachUI(game){
  // Modal start
  document.getElementById('startConfirmBtn')?.addEventListener('click', () => confirmStart(game));

  // Start z top bar
  document.getElementById('topStartGameBtn')?.addEventListener('click', () => {
    startGame(game);
  });

  // Górny panel
  document.getElementById('topToggleSectorIdsBtn')?.addEventListener('click', () => {
    game.showSectorIds = !game.showSectorIds; draw(game);
  });
  document.getElementById('topToggleCoordsBtn')?.addEventListener('click', () => {
    game.showCoords = !game.showCoords; draw(game);
  });
  document.getElementById('topEndTurnBtn')?.addEventListener('click', () => {
    if (game.mode === 'play' && !game.playerMoved && !game.processingTurn){
      const defPlan = { ...game.plannedMoves };
      const attPlan = aiPlanMoves(game);
      game.turnPlans = { def: defPlan, att: attPlan };
      //game.plannedMoves = {};
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
      game.selected=null; game.hoverCell=null; game.hoverFOV=null; update(game); draw(game);
    }
  });

  // Canvas
  const canvas = document.getElementById('canvas');

  canvas.addEventListener('click', e=>{
    const r = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / CELL);
    const y = Math.floor((e.clientY - r.top) / CELL);

    // SETUP: rozstawianie obrońców
    if (game.mode === 'setup'){
      const sec = getSector(x, y, game);
      const targetDef = clampInt(game.defendersTarget ?? 4, 1, 42);
      if (sec && game.defenders.length < targetDef && canPlaceOnCell('defender', x, y, game)) {
        if (hasEnemyInSector(game, sec.id, 'def')) return;
        if (isCellFree(game, x, y)){
          const id = 'd' + (game.defenders.length + 1);
          game.defenders.push({
            id, x, y,
            hp: game.defendersHP,
            maxHp: game.defendersHP,
            team:'def', m:false, s:false
          });
          game._remainingDefenders = Math.max(0, targetDef - game.defenders.length);
          if (game.defenders.length === targetDef){
            const topStart = document.getElementById('topStartGameBtn');
            if (topStart) topStart.style.display = 'inline-block';
          }
          draw(game);
        }
      }
      return;
    }

    // PLAY: plan ruchu obrońcy
    if (game.mode === 'play' && game.phase === 0 && !game.over){
      if (!game.selected){
        const clickDef = game.defenders.find(u => u.hp>0 && u.x===x && u.y===y);
        if (clickDef){ game.selected = clickDef; update(game); draw(game); }
        return;
      }

      if (game.selected && game.selected.team === 'def' && game.selected.hp > 0){
  const tSec = getSector(x, y, game), cSec = getSector(game.selected.x, game.selected.y, game);
  if (!tSec || !cSec) return;
  const adj = getAdjacentSectors(String(cSec.id), game).map(String);
  if (!adj.includes(String(tSec.id)) && String(tSec.id) !== String(cSec.id)) return;

  // Anulowanie planu: klik na tę samą kratkę
  if (x === game.selected.x && y === game.selected.y) {
    if (game.plannedMoves && game.plannedMoves[game.selected.id]) {
      delete game.plannedMoves[game.selected.id];
    }
    game.selected = null;
    update(game); 
    draw(game);
    return;
  }

  game.plannedMoves[game.selected.id] = { x, y };
  game.selected = null;
  update(game); draw(game);
}
      return;
    }

    // Klik na jednostkę poza fazą planu
    const u = [...game.attackers, ...game.defenders].find(u=>u.hp>0 && u.x===x && u.y===y);
    if (u){ game.selected = u; update(game); draw(game); }
  });



let last=0;
  // Mousemove: tooltip + FOV pod kursorem
  canvas.addEventListener('mousemove', e=>{
	  
	  
	const now=performance.now();
  if (now-last<16) return; // ~60fps
  last=now;


    const r = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / CELL);
    const y = Math.floor((e.clientY - r.top) / CELL);

    const unitHover = [...game.attackers, ...game.defenders].find(u=>u.hp>0 && u.x===x && u.y===y);
    if (unitHover) showUnitTooltip(unitHover, game); else hideUnitTooltip();


	
	
	game._fovCache = new Map();
	const DEBUG_FOV = true;

	const cellChanged = !game.hoverCell || game.hoverCell.x !== x || game.hoverCell.y !== y;
	if (cellChanged) {

	  game.hoverCell = { x, y };

	  // ——— LOGIKA: kiedy rysować FOV ———
	  const unitOnCell =
		[...game.attackers, ...game.defenders].some(
		  u => u.hp > 0 && u.x === x && u.y === y
		);

	  const allowFOV =
		game.mode === 'setup'        // ← NOWE: zawsze rysuj w setupie
		|| unitOnCell                // ← FOV gdy najedziesz na jednostkę
		|| game.selected;            // ← FOV gdy wybrano jednostkę do ruchu

	  if (!allowFOV) {
		game.hoverFOV = null;
		draw(game);
		return;
	  }
	  // ————————————————————————————————

	  const key = `${x}-${y}`;
	  if (game._fovCache.has(key)) {
		game.hoverFOV = game._fovCache.get(key);
	  } else {
		const f = computeFOV(x, y, game);
		game._fovCache.set(key, f);
		game.hoverFOV = f;
	  }

	  draw(game);
	}
	
	
  });

  
  canvas.addEventListener('mouseleave', () => {
    hideUnitTooltip();
    game.hoverCell = null;
    game.hoverFOV  = null;
    update(game);
    draw(game);
  });
  
  

  // Timer
  setInterval(() => {
    if (game.running && !game.over && game.mode === 'play') {
      if (game.timer > 0) game.timer = Math.max(0, game.timer - 1);
      if (game.timer === 0 && game.phase === 0 && !game.playerMoved && !game.processingTurn) {
        const defPlan = { ...game.plannedMoves };
        const attPlan = aiPlanMoves(game);
        game.turnPlans = { def: defPlan, att: attPlan };
        game.plannedMoves = {};
        game.playerMoved = true;
        runTurnPhases(game);
      }
      update(game);
    }
  }, 1000);

  // Start
  buildCellMap(game);
  const log = document.getElementById('log'); if (log) log.innerHTML = '';
  update(game); draw(game);

  //logSectorDistance(game, 120, 63);
  //logSectorDistance(game, 101, 63);

  openStartModal(game);
}

export function logSectorDistance(game, fromSec = 120, toSec = 63){
  const src = String(fromSec), dst = String(toSec);
  //if (src === dst) { console.log(`[SEC] ${src}→${dst}: 0`); return 0; }

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
          //console.log(`[SEC] ${src}→${dst}: ${hops} krawędzi`);
          return hops;
        }
        q.push(n);
      }
    }
  }
  //console.log(`[SEC] ${src}→${dst}: brak ścieżki`);
  return null;
}