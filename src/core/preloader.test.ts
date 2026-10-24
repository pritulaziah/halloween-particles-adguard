import { describe, expect, it } from 'vitest';
import { createProgressTracker } from './preloader';

describe('createProgressTracker', () => {
  it('returns zero before any task reports progress', () => {
    const tracker = createProgressTracker();
    tracker.addTask(1);

    expect(tracker.getProgress()).toBe(0);
  });

  it('combines task progress by weight', () => {
    const tracker = createProgressTracker();
    const first = tracker.addTask(1);
    const second = tracker.addTask(3);

    first.report(0.5);
    second.report(0.5);

    expect(tracker.getProgress()).toBe(0.5);
  });

  it('marks a task as complete', () => {
    const tracker = createProgressTracker();
    const task = tracker.addTask(1);

    task.done();

    expect(tracker.getProgress()).toBe(1);
  });

  it('clamps reported progress to the valid range', () => {
    const tracker = createProgressTracker();
    const task = tracker.addTask(1);

    task.report(2);
    expect(tracker.getProgress()).toBe(1);

    task.report(-1);
    expect(tracker.getProgress()).toBe(0);
  });
});
