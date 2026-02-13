// js/constants.js

export const GRID_W = 34;
export const GRID_H = 24;
export const CELL   = 30;

export const BASE_AIM = 70;
export const BASE_DODGE = 20;

export const BULLET_SPEED = 1.1;
export const DEF_SHOT_DELAY_MS = 111;
export const ATT_SHOT_DELAY_MS = 66;
export const HIT_FLASH_MS = 120;

export const fortInterior = { x:[10,23], y:[6,14] };
export const ATTACKER_START_SECTORS = ['1', '2', '3', '4', '5', '6', '7'];
export const DEFENDER_START_SECTORS = [
  34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45,
  46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57,
  58, 59, 60, 61, 62, 63
];

export const FLAG_CELLS = [
  [16, 9],
  [16, 10],
  [17, 9],
  [17, 10]
];

export const GATE_SECTOR_NUMBER = '41';

export const TOWER_NAME = 'tower';
export const WALL_NAME = 'wall';
export const FLAG_NAME = 'flag';
export const AROUND_THE_FLAG_NAME = 'around_flag';
export const BUILDING_NAME = 'building';
export const GROUND_NAME = 'ground';


export const BONUS_AIMING_TOWER = 20;
export const BONUS_DODGING_TOWER = 25;
export const BONUS_AIMING_WALL = 20;
export const BONUS_DODGING_WALL = 15;
export const BONUS_AIMING_FLAG = -30;
export const BONUS_DODGING_FLAG = -25;
export const BONUS_AIMING_AROUND_FLAG = -15;
export const BONUS_DODGING_AROUND_FLAG = -20;
export const BONUS_AIMING_BUILDING = 20;
export const BONUS_DODGING_BUILDING = 10;