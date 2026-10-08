<script lang="ts">
  /*
   * The logo is hidden until the landing page has left.
   *
   * It used to be mounted from the first paint, which put a wordmark in the
   * middle of the loading screen's own animation. Holding it back until the hero
   * has gone means the logo is the first thing seen of the homepage rather than
   * something that was already there behind everything.
   */
  let { revealed = false }: { revealed?: boolean } = $props();
</script>

<header class="nav" class:nav--in={revealed}>
  <nav class="nav__bar">
    <a class="nav__logo" href="#top" aria-label="NMMD home" tabindex={revealed ? 0 : -1}>
      NMMD
    </a>
  </nav>
</header>

<style>
  /*
   * No background, border or blur: the bar is the logo and nothing else, so the
   * page's black reads through it uninterrupted and the backdrop is not broken up
   * by a floating panel at the top of every screen.
   *
   * pointer-events stays off on the strip so it never swallows clicks meant for
   * the content scrolling underneath; the logo alone takes them back.
   */
  .nav {
    position: sticky;
    top: 0;
    z-index: 20;
    width: 100%;
    pointer-events: none;
  }

  .nav__bar {
    display: grid;
    place-items: center;
    padding: 1.5rem;
  }

  /*
   * The entrance drops the logo in from above the bar rather than fading it, so
   * it arrives with the blocks instead of sitting already-resolved while the
   * page assembles around it.
   */
  .nav__logo {
    font-family: var(--font-stacked);
    font-size: 50px;
    font-weight: 200;
    line-height: 1;
    letter-spacing: -0.05em;
    color: var(--color-neutral-100);
    text-decoration: none;
    pointer-events: auto;

    opacity: 0;
    transform: translateY(-0.75rem);

    /*
     * The shimmer.
     *
     * The wordmark is painted with a gradient rather than a flat colour, and the
     * gradient carries a bright band partway along. `background-clip: text` keeps
     * that gradient inside the glyphs instead of filling the link's box, so what
     * moves across on hover is a highlight travelling over the letters.
     *
     * The background is oversized at 300% so only a slice of the gradient is
     * visible at rest. Animating its position slides the bright band through the
     * text; at rest the window sits over a flat section and the logo reads as a
     * solid colour.
     *
     * The base colour is written as a literal rather than `currentColor`: the
     * transparent text fill means there is no current colour left for it to
     * resolve against once the clip is in place.
     */
    background-image: linear-gradient(
      100deg,
      var(--color-neutral-100) 40%,
      #ffffff 50%,
      var(--color-neutral-100) 60%
    );
    background-size: 300% 100%;
    background-position: 100% 0;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;

    transition:
      opacity 0.5s ease-out,
      transform 0.5s cubic-bezier(0.16, 1, 0.3, 1),
      background-position 0.9s ease;
  }

  .nav--in .nav__logo {
    opacity: 1;
    transform: none;
  }

  .nav__logo:hover {
    background-position: 0% 0;
  }

  .nav__logo:focus-visible {
    background-position: 0% 0;
    outline: 2px solid var(--color-neutral-100);
    outline-offset: 4px;
  }

  @media (prefers-reduced-motion: reduce) {
    .nav__logo {
      opacity: 1;
      transform: none;
      transition: none;
    }
  }
</style>
