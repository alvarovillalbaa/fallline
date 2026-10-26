const KEY = 'fallline.v1';
const RUN_IDS = ['meadow', 'pines', 'ridge'];
const MAX_TIME = 7200;
const MAX_FLAGS = 100;
const MAX_JUMPS = 10000;
const EPSILON = 0.000001;

function recordValue(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { time, adjustedTime, passed, missed, airTime, jumps } = value;
  if (!Number.isFinite(time) || time <= 0 || time > MAX_TIME
    || !Number.isFinite(adjustedTime) || adjustedTime <= 0 || adjustedTime > MAX_TIME + MAX_FLAGS * 4
    || !Number.isInteger(passed) || passed < 0 || passed > MAX_FLAGS
    || !Number.isInteger(missed) || missed < 0 || passed + missed > MAX_FLAGS
    || !Number.isFinite(airTime) || airTime < 0 || airTime > time + EPSILON
    || !Number.isInteger(jumps) || jumps < 0 || jumps > MAX_JUMPS
    || Math.abs(adjustedTime - (time + missed * 4)) > EPSILON) return null;
  return { time, adjustedTime: time + missed * 4, passed, missed, airTime: Math.min(airTime, time), jumps };
}

export function normalizeSave(value, reducedMotion = false) {
  const defaults = { runId: 'meadow', sound: false, steady: Boolean(reducedMotion), records: {} };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaults;
  const normalized = {
    runId: RUN_IDS.includes(value.runId) ? value.runId : defaults.runId,
    sound: typeof value.sound === 'boolean' ? value.sound : false,
    steady: typeof value.steady === 'boolean' ? value.steady : defaults.steady,
    records: {},
  };
  if (value.records && typeof value.records === 'object' && !Array.isArray(value.records)) {
    for (const id of RUN_IDS) {
      if (!Object.hasOwn(value.records, id)) continue;
      const record = recordValue(value.records[id]);
      if (record) normalized.records[id] = record;
    }
  }
  return normalized;
}

export function loadSave(storage, reducedMotion = false) {
  let raw;
  try { raw = storage.getItem(KEY); }
  catch { return { value: normalizeSave(null, reducedMotion), available: false }; }
  let value = null;
  try { value = raw ? JSON.parse(raw) : null; }
  catch { /* Corrupt saved JSON does not mean the storage API is unavailable. */ }
  return { value: normalizeSave(value, reducedMotion), available: true };
}

export function writeSave(storage, value) {
  try { storage.setItem(KEY, JSON.stringify(normalizeSave(value))); return true; }
  catch { return false; }
}

export function keepRecord(save, ride) {
  if (!ride || ride.status !== 'finished' || ride.mode !== 'course' || !RUN_IDS.includes(ride.runId)) {
    return { value: save, improved: false };
  }
  const candidate = recordValue(ride);
  if (!candidate) return { value: save, improved: false };
  const normalized = normalizeSave(save);
  const previous = normalized.records[ride.runId];
  const improved = !previous || candidate.adjustedTime < previous.adjustedTime
    || (candidate.adjustedTime === previous.adjustedTime && candidate.time < previous.time);
  if (!improved) return { value: save, improved: false };
  return {
    value: { ...normalized, records: { ...normalized.records, [ride.runId]: candidate } },
    improved: true,
  };
}
