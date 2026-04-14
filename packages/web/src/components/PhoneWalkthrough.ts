/**
 * Drives the animated-iPhone walkthrough in the `#how` section.
 *
 * Auto-advances through N screens on a timer, with iOS-flavoured transitions
 * between steps. Pauses on hover, advances on click, lets the step list
 * beside the phone jump to any screen. Respects `prefers-reduced-motion`.
 *
 * The mount function takes the section's host element and expects it to
 * contain a `.phone-frame[data-current]` and a set of elements with
 * `[data-step]` (both the in-phone `<img>`s and the side-list items +
 * progress dots). State is applied declaratively via data-attributes and
 * classes; the CSS does all the visual work.
 */

/** Sequence of transitions matching the Apple Health export flow. */
const TRANSITIONS: Readonly<Record<string, string>> = {
  '1->2': 'push-right',
  '2->3': 'scroll-down',
  '3->4': 'modal-up',
  '4->5': 'fade',
  '5->6': 'push-right',
  '6->1': 'fade',
};

export interface PhoneWalkthroughOptions {
  /** How long each screen stays before advancing. Default 3200 ms. */
  autoPlayMs?: number;
  /** Total number of steps. Default 6. */
  totalSteps?: number;
  /** Whether to loop back to step 1 after the last step. Default true. */
  loop?: boolean;
}

export interface PhoneWalkthrough {
  play(): void;
  pause(): void;
  jumpTo(step: number): void;
  current(): number;
  destroy(): void;
}

/**
 * Mount a phone walkthrough on the given host element. Returns a handle
 * for programmatic control; call `.destroy()` to tear down listeners.
 */
export function mountPhoneWalkthrough(
  host: HTMLElement,
  opts: PhoneWalkthroughOptions = {},
): PhoneWalkthrough {
  const autoPlayMs = opts.autoPlayMs ?? 3200;
  const totalSteps = opts.totalSteps ?? 6;
  const loop = opts.loop ?? true;

  const frame = host.querySelector<HTMLElement>('.phone-frame');
  const steps = host.querySelectorAll<HTMLElement>('.walkthrough-step');
  const dots = host.querySelectorAll<HTMLElement>('.walkthrough-dot');
  if (!frame) throw new Error('mountPhoneWalkthrough: .phone-frame not found');

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  let currentStep = 1;
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let paused = false;
  // Assume visible until an IntersectionObserver says otherwise. The first
  // IO callback will fire once the element is tracked; until then we start
  // playing (a few hundred ms of early animation is harmless, and this
  // keeps the component testable in environments where IO never fires).
  let inView = true;

  /** Apply state to the DOM. Called on every step change. */
  function render(from: number, to: number): void {
    const key = `${from}->${to}` as keyof typeof TRANSITIONS;
    const transition = TRANSITIONS[key] ?? 'fade';
    frame!.setAttribute('data-transition', transition);
    frame!.setAttribute('data-current', String(to));
    for (const el of steps) {
      el.classList.toggle('is-active', el.dataset['step'] === String(to));
    }
    for (const el of dots) {
      el.classList.toggle('is-active', el.dataset['step'] === String(to));
    }
  }

  function advance(): void {
    const next = currentStep === totalSteps ? (loop ? 1 : currentStep) : currentStep + 1;
    if (next === currentStep) {
      stopTimer();
      return;
    }
    render(currentStep, next);
    currentStep = next;
    scheduleNext();
  }

  function scheduleNext(): void {
    stopTimer();
    if (prefersReducedMotion || paused || !inView) return;
    timerId = setTimeout(advance, autoPlayMs);
  }

  function stopTimer(): void {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  function play(): void {
    paused = false;
    scheduleNext();
  }

  function pause(): void {
    paused = true;
    stopTimer();
  }

  function jumpTo(step: number): void {
    const target = Math.max(1, Math.min(totalSteps, Math.floor(step)));
    if (target === currentStep) return;
    render(currentStep, target);
    currentStep = target;
    scheduleNext();
  }

  /* ── DOM wiring ──────────────────────────────────────── */

  const onPointerEnter = (): void => pause();
  const onPointerLeave = (): void => play();
  const onFrameClick = (): void => advance();

  frame.addEventListener('pointerenter', onPointerEnter);
  frame.addEventListener('pointerleave', onPointerLeave);
  frame.addEventListener('click', onFrameClick);

  const stepClickHandlers: Array<[HTMLElement, () => void]> = [];
  const stepKeyHandlers: Array<[HTMLElement, (ev: KeyboardEvent) => void]> = [];

  const wireJumper = (el: HTMLElement): void => {
    const stepAttr = el.dataset['step'];
    if (!stepAttr) return;
    const step = Number(stepAttr);
    if (!Number.isFinite(step)) return;
    const onClick = (): void => jumpTo(step);
    el.addEventListener('click', onClick);
    stepClickHandlers.push([el, onClick]);
  };

  for (const el of steps) wireJumper(el);
  for (const el of dots) wireJumper(el);

  // Arrow-key navigation within the step tablist.
  for (const el of steps) {
    const onKey = (ev: KeyboardEvent): void => {
      const stepAttr = el.dataset['step'];
      if (!stepAttr) return;
      const step = Number(stepAttr);
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        jumpTo(step);
      } else if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') {
        ev.preventDefault();
        jumpTo(step === totalSteps ? 1 : step + 1);
        focusStep(currentStep);
      } else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        jumpTo(step === 1 ? totalSteps : step - 1);
        focusStep(currentStep);
      }
    };
    el.addEventListener('keydown', onKey);
    stepKeyHandlers.push([el, onKey]);
  }

  function focusStep(step: number): void {
    for (const el of steps) {
      if (el.dataset['step'] === String(step)) {
        el.focus();
        break;
      }
    }
  }

  /* ── Lifecycle (start when the section is in view) ───── */

  let observer: IntersectionObserver | null = null;
  if (typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          inView = entry.isIntersecting;
          if (inView) scheduleNext();
          else stopTimer();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(host);
  }

  // Initial render to step 1 (idempotent) and kick off playback.
  render(currentStep, currentStep);
  scheduleNext();

  return {
    play,
    pause,
    jumpTo,
    current: () => currentStep,
    destroy(): void {
      stopTimer();
      observer?.disconnect();
      frame.removeEventListener('pointerenter', onPointerEnter);
      frame.removeEventListener('pointerleave', onPointerLeave);
      frame.removeEventListener('click', onFrameClick);
      for (const [el, h] of stepClickHandlers) el.removeEventListener('click', h);
      for (const [el, h] of stepKeyHandlers) el.removeEventListener('keydown', h);
    },
  };
}
