import { buildCellMap, enumerateSectorCells, ATTACKER_START_SECTORS, DEFENDER_START_SECTORS } from "./sectors.js";
import { aiPlanMoves } from "./ai/attackers.js";
import { markRotationsInPlan } from "./sim.js";

const NUMBER_OF_ATTACKERS = 10

export function initGame() {

    const game = {
        round: 0,
        phase: 0,
        over: false,
        winner: null,
        processingTurn: false,
		noAnimation: true,

        defenders: [],
        attackers: [],

        cellToSector: new Map(),
        unitsPositions: [],
        plannedMoves: {},
        turnPlans: { def: {}, att: {} },

        flagCount: 0,
        hitFlashes: {},
        projectiles: [],
        ui: { plannedMoves: {} }
    };

    buildCellMap(game);

    for (let y = 0; y < 24; y++) {
        game.unitsPositions.push(new Array(34).fill(0));
    }

    let did = 0;
    for (const sec of DEFENDER_START_SECTORS) {
        for (const [x, y] of enumerateSectorCells(String(sec))) {
            if (did >= 10) break;
            game.defenders.push({
                id: `d${did}`,
                x, y,
                hp: 1700,
                team: "def",
                m: false,
                s: false,
                deadPending: false
            });
            game.unitsPositions[y][x] = 1;
            did++;
        }
        if (did >= 10) break;
    }

    let aid = 0;
    for (const sec of ATTACKER_START_SECTORS) {
        for (const [x, y] of enumerateSectorCells(String(sec))) {
            if (aid >= NUMBER_OF_ATTACKERS) break;
            game.attackers.push({
                id: `a${aid}`,
                x, y,
                hp: 2000,
                team: "att",
                m: false,
                s: false,
                deadPending: false
            });
            game.unitsPositions[y][x] = 1;
            aid++;
        }
        if (aid >= NUMBER_OF_ATTACKERS) break;
    }

    game.flagCells = [
        [16, 9],
        [17, 9],
        [16, 10],
        [17, 10]
    ];

    const attRaw = aiPlanMoves(game) || {};
    const attPlan = markRotationsInPlan(game, attRaw, "att");
    game.turnPlans = { def: {}, att: attPlan };

    return game;
}

export function resetFullGame() {
    //console.log("JS: FULL RESET");
    window.game = initGame();
}

window.resetFullGame = resetFullGame;
window.initGame = initGame;