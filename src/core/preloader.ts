export interface LoadTask {
  report(progress: number): void;
  done(): void;
}

export interface ProgressTracker {
  addTask(weight: number): LoadTask;
  getProgress(): number;
}

export interface Preloader {
  addTask(weight: number): LoadTask;
  complete(): Promise<void>;
}

const SMOOTHING_SPEED = 8;
const IDLE_LIMIT = 0.99;
const FADE_DURATION = 500;

function clamp(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/**
 * Combine the progress of weighted tasks into one value from 0 to 1.
 */
export function createProgressTracker(): ProgressTracker {
  const tasks: { weight: number; progress: number }[] = [];

  const getProgress = (): number => {
    const totalWeight = tasks.reduce((total, task) => total + task.weight, 0);

    if (totalWeight <= 0) {
      return 0;
    }

    const progress = tasks.reduce((total, task) => total + task.weight * task.progress, 0);

    return clamp(progress / totalWeight);
  };

  return {
    addTask(weight: number): LoadTask {
      const task = { weight: Math.max(weight, 0), progress: 0 };

      tasks.push(task);

      return {
        report(progress: number): void {
          task.progress = clamp(progress);
        },
        done(): void {
          task.progress = 1;
        },
      };
    },
    getProgress,
  };
}

/**
 * Control the loading screen. The counter and the bar move smoothly from 0 to 100.
 */
export function createPreloader(): Preloader {
  const overlay = document.querySelector<HTMLElement>('#preloader');
  const percentLabel = document.querySelector<HTMLElement>('#preloader-percent');
  const bar = document.querySelector<HTMLElement>('#preloader-bar');
  const tracker = createProgressTracker();

  if (overlay === null || percentLabel === null || bar === null) {
    return {
      addTask: (weight) => tracker.addTask(weight),
      complete: () => Promise.resolve(),
    };
  }

  let target = 0;
  let shown = 0;
  let lastPercent = -1;
  let lastTime = performance.now();
  let finishing = false;
  let finished = false;
  let finishResolve: (() => void) | null = null;
  let finishPromise: Promise<void> | null = null;

  const updateDom = (value: number): void => {
    const percent = Math.round(value * 100);

    if (percent !== lastPercent) {
      percentLabel.textContent = String(percent);
      overlay.setAttribute('aria-valuenow', String(percent));
      lastPercent = percent;
    }

    bar.style.transform = `scaleX(${value})`;
  };

  const fadeOut = (): void => {
    overlay.style.pointerEvents = 'none';

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animation = overlay.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: reducedMotion ? 0 : FADE_DURATION,
      easing: 'ease',
      fill: 'forwards',
    });

    const remove = (): void => {
      overlay.remove();
      finished = true;
      finishResolve?.();
      finishResolve = null;
    };

    void animation.finished.then(remove, remove);
  };

  const step = (time: number): void => {
    const delta = Math.max((time - lastTime) / 1000, 0);
    lastTime = time;

    const goal = finishing ? 1 : Math.min(target, IDLE_LIMIT);
    const factor = 1 - Math.exp(-delta * SMOOTHING_SPEED);
    shown += (goal - shown) * factor;

    if (finishing && goal - shown < 0.001) {
      shown = 1;
      updateDom(1);
      fadeOut();

      return;
    }

    updateDom(shown);
    window.requestAnimationFrame(step);
  };

  window.requestAnimationFrame(step);

  return {
    addTask(weight: number): LoadTask {
      const task = tracker.addTask(weight);

      const updateTarget = (): void => {
        target = Math.max(target, tracker.getProgress());
      };

      return {
        report(progress: number): void {
          task.report(progress);
          updateTarget();
        },
        done(): void {
          task.done();
          updateTarget();
        },
      };
    },

    complete(): Promise<void> {
      if (finished) {
        return Promise.resolve();
      }

      finishing = true;

      if (finishPromise === null) {
        finishPromise = new Promise((resolve) => {
          finishResolve = resolve;
        });
      }

      return finishPromise;
    },
  };
}
