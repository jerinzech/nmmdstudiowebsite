<script lang="ts">
  import { onMount } from 'svelte';

  /*
   * The background wash: nine blurred colour blobs clustered around the centre
   * of the viewport, replicating the design's Figma background.
   *
   * Why the blur must be exactly 200px, and why that needs JS.
   *
   * The design specifies a 200px blur. In SVG that is `feGaussianBlur`'s
   * `stdDeviation` in user units, and user units are real pixels only when the
   * SVG's viewBox matches its rendered pixel size 1:1.
   *
   * Every CSS-only approach breaks that:
   *   - `filter: blur(200px)` on a hard-edged shape spreads the shape's ink
   *     over a wider area, so the peak colour drops — measured, a #6100ff blob
   *     lands at ~35% of full colour and no amount of extra size recovers it.
   *   - A background-image SVG with a normalised viewBox is stretched to cover
   *     the element, so the same stdDeviation maps to a different pixel blur on
   *     every viewport (58px on a phone, 177px on a 2560px display).
   *
   * So the viewBox is set to the viewport's own pixel size on mount and on
   * every resize, which keeps 1 unit = 1 pixel and the blur a true 200px on
   * every screen. The blob coordinates are percentages of that size, so they
   * scale with it.
   */

  /** The Figma blur, in pixels. */
  const BLUR = 200;

  /**
   * Blob radii and offsets, as a fraction of the viewport's smaller dimension.
   * Sized large relative to the blur so each blob keeps a saturated core while
   * its edges still run the full 200px soft.
   */
  const BLOBS = [
    // Core — darkest colours, anchoring the centre where the text sits.
    { x: 0.5, y: 0.5, r: 0.15, fill: '#511e1e' },
    { x: 0.42, y: 0.42, r: 0.13, fill: '#4e7248' },
    { x: 0.59, y: 0.58, r: 0.135, fill: '#6100ff' },
    // Mid ring — the cool blues, pushed out so the true centre stays dark.
    { x: 0.31, y: 0.54, r: 0.12, fill: '#6c94fc' },
    { x: 0.69, y: 0.42, r: 0.11, fill: '#6c94fc' },
    // The bright greens, lifting through the middle band.
    { x: 0.46, y: 0.31, r: 0.09, fill: '#9dde32' },
    { x: 0.42, y: 0.67, r: 0.08, fill: '#9dde32' },
    // Outer rim — the warm and pale colours, away from the text.
    { x: 0.26, y: 0.28, r: 0.11, fill: '#f99987' },
    { x: 0.74, y: 0.26, r: 0.11, fill: '#ffa800' },
    { x: 0.72, y: 0.7, r: 0.11, fill: '#faef82' },
    { x: 0.28, y: 0.71, r: 0.11, fill: '#fafbc1' },
  ] as const;

  let w = $state(0);
  let h = $state(0);

  function measure() {
    w = window.innerWidth;
    h = window.innerHeight;
  }

  onMount(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  });

  /*
   * Blob geometry in viewBox units, which equal pixels because the viewBox is
   * the viewport's own size. The radii scale off the smaller dimension so the
   * cluster keeps its proportions on both a wide desktop and a tall phone.
   */
  const unit = $derived(Math.min(w, h));
</script>

<!--
  Fixed to the viewport behind every layer. `pointer-events: none` comes from
  the `.wash` rule in index.css, so it never intercepts a click meant for the
  page. The viewBox tracks the viewport's pixel size, which is what keeps the
  blur a true 200px — see the rationale in the script above.
-->
{#if w > 0 && h > 0}
  <svg
    class="wash"
    aria-hidden="true"
    focusable="false"
    width={w}
    height={h}
    viewBox="0 0 {w} {h}"
  >
    <defs>
      <!--
        The filter region is padded well past the shapes so the blur has room
        to spread; the default region clips a 200px blur back to each circle's
        own bounds and the blobs would end in hard cutoffs.
      -->
      <filter id="wash-blur" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation={BLUR} />
      </filter>
    </defs>

    <g filter="url(#wash-blur)">
      {#each BLOBS as blob}
        <circle
          cx={blob.x * w}
          cy={blob.y * h}
          r={blob.r * unit}
          fill={blob.fill}
        />
      {/each}
    </g>
  </svg>
{/if}
