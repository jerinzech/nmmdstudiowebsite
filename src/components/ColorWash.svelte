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
   * Blob positions, as fractions of the viewport, and radii as fractions of its
   * smaller dimension.
   *
   * Both the cluster and its scale come from the design reference. Measured off
   * that image, every colour sits inside a tight box around the middle
   * (x 0.31-0.71, y 0.29-0.75) and nothing reaches the corners.
   *
   * The radii are small for the same reason the wash is dim: a Gaussian blur
   * spreads a shape's energy, so a lighter peak needs a smaller source. At
   * sigma=200 a 250px-radius blob holds ~50% of its solid value and reads as a
   * strong colour; these sit at roughly 0.14-0.17 of the short side, which is
   * what lands the field in the reference's band.
   */
  const BLOBS = [
    // Upper band — the warm ambers, sitting above the middle.
    { x: 0.5, y: 0.36, r: 0.17, fill: '#ffa800' },
    { x: 0.58, y: 0.35, r: 0.16, fill: '#f99987' },
    { x: 0.6, y: 0.41, r: 0.15, fill: '#511e1e' },
    // Middle — the cool blues and the green, the densest part of the cluster.
    { x: 0.4, y: 0.42, r: 0.17, fill: '#6c94fc' },
    { x: 0.37, y: 0.49, r: 0.16, fill: '#6100ff' },
    { x: 0.45, y: 0.49, r: 0.15, fill: '#4e7248' },
    { x: 0.58, y: 0.5, r: 0.14, fill: '#9dde32' },
    // Lower band — the pale yellows, trailing under the cluster.
    { x: 0.58, y: 0.65, r: 0.15, fill: '#faef82' },
    { x: 0.66, y: 0.63, r: 0.14, fill: '#fafbc1' },
  ] as const;

  /**
   * Overall dimmer for the wash.
   *
   * The reference background is far darker than full-strength colour: its
   * brightest point measures a value of ~0.25 against a near-black surround,
   * where a saturated blob at full opacity would sit near 1.0. Rather than
   * shrink the blobs to nothing, they keep their size and the whole group is
   * held down to that level.
   */
  const OPACITY = 0.3;

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
    opacity={OPACITY}
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
      {#each BLOBS as blob, i (i)}
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
