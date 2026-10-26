import { RUNS, getRun, createRide, stepRide } from './ride.js';
import { createRenderer } from './renderer.js';
import { createRideAudio } from './audio.js';
import { loadSave, writeSave, keepRecord } from './records.js';

const byId = id => document.getElementById(id);
const canvas = byId('slope');
const mountain = byId('mountain');
const guide = byId('guide-dialog');
const audio = createRideAudio();
let storage;
try { storage = window.localStorage; } catch { storage = null; }
let { value: save, available: storageAvailable } = loadSave(storage, window.matchMedia('(prefers-reduced-motion: reduce)').matches);
let run = getRun(save.runId);
let ride = createRide(run.id);
let mode = 'menu';
let renderer, observer, animationFrame;
let lastFrame = 0, lastHud = 0, lastEventId = 0, eventUntil = 0;
let audioRequest = 0;
const keys = new Set();
const pointers = new Map();
const pulses = new Map();
const runButtons = new Map();
const touchButtons = [...document.querySelectorAll('[data-action]')];
const rideKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space']);

function formatTime(seconds) {
  const tenths = Math.floor(Math.max(0, seconds) * 10);
  return `${String(Math.floor(tenths / 600)).padStart(2, '0')}:${String(Math.floor(tenths / 10) % 60).padStart(2, '0')}.${tenths % 10}`;
}
function storageNotice() {
  byId('storage-notice').hidden = storageAvailable;
  byId('storage-notice').textContent = 'Your browser could not save preferences or records. You can still ride; this visit’s results may not be kept.';
}
function persist() { storageAvailable = writeSave(storage, save); storageNotice(); }
function updateHeld() {
  for (const button of touchButtons) button.dataset.held = String([...pointers.values()].includes(button) || pulses.has(button.dataset.action));
}
function clearInput() {
  keys.clear(); pulses.clear();
  const captures = [...pointers.entries()]; pointers.clear();
  for (const [id, button] of captures) {
    try { button.releasePointerCapture(id); } catch { /* Capture may have already ended. */ }
  }
  updateHeld();
}
function controls(timestamp) {
  let changed = false;
  for (const [action, until] of pulses) if (timestamp >= until) { pulses.delete(action); changed = true; }
  if (changed) updateHeld();
  const held = action => pulses.has(action) || [...pointers.values()].some(button => button.dataset.action === action);
  const left = keys.has('ArrowLeft') || keys.has('KeyA') || held('left');
  const right = keys.has('ArrowRight') || keys.has('KeyD') || held('right');
  return {
    turn: Number(right) - Number(left),
    brake: keys.has('ArrowDown') || keys.has('KeyS') || held('brake'),
    tuck: keys.has('ArrowUp') || keys.has('KeyW') || held('tuck'),
    jump: keys.has('Space') || held('jump'),
  };
}
function announce(text, duration = 2200) {
  byId('ride-event').textContent = text; byId('ride-event').classList.add('visible');
  eventUntil = performance.now() + duration;
}
function showMode(next) {
  mode = next; document.body.dataset.mode = next;
  byId('menu-overlay').hidden = next !== 'menu';
  byId('pause-overlay').hidden = next !== 'paused';
  byId('result-overlay').hidden = next !== 'result';
  byId('error-overlay').hidden = next !== 'error';
  byId('ride-toolbar').hidden = next !== 'riding';
  byId('ride-hud').hidden = next === 'menu' || next === 'error';
  byId('touch-controls').hidden = next !== 'riding';
  byId('progress-rail').hidden = next !== 'riding' || ride.mode === 'free';
  byId('next-flag').hidden = next !== 'riding';
  byId('rider-status').hidden = next !== 'riding';
  byId('ride-warning').hidden = true;
  byId('ride-event').classList.remove('visible'); eventUntil = 0;
  clearInput(); lastFrame = 0; lastHud = 0;
  // Stop once at a mode change, so the result frame does not cancel its finish chime.
  audio.update(ride.speed, ride.onGround, next === 'riding');
}
function updateMenu() {
  runButtons.forEach((button, id) => button.setAttribute('aria-pressed', String(id === run.id)));
  byId('run-number').textContent = `RUN ${String(RUNS.findIndex(item => item.id === run.id) + 1).padStart(2, '0')}`;
  byId('run-length').textContent = `${(run.length / 1000).toFixed(1)} KM`;
  byId('run-description').textContent = run.description;
  byId('run-tag').textContent = `${run.name}${ride.mode === 'free' ? ' / Free ride' : ''}`;
  const best = save.records[run.id];
  byId('best-note').textContent = best
    ? `${storageAvailable ? 'Your best' : 'Best this visit'}: ${formatTime(best.adjustedTime)} · ${best.passed}/${run.flags.length} flags`
    : 'Your first tracks are waiting.';
}
function selectRun(id) {
  if (mode !== 'menu') return;
  run = getRun(id); ride = createRide(run.id); save.runId = run.id;
  persist(); updateMenu();
}
function updatePreferences() {
  byId('steady-camera').checked = save.steady;
  byId('sound-button').setAttribute('aria-pressed', String(save.sound));
  byId('sound-label').textContent = save.sound ? 'Sound on' : 'Sound off';
}
function activateSound() {
  const request = ++audioRequest;
  const wanted = save.sound;
  // Called synchronously by a trusted click/key handler before its activation expires.
  void audio.setEnabled(wanted).then(ok => {
    if (request !== audioRequest) return;
    if (wanted && !ok) {
      save.sound = false; updatePreferences(); persist();
      announce('Sound could not start. You can still ride.');
    } else audio.update(ride.speed, ride.onGround, mode === 'riding');
  });
}
function start(free = false) {
  if (!renderer || mode === 'error' || document.hidden) return;
  ride = createRide(run.id, free ? 'free' : 'course'); lastEventId = 0;
  guide.close(); showMode('riding'); updateMenu(); updateHud();
  canvas.focus({ preventScroll: true }); mountain.scrollIntoView({ behavior: 'instant', block: 'nearest' });
  activateSound();
}
function pause(reason = 'Your run is paused.', focus = true) {
  if (mode !== 'riding') return;
  byId('pause-reason').textContent = reason; showMode('paused');
  if (focus && !document.hidden) byId('resume-button').focus({ preventScroll: true });
}
function resume() {
  if (mode !== 'paused' || document.hidden || guide.open) return;
  showMode('riding'); canvas.focus({ preventScroll: true }); activateSound();
}
function menu() {
  ride = createRide(run.id); showMode('menu'); updateMenu();
  byId('start-button').focus({ preventScroll: true });
}
function endRide() {
  if (mode !== 'riding') return;
  const finished = ride.status === 'finished';
  const next = keepRecord(save, ride); save = next.value;
  if (next.improved) persist();
  byId('result-eyebrow').textContent = ride.mode === 'free' ? 'FREE-RIDE LOG' : finished ? 'DOWN TO THE VALLEY' : 'A FRESH START IS A TURN AWAY';
  byId('result-title').textContent = finished ? 'That was a good line.' : 'There’s another run in you.';
  byId('result-message').textContent = finished ? `${run.name}, complete. Take a breath, then see what the next run brings.` : ride.lastEvent?.text || 'The ride ended. Leave more room for your next turn.';
  byId('result-time').textContent = formatTime(finished ? ride.adjustedTime : ride.time);
  byId('result-time-label').textContent = finished ? 'ADJUSTED TIME' : 'TIME ON THE SLOPE';
  byId('result-flags').textContent = ride.mode === 'free' ? 'Free ride' : `${ride.passed} / ${run.flags.length}`;
  byId('result-air').textContent = `${ride.airTime.toFixed(1)}s`;
  byId('result-jumps').textContent = String(ride.jumps);
  byId('result-detail').textContent = ride.mode === 'free' ? `${(ride.z / 1000).toFixed(2)} km down the mountain.`
    : `${formatTime(ride.time)} on the slope + ${ride.missed * 4}s for ${ride.missed} missed ${ride.missed === 1 ? 'flag' : 'flags'}.`;
  byId('record-message').textContent = next.improved
    ? storageAvailable ? 'A new personal best. Saved on this device.' : 'A new personal best for this visit.'
    : ride.mode === 'free' ? 'Free rides don’t replace course records.'
      : finished ? save.records[run.id]
        ? `Best ${storageAvailable ? 'on this device' : 'this visit'}: ${formatTime(save.records[run.id].adjustedTime)}.`
        : 'Run complete. This time is outside the local record limits.'
        : 'Only completed course runs become personal bests.';
  showMode('result'); updateHud(); updateMenu();
  if (finished) audio.chime('finish');
  byId('again-button').focus({ preventScroll: true });
}
function writeNumber(id, value, unit) {
  const element = byId(id); element.firstChild.textContent = `${value} `;
  element.querySelector('small').textContent = unit;
}
function updateHud() {
  writeNumber('speed', Math.round(ride.speed * 3.6), 'km/h');
  byId('run-time').textContent = formatTime(ride.time);
  byId('penalty').textContent = ride.mode === 'free' ? 'Free ride' : ride.missed ? `+${ride.missed * 4}s penalties` : 'No penalties';
  writeNumber('flags', ride.mode === 'free' ? '—' : ride.passed, ride.mode === 'free' ? 'free' : `/ ${run.flags.length}`);
  byId('progress-fill').style.height = `${Math.max(0, Math.min(100, ride.z / run.length * 100))}%`;
  const next = run.flags[ride.flagIndex];
  const offset = next ? next.x - ride.x : 0;
  byId('next-flag').textContent = ride.mode === 'free' ? `${(ride.z / 1000).toFixed(2)} km · Find your own line`
    : next ? `Flag ${ride.flagIndex + 1} · ${Math.max(0, Math.round(next.z - ride.z))} m ahead${Math.abs(offset) > 5 ? ` · ${Math.round(Math.abs(offset))} m ${offset > 0 ? 'right' : 'left'}` : ''}`
      : `${Math.max(0, Math.round(run.length - ride.z))} m to the finish`;
  byId('rider-status').textContent = ride.onGround ? 'RIDING' : 'IN THE AIR';
  const warning = mode === 'riding' && Math.abs(ride.x) > run.halfWidth - 15
    ? `Slope edge. Carve ${ride.x > 0 ? 'left' : 'right'} to stay on the mountain.` : '';
  byId('ride-warning').textContent = warning; byId('ride-warning').hidden = !warning;
}

