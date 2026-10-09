<script lang="ts">
  import { LETTERS, WORD, measureTracks } from '../lib/wordmark';

  /*
   * Two flags, because the wordmark plays and then leaves.
   *
   * `revealed` turns it on once the loader has cleared. `dismissed` turns it off
   * again when the visitor scrolls or clicks, so it animates out to give way to
   * the homepage.
   */
  let {
    revealed = false,
    dismissed = false,
    onexit,
  }: { revealed?: boolean; dismissed?: boolean; onexit?: () => void } = $props();

  /* Seconds the exit takes, reported back so the parent can time what follows. */
  const EXIT_DURATION = 0.6;

  /*
   * Seconds each letter waits before it starts moving, in reading order, and how
   * long one letter takes to settle.
   */
  const LETTER_STAGGER = 0.06;
  const LETTER_DURATION = 0.55;

  /*
   * The resolve fires after the wordmark line has finished its own reveal, so the
   * two stages read as sequential rather than as one muddy overlap.
   */
  const RESOLVE_AFTER = 0.95;

  let resolved = $state(false);
  let track = $state<Record<number, number>>({});
  let measured = $state(false);

  let measureHost: HTMLSpanElement | undefined = $state();

  $effect(() => {
    if (!revealed) return;

    const timer = setTimeout(() => {
      resolved = true;
    }, RESOLVE_AFTER * 1000);

    return () => clearTimeout(timer);
  });

  /*
   * The exit is timed here rather than left to the parent to guess, so the two
   * cannot disagree about how long the wordmark takes to leave.
   */
  $effect(() => {
    if (!dismissed) return;

    const timer = setTimeout(() => {
      onexit?.();
    }, EXIT_DURATION * 1000);

    return () => clearTimeout(timer);
  });

  /*
   * The added letters animate their width open rather than being offset with a
   * transform, because it is the width taking up space that pushes the existing
   * letters along. Their natural width is not knowable in CSS, so it is measured
   * once from an off-screen copy of the word rendered at full width.
   *
   * This has to wait on fonts.ready: measuring before Big Shoulders Text has
   * loaded would capture the fallback metrics and every letter would open to the
   * wrong size.
   */
  $effect(() => {
    const host = measureHost;
    if (!host || measured) return;

    let cancelled = false;

    document.fonts.ready.then(() => {
      if (cancelled) return;

      track = measureTracks(host);
      measured = true;
    });

    return () => {
      cancelled = true;
    };
  });
</script>

<div
  class="landing"
  class:landing--revealed={revealed}
  class:landing--resolved={resolved}
  class:landing--out={dismissed}
  style="
    --letter-duration: {LETTER_DURATION}s;
    --letter-stagger: {LETTER_STAGGER}s;
    --exit-duration: {EXIT_DURATION}s;
  "
