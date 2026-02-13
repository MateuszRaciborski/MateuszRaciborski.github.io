// js/state.js
// stan gry

const ROUND_TIME = 69; // in seconds
const MODE_SETUP = 'setup';
const MODE_PLAY = 'play';
const MODE_WAIT = 'wait';

export function initState(){
	return {
		flagCount: 0, // zlicza ile rund pod rząd atakujący stoją na fladze - 5 oznacza wygraną atakujących
		attackers: [], // przechowuje wszystkich atakujących, mają oni hp, x, y
		defenders: [], // przechowuje wszystkich obrońców, mają oni hp, x, y
		over: false, // true oznacza zakończenie gry - wygrali atakujący lub obrońcy
		winner: null, // przyjmuje null, 'att' lub 'def'
		attackersSign: 'att',
		defendersSign: 'def',
		modeWait: MODE_WAIT,
		modePlay: MODE_PLAY,
		modeSetup: MODE_SETUP,
		mode: MODE_WAIT, // przyjmuje 'wait', 'play', 'setup'
	  
		running: false, // gdy gra uruchomiona, ale sprawdzić trzeba czy rzeczywiście coś robi
		playerMoved: false, // NIE WIEM, sprawdzic co to robi
	  
		roundTime: ROUND_TIME, // tej wartości w trakcie gry nie zmieniamy, zawsze runda trwa tyle samo
		timer: ROUND_TIME, // odlicza czas do końca rundy a z nową rundą resetujemy ten licznik
		processingTurn: false, // true mówi: trwa wykonywanie faz tury — nie wolno teraz odpalać kolejnych ruchów ani klikać end‑turn
	  
		showAIPlans: true, // pokazuje lub ukrywa strzałki atakujących AI
		
		// służy do rysowania strzałek ruchu dla AI
		aiDefPlansToDraw: {},
		aiAttPlansToDraw: {},
	  
	  
		defendersControl: 'human', // 'human' | 'ai'
		attackersControl: 'ai', // kiedyś dodam human
		selected: null, // oznacza aktualnie zaznaczony kwadracik obrońcy; selected posiada id, x, y, team, hp
	  
		// do rysowania pola widzenia kwadracika
		hoverCell: null,
		hoverFOV: null,
	  
		maximumNumberOfDefenders: 42,
		maximumNumberOfAttackers: 50,
		numberOfDefendersFromUser: null, // z modala od użytkownika brane lub jako domyślne gdy nie poda
		numberOfAttackersFromUser: null, // z modala od użytkownika brane lub jako domyślne gdy nie poda
		defaultNumberOfDefenders: 2,
		defaultNumberOfAttackers: 25,
	  
		maximumHPOfSingleShooter: 33000,
		defaultHPOfSingleDefender: 4000,
		defaultHPOfSingleAttacker: 4400,
	  
		// ustawiane z modala od użytkownika lub jako domyślne gdy nie poda
		HPOfSingleDefender: null,
		HPOfSingleAttacker: null,
	  
		hitFlashes: {}, // trzyma które kwadraciki podświetlić, bo dostali obrażenia
		flagPhase: 0, // do animowania flagi coś tam
		cellToSector: new Map(), // w sectors.js funkcja buildCellMap buduje to, żeby wziąć do którego sektora należy kratka
	  
		//do rysowania strzałów
		projectiles: [],
	  
		// do rysowania/ukrycia numerów sektorów i kratek
		showCoords: false,
		showSectorIds: false,
	  
		phase: 0, // przechowuj aktualną fazę rundy - 1 strzelanie obrońców, 2 ruch obrońców, 3 strzelanie atakujących, 4 ruch atkaujących
		round: 1, // rundy od 1 do 55
		
		unitsPositions: [], // tu trzymam aktualny stan mapy - gdzie są jednostki, a ktore pola wolne
	  
		// PLANNED MOVES TO TYLKO RUCHY ZE STRZAŁEK - NA RAZIE TYLKO OBROŃCÓW, PÓŹNIEJ TEŻ ATAKUJĄCYCH
		plannedMoves: {}, // planowane ruchy gracza - strzałki - zapisują się tutaj, pod plannedMoves.d1,d2,d3...
	  
		// te dwie tablice uzupełniam: id, x, y, toX, toY. po wykonaniu ruchów zeruję.
		// uzupełniam dopiero po rozpatrzeniu ruchów danej strony, kiedy mamp ewność, że ten kwadracik skończy ruch w tej kratce
		defUnitsMoveAnimations: [],
		attUnitsMoveAnimations: [],
	  
	  
		attackersAIPlannedMoves: {},
	  
		aiAutomaticallyEndTurns: false,
	  
		movingUnits: {}, //potrzebne do animacji // mam nową animację w sim.js [playDefAnimations] a animacji jeszcze nie naprawiałem tej starej [12.02.2026]
	  
	  
		// units wtedy nie będzie aktualizował game.defenders
		// const units = game.defenders.map(u => ({ ...u }));
	  
		/* units będzie aktualizował defenders i attackers
		const units = (type === "def")
		  ? game.defenders.filter(u => u.hp > 0)
		  : game.attackers.filter(u => u.hp > 0);
		*/
	  
	  
		// KOPIA TABLICY!
		// let unitsSortedDefAfterRotations = [...unitsSortedDef]; 
	  
		// a to przypisanie do oryginalu, i operacje na kopii wpłyną też na oryginał
		// let unitsSortedDefAfterRotations = unitsSortedDef;
	  
		// DO ZROBIENIA - ruch ataku i obrony, ładnie podpięty pod wybór w menu
	};
}