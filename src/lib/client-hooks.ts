"use client";

import { useSyncExternalStore } from "react";

// Shared clock: re-renders subscribers every 30 seconds so "5 min ago" and
// "Overdue" labels stay current without each component running a timer.

let now = new Date();
const clockListeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribeClock(listener: () => void) {
  clockListeners.add(listener);
  if (!timer) {
    timer = setInterval(() => {
      now = new Date();
      clockListeners.forEach((l) => l());
    }, 30_000);
  }
  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function useNow(): Date {
  return useSyncExternalStore(
    subscribeClock,
    () => now,
    () => now,
  );
}

// Toasts: short confirmations such as "Handed in" or "Reward requested".

export interface Toast {
  id: number;
  message: string;
  tone: "default" | "success";
}

let toasts: Toast[] = [];
const toastListeners = new Set<() => void>();
let nextId = 1;

function emitToasts() {
  toastListeners.forEach((l) => l());
}

export function toast(message: string, tone: Toast["tone"] = "default") {
  const id = nextId++;
  toasts = [...toasts, { id, message, tone }];
  emitToasts();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emitToasts();
  }, 3200);
}

const EMPTY: Toast[] = [];

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (l) => {
      toastListeners.add(l);
      return () => toastListeners.delete(l);
    },
    () => toasts,
    () => EMPTY,
  );
}
