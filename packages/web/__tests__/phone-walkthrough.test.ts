// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mountPhoneWalkthrough } from '../src/components/PhoneWalkthrough.js';

/** Build the minimum DOM the component expects. */
function setupHost(): HTMLElement {
  document.body.innerHTML = `
    <div id="walkthrough-mount">
      <figure class="phone-frame" data-current="1" data-transition="fade">
        <div class="phone-screen">
          ${[1, 2, 3, 4, 5, 6]
            .map((n) => `<img class="phone-screen-img" data-step="${n}" />`)
            .join('')}
        </div>
      </figure>
      <div class="walkthrough-side">
        <ol class="walkthrough-steps">
          ${[1, 2, 3, 4, 5, 6]
            .map(
              (n) =>
                `<li class="walkthrough-step${n === 1 ? ' is-active' : ''}" data-step="${n}" tabindex="${n === 1 ? 0 : -1}"></li>`,
            )
            .join('')}
        </ol>
        <div class="walkthrough-progress">
          ${[1, 2, 3, 4, 5, 6]
            .map((n) => `<button class="walkthrough-dot${n === 1 ? ' is-active' : ''}" data-step="${n}"></button>`)
            .join('')}
        </div>
      </div>
    </div>
  `;
  return document.getElementById('walkthrough-mount')!;
}

describe('mountPhoneWalkthrough', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // happy-dom doesn't implement matchMedia out of the box in a useful way
    // for reduced-motion queries. Default to "motion allowed".
    if (!window.matchMedia) {
      (window as unknown as { matchMedia: unknown }).matchMedia = () =>
        ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }) as unknown;
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('throws a helpful error when the phone frame is missing', () => {
    const host = document.createElement('div');
    expect(() => mountPhoneWalkthrough(host)).toThrow(/phone-frame/);
  });

  it('starts on step 1 and advances to step 2 after one autoPlayMs tick', () => {
    const host = setupHost();
    const wt = mountPhoneWalkthrough(host, { autoPlayMs: 500 });
    const frame = host.querySelector<HTMLElement>('.phone-frame')!;
    expect(frame.getAttribute('data-current')).toBe('1');
    expect(wt.current()).toBe(1);

    vi.advanceTimersByTime(500);
    expect(frame.getAttribute('data-current')).toBe('2');
    expect(wt.current()).toBe(2);
    expect(frame.getAttribute('data-transition')).toBe('push-right');
    wt.destroy();
  });

  it('jumpTo switches the active step and the active list item', () => {
    const host = setupHost();
    const wt = mountPhoneWalkthrough(host);
    wt.jumpTo(4);
    const frame = host.querySelector<HTMLElement>('.phone-frame')!;
    expect(frame.getAttribute('data-current')).toBe('4');
    expect(host.querySelector('.walkthrough-step.is-active')?.getAttribute('data-step')).toBe('4');
    expect(host.querySelector('.walkthrough-dot.is-active')?.getAttribute('data-step')).toBe('4');
    wt.destroy();
  });

  it('clicking a step jumps the phone to that step', () => {
    const host = setupHost();
    const wt = mountPhoneWalkthrough(host);
    const step5 = host.querySelector<HTMLElement>('.walkthrough-step[data-step="5"]')!;
    step5.click();
    expect(wt.current()).toBe(5);
    wt.destroy();
  });

  it('pause stops the auto-advance timer', () => {
    const host = setupHost();
    const wt = mountPhoneWalkthrough(host, { autoPlayMs: 500 });
    wt.pause();
    vi.advanceTimersByTime(2000);
    expect(wt.current()).toBe(1);
    wt.destroy();
  });

  it('loops from step 6 back to step 1', () => {
    const host = setupHost();
    const wt = mountPhoneWalkthrough(host, { autoPlayMs: 100 });
    wt.jumpTo(6);
    vi.advanceTimersByTime(100);
    expect(wt.current()).toBe(1);
    wt.destroy();
  });

  it('respects prefers-reduced-motion by not starting the timer', () => {
    (window as unknown as { matchMedia: (q: string) => unknown }).matchMedia = (q: string) =>
      ({ matches: q.includes('reduce'), addEventListener: () => {}, removeEventListener: () => {} }) as unknown;
    const host = setupHost();
    const wt = mountPhoneWalkthrough(host, { autoPlayMs: 100 });
    vi.advanceTimersByTime(1000);
    expect(wt.current()).toBe(1);
    wt.destroy();
  });
});
