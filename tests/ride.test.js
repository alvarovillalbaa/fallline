import test from 'node:test';
import assert from 'node:assert/strict';
import { RUNS, getRun, createRide, stepRide, terrainHeight, getWorld, rampHeight } from '../public/src/ride.js';

const near = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be within ${tolerance} of ${expected}`);
function ride(state, seconds, controls = {}) {
  let next = state;
  for (let frame = 0; frame < Math.round(seconds * 60); frame++) next = stepRide(next, controls, 1 / 60);
  return next;
}
function approach(run, object, distance = 11) {
  const state = createRide(run.id);
  return { ...state, x: object.x, z: object.z - distance, y: terrainHeight(run, object.x, object.z - distance), speed: 18, vz: 18, vy: -run.slope * 18 };
}

test('three authored runs have ordered flags, a clear finish and descending shared snow', () => {
  assert.deepEqual(RUNS.map(run => run.id), ['meadow', 'pines', 'ridge']);
  assert.deepEqual(RUNS.map(run => run.flags.length), [8, 10, 12]);
  assert.deepEqual(RUNS.map(run => run.length), [1100, 1450, 1800]);
  for (const run of RUNS) {
    let previous = 0;
    for (const flag of run.flags) {
      assert.ok(flag.z > previous && flag.z < run.length); previous = flag.z;
      assert.ok(Math.abs(flag.x) + flag.width / 2 < run.halfWidth);
    }
    assert.ok(terrainHeight(run, 0, run.length) < -100);
    assert.equal(createRide(run.id).y, terrainHeight(run, 0, 0));
  }
  assert.equal(getRun('missing'), RUNS[0]); assert.equal(getRun('MEADOW'), RUNS[0]);
});

test('slope creates downhill acceleration, while tuck and braking change actual travel', () => {
  const initial = createRide('meadow'); const normal = ride(initial, 12);
  const tucked = ride(initial, 12, { tuck: true }); const braked = ride(initial, 6, { brake: true });
  assert.ok(normal.speed > initial.speed + 2); assert.ok(normal.z > 100 && normal.y < -15);
  assert.ok(tucked.speed > normal.speed + 2 && tucked.z > normal.z + 10);
  assert.ok(braked.speed < normal.speed - 8 && braked.z < normal.z / 3);
  const steep = createRide('ridge'); const steepLater = ride(steep, 3);
  const gentleLater = ride(initial, 3);
  assert.ok(steepLater.speed - steep.speed > gentleLater.speed - initial.speed + 0.5);
  near(normal.y, terrainHeight(getRun('meadow'), normal.x, normal.z));
});

test('carving changes the line and trades forward speed for a turn', () => {
  const initial = createRide('meadow'); const straight = ride(initial, 3);
  const right = ride(initial, 3, { turn: 0.65 }); const left = ride(initial, 3, { turn: -0.65 });
  assert.ok(right.x > 8 && left.x < -8);
  assert.ok(right.heading > 0 && left.heading < 0 && right.lean > 0 && left.lean < 0);
  assert.ok(right.speed < straight.speed && right.z < straight.z);
});

test('manual jump changes clearance, lands on shared terrain and latches held input', () => {
  const run = getRun('meadow'); const initial = createRide(run.id);
  const airborne = ride(initial, 0.4, { jump: true });
  assert.equal(airborne.onGround, false); assert.ok(airborne.y - terrainHeight(run, airborne.x, airborne.z) > 1);
  const held = ride(initial, 4, { jump: true });
  assert.equal(held.jumps, 1); assert.equal(held.onGround, true); assert.ok(held.airTime > 0.8);
  near(held.y, terrainHeight(run, held.x, held.z));
  const released = stepRide(held, { jump: false }, 1 / 60);
  const again = stepRide(released, { jump: true }, 1 / 60);
  assert.equal(again.jumps, 2); assert.equal(again.onGround, false);
  let landing = stepRide(initial, { jump: true }, 1 / 120);
  for (let frame = 0; frame < 240 && !landing.onGround; frame++) landing = stepRide(landing, {}, 1 / 120);
  assert.equal(landing.onGround, true);
  const immediate = stepRide(landing, { jump: true }, 1 / 120);
  assert.equal(immediate.onGround, false, 'A completed landing must allow the next deliberate jump.');
  assert.ok(immediate.y > terrainHeight(run, immediate.x, immediate.z));
});

test('a timed jump clears a low rock that blocks a grounded rider', () => {
  const run = getRun('meadow'), rock = run.obstacles.find(object => object.type === 'rock');
  const initial = approach(run, rock);
  const grounded = ride(initial, 1.3), jumped = ride(initial, 1.3, { jump: true });
  assert.equal(grounded.status, 'crashed'); assert.match(grounded.lastEvent.text, /rock/i);
  assert.ok(grounded.z < rock.z, 'A collision stops at contact, before the rock centre.');
  assert.equal(jumped.status, 'riding'); assert.ok(jumped.z > rock.z + rock.radius);
  assert.equal(jumped.jumps, 1);
});

test('jumping does not clear a tall tree and fast movement cannot tunnel through it', () => {
  const run = getRun('meadow'), tree = run.obstacles.find(object => object.type === 'tree');
  const jumped = ride(approach(run, tree), 1.3, { jump: true });
  assert.equal(jumped.status, 'crashed'); assert.match(jumped.lastEvent.text, /pine/i);
  const initial = { ...approach(run, tree, 5), speed: 38, vz: 38 };
  const fast = stepRide(initial, { tuck: true }, 0.1);
  assert.equal(fast.status, 'crashed'); assert.ok(fast.z < tree.z);
  assert.equal(stepRide(fast, { turn: 1, jump: true }, 0.1), fast);
});

test('the shared ramp profile raises the board and a crest launches a real jump', () => {
  const run = getRun('meadow'), ramp = run.ramps[0];
  near(rampHeight(ramp, ramp.x, ramp.z), 0);
  near(rampHeight(ramp, ramp.x, ramp.z + ramp.length / 2), ramp.height / 2);
  near(rampHeight(ramp, ramp.x, ramp.z + ramp.length), ramp.height);
  assert.equal(rampHeight(ramp, ramp.x + ramp.width, ramp.z + ramp.length / 2), 0);
  let state = approach(run, ramp, 2), launched = null;
  for (let frame = 0; frame < 180 && !launched; frame++) { state = stepRide(state, {}, 1 / 60); if (state.jumps) launched = state; }
  assert.ok(launched); assert.equal(launched.onGround, false); assert.equal(launched.lastEvent.type, 'jump');
  assert.ok(launched.y > terrainHeight(run, launched.x, launched.z) + 1);
  assert.ok(ride(launched, 2).airTime > 0.2);
});

test('flags use crossing interpolation, award once and preserve input state', () => {
  const run = getRun('meadow'), flag = run.flags[0];
  const initial = { ...createRide(run.id), x: flag.x + flag.width / 2 - 0.01, z: flag.z - 0.001, heading: 0.6, speed: 20, vz: 20 };
  initial.y = terrainHeight(run, initial.x, initial.z);
  const snapshot = structuredClone(initial);
  const crossed = stepRide(initial, Object.freeze({}), 1 / 120);
  assert.deepEqual(initial, snapshot);
  assert.ok(crossed.x > flag.x + flag.width / 2, 'The final position is outside the flag opening.');
  assert.equal(crossed.passed, 1); assert.equal(crossed.missed, 0); assert.equal(crossed.flagIndex, 1);
  assert.equal(crossed.lastEvent.type, 'flag');
  const later = ride(crossed, 1);
  assert.equal(later.passed, 1); assert.equal(later.flagIndex, 1); assert.equal(later.lastEvent.id, crossed.lastEvent.id);
});

test('a missed flag adds exactly four seconds without ending the ride', () => {
  const run = getRun('meadow'), flag = run.flags[0];
  const initial = { ...createRide(run.id), x: flag.x + flag.width, z: flag.z - 0.01 };
  initial.y = terrainHeight(run, initial.x, initial.z);
  const missed = stepRide(initial, {}, 1 / 30);
  assert.equal(missed.status, 'riding'); assert.equal(missed.missed, 1); assert.equal(missed.passed, 0);
  near(missed.adjustedTime - missed.time, 4); assert.equal(missed.lastEvent.type, 'miss');
});

test('the last flag precedes the finish, whose adjusted time and state freeze', () => {
  const run = getRun('meadow'), flag = run.flags.at(-1);
  const initial = { ...createRide(run.id), x: flag.x, z: flag.z - 0.01, flagIndex: run.flags.length - 1, passed: 6, missed: 1, speed: 18, vz: 18 };
  initial.y = terrainHeight(run, initial.x, initial.z);
  const crossed = stepRide(initial, {}, 1 / 60);
  assert.equal(crossed.passed, 7); assert.equal(crossed.status, 'riding');
  const finished = ride(crossed, 6);
  assert.equal(finished.status, 'finished'); assert.equal(finished.lastEvent.type, 'finish');
  near(finished.z, run.length); near(finished.adjustedTime, finished.time + 4);
  assert.equal(stepRide(finished, { turn: 1, jump: true }, 0.1), finished);
});

test('leaving the marked snow crashes without silently moving back inside', () => {
  const run = getRun('meadow'); const initial = { ...createRide(run.id), x: run.halfWidth - 0.01, heading: 0.6 };
  initial.y = terrainHeight(run, initial.x, initial.z);
  const crashed = stepRide(initial, { turn: 1 }, 0.1);
  assert.equal(crashed.status, 'crashed'); near(crashed.x, run.halfWidth);
  assert.match(crashed.lastEvent.text, /marked snow/);
});

test('free world is deterministic, bounded per query, and contains no authored flags', () => {
  for (const run of RUNS) {
    const world = getWorld(run, 2000, 2800, 'free');
    assert.deepEqual(world, getWorld(run, 2000, 2800, 'free'));
    assert.equal(world.flags.length, 0); assert.ok(world.obstacles.some(object => object.type === 'tree'));
    assert.ok(world.obstacles.some(object => object.type === 'rock'));
    const enormous = getWorld(run, 0, 10_000_000, 'free');
    assert.ok(enormous.obstacles.length < 100 && enormous.ramps.length < 12);
    assert.ok(enormous.obstacles.every(object => object.z <= 4002));
    assert.deepEqual(getWorld(run, 0, 1600).flags, run.flags.filter(flag => flag.z <= 1600));
  }
});

test('free riding passes course finish and never scores authored flags', () => {
  const run = getRun('meadow'); let state = createRide(run.id, 'free');
  // Steer away from generated low rocks using only the normal control surface.
  for (let frame = 0; frame < 180 * 60 && state.z < run.length + 30 && state.status === 'riding'; frame++) {
    const ahead = getWorld(run, state.z, state.z + 30, 'free').obstacles;
    const rock = ahead.find(object => object.type === 'rock' && Math.abs(object.x - state.x) < object.radius + 1.5);
    state = stepRide(state, { jump: Boolean(rock && rock.z - state.z < state.speed * 0.7) }, 1 / 60);
  }
  assert.equal(state.status, 'riding'); assert.ok(state.z > run.length);
  assert.equal(state.flagIndex, 0); assert.equal(state.passed, 0); assert.equal(state.missed, 0);
});

test('invalid or giant frame delays and invalid turn values cannot destabilize a ride', () => {
  const initial = createRide('meadow');
  for (const dt of [NaN, Infinity, -Infinity, -1, 0, undefined, '1']) assert.deepEqual(stepRide(initial, {}, dt), initial);
  assert.deepEqual(stepRide(initial, {}, 100), stepRide(initial, {}, 0.1));
  assert.deepEqual(ride(initial, 2, { turn: 99 }), ride(initial, 2, { turn: 1 }));
  assert.deepEqual(ride(initial, 2, { turn: NaN }), ride(initial, 2));
  for (const run of RUNS) assert.ok(Number.isFinite(terrainHeight(run, NaN, Infinity)));
});

test('fixed substeps make equal input histories independent of render-frame partitioning', () => {
  let normal = createRide('meadow'), mixed = createRide('meadow'); const controls = { turn: 0.2, tuck: true, jump: true };
  for (let frame = 0; frame < 240; frame++) normal = stepRide(normal, controls, 1 / 60);
  for (let frame = 0; frame < 80; frame++) { mixed = stepRide(mixed, controls, 0.013); mixed = stepRide(mixed, controls, 0.037); }
  for (const field of ['x', 'y', 'z', 'vx', 'vy', 'vz', 'speed', 'heading', 'lean', 'time', 'adjustedTime', 'airTime']) near(mixed[field], normal[field]);
  assert.equal(mixed.jumps, normal.jumps); assert.equal(mixed.status, normal.status); assert.equal(mixed.onGround, normal.onGround);
});

test('control-only feedback pilots can finish every run through all authored flags', () => {
  const limit = (value, bound) => Math.max(-bound, Math.min(bound, value));
  for (const run of RUNS) {
    let state = createRide(run.id);
    for (let frame = 0; frame < 200 * 60 && state.status === 'riding'; frame++) {
      const target = run.flags[state.flagIndex] || { x: 0, z: run.length + 50 };
      const seconds = Math.max(1.5, (target.z - state.z) / Math.max(1, state.vz));
      const desiredVx = limit((target.x - state.x) / seconds * 1.25, 6);
      const desiredHeading = Math.asin(limit(desiredVx / Math.max(1, state.speed), 0.6));
      const turn = limit(desiredHeading / 0.68 + (desiredVx - state.vx) * 0.05, 0.65);
      state = stepRide(state, { turn }, 1 / 60);
    }
    assert.equal(state.status, 'finished', `${run.id}: ${state.lastEvent?.text}`);
    assert.equal(state.passed, run.flags.length, `${run.id}: all flags must be reachable through the real controls.`);
    assert.equal(state.missed, 0); near(state.adjustedTime, state.time);
  }
});
