// ==========================================================================
// FUZZY TEXT — vanilla TypeScript port of the React Bits "FuzzyText"
// component (same algorithm, same tuning knobs, zero dependencies).
//
// Applies the effect to the hero <h1> name ([data-fuzzy-name]). The
// original DOM text stays in the page (visually hidden, still read by
// screen readers and indexed by search engines) and the canvas is
// aria-hidden — so the name exists exactly once as far as users,
// assistive tech and crawlers are concerned.
//
// Deviations from the React original — each one required by this
// project's own integration rules (accessibility / performance):
//   • devicePixelRatio scaling: the React version rasterises at 1x and
//     looks blurry on retina. Here the text canvas is DPR-sharp.
//   • prefers-reduced-motion: reduce → the effect never initialises;
//     users see the plain DOM name (green dot included), zero motion.
//   • Hover uses mouse events only. The React version's touchmove +
//     preventDefault() blocks page scrolling when a finger starts on
//     the name — unacceptable for a hero, so touch keeps normal scroll.
//   • The rAF loop pauses when the canvas scrolls offscreen or the tab
//     is hidden; single animation loop, fully cleaned up on teardown.
//   • Re-initialises on real size changes (clamp() font-size steps
//     between breakpoints) and on theme toggle (ink/accent tokens
//     flip) — debounced, skipped when nothing actually changed.
//   • Green dot: canvas can only fill a whole string in one pass, so
//     after rasterising, a 'source-atop' composite tints ONLY the
//     measured dot rows of the final "i" with --color-accent. The
//     boundary is measured from the actual rendered pixels (works at
//     any size/weight/theme), not hardcoded. The invisible admin
//     trigger (5 clicks → /admin) is repositioned over the canvas dot;
//     the trigger script itself is untouched.
// ==========================================================================

interface FuzzyTextOptions {
  fontWeight?: string | number;   // default: computed from the host element
  fontFamily?: string;            // default: computed ("inherit" behaviour)
  color?: string;                 // default: computed --color-ink
  enableHover?: boolean;          // default: true
  baseIntensity?: number;         // default: 0.06
  hoverIntensity?: number;        // default: 0.35
  fuzzRange?: number;             // default: 10 (px)
  fps?: number;                   // default: 30 — plenty at this subtlety
  direction?: "horizontal" | "vertical" | "both";
  transitionDuration?: number;    // default: 150 (ms)
}

const EXTRA_WIDTH_BUFFER = 10;

type Ctx2D = CanvasRenderingContext2D & { letterSpacing?: string };

function setLetterSpacing(ctx: Ctx2D, value: string): void {
  try {
    ctx.letterSpacing = value;
  } catch {
    /* browser without canvas letterSpacing — negligible visual diff */
  }
}

