// js/rendering.js
// Rysowanie planszy, FOV, jednostek, pocisków, tooltipów oraz update UI.

import {
	GRID_W, GRID_H, CELL, BASE_AIM, BASE_DODGE,
	TOWER_NAME, WALL_NAME, FLAG_NAME, AROUND_THE_FLAG_NAME, BUILDING_NAME,
	BONUS_AIMING_TOWER, BONUS_DODGING_TOWER, BONUS_AIMING_WALL, BONUS_DODGING_WALL, BONUS_AIMING_FLAG, BONUS_DODGING_FLAG,
	BONUS_AIMING_AROUND_FLAG, BONUS_DODGING_AROUND_FLAG, BONUS_AIMING_BUILDING, BONUS_DODGING_BUILDING
	} from './constants.js';
	
	

import { sectors, enumerateSectorCells, getSector } from './sectors.js';
import { inFortInterior } from './geometry.js';
import { sectorCenters } from './geometry.js';
import { mixHex, mmss, pluralJednostka } from './util.js';

// --- Canvas / konteksty ---

let canvas, ctx, fogCanvas, fctx;
export function attachCanvas(){
  canvas = document.getElementById('canvas');
  ctx = canvas.getContext('2d');
  buildTextures();
  fogCanvas = document.createElement('canvas');
  fogCanvas.width = canvas.width;
  fogCanvas.height = canvas.height;
  fctx = fogCanvas.getContext('2d');
  return { canvas, ctx };
}

// --- Tekstury ---

const textures = { outside: null, inside: null, wood: null };

export function buildTextures(){
  // OUTSIDE
  const pO = document.createElement('canvas'); pO.width = pO.height = 48;
  const cO = pO.getContext('2d');
  cO.fillStyle = '#476b4e'; cO.fillRect(0,0,48,48);
  for (let i=0;i<120;i++){
    cO.fillStyle = `rgba(208,180,131,${0.10 + Math.random()*0.12})`;
    const r = 1 + Math.random()*2.5;
    cO.beginPath(); cO.arc(Math.random()*48, Math.random()*48, r, 0, Math.PI*2); cO.fill();
  }
  cO.strokeStyle = 'rgba(190,160,110,0.10)'; cO.lineWidth = 1;
  for (let i=0;i<10;i++){
    cO.beginPath(); cO.moveTo(Math.random()*48, Math.random()*48); cO.lineTo(Math.random()*48, Math.random()*48); cO.stroke();
  }

  // INSIDE
  const pI = document.createElement('canvas'); pI.width = pI.height = 48;
  const cI = pI.getContext('2d');
  cI.fillStyle = '#d1be93'; cI.fillRect(0,0,48,48);
  for (let i=0;i<80;i++){
    cI.fillStyle = `rgba(150,130,90,${0.07 + Math.random()*0.08})`;
    const w = 6 + Math.random()*10, h = 1 + Math.random()*2;
    cI.fillRect(Math.random()*48, Math.random()*48, w, h);
  }

  // WOOD
  const pW = document.createElement('canvas'); pW.width = pW.height = 48;
  const cW = pW.getContext('2d');
  cW.fillStyle = '#8b5a2b'; cW.fillRect(0,0,48,48);
  cW.strokeStyle = 'rgba(60,35,20,0.28)'; cW.lineWidth = 1;
  for (let i=0;i<14;i++){
    cW.beginPath();
    const y = Math.random()*48;
    cW.moveTo(0, y);
    cW.bezierCurveTo(12, y+Math.random()*6-3, 36, y+Math.random()*6-3, 48, y);
    cW.stroke();
  }
  for (let i=0;i<6;i++){
    cW.fillStyle = 'rgba(50,30,18,0.25)';
    cW.beginPath(); cW.arc(Math.random()*48, Math.random()*48, 0.8+Math.random()*1.2, 0, Math.PI*2); cW.fill();
  }

  textures.outside = ctx.createPattern(pO, 'repeat');
  textures.inside  = ctx.createPattern(pI, 'repeat');
  textures.wood    = ctx.createPattern(pW, 'repeat');
}

// --- Pomoc rysunkowa ---

