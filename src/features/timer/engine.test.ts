import {
  addSeconds,
  computeTimer,
  endsAt,
  newClock,
  pause,
  resume,
  timerCues,
  type TimerSpec,
} from './engine';

const T0 = 1_000_000;
const at = (sec: number) => T0 + sec * 1000;

describe('computeTimer', () => {
  test('AMRAP: lead-in, countdown and end', () => {
    const spec: TimerSpec = { kind: 'amrap', durationSec: 600 };
    const clock = newClock(T0, 10);

    expect(computeTimer(spec, clock, at(0))).toMatchObject({ phase: 'lead_in', displaySec: 10 });
    expect(computeTimer(spec, clock, at(9.5))).toMatchObject({ phase: 'lead_in', displaySec: 1 });
    expect(computeTimer(spec, clock, at(10))).toMatchObject({ phase: 'running', displaySec: 600 });
    expect(computeTimer(spec, clock, at(70))).toMatchObject({ phase: 'running', displaySec: 540 });
    expect(computeTimer(spec, clock, at(610))).toMatchObject({ phase: 'done', displaySec: 0, progress: 1 });
    expect(computeTimer(spec, clock, at(9999))).toMatchObject({ phase: 'done', elapsedSec: 600 });
  });

  test('EMOM: current round and time left in the interval', () => {
    const spec: TimerSpec = { kind: 'emom', intervalSec: 60, rounds: 10 };
    const clock = newClock(T0, 0);

    expect(computeTimer(spec, clock, at(0))).toMatchObject({ round: 1, roundRemainingSec: 60 });
    expect(computeTimer(spec, clock, at(59.2))).toMatchObject({ round: 1, roundRemainingSec: 1 });
    expect(computeTimer(spec, clock, at(60))).toMatchObject({ round: 2, roundRemainingSec: 60 });
    expect(computeTimer(spec, clock, at(599))).toMatchObject({ round: 10, phase: 'running' });
    expect(computeTimer(spec, clock, at(600))).toMatchObject({ round: 10, phase: 'done', roundRemainingSec: 0 });
  });

  test('For Time: counts up, with and without a time cap', () => {
    const noCap = computeTimer({ kind: 'for_time', timeCapSec: null }, newClock(T0, 0), at(3600));
    expect(noCap).toMatchObject({ phase: 'running', displaySec: 3600, direction: 'up', progress: null });

    const cap: TimerSpec = { kind: 'for_time', timeCapSec: 720 };
    expect(computeTimer(cap, newClock(T0, 0), at(100))).toMatchObject({ displaySec: 100 });
    expect(computeTimer(cap, newClock(T0, 0), at(800))).toMatchObject({ phase: 'done', displaySec: 720 });
  });

  test('pause freezes time and resume continues where it left off', () => {
    const spec: TimerSpec = { kind: 'rest', durationSec: 90 };
    let clock = newClock(T0, 0);
    clock = pause(clock, at(30));
    expect(computeTimer(spec, clock, at(500)).displaySec).toBe(60);
    expect(endsAt(spec, clock)).toBeNull();

    clock = resume(clock, at(500));
    expect(computeTimer(spec, clock, at(510)).displaySec).toBe(50);
    expect(endsAt(spec, clock)).toBe(at(560));
  });

  test('+30s extends the rest', () => {
    const spec: TimerSpec = { kind: 'rest', durationSec: 60 };
    const clock = addSeconds(newClock(T0, 0), 30);
    expect(computeTimer(spec, clock, at(10)).displaySec).toBe(80);
    expect(endsAt(spec, clock)).toBe(at(90));
  });
});

describe('timerCues', () => {
  test('rest: 3 short beeps and the final one', () => {
    expect(timerCues({ kind: 'rest', durationSec: 60 }, { leadInSec: 0, extraSec: 0 })).toEqual([
      { atSec: 57, kind: 'tick' },
      { atSec: 58, kind: 'tick' },
      { atSec: 59, kind: 'tick' },
      { atSec: 60, kind: 'end' },
    ]);
  });

  test('EMOM: beep on every new interval', () => {
    const cues = timerCues({ kind: 'emom', intervalSec: 60, rounds: 3 }, { leadInSec: 10, extraSec: 0 });
    expect(cues.filter((c) => c.kind !== 'tick')).toEqual([
      { atSec: 10, kind: 'go' },
      { atSec: 70, kind: 'interval' },
      { atSec: 130, kind: 'interval' },
      { atSec: 190, kind: 'end' },
    ]);
    expect(cues.filter((c) => c.kind === 'tick').map((c) => c.atSec)).toEqual([
      7, 8, 9, 67, 68, 69, 127, 128, 129, 187, 188, 189,
    ]);
  });

  test('For Time without a cap has no end', () => {
    const cues = timerCues({ kind: 'for_time', timeCapSec: null }, { leadInSec: 3, extraSec: 0 });
    expect(cues.map((c) => c.kind)).toEqual(['tick', 'tick', 'tick', 'go']);
  });
});
