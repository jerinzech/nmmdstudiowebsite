<script lang="ts">
  import { untrack } from 'svelte';

  /*
   * The homepage is a fixed column of frosted blocks that change size as the page
   * is scrolled.
   *
   * Sizes are described in one table. Every block reads its height for the
   * current step out of it, so a step is only ever written down once and the
   * three blocks cannot drift out of agreement with each other.
   */
  let {
    revealed = false,
    reset = 0,
  }: { revealed?: boolean; reset?: number } = $props();

  /*
   * Two emission units, one decision each.
   *
   * Structure is authored against a design viewport and emitted in svh, so
   * the blocks keep their proportions on every desktop — and stay stable on
   * a phone. Viewport-unit changes do not run transitions: emitted in dvh,
   * every collapse or expansion of the mobile address bar resized all the
   * blocks in one jump mid-scroll. The small viewport is the toolbar-expanded
   * size, constant at all times, so nothing resizes under a gesture; the
   * slack against the 85dvh body when the toolbar is collapsed centres out.
   * Plain vh has the same jump problem in the other direction and would also
   * overflow the body — see the body rule for that history.
   *
   * Text is emitted in rem, so type stays legible instead of scaling with
   * the screen — the greeting, the titles and the strip labels all hold
   * their size while the glass around them grows.
   */
  const svh = (n: number) => `${n}svh`;

  const PX_PER_REM = 16;
  const rem = (px: number) => `${px / PX_PER_REM}rem`;

  const MAX_WIDTH = 1400;

  /*
   * Block heights per scroll step for the desktop column, in svh of the
   * viewport (the design viewport is 1080px tall; 50px there is 4.6).
   *
   * The stages are tuned so every column fits inside the 85dvh body with a
   * little slack — the stack, two gaps, the column gap and the 7svh row land
   * at 84.7 or under — so no stage clips its own content.
   *
   * Step 0 is the first impression: one tall block over two thin strips. Step 1
   * moves height from block 1 into block 2. Step 2 flattens both of those and
   * hands the height to block 3. Step 3 gives the height back to block 1 and
   * hands the column over to the row of small blocks below.
   */
  const DESKTOP_HEIGHTS = [
    [64, 4.6, 4.6],
    [18.5, 50, 4.6],
    [18.5, 18.5, 36.5],
    [46, 4.6, 4.6],
  ] as const;

  /*
   * The same four stages, authored for the narrow column in svh of a phone's
   * viewport (~660px; 50px there is 7.6): shorter throughout so the tallest
   * step still fits the 85dvh body with real slack even on short phones —
   * the pinned 3.5rem row eats a fixed 56px of it — while keeping the strip
   * heights and the tall/strip pattern of the desktop table, which is what
   * the shared RADII table and the short-title behaviour key off. Block 1
   * stays above the compact threshold in stages 1 and 4 and below it in 2 and
   * 3, matching the desktop rhythm.
   */
  const MOBILE_HEIGHTS = [
    [53, 7.6, 7.6],
    [21.2, 40, 7.6],
    [21.2, 21.2, 40],
    [51.5, 7.6, 7.6],
  ] as const;

  /*
   * Below 40rem the mobile table is used — the same breakpoint as the small
   * row's media query in the styles below, so the row's pinned pills and the
   * shorter stages switch together.
   */
  const NARROW = '(max-width: 40rem)';

  let narrow = $state(matchMedia(NARROW).matches);

  $effect(() => {
    const query = matchMedia(NARROW);
    const update = () => (narrow = query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  });

  /** The active table: the desktop column, or the shorter mobile one. */
  const HEIGHTS = $derived(narrow ? MOBILE_HEIGHTS : DESKTOP_HEIGHTS);

  /*
   * The design's tile corner (40px at the 1080px design viewport is 3.7vh):
   * every block's radius when it is not a pill. Viewport-scaled with the
   * heights, so a big desktop's tiles carry proportionally larger corners.
   */
  const TILE_RADIUS = 3.7;

  /*
   * The strip pill: exactly half the 4.6vh strip height, which is the full
   * pill.
   *
   * Written as the honest rendered value rather than a huge number the browser
   * would clamp into the same pill. Either renders identically at rest, but
   * only this one interpolates: transitioning a huge number down to the tile
   * leaves the rendered radius riding the clamp at half the box, then snapping
   * in the final frames of the morph.
   */
  const PILL_RADIUS = 2.3;

  /*
   * Corner radius per step for the stack blocks, aligned row-for-row with
   * HEIGHTS.
   *
   * Row 1 (work) is a tile at every step. Rows 2 and 3 are pills while they
   * are strips and tiles whenever they are tall, so their radius travels with
   * their height at each step change.
   */
  const RADII = [
    [TILE_RADIUS, PILL_RADIUS, PILL_RADIUS],
    [TILE_RADIUS, TILE_RADIUS, PILL_RADIUS],
    [TILE_RADIUS, TILE_RADIUS, TILE_RADIUS],
    [TILE_RADIUS, PILL_RADIUS, PILL_RADIUS],
  ] as const;

  /*
   * The greeting's compact state: below this height on block 1 the greeting
   * shrinks and parks left. Block 1 stands at 18.5–21.2vh in stages 2 and 3
   * and at 46–65vh in stages 1 and 4, so this sits between them at both
   * breakpoints.
   */
  const WORK_COMPACT_HEIGHT = 30;

  /*
   * The body is four rows: the three stack blocks and the small row. The
   * vertical gap between them is 1.5vh (16px at the design viewport), emitted
   * with the heights so the rhythm scales with the column; the small row's
   * horizontal gap stays a fixed rem.
   */
  const BLOCK_GAP = 1.5;
  const SMALL_GAP = 20;

  const SMALL_COUNT = 5;
  const SMALL_WIDTH = 250;

  /**
   * Height of the small row per scroll step, in vh.
   *
   * The last step squares them off at 23vh to match their width, so the row
   * reads as a set of tiles rather than tabs. Below 40rem the mobile media
   * query pins the row to 3.5rem pills and this emission is not read.
   */
  const SMALL_HEIGHTS = [7, 7, 7, 23] as const;

  /**
   * Height of a step's stack: its blocks plus the gaps between them. All the
   * terms are vh numbers, so the sum emits directly as vh.
   */
  const stackHeightFor = (i: number) =>
    HEIGHTS[i].reduce((a, b) => a + b, 0) + BLOCK_GAP * (HEIGHTS[i].length - 1);


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


  const BLOCKS = [
    { id: 'work', label: 'Selected work', body: 'Placeholder copy describing a project, its role, and the year it shipped.' },
    { id: 'studio', label: 'work', body: 'Placeholder copy about the practice, how it works, and who it works with.' },
    { id: 'contact', label: 'team', body: 'Placeholder copy for enquiries, with a place for an email or a form.' },
  ];

  const SMALL = Array.from({ length: SMALL_COUNT }, (_, i) => ({ id: `s${i}`, label: `Block ${i + 4}` }));

  /*
   * Which stage the column is currently showing.
   *
   * The stage comes from the scroll position: App.svelte lays the page out as
   * a runway one viewport per stage, so each stage of scroll moves the column
   * on by exactly one step — a block holds its size until the next boundary
   * instead of resizing under the cursor.
   */
  let step = $state(0);

  /** Scrollable distance per stage: a viewport's worth of runway. */
  const stepSpan = () =>
    (document.documentElement.scrollHeight - window.innerHeight) / (HEIGHTS.length - 1);

  let applyRaf: number | undefined;

  /*
   * The stage is read straight off the scroll position.
   *
   * Native scroll snapping owns the landing: `scroll-snap-type` on <html>
   * (index.css) and the stage anchors in App.svelte guarantee that every
   * gesture — wheel, trackpad, touch, keys — ends on a stage boundary, so
   * rounding the position is exact and the browser's own engine handles the
   * reliability. This side only adopts the stage as a boundary is crossed
   * mid-flight, so the morph starts under the gesture rather than after it.
   *
   * The earlier JS stepper — timers, momentum waits, smooth-scroll glides
   * and the flags to keep them from consuming their own motion — was three
   * rounds of bugs: a cascade that cycled the stages on its own, a walk-back
   * that dragged the page opposite the gesture, and a swallow window that
   * ate the second and third flicks. Snapping does all of that in the
   * compositor.
   */
  const apply = () => {
    const next = Math.min(
      Math.max(0, Math.round(scrollY / stepSpan())),
      HEIGHTS.length - 1,
    );

    if (next !== step) step = next;
  };

  const onScroll = () => {
    /*
     * The position is read inside a rAF rather than in the handler itself, so
     * a momentum fling cannot queue more step writes than the browser will
     * paint.
     */
    if (applyRaf !== undefined) return;

    applyRaf = requestAnimationFrame(() => {
      applyRaf = undefined;
      apply();
    });
  };

  /*
   * Take-to-the-top: glide back to stage 1.
   *
   * Just the scroll — the position is the stage, so as the glide runs this
   * engine walks the column down through the stages and the morphs play on
   * the way up, and the native snap holds the landing at the runway's start.
   */
  const toTop = () => {
    if (step === 0) return;

    scrollTo({ top: 0, behavior: 'smooth' });
  };

  /*
   * The navbar logo takes the page back to stage 1, like the take-to-the-top
   * button. `reset` is a counter App bumps on each logo click; every change
   * requests the same glide, and it starts at 0 so nothing runs on mount.
   *
   * The reset runs untracked: toTop reads `step` to guard itself, and letting
   * the effect track it would re-fire the reset on every stage change.
   */
  $effect(() => {
    if (!reset) return;

    untrack(() => toTop());
  });

  $effect(() => {
    /*
     * Only once the blocks are on screen. App locks the document's scroll
     * through the loader and the hero, so the runway is at rest at the top —
     * stage 1 — when the homepage takes over, and every scroll from here
     * lands on a stage by the native snap.
     */
    if (!revealed) return;

    apply();

    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (applyRaf !== undefined) cancelAnimationFrame(applyRaf);
    };
  });

  /**
   * Below this height a block is a strip: no room for title and copy together,
   * so it carries its title alone, centred, rather than clipping a line in
   * half. Strips sit at 4.6vh on desktop and 7.6vh on mobile; the tallest of
   * the small blocks never comes close from above, so one vh threshold serves
   * both tables.
   */
  const SHORT_HEIGHT = 12;

  /** Short strips drop their copy and keep their centred title. */
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
   * Border-radius for the small blocks per step, in vh.
   *
   * The strips are pills at exactly half their 7vh height (3.5vh) rather than
   * at a huge value the browser would clamp into a pill. Either renders the
   * same at rest, but only the honest value interpolates: transitioning a huge
   * number down to the tile left the rendered radius riding the clamp at half
   * the growing box, then snapping in the final frames of the expansion — the
   * visible jerk in the last step. A value that matches what is actually
   * painted lets the radius travel with the height for the whole morph.
   */
  const SMALL_RADII = [3.5, 3.5, 3.5, 3.7] as const;

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
    --max-width: {rem(MAX_WIDTH)};
    --block-gap: {svh(BLOCK_GAP)};
    --small-gap: {rem(SMALL_GAP)};
    --small-width: {rem(SMALL_WIDTH)};
    --small-height: {svh(SMALL_HEIGHTS[step])};
    --small-radius: {svh(SMALL_RADII[step])};
    --rise-ease: {RISE_EASE};
    --morph-duration: {MORPH_DURATION}s;
    --morph-ease: {MORPH_EASE};
    --stack-height: {svh(stackHeightFor(step))};
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
      <article
        class="block block--{block.id}"
        class:block--short={isShort(height)}
        class:block--tiled={RADII[step][i] === TILE_RADIUS}
        class:block--compact={block.id === 'work' && height <= WORK_COMPACT_HEIGHT}
        style="--height: {svh(height)}; --radius: {svh(RADII[step][i])}; --index: {i}"
      >
        {#if isShort(height)}
          <h2 class="block__title">{block.label}</h2>
        {:else if block.id === 'work'}
          <span class="block__hey">hey !!</span>
          <p class="block__tagline">we are an indie design and dev studio</p>
        {:else}
          <h2 class="block__title">{block.label}</h2>
          <p class="block__body">{block.body}</p>
        {/if}
      </article>
      {/each}
    </div>

    <div class="row" class:row--expanded={step === HEIGHTS.length - 1}>
      {#each SMALL as block, i (block.id)}
        <article class="block block--small block--{block.id}" style="--index: {i}">
          <h3 class="block__title">{block.label}</h3>
        </article>
      {/each}
    </div>
  </div>

  <button
    class="to-top"
    class:to-top--in={step === HEIGHTS.length - 1}
    onclick={toTop}
    aria-label="Take back to the top"
    aria-hidden={step !== HEIGHTS.length - 1}
    tabindex={step === HEIGHTS.length - 1 ? 0 : -1}
  >
    <svg
      viewBox="0 0 24 24"
      width="2rem"
      height="2rem"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  </button>
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
     * The body of the three constant sections: 85vh of the spec's 10/85/5
     * split, in flow between the navbar and the footer. dvh tracks the space
     * the mobile browser's collapsed address bar leaves.
     *
     * The height is explicit rather than flexed, and overflow is clipped so a
     * column taller than the section can never spill into the footer's region
     * below — on a short viewport the morph content is cut at the section
     * boundary instead of overlapping the next section.
     *
     * The centring below is then a single flex box of exactly the body's
     * height, with no offsetting constant to keep in agreement with the
     * navbar.
     */
    display: flex;
    flex-direction: column;
    justify-content: center;

    flex: none;
    height: 85vh;
    height: 85dvh;
    overflow: hidden;
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

    /*
     * The four rows share the block gap's rhythm at every step, so there is
     * nothing left to transition between steps.
     */
    gap: var(--block-gap);
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
    border: 0.0625rem solid rgb(255 255 255 / 0.1);
    background: rgb(255 255 255 / 0.05);
    backdrop-filter: blur(1.5rem);

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
      border-radius var(--morph-duration) var(--morph-ease),
      corner-shape var(--morph-duration) var(--morph-ease);
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
    padding: 0.0625rem;

    background: radial-gradient(
      22.5rem circle at var(--mouse-x, -9999px) var(--mouse-y, -9999px),
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
   * Instead the ::after carries a transparent 0.0625rem border of its own and its
   * gradient is clipped to that border area -- `border-area` ignores the
   * border-color's transparency, so the full gradient paints in the band and
   * nowhere else. Backgrounds do follow corner-shape, and index.css sets
   * `corner-shape: inherit` on the ::after, so the ring tracks the exact shape
   * the border draws, including through the expansion's shape interpolation.
   *
   * The band lands in the same place the mask left it: inset: 0 already seats
   * the ::after just inside the block's own border, and its border area is the
   * 0.0625rem immediately inside that. The mask rule above stays as the fallback
   * for engines without `border-area` -- which are the same engines without
   * corner-shape, where the ring still matches the corners.
   */
  @supports (background-clip: border-area) {
    .block::after {
      border: 0.0625rem solid transparent;
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
    font-size: 1.5rem;

    /*
     * Work Sans is a variable font, so the weight interpolates: the title
     * lightens as the block collapses into a strip and returns to medium as
     * it expands, on the same curve as the block's own morph.
     */
    transition: font-weight var(--morph-duration) var(--morph-ease);
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
   * Block 1 carries the studio greeting.
   *
   * Full state (stages 1 and 4): the greeting is Borel at the spec's 100px,
   * centred both ways in the block, with the Work Sans tagline at 20px and
   * light weight under it in the body text's softer tone.
   *
   * Both lines are absolute and anchored to the block's vertical midpoint —
   * the greeting dead on it, the subtitle below it, offset by half the
   * greeting's height plus the gap: 3rem at full size, 0.5rem compact. Their
   * `50%` terms track the animating block height, and every offset travels on
   * the block's own morph curve, so the pair glides together through each
   * stage change — the greeting's move to the left animates exactly like the
   * subtitle's, with nothing left to flip discretely but the subtitle's own
   * text wrap.
   *
   * Compact state (stages 2 and 3): the greeting shrinks to the spec's 48px
   * and the pair parks at the left, 100px in from the block's edge, keeping
   * the vertical centring.
   */
  .block--work {
    text-align: center;
  }

  .block__hey {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);

    font-family: var(--font-borel);
    font-size: 6.25rem;
    font-weight: 400;
    line-height: 1;
    color: var(--color-neutral-100);
    white-space: nowrap;

    transition:
      font-size var(--morph-duration) var(--morph-ease),
      left var(--morph-duration) var(--morph-ease),
      transform var(--morph-duration) var(--morph-ease);
  }

  .block--work .block__tagline {
    position: absolute;
    top: calc(50% + 6.125rem); /* half the 6.25rem greeting + the 3rem gap */
    left: 50%;
    transform: translateX(-50%);

    max-width: none;
    margin: 0;
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 300;
    line-height: 1.5;
    color: var(--color-neutral-400);

    transition:
      top var(--morph-duration) var(--morph-ease),
      left var(--morph-duration) var(--morph-ease),
      transform var(--morph-duration) var(--morph-ease);
  }

  .block--work.block--compact {
    text-align: left;
  }

  .block--work.block--compact .block__hey {
    font-size: 3rem;
    left: 6.25rem;
    transform: translate(0, -50%);
  }

  .block--work.block--compact .block__tagline {
    top: calc(50% + 2rem); /* half the 3rem greeting + the 0.5rem gap */
    left: 6.25rem;
    transform: none;
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
      border-radius var(--morph-duration) var(--morph-ease),
      corner-shape var(--morph-duration) var(--morph-ease);
  }

  /*
   /*
   * A strip carries its title alone, vertically centred, 4rem in from the left
   * edge. Padding comes off the other sides so the pill still reads as a solid
   * band at its tabled height; the left padding seats the label inside the
   * pill's curve.
   *
   * The radius is not overridden here: the strip is a pill, and the pill value
   * reaches it through `--radius` like every other stack block.
   */
  .block--short {
    justify-content: center;
    padding: 0 0 0 4rem;
    transition:
      height var(--morph-duration) var(--morph-ease),
      padding var(--morph-duration) var(--morph-ease),
      border-radius var(--morph-duration) var(--morph-ease),
      corner-shape var(--morph-duration) var(--morph-ease);
  }

  /*
   * Not expanded, the strip's title sits light; it takes the shared rule's
   * medium weight once the block expands into a tile.
   */
  .block--short .block__title {
    font-weight: 300;
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
   * The stack blocks read their radius from the RADII table, so a block is a
   * pill while it is a strip and a 40px tile whenever it is tall — the radius
   * travels with the height at each step. Scoped through `.stack` to outrank
   * the plain `.block` and `.block--short` selectors; the small row keeps its
   * own `--small-radius`.
   *
   * The matching 100% smoothing is applied in index.css on `.block--tiled`,
   * which the markup sets exactly when the radius is the tile value.
   * corner-shape is newer than the property list svelte-check validates
   * component CSS against, so declaring it here would raise a spurious
   * unknown-property warning that cannot be suppressed from inside a
   * component.
   */
  .stack .block {
    border-radius: var(--radius, 2.5rem);
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
  @media (max-width: 40rem) {
    .row {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 0.625rem;
      height: 3.5rem;
    }

    .row .block--small {
      flex: none;
      width: auto;
      height: 3.5rem;
      padding: 0 0.25rem;
      /*
       * Half the pinned 3.5rem height, which the CSS clamp would make of any
       * larger value anyway -- written honestly so nothing has to ride a clamp.
       */
      border-radius: 1.75rem;
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

  /*
   * Take-to-the-top, in the viewport's bottom-right corner.
   *
   * Fixed rather than absolute, so the 30px offsets are measured from the
   * viewport edges, not the body section — the button sits in the viewport's
   * scope regardless of where the section's content ends. No ancestor carries
   * a transform, filter or backdrop-filter, so the fixed position is measured
   * from the true viewport and the section's overflow clip cannot reach it.
   *
   * Always mounted and revealed by class rather than added by {#if}, so both
   * directions of the reveal can transition: it rises in with a delay so it
   * arrives after stage 4 has settled, and drops out instantly when the
   * stage is left. The same frosted treatment as the blocks, so it reads as
   * part of the same family. The 100% corner smoothing is applied from
   * index.css (corner-shape is too new for svelte-check's component CSS
   * parser).
   */
  .to-top {
    position: fixed;
    right: 1.875rem;
    bottom: 1.875rem;

    display: grid;
    place-items: center;
    width: 6.25rem;
    height: 6.25rem;
    padding: 0;

    border: 0.0625rem solid rgb(255 255 255 / 0.1);
    border-radius: 1.5625rem;
    background: rgb(255 255 255 / 0.05);
    backdrop-filter: blur(1.5rem);
    color: var(--color-neutral-100);
    cursor: pointer;

    opacity: 0;
    transform: translateY(0.5rem);
    pointer-events: none;

    transition:
      opacity 0.5s ease-out,
      transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .to-top--in {
    opacity: 1;
    transform: none;
    pointer-events: auto;

    /* Lets stage 4's expansion settle before the button arrives. */
    transition-delay: 0.6s;
  }

  .to-top:focus-visible {
    outline: 0.125rem solid var(--color-neutral-100);
    outline-offset: 0.25rem;
  }

  @media (prefers-reduced-motion: reduce) {
    .to-top {
      transition: none;
    }

    .to-top--in {
      transform: none;
    }
  }

  /*
   * Narrow-column overrides, at the same 40rem breakpoint the small row and
   * the MOBILE_HEIGHTS table use. Declared last so they win over every base
   * rule above at equal specificity.
   *
   * The shorter mobile stages are not proportionally scaled desktop stages —
   * the text keeps legible sizes, so the measurements around it are reauthored
   * rather than multiplied: the greeting and its offsets shrink to fit the
   * shorter block 1, the strips take a tighter left padding, and the
   * take-to-the-top button comes down from its 100px square.
   */
  @media (max-width: 40rem) {
    .block--short {
      padding: 0 0 0 2rem;
    }

    /* Full greeting: 56px, half of it plus a 1rem gap to the subtitle. */
    .block__hey {
      font-size: 3.5rem;
    }

    .block--work .block__tagline {
      font-size: 1rem;
      top: calc(50% + 2.75rem);
    }

    /* Compact greeting: 32px, parked nearer the edge than the desktop's
       100px, with the offsets recomputed for the shorter block 1. */
    .block--work.block--compact .block__hey {
      font-size: 2rem;
      left: 2rem;
    }

    .block--work.block--compact .block__tagline {
      font-size: 1rem;
      top: calc(50% + 1.5rem);
      left: 2rem;
    }

    .to-top {
      width: 4rem;
      height: 4rem;
      border-radius: 1rem;
      right: 1.25rem;
      bottom: 1.25rem;
    }
  }
</style>
