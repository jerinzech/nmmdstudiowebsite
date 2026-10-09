<script lang="ts">
  import LoadingPage from './components/LoadingPage.svelte'
  import LandingPage from './components/LandingPage.svelte'
  import Navbar from './components/Navbar.svelte'
  import Blocks from './components/Blocks.svelte'
  import Footer from './components/Footer.svelte'

  /*
   * The page runs as a sequence of stages, each one waiting for the last:
   *
   *   loading  the word animation plays once and fades on its own
   *   landing  the wordmark arrives and resolves into NAMMADE
   *   leaving  a scroll or click sends the wordmark out
   *   home     the navbar logo and the blocks come up together
   *
   * One variable rather than several booleans, because the stages are exclusive
   * and independent flags would allow combinations that cannot happen, such as
   * the homepage arriving while the hero is still on screen.
   */
  type Stage = 'loading' | 'landing' | 'leaving' | 'home';

  let stage = $state<Stage>('loading');

  /**
   * Whether a scroll or click should send the landing page out.
   *
   * Only armed once the wordmark has finished arriving. Listening earlier would
   * let a stray scroll during the reveal cut the hero off mid-animation.
   */
  let canLeave = $state(false);

  const leave = () => {
    if (!canLeave || stage !== 'landing') return;
    stage = 'leaving';
  };

  $effect(() => {
    if (stage !== 'landing') return;

    const events = ['scroll', 'wheel', 'touchstart', 'pointerdown', 'keydown'] as const;

    for (const event of events) {
      window.addEventListener(event, leave, { passive: true });
    }

    return () => {
      for (const event of events) {
        window.removeEventListener(event, leave);
      }
    };
  });

  /*
   * The wordmark's own timings decide when input starts counting and when the
   * homepage begins, so those numbers live in the components that use them rather
   * than being duplicated here.
   */
  const LANDING_SETTLE = 2.6;

  $effect(() => {
    if (stage !== 'landing') return;

    const timer = setTimeout(() => {
      canLeave = true;
    }, LANDING_SETTLE * 1000);

    return () => clearTimeout(timer);
  });

  /*
   * The stage is the scroll position, so a reload must not let the browser
   * restore the previous scroll — that would land the page mid-runway on a
   * later stage. Restoration is taken over manually and every load starts at
   * the top, which is stage 1.
   */
  $effect(() => {
    history.scrollRestoration = 'manual';
    scrollTo(0, 0);
  });

  /*
   * The document is scrollable — that is what drives the stages — but only
   * once the homepage is up. Through the loader and the hero the scroll is
   * locked so the intro cannot be scrolled behind, exactly as it was when
   * the page was sealed; the hero still leaves on the first wheel, touch or
   * key, and the lock lifts with the homepage.
   */
  $effect(() => {
    document.documentElement.classList.toggle('no-scroll', stage !== 'home');
  });

  /*
   * Clicking the navbar logo takes the homepage back to stage 1, exactly like
   * the take-to-the-top button. A counter rather than a boolean so every click
   * requests a reset, not just the first; Blocks performs the same one-jump
   * reset whenever it changes.
   */
  let logoResets = $state(0);

  /*
   * DEBUG: the toggle for the layout guidelines.
   *
   * `guides` gates the `xray` class on #mainapp; the whole overlay — borders,
   * names and size readouts — lives under that class in the DEBUG section of
   * index.css and paints and positions nothing while it is off. Fixed to the
   * viewport's top-left corner above every layer, so it stays reachable
   * through every stage.
   *
   * Delete the state, the class:xray, the button and its rule, and the x-ray
   * section in index.css together when finetuning is done.
   */
  let guides = $state(false);
</script>

