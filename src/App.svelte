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
  let guides = $state(true);
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

  <!-- DEBUG: layout-guidelines toggle; see the state comment above. -->
  <button class="guides" onclick={() => (guides = !guides)} aria-pressed={guides}>
    guides {guides ? 'on' : 'off'}
  </button>
</main>

<style>
  /*
   * The runway: one viewport of scroll per stage. #mainapp is four viewports
   * tall (the four stages live in Blocks.svelte's HEIGHTS table), and the
   * sticky .page below pins at the top while this height scrolls underneath —
   * so the visitor scrolls the stages in and out while the column stays on
   * screen. Blocks.svelte maps the scroll position to the stage and eases to
   * the nearest boundary once the scrolling settles.
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
    display: flex;
    flex-direction: column;
    height: 100vh;
    height: 100dvh;
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
