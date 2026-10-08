<script lang="ts">
  import { onDestroy } from 'svelte'

  const TEXT = 'welcome'

  const LETTERS = TEXT.split('')

  /* Seconds for one full out-and-back cycle. */
  const DURATION = 4.8

  /*
   * Distance between one clone and the next, in rem. Clones are offset by
   * multiples of this: depth 1 travels STEP, depth 2 travels 2 * STEP, and so
   * on.
   *
   * This is measured between the clones, independent of the line box. The glyphs
   * of the word occupy roughly 7rem of ink at this size, so a small step keeps
   * every clone reading as part of one overlapping mass rather than as
   * separate lines of text.
   */
  const STEP = 0.75

  /*
   * One clone anchors the centre. The rest fan out in two groups of three, each
   * travelling a different distance so they never collide mid-swing.
   *
   * They are staggered by AMPLITUDE, not by phase. A phase offset would keep
   * the clones permanently out of step, so they would cross the centre one at a
   * time and never share a rest moment. Amplitude keeps all seven in step
   * (identical timing, scaled displacement) while still separating them while
   * they move.
   */
  const CLONES = [
    { depth: 0, dir: 'center' as const },
    { depth: 1, dir: 'up' as const },
    { depth: 2, dir: 'up' as const },
    { depth: 3, dir: 'up' as const },
    { depth: 1, dir: 'down' as const },
    { depth: 2, dir: 'down' as const },
    { depth: 3, dir: 'down' as const },
  ]

  /* Letter cascade timing. */
  const LETTER_DURATION = 0.7
  const LETTER_STAGGER = 0.07

  /*
   * How long the letter cascade takes to finish: one duration for the first
   * letter plus a stagger for each of the remaining letters.
   */
  const INTRO = LETTER_DURATION + LETTER_STAGGER * (LETTERS.length - 1)

  /*
   * The six moving clones fade in one at a time once the word is complete,
   * so each gets its own delay on top of the intro. They land on the rest
   * position (the drift keyframes hold at 0 for the first 15% of the cycle),
   * so the stack settles in before anything moves.
   */
  const MOVER_STAGGER = 0.06
  const REVEAL_DURATION = 0.4

  /*
   * The drift runs a single cycle, then the screen is done.
   *
   * Finite rather than infinite, so it lands on the rest keyframe and stops
   * instead of looping while it fades. The animation is the whole point of the
   * loading screen and is not skippable: the landing page waits for it to finish
   * rather than cutting in on an input.
   */
  const CYCLES = 1

  /*
   * Each mover is delayed one stagger step after the one before it, so the last
   * clone starts drifting LAST_MOVER_DELAY seconds after the first. The cycle
   * count has to be measured from that last start for every clone to have
   * finished, which is what makes the group come to rest together.
   */
  const LAST_MOVER_DELAY = MOVER_STAGGER * (CLONES.length - 1)

  /*
   * Total run time before dismissal: the intro, the staggered reveals, and CYCLES
   * full drift cycles measured from the last clone to start.
   */
  const DISMISS_AFTER = INTRO + LAST_MOVER_DELAY + DURATION * CYCLES + REVEAL_DURATION

  /* Seconds the loader takes to fade once dismissal starts. */
  const FADE = 0.5

  /* Called once the fade-out has finished, so the parent can reveal its content. */
  let { oncomplete }: { oncomplete?: () => void } = $props()

  let dismissed = $state(false)

  const timers: ReturnType<typeof setTimeout>[] = [
    /* Fade out once the single cycle has played out. */
    setTimeout(() => {
      dismissed = true
    }, DISMISS_AFTER * 1000),

    /* Hand over only after the fade, so the two words never overlap. */
    setTimeout(() => {
      oncomplete?.()
    }, (DISMISS_AFTER + FADE) * 1000),
  ]

  onDestroy(() => timers.forEach(clearTimeout))
</script>

<div
  class="loader"
  class:loader--out={dismissed}
  style="--fade: {FADE}s"
  role="img"
  aria-label={TEXT}
  aria-hidden={dismissed}
