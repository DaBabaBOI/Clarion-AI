"use client";

import { useEffect, useState } from "react";
import type { Item } from "@/lib/game/items";
import { itemIcon } from "@/lib/game/pixels";
import type { HeroStats } from "@/lib/game/rules";
import { sfx } from "@/lib/game/sfx";
import { heroSprite } from "@/lib/game/sprites";
import { actions } from "@/lib/store";
import { GameDialog, PixelButton } from "./game-ui";
import { PixelArt } from "./pixel-art";

function Reveal({ item, stats, onClose }: { item: Item; stats: HeroStats; onClose: () => void }) {
  const line = `You got the ${item.name}!`;
  const [typed, setTyped] = useState(0);

  useEffect(() => {
    sfx.fanfare();
  }, []);
  useEffect(() => {
    if (typed >= line.length) return;
    const t = setTimeout(() => setTyped((n) => n + 1), 35);
    return () => clearTimeout(t);
  }, [typed, line.length]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative grid h-[210px] w-full place-items-end overflow-hidden bg-[#203a2a]">
        {/* Rays of light behind the item. */}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className="absolute top-[18%] left-1/2 h-[3px] w-[44%] origin-left bg-game-gold/40 motion-safe:animate-[game-twinkle_1s_steps(2)_infinite]"
            style={{ transform: `rotate(${i * 60 + 15}deg)`, animationDelay: `${i * 0.15}s` }}
            aria-hidden="true"
          />
        ))}
        <div className="absolute inset-x-0 bottom-0 h-7 bg-[#4c9631]" />
        <div className="relative mx-auto flex flex-col items-center">
          <div className="motion-safe:animate-[game-rise_0.5s_steps(5)]">
            <PixelArt grid={itemIcon(item)} scale={4} title={item.name} />
          </div>
          <PixelArt grid={heroSprite(stats.items)} scale={4} />
        </div>
      </div>
      <div className="pixel-inset w-full px-4 py-3">
        <p className="font-pixel text-[11px] leading-5 text-game-gold" aria-live="polite">
          {line.slice(0, typed)}
          {typed < line.length && <span className="motion-safe:animate-[game-blink_0.4s_steps(1)_infinite]">_</span>}
        </p>
        <p className="mt-2 text-[16px] leading-6">{item.buffs[0]}</p>
      </div>
      <div className="flex w-full justify-end gap-3">
        <PixelButton tone="stone" onClick={onClose}>
          Later
        </PixelButton>
        <PixelButton
          tone="green"
          onClick={() => {
            sfx.equip();
            actions.equipItem(item.key);
            onClose();
          }}
        >
          Equip now
        </PixelButton>
      </div>
    </div>
  );
}

/** "You got the Shortsword!" The hero holds the new item up, Zelda style. */
export function ItemGet({ item, stats, onClose }: { item: Item | null; stats: HeroStats; onClose: () => void }) {
  return (
    <GameDialog open={item !== null} onClose={onClose} label={item ? `You got the ${item.name}!` : "New item"} width={420}>
      {item && <Reveal item={item} stats={stats} onClose={onClose} />}
    </GameDialog>
  );
}
