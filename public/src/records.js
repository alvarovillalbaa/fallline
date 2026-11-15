import { MAPS, parseLevel, getRun } from './ride.js';

const KEY = 'fallline.v1';
const RUN_IDS = MAPS.map(map => map.id);
const validId = id => RUN_IDS.includes(id) || Boolean(parseLevel(id));
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
  const defaults = { runId: 'meadow', sound: false, steady: Boolean(reducedMotion), records: {}, progress: { level: 1, levels: [], completed: [] } };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaults;
  const normalized = {
    runId: validId(value.runId) ? value.runId : defaults.runId,
    sound: typeof value.sound === 'boolean' ? value.sound : false,
    steady: typeof value.steady === 'boolean' ? value.steady : defaults.steady,
    records: {},
    progress: {
      level: Number.isInteger(value.progress?.level) && value.progress.level >= 1 && value.progress.level <= 50 ? value.progress.level : 1,
      levels: Array.isArray(value.progress?.levels) ? [...new Set(value.progress.levels.filter(id => parseLevel(id)))].slice(-80) : [],
      completed: Array.isArray(value.progress?.completed) ? [...new Set(value.progress.completed.filter(id => parseLevel(id)))].slice(-80) : [],
    },
  };
  if (value.records && typeof value.records === 'object' && !Array.isArray(value.records)) {
    for (const id of Object.keys(value.records).filter(validId).slice(-100)) {
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
  try {
    const raw = JSON.stringify(normalizeSave(value));
    storage.setItem(KEY, raw); return storage.getItem(KEY) === raw;
  }
  catch { return false; }
}

export function rememberLevel(save, id) {
  const normalized = normalizeSave(save);
  if (!parseLevel(id)) return normalized;
  return { ...normalized, runId: id, progress: { ...normalized.progress,
    levels: [...normalized.progress.levels.filter(item => item !== id), id].slice(-80) } };
}

export function keepRecord(save, ride) {
  if (!ride || ride.status !== 'finished' || ride.mode !== 'course' || !validId(ride.runId)) {
    return { value: save, improved: false };
  }
  const candidate = recordValue(ride);
  if (!candidate) return { value: save, improved: false };
  const level = parseLevel(ride.runId);
  if (level && ride.passed + ride.missed !== getRun(ride.runId).flags.length) return { value: save, improved: false };
  const normalized = normalizeSave(save);
  const advanced = level && !normalized.progress.completed.includes(ride.runId)
    && ride.passed + ride.missed === getRun(ride.runId).flags.length;
  const progress = advanced ? { ...normalized.progress,
    level: Math.min(50, Math.max(normalized.progress.level, level.level + 1)),
    completed: [...normalized.progress.completed, ride.runId].slice(-80) } : normalized.progress;
  const previous = normalized.records[ride.runId];
  const improved = !previous || candidate.adjustedTime < previous.adjustedTime
    || (candidate.adjustedTime === previous.adjustedTime && candidate.time < previous.time);
  if (!improved) return { value: advanced ? { ...normalized, progress } : save, improved: false };
  return {
    value: { ...normalized, progress, records: { ...normalized.records, [ride.runId]: candidate } },
    improved: true,
  };
}
