"use client";

import { useState } from "react";
import { toast } from "@/lib/client-hooks";
import { actions } from "@/lib/store";
import type { Deck } from "@/lib/types";
import { Button, Chip, Modal, ProgressBar, cx } from "../ui";

const DECK_SWATCH = [
  "border-sky bg-sky-soft",
  "border-mint bg-mint-soft",
  "border-muted bg-canvas",
];

function deckStatus(deck: Deck) {
  if (deck.reviewed === 0) return <Chip tone="neutral" size="sm" className="text-[11px]">Not started</Chip>;
  if (deck.reviewed >= deck.cards.length)
    return (
      <Chip tone="mint" size="sm" className="text-[11px]">
        All reviewed
      </Chip>
    );
  return (
    <Chip tone="sky" size="sm" className="text-[11px]">
      {deck.reviewed} of {deck.cards.length} reviewed
    </Chip>
  );
}

/** Flip card: front shows the question, a tap shows the answer. */
export function FlipCard({ front, back }: { front: string; back: string }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setFlipped((v) => !v)}
      aria-label={flipped ? `Answer: ${back}. Tap to see the question.` : `Question: ${front}. Tap to flip.`}
      className="flex min-h-[128px] w-full flex-col items-center justify-center gap-2.5 rounded-[14px] bg-brand-soft px-[18px] py-5 text-center transition hover:brightness-[0.99]"
    >
      <span className="text-[10px] font-bold tracking-wide text-brand">{flipped ? "BACK" : "FRONT"}</span>
      <span className="max-w-[270px] text-[15.5px] font-semibold leading-[22px] text-ink">{flipped ? back : front}</span>
      <span className="text-[11px] text-faint">{flipped ? "Tap to see the question" : "Tap to flip"}</span>
    </button>
  );
}

export function FlashcardsCard({ decks, onGenerate }: { decks: Deck[]; onGenerate: () => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const selected =
    decks.find((d) => d.id === selectedId) ?? decks.find((d) => d.reviewed < d.cards.length) ?? decks[0] ?? null;
  const preview = selected ? selected.cards[selected.reviewed % selected.cards.length] : null;

  return (
    <section className="flex flex-col gap-3.5 rounded-card border border-line bg-white px-5 py-[18px]">
      <div className="flex items-center gap-2.5">
        <h2 className="text-[16.5px] font-bold">Flashcards</h2>
        <span className="flex-1" />
        <Chip tone="neutral">
          {decks.length} deck{decks.length === 1 ? "" : "s"}
        </Chip>
      </div>
      {!selected || !preview ? (
        <div className="rounded-[14px] bg-canvas px-5 py-6 text-center">
          <p className="text-[13.5px] font-semibold">No decks yet</p>
          <p className="mt-1 text-[12.5px] text-muted">Clarion can build one from your notes.</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={onGenerate}>
            Generate a deck
          </Button>
        </div>
      ) : (
        <>
          <FlipCard key={preview.id} front={preview.front} back={preview.back} />
          <ul className="flex flex-col" aria-label="Decks">
            {decks.map((d, i) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(d.id)}
                  aria-pressed={d.id === selected.id}
                  className={cx(
                    "flex w-full items-center gap-3 rounded-[12px] px-2 py-2.5 text-left transition",
                    d.id === selected.id ? "bg-canvas" : "hover:bg-canvas/60",
                  )}
                >
                  <span className={cx("size-[30px] shrink-0 rounded-[8px] border", DECK_SWATCH[i % DECK_SWATCH.length])} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-semibold text-ink">{d.title}</span>
                    <span className="block text-[11.5px] text-faint">{d.cards.length} cards</span>
                  </span>
                  {deckStatus(d)}
                </button>
              </li>
            ))}
          </ul>
          <Button
            full
            onClick={() => {
              // Finished decks start over so "Review again" has cards to show.
              if (selected.reviewed >= selected.cards.length) actions.restartDeck(selected.id);
              setReviewing(true);
            }}
          >
            {selected.reviewed >= selected.cards.length ? `Review ${selected.title} again` : `Start review`}
          </Button>
        </>
      )}
      {selected && <ReviewModal deck={selected} open={reviewing} onClose={() => setReviewing(false)} />}
    </section>
  );
}

function ReviewModal({ deck, open, onClose }: { deck: Deck; open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title={`Review: ${deck.title}`} description="Flip each card, then say how it went.">
      {open && <ReviewSession deck={deck} onClose={onClose} />}
    </Modal>
  );
}

function ReviewSession({ deck, onClose }: { deck: Deck; onClose: () => void }) {
  const [index, setIndex] = useState(() => deck.reviewed % deck.cards.length);
  const [again, setAgain] = useState(0);
  const card = deck.cards[index];

  if (!card) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <p className="text-[15px] font-semibold">Deck finished</p>
        <p className="text-[13px] text-muted">
          {again === 0 ? "You knew every card. Nice work." : `${again} card${again === 1 ? "" : "s"} to look at again next time.`}
        </p>
        <Button onClick={onClose}>Done</Button>
      </div>
    );
  }

  const next = (knew: boolean) => {
    actions.reviewCard(deck.id, card.id, knew);
    if (!knew) setAgain((n) => n + 1);
    if (index + 1 >= deck.cards.length) toast(`${deck.title} reviewed`, "success");
    setIndex((i) => i + 1);
  };

  return (
    <div className="flex flex-col gap-4">
      <ProgressBar value={index} max={deck.cards.length} tone="brand" label="Cards reviewed" />
      <p className="text-[12px] text-muted">
        Card {index + 1} of {deck.cards.length}
      </p>
      <FlipCard key={card.id} front={card.front} back={card.back} />
      <div className="grid grid-cols-2 gap-2.5">
        <Button variant="secondary" onClick={() => next(false)}>
          Again
        </Button>
        <Button onClick={() => next(true)}>Got it</Button>
      </div>
    </div>
  );
}
