// Keeps the post the user is reading in place when cards above it collapse or reappear.
// X lays its timeline out asynchronously (cells are positioned with translateY and moved after
// X re-measures), so the shift is measured, not predicted, and corrected over a few frames.

export type Anchor = {
  el: HTMLElement;
  /** Scrolling ancestor, or null for the window. */
  scroller: HTMLElement | null;
  /** Position in the scrolled content: stays the same while the user scrolls, moves on layout shifts. */
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

function contentOffset(el: HTMLElement, scroller: HTMLElement | null, win: Window): number {
  return el.getBoundingClientRect().top - viewTop(scroller) + scrollPos(scroller, win);
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
  return { el: best.el, scroller, offset: best.top - top + scrollPos(scroller, win) };
}

/** Scroll by however far the anchor moved in the content. Returns the correction applied. */
export function restoreAnchor(anchor: Anchor, win: Window): number {
  if (!anchor.el.isConnected) return 0;
  const drift = contentOffset(anchor.el, anchor.scroller, win) - anchor.offset;
  if (Math.abs(drift) < 1) return 0;
  if (anchor.scroller) anchor.scroller.scrollTop += drift;
  else win.scrollBy(0, drift);
  anchor.offset += drift;
  return drift;
}

/** Correct now and on the next few frames, while X re-positions its cells. */
export function holdAnchor(anchor: Anchor, win: Window, raf: Raf, frames = 4): void {
  restoreAnchor(anchor, win);
  let left = frames;
  const tick = (): void => {
    restoreAnchor(anchor, win);
    left -= 1;
    if (left > 0) raf(tick);
  };
  if (left > 0) raf(tick);
}
