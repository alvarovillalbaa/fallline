// T2: authored seeds, controls and in-memory storage. No browser or service.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, levelId, parseLevel, getRun, createRide, stepRide, terrainHeight, getWorld } from '../../public/src/ride.js';
import { normalizeSave, rememberLevel, keepRecord, loadSave, writeSave } from '../../public/src/records.js';

function advance(state, seconds, controls = {}) {
  for (let i = 0; i < seconds * 60; i++) state = stepRide(state, controls, 1 / 60);
  return state;
}
function completed(id) {
  const run = getRun(id);
  return { ...createRide(id), status: 'finished', time: 60, adjustedTime: 60, passed: run.flags.length, missed: 0 };
}

test('versioned seeds reproduce exact levels after cache eviction, and distinct seeds produce distinct worlds', () => {
  for (const map of MAPS) {
    const id = levelId(map.id, 42, 4), first = structuredClone(getRun(id));
    for (let seed = 100; seed < 170; seed++) getRun(levelId(map.id, seed, 3));
    assert.deepEqual(getRun(id), first);
    assert.notDeepEqual(getRun(levelId(map.id, 43, 4)).flags, first.flags);
    assert.notEqual(terrainHeight(getRun(levelId(map.id, 43, 4)), 0, 30), terrainHeight(first, 0, 30));
  }
  assert.notDeepEqual(getRun(levelId('meadow', 42, 4)).flags, getRun(levelId('storm', 42, 4)).flags);
});

test('level identifiers reject malformed, unknown, noncanonical and unbounded data', () => {
  for (const id of [null, {}, 'v2-meadow-0-1', 'v2-meadow-01-1', 'v2-bad-1-1', 'v2-meadow-4294967296-1', 'v2-meadow-1-51', 'v2-meadow-1-0', 'v2-meadow-1-1x']) assert.equal(parseLevel(id), null);
  assert.deepEqual(parseLevel(levelId('ridge', 0xffffffff, 50)), { map: 'ridge', seed: 0xffffffff, level: 50 });
  assert.equal(levelId('ridge', NaN, 1), null);
});

test('difficulty increases speed, gusts, obstacle density and precision across generated maps', () => {
  for (const map of MAPS) {
    const first = getRun(levelId(map.id, 123, 1)), later = getRun(levelId(map.id, 123, 25));
    assert.ok(first.startSpeed >= 19, 'Opening speed must already require attention.');
    assert.ok(later.startSpeed > first.startSpeed && later.slope > first.slope);
    assert.ok(later.gust > first.gust && later.obstacles.length > first.obstacles.length);
    assert.ok(later.flags[0].width < first.flags[0].width);
    assert.ok(first.obstacles.length >= 24 && first.ramps.length >= 3);
    assert.ok(getWorld(later, 0, 10_000_000, 'free').obstacles.length <= 230);
    assert.ok(first.flags[0].z / first.startSpeed >= 5, 'Keep a reaction window before the first gate.');
  }
});

test('gusts move the rider, grounded spins earn nothing, and completed airborne spins score only on landing', () => {
  const id = levelId('meadow', 42, 1), start = createRide(id);
  const ground = advance(start, 1, { trick: true });
  assert.notEqual(ground.x, start.x); assert.notEqual(ground.wind, 0);
  assert.equal(ground.tricks, 0); assert.equal(ground.trickScore, 0);
  const air = advance(start, 0.5, { jump: true, trick: true });
  assert.equal(air.onGround, false); assert.ok(air.spin > 0); assert.equal(air.trickScore, 0);
  const landed = advance(start, 4, { jump: true, trick: true });
  assert.equal(landed.onGround, true); assert.ok(landed.tricks >= 1);
  assert.equal(landed.trickScore, landed.tricks * 100);
  assert.equal(advance(landed, 1, { trick: true }).tricks, landed.tricks);
});

test('remembered levels, completion and next difficulty survive a real serialized storage round trip', () => {
  const values = new Map([['unrelated', 'preserve']]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const id = levelId('glacier', 12345, 1);
  let save = rememberLevel(normalizeSave(null), id);
  save = keepRecord(save, completed(id)).value;
  assert.equal(save.progress.level, 2);
  assert.equal(writeSave(storage, save), true);
  const restored = loadSave(storage).value;
  assert.deepEqual(restored, save); assert.deepEqual(restored.progress.levels, [id]);
  assert.deepEqual(getRun(restored.runId), getRun(id));
  assert.equal(keepRecord(restored, completed(id)).value.progress.level, 2, 'Replaying a level must not farm progression.');
  assert.equal(values.get('unrelated'), 'preserve');
});

test('a collision before a projected landing cannot award its unfinished trick', () => {
  const id = levelId('pines', 42, 1), run = getRun(id), tree = run.obstacles.find(item => item.type === 'tree');
  const start = { ...createRide(id), x: tree.x, z: tree.z - 1,
    y: terrainHeight(run, tree.x, tree.z - 1) + 0.01, onGround: false,
    vy: -20, spin: Math.PI * 2 + 0.1, tricks: 2, trickScore: 200 };
  const stopped = stepRide(start, { trick: true }, 1 / 120);
  assert.equal(stopped.status, 'crashed');
  assert.equal(stopped.tricks, 2); assert.equal(stopped.trickScore, 200);
});

test('crashes, free rides and partial finishes cannot advance; levels and persisted arrays remain bounded', () => {
  const id = levelId('storm', 7, 1), save = rememberLevel(normalizeSave(null), id);
  for (const change of [{ status: 'crashed' }, { mode: 'free' }, { passed: 0 }]) {
    assert.equal(keepRecord(save, { ...completed(id), ...change }).value.progress.level, 1);
  }
  let many = normalizeSave(null);
  for (let seed = 1; seed <= 100; seed++) many = rememberLevel(many, levelId('pines', seed, 1));
  assert.equal(many.progress.levels.length, 80);
  assert.deepEqual(normalizeSave({ progress: { level: Infinity, levels: ['not a level'], completed: [null] } }).progress,
    { level: 1, levels: [], completed: [] });
  const terminal = rememberLevel(normalizeSave({ progress: { level: 50 } }), levelId('ridge', 1, 50));
  assert.equal(keepRecord(terminal, completed(terminal.runId)).value.progress.level, 50);
  assert.equal(writeSave({ setItem() {}, getItem() { return null; } }, save), false, 'A silent write failure is not saved.');
});

test('ordinary steering can finish varied generated levels without skipping flags or tunnelling through obstacles', () => {
  const limit = (value, bound) => Math.max(-bound, Math.min(bound, value));
  for (const map of MAPS) for (const seed of [13, 42]) for (const level of [1, 12, 25, 50]) {
    const id = levelId(map.id, seed, level), run = getRun(id);
    let state = createRide(id);
    for (let frame = 0; frame < 180 * 60 && state.status === 'riding'; frame++) {
      const target = run.flags[state.flagIndex] || { x: run.flags.at(-1).x, z: run.length + 50 };
      const seconds = Math.max(1.1, (target.z - state.z) / Math.max(1, state.vz));
      const desiredVx = limit((target.x - state.x) / seconds * 1.25, 10);
      const heading = Math.asin(limit((desiredVx - state.wind * 0.35) / Math.max(1, state.speed), 0.6));
      state = stepRide(state, { turn: limit(heading / 0.68 + (desiredVx - state.vx) * 0.05, 0.85) }, 1 / 60);
    }
    assert.equal(state.status, 'finished', `${id}: ${state.lastEvent?.text}`);
    assert.equal(state.passed, run.flags.length, `${id}: every flag remains reachable`);
  }
});
