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
    onstep,
  }: { revealed?: boolean; reset?: number; onstep?: (step: number) => void } = $props();

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
   *
   * Block 1 at the last step is capped at 365px of the 1080px design viewport
   * (33.8svh) rather than carrying the full quarter it used to. The column at
   * that stage filled its 85dvh body almost exactly — 12.4px of slack against a
   * 918px body — which left the wordmark footer crowded up against the block
   * above it. Taking the block back to 365px drops the column to 70.5svh and
   * leaves 78px of slack, which is the room the footer reads in.
   */
  const DESKTOP_HEIGHTS = [
    [64, 4.6, 4.6],
    [18.5, 50, 4.6],
    [18.5, 18.5, 36.5],
    [33.8, 4.6, 4.6],
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
    [43, 7.6, 7.6],
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
   * The second control point sits above 1, so the curve carries past its target
   * and comes back onto it. That back-ease is the bounce: a block inflates past
   * the height it is settling at, then eases down onto it, the way a balloon does
   * when you stop blowing into it. The x control points are the same long settle
   * that was here before the bounce, so the front of the curve launches exactly
   * as it did; only the tail now overshoots.
   *
   * Everything in a step shares this one curve — the block's height, the radius
   * that rides with it, the stack around it and the row underneath — which is
   * what makes the bounce read as inflation rather than as each panel wobbling on
   * its own. Sharing it also keeps them in agreement frame by frame: a block
   * growing while its neighbour shrinks leaves the pair summing to the stack's own
   * animated height at every instant, so nothing overlaps and the column never
   * spills past the body.
   *
   * The overshoot is bounded by the shortest thing it has to fit around. A strip
   * collapsing from 36.5svh to a 4.6svh tab travels 31.9svh, and the overshoot is
   * a fraction of that travel, so too steep a curve carries the tab below its
   * resting height and down to a sliver, clipping its title on the way back. 1.40
   * tops out at 5.3%, which leaves a collapsing tab at 2.9svh — over the 2.6svh
   * its 24px title needs, but only just. 1.45 bottoms the same tab out at 2.5svh
   * and clips, and the classic back-ease (1.56, ~10%) drops it to 16px.
   *
   * The whole morph is deliberately brisk: the x control points still front-load
   * the travel exactly as they did when this was a plain long settle, so the
   * launch is unchanged and only the tail now overshoots. Shortening the duration
   * from 1.2s to 0.6s is what turns that tail from a float into a bounce — the
   * amplitude is the same and the reversal is twice as quick.
   */
  const MORPH_DURATION = 0.6;
  const MORPH_EASE = 'cubic-bezier(0.22, 1.40, 0.36, 1)';

  /*
   * The small row gets its own curve, and its overshoot is allowed to be larger.
   *
   * The row's overshoot has slack the stack does not. On the step where the row
   * expands, the stack is shedding height faster than the row takes it, so the
   * column's own height FALLS as the overshoot rises: it measures 85.0 − 2.3·v.
   * The stack's curve is bounded by the strip that collapses beside it, but the
   * row carries no strip and can overshoot freely — as long as its overshoot
   * does not land early, while the stack is still tall. So this curve is
   * back-loaded: a steep 1.60 overshoot on x control points well past the middle,
   * which pushes the pop to the far end of the morph where the stack has already
   * settled and the column is 2.3svh short of its ceiling.
   *
   * A front-loaded curve with the same overshoot peaks at a tenth of the way in,
   * while the stack is still near its full height, and the two overshoots add up
   * past the body.
   */
  const ROW_EASE = 'cubic-bezier(0.40, 1.60, 0.70, 1)';


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

    if (next !== step) {
      step = next;

      /*
       * Report the stage up so the navbar can dim at the last one. App owns no
       * position of its own — it mirrors this back.
       */
      onstep?.(next);
    }
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

  /* ── the over-scroll bounce ───────────────────────────────────────────── */

  /**
   * The column that squashes, and the bounce currently playing.
   *
   * Over-scroll is dead by design: `overscroll-behavior: contain` on <html>
   * stops the browser's own rubber-band from dragging the whole viewport, so
   * there is nothing to feel when a gesture runs past the end of the runway.
   * This fills that gap — the gesture is real, it just has no scroll left to
   * buy, and the column answers it by pressing against the edge and springing
   * back.
   *
   * It is a transform, not a height change, so it cannot fight the morph: a
   * squash while a block is mid-morph just scales whatever height it happens to
   * be at that instant.
   */
  let columnEl: HTMLElement | undefined = $state();

  let bounce: Animation | undefined;
  let bounceRunning = false;

  /**
   * How long the squash and the spring back take.
   *
   * Both amplitudes are bounded by the container around the column, and both
   * bounds have to hold. `.blocks` clips at its padding box, so the column may
   * widen no further than the 48px between its 1352px width and that box. More
   * importantly it clips at its own 85dvh body, and the room to grow there is
   * the slack on the side the spring is heading for.
   *
   * That slack is not a constant: at the last stage the column is 893px against
   * a 918px body and has 12.4px to spare either side, but at the first stage it
   * is 915px and has 1.5px. So the spring cannot be written down as a fixed
   * amount — it is measured live against the room actually available, which is
   * what keeps the top of the runway from shaving the glass off its own edges.
   */
  const BOUNCE_DURATION = 0.85;

  /** How far the squash presses in, and how far the spring aims past it. */
  const BOUNCE_SQUASH = 0.93;
  const BOUNCE_SPRING_PX = 18;

  /** How much the column widens as it squashes, as a fraction of the squash. */
  const BOUNCE_WIDEN = 0.4;

  const quietMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  /**
   * Press the column against `edge`, then spring it back.
   *
   * The squash narrows the height and widens the width by a fraction of the
   * same amount, which is what makes it read as a body giving under pressure
   * rather than a box being scaled. The origin is the edge being pressed
   * against, so the column stays put where the finger is and the far side
   * moves.
   *
   * The spring is measured, not assumed: with the origin pinned to one edge the
   * overshoot pushes the far side out, and it may only push it as far as the
   * body has slack on that side. Where there is room for the full 18px it gets
   * it; where the first stage's column nearly fills its body the spring shrinks
   * to almost nothing and the bounce plays as a squash and return instead. The
   * squash itself always shortens the column, so it never needs this budget.
   *
   * `bounceRunning` refuses a second bounce while one is still playing, so
   * holding a scroll wheel against the end does not stack a dozen squashes into
   * each other. It clears on the animation finishing, which also means a bounce
   * that is cancelled counts as finished and the next gesture is free to start
   * a new one.
   */
  const bounceEdge = (edge: 'top' | 'bottom') => {
    const el = columnEl;
    const body = sectionEl;
    if (!el || !body || bounceRunning || quietMotion()) return;

    const rect = el.getBoundingClientRect();
    const bounds = body.getBoundingClientRect();

    /* Slack on the side the overshoot travels toward, measured from the edge in. */
    const room =
      edge === 'bottom'
        ? Math.max(0, rect.top - bounds.top)
        : Math.max(0, bounds.bottom - rect.bottom);

    /*
     * The spring is exactly the room available, less a sliver for sub-pixel
     * rounding, and never more than the 18px it is designed to reach.
     *
     * Because the spring is a keyframe rather than something an easing is
     * trusted to overshoot into, it is also the literal peak of the animation:
     * every easing between the keyframes below keeps its control points inside
     * 0-1, so nothing interpolates past it. That matters more than it sounds —
     * an easing overshooting its endpoint carries the column a few pixels past
     * a budget that was already spent to the pixel.
     */
    const spring = 1 + Math.max(0, Math.min(room - 1, BOUNCE_SPRING_PX)) / rect.height;

    bounceRunning = true;
    bounce?.cancel();

    el.style.transformOrigin = edge === 'bottom' ? 'center bottom' : 'center top';

    const wide = 1 + (1 - BOUNCE_SQUASH) * BOUNCE_WIDEN;
    const thin = 1 - (spring - 1) * 0.55;
    const near = 1 - (spring - 1) * 0.22;
    const kick = 1 + (spring - 1) * 0.35;
    const wideNear = 1 + (wide - 1) * 0.3;

    bounce = el.animate(
      [
        { transform: 'none', easing: 'cubic-bezier(0.32, 0, 0.5, 0.4)' },
        {
          transform: `scaleY(${BOUNCE_SQUASH}) scaleX(${wide})`,
          offset: 0.24,
          /* Eases in: the release snaps out of the squash rather than drifting from it. */
          easing: 'cubic-bezier(0.4, 0, 0.7, 0.5)',
        },
        {
          transform: `scaleY(${spring}) scaleX(${thin})`,
          offset: 0.44,
          easing: 'cubic-bezier(0.4, 0, 0.5, 0.6)',
        },
        {
          transform: `scaleY(${near}) scaleX(${wideNear})`,
          offset: 0.64,
          easing: 'cubic-bezier(0.4, 0, 0.5, 0.6)',
        },
        {
          transform: `scaleY(${kick}) scaleX(${thin})`,
          offset: 0.84,
          easing: 'cubic-bezier(0.3, 0, 0.4, 0.5)',
        },
        { transform: 'none' },
      ],
      { duration: BOUNCE_DURATION * 1000, fill: 'none' },
    );

    const settle = () => {
      bounceRunning = false;
    };

    bounce.finished.then(settle, settle);
  };

  /**
   * Whether the runway is against the top or the bottom.
   *
   * The tolerance covers the rounding a snapped position leaves behind and the
   * fractional pixel a devicePixelRatio of 2 or 3 introduces, so the last stage
   * reads as the bottom even when scrollY stops a hair short of the maximum.
   */
  const EDGE = 4;
  const atTop = () => scrollY <= EDGE;
  const atBottom = () =>
    scrollY >= document.documentElement.scrollHeight - window.innerHeight - EDGE;

  const onWheel = (event: WheelEvent) => {
    if (Math.abs(event.deltaY) < 8) return;

    if (event.deltaY > 0) {
      if (atBottom()) bounceEdge('bottom');
    } else if (atTop()) {
      bounceEdge('top');
    }
  };

  /** Finger position of the last touchmove, so the drag is measured as a delta. */
  let touchY: number | undefined;

  const onTouchStart = (event: TouchEvent) => {
    touchY = event.touches[0]?.clientY;
  };

  const onTouchMove = (event: TouchEvent) => {
    const y = event.touches[0]?.clientY;
    if (y === undefined || touchY === undefined) return;

    /* Finger travelling up is a scroll down, and the reverse. */
    const drag = touchY - y;
    if (Math.abs(drag) < 12) return;

    if (drag > 0) {
      if (atBottom()) {
        touchY = y;
        bounceEdge('bottom');
      }
    } else if (atTop()) {
      touchY = y;
      bounceEdge('top');
    }
  };

  const onKey = (event: KeyboardEvent) => {
    const down = event.key === 'ArrowDown' || event.key === 'PageDown' || event.key === ' ';
    const up = event.key === 'ArrowUp' || event.key === 'PageUp';

    if (down) {
      if (atBottom()) bounceEdge('bottom');
    } else if (up && atTop()) {
      bounceEdge('top');
    }
  };

  /*
   * The bounce listens only once the blocks are on screen. Through the loader
   * and the hero the document is scroll-locked and the runway never moves, so
   * a gesture there is answered by App's own stage change instead.
   */
  $effect(() => {
    if (!revealed) return;

    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('keydown', onKey, { passive: true });

    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKey);

      touchY = undefined;
      bounce?.cancel();
      bounceRunning = false;
    };
  });

  /*
   * Take-to-the-top: glide back to stage 1.
   *
   * Just the scroll — the position is the stage, so as the glide runs this
   * engine walks the column down through the stages and the morphs play on
   * the way up, and the native snap holds the landing at the runway's start.
   *
   * The press happens first and the scroll is not held back for it: the button
   * answers the finger immediately, and the two overlap rather than queue. The
   * glide only crosses the first stage boundary a third of the way down the
   * runway, so the button is still on screen for most of the bounce.
   */
  const toTop = () => {
    if (step === 0) return;

    bounceToTop();

    scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ── the take-to-the-top press ────────────────────────────────────────── */

  let toTopEl: HTMLElement | undefined = $state();
  let toTopBounce: Animation | undefined;
  let toTopBouncing = false;

  /**
   * Seconds for the press, the spring past and the settle.
   *
   * Shorter than the column's over-scroll bounce, and deliberately: this one
   * answers a click, so it wants to land while the finger is still down rather
   * than trailing after it. It is also unencumbered by the two containers that
   * cap the column — the button is fixed over the page, nothing clips it, so
   * the amplitudes can be as deep as a press wants to be.
   */
  const BUTTON_BOUNCE = 0.42;

  /** How far the press sinks it, and how far the spring carries past rest. */
  const BUTTON_PRESS = { x: 0.9, y: 0.84 };
  const BUTTON_SPRING = { x: 0.98, y: 1.05 };

  /**
   * Press the button in and let it spring back.
   *
   * The press is asymmetric: it narrows more than it shortens, so the frosted
   * square reads as soft rubber giving under a finger rather than as a box
   * being scaled down uniformly. The spring then overshoots past rest and
   * settles, and the segment that carries it out is itself overshooting, which
   * leaves a second small kick after the first — a click that is answered
   * rather than merely acknowledged.
   *
   * The button's reveal also animates `transform`, so pressing while it is
   * still arriving would snap it straight out of its own entrance. It holds at
   * `translateY(0.5rem)` until that finishes, and a computed transform that is
   * not `none` means the reveal is still in flight — the press is skipped and
   * the click still scrolls.
   */
  const bounceToTop = () => {
    const el = toTopEl;
    if (!el || toTopBouncing || quietMotion()) return;
    if (getComputedStyle(el).transform !== 'none') return;

    toTopBouncing = true;
    toTopBounce?.cancel();

    toTopBounce = el.animate(
      [
        { transform: 'scale(1)', easing: 'cubic-bezier(0.45, 0, 0.55, 0.4)' },
        {
          transform: `scale(${BUTTON_PRESS.x}, ${BUTTON_PRESS.y})`,
          offset: 0.2,
          easing: 'cubic-bezier(0.2, 1.4, 0.4, 1)',
        },
        {
          transform: `scale(${BUTTON_SPRING.x}, ${BUTTON_SPRING.y})`,
          offset: 0.52,
          easing: 'cubic-bezier(0.4, 0, 0.5, 0.6)',
        },
        { transform: 'scale(1.004, 0.996)', offset: 0.76, easing: 'cubic-bezier(0.4, 0, 0.5, 0.6)' },
        { transform: 'scale(1)' },
      ],
      { duration: BUTTON_BOUNCE * 1000, fill: 'none' },
    );

    const settle = () => {
      toTopBouncing = false;
    };

    toTopBounce.finished.then(settle, settle);
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
  /** Take the glow off every block. */
  const hideGlow = () => {
    if (glowRafId !== undefined) {
      cancelAnimationFrame(glowRafId);
      glowRafId = undefined;
    }
    if (!sectionEl) return;
    for (const block of sectionEl.querySelectorAll<HTMLElement>('.block')) {
      block.style.setProperty('--glow-opacity', '0');
    }
  };

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
  const onGlowLeave = () => hideGlow();

  /*
   * Leaving the section is not the only way the cursor stops being on the page.
   *
   * Alt-tabbing to another app, dragging the cursor onto a second monitor, or
   * switching tabs all take the pointer off the page without the pointer ever
   * crossing an element boundary, so no `mouseleave` is dispatched and the ring
   * stays lit at the last position it was given — sitting there behind whatever
   * the visitor switched to. A window that loses focus and a tab that is hidden
   * are both announced on their own events, and both mean the same thing here:
   * nobody is looking at the blocks, so drop the glow.
   *
   * Re-entering does not need a counterpart: the next `mousemove` over the
   * section writes a fresh position and turns the glow back on by itself.
   */
  $effect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') hideGlow();
    };

    window.addEventListener('blur', hideGlow);
    document.addEventListener('visibilitychange', onHidden);

    return () => {
      window.removeEventListener('blur', hideGlow);
      document.removeEventListener('visibilitychange', onHidden);
    };
  });
