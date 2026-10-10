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
   * (x 0.31-0.71, y 0.29-0.75) and nothing reaches the corners. That box rides
   * a little high and left of centre, so the offsets between the blobs are the
   * measurement while the field's mass is re-centred on the viewport at render
   * time — see `shift` below. Only the placement is corrected; the cluster's
   * internal spacing and its scale stay as the reference has them.
   *
   * The radii are small because the 200px blur does the work. A Gaussian spreads
   * a shape's energy over a wider area, so the peak lightness at the core falls
   * as the blur grows and a small source is all that is needed to reach the
   * reference's dim band: at sigma=200 a radius of ~0.08 of the short side
   * already lands the field's peak value near 0.23 against the reference's 0.24.
   * Going smaller than this starts costing saturation, which is the one thing
   * the reference does keep.
   */
  const BLOBS = [
    // Painted back to front: the cool hues come last so they are not buried
    // under the warm ones. Drawn in the opposite order every overlap averaged
    // toward amber and the blues, purples and pinks disappeared entirely —
    // measured, the whole cluster collapsed into a 0-54° band where the
    // reference spans 220-353°.
    //
    // Warm back layer — ambers and the pale yellows, upper and lower bands.
    { x: 0.46, y: 0.35, r: 0.05, fill: '#ffa800' },
    { x: 0.5, y: 0.64, r: 0.0454, fill: '#faef82' },
    { x: 0.59, y: 0.62, r: 0.04, fill: '#fafbc1' },
    { x: 0.55, y: 0.33, r: 0.0454, fill: '#f99987' },
    // Mid layer — the two darks and the green.
    { x: 0.58, y: 0.4, r: 0.0454, fill: '#511e1e' },
    { x: 0.54, y: 0.52, r: 0.04, fill: '#9dde32' },
    { x: 0.45, y: 0.47, r: 0.0454, fill: '#4e7248' },
    // Cool front layer — the blues and the purple, reading where the reference
    // puts them: one up the left of the cluster, one at its heart.
    { x: 0.41, y: 0.42, r: 0.0554, fill: '#6c94fc' },
    { x: 0.37, y: 0.48, r: 0.05, fill: '#6100ff' },
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

  /**
   * How far past its source a stdDeviation-200 Gaussian still carries colour —
   * roughly three sigma, so ~600px, rounded up. Both the SVG's box and its
   * filter region are padded by this many pixels on every side, so the blur
   * fades out fully inside both instead of being clipped hard at their edges:
   * the box's own viewport would otherwise crop the halo of any blob that
   * reaches the edge of the screen, which on a phone is most of the cluster.
   */
  const PAD = 700;

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
   * Blob geometry in viewBox units, which equal viewport pixels because the
   * viewBox is the viewport's own size with PAD of margin around it, its origin
   * sitting on the viewport's top-left corner (see the .wash rule in
   * index.css). The radii scale off the smaller dimension so the cluster keeps
   * its proportions on both a wide desktop and a tall phone.
   */
  const unit = $derived(Math.min(w, h));

  /*
   * The cluster's centre of mass in viewport pixels, and the translation that
   * puts it on the viewport's. The blobs are laid out relative to the design
   * reference, which rides a little high and left of the middle; this
   * re-centres the field without touching the relative layout.
   *
   * Mass, not bounding box. The blur is a symmetric spread, so what it carries
   * outward is the field's first moment: the blobs' centres weighted by their
   * areas. Centring that puts the wash's heart on the middle of the screen.
   * Centring the ink's bounding box instead is a few dozen pixels off, because
   * the reference does not spread its blobs evenly inside their box — its mass
   * sits high of the middle, measured at 47% of the height, which is the part
   * the eye reads as the wash hanging towards the top of the page.
   *
   * Weighted by area (radius squared) and not by chroma: a chroma weighting
   * would tilt the field toward the single most saturated blob, the #6100ff,
   * which is one hue's opinion of where the middle is.
   *
   * Every radius is a fraction of the same unit, so that unit cancels out of
   * the weighting and the mass keeps fixed fractions of the viewport —
   * currently 0.0168w right and 0.0398h down, unchanged from a 390px phone to
   * a 2560px display. (A bounding-box centring is the opposite: its radii scale
   * off the short side while its positions scale off the axis they sit on, so
   * the box's fractions do move with the shape of the screen.) The shift is
   * still measured rather than hard-coded, so it follows the blob list: nudge
   * one position or radius and the field re-centres itself.
   *
   * The numbers are small next to PAD, so the translated blobs stay well inside
   * the filter region and their halos still die out before it.
   */
  const shift = $derived.by(() => {
    // A blob's mass is its area, and every radius is a fraction of the same
    // unit, so r² is the weight with the shared factor cancelled out.
    let mass = 0;
    let mx = 0;
    let my = 0;

    for (const blob of BLOBS) {
      const m = blob.r * blob.r;
      mass += m;
      mx += blob.x * w * m;
      my += blob.y * h * m;
    }

    return {
      x: w / 2 - mx / mass,
      y: h / 2 - my / mass
    };
  });
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
    width={w + PAD * 2}
    height={h + PAD * 2}
    viewBox="{-PAD} {-PAD} {w + PAD * 2} {h + PAD * 2}"
    opacity={OPACITY}
    style="--wash-pad: {PAD}px"
  >
    <defs>
      <!--
        The filter region is expressed in user space — pixels, since a user unit
        is a viewport pixel — and spans the padded box, leaving PAD of room past
        every blob for the blur to die out in.
        A percentage region is relative to the cluster's own bounding box, which
        is the wrong yardstick here: on a 390px phone that box is ~120px wide,
        so x/width of -60%/220% left the blur under a third of a sigma to spread
        in and cropped every halo into a hard-edged circle.
      -->
      <filter
        id="wash-blur"
        filterUnits="userSpaceOnUse"
        x={-PAD}
        y={-PAD}
        width={w + PAD * 2}
        height={h + PAD * 2}
      >
        <feGaussianBlur stdDeviation={BLUR} />
      </filter>
    </defs>

    <!--
      The shift centres the cluster's mass on the viewport — see the rationale
      above. It rides on the group rather than the circles so the nine
      positions in BLOBS stay exactly as the reference measures them.
    -->
    <g filter="url(#wash-blur)" transform={`translate(${shift.x} ${shift.y})`}>
      {#each BLOBS as blob, i (i)}
        <!--
          No PAD here: the box is offset off-screen by PAD while the viewBox
          keeps its origin at the viewport's top-left corner, so a user unit is
          already a viewport pixel without any correction. Adding PAD to these
          two lines is the double-count that once pushed the whole cluster off
          the right edge and below the fold.
        -->
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
