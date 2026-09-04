// SPDX-License-Identifier: Apache-2.0
/**
 * Wind — the gust the particle field is blowing right now, for anything
 * else that moves in it (the hanging scroll). A module-level value, not a
 * custom property on <html>: a property on the root inherits, so every
 * write recalculated style for every element in the document — measured
 * at ~6 ms a write on the welcome doc, ten times a second.
 */

let gust = 0;
let dir = 1;

/** `gust` 0..1 (how hard), `dir` -1 | 1 (which way). */
export function setWind(g: number, d: number): void { gust = g; dir = d; }
export function getWind(): { gust: number; dir: number } { return { gust, dir }; }
