"use client";

import { useSyncExternalStore } from "react";

// Chiptune sound effects made on the fly with the Web Audio API: square and
// triangle waves, like an 8-bit console. Off when the player mutes them
// (remembered in this browser).

const MUTE_KEY = "clarion-game-muted";
let audio: AudioContext | null = null;
const listeners = new Set<() => void>();

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

let muted: boolean | null = null;

function isMuted(): boolean {
  if (muted === null) muted = typeof window === "undefined" ? true : readMuted();
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  try {
    window.localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    // Private mode: the setting lasts for this visit.
  }
  listeners.forEach((l) => l());
}

export function useMuted(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    isMuted,
    () => true,
  );
}

type Note = { f: number; d: number; type?: OscillatorType; slide?: number; at?: number; vol?: number };

function play(notes: Note[]) {
  if (typeof window === "undefined" || isMuted()) return;
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
    const start = audio.currentTime + 0.01;
    for (const n of notes) {
      const t = start + (n.at ?? 0);
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = n.type ?? "square";
      osc.frequency.setValueAtTime(n.f, t);
      if (n.slide) osc.frequency.exponentialRampToValueAtTime(n.slide, t + n.d);
      gain.gain.setValueAtTime(n.vol ?? 0.04, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + n.d);
      osc.connect(gain).connect(audio.destination);
      osc.start(t);
      osc.stop(t + n.d + 0.02);
    }
  } catch {
    // No audio available: play on in silence.
  }
}

export const sfx = {
  select: () => play([{ f: 880, d: 0.05 }]),
  coin: () => play([{ f: 988, d: 0.08 }, { f: 1319, d: 0.25, at: 0.08 }]),
  equip: () => play([{ f: 330, d: 0.06 }, { f: 494, d: 0.08, at: 0.06 }]),
  hit: () => play([{ f: 220, d: 0.12, slide: 80, type: "sawtooth", vol: 0.05 }]),
  crit: () => play([{ f: 660, d: 0.06 }, { f: 220, d: 0.2, slide: 60, type: "sawtooth", vol: 0.06, at: 0.05 }]),
  miss: () => play([{ f: 300, d: 0.1, slide: 200, type: "triangle", vol: 0.05 }]),
  hurt: () => play([{ f: 160, d: 0.18, slide: 60, type: "square", vol: 0.05 }]),
  heal: () => play([{ f: 523, d: 0.08 }, { f: 659, d: 0.08, at: 0.08 }, { f: 784, d: 0.14, at: 0.16 }]),
  error: () => play([{ f: 196, d: 0.12 }, { f: 147, d: 0.18, at: 0.1 }]),
  victory: () =>
    play([
      { f: 523, d: 0.12 },
      { f: 659, d: 0.12, at: 0.12 },
      { f: 784, d: 0.12, at: 0.24 },
      { f: 1047, d: 0.4, at: 0.36 },
    ]),
  defeat: () =>
    play([
      { f: 392, d: 0.2, type: "triangle", vol: 0.06 },
      { f: 330, d: 0.2, type: "triangle", vol: 0.06, at: 0.2 },
      { f: 262, d: 0.5, type: "triangle", vol: 0.06, at: 0.4 },
    ]),
  // "You got an item!" fanfare.
  fanfare: () =>
    play([
      { f: 587, d: 0.1 },
      { f: 659, d: 0.1, at: 0.1 },
      { f: 698, d: 0.1, at: 0.2 },
      { f: 784, d: 0.5, at: 0.3 },
      { f: 392, d: 0.5, type: "triangle", vol: 0.05, at: 0.3 },
    ]),
};
