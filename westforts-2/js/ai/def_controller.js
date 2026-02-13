// js/ai/def_controller.js
import { initSession, runLogits } from './def_policy.js';
import { buildObsGlobal, buildUnitFeat, buildMask, ALL_SECTORS } from './encoder.js';
import { enumerateSectorCells } from '../sectors.js';
import { canEnterCell } from '../rules.js';
import { logDefenderMaskInfo } from './encoder.js';

let ready = false;

export async function initDefAI() {
  if (!ready) {
    await initSession("/js/ai/def_policy_single.onnx"); // ścieżka do modelu
    ready = true;
  }
}

/**
 * Zwraca plan obrony w formacie { [id]: {x,y} }
 */
export async function getAiDefPlan(game) {
	//console.log("getAiDefPlan, ready = ", ready);
  if (!ready) await initDefAI();

  const plan = {};
  const obs_global = buildObsGlobal(game);

  for (const d of game.defenders) {
    if (d.hp <= 0) continue;

    const unit_feat = buildUnitFeat(d);
    const mask      = buildMask(game, d);

    const logits = await runLogits(obs_global, unit_feat, mask);
    const action = argmax(logits);
	
	logDefenderMaskInfo(game, d, mask, action);

    // 73 = STAY (bo A=74: 0..72 sektory, 73 - stay)
    if (action === 63) {
      plan[d.id] = { x: d.x, y: d.y };
      continue;
    }

    const targetSectorId = ALL_SECTORS[action]; // string ID sektora
    const cell = pickCellInsideSector(game, targetSectorId, d);
    plan[d.id] = cell ?? { x: d.x, y: d.y };
  }

  return plan;
}

function argmax(arr) {
  let best = -Infinity, idx = 0;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > best) { best = arr[i]; idx = i; }
  }
  return idx;
}

// Prosty wybór komórki w sektorze: najbliższa legalna wolna
function pickCellInsideSector(game, sectorId, defender) {
  let best = null, bd = Infinity;

  // bieżąca zajętość (żywi)
  const occ = new Set(
    [...game.attackers, ...game.defenders]
      .filter(u => u.hp > 0)
      .map(u => `${u.x}-${u.y}`)
  );

  for (const [sx, sy] of enumerateSectorCells(String(sectorId))) {
    const k = `${sx}-${sy}`;
    // wolne i przejściowe
    const isFree = !occ.has(k);
    if (!isFree) continue;

    if (!canEnterCell(game, game.defendersSign, defender.x, defender.y, sx, sy)) continue;

    const d = Math.abs(sx - defender.x) + Math.abs(sy - defender.y);
    if (d < bd) { bd = d; best = { x: sx, y: sy }; }
  }

  return best;
}