<script lang="ts">
  /*
   * The homepage is a fixed column of frosted blocks that change size as the page
   * is scrolled.
   *
   * Sizes are described in one table. Every block reads its height for the
   * current step out of it, so a step is only ever written down once and the
   * three blocks cannot drift out of agreement with each other.
   */
  let { revealed = false }: { revealed?: boolean } = $props();

  const MAX_WIDTH = 1400;

  /*
   * Block heights per scroll step, in px.
   *
   * Step 0 is the first impression: one tall block over two thin strips. Step 1
   * moves height from block 1 into block 2. Step 2 flattens both of those and
   * hands the height to block 3. Step 3 gives the height back to block 1 and
   * hands the column over to the row of small blocks below.
   */
  const HEIGHTS = [
    [700, 50, 50],
    [200, 500, 50],
    [200, 200, 400],
    [400, 50, 50],
  ] as const;

  const BLOCK_GAP = 15;
  const SMALL_GAP = 20;

  /*
   * Gap between the stack and the small row, per step.
   *
   * The first three steps hold it wide at 50px to separate the two groups. The
   * final step closes it to 15px so all four rows sit on one rhythm, matching the
   * gaps between the three main blocks.
   */
  const SECTION_GAPS = [50, 50, 50, 15] as const;

  const SMALL_COUNT = 5;
  const SMALL_WIDTH = 250;

  /**
   * Height of the small row per scroll step.
   *
   * The last step squares them off at 250px to match their width, so the row
   * reads as a set of tiles rather than tabs.
   */
  const SMALL_HEIGHTS = [75, 75, 75, 250] as const;

  /**
   * Height the navbar occupies.
   *
   * The blocks column is pinned, and the navbar is sticky above it. Without
   * offsetting the pin by this much, the top of the column sat behind the navbar
   * and scrolled under the logo.
   */
  const NAV_HEIGHT = 98;

  /** Height of a step's stack: its blocks plus the gaps between them. */
  const stackHeightFor = (i: number) =>
    HEIGHTS[i].reduce((a, b) => a + b, 0) + BLOCK_GAP * (HEIGHTS[i].length - 1);

  /**
   * Height of the whole column at a given step: the stack, the section gap, and
   * the small row as it stands in that step.
   *
   * Per-step rather than one worst-case figure. Measuring only the tallest step
   * and scaling to that shrank every step by the worst case's proportions, so a
   * 400px block rendered at 275px and the 250px squares came out at 172px.
   */
  const columnHeightFor = (i: number) => stackHeightFor(i) + SECTION_GAPS[i] + SMALL_HEIGHTS[i];


  /*
   * Easing for the bubble-up entrance.
   *
   * The control points overshoot past 1, so each block decelerates into its seat
   * and briefly carries on past before settling back. That overshoot is what
   * separates a bubble from a slide.
   */
  const RISE_EASE = 'cubic-bezier(0.34, 1.4, 0.64, 1)';

  /*
   * How long a block takes to move between two heights, and the curve it follows.
   *
   * Both blocks in a step change at once and by different amounts: one may gain
   * 300px while its neighbour loses it. A single easing has to serve both without
   * either looking like it stopped and started.
   *
   * The curve is a long symmetric settle. Its midpoint is at 0.5 rather than the
   * usual front-loaded 0.25, so the two blocks are still moving at the same rate
   * halfway through and the hand-off of height between them stays even. The short
   * duration used before made the tall block visibly arrive before the short one
   * finished leaving, which read as a jump rather than a morph.
   */
  const MORPH_DURATION = 1.2;
  const MORPH_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
  /*
   * Milliseconds a gesture must settle before the next one counts.
   *
   * A wheel event arrives as a burst of deltas, not a single press, so without
   * this one flick of the wheel would advance several steps at once.
   *
   * Matches MORPH_DURATION: any shorter and the next step interrupts a morph that
   * is still running, which is the discontinuity this is meant to prevent.
   */
  const GESTURE_COOLDOWN = MORPH_DURATION * 1000;


  const BLOCKS = [
    { id: 'work', label: 'Selected work', body: 'Placeholder copy describing a project, its role, and the year it shipped.' },
    { id: 'studio', label: 'The studio', body: 'Placeholder copy about the practice, how it works, and who it works with.' },
    { id: 'contact', label: 'Get in touch', body: 'Placeholder copy for enquiries, with a place for an email or a form.' },
  ];

  const SMALL = Array.from({ length: SMALL_COUNT }, (_, i) => ({ id: `s${i}`, label: `Block ${i + 4}` }));

  /*
   * Which step the column is currently showing.
   *
   * Steps advance once each as the page scrolls past rather than tracking scroll
   * continuously, so a block holds its size until the next step instead of
   * resizing under the cursor.
   */
  let step = $state(0);

  /**
   * Tallest column across all steps.
   *
   * The sticky column is measured per step so each is centred in its own height,
   * but the runway has to be sized for the tallest one or the page runs out of
   * scroll while the last step is still on screen.
   */
  const TALLEST_COLUMN = Math.max(...HEIGHTS.map((_, i) => columnHeightFor(i)));

  /**
   * Scroll is read inside a rAF rather than in the handler itself, so a fast
   * scroll cannot queue more style writes than the browser will paint.
   */
  let locked = false;

  let timer: ReturnType<typeof setTimeout> | undefined;

  /*
   * Advance one step per gesture.
   *
   * The page no longer scrolls, so step position cannot come from scroll
   * geometry. Each settled gesture moves the column on by exactly one step,
   * forwards or back, and the transition does the rest.
   */
  const advance = (direction: 1 | -1) => {
    if (locked) return;

    const next = Math.min(Math.max(step + direction, 0), HEIGHTS.length - 1);

    if (next === step) return;

    step = next;
    lock();
  };

  /** Holds further gestures until this step's transition has been seen. */
  const lock = () => {
    locked = true;

    clearTimeout(timer);
    timer = setTimeout(() => {
      locked = false;
    }, GESTURE_COOLDOWN);
  };

  const onWheel = (event: WheelEvent) => {
    /* A trackpad fling fires many small deltas; only a real intent counts. */
    if (Math.abs(event.deltaY) < 4) return;

    advance(event.deltaY > 0 ? 1 : -1);
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight' || event.key === 'PageDown') {
      advance(1);
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft' || event.key === 'PageUp') {
      advance(-1);
    }
  };

  $effect(() => {
    /*
     * Only once the blocks are on screen. The landing page claims the first
     * gesture to dismiss itself, and these must not also step the blocks while
     * the hero is still up.
     */
    if (!revealed) return;

    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      clearTimeout(timer);
    };
  });

  /**
   * Below this height a block has no room for text, so it collapses to a plain
   * strip rather than clipping a line in half.
   *
   * The threshold sits above the strip height deliberately. A heading on its own
   * needs roughly 26px plus padding on both sides, which the 50px strips could not
   * carry, so they rendered with the text sliced off mid-glyph.
   */
  const SHORT_HEIGHT = 140;

  /** Short strips drop their copy and their padding, leaving a plain bar. */
  const isShort = (height: number) => height < SHORT_HEIGHT;

  /**
   * Set once all entrance animations have finished.
   *
   * While `false`, each block carries a staggered transition-delay so the
   * stack and row cascade in one at a time. Once the entrance has played out,
   * the delay is cleared so subsequent step morphs fire in unison instead of
   * rippling block by block (which is what made the small row look broken
   * when expanding and contracting).
   */
  let entered = $state(false);

  $effect(() => {
    if (!revealed) return;
    const timer = setTimeout(() => { entered = true; }, 1900);
    return () => clearTimeout(timer);
  });

  /**
   * Border-radius for the small blocks per step, in px.
   *
   * The strips are pills at exactly half their height (37.5px) rather than at a
   * huge value the browser would clamp into a pill. Either renders the same at
   * rest, but only the honest value interpolates: transitioning 10000 down to
   * 40 left the rendered radius riding the clamp at half the growing box, then
   * snapping from ~125px to 40px in the final frames of the expansion — the
   * visible jerk in the last step. A value that matches what is actually
   * painted lets the radius travel with the height for the whole morph.
   */
  const SMALL_RADII = [37.5, 37.5, 37.5, 40] as const;

  /* ── cursor-tracking glow ─────────────────────────────────────────────── */

  let sectionEl: HTMLElement | undefined = $state();
  let glowRafId: number | undefined;

  /**
   * On every mouse frame, compute the cursor's position relative to each
   * block and write it as `--mouse-x` / `--mouse-y` so the `::after` radial
   * gradient tracks the cursor. Throttled to one write per paint via rAF.
   */
  const onGlowMove = (event: MouseEvent) => {
    if (glowRafId !== undefined) return;
    glowRafId = requestAnimationFrame(() => {
      glowRafId = undefined;
      if (!sectionEl) return;
      for (const block of sectionEl.querySelectorAll<HTMLElement>('.block')) {
        const rect = block.getBoundingClientRect();
        block.style.setProperty('--mouse-x', `${event.clientX - rect.left}px`);
        block.style.setProperty('--mouse-y', `${event.clientY - rect.top}px`);
        block.style.setProperty('--glow-opacity', '1');
      }
    });
  };

  /** Fade the glow out when the cursor leaves the blocks section. */
  const onGlowLeave = () => {
    if (glowRafId !== undefined) {
      cancelAnimationFrame(glowRafId);
      glowRafId = undefined;
    }
    if (!sectionEl) return;
    for (const block of sectionEl.querySelectorAll<HTMLElement>('.block')) {
      block.style.setProperty('--glow-opacity', '0');
    }
  };