>
  <span class="nmmd" aria-label={WORD}>
    {#each LETTERS as letter, i (i)}
      <span
        class="letter"
        class:letter--added={letter.added}
        class:letter--measured={measured}
        style="--i: {i}; --track: {track[i] ?? 0}px"
        aria-hidden="true"
      >
        {letter.char}
      </span>
    {/each}
  </span>
  <span class="studio" aria-hidden="true">STUDIO</span>

  <!--
    Off-screen copy of the word at full width, used only to read letter widths.
    visibility:hidden keeps it out of the accessibility tree and off the paint,
    but it still lays out, which is what the measurement needs.
  -->
  <span class="measure" aria-hidden="true" bind:this={measureHost}>
    <span class="measure__word">
      {#each LETTERS as letter, i (i)}
        <span class="measure__letter" data-measure={i}>{letter.char}</span>
      {/each}
    </span>
  </span>
</div>

<style>
  .landing {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    /*
     * Laid out on top of the homepage rather than above it in flow.
     *
     * Fixed to the viewport rather than absolutely placed in the page: the
     * page is a scroll runway (the stages are the scroll position in
     * Blocks.svelte), so an absolute hero would ride up with the first scroll
     * instead of standing still while it fades. Fixed, the wordmark dissolves
     * where it is and the scrolling stage beneath takes over.
     *
     * The hero used to occupy its own full-viewport height and the blocks sat
     * below it, which left the blocks off the bottom of the screen while the
     * hero was still up. Overlaying them means both are in the same place and
     * the hero simply fades off the top of them.
     */
    position: fixed;
    inset: 0;
    z-index: 10;

    /* The exit needs a transition to run against. */
    transition: opacity var(--exit-duration) ease-in;

    /*
     * The two lines are stacked tighter than they were.
     *
     * `gap` cannot take a negative length — the property only accepts
     * non-negative values and a negative one is dropped as invalid — so the flex
     * gap above is zeroed and the overlap is carried by `.studio`'s margin
     * instead.
     *
     * How far apart the ink actually ends up is not the margin. Both words use
     * line-heights below 1, so each box is shorter than the type it holds, and
     * measured across the 96px design size the ink sits 15px inside the boxes:
     * a box gap of 0 draws the ink 15px apart. So the margin has to be read
     * against that, and it bottoms out at about -10px before the ink itself
     * starts to touch — at -20px the two runs merge into one and STUDIO cuts
     * through the middle of NAMMADE.
     *
     * -0.625rem is 22px tighter than the 12px this was before, which is where
     * the design's tightening lands before the ink collides.
     */
    gap: 0;
    width: 100%;
    min-height: 100vh;
    text-align: center;
  }

  .nmmd,
  .studio {
    display: block;
    font-family: var(--font-display);
    font-weight: 400;
    color: var(--color-neutral-100);

    /*
     * Both words start hidden and rise into place. `revealed` is applied on the
     * container so the two can be staggered off a single state change.
     */
    opacity: 0;
    transform: translateY(0.4em);
    transition:
      opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1),
      transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
  }

  /*
   * The NMMD line is the one that resolves into NAMMADE, so its own reveal
   * finishes first and the letter sequence gets the stage to itself.
   *
   * The clamp is bounded by the WIDTH the word needs, not just the height it
   * would like: 13vw grew the wordmark to 119px on a 2560px display (the
   * `6rem` ceiling never bound) while "NAMMADE" at that size measures over
   * 700px and spills past a narrow phone's column at the small end. The band
   * is now 3.5rem–5.5rem with 11vw between, which measures ~372px at its
   * largest and ~137px at its smallest — inside the narrowest column at every
   * size, and never outgrowing the hero.
   */
  .nmmd {
    font-family: var(--font-stacked);
    font-size: clamp(3.5rem, 11vw, 5.5rem);
    font-weight: 200;
    line-height: 0.9;
    letter-spacing: -0.07em;
  }

  /*
   * Letters sit in normal flow rather than being absolutely positioned, so the
   * width an added letter occupies is what pushes its neighbours along. That is
   * what produces the slide: the existing letters are not animated at all, they
   * move because the word grows around them.
   *
   * inline-block is required for width to apply; a non-replaced inline element
   * ignores it.
   */
  .letter {
    display: inline-block;
    white-space: pre;
  }

  /*
   * Before measurement there is no width to animate to, so added letters are
   * simply hidden. Collapsing them to 0 width would already be widening them,
   * which would show the word mid-transition on first paint.
   */
  .landing:not(.landing--resolved) .letter:not(.letter--measured) {
    display: none;
  }

  /*
   * Added letters start transparent and zero-width, then fade and open together.
   * Opening the width rather than translating is deliberate: a transform would
   * not displace the letters that follow, so the word would grow by overlap
   * instead of by the letters actually moving across.
   */
  .landing:not(.landing--resolved) .letter--added.letter--measured {
    opacity: 0;
    width: 0;
  }

  /*
   * The sequence is driven off one class on the container, and each letter waits
   * its turn via --i so the word assembles left to right. The delay is only
   * applied once resolved, otherwise every letter would sit on a delay before
   * the animation had even started.
   */
  .landing--resolved .letter {
    transition:
      opacity var(--letter-duration) cubic-bezier(0.16, 1, 0.3, 1),
      width var(--letter-duration) cubic-bezier(0.16, 1, 0.3, 1);
    /* --i staggers the letters in reading order. */
    transition-delay: calc(var(--i) * var(--letter-stagger));
  }

  /*
   * Off-screen copy used only to read natural letter widths.
   *
   * It has to carry the same typography as .nmmd, since a width measured from a
   * different font or size is not the width the real letter will occupy.
   */
  .measure {
    position: absolute;
    top: 0;
    left: 0;
    visibility: hidden;
    pointer-events: none;
  }

  .measure__word {
    display: block;
    font-family: var(--font-stacked);
    font-size: clamp(3.5rem, 11vw, 5.5rem);
    font-weight: 200;
    line-height: 0.9;
    letter-spacing: -0.07em;
    white-space: nowrap;
  }

  .measure__letter {
    display: inline-block;
  }

  .studio {
    font-family: var(--font-studio);
    /*
     * The tightening, carried as a margin because the flex gap cannot go
     * negative. The negative top edge pulls the line up into the one above it;
     * the pair is centred as a group, so pulling one up also nudges the other
     * down by half as much and the whole stack settles on its own centre.
     */
    margin-top: -0.625rem;

    /*
     * The vw term has to reach 2.8125rem by about an 87.5rem viewport, otherwise
     * the clamp resolves below the target size on common desktop widths and the
     * measured size comes out short.
     */
    font-size: clamp(1.25rem, 3.2vw, 2.8125rem);
    font-weight: 700;
    line-height: 1;
    letter-spacing: -0.05em;
  }

  /*
   * The wordmark line reveals first, then holds while it resolves into NAMMADE.
   */
  .landing--revealed .nmmd {
    opacity: 1;
    transform: none;
    transition-delay: 0.15s;
  }

  .landing--revealed .studio {
    opacity: 1;
    transform: none;
    transition-delay: 0.3s;
  }

  /*
   * The resolve itself is withheld until NMMD has finished arriving (see
   * RESOLVE_AFTER), so the letters begin staggered from zero rather than from a
   * second delay stacked on top of that timer.
   */
  .landing--resolved .letter {
    opacity: 1;
    width: var(--track);
  }

  /*
   * The exit.
   *
   * The hero fades in place. It is deliberately not moved: the wordmark is
   * meant to dissolve where it stands rather than travel, and translating it
   * upward read as the page scrolling under a still-visible heading.
   */
  .landing--out {
    opacity: 0;
    transform: none;
    transition: opacity var(--exit-duration) ease-in;

    /*
     * Released once invisible.
     *
     * The hero is an overlay, so it does not push the blocks down, but it would
     * still sit on top of them and swallow their clicks. Taking it out of the way
     * stops it becoming an invisible wall over the homepage.
     */
    pointer-events: none;
  }

  /*
   * Reduced motion shows the finished wordmark outright: no reveal, no
   * letter-by-letter sequence. The added letters are always at full width here,
   * because the sequence is what would otherwise be hiding them.
   */
  @media (prefers-reduced-motion: reduce) {
    .nmmd,
    .studio {
      opacity: 1;
      transform: none;
      transition: none;
    }

    .landing:not(.landing--resolved) .letter:not(.letter--measured) {
      display: none;
    }

    .landing:not(.landing--resolved) .letter--added.letter--measured {
      opacity: 1;
      width: var(--track);
    }

    .landing--resolved .letter {
      opacity: 1;
      width: var(--track);
      transition: none;
    }

    /* Fades and collapses only: the drift and scale are the motion removed. */
    .landing--out {
      transform: none;
      transition: opacity 0.2s linear;
    }
  }
</style>