function initFuzzyText(host: HTMLElement, opts: FuzzyTextOptions = {}) {
  const {
    fontWeight = "",
    fontFamily = "inherit",
    color = "",
    enableHover = true,
    baseIntensity = 0.06,
    hoverIntensity = 0.35,
    fuzzRange = 10,
    fps = 30,
    direction = "horizontal",
    transitionDuration = 150,
  } = opts;

  const computed = getComputedStyle(host);
  const weight = fontWeight === "" ? computed.fontWeight : String(fontWeight);
  const family = fontFamily === "inherit" ? computed.fontFamily : fontFamily;
  const ink = color === "" ? computed.color : color;
  const accent =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--color-accent")
      .trim() || ink;
  const fontSizePx = parseFloat(computed.fontSize);

  // Site-specific: the green dot lives on the FINAL "i". If the name
  // ever stops ending in "i" (admin edit), the tint + trigger overlay
  // simply don't happen — same graceful rule as the DOM version.
  const rawText = host.textContent ?? "";
  const text = rawText.replace(/\u2060/g, ""); // strip the word-joiner
  const nameEndsWithI = text.endsWith("i");

  const canvas = document.createElement("canvas");
  canvas.className = "fuzzy-canvas";
  canvas.setAttribute("aria-hidden", "true");

  // Wrapper: positioned anchor for the reparented admin-dot target.
  const wrap = document.createElement("span");
  wrap.className = "fuzzy-canvas-host";
  wrap.setAttribute("aria-hidden", "true");
  wrap.appendChild(canvas);

  // The invisible admin trigger moves from the DOM name into the
  // canvas wrapper; moving a node keeps its listeners (adminTrigger.ts
  // attached them to this same node, in any import order).
  const dotTarget = host.querySelector<HTMLElement>("[data-admin-dot]");

  let disposed = false;
  let rafId = 0;
  let running = false;
  let inView = true;
  let isHovering = false;
  let lastFrameTime = 0;
  let currentIntensity = baseIntensity;

  // Geometry shared with the render loop / trigger positioning.
  let offW = 0;
  let tightH = 0;
  let horizontalMargin = 0;
  let dpr = 1;
  let dotCenterX = 0;
  let dotTopY = 0;
  let gapMidY = 0;

  const offscreen = document.createElement("canvas");
  const offCtx = offscreen.getContext("2d", {
    willReadFrequently: true,
  }) as Ctx2D | null;
  const ctx = canvas.getContext("2d") as Ctx2D | null;
  if (!ctx || !offCtx) return () => {};

  const frameDuration = 1000 / fps;

  // Rasterise the name once at device resolution, tint the dot, measure
  // everything. Resolves true when the canvas is ready to animate.
  const rasterize = (): Promise<boolean> => {
    const fontString = `${weight} ${fontSizePx}px ${family}`;

    // Wait for the real font: measuring with a fallback would misplace
    // the dot tint and the trigger target.
    return document.fonts
      .load(fontString, text)
      .catch(() => document.fonts.ready)
      .then(() => {
        if (disposed) return false;

        setLetterSpacing(offCtx, computed.letterSpacing);
        offCtx.font = fontString;
        offCtx.textBaseline = "alphabetic";

        const metrics = offCtx.measureText(text);
        const actualLeft = metrics.actualBoundingBoxLeft ?? 0;
        const actualRight = metrics.actualBoundingBoxRight ?? metrics.width;
        const actualAscent = metrics.actualBoundingBoxAscent ?? fontSizePx;
        const actualDescent =
          metrics.actualBoundingBoxDescent ?? fontSizePx * 0.2;

        const textBoundingWidth = Math.ceil(actualLeft + actualRight);
        tightH = Math.ceil(actualAscent + actualDescent);
        offW = textBoundingWidth + EXTRA_WIDTH_BUFFER;
        const xOffset = EXTRA_WIDTH_BUFFER / 2;

        // Retina-crisp: backing store at device resolution, drawing in
        // CSS px (the React original rasterises at 1x and blurs).
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        offscreen.width = Math.ceil(offW * dpr);
        offscreen.height = Math.ceil(tightH * dpr);
        offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        offCtx.clearRect(0, 0, offW, tightH);
        setLetterSpacing(offCtx, computed.letterSpacing);
        offCtx.font = fontString;
        offCtx.textBaseline = "alphabetic";
        offCtx.fillStyle = ink;
        offCtx.fillText(text, xOffset - actualLeft, actualAscent);

        // Locate the final "i" glyph's ink in the raster: scan a window
        // around its prefix-advance position for inked columns.
        let iRun: { x0: number; x1: number } | null = null;
        let rows: { dotTop: number; dotBottom: number; stemTop: number } | null =
          null;

        if (nameEndsWithI) {
          const prefixW = offCtx.measureText(text.slice(0, -1)).width;
          const advX = (xOffset - actualLeft + prefixW) * dpr;
          const searchX0 = Math.max(0, Math.floor(advX - fontSizePx * 0.3 * dpr));
          const searchX1 = Math.min(
            offscreen.width,
            Math.ceil(advX + fontSizePx * 0.75 * dpr)
          );
          const img = offCtx.getImageData(
            searchX0,
            0,
            searchX1 - searchX0,
            offscreen.height
          );
          const { data, width } = img;

          const colHasInk: boolean[] = new Array(width).fill(false);
          for (let x = 0; x < width; x++) {
            for (let y = 0; y < offscreen.height; y++) {
              if (data[(y * width + x) * 4 + 3] > 8) {
                colHasInk[x] = true;
                break;
              }
            }
          }
          // The "i" is the LAST glyph, so it is the RIGHTMOST inked
          // column block in the search window (nothing is painted to its
          // right). Picking the largest block would wrongly grab the
          // tail of the previous letter ("r" is wider than "i").
          let best0 = -1;
          let best1 = -1;
          let cur0 = -1;
          for (let x = 0; x <= width; x++) {
            if (x < width && colHasInk[x]) {
              if (cur0 === -1) cur0 = x;
            } else if (cur0 !== -1) {
              best0 = cur0;
              best1 = x;
              cur0 = -1;
            }
          }
          if (best0 !== -1) {
            iRun = { x0: searchX0 + best0, x1: searchX0 + best1 };

            // Inked rows within the glyph → dot block, gap, stem block.
            const rowHasInk: boolean[] = [];
            for (let y = 0; y < offscreen.height; y++) {
              let inked = false;
              for (let x = best0; x < best1; x++) {
                if (data[(y * width + x) * 4 + 3] > 8) {
                  inked = true;
                  break;
                }
              }
              rowHasInk[y] = inked;
            }
            const blocks: Array<[number, number]> = [];
            let start = -1;
            for (let y = 0; y <= offscreen.height; y++) {
              if (y < offscreen.height && rowHasInk[y]) {
                if (start === -1) start = y;
              } else if (start !== -1) {
                blocks.push([start, y]);
                start = -1;
              }
            }
            if (blocks.length >= 2) {
              const dot = blocks[0];
              const stem = blocks[blocks.length - 1];
              rows = { dotTop: dot[0], dotBottom: dot[1], stemTop: stem[0] };
            }
          }

          // Green dot tint: fill the accent colour over the dot rows
          // only, clipped to existing ink ('source-atop'). Boundary =
          // midpoint of the measured dot/stem gap → exact at any size.
          if (rows && iRun) {
            const gapMid = (rows.dotBottom + rows.stemTop) / 2;
            offCtx.save();
            offCtx.globalCompositeOperation = "source-atop";
            offCtx.fillStyle = accent;
            offCtx.fillRect(iRun.x0 - 1, 0, iRun.x1 - iRun.x0 + 2, gapMid);
            offCtx.restore();
          }
        }

        // Canvas geometry. Horizontal margin: just enough headroom for
        // the actual fuzz displacement (intensity × ½ × fuzzRange) —
        // the React default (fuzzRange + 20 = 30px) is sized for full-
        // blast glitch mode and would shove the name 30px right of its
        // true position. Vertical margin stays 0 for horizontal fuzz
        // (row shifts are horizontal; dy stays 0).
        horizontalMargin =
          Math.ceil(Math.max(hoverIntensity, baseIntensity) * 0.5 * fuzzRange) + 2;
        const verticalMargin =
          direction === "vertical" || direction === "both" ? fuzzRange + 10 : 0;

        const canvasW = offW + horizontalMargin * 2;
        const canvasH = tightH + verticalMargin * 2;
        canvas.width = Math.ceil(canvasW * dpr);
        canvas.height = Math.ceil(canvasH * dpr);
        canvas.style.width = `${canvasW}px`;
        canvas.style.height = `${canvasH}px`;
        // Draw in CSS px while the backing store stays device-sharp.
        ctx.setTransform(
          dpr,
          0,
          0,
          dpr,
          horizontalMargin * dpr,
          verticalMargin * dpr
        );

        // Trigger target geometry (CSS px, relative to the wrapper):
        // centred on the stem, spanning the dot zone, at least 22px —
        // mirrors the DOM target's "bigger than the dot" sizing rule.
        if (rows && iRun && dotTarget) {
          gapMidY = (rows.dotBottom + rows.stemTop) / 2 / dpr;
          // iRun coords are ABSOLUTE offscreen pixels (the search window
          // already includes the text origin) — add only the canvas
          // margin, not the text origin again.
          dotCenterX = horizontalMargin + (iRun.x0 + iRun.x1) / 2 / dpr;
          dotTopY = verticalMargin + rows.dotTop / dpr;
          const stemW = (iRun.x1 - iRun.x0) / dpr;
          const tW = Math.max(22, stemW * 2.2);
          const tH = Math.max(22, (gapMidY - dotTopY) * 1.35);
          // CSS px relative to the WRAPPER: canvas offset inside the
          // wrapper is 0 (wrapper hugs the canvas), so canvas-space x/y
          // measured from the text box need the fuzz margins added —
          // done above. top is relative to canvas top (wrapper top).
          dotTarget.style.top = `${verticalMargin + dotTopY - tH * 0.15}px`;
          dotTarget.style.left = `${dotCenterX}px`;
          dotTarget.style.width = `${tW}px`;
          dotTarget.style.height = `${tH}px`;
        }

        return true;
      });
  };

  // ---------- render loop (React original: identical fuzz math) -------
  const render = (timestamp: number) => {
    if (disposed || !running) return;
    rafId = requestAnimationFrame(render);

    if (timestamp - lastFrameTime < frameDuration) return;
    lastFrameTime = timestamp;

    const target = isHovering ? hoverIntensity : baseIntensity;
    if (transitionDuration > 0) {
      const step = 1 / (transitionDuration / frameDuration);
      if (currentIntensity < target) {
        currentIntensity = Math.min(currentIntensity + step, target);
      } else if (currentIntensity > target) {
        currentIntensity = Math.max(currentIntensity - step, target);
      }
    } else {
      currentIntensity = target;
    }

    ctx.clearRect(
      -fuzzRange - 20,
      -fuzzRange - 10,
      offW + 2 * (fuzzRange + 20),
      tightH + 2 * (fuzzRange + 10)
    );

    // Row-shuffle blit — the core FuzzyText effect. Source rows are
    // mapped proportionally so fractional DPRs leave no gaps.
    const srcRows = offscreen.height / tightH;
    for (let j = 0; j < tightH; j++) {
      let dx = 0;
      let dy = 0;
      if (direction === "horizontal" || direction === "both") {
        dx = Math.floor(currentIntensity * (Math.random() - 0.5) * fuzzRange);
      }
      if (direction === "vertical" || direction === "both") {
        dy = Math.floor(currentIntensity * (Math.random() - 0.5) * fuzzRange * 0.5);
      }
      ctx.drawImage(
        offscreen,
        0,
        j * srcRows,
        offscreen.width,
        srcRows,
        dx,
        j + dy,
        offW,
        1
      );
    }
  };

  const start = () => {
    if (running || disposed || !inView || document.hidden) return;
    running = true;
    lastFrameTime = 0;
    rafId = requestAnimationFrame(render);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(rafId);
  };

  // ---------- events / observers --------------------------------------
  const onMove = (e: MouseEvent) => {
    if (!enableHover) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // Interactive zone = the text box inside the fuzz margins
    // (React original: identical bounds math).
    isHovering =
      x >= horizontalMargin &&
      x <= horizontalMargin + (offW - EXTRA_WIDTH_BUFFER) &&
      y >= 0 &&
      y <= tightH;
  };
  const onLeave = () => {
    isHovering = false;
  };
  const onVisibility = () => {
    if (document.hidden) stop();
    else start();
  };

  const io = new IntersectionObserver(
    (entries) => {
      inView = entries.some((en) => en.isIntersecting);
      if (inView) start();
      else stop();
    },
    { threshold: 0 }
  );

  if (enableHover) {
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);
  }
  document.addEventListener("visibilitychange", onVisibility);
  io.observe(canvas);

  const destroy = () => {
    if (disposed) return;
    disposed = true;
    stop();
    io.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    if (enableHover) {
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
    }
    if (dotTarget) {
      // Restore the trigger to its original home in the DOM name.
      for (const key of ["top", "left", "width", "height"]) {
        dotTarget.style.removeProperty(key);
      }
      dotTarget.parentElement?.removeChild(dotTarget);
      host.querySelector(".idot-wrap")?.appendChild(dotTarget);
    }
    wrap.remove();
    host.classList.remove("fuzzy-active");
    // Leave canvas mode only if no replacement instance is about to
    // mount (theme/resize re-init). Deferred check avoids a flash of
    // the DOM name between teardown and the new canvas.
    setTimeout(() => {
      if (!document.querySelector("canvas.fuzzy-canvas")) {
        document.documentElement.classList.remove("fuzzy-on");
      }
    }, 300);
  };

  // ---------- boot ----------------------------------------------------
  rasterize().then((ok) => {
    if (!ok || disposed) return;
    host.classList.add("fuzzy-active");
    // CSS gate for canvas mode (see adminTrigger.css).
    document.documentElement.classList.add("fuzzy-on");
    // The canvas takes the name's inline spot: inserted into the h1
    // AFTER the (now out-of-flow) name span, baseline-aligned, so the
    // h1's first line box is unchanged. Appending INSIDE the host
    // would park it inside the hidden span — invisible.
    const parent = host.parentElement;
    if (parent) {
      if (host.nextSibling) parent.insertBefore(wrap, host.nextSibling);
      else parent.appendChild(wrap);
    } else {
      host.appendChild(wrap);
    }
    if (dotTarget) wrap.appendChild(dotTarget);
    inView = true;
    start();
  });

  return destroy;
}

