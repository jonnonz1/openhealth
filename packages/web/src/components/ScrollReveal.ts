/**
 * Scroll-triggered reveal. Adds `.is-visible` to any element with
 * `[data-reveal]` when it enters the viewport. Staggering + easing live in
 * CSS — this file only flips the class. Respects `prefers-reduced-motion`.
 */
export function mountScrollReveal(root: ParentNode = document): void {
  const targets = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
  if (targets.length === 0) return;

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion || typeof IntersectionObserver === 'undefined') {
    for (const el of targets) el.classList.add('is-visible');
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.1 },
  );

  for (const el of targets) observer.observe(el);
}
