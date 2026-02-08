import { initState } from './state.js';
import { buildCellMap } from './sectors.js';
import { computeSectorCenters } from './geometry.js';
import { attachCanvas, draw, update } from './rendering.js';
import { attachUI } from './ui.js';

const game = initState();
const { canvas, ctx } = attachCanvas();

function runLoop(){
  requestAnimationFrame(runLoop);
  if (game.running || game.mode!=='wait') draw(game);
}

async function init(){
  buildCellMap(game);
  computeSectorCenters();
  attachUI(game);

  update(game);
  draw(game);

  // otwórz modal startowy, tak jak robiłeś dotąd
  const startModal = document.getElementById('startModal');
  if (startModal) startModal.style.display = 'flex';
  
  window.game = game;
}

runLoop();
init();