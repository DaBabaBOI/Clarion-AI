"use client";

import { useEffect, useMemo, useRef } from "react";
import { diceLabel } from "@/lib/game/items";
import { REGIONS, monsterByKey, type Monster, type Region } from "@/lib/game/monsters";
import { heroSprite, monsterSprite } from "@/lib/game/sprites";
import { sfx } from "@/lib/game/sfx";
import { MAP_H, MAP_W, paintWorld, regionPoint } from "@/lib/game/world";
import type { HeroStats } from "@/lib/game/rules";
import { cx } from "../ui";
import { GameIcon, GamePanel, PixelButton } from "./game-ui";
import { PixelArt } from "./pixel-art";

function MapCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const world = paintWorld();
    world.forEach((row, y) =>
      row.forEach((c, x) => {
        ctx.fillStyle = c;
        ctx.fillRect(x, y, 1, 1);
      }),
    );
  }, []);
  return <canvas ref={ref} width={MAP_W} height={MAP_H} className="block h-full w-full [image-rendering:pixelated]" aria-hidden="true" />;
}

/** The overworld: pick a region, then a monster to fight. */
export function WorldMap({
  level,
  hero,
  selected,
  onSelect,
  onFight,
  scrolls,
  wins,
}: {
  level: number;
  hero: HeroStats;
  selected: Region;
  onSelect: (region: Region) => void;
  onFight: (monster: Monster) => void;
  scrolls: number;
  wins: Record<string, number>;
}) {
  // The hero stands at the furthest region they can reach.
  const furthest = [...REGIONS].reverse().find((r) => level >= r.level) ?? REGIONS[0];
  const heroAt = regionPoint(furthest.key);
  const heroHead = useMemo(() => heroSprite(hero.items).slice(4, 32), [hero.items]);
  const locked = level < selected.level;

  return (
    <GamePanel
      title="The realm"
      right={<span className="text-[13px] text-game-muted">Win battles to earn titles. Each battle costs one quest scroll.</span>}
      className="order-1 min-w-0 flex-1 lg:order-none"
    >
      <div className="pixel-inset relative w-full p-1" style={{ aspectRatio: `${MAP_W} / ${MAP_H}` }}>
        <MapCanvas />
        {REGIONS.map((r) => {
          const p = regionPoint(r.key);
          const open = level >= r.level;
          const isSelected = r.key === selected.key;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => {
                sfx.select();
                onSelect(r);
              }}
              aria-pressed={isSelected}
              aria-label={`${r.name}${open ? "" : `, opens at level ${r.level}`}`}
              className="group absolute flex -translate-x-1/2 -translate-y-full flex-col items-center"
              style={{ left: `${(p.x / MAP_W) * 100}%`, top: `${(p.y / MAP_H) * 100}%` }}
            >
              <span
                className={cx(
                  "pixel-panel mb-1 hidden px-1.5 py-1 font-pixel text-[7px] leading-3 whitespace-nowrap md:inline-block",
                  isSelected ? "text-game-gold" : open ? "text-game-ink" : "text-game-muted",
                )}
              >
                {open ? r.name : `Lv ${r.level}`}
              </span>
              <span className="relative flex items-center">
                {open ? <GameIcon kind="star" scale={3} /> : <GameIcon kind="lock" scale={3} />}
                {isSelected && (
                  <span className="absolute -left-3 font-pixel text-[9px] text-game-gold motion-safe:animate-[game-blink_0.8s_steps(1)_infinite]">▶</span>
                )}
              </span>
            </button>
          );
        })}
        <div
          className="pointer-events-none absolute -translate-y-[85%] motion-safe:animate-[game-bob_0.9s_steps(2)_infinite]"
          style={{ left: `${(heroAt.x / MAP_W) * 100 + 5.5}%`, top: `${(heroAt.y / MAP_H) * 100}%` }}
        >
          <PixelArt grid={heroHead} scale={1.6} title="You are here" />
        </div>
      </div>

      {/* On small screens the map is too small for labels: pick a region here. */}
      <div className="flex flex-wrap gap-1.5 md:hidden" role="group" aria-label="Regions">
        {REGIONS.map((r) => (
          <button
            key={r.key}
            type="button"
            aria-pressed={r.key === selected.key}
            onClick={() => {
              sfx.select();
              onSelect(r);
            }}
            className={cx(
              "px-2 py-1.5 font-pixel text-[7px] leading-3",
              r.key === selected.key ? "bg-game-gold text-[#2b1a00]" : level >= r.level ? "bg-game-panel-2 text-game-ink" : "bg-game-panel-2 text-game-muted",
            )}
          >
            {level >= r.level ? r.name : `${r.name} · Lv ${r.level}`}
          </button>
        ))}
      </div>

      <div className="pixel-inset flex flex-col gap-3 p-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="font-pixel text-[11px] text-game-gold">{selected.name}</h3>
          <span className="text-[14px] text-game-muted">{locked ? `Opens at level ${selected.level}` : selected.blurb}</span>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {selected.monsters.map((key) => {
            const m = monsterByKey(key)!;
            const won = wins[key] ?? 0;
            return (
              <li key={key} className="pixel-panel flex items-center gap-3 p-2.5">
                <div className={cx("grid size-[72px] shrink-0 place-items-center", locked && "brightness-0 opacity-40")}>
                  <PixelArt grid={monsterSprite(m.sprite, m.palette)} scale={m.sprite === "dragon" ? 2.2 : 3} title={locked ? "Unknown monster" : m.name} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-pixel text-[9px] leading-4">{locked ? "???" : m.name}</p>
                  {!locked && (
                    <>
                      <p className="mt-1 text-[13px] leading-4 text-game-muted">
                        HP {m.hp} · AC {m.ac} · {diceLabel(m.damage)}
                        {m.damageBonus ? `+${m.damageBonus}` : ""} {m.damage.type}
                      </p>
                      <p className="text-[13px] leading-4 text-game-muted">{m.traits.join(" · ")}</p>
                      {won > 0 && <p className="mt-0.5 text-[13px] leading-4 text-game-good">Defeated ×{won}</p>}
                    </>
                  )}
                </div>
                <PixelButton
                  size="sm"
                  tone="red"
                  disabled={locked || scrolls <= 0}
                  onClick={() => onFight(m)}
                  title={locked ? `Reach level ${selected.level}` : scrolls <= 0 ? "No quest scrolls left" : `Fight the ${m.name}`}
                  aria-label={`Fight the ${m.name}`}
                >
                  Fight
                </PixelButton>
              </li>
            );
          })}
        </ul>
        {scrolls <= 0 && !locked && (
          <p className="text-[14px] leading-5 text-game-bad">
            No quest scrolls left. Hand in homework before its due date to earn one for each piece.
          </p>
        )}
      </div>
    </GamePanel>
  );
}

