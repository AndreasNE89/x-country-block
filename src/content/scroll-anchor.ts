// Keeps the post the user is reading in place when cards above it collapse or reappear.
// X lays its timeline out asynchronously (cells are positioned with translateY and moved after
// X re-measures), so the shift is measured, not predicted, and corrected over a few frames.
// The browser (CSS scroll anchoring) or X may already hold the view, and the user may be
// scrolling at the same time, so only the part of the move that neither explains is corrected.

export type Anchor = {
  el: HTMLElement;
  /** Scrolling ancestor, or null for the window. */
  scroller: HTMLElement | null;
  /** On-screen position (from the top of the scroller or window) at the last check. */
  top: number;
  /** Position in the scrolled content at the last check: stays put while anyone scrolls, moves on layout shifts. */
  offset: number;
};

type Raf = (cb: () => void) => unknown;

export function scrollerFor(el: HTMLElement, win: Window): HTMLElement | null {
  const doc = el.ownerDocument;
  for (let node = el.parentElement; node && node !== doc.body && node !== doc.documentElement; node = node.parentElement) {
    const overflow = win.getComputedStyle(node).overflowY;
    if ((overflow === "auto" || overflow === "scroll") && node.scrollHeight > node.clientHeight) return node;
  }
  return null;
}

function viewTop(scroller: HTMLElement | null): number {
  return scroller ? scroller.getBoundingClientRect().top : 0;
}

function viewBottom(scroller: HTMLElement | null, win: Window): number {
  return scroller ? scroller.getBoundingClientRect().bottom : win.innerHeight;
}

function scrollPos(scroller: HTMLElement | null, win: Window): number {
  return scroller ? scroller.scrollTop : win.scrollY;
}

/** Whether a box starts above the bottom edge of the visible area (so changing it can shift what is seen). */
export function startsAboveViewBottom(box: HTMLElement, scroller: HTMLElement | null, win: Window): boolean {
  return box.getBoundingClientRect().top < viewBottom(scroller, win);
}

/** The top-most box that starts inside the visible area and is not itself about to change. */
export function captureAnchor(
  boxes: HTMLElement[],
  changing: Set<HTMLElement>,
  scroller: HTMLElement | null,
  win: Window,
): Anchor | null {
  const top = viewTop(scroller);
  const bottom = viewBottom(scroller, win);
  let best: { el: HTMLElement; top: number } | null = null;
  for (const box of boxes) {
    if (changing.has(box)) continue;
    const rect = box.getBoundingClientRect();
    if (rect.height <= 0 || rect.top < top || rect.top >= bottom) continue;
    if (!best || rect.top < best.top) best = { el: box, top: rect.top };
  }
  if (!best) return null;
  const onScreen = best.top - top;
  return { el: best.el, scroller, top: onScreen, offset: onScreen + scrollPos(scroller, win) };
}

/**
 * Scroll back the part of the anchor's on-screen move that a layout shift caused, since the last
 * check. `moved` is how far it moved on screen, `shifted` how far it moved in the content. When
 * the browser or X already scrolled to compensate, moved is 0: nothing to do. When the user
 * scrolled, shifted is 0: not ours to undo. Correcting only what both agree on (same direction,
 * the smaller amount) never doubles a compensation and never reverts the user's scroll.
 * Returns the correction applied.
 */
export function restoreAnchor(anchor: Anchor, win: Window): number {
  if (!anchor.el.isConnected) return 0;
  const top = anchor.el.getBoundingClientRect().top - viewTop(anchor.scroller);
  const offset = top + scrollPos(anchor.scroller, win);
  const moved = top - anchor.top;
  const shifted = offset - anchor.offset;
  anchor.offset = offset;
  anchor.top = top;
  if (Math.sign(moved) !== Math.sign(shifted)) return 0;
  const correction = Math.sign(moved) * Math.min(Math.abs(moved), Math.abs(shifted));
  if (Math.abs(correction) < 1) return 0;
  if (anchor.scroller) anchor.scroller.scrollTop += correction;
  else win.scrollBy(0, correction);
  anchor.top = top - correction;
  return correction;
}

/**
 * Correct now and on the next few frames, while X re-positions its cells. X moves them from a
 * ResizeObserver, which runs after this frame's animation callbacks; an observer on the `resized`
 * boxes, created after X's, runs after it in the same frame, so the post is held before paint.
 */
export function holdAnchor(anchor: Anchor, win: Window, raf: Raf, frames = 4, resized: HTMLElement[] = []): void {
  restoreAnchor(anchor, win);
  const Observer = (win as Window & { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
  let observer: ResizeObserver | null = null;
  if (typeof Observer === "function" && resized.length > 0 && frames > 0) {
    observer = new Observer(() => restoreAnchor(anchor, win));
    for (const box of resized) observer.observe(box);
  }
  let left = frames;
  const tick = (): void => {
    restoreAnchor(anchor, win);
    left -= 1;
    if (left > 0) raf(tick);
    else observer?.disconnect();
  };
  if (left > 0) raf(tick);
}
