// js/util.js
// Zbiór drobnych helperów wykorzystywanych w wielu modułach.

/**
 * Ogranicza wartość v do zakresu [a, b].
 */
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * Jak clamp, ale po drodze rzutuje do liczby całkowitej (floor) i pilnuje zakresu.
 * Przydatne do pól input number (np. liczba jednostek).
 */
export function clampInt(v, min, max){
  return Math.max(min, Math.min(max, Math.floor(Number.isFinite(v) ? v : min)));
}

/**
 * Format czasu w mm:ss z liczby sekund.
 */
export const mmss = (s) => {
  const sec = Math.max(0, Math.floor(s));
  return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
};

/**
 * Polski plural dla słowa „jednostka”.
 */
export function pluralJednostka(n){
  const abs = Math.abs(n);
  const mod100 = abs % 100;
  const mod10 = abs % 10;

  if (mod100 >= 12 && mod100 <= 14) return 'jednostek';
  if (mod10 === 1) return 'jednostka';
  if (mod10 >= 2 && mod10 <= 4) return 'jednostki';
  return 'jednostek';
}

/**
 * Konwersja HEX -> RGB.
 */
export function hexToRgb(h){
  const x = parseInt(h.slice(1), 16);
  return { r: (x >> 16) & 255, g: (x >> 8) & 255, b: x & 255 };
}

/**
 * Konwersja RGB -> HEX.
 */
export function rgbToHex(r,g,b){
  const toHex = (v) => Math.max(0, Math.min(255, v|0)).toString(16).padStart(2,'0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Mieszanie dwóch kolorów HEX współczynnikiem t ∈ [0,1].
 */
export function mixHex(c1, c2, t){
  const a = hexToRgb(c1), b = hexToRgb(c2);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bb = Math.round(a.b + (b.b - a.b) * t);
  return rgbToHex(r, g, bb);
}

/**
 * Prosty delay na Promise – wygodne do pauz między fazami.
 */
export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));