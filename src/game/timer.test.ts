import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { elapsedFraction, secondsLeft, startCountdown, TURN_MS } from "./timer";

describe("conto alla rovescia", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => vi.useRealTimers());

  it("avvisa una sola volta a 10 secondi e scade una sola volta a zero", () => {
    const onWarning = vi.fn();
    const onExpire = vi.fn();
    startCountdown(TURN_MS, { onTick: () => {}, onWarning, onExpire });

    vi.advanceTimersByTime(49_000); // restano 11 s
    expect(onWarning).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000); // restano 10 s
    expect(onWarning).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(9_000);
    expect(onWarning).toHaveBeenCalledTimes(1);
    expect(onExpire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(onExpire).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5_000);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("ripartendo sotto i 10 secondi non ripete l'avviso", () => {
    const onWarning = vi.fn();
    startCountdown(5_000, { onTick: () => {}, onWarning, onExpire: () => {} });
    vi.advanceTimersByTime(6_000);
    expect(onWarning).not.toHaveBeenCalled();
  });

  it("una volta fermato non chiama più nessuna funzione", () => {
    const onTick = vi.fn();
    const onExpire = vi.fn();
    const stop = startCountdown(TURN_MS, { onTick, onExpire });
    stop();
    onTick.mockClear();
    vi.advanceTimersByTime(TURN_MS + 1_000);
    expect(onTick).not.toHaveBeenCalled();
    expect(onExpire).not.toHaveBeenCalled();
  });

  it("calcola secondi e avanzamento dell'anello", () => {
    expect(secondsLeft(60_000)).toBe(60);
    expect(secondsLeft(9_001)).toBe(10);
    expect(secondsLeft(0)).toBe(0);
    expect(elapsedFraction(TURN_MS)).toBe(0);
    expect(elapsedFraction(30_000)).toBe(0.5);
    expect(elapsedFraction(0)).toBe(1);
  });
});
