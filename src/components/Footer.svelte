<script lang="ts">
  /*
   * Slim closing line for the page. Plain text with no links, so it is a single
   * paragraph rather than a nav.
   *
   * It shares the homepage's reveal flag so it fades in with the blocks instead
   * of being visible behind the landing page.
   */
  let { revealed = false }: { revealed?: boolean } = $props();
</script>

<footer class="footer" class:footer--in={revealed}>
  <p class="footer__text">building with ❤️ from BLR and GNB</p>
</footer>

<style>
  /*
   * The third of the three constant sections: 5vh of the spec's 15/80/5
   * split, in flow at the bottom of the page column, below the body. Nothing
   * is pinned over anything, so there is no z-index to manage and no clicks to
   * intercept — the body is sized to its own 80vh and the two can never meet.
   *
   * The closing line is centred within the 5vh; vertical padding is off so the
   * text cannot overflow the small band, and flex-shrink is off so a short
   * viewport never squeezes it.
   */
  .footer {
    height: 5vh;
    display: grid;
    place-items: center;
    flex-shrink: 0;

    padding: 0 1.5rem;
    text-align: center;
  }

  .footer__text {
    margin: 0;
    font-size: 0.8125rem;
    line-height: 1.5;

    /*
     * Half opacity as specified. Applied to the text only, not the footer, so
     * the band keeps its full size and the line cannot shift when it lands.
     */
    color: rgb(255 255 255 / 0.5);

    opacity: 0;
    transition: opacity 0.5s ease-out;
  }

  .footer--in .footer__text {
    opacity: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    .footer__text {
      opacity: 1;
      transition: none;
    }
  }
</style>
