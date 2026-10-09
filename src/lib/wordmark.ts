/*
 * The NMMD -> NAMMADE wordmark, shared by the landing screen and the navbar logo.
 *
 * The name resolves by inserting three letters into the four it already has:
 * NAMMADE with the A, A and E taken out leaves N M M D, so those three sit at
 * positions 1, 4 and 6.
 *
 * Which target positions were already occupied is listed explicitly rather than
 * inferred from the characters. The two words share every character, so a
 * set-membership test cannot tell an inserted A from one that was always there;
 * it has to be positional.
 */
export const WORD = 'NAMMADE';

/** Positions in WORD that already held a letter in NMMD. */
export const EXISTING: ReadonlySet<number> = new Set([0, 2, 3, 5]);

export interface Glyph {
  char: string;
  /** True for a letter the resolve inserts, so it animates open from nothing. */
  added: boolean;
}

export const LETTERS: readonly Glyph[] = WORD.split('').map((char, i) => ({
  char,
  added: !EXISTING.has(i),
}));

/** Narrowest track an added letter may open from, as a floor. */
export const MIN_TRACK = 1;

/**
 * Read each letter's natural width from an off-screen copy of the word.
 *
 * A letter's natural width is not knowable in CSS, so it is measured from a
 * hidden copy rendered at full size. The host is expected to hold one child per
 * letter carrying `data-measure` with that letter's index.
 *
 * Callers must wait on `document.fonts.ready` before calling: measuring before
 * the webfont loads captures the fallback metrics, and every letter would open
 * to the wrong size.
 */
export function measureTracks(host: HTMLElement): Record<number, number> {
  const widths: Record<number, number> = {};

  for (const el of host.querySelectorAll<HTMLElement>('[data-measure]')) {
    const index = Number(el.dataset.measure);
    widths[index] = Math.max(el.getBoundingClientRect().width, MIN_TRACK);
  }

  return widths;
}
