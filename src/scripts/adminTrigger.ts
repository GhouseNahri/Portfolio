// ==========================================================================
// HIDDEN ADMIN TRIGGER — 5 clicks on the "i" dot of "Nahri" in 3 seconds.
//
// This is a DOORBELL, not a lock: it only reveals the /admin page, which
// is fully protected by server-side authentication. Discovering the
// trigger gains nothing without valid credentials.
//
// Rules (as specified):
//   • exactly 5 clicks inside one 3-second window → go to /admin
//   • the window starts on the FIRST click; expiry resets the counter
//   • clicks anywhere else never count; no visual response on the page
//   • `click` covers both mouse and touch (browsers fire it on tap)
//   • passive listeners, tiny script, no layout work, no layout shift
//   • passive listeners, tiny script — ~500 bytes gzipped
//   • aria-hidden target — invisible to assistive tech by design (this
//     is a private door, not a public control; the trade-off was
//     accepted in the approved plan)
// ==========================================================================

const REQUIRED_CLICKS = 5;
const WINDOW_MS = 3000;

function init(): void {
  const target = document.querySelector<HTMLElement>("[data-admin-dot]");
  if (!target) return;

  let clicks = 0;
  let windowStart = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const reset = () => {
    clicks = 0;
    windowStart = 0;
    if (timer) clearTimeout(timer);
    timer = undefined;
  };

  target.addEventListener(
    "click",
    (event) => {
      // The target must be the first hit — clicks landing on other
      // elements bubble through the document, not into this listener.
      event.preventDefault();
      event.stopPropagation();
      const now = Date.now();
      if (clicks === 0 || now - windowStart > WINDOW_MS) {
        windowStart = now;
        clicks = 1;
        if (timer) clearTimeout(timer);
        timer = setTimeout(reset, WINDOW_MS);
        return;
      }
      clicks += 1;
      if (clicks >= REQUIRED_CLICKS) {
        reset();
        window.location.assign("/admin");
        return;
      }
    },
    { passive: false }
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