for (const [index, item] of RUNS.entries()) {
  const button = document.createElement('button'); button.type = 'button'; button.className = 'run-option';
  const label = document.createElement('small'); label.textContent = `0${index + 1} · ${item.difficulty}`;
  const name = document.createElement('strong'); name.textContent = item.name;
  button.append(label, name); button.setAttribute('aria-label', `${item.name}: ${item.subtitle}`);
  button.addEventListener('click', () => selectRun(item.id)); byId('run-options').append(button); runButtons.set(item.id, button);
}
byId('start-button').addEventListener('click', () => start());
byId('free-button').addEventListener('click', () => start(true));
byId('pause-button').addEventListener('click', () => pause());
byId('resume-button').addEventListener('click', resume);
byId('restart-button').addEventListener('click', () => start(ride.mode === 'free'));
byId('again-button').addEventListener('click', () => start(ride.mode === 'free'));
byId('pause-menu-button').addEventListener('click', menu);
byId('result-menu-button').addEventListener('click', menu);
byId('steady-camera').addEventListener('change', event => { save.steady = event.target.checked; persist(); });
byId('sound-button').addEventListener('click', () => { save.sound = !save.sound; updatePreferences(); persist(); activateSound(); });
byId('guide-button').addEventListener('click', () => { pause('Your run is paused while you read the guide.', false); guide.showModal(); });
byId('close-guide').addEventListener('click', () => guide.close());
byId('guide-done').addEventListener('click', () => guide.close());
byId('reload-button').addEventListener('click', () => window.location.reload());

