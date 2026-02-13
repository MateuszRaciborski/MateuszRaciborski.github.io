// js/main.js

import { initState } from './state.js';
import { buildCellMap } from './sectors.js';
import { computeSectorCenters } from './geometry.js';
import { attachCanvas, draw, update } from './rendering.js';
import { attachUI } from './ui.js';
import { initDefAI } from './ai/def_controller.js';

const game = initState();
const { canvas } = attachCanvas();

function runLoop(){
	requestAnimationFrame(runLoop);
	if (game.running || game.mode !== game.modeWait) {
		draw(game);
	}
}

async function init(){
	//console.log("buildCellMap map z main.js");
	buildCellMap(game);
	computeSectorCenters();
	attachUI(game);
	
	await initDefAI(); // musi to być, inaczej AI nie uruchomi się od początku
}

runLoop();
init();