</script>

<section
  class="blocks"
  class:blocks--in={revealed}
  class:blocks--entered={entered}
  class:blocks--end={step === HEIGHTS.length - 1}
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
    --row-ease: {ROW_EASE};
    --stack-height: {svh(stackHeightFor(step))};
  "
  bind:this={sectionEl}
  onmousemove={onGlowMove}
  onmouseleave={onGlowLeave}
  aria-label="Selected work and contact"
>
  <div class="column" bind:this={columnEl}>
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
    bind:this={toTopEl}
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

  <!--
    The closing wordmark.

    It belongs to the last stage and nowhere else, so it lives here rather than in
    the footer: this is the only place that knows which stage the runway is on,
    exactly as with the take-to-the-top button. The footer's own line — "building
    with ❤️ from BLR and GNB" — stays on screen through every stage.

    It is placed inside the body rather than in the footer band because the band
    is 5dvh and holds one line of text. The last stage's column is deliberately
    short (block 1 is capped at 365px) and leaves 78px of slack below it, and that
    slack is what the wordmark sits in.
  -->
  <div
    class="end-mark"
    class:end-mark--in={step === HEIGHTS.length - 1}
    aria-hidden="true"
  >
    <span class="end-mark__name">NAMMADE</span>
    <span class="end-mark__studio">STUDIO</span>
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

    /* Anchors the closing wordmark, which is placed against the body's bottom. */
    position: relative;

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

    /*
     * The row's own curve, not the stack's — see ROW_EASE. Its overshoot lands
     * late in the morph, on the step where the row expands into its tiles, so
     * the column is already two viewport-ish units taller by the time the pop
     * arrives and has the room for it.
     */
    transition: height var(--morph-duration) var(--row-ease);
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
      height var(--morph-duration) var(--row-ease),
      border-radius var(--morph-duration) var(--row-ease),
      corner-shape var(--morph-duration) var(--row-ease);
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

  /*
   * The closing wordmark, in the landing hero's own sizes.
   *
   * Both lines use the same clamps, line-heights, weights and tracking as the
   * hero, and the second line carries the same -20px margin, so the mark here
   * measures the same as the one the page opened on rather than being a smaller
   * echo of it. See LandingPage.svelte for why the gap is a margin.
   *
   * Out of flow, anchored to the bottom of the body. Left in flow it would
   * consume height at every stage and push the column up, and it is only ever
   * wanted at the last one.
   *
   * The bubble is a back-eased transform rather than a keyframe animation, so it
   * plays in reverse on the way out — leaving the last stage folds the wordmark
   * back down instead of dropping it.
   *
   * The start is deliberately far from rest. A bezier's overshoot is a fraction
   * of the distance travelled, not of the resting value, so a scale that only
   * has to move from 0.86 to 1 overshoots by 2% and reads as a fade that happens
   * to scale. Travelling from 0.5 instead gives it 0.5 to overshoot against and
   * the mark inflates to 8% past its size before settling.
   */
  .end-mark {
    position: absolute;
    left: 50%;
    bottom: 1rem;

    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;

    /* Decorative: the name is already in the navbar's accessible label. */
    pointer-events: none;

    opacity: 0;
    transform: translate(-50%, 1rem) scale(0.5);

    transition:
      opacity 0.35s ease-out,
      transform 0.7s cubic-bezier(0.2, 1.75, 0.35, 1);
  }

  .end-mark--in {
    opacity: 1;
    transform: translate(-50%, 0) scale(1);
  }

  /*
   * The hero's own type and the hero's own tightening, unmodified — the same
   * clamps, line-heights and tracking, and the same -0.625rem margin on the
   * second line — so the mark here measures the same as the one the page opened
   * on, ink gap included. See LandingPage.svelte for why the gap is a margin and
   * how far it can go before the ink merges.
   */
  .end-mark__name {
    font-family: var(--font-stacked);
    font-size: clamp(3.5rem, 13vw, 6rem);
    font-weight: 200;
    line-height: 0.9;
    letter-spacing: -0.07em;
    color: var(--color-neutral-100);
  }

  .end-mark__studio {
    font-family: var(--font-studio);
    font-size: clamp(1.25rem, 3.2vw, 2.8125rem);
    font-weight: 700;
    line-height: 1;
    letter-spacing: -0.05em;
    color: var(--color-neutral-100);
    margin-top: -0.625rem;
  }

  /*
   * The space the mark takes has to come out of the body, or the column and the
   * mark would sit on top of each other. The column is centred, so shrinking the
   * area it is centred within lifts it by half as much — which is the shift
   * needed to clear the mark at the bottom without shortening block 1 again.
   *
   * The reservation is bounded from both sides and is expressed in the same dvh
   * the body is, so the relationship holds at any height: it has to be at least
   * the mark plus its offset, and at most the slack the last stage's column
   * leaves — which is 14.5% of the body against a 70.5% column.
   *
   * The reservation is transitioned so the lift arrives with the stage change
   * rather than jumping ahead of the morph playing underneath it.
   */
  .blocks--end {
    padding-bottom: 12.5dvh;
    transition: padding-bottom var(--morph-duration) var(--morph-ease);
  }

  /*
   * Below 40rem the clamps resolve to their smallest ends and the mark is a
   * fraction of the desktop height, so the reservation comes down with them.
   */
  @media (max-width: 40rem) {
    .blocks--end {
      padding-bottom: 9dvh;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .end-mark {
      transition: none;
    }
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
