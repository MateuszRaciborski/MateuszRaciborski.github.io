function applyDefenderAction(game, action){
	//console.log("applyDefenderAction");
    const pm = {};
    for(let i=0;i<10;i++){
        pm[`d${i}`] = { 
		
			//gdy model zwraca liczby całkowite
			x: action[2*i], 
            y: action[2*i+1] 
			
			// gdy model zwraca z okolic zera floaty
            //x: Math.floor(action[2*i]), 
            //y: Math.floor(action[2*i+1]) 
        };
    }
    game.plannedMoves = pm;
    game.turnPlans.def = pm;
}

function buildObservation(game){
    const H=24,W=34;
    const obs=[...Array(14)].map(()=>Array.from({length:H},()=>Array(W).fill(0)));

    for(const [x,y] of [[16,9],[17,9],[16,10],[17,10]]) obs[1][y][x]=1;

    for(const d of game.defenders) if(d.hp>0) obs[2][d.y][d.x]=1;
    for(const a of game.attackers) if(a.hp>0) obs[12][a.y][a.x]=1;

    const r = Math.min(1, game.round/55);
    for(let y=0;y<H;y++) for(let x=0;x<W;x++) obs[13][y][x]=r;

    return obs;
}


// pierwszy komp reward 10 000 kroków przetrenowany był
/*
function computeReward(game){
  // cache poprzednich metryk
  if (!game._rl) {
    game._rl = {
      prevAliveAtt: game.attackers.filter(u => u.hp > 0).length,
      prevAliveDef: game.defenders.filter(u => u.hp > 0).length,
      prevRound: game.round,
      prevOnFlag: 0, // nie używamy delty dla flagi – kara jest za stan bieżący
      doneGiven: false // by nie dublować premii/kary terminalnej
    };
  }

  const aliveAtt = game.attackers.filter(u => u.hp > 0).length;
  const aliveDef = game.defenders.filter(u => u.hp > 0).length;

  // czerwony na fladze (jakikolwiek)
  const onFlag = game.attackers.some(u => u.hp > 0 && (u.x === 16 || u.x === 17) && (u.y === 9 || u.y === 10)) ? 1 : 0;

  let r = 0;

  // 1) zabici czerwoni: wzrost nagrody o liczbę ubitych od ostatniego calla
  const killedAtt = game._rl.prevAliveAtt - aliveAtt; // >0 oznacza, że kogoś zabiliśmy
  if (killedAtt > 0) r += +1 * killedAtt;

  // 2) straty niebieskich
  const lostDef = game._rl.prevAliveDef - aliveDef; // >0 oznacza stratę naszej jednostki
  if (lostDef > 0) r += -1 * lostDef;

  // 3) nowa runda
  if (game.round > game._rl.prevRound) {
    r += (game.round - game._rl.prevRound) * 1; // +1 za każdą kolejną rundę
  }

  // 4) kara za przeciwnika na fladze (stan bieżący, nie delta)
  if (onFlag === 1) r += -2;

  // 5) bonus/ kara terminalna – tylko raz
  if (game.over && !game._rl.doneGiven) {
	  
		if (game.over && game.winner === "def") {
			r += (55 - game.round) * 0.2;  // im szybciej obrońcy wygrali, tym lepiej
		}
		
		if (game.over && game.winner === "att") {
			r -= (55 - game.round) * 0.4;  // im szybciej przegrali, tym gorzej
		}
		game._rl.doneGiven = true;
  }

  // update cache
  game._rl.prevAliveAtt = aliveAtt;
  game._rl.prevAliveDef = aliveDef;
  game._rl.prevRound = game.round;
  game._rl.prevOnFlag = onFlag;

  return r;
}
*/

/*
function computeReward(game){
  // --- inicjalizacja pamięci delty ---
  if (!game._rl) {
    game._rl = {
      prevAliveAtt: game.attackers.filter(u => u.hp > 0).length,
      prevAliveDef: game.defenders.filter(u => u.hp > 0).length,
      prevRound: game.round,
      prevFlagCount: game.flagCount || 0, // kolejne tury z czerwonym na fladze
      doneGiven: false
    };
  }

  const aliveAtt = game.attackers.filter(u => u.hp > 0).length;
  const aliveDef = game.defenders.filter(u => u.hp > 0).length;
  const flagCount = game.flagCount || 0;
  const anyOnFlag = game.attackers.some(u => u.hp > 0 && (u.x === 16 || u.x === 17) && (u.y === 9 || u.y === 10));

  let r = 0;

  // --- shaping zgodny z celem ---
  // 1) Przetrwanie rundy (A)
  if (game.round > game._rl.prevRound) {
    r += 0.2 * (game.round - game._rl.prevRound);
  }

  // 2) Postęp w eliminacji przeciwnika (B)
  const killedAtt = Math.max(0, game._rl.prevAliveAtt - aliveAtt);
  if (killedAtt > 0) r += +1.0 * killedAtt;

  // 3) Straty obrońców – zniechęcamy do „szarży”
  const lostDef = Math.max(0, game._rl.prevAliveDef - aliveDef);
  if (lostDef > 0) r += -1.0 * lostDef;

  // 4) Kontrola flagi: kara za każdą turę z czerwonym na fladze (A)
  if (anyOnFlag) r += -0.5;

  // 5) Streak flagi: kara za wzrost licznika i premia za przełamanie (A)
  const dStreak = flagCount - game._rl.prevFlagCount;
  if (dStreak > 0) r += -1.0 * dStreak;                 // przeciwnik utrzymuje kontrolę
  if (game._rl.prevFlagCount > 0 && flagCount === 0) r += +2.0; // odbiliśmy flagę

  // --- sygnał terminalny (tylko raz) ---
  if (game.over && !game._rl.doneGiven) {
    if (game.winner === "def") r += 20;    // (A) lub (B) – wygrana obrońców
    else if (game.winner === "att") r += -10;
    game._rl.doneGiven = true;
  }

  // --- update pamięci ---
  game._rl.prevAliveAtt = aliveAtt;
  game._rl.prevAliveDef = aliveDef;
  game._rl.prevRound    = game.round;
  game._rl.prevFlagCount= flagCount;

  return r;
}
*/



