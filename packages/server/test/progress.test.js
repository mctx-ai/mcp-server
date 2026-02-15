/**
 * Progress Module Tests
 *
 * Tests progress tracking for generator-based tool handlers.
 */

import { describe, it, expect } from "vitest";
import { createProgress, PROGRESS_DEFAULTS } from "../src/progress.js";

describe("PROGRESS_DEFAULTS", () => {
  it("exports default configuration", () => {
    expect(PROGRESS_DEFAULTS).toBeDefined();
    expect(PROGRESS_DEFAULTS.maxExecutionTime).toBe(60000);
    expect(PROGRESS_DEFAULTS.maxYields).toBe(10000);
  });
});

describe("createProgress()", () => {
  it("creates step function without total", () => {
    const step = createProgress();
    expect(typeof step).toBe("function");
  });

  it("creates step function with total", () => {
    const step = createProgress(10);
    expect(typeof step).toBe("function");
  });

  it("throws if total is not a number", () => {
    expect(() => createProgress("10")).toThrow(
      /total must be a positive number/,
    );
    expect(() => createProgress({})).toThrow(/total must be a positive number/);
  });

  it("throws if total is zero", () => {
    expect(() => createProgress(0)).toThrow(/total must be a positive number/);
  });

  it("throws if total is negative", () => {
    expect(() => createProgress(-5)).toThrow(/total must be a positive number/);
  });
});

describe("step() - indeterminate progress", () => {
  it("returns progress notification with auto-incrementing counter", () => {
    const step = createProgress();

    const notification1 = step();
    expect(notification1).toEqual({
      type: "progress",
      progress: 1,
    });

    const notification2 = step();
    expect(notification2).toEqual({
      type: "progress",
      progress: 2,
    });

    const notification3 = step();
    expect(notification3).toEqual({
      type: "progress",
      progress: 3,
    });
  });

  it("does not include total field", () => {
    const step = createProgress();
    const notification = step();

    expect(notification.total).toBeUndefined();
  });

  it("increments independently for each instance", () => {
    const step1 = createProgress();
    const step2 = createProgress();

    step1();
    step1();

    expect(step1()).toEqual({ type: "progress", progress: 3 });
    expect(step2()).toEqual({ type: "progress", progress: 1 });
  });
});

describe("step() - determinate progress", () => {
  it("includes total when provided", () => {
    const step = createProgress(5);

    const notification1 = step();
    expect(notification1).toEqual({
      type: "progress",
      progress: 1,
      total: 5,
    });

    const notification2 = step();
    expect(notification2).toEqual({
      type: "progress",
      progress: 2,
      total: 5,
    });
  });

  it("can exceed total without error", () => {
    const step = createProgress(2);

    step(); // progress: 1/2
    step(); // progress: 2/2
    const notification = step(); // progress: 3/2

    expect(notification).toEqual({
      type: "progress",
      progress: 3,
      total: 2,
    });
  });

  it("handles large totals", () => {
    const step = createProgress(10000);
    const notification = step();

    expect(notification.total).toBe(10000);
  });
});

describe("createProgress() - realistic usage", () => {
  it("simulates determinate loop progress", () => {
    const items = ["a", "b", "c", "d", "e"];
    const step = createProgress(items.length);
    const notifications = [];

    for (let i = 0; i < items.length; i++) {
      notifications.push(step());
      // Process item...
    }

    expect(notifications).toEqual([
      { type: "progress", progress: 1, total: 5 },
      { type: "progress", progress: 2, total: 5 },
      { type: "progress", progress: 3, total: 5 },
      { type: "progress", progress: 4, total: 5 },
      { type: "progress", progress: 5, total: 5 },
    ]);
  });

  it("simulates indeterminate stream progress", () => {
    const step = createProgress();
    const notifications = [];

    let count = 0;
    while (count < 3) {
      notifications.push(step());
      count++;
    }

    expect(notifications).toEqual([
      { type: "progress", progress: 1 },
      { type: "progress", progress: 2 },
      { type: "progress", progress: 3 },
    ]);
  });

  it("can be used with async operations", async () => {
    const step = createProgress(3);
    const notifications = [];

    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1));
      notifications.push(step());
    }

    expect(notifications).toHaveLength(3);
    expect(notifications[2]).toEqual({
      type: "progress",
      progress: 3,
      total: 3,
    });
  });
});

describe("createProgress() - edge cases", () => {
  it("handles very large progress values", () => {
    const step = createProgress();

    for (let i = 0; i < 1000; i++) {
      step();
    }

    const notification = step();
    expect(notification.progress).toBe(1001);
  });

  it("handles decimal totals (rounds to integer)", () => {
    const step = createProgress(5.7);
    const notification = step();

    expect(notification.total).toBe(5.7);
  });

  it("handles total of 1", () => {
    const step = createProgress(1);
    const notification = step();

    expect(notification).toEqual({
      type: "progress",
      progress: 1,
      total: 1,
    });
  });

  it("notification object can be yielded in generator", () => {
    const step = createProgress(3);

    function* generator() {
      yield step();
      yield step();
      yield step();
      return "done";
    }

    const gen = generator();
    expect(gen.next().value).toEqual({
      type: "progress",
      progress: 1,
      total: 3,
    });
    expect(gen.next().value).toEqual({
      type: "progress",
      progress: 2,
      total: 3,
    });
    expect(gen.next().value).toEqual({
      type: "progress",
      progress: 3,
      total: 3,
    });
    expect(gen.next().value).toBe("done");
  });
});
