// ==========================================================================
// SCROLL REVEAL — progressive enhancement, ~20 lines, zero dependencies.
// --------------------------------------------------------------------------
// Elements marked [data-reveal] fade+rise in once when they enter the
// viewport. Uses the browser's native IntersectionObserver (no scroll
// handlers, no libraries). Honors prefers-reduced-motion: under "reduce"
// nothing is observed, so elements just stay visible.
//
// Safety net: the hidden state only exists under html.js (set by the tiny
// inline script in BaseLayout), so without JS everything is simply visible.
// ==========================================================================

const elements = document.querySelectorAll<HTMLElement>("[data-reveal]");

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

// Reduced motion (or ancient browser): skip entirely — content stays as-is.
if (!prefersReducedMotion && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target); // reveal once — never re-animate
        }
      }
    },
    // Fire as the element's top edge reaches ~88% of the viewport height —
    // responsive rather than late. threshold: 0 (not a visibility ratio)
    // so tall sections still trigger reliably on short mobile screens.
    { threshold: 0, rootMargin: "0px 0px -12% 0px" }
  );

  for (const el of elements) observer.observe(el);
}