// ==========================================================================
// Mount: hero name only. Skips entirely under prefers-reduced-motion
// (plain DOM name, green dot, zero motion) and when anything is missing.
// ==========================================================================

function mount(): () => void {
  const host = document.querySelector<HTMLElement>("[data-fuzzy-name]");
  if (!host || host.dataset.fuzzyMounted === "true") return () => {};
  host.dataset.fuzzyMounted = "true";

  let destroy = initFuzzyText(host);

  // Re-initialise on real size changes (clamp() steps between
  // breakpoints) — debounced, skipped for trivial resize noise
  // (mobile URL-bar show/hide changes height, not the name's width).
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let lastW = host.getBoundingClientRect().width;
  const teardown = () => {
    destroy();
    destroy = initFuzzyText(host);
  };

  // Resize: re-rasterise only when the name's width really changed
  // (clamp() steps between breakpoints; ignores mobile URL-bar noise).
  const onResize = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const w = host.getBoundingClientRect().width;
      if (Math.abs(w - lastW) < 2) return;
      lastW = w;
      teardown();
    }, 150);
  };
  window.addEventListener("resize", onResize);

  // Theme toggle flips --color-ink / --color-accent on <html>: the
  // canvas must re-rasterise so it keeps following the tokens. React
  // only to real `light`-class flips — our own fuzzy-on toggles also
  // mutate <html>'s class, and reacting to those would loop forever.
  let lastLight = document.documentElement.classList.contains("light");
  const themeObserver = new MutationObserver(() => {
    const nowLight = document.documentElement.classList.contains("light");
    if (nowLight === lastLight) return;
    lastLight = nowLight;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(teardown, 150);
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });

  return () => {
    window.removeEventListener("resize", onResize);
    themeObserver.disconnect();
    destroy();
  };
}

if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
}