</script>

<section
  class="blocks"
  class:blocks--in={revealed}
  class:blocks--entered={entered}
  style="
    --max-width: {MAX_WIDTH}px;
    --block-gap: {BLOCK_GAP}px;
    --small-gap: {SMALL_GAP}px;
    --section-gap: {SECTION_GAPS[step]}px;
    --small-width: {SMALL_WIDTH}px;
    --small-height: {SMALL_HEIGHTS[step]}px;
    --small-radius: {SMALL_RADII[step]}px;
    --rise-ease: {RISE_EASE};
    --morph-duration: {MORPH_DURATION}s;
    --morph-ease: {MORPH_EASE};
    --step-count: {HEIGHTS.length};
    --stack-height: {stackHeightFor(step)}px;
    --column-height: {columnHeightFor(step)}px;
    --tallest-column: {TALLEST_COLUMN}px;
    --nav-height: {NAV_HEIGHT}px;
  "
  bind:this={sectionEl}
  onmousemove={onGlowMove}
  onmouseleave={onGlowLeave}
  aria-label="Selected work and contact"
>
  <div class="column">
    <div class="stack">
    {#each BLOCKS as block, i (block.id)}
      {@const height = HEIGHTS[step][i]}
      <article class="block" class:block--short={isShort(height)} style="--height: {height}px; --index: {i}">
        {#if !isShort(height)}
          <h2>{block.label}</h2>
          <p>{block.body}</p>
        {/if}
      </article>
      {/each}
    </div>

    <div class="row" class:row--expanded={step === HEIGHTS.length - 1}>
      {#each SMALL as block, i (block.id)}
        <article class="block block--small" style="--index: {i}">
          <h3>{block.label}</h3>
        </article>
      {/each}
    </div>
  </div>
</section>

<style>
  /*
   * Capped rather than a fixed 1400px so the column survives narrower
   * viewports. The blocks stay fluid and only their heights are stepped.
   */
  .blocks {
    width: 100%;
    max-width: var(--max-width);
    margin: 0 auto;
    padding: 0 1.5rem;

    /*
     * The viewport, minus the navbar's share.
     *
     * The steps are driven by gestures rather than scroll position, so the page
     * needs no runway. An earlier version reserved several screens of scroll to
     * advance the steps, which made the whole page scrollable for no reason.
     *
     * Sized so the column's centring maths is a single flex box with no top
     * margin to offset: centring is then plain `justify-content: center` and
     * cannot double-count its own start position.
     */
    display: flex;
    flex-direction: column;
    justify-content: center;

    min-height: calc(100vh - var(--nav-height));
  }

  /*
   * The column itself carries no positioning.
   *
   * Centring is the parent's job: the section is a flex box exactly the height of
   * the space below the navbar, so centring is one `justify-content` rather than a
   * sticky offset that had to know where it started.
   *
   * `flex-shrink: 0` stops it being squeezed when the viewport is too short for
   * the current step. The column is a fixed set of specified sizes, so shrinking
   * it would break the dimensions; the overflow is reached by the page not
   * scrolling rather than by scaling anything down.
   */
  .column {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    gap: var(--section-gap);
    transition: gap var(--morph-duration) var(--morph-ease);
  }

  .stack {
    display: flex;
    flex-direction: column;
    gap: var(--block-gap);

    /*
     * Sized to the current step, not to the tallest one.
     *
     * Reserving the tallest step's height here left the stack reserving 300px of
     * empty space at the final step, since only 530px of it was filled. That
     * pushed the small row below the fold and made the column 1130px tall when
     * its contents came to 830px.
     */
    height: var(--stack-height);
    transition: height var(--morph-duration) var(--morph-ease);
  }

  /*
   * Frosted glass.
   *
   * The blur samples whatever is behind the block, so the copy has to be a child
   * of the block rather than a layer above it, or the blur would wash the text
   * out along with the backdrop.
   */
  .block {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 0.5rem;

    /* Positioning context for the cursor-tracking glow on ::after. */
    position: relative;

    height: var(--height, auto);
    padding: 1.5rem;
    overflow: hidden;
    border: 1px solid rgb(255 255 255 / 0.1);
    border-radius: 0.75rem;
    background: rgb(255 255 255 / 0.05);
    backdrop-filter: blur(24px);

    /*
     * The bubble-up entrance.
     *
     * Blocks start well below their resting place and slightly small, then rise
     * and grow into position. The overshoot in the easing is what makes it read
     * as bubbling up rather than sliding: the block decelerates into its seat and
     * briefly carries past before settling back.
     *
     * will-change promotes transform and opacity to their own compositor layer
     * so the entrance animation runs off the main thread and stays jank-free.
     */
    opacity: 0;
    transform: translateY(5rem) scale(0.94);
    will-change: transform, opacity;
    transition:
      opacity 0.7s ease-out,
      transform 1s var(--rise-ease),
      height var(--morph-duration) var(--morph-ease),
      padding var(--morph-duration) var(--morph-ease),
      border-radius var(--morph-duration) var(--morph-ease);
  }

  .blocks--in .block {
    opacity: 1;
    transform: none;
  }

  /*
   * Cursor-tracking glow, confined to the border.
   *
   * A radial gradient centred on `--mouse-x` / `--mouse-y`, which are written
   * per block on every animation frame, masked down to a thin ring at the edge of
   * the block. The mask is the two-layer `exclude` trick: the first layer is the
   * content box and the second the padding box, so subtracting leaves only the
   * difference between them. Without it the gradient floods the whole surface,
   * which reads as a lit panel rather than a lit edge.
   *
   * The ring is inset by nothing, so it spans the block's padding box and the
   * mask subtracts the content box from it, leaving a band sitting immediately
   * inside the border. Pulling the pseudo-element out with a negative inset to
   * centre the band on the border pushed it a pixel past the border box, and the
   * glow read as a halo bleeding into the page behind rather than light on the
   * edge.
   *
   * `--mouse-x` defaults far off to the left, so with no cursor present the
   * gradient's transparent centre covers the block and nothing shows.
   */
  .block::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;

    border-radius: inherit;

    /* The width of the band the mask leaves, so the ring has something to leave. */
    padding: 2px;

    background: radial-gradient(
      360px circle at var(--mouse-x, -9999px) var(--mouse-y, -9999px),
      rgb(255 255 255 / 0.55),
      rgb(255 255 255 / 0.12) 55%,
      transparent 75%
    );

    -webkit-mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);
    mask:
      linear-gradient(#000 0 0) content-box,
      linear-gradient(#000 0 0);

    -webkit-mask-composite: xor;
    mask-composite: exclude;

    opacity: var(--glow-opacity, 0);

    /*
     * Fades in and out on its own so pulling the cursor away dims the glow rather
     * than snapping it off. It deliberately does not transition its gradient
     * position: that is driven per frame by script and is already smooth.
     */
    transition: opacity 0.35s ease-out;
  }

  /*
   * Where the border area can paint a background, the ring is not a mask.
   *
   * Masks are not among the properties that follow corner-shape (backgrounds,
   * borders, outlines, shadows, overflow and backdrop-filter are). On the
   * squircle corners the mask above is cut along plain circular arcs that no
   * longer match the border being drawn underneath, so the shimmer visibly
   * detaches at every corner.
   *
   * Instead the ::after carries a transparent 2px border of its own and its
   * gradient is clipped to that border area -- `border-area` ignores the
   * border-color's transparency, so the full gradient paints in the band and
   * nowhere else. Backgrounds do follow corner-shape, and index.css sets
   * `corner-shape: inherit` on the ::after, so the ring tracks the exact shape
   * the border draws, including through the expansion's shape interpolation.
   *
   * The band lands in the same place the mask left it: inset: 0 already seats
   * the ::after just inside the block's own border, and its border area is the
   * 2px immediately inside that. The mask rule above stays as the fallback for
   * engines without `border-area` -- which are the same engines without
   * corner-shape, where the ring still matches the corners.
   */
  @supports (background-clip: border-area) {
    .block::after {
      border: 2px solid transparent;
      background-origin: border-box;
      background-clip: border-area;
      -webkit-background-clip: border-area;
      -webkit-mask: none;
      mask: none;
    }
  }

  .block h2,
  .block h3 {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 500;
    line-height: 1.15;
  }

  .block h2 {
    font-size: clamp(1.375rem, 2.6vw, 2.25rem);
  }

  .block h3 {
    font-size: 0.9375rem;
  }

  .block p {
    max-width: 44ch;
    margin: 0;
    font-size: 0.9375rem;
    line-height: 1.6;
    color: var(--color-neutral-400);
  }

  /*
   * Height is transitioned separately from the entrance so the two do not fight:
   * a block resizing between steps should not replay its own entrance delay.
   *
   * transform is declared last so it wins over the shared rule above it. Without
   * this the entrance ran on the fast settle curve instead of the bubble easing.
   */
  .stack .block {
    transition:
      opacity 0.7s ease-out,
      transform 1s var(--rise-ease),
      height var(--morph-duration) var(--morph-ease),
      padding var(--morph-duration) var(--morph-ease),
      border-radius var(--morph-duration) var(--morph-ease);
  }

  /*
   * A strip with nothing in it. Padding comes off so the bar reads as a solid
   * band at its tabled height rather than as a thin line inside a padded box.
   */
  .block--short {
    padding: 0;
    border-radius: 0.375rem;
    transition:
      height var(--morph-duration) var(--morph-ease),
      padding var(--morph-duration) var(--morph-ease),
      border-radius var(--morph-duration) var(--morph-ease);
  }

  .row {
    display: flex;
    flex-wrap: wrap;

    /*
     * Centres the five boxes under the stack.
     *
     * They are a fixed 250px wide each with a 20px gap, so five of them are 1330px
     * against a 1400px column. Without centring they sat flush to the left edge
     * with the slack all on one side.
     */
    justify-content: center;

    gap: var(--small-gap);
    height: var(--small-height);
    transition: height var(--morph-duration) var(--morph-ease);
  }

  .block--small {
    flex: 0 0 var(--small-width);
    justify-content: center;
    height: var(--small-height);
    padding: 0 1.25rem;

    /*
     * Pill-shaped while the row is a strip of tabs, squarer once it expands into
     * tiles. `--small-radius` carries the per-step value, written as the exact
     * rendered radius per step (see SMALL_RADII) so it interpolates smoothly.
     *
     * Scoped through `.row` to outrank the plain `.block` radius below. Both are
     * single-class selectors, so without the extra class the later rule won and
     * every box sat at 40px -- which happened to look right for a 75px strip and
     * only for that. The pill value has to actually reach the element.
     */
    border-radius: var(--small-radius);
  }

  .row .block--small {
    border-radius: var(--small-radius);
  }

  /*
   * The row of small blocks comes in after the stack has settled and then steps
   * through itself, so the page arrives in two readable stages.
   */
  /*
   * Every block carries the design's 40px corner radius.
   *
   * The matching 100% smoothing is applied in index.css. corner-shape is newer
   * than the property list svelte-check validates component CSS against, so
   * declaring it here raises a spurious unknown-property warning that cannot be
   * suppressed from inside a component.
   *
   * Applied to `.block` rather than the stack, so the five small boxes match. CSS
   * clamps a radius to half the shorter side, so the 50px strips round into pills
   * at this value; that is inherent to the specified radius rather than a bug, and
   * lowering it would need a separate rule per height.
   */
  .block {
    border-radius: 40px;
  }

  .stack .block {
    transition-delay: calc(var(--index, 0) * 0.1s);
  }

  .blocks--in .row .block {
    transition-delay: calc(0.5s + var(--index, 0) * 0.08s);
  }

  /*
   * Staggering is for the entrance only.
   *
   * `transition-delay` applies to every transitioned property, not just the ones
   * the entrance uses. Left in place after the entrance, each small block kept
   * delaying its own height change by up to 0.82s, so the row expanded one box at
   * a time against a section gap that was already at full size. That is what made
   * the row look broken when it expanded and collapsed again.
   *
   * Zeroing the delay once the entrance has played out makes every step morph fire
   * in unison. Declared after the rules above at equal specificity so it wins.
   */
  .blocks--entered .stack .block,
  .blocks--entered .row .block {
    transition-delay: 0s;
  }

  /*
   * The small row bubbles up from a little lower and later than the stack, so the
   * page assembles in two readable stages rather than all at once.
   */
  .block--small {
    transform: translateY(6rem) scale(0.88);
    will-change: transform, opacity;
  }

  /*
   * Same bubble easing for the row.
   *
   * It has to be repeated here rather than inherited: `.block--small` is a
   * sibling of `.stack .block`, so the stack's transition does not reach it and it
   * would otherwise animate on the shared fast curve from `.block`.
   *
   * `corner-shape` is listed even though it is declared from index.css (the
   * property is too new for svelte-check's component CSS parser, so the
   * declaration lives in the global sheet). The small blocks carry the squircle
   * smoothing only once expanded, per the user's request; without a transition
   * entry the shape would flip discretely at the step boundary while the height
   * and radius morph smoothly around it. corner-shape interpolates through its
   * superellipse() values, so the smoothing eases in with the expansion.
   */
  .row .block--small {
    transition:
      opacity 0.7s ease-out,
      transform 1s var(--rise-ease),
      height var(--morph-duration) var(--morph-ease),
      border-radius var(--morph-duration) var(--morph-ease),
      corner-shape var(--morph-duration) var(--morph-ease);
  }

  /*
   * Mobile: the five small blocks stay a strip.
   *
   * At 250px wide each, the row wraps into ragged lines of two and three on a
   * narrow screen and the final step's expansion into 250px tiles leaves them
   * stacked taller than the viewport. The row becomes a five-column grid so every
   * block takes an equal share of the width, and its height is pinned to the
   * strip so the last step changes nothing on this layout.
   */
  @media (max-width: 640px) {
    .row {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 0.625rem;
      height: 56px;
    }

    .row .block--small {
      flex: none;
      width: auto;
      height: 56px;
      padding: 0 0.25rem;
      border-radius: 9999px;
    }

    .block--small h3 {
      font-size: 0.75rem;
      white-space: nowrap;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .block,
    .blocks--in .block {
      opacity: 1;
      transform: none;
      transition: none;
      transition-delay: 0s;
    }

    /* No cursor tracking: the glow is the only thing that moves here. */
    .block::after {
      display: none;
    }
  }
</style>