<main id="mainapp" class:xray={guides}>
  <LoadingPage oncomplete={() => (stage = 'landing')} />

  <div class="page">
    <Navbar revealed={stage === 'home'} onlogo={() => (logoResets += 1)} />

    <LandingPage
      revealed={stage !== 'loading'}
      dismissed={stage === 'leaving' || stage === 'home'}
      onexit={() => (stage = 'home')}
    />

    <Blocks revealed={stage === 'home'} reset={logoResets} />
    <Footer revealed={stage === 'home'} />
  </div>

  <!--
    Snap targets for the stage boundaries: one per stage, at each viewport of
    runway. Paired with scroll-snap-type on <html>, every gesture ends on a
    stage. Keep in step with Blocks.svelte's HEIGHTS table.

    Stage 1 gets an anchor like every other stage, and the sticky .page below no
    longer carries a snap alignment of its own. It used to stand in as stage 1's
    target, but a sticky element's snap position moves with the scroll, so the
    browser was left with no usable snap point at the runway's start. A glide
    aimed there — the take-to-the-top, from either the button or the logo — was
    snapped away and settled a stage short of the top. A static anchor is a
    position the snap engine can actually land on.
  -->
  {#each [0, 1, 2, 3] as i (i)}
    <div class="stage-anchor" style="top: {i * 100}dvh"></div>
  {/each}

  <!-- DEBUG: layout-guidelines toggle; hidden for now — drop the `hidden`
       attribute to bring it back. -->
  <button class="guides" hidden onclick={() => (guides = !guides)} aria-pressed={guides}>
    guides {guides ? 'on' : 'off'}
  </button>
</main>

<style>
  /*
   * The runway: one viewport of scroll per stage. #mainapp is four viewports
   * tall (the four stages live in Blocks.svelte's HEIGHTS table), and the
   * sticky .page below pins at the top while this height scrolls underneath —
   * so the visitor scrolls the stages in and out while the column stays on
   * screen. Native scroll snapping (index.css, with the stage anchors below as
   * targets) lands every gesture on a stage boundary; Blocks.svelte reads the
   * position back as the stage.
   *
   * dvh over vh: the dynamic viewport tracks the space the mobile browser's
   * collapsed address bar and notification sheet actually leave, where vh
   * runs underneath them.
   */
  #mainapp {
    position: relative;
    width: 100%;
    height: 400vh;
    height: 400dvh;
  }

  /*
   * The homepage is three constant sections stacked in one column: navbar,
   * body, footer — 10vh / 85vh / 5vh, summing to a full viewport. Each is in
   * flow with an explicit height, so none can ever overlap another.
   *
   * Sticky, not fixed: the column rides at the top of the runway and never
   * leaves its container, so the final stage scrolls it only as far as the
   * runway's end.
   *
   * The landing hero is the one exception by design: it is a transient fixed
   * overlay in its own component, covering all three only while the wordmark
   * plays, then it leaves.
   */
  .page {
    position: sticky;
    top: 0;

    /*
     * Deliberately not a snap target.
     *
     * This used to carry `scroll-snap-align: start` as stage 1's target, but a
     * sticky element is pinned to the scrollport and so has no fixed snap
     * position to align — its snap area moves with the scroll. The snap engine
     * was therefore left with no target at the runway's start, and any glide
     * aimed there was snapped away to a later boundary. Every stage, including
     * this one, is targeted by a static `.stage-anchor` above instead.
     */
    display: flex;
    flex-direction: column;
    height: 100vh;
    height: 100dvh;
  }

  /*
   * The invisible stage boundaries the scroller snaps to — see the markup
   * comment. One viewport tall so every snap area covers its whole stage.
   */
  .stage-anchor {
    position: absolute;
    left: 0;
    width: 1px;
    height: 100vh;
    height: 100dvh;
    scroll-snap-align: start;
  }

  /* DEBUG: the layout-guidelines toggle; see the state comment above. */
  .guides {
    position: fixed;
    top: 0.75rem;
    left: 0.75rem;
    z-index: 10000;

    padding: 0.25rem 0.625rem;
    border: 0.0625rem solid rgb(255 255 255 / 0.3);
    border-radius: 0.375rem;
    background: rgb(0 0 0 / 0.6);
    color: rgb(255 255 255 / 0.85);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.75rem;
    line-height: 1.4;
    cursor: pointer;
  }
</style>