// mocne zastosowanie punktacji za przetrwanie więcej rund niż mniej i odległość obrońców do flagi niższa niż atakierów
function computeReward(game){
  // --- stałe do strojenia ---
  const ROUND_SCALE   = 10.0;   // siła bonusu za przetrwaną rundę, rośnie z numerem rundy
  const PROX_SCALE    = 5.0;   // waga przewagi dystansowej do flagi
  const ONFLAG_PEN    = -7.0;  // kara, gdy czerwony stoi na fladze (stan bieżący)
  const KILL_ATT_REW  = 1.0;  // za zabitego czerwonego
  const LOSE_DEF_PEN  = -2.0;  // za stratę obrońcy
  const WIN_BONUS     = 50.0; // wygrana obrońców
  const LOSE_PENALTY  = -20.0; // przegrana obrońców

  // --- init pamięci delty ---
  if (!game._rl) {
    game._rl = {
      prevAliveAtt: game.attackers.filter(u => u.hp > 0).length,
      prevAliveDef: game.defenders.filter(u => u.hp > 0).length,
      prevRound: game.round,
      doneGiven: false
    };
  }

  const aliveAtt = game.attackers.filter(u => u.hp > 0).length;
  const aliveDef = game.defenders.filter(u => u.hp > 0).length;

  // flaga – środek 2x2
  const flag = { x: 16.5, y: 9.5 };
  const anyOnFlag = game.attackers.some(u => u.hp > 0 && (u.x === 16 || u.x === 17) && (u.y === 9 || u.y === 10));

  // pomocnicze: minimalny dystans do flagi
  const minDist = (units) => {
    let d = Infinity;
    for (const u of units) {
      if (u.hp <= 0) continue;
      const dx = u.x - flag.x, dy = u.y - flag.y;
      const dd = Math.hypot(dx, dy);
      if (dd < d) d = dd;
    }
    return d;
  };

  let r = 0;

  // 1) DRAMATYCZNIE rosnący bonus za przetrwaną rundę
  if (game.round > game._rl.prevRound) {
    // suma arytmetyczna z zakresu (prevRound+1 .. game.round)
    const a = game._rl.prevRound + 1;
    const b = game.round;
    const k = b - a + 1;
    const sumRounds = (a + b) * k / 2; // ∑ t
    r += ROUND_SCALE * sumRounds;
  }

  // 2) Przewaga dystansowa do flagi: im obrońcy bliżej niż atakujący, tym lepiej
  const dDef = minDist(game.defenders);
  const dAtt = minDist(game.attackers);
  if (Number.isFinite(dDef) || Number.isFinite(dAtt)) {
    // jeśli kogoś brak, traktuj jak „bardzo daleko”
    const defD = Number.isFinite(dDef) ? dDef : 1e3;
    const attD = Number.isFinite(dAtt) ? dAtt : 1e3;
    // dodatni, gdy obrońcy są bliżej od atakujących
    let diff = attD - defD;
    // lekkie ograniczenie, by nie eksplodowało
    if (diff > 10) diff = 10;
    if (diff < -10) diff = -10;
    r += PROX_SCALE * diff;
  }

  // 3) Kille / straty
  const killedAtt = Math.max(0, game._rl.prevAliveAtt - aliveAtt);
  if (killedAtt > 0) r += KILL_ATT_REW * killedAtt;

  const lostDef = Math.max(0, game._rl.prevAliveDef - aliveDef);
  if (lostDef > 0) r += LOSE_DEF_PEN * lostDef;

  // 4) Kara za czerwonego na fladze (stan bieżący)
  if (anyOnFlag) r += ONFLAG_PEN;

  // 5) Terminal – tylko raz
  if (game.over && !game._rl.doneGiven) {
    if (game.winner === "def") r += WIN_BONUS;
    else if (game.winner === "att") r += LOSE_PENALTY;
    game._rl.doneGiven = true;
  }

  // --- update pamięci ---
  game._rl.prevAliveAtt = aliveAtt;
  game._rl.prevAliveDef = aliveDef;
  game._rl.prevRound    = game.round;

  return r;
}


function resetFullGame(){
    game = initGame();
}



window.buildObservation = buildObservation;
window.applyDefenderAction = applyDefenderAction;
window.computeReward = computeReward;
window.resetFullGame = resetFullGame;