function interrupt(reason) {
  pause(reason, false); clearInput(); lastFrame = 0; audioRequest++;
  void audio.setEnabled(false);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) interrupt('Your run is paused while this tab is away.'); });
window.addEventListener('blur', () => interrupt('Your run is paused because the window lost focus.'));
window.addEventListener('pagehide', event => {
  interrupt('Your run is paused while this page is away.');
  if (!event.persisted) { cancelAnimationFrame(animationFrame); observer?.disconnect(); audio.destroy(); renderer?.destroy(); }
});
window.addEventListener('pageshow', event => { if (event.persisted) { lastFrame = 0; resize(); } });
window.addEventListener('keydown', event => {
  if (guide.open || event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) || event.metaKey || event.ctrlKey || event.altKey) return;
  if ((event.code === 'KeyP' || event.code === 'Escape') && (mode === 'riding' || mode === 'paused')) {
    event.preventDefault(); if (!event.repeat) { if (mode === 'riding') pause(); else resume(); } return;
  }
  if (mode !== 'riding' || event.target.closest('button,a')) return;
  if (event.code === 'KeyR') { event.preventDefault(); if (!event.repeat) start(ride.mode === 'free'); return; }
  if (rideKeys.has(event.code)) { event.preventDefault(); keys.add(event.code); }
});
window.addEventListener('keyup', event => keys.delete(event.code));
for (const button of touchButtons) {
  button.addEventListener('pointerdown', event => {
    if (mode !== 'riding' || event.button !== 0) return;
    event.preventDefault(); pointers.set(event.pointerId, button);
    try { button.setPointerCapture(event.pointerId); } catch { /* Release outside the button is also handled globally. */ }
    canvas.focus({ preventScroll: true }); updateHeld();
  });
  button.addEventListener('lostpointercapture', event => { if (pointers.delete(event.pointerId)) updateHeld(); });
  button.addEventListener('click', event => {
    if (mode !== 'riding' || event.detail !== 0) return;
    // Native keyboard/assistive clicks have no pointer to hold; give them a short input pulse.
    pulses.set(button.dataset.action, performance.now() + 180); updateHeld();
  });
  button.addEventListener('contextmenu', event => event.preventDefault());
}
for (const type of ['pointerup', 'pointercancel']) window.addEventListener(type, event => {
  const button = pointers.get(event.pointerId);
  if (!button) return;
  pointers.delete(event.pointerId);
  try { button.releasePointerCapture(event.pointerId); } catch { /* Capture is already gone on cancellation. */ }
  updateHeld();
});

