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
  <p>building with ❤️ from BLR and GNB</p>
</footer>

<style>
  /*
   * Pinned to the bottom of the viewport.
   *
   * It used to sit in the page flow below the blocks, where the full-height
   * landing hero and the blocks column pushed it off the bottom of the screen
   * entirely. Fixed placement keeps it visible without reserving any space.
   *
   * pointer-events are off so it can never intercept a click meant for a block
   * that happens to sit behind it.
   */
  .footer {
    position: fixed;
    inset-inline: 0;
    bottom: 0;
    z-index: 5;

    padding: 1rem 1.5rem;
    text-align: center;
    pointer-events: none;
  }

  .footer p {
    margin: 0;
    font-size: 0.8125rem;
    line-height: 1.5;

    /*
     * Half opacity as specified. Applied to the text only, not the footer, so the
     * padding keeps its full size and the block cannot shift when it lands.
     */
    color: rgb(255 255 255 / 0.5);

    opacity: 0;
    transition: opacity 0.5s ease-out;
  }

  .footer--in p {
    opacity: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    .footer p {
      opacity: 1;
      transition: none;
    }
  }
</style>
