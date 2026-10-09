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
    // Painted back to front: the cool hues come last so they are not buried
    // under the warm ones. Drawn in the opposite order every overlap averaged
    // toward amber and the blues, purples and pinks disappeared entirely —
    // measured, the whole cluster collapsed into a 0-54° band where the
    // reference spans 220-353°.
    //
    // Warm back layer — ambers and the pale yellows, upper and lower bands.
    { x: 0.46, y: 0.35, r: 0.1, fill: '#ffa800' },
    { x: 0.5, y: 0.64, r: 0.09, fill: '#faef82' },
    { x: 0.59, y: 0.62, r: 0.08, fill: '#fafbc1' },
    { x: 0.55, y: 0.33, r: 0.09, fill: '#f99987' },
    // Mid layer — the two darks and the green.
    { x: 0.58, y: 0.4, r: 0.09, fill: '#511e1e' },
    { x: 0.54, y: 0.52, r: 0.08, fill: '#9dde32' },
    { x: 0.45, y: 0.47, r: 0.09, fill: '#4e7248' },
    // Cool front layer — the blues and the purple, reading where the reference
    // puts them: one up the left of the cluster, one at its heart.
    { x: 0.41, y: 0.42, r: 0.11, fill: '#6c94fc' },
    { x: 0.37, y: 0.48, r: 0.1, fill: '#6100ff' },
  ] as const;

  /**
   * The wash is drawn at full opacity.
   *
   * An earlier attempt dimmed it with `opacity` on the SVG, and that is the
   * wrong lever: blending a saturated hue toward black at low opacity costs
   * chroma along with lightness. Measured at opacity 0.3 the cluster's mean
   * saturation was 0.07 where the reference sits at 0.23.
   *
   * The brightness is set by the blob radii instead — at full opacity a radius
   * of ~0.12 of the viewport's short side lands the field's peak value at 0.20
   * against the reference's 0.24, with the chroma already in the right range.
   */
  const OPACITY = 1;

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