function resize() {
  if (!renderer) return;
  const rect = canvas.getBoundingClientRect(); renderer.resize(rect.width, rect.height, window.devicePixelRatio || 1);
}
function fail(error) {
  audioRequest++; void audio.setEnabled(false); showMode('error');
  console.error('Fallline view failed:', error instanceof Error ? error.message : 'Unknown rendering error');
}
function frame(timestamp) {
  if (!renderer || mode === 'error') return;
  const dt = lastFrame ? Math.min(0.1, Math.max(0, (timestamp - lastFrame) / 1000)) : 0;
  lastFrame = timestamp;
  try {
    if (mode === 'riding') {
      ride = stepRide(ride, controls(timestamp), dt);
      if (ride.lastEvent && ride.lastEvent.id !== lastEventId) {
        lastEventId = ride.lastEvent.id; announce(ride.lastEvent.text);
        if (ride.lastEvent.type === 'flag') audio.chime('flag');
      }
      audio.update(ride.speed, ride.onGround, true);
      if (ride.status !== 'riding') endRide();
    }
    renderer.render(ride, run, { steadyCamera: save.steady, preview: mode === 'menu' });
    if (timestamp - lastHud >= 100) { if (mode !== 'menu') updateHud(); lastHud = timestamp; }
    if (eventUntil && timestamp >= eventUntil) { byId('ride-event').classList.remove('visible'); eventUntil = 0; }
    animationFrame = requestAnimationFrame(frame);
  } catch (error) { fail(error); }
}
updatePreferences(); updateMenu(); storageNotice(); showMode('menu');
try {
  renderer = createRenderer(canvas); resize();
  if ('ResizeObserver' in window) { observer = new ResizeObserver(resize); observer.observe(mountain); }
  window.addEventListener('resize', resize, { passive: true });
  animationFrame = requestAnimationFrame(frame);
} catch (error) { fail(error); }