function seedRand(ix, iy, salt = 0){
  let t = (ix*374761393 + iy*668265263 + salt) >>> 0;
  t += 0x6D2B79F5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function drawPlanksOnCell(cx, cy, vertical = false){
  ctx.save();
  ctx.strokeStyle = 'rgba(60,35,20,0.35)';
  ctx.lineWidth = 1;
  const step = 6;
  for (let i = step; i < CELL; i += step){
    ctx.beginPath();
    if (vertical){
      ctx.moveTo(cx*CELL + i, cy*CELL + 1);
      ctx.lineTo(cx*CELL + i, cy*CELL + CELL - 1);
    } else {
      ctx.moveTo(cx*CELL + 1, cy*CELL + i);
      ctx.lineTo(cx*CELL + CELL - 1, cy*CELL + i);
    }
    ctx.stroke();
  }
  ctx.restore();
}

export function drawDamageOnCell(cx, cy, intensity = 1){
  const count = Math.max(0, Math.floor(seedRand(cx, cy, 999) * 2 * intensity));
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  for (let i=0; i<count; i++){
    const r1 = seedRand(cx, cy, 101+i);
    const r2 = seedRand(cx, cy, 202+i);
    const r3 = seedRand(cx, cy, 303+i);
    const x1 = cx*CELL + 4 + r1*(CELL-8);
    const y1 = cy*CELL + 4 + r2*(CELL-8);
    const ang = r3*Math.PI*2;
    const len = 6 + seedRand(cx, cy, 404+i)*8;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 + Math.cos(ang)*len, y1 + Math.sin(ang)*len);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCellsOutline(cells){
  if (!drawCellsOutline._cache) drawCellsOutline._cache = new Map();

  let sig;
  if (cells && cells.length){
    const norm = cells.slice().sort((a,b)=> (a[0]-b[0]) || (a[1]-b[1]));
    sig = norm.map(([x,y])=>`${x},${y}`).join(';');
  } else sig = '';

  let outline = drawCellsOutline._cache.get(sig);
  if (!outline){
    const edgeCount = new Map();
    for (const [x,y] of cells){
      const e = [
        [x*CELL, y*CELL, (x+1)*CELL, y*CELL],
        [(x+1)*CELL, y*CELL, (x+1)*CELL, (y+1)*CELL],
        [x*CELL, (y+1)*CELL, (x+1)*CELL, (y+1)*CELL],
        [x*CELL, y*CELL, x*CELL, (y+1)*CELL]
      ];
      for (const seg of e){
        const norm = (seg[0] < seg[2] || (seg[0] === seg[2] && seg[1] < seg[3])) ? seg : [seg[2], seg[3], seg[0], seg[1]];
        const key = `${norm[0]}-${norm[1]}-${norm[2]}-${norm[3]}`;
        edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
      }
    }
    outline = [];
    for (const [k, cnt] of edgeCount){
      if (cnt === 1) outline.push(k.split('-').map(Number));
    }
    drawCellsOutline._cache.set(sig, outline);
  }

  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (const [x1,y1,x2,y2] of outline){
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
  }
  ctx.stroke();
}

export function drawAnimatedFlag(game){
  const f = sectors[63];
  const px = f.x[0]*CELL, py = f.y[0]*CELL;
  const W = 2*CELL, H = 2*CELL;

  ctx.strokeStyle = '#5b3a17'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(px+10, py+H-4); ctx.lineTo(px+10, py+6); ctx.stroke();

  const t = game.flagPhase*0.12; const amp = 6;
  const left = px+12; const top = py+10;
  const height = (H-20)/2; const width = W-24;

  ctx.fillStyle = 'rgba(255, 230, 80, 0.96)';
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left+width, top + Math.sin(t)*1.2);
  ctx.lineTo(left+width + Math.sin(t+1.2)*amp*0.4, top+height);
  ctx.lineTo(left, top+height + Math.sin(t+0.6)*1.0);
  ctx.closePath();
  ctx.fill();
}

export function drawGradientArrow(x0, y0, x1, y1, colStart, colEnd, width = 12){
  const grad = ctx.createLinearGradient(x0, y0, x1, y1);
  grad.addColorStop(0, colStart);
  grad.addColorStop(1, colEnd);

  const a = Math.atan2(y1 - y0, x1 - x0);
  const headLen   = Math.max(16, width * 2.2);
  const headWidth = Math.max(12, width * 1.8);

  const lx1 = x1 - headLen * Math.cos(a);
  const ly1 = y1 - headLen * Math.sin(a);

  ctx.save();
  ctx.globalAlpha = 0.5;

  ctx.strokeStyle = '#000';
  ctx.lineWidth = Math.max(2, width * 0.22);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(lx1, ly1); ctx.stroke();

  ctx.strokeStyle = grad;
  ctx.lineWidth = width;
  ctx.shadowColor = 'rgba(0,0,0,0.28)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetX = 0.4;
  ctx.shadowOffsetY = 0.4;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(lx1, ly1); ctx.stroke();

  const p1x = x1, p1y = y1;
  const p2x = x1 - headLen * Math.cos(a) + (headWidth/2) * Math.sin(a);
  const p2y = y1 - headLen * Math.sin(a) - (headWidth/2) * Math.cos(a);
  const p3x = x1 - headLen * Math.cos(a) - (headWidth/2) * Math.sin(a);
  const p3y = y1 - headLen * Math.sin(a) + (headWidth/2) * Math.cos(a);

  ctx.shadowColor = 'transparent';
  ctx.lineWidth = Math.max(2, width * 0.22);
  ctx.strokeStyle = '#000';
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(p1x, p1y); ctx.lineTo(p2x, p2y);
  ctx.lineTo(p3x, p3y); ctx.closePath();
  ctx.stroke();
  ctx.fill();

  ctx.restore();
}

// --- Kolory strzałek planów ---
function getPlanArrowGradient(game, side, move) {
  if (move && (move.rot === true || String(move.color).toLowerCase() === 'green')) {
    return { start: '#00e676', end: '#2e7d32' };
  }
  if (side === game.attackersSign) return { start: '#ff6b6b', end: '#b71c1c' };
  return { start: '#6ba4ff', end: '#1c33b7' };
}

export function drawBulletProjectile(p){
  const px = p.fx + (p.tx - p.fx)*p.t;
  const py = p.fy + (p.ty - p.fy)*p.t;
  const ang = Math.atan2(p.ty - p.fy, p.tx - p.fx);

  const len = 8, rad = 2.4, trail = 14;

  const bx = px - Math.cos(ang)*len*0.5;
  const by = py - Math.sin(ang)*len*0.5;

  const tx1 = bx - Math.cos(ang)*trail;
  const ty1 = by - Math.sin(ang)*trail;

  const grad = ctx.createLinearGradient(tx1, ty1, bx, by);
  grad.addColorStop(0, 'rgba(80,80,80,0.00)');
  grad.addColorStop(1, 'rgba(80,80,80,0.30)');

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.strokeStyle = grad;
  ctx.lineWidth = rad;
  ctx.beginPath(); ctx.moveTo(tx1, ty1); ctx.lineTo(bx, by); ctx.stroke();

  ctx.translate(px, py);
  ctx.rotate(ang);
  ctx.strokeStyle = 'rgba(15,15,15,0.9)';
  ctx.lineWidth = 1.1;
  ctx.fillStyle = '#6f767a';

  ctx.beginPath();
  ctx.moveTo(-len/2, -rad);
  ctx.lineTo( len/2, -rad);
  ctx.arc( len/2, 0, rad, -Math.PI/2,  Math.PI/2, false);
  ctx.lineTo(-len/2,  rad);
  ctx.arc(-len/2, 0, rad,  Math.PI/2, -Math.PI/2, false);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

export function drawFogOverlay(visibleSet){
  if (!visibleSet) return;
  fctx.clearRect(0, 0, fogCanvas.width, fogCanvas.height);
  fctx.fillStyle = 'rgba(40,40,40,0.7)';
  for (let x=0; x<GRID_W; x++){
    for (let y=0; y<GRID_H; y++){
      if (!visibleSet.has(`${x}-${y}`)){
        fctx.fillRect(x*CELL, y*CELL, CELL, CELL);
      }
    }
  }
  ctx.save();
  ctx.filter = 'blur(6px)';
  ctx.drawImage(fogCanvas, 0, 0);
  ctx.restore();
}

// --- Tooltip i statystyki celności ---
export function getAimDodgeAt(x, y, game){
  const sec = getSector(x, y, game);
  if (!sec) return { aim: 0, dodge: 0 };

  switch (sec.type){
    case FLAG_NAME:     			return { aim: BONUS_AIMING_FLAG, dodge: BONUS_DODGING_FLAG };
    case AROUND_THE_FLAG_NAME:   	return { aim: BONUS_AIMING_AROUND_FLAG, dodge: BONUS_DODGING_AROUND_FLAG };
    case BUILDING_NAME: 			return { aim: BONUS_AIMING_BUILDING, dodge: BONUS_DODGING_BUILDING };
    case WALL_NAME:     			return { aim: BONUS_AIMING_WALL, dodge: BONUS_DODGING_WALL };
    case TOWER_NAME:    			return { aim: BONUS_AIMING_TOWER, dodge: BONUS_DODGING_TOWER };
    default:         				return { aim: 0,  dodge: 0  };
  }
}

export function distancePenalty(shooter, target){
  const d = Math.abs(shooter.x - target.x) + Math.abs(shooter.y - target.y);
  const slope = 2;
  const maxCap = 45;
  const raw = (d - 1) * slope;
  return -Math.min(maxCap, Math.max(0, raw));
}

export function computeHitChance(game, shooter, target){
  const s = getAimDodgeAt(shooter.x, shooter.y, game);
  const t = getAimDodgeAt(target.x, target.y, game);
  const aim = BASE_AIM + s.aim + distancePenalty(shooter, target);
  const dodge = BASE_DODGE + t.dodge;
  const val = Math.max(5, Math.min(95, aim - dodge));
  return Math.round(val);
}

export function formatUnitStatsHTML(u, game){
  const sec = getSector(u.x, u.y, game);
  const team = u.team === game.attackersSign ? 'Atakujący' : 'Obrońca';

  const ter = getAimDodgeAt(u.x, u.y, game);
  const aimNoDist = BASE_AIM + ter.aim;
  const dodgeTot  = BASE_DODGE + ter.dodge;

  const enemies = u.team === game.attackersSign ? game.defenders : game.attackers;
  let nearest = null, bestD = Infinity;
  for (const e of enemies){
    if (e.hp <= 0) continue;
    const d = Math.abs(e.x - u.x) + Math.abs(e.y - u.y);
    if (d < bestD){ bestD = d; nearest = e; }
  }

  let sampleLine = '';
  if (nearest){
    const ch = computeHitChance(game, u, nearest);
    sampleLine = `<div>Przykł. szansa vs ${nearest.id} (d=${bestD}): ${ch}%</div>`;
  }

  const maxHp = Number.isFinite(u.maxHp) ? u.maxHp
               : (u.team === game.attackersSign ? (game.HPOfSingleAttacker ?? game.defaultHPOfSingleAttacker) : (game.HPOfSingleDefender ?? game.defaultHPOfSingleDefender));
  const curHp = Math.max(0, Math.min(maxHp, u.hp));

  return `
    <div><strong>${u.id}</strong> (${team})</div>
    <div>HP: ${curHp}/${maxHp}</div>
    <div>Sektor: ${sec ? sec.id : '-'}</div>

    <div style="margin-top:4px;"><u>Celowanie (bez dystansu)</u>: ${aimNoDist}
      <small> = ${BASE_AIM} ${ter.aim>=0?'+ ':''}${ter.aim}</small>
    </div>
    <div><u>Unikanie</u>: ${dodgeTot}
      <small> = ${BASE_DODGE} ${ter.dodge>=0?'+ ':''}${ter.dodge}</small>
    </div>

    ${sampleLine}
  `;
}

export function showUnitTooltip(u, game){
  const tt = document.getElementById('unitTooltip');
  const container = document.getElementById('gameContainer');

  tt.innerHTML = formatUnitStatsHTML(u, game);

  const crect = canvas.getBoundingClientRect();
  const conRect = container.getBoundingClientRect();

  const px = u.x * CELL + CELL + 8;
  const py = u.y * CELL - 6;

  let left = (crect.left - conRect.left) + px;
  let top  = (crect.top  - conRect.top)  + py;

  tt.style.display = 'block';
  tt.style.left = `${left}px`;
  tt.style.top  = `${top}px`;

  const ttRect = tt.getBoundingClientRect();
  const overRight = ttRect.right > conRect.right;
  const overBottom = ttRect.bottom > conRect.bottom;

  if (overRight) {
    left = (crect.left - conRect.left) + (u.x * CELL) - (ttRect.width + 8);
  }
  if (overBottom) {
    top = (crect.top - conRect.top) + (u.y * CELL) - (ttRect.height + 8);
  }

  tt.style.left = `${left}px`;
  tt.style.top  = `${top}px`;
  tt.style.display = 'block';
}

export function hideUnitTooltip(){
  const tt = document.getElementById('unitTooltip');
  if (tt) tt.style.display = 'none';
}

// --- Update UI ---
export function update(game){
  const ri = document.getElementById('roundInfo');
  if (ri) ri.textContent = `${game.round}/55`;

  const ti = document.getElementById('timeInfo');
  if (ti) ti.textContent = mmss(game.timer);

  const aAlive = game.attackers.filter(u => u.hp > 0).length;
  const dAlive = game.defenders.filter(u => u.hp > 0).length;

  const ai = document.getElementById('attackersInfo');
  if (ai) ai.textContent = `${aAlive} ${pluralJednostka(aAlive)}`;
  const di = document.getElementById('defendersInfo');
  if (di) di.textContent = `${dAlive} ${pluralJednostka(dAlive)}`;
  const fi = document.getElementById('flagInfo');
  if (fi) fi.textContent = `${game.flagCount > 0 ? 'Zajęta' : 'Wolna'} (${game.flagCount}/5)`;


  const tbAtt = document.getElementById('topAttackers'); if (tbAtt) tbAtt.textContent = String(aAlive);
  const tbDef = document.getElementById('topDefenders'); if (tbDef) tbDef.textContent = String(dAlive);
  const tbRound = document.getElementById('topRound');   if (tbRound) tbRound.textContent = `Runda ${game.round}/55`;
  const tbTimer = document.getElementById('topTimer');   if (tbTimer) tbTimer.textContent = mmss(game.timer);
  const tbFlag = document.getElementById('topFlag');     if (tbFlag) tbFlag.textContent = `${game.flagCount}/5`;
  
  
  
  
  // --- SUMA HP I PASKI (TOP BAR) ---
  const sumHp = (arr, game, side) => {
    let cur = 0, max = 0;
    for (const u of arr) {
      const baseMax = Number.isFinite(u.maxHp)
        ? u.maxHp
        : (side === game.attackersSign ? (game.HPOfSingleAttacker ?? game.defaultHPOfSingleAttacker) : (game.HPOfSingleDefender ?? game.defaultHPOfSingleDefender));
      const hpCur = Math.max(0, u.hp);
      cur += hpCur;
      max += baseMax;
    }
    return { cur, max };
  };

  const { cur: attCur, max: attMax } = sumHp(game.attackers, game, game.attackersSign);
  const { cur: defCur, max: defMax } = sumHp(game.defenders, game, game.defendersSign);

  const attPct = attMax > 0 ? Math.max(0, Math.min(100, Math.round((attCur / attMax) * 100))) : 0;
  const defPct = defMax > 0 ? Math.max(0, Math.min(100, Math.round((defCur / defMax) * 100))) : 0;

  const attBar = document.getElementById('topAttHpBar');
  if (attBar) attBar.style.width = `${attPct}%`;
  const attVal = document.getElementById('topAttHpVal');
  if (attVal) attVal.textContent = `${attCur} / ${attMax}`;

  const defBar = document.getElementById('topDefHpBar');
  if (defBar) defBar.style.width = `${defPct}%`;
  const defVal = document.getElementById('topDefHpVal');
  if (defVal) defVal.textContent = `${defCur} / ${defMax}`;

  const tbEnd = document.getElementById('topEndTurnBtn');
	if (tbEnd){
		
		let enabled;
		if (game.aiAutomaticallyEndTurns) {
			enabled = (game.defendersControl !== 'ai') && (game.mode === game.modePlay && game.phase === 0 && !game.over && !game.processingTurn);
			
		} else {
			enabled = (game.mode === game.modePlay && game.phase === 0 && !game.over && !game.processingTurn);
		}
		tbEnd.disabled = !enabled;
	}
}

// --- Rysowanie główne ---
function hasUnitsInSector(game, sectorId){
  const pos = enumerateSectorCells(sectorId);
  const res = { attackers: 0, defenders: 0 };
  for (const [x,y] of pos){
    for (const u of game.attackers) if (u.hp > 0 && u.x === x && u.y === y) res.attackers++;
    for (const u of game.defenders) if (u.hp > 0 && u.x === x && u.y === y) res.defenders++;
  }
  return res;
}

// --- Wykrywanie rotacji w planie gracza (defenders) ---

function buildSectorGraphForRender(game) {
  const g = new Map();
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  for (const k of game.cellToSector.keys()) {
    const [x, y] = k.split('-').map(Number);
    const a = game.cellToSector.get(k);
    if (!g.has(a)) g.set(a, new Set());
    for (const [dx, dy] of dirs) {
      const k2 = `${x + dx}-${y + dy}`;
      const b = game.cellToSector.get(k2);
      if (b && b !== a) g.get(a).add(b);
    }
  }
  return g;
}
function sectorsAdjacentOrSame(graph, sa, sb) {
  if (!sa || !sb) return false;
  if (String(sa) === String(sb)) return true;
  const s = graph.get(String(sa));
  return !!(s && s.has(String(sb)));
}
function computeDefRotationMeta(game) {
  const pm = game.plannedMoves || {};
  const team = game.defenders.filter(u => u.hp > 0);
  const pos2Id = new Map(team.map(u => [`${u.x}-${u.y}`, String(u.id)]));

  const graph = buildSectorGraphForRender(game);
  const out = {};
  const marked = new Set();

  for (const id of Object.keys(pm)) {
    if (marked.has(String(id))) continue;
    const move = pm[id];
    if (!move || move.x == null || move.y == null) continue;

    const u = team.find(x => String(x.id) === String(id));
    if (!u) continue;

    const targetKey = `${move.x}-${move.y}`;
    const otherId = pos2Id.get(targetKey);
    if (!otherId || String(otherId) === String(id)) continue;

    const v = team.find(x => String(x.id) === String(otherId));
    const mv = pm[otherId];
    if (!v || !mv || mv.x == null || mv.y == null) continue;

    if (!(mv.x === u.x && mv.y === u.y)) continue;

    const su = game.cellToSector.get(`${u.x}-${u.y}`);
    const sv = game.cellToSector.get(`${v.x}-${v.y}`);
    if (!sectorsAdjacentOrSame(graph, su, sv)) continue;

    out[String(id)] = { rot: true, color: 'green' };
    out[String(otherId)] = { rot: true, color: 'green' };
    marked.add(String(id));
    marked.add(String(otherId));
  }
  return out;
}

export function draw(game, opts = {}){
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1) Tła
  for (let x=0; x<GRID_W; x++){
    for (let y=0; y<GRID_H; y++){
      ctx.fillStyle = inFortInterior(x,y) ? (textures.inside || '#d1be93') : (textures.outside || '#4a7c4e');
      ctx.fillRect(x*CELL, y*CELL, CELL, CELL);
    }
  }

  // Siatka
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
  for (let x=0; x<=GRID_W; x++){
    ctx.beginPath(); ctx.moveTo(x*CELL, 0); ctx.lineTo(x*CELL, GRID_H*CELL); ctx.stroke();
  }
  for (let y=0; y<=GRID_H; y++){
    ctx.beginPath(); ctx.moveTo(0, y*CELL); ctx.lineTo(GRID_W*CELL, y*CELL); ctx.stroke();
  }

  // 2) Sektory + kontury i flaga
  for (const id in sectors) {
    const s = sectors[id];
    const cells = enumerateSectorCells(id);

    ctx.save();
    if (s.type === TOWER_NAME || s.type === WALL_NAME || s.type === BUILDING_NAME) {
      ctx.fillStyle = textures.wood;
      const vertical = (s.type !== BUILDING_NAME);
      const dmg = (s.type === BUILDING_NAME) ? 1 : 2;
      for (const [x,y] of cells) {
        ctx.fillRect(x*CELL, y*CELL, CELL, CELL);
        drawPlanksOnCell(x,y, vertical);
        drawDamageOnCell(x,y, dmg);
      }
    } else if (s.type === AROUND_THE_FLAG_NAME) {
      ctx.fillStyle = 'rgba(255,255,150,0.6)';
      for (const [x,y] of cells) ctx.fillRect(x*CELL, y*CELL, CELL, CELL);
    }
    ctx.restore();

    drawCellsOutline(cells);
    if (s.type === FLAG_NAME) drawAnimatedFlag(game);
  }

  // 3) Nakładki sektorów z jednostkami
  for (const id in sectors){
    const counts = hasUnitsInSector(game, id);
    const cells = enumerateSectorCells(id);

    if (counts.attackers > 0 && game.mode !== game.modeSetup){
      ctx.fillStyle = 'rgba(255,60,60,0.18)';
      cells.forEach(([x,y]) => ctx.fillRect(x*CELL, y*CELL, CELL, CELL));
    }
    if (counts.defenders > 0){
      ctx.fillStyle = 'rgba(60,120,255,0.18)';
      cells.forEach(([x,y]) => ctx.fillRect(x*CELL, y*CELL, CELL, CELL));
    }
  }

  // 4) Jednostki
  const units = (game.mode === game.modeSetup) ? game.defenders : [...game.defenders, ...game.attackers];
  for (const u of units){
    if (u.hp <= 0 && !u.deadPending) continue;

    let px = u.x, py = u.y;

	// Nowy system animacji – movingUnits zawiera BEZPOŚREDNIE płynne współrzędne
	if (game.movingUnits[u.id]) {
	  const pos = game.movingUnits[u.id];
	  px = pos.x;
	  py = pos.y;
	}

    const baseCol = (u.team === game.attackersSign) ? '#ff4444' : '#4444ff';
    let fillCol = baseCol;
    const hf = game.hitFlashes && game.hitFlashes[u.id];
    if (hf){
      const now = Date.now();
      const t = (now - hf.start) / hf.dur;
      if (t >= 1){
        delete game.hitFlashes[u.id];
      } else {
        const tri = t < 0.5 ? (t/0.5) : (1 - (t-0.5)/0.5);
        const strength = Math.min(1, Math.max(0, tri));
        fillCol = mixHex(baseCol, '#ffffff', strength);
      }
    }

    ctx.fillStyle = fillCol;
    ctx.fillRect(px*CELL+2, py*CELL+2, CELL-4, CELL-4);

    if (game.selected && game.selected.id === u.id){
      ctx.strokeStyle = '#ff0'; ctx.lineWidth = 4;
      ctx.strokeRect(px*CELL, py*CELL, CELL, CELL);
    }

    const maxHp = Number.isFinite(u.maxHp) ? u.maxHp
                 : (u.team === game.attackersSign ? (game.HPOfSingleAttacker ?? game.defaultHPOfSingleAttacker) : (game.HPOfSingleDefender ?? game.defaultHPOfSingleDefender));
    const hpClamped = Math.max(0, Math.min(maxHp, u.hp));
    const hpRatio = Math.max(0, Math.min(1, hpClamped / maxHp));

    ctx.fillStyle = '#000';
    ctx.fillRect(px*CELL+3, py*CELL+CELL-7, CELL-6, 4);
    ctx.fillStyle = hpRatio > 0.5 ? '#0f0' : (hpRatio > 0.25 ? '#ff0' : '#f00');
    ctx.fillRect(px*CELL+3, py*CELL+CELL-7, (CELL-6)*hpRatio, 4);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(u.id, px*CELL+CELL/2, py*CELL+CELL/2);
  }

  // 5) Strzałki planów AI (atakujący)
	const canDrawPlans =
	game.mode === game.modePlay &&
	game.phase === 0 &&
	!game.over &&
	Object.keys(game.movingUnits || {}).length === 0 &&
	(!game.projectiles || game.projectiles.length === 0);

	if (canDrawPlans) {
		drawAiAttPlans(game, ctx);
		drawAiDefPlans(game, ctx);
	}

  // 6) Pociski
  if (Array.isArray(game.projectiles) && game.projectiles.length) {
    for (const p of game.projectiles) drawBulletProjectile(p);
  }

  // 7) Strzałki planów ruchu gracza (defenders) z wykryciem rotacji
  if (game.mode === game.modePlay && game.phase === 0 && !game.over && Object.keys(game.movingUnits).length === 0){
    const pm = game.plannedMoves || {};
    const rotMeta = computeDefRotationMeta(game);

    for (const uid of Object.keys(pm)){
      const u = game.defenders.find(d => String(d.id) === String(uid));
      if (!u || u.hp <= 0) continue;

      const dest = pm[uid];
      if (!dest || dest.x == null || dest.y == null) continue;

      const meta = rotMeta[String(uid)] || {};
      const gradCol = getPlanArrowGradient(game, game.defendersSign, meta);

      const x0 = u.x*CELL + CELL/2, y0 = u.y*CELL + CELL/2;
      const x1 = dest.x*CELL + CELL/2, y1 = dest.y*CELL + CELL/2;

      drawGradientArrow(x0, y0, x1, y1, gradCol.start, gradCol.end, Math.max(10, CELL * 0.45));
    }
  }

  // 9) Numery sektorów
  if (game.showSectorIds){
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 18px Courier New';

    const centers = sectorCenters.value;
    for (const id in sectors){
      const c = centers && centers[id];
      if (!c) continue;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 2;
      ctx.strokeText(String(id), c.x, c.y);
      ctx.fillStyle = '#fff';
      ctx.fillText(String(id), c.x, c.y);
    }
    ctx.restore();
  }

  // 10) Koordynaty pól
  if (game.showCoords){
    ctx.font = '8px Courier New';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    for (let x=0; x<GRID_W; x++){
      for (let y=0; y<GRID_H; y++){
        const t = `${x}-${y}`;
        ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeText(t, x*CELL+2, (y+1)*CELL-2);
        ctx.fillStyle = '#fff'; ctx.fillText(t, x*CELL+2, (y+1)*CELL-2);
      }
    }
  }

  // 11) FOV overlay
  let fovSet = game.hoverFOV;
  if (fovSet && fovSet.size) {
    drawFogOverlay(fovSet);
  }

  game.flagPhase += 1;
}

export function drawAiAttPlans(game, ctx){
if (game.mode !== game.modePlay || game.phase !== 0 || game.showAIPlans === false) return;

	//console.log("rendering.js drawAiAttPlans");

  const plans = game.aiAttPlansToDraw;

  
  if (!plans || !Object.keys(plans).length) 
  {
	//console.log("nie ma planów, nie rysuję nic");
	return;
  }
  
  //console.log("plans do narysowania dla att = ", plans);
  
  const center = (x,y) => ({ cx: x*CELL + CELL/2, cy: y*CELL + CELL/2 });

  function sectorCentroid(secId){
    let sumx=0, sumy=0, n=0;
    for (const [sx,sy] of enumerateSectorCells(secId)){ sumx+=sx; sumy+=sy; n++; }
    if (n===0) return null;
    const x = Math.round(sumx/n), y = Math.round(sumy/n);
    return { x, y };
  }

  for (const id of Object.keys(plans)){
    const u = game.attackers.find(a => String(a.id) === String(id) && a.hp > 0);
    if (!u) continue;

    const p = plans[id];
    let tx = p?.x, ty = p?.y;

    if ((tx == null || ty == null) && p?.sec != null){
      const c = sectorCentroid(p.sec);
      if (c) { tx = c.x; ty = c.y; }
    }
    if (tx == null || ty == null) continue;

    const { cx: fx, cy: fy }   = center(u.x, u.y);
    const { cx: txc, cy: tyc } = center(tx, ty);

    const gradCol = getPlanArrowGradient(game, game.attackersSign, p);
    drawGradientArrow(fx, fy, txc, tyc, gradCol.start, gradCol.end, Math.max(10, CELL * 0.45));
  }
}


// Rysowanie strzałek planów OBRONCÓW (format planu: { d1:{x,y}, d2:{x,y}, ... })
export function drawAiDefPlans(game, ctx) {
  if (game.mode !== game.modePlay || game.phase !== 0 || game.showAIPlans === false) return;

  const plans = game.aiDefPlansToDraw;
  
  //console.log("game.aiDefPlansToDraw = ", game.aiDefPlansToDraw);
  
  if (!plans || !Object.keys(plans).length) return;

  const center = (x, y) => ({ cx: x * CELL + CELL / 2, cy: y * CELL + CELL / 2 });

  for (const id of Object.keys(plans)) {
    const u = game.defenders.find(d => String(d.id) === String(id) && d.hp > 0);
    if (!u) continue;

    const p = plans[id];
    const tx = p?.x, ty = p?.y;
    if (tx == null || ty == null) continue;

    const { cx: fx, cy: fy }   = center(u.x, u.y);
    const { cx: txc, cy: tyc } = center(tx, ty);

    const gradCol = getPlanArrowGradient(game, game.defendersSign, p);
    drawGradientArrow(fx, fy, txc, tyc, gradCol.start, gradCol.end, Math.max(10, CELL * 0.45));
  }
}