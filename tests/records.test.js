import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSave, loadSave, writeSave, keepRecord } from '../public/src/records.js';

function finished(overrides = {}) {
  const ride = {
    runId: 'meadow', mode: 'course', status: 'finished',
    time: 60, passed: 9, missed: 1, airTime: 2.5, jumps: 2,
    ...overrides,
  };
  return { ...ride, adjustedTime: overrides.adjustedTime ?? ride.time + ride.missed * 4 };
}

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
  };
}

test('defaults and settings remain bounded to the supported run and boolean fields', () => {
  assert.deepEqual(normalizeSave(null), { runId: 'meadow', sound: false, steady: false, records: {} });
  assert.equal(normalizeSave([], true).steady, true);
  assert.deepEqual(normalizeSave({ runId: 'pines', sound: true, steady: false, extra: 'ignored' }, true), {
    runId: 'pines', sound: true, steady: false, records: {},
  });
  assert.deepEqual(normalizeSave({ runId: 'unknown', sound: 'true', steady: 0 }, true), {
    runId: 'meadow', sound: false, steady: true, records: {},
  });
});

test('normalization copies only complete valid records for the three authored descents', () => {
  const record = finished();
  const normalized = normalizeSave({ records: { meadow: record, pines: record, ridge: record, unknown: record } });
  assert.deepEqual(Object.keys(normalized.records), ['meadow', 'pines', 'ridge']);
  assert.deepEqual(normalized.records.meadow, { time: 60, adjustedTime: 64, passed: 9, missed: 1, airTime: 2.5, jumps: 2 });
  assert.notEqual(normalized.records.meadow, record);
  assert.deepEqual(normalizeSave({ records: Object.create({ meadow: record }) }).records, {});
});

test('invalid persisted times, statistics and contradictory penalties are discarded', () => {
  const changes = [
    { time: 0 }, { time: -1 }, { time: Infinity }, { time: NaN }, { time: 7201 }, { time: '60' },
    { adjustedTime: NaN }, { adjustedTime: -1 }, { adjustedTime: 63 },
    { passed: -1 }, { passed: 1.5 }, { passed: 101 }, { passed: '9' },
    { missed: -1 }, { missed: 0.5 }, { missed: 101 }, { passed: 99, missed: 2 },
    { airTime: -1 }, { airTime: Infinity }, { airTime: 61 }, { airTime: '2.5' },
    { jumps: -1 }, { jumps: 0.5 }, { jumps: 10001 }, { jumps: '2' },
  ];
  for (const change of changes) {
    const candidate = finished(change);
    assert.deepEqual(normalizeSave({ records: { meadow: candidate } }).records, {}, JSON.stringify(change));
  }
  assert.deepEqual(normalizeSave({ records: { meadow: [] } }).records, {});
  assert.deepEqual(normalizeSave({ records: [] }).records, {});
});

test('empty and corrupt JSON reset the save while keeping truthful readable-storage availability', () => {
  const storage = memoryStorage();
  assert.deepEqual(loadSave(storage, true), { value: normalizeSave(null, true), available: true });
  storage.values.set('fallline.v1', '{broken');
  assert.deepEqual(loadSave(storage), { value: normalizeSave(null), available: true });
  for (const raw of ['null', '[]', '"not a save"', '{"records":{"meadow":{"time":-1}}}']) {
    storage.values.set('fallline.v1', raw);
    assert.deepEqual(loadSave(storage).value, normalizeSave(null));
  }
});

test('unavailable reads fail safely without writing or touching other storage', () => {
  const storage = { getItem() { throw new Error('Storage disabled'); }, setItem() { assert.fail('Unexpected write'); } };
  assert.deepEqual(loadSave(storage, true), { value: normalizeSave(null, true), available: false });
  assert.equal(loadSave(null).available, false);
});

test('writes normalize and use only fallline.v1; failed writes report false', () => {
  const storage = memoryStorage({ unrelated: 'keep', 'driftwing.v1': 'keep too' });
  assert.equal(writeSave(storage, { runId: 'ridge', sound: true, records: { meadow: finished(), bad: finished() } }), true);
  assert.equal(storage.values.get('unrelated'), 'keep');
  assert.equal(storage.values.get('driftwing.v1'), 'keep too');
  assert.deepEqual(Object.keys(JSON.parse(storage.values.get('fallline.v1')).records), ['meadow']);
  assert.equal(loadSave(storage).value.runId, 'ridge');
  assert.equal(writeSave({ setItem() { throw new Error('Quota full'); } }, normalizeSave(null)), false);
  assert.equal(writeSave(null, normalizeSave(null)), false);
});

test('only completed course rides with known run IDs can produce a record', () => {
  const save = normalizeSave(null);
  for (const ride of [null, finished({ status: 'riding' }), finished({ status: 'crashed' }), finished({ mode: 'free' }), finished({ runId: 'unknown' })]) {
    assert.deepEqual(keepRecord(save, ride), { value: save, improved: false });
  }
});

test('candidate validation happens before reporting any improvement', () => {
  const save = normalizeSave(null);
  for (const ride of [finished({ time: NaN }), finished({ adjustedTime: 1 }), finished({ jumps: -1 }), finished({ airTime: 61 })]) {
    const result = keepRecord(save, ride);
    assert.equal(result.improved, false);
    assert.equal(result.value, save);
    assert.deepEqual(result.value.records, {});
  }
});

test('the first valid record is immutable and contains no transient ride fields', () => {
  const save = normalizeSave({ runId: 'pines', sound: true, steady: true, records: { ridge: finished({ runId: 'ridge' }) } });
  const before = structuredClone(save);
  const ride = finished({ x: 123, lastEvent: { type: 'finish' } });
  const result = keepRecord(save, ride);
  assert.equal(result.improved, true);
  assert.notEqual(result.value, save);
  assert.notEqual(result.value.records, save.records);
  assert.deepEqual(save, before);
  assert.deepEqual(result.value.records.ridge, save.records.ridge);
  assert.deepEqual(result.value.records.meadow, { time: 60, adjustedTime: 64, passed: 9, missed: 1, airTime: 2.5, jumps: 2 });
  assert.equal(result.value.runId, 'pines');
  assert.equal(result.value.sound, true);
  assert.equal(result.value.steady, true);
});

test('lower adjusted time wins even if its raw time is higher', () => {
  const save = keepRecord(normalizeSave(null), finished()).value;
  const result = keepRecord(save, finished({ time: 63, passed: 10, missed: 0 }));
  assert.equal(result.improved, true);
  assert.equal(result.value.records.meadow.adjustedTime, 63);
  assert.equal(result.value.records.meadow.time, 63);
  assert.equal(keepRecord(result.value, finished({ time: 60, missed: 1 })).improved, false);
});

test('equal adjusted time breaks ties by lower raw time, then retains the old record', () => {
  const save = keepRecord(normalizeSave(null), finished()).value;
  const quickerRaw = keepRecord(save, finished({ time: 56, passed: 8, missed: 2 }));
  assert.equal(quickerRaw.improved, true);
  assert.equal(quickerRaw.value.records.meadow.adjustedTime, 64);
  const exactTie = keepRecord(quickerRaw.value, finished({ time: 56, passed: 8, missed: 2, jumps: 8 }));
  assert.equal(exactTie.improved, false);
  assert.equal(exactTie.value, quickerRaw.value);
  assert.equal(keepRecord(quickerRaw.value, finished()).improved, false);
});

test('an invalid existing record cannot prevent a valid replacement', () => {
  const save = { ...normalizeSave(null), records: { meadow: { ...finished(), adjustedTime: -1 } } };
  const result = keepRecord(save, finished());
  assert.equal(result.improved, true);
  assert.equal(result.value.records.meadow.adjustedTime, 64);
  assert.equal(save.records.meadow.adjustedTime, -1);
});

test('a failed persistence attempt preserves the in-memory best for subsequent rides', () => {
  const storage = { getItem() { throw new Error('Disabled'); }, setItem() { throw new Error('Disabled'); } };
  const loaded = loadSave(storage);
  const best = keepRecord(loaded.value, finished());
  assert.equal(loaded.available, false);
  assert.equal(best.improved, true);
  assert.equal(writeSave(storage, best.value), false);
  const next = keepRecord(best.value, finished({ time: 65 }));
  assert.equal(next.improved, false);
  assert.equal(next.value, best.value);
  assert.equal(next.value.records.meadow.adjustedTime, 64);
});
