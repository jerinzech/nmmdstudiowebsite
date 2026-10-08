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
</script>

<main id="mainapp">
  <LoadingPage oncomplete={() => (stage = 'landing')} />

  <div class="page">
    <Navbar revealed={stage === 'home'} />

    <LandingPage
      revealed={stage !== 'loading'}
      dismissed={stage === 'leaving' || stage === 'home'}
      onexit={() => (stage = 'home')}
    />

    <Blocks revealed={stage === 'home'} />
    <Footer revealed={stage === 'home'} />
  </div>
</main>

<style>
  #mainapp {
    position: relative;
    width: 100%;
    height: 100vh;

    /*
     * The page does not scroll. Gestures drive the stages instead, so there is
     * nothing to scroll to, and any overflow here would show as a stray
     * scrollbar.
     */
    overflow: hidden;
  }

  /*
   * The landing page is a full-height hero, and the blocks follow it. Without a
   * spacer the blocks would start life already scrolled into view, which would
   * make the scroll-driven size steps start partway through.
   */
  .page {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
</style>