>
  {#each CLONES as clone, i (i)}
    <span
      class="clone"
      class:clone--center={clone.dir === 'center'}
      class:clone--up={clone.dir === 'up'}
      class:clone--down={clone.dir === 'down'}
      style="
        --travel: {(clone.dir === 'up' ? -1 : 1) * clone.depth * STEP}rem;
        --duration: {DURATION}s;
        --delay: {INTRO + i * MOVER_STAGGER}s;
        --reveal: {REVEAL_DURATION}s;
        --cycles: {CYCLES};
        --letter-duration: {LETTER_DURATION}s;
        --letter-stagger: {LETTER_STAGGER}s;
      "
      aria-hidden="true"
      >{#if clone.dir === 'center'}{#each LETTERS as letter, n (n)}<span
          class="letter-mask"
          style="--letter-delay: {n * LETTER_STAGGER}s"
        ><span class="letter">{letter}</span></span
        >{/each}{:else}{TEXT}{/if}</span
    >
  {/each}
</div>

<style>
  /*
   * The loader covers the viewport and is taken out of flow, so it overlays the
   * landing page instead of stacking above it. Left in flow it would contribute
   * its own 100vh to the document height and push the landing page below the
   * fold, where it renders but is never seen.
   */
  .loader {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    overflow: hidden;

    opacity: 1;
    transition: opacity var(--fade) ease-in;
  }

  .loader--out {
    opacity: 0;
    pointer-events: none;
  }

  .clone {
    grid-area: 1 / 1;
    font-family: var(--font-display);
    font-size: clamp(3rem, 14vw, 5.625rem);
    font-weight: 400;
    font-stretch: 75%;
    line-height: 1;
    letter-spacing: -0.02em;
    color: var(--color-neutral-100);
    white-space: nowrap;
  }

  /*
   * Letter cascade on the centre clone.
   *
   * The mask clips each glyph to its own box; the inner letter rises from below
   * it, so each one wipes upward into place. The padding/negative-margin pair
   * gives the clip box room for ascender tips without changing the footprint of
   * the layout, and the right-side padding stops the mask cutting into round
   * terminals (the c, e, o) horizontally.
   */
  .letter-mask {
    display: inline-block;
    overflow: hidden;
    vertical-align: bottom;
    /*
     * Padding grows the clip box; the matching negative margin cancels it back
     * out so the layout footprint is unchanged. The bottom padding matters most:
     * without slack below the baseline the clip edge lands exactly on the glyph
     * bottom and shaves the last row of pixels off settled letters.
     */
    padding: 0.16em 0.08em 0.1em;
    margin: -0.16em -0.08em -0.1em;
  }

  .letter {
    display: inline-block;
    /*
     * Fast-out, long-settle easing. A back-loaded ease-in (0.42, 0, 1, 1)
     * spends most of the duration barely moving and barely opaque, which
     * combined with the clip reads as faint disconnected slivers rather than
     * letters wiping in.
     */
    animation: letter-in var(--letter-duration) cubic-bezier(0.16, 1, 0.3, 1) both;
    animation-delay: var(--letter-delay);
  }

  @keyframes letter-in {
    from {
      opacity: 0.35;
      transform: translateY(100%);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /*
   * The six moving clones stay invisible through the letter cascade and fade in
   * one at a time afterwards. Two animations run on the same element but touch
   * different properties (opacity vs transform), so they do not conflict.
   *
   * `both` fill holds opacity at 0 during the delay and holds the rest position
   * before drift starts. Drift runs a finite number of cycles rather than
   * looping, so it settles on the rest keyframe and stays there while the
   * screen fades.
   *
   * Boomerang easing on drift: both y control points sit outside 0-1, so each leg
   * pulls back before launching and sails past its target before settling. The
   * final control point is 1.55 rather than a rounder 1.6: at 1.6 the clones
   * dwell long enough at each extreme to bunch up, which reads as a smudge.
   *
   * Percentages inside @keyframes are literal rather than var()-driven because
   * CSS variables are not valid in @keyframes selectors. The rest hold is 15% at
   * each end of the cycle.
   */
  .clone--up,
  .clone--down {
    opacity: 0;
    animation:
      drift var(--duration) cubic-bezier(0.68, -0.6, 0.32, 1.55) var(--delay) var(--cycles) both,
      reveal var(--reveal) ease-out var(--delay) both;
    will-change: transform, opacity;
  }

  @keyframes reveal {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes drift {
    0%,
    15% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(var(--travel));
    }
    85%,
    100% {
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .letter {
      animation: none;
    }

    .clone--up,
    .clone--down {
      opacity: 1;
      animation: none;
    }
  }
</style>
