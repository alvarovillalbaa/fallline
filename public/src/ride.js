// Assisted arcade riding. Shared terrain and world objects are authoritative;
// these rules are game mechanics, not a model of real-world snowboarding.
const STEP = 1 / 120;
const MAX_FRAME = 0.1;
const GRAVITY = 9.81;
const RIDER_RADIUS = 0.65;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const finite = (value, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const mix = (a, b, fraction) => a + (b - a) * fraction;
function freeze(value) {
  for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child);
  return Object.freeze(value);
}
const flags = (id, points, width) => points.map(([x, z], index) => ({ id: `${id}-flag-${index + 1}`, x, z, width }));
const trees = (id, points) => points.map(([x, z], index) => ({ id: `${id}-tree-${index + 1}`, type: 'tree', x, z, radius: 1.7, height: 13 }));
const rocks = (id, points) => points.map(([x, z], index) => ({ id: `${id}-rock-${index + 1}`, type: 'rock', x, z, radius: 1.4, height: 0.95 }));

export const RUNS = freeze([
  {
    id: 'meadow', name: 'Meadow', subtitle: 'Find your first line', difficulty: 'Gentle',
    description: 'A broad, forgiving meadow. Make small turns through eight roomy flags, with space to try a jump.',
    length: 1100, halfWidth: 65, slope: 0.155, startSpeed: 10,
    colors: { sky: '#B9D5E5', horizon: '#F0E7DB', snow: '#F4F5EE', shadow: '#B4CCDB', pine: '#597B70', accent: '#D99760' },
    flags: flags('meadow', [[0, 140], [10, 270], [-10, 400], [-16, 530], [12, 660], [18, 790], [-8, 920], [0, 1040]], 24),
    obstacles: [...trees('meadow', [[-43, 245], [43, 420], [-45, 650], [44, 895]]), ...rocks('meadow', [[-29, 345], [30, 805]])],
    ramps: [{ id: 'meadow-ramp-1', x: 28, z: 560, width: 13, length: 16, height: 1.8 }],
  },
  {
    id: 'pines', name: 'Pines', subtitle: 'Carve between the trees', difficulty: 'Flowing',
    description: 'A little more slope and ten linked turns. Follow the openings, and give the pines plenty of room.',
    length: 1450, halfWidth: 70, slope: 0.185, startSpeed: 11,
    colors: { sky: '#B7CCD9', horizon: '#ECE4DA', snow: '#F0F3EB', shadow: '#ABC2D0', pine: '#3F6D61', accent: '#CF8C5D' },
    flags: flags('pines', [[0, 150], [-18, 285], [16, 420], [23, 555], [-14, 690], [-22, 825], [14, 960], [22, 1095], [-14, 1230], [0, 1380]], 22),
    obstacles: [...trees('pines', [[-45, 230], [44, 350], [-44, 500], [46, 710], [-47, 890], [45, 1130], [-44, 1320]]), ...rocks('pines', [[29, 640], [-31, 1040]])],
    ramps: [{ id: 'pines-ramp-1', x: -29, z: 470, width: 13, length: 17, height: 2 }, { id: 'pines-ramp-2', x: 30, z: 1010, width: 13, length: 17, height: 2 }],
  },
  {
    id: 'ridge', name: 'Ridge', subtitle: 'Link the longer descent', difficulty: 'Lively',
    description: 'An open ridge with twelve flowing flags, a faster fall line and optional lips beside the main route.',
    length: 1800, halfWidth: 78, slope: 0.215, startSpeed: 12,
    colors: { sky: '#B3C9DC', horizon: '#EFE4DB', snow: '#F5F4EF', shadow: '#AFBED0', pine: '#56766C', accent: '#C27F67' },
    flags: flags('ridge', [[0, 150], [22, 285], [-18, 420], [-27, 555], [20, 690], [27, 825], [-18, 960], [-26, 1095], [18, 1230], [26, 1365], [-18, 1500], [0, 1660]], 22),
    obstacles: [...trees('ridge', [[-49, 230], [49, 380], [-50, 600], [48, 900], [-49, 1160], [50, 1450], [-48, 1650]]), ...rocks('ridge', [[32, 500], [-33, 1000], [34, 1550]])],
    ramps: [{ id: 'ridge-ramp-1', x: 32, z: 735, width: 14, length: 18, height: 2.2 }, { id: 'ridge-ramp-2', x: -32, z: 1300, width: 14, length: 18, height: 2.2 }],
  },
]);

export function getRun(id) {
  return RUNS.find(run => run.id === String(id).toLowerCase()) || RUNS[0];
}
const selectedRun = run => run && typeof run === 'object' ? run : getRun(run);

export function terrainHeight(run, x, z, mode = 'course') {
  const selected = selectedRun(run);
  x = clamp(finite(x), -10_000_000, 10_000_000); z = clamp(finite(z), -10_000_000, 10_000_000);
  return -finite(selected.slope, 0.155) * z + 1.4 * Math.sin(z * 0.012)
    + 0.5 * Math.sin(z * 0.004 + x * 0.018) + 0.0009 * x * x;
}

export function rampHeight(ramp, x, z) {
  const width = finite(ramp?.width), length = finite(ramp?.length);
  if (width <= 0 || length <= 0 || !Number.isFinite(x) || !Number.isFinite(z)
    || Math.abs(x - finite(ramp.x)) > width / 2 || z < finite(ramp.z) || z > finite(ramp.z) + length) return 0;
  return clamp((z - finite(ramp.z)) / length, 0, 1) * clamp(finite(ramp.height), 0, 6);
}

function random(index, seed) {
  let hash = Math.imul((index | 0) ^ seed, 0x45d9f3b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}

export function getWorld(run, zMin, zMax, mode = 'course') {
  const selected = selectedRun(run);
  let low = clamp(finite(zMin), -10_000_000, 10_000_000);
  let high = clamp(finite(zMax, low), -10_000_000, 10_000_000);
  if (high < low) [low, high] = [high, low];
  high = Math.min(high, low + 4000);
  if (mode !== 'free') return {
    flags: selected.flags.filter(flag => flag.z >= low && flag.z <= high),
    obstacles: selected.obstacles.filter(object => object.z + object.radius >= low && object.z - object.radius <= high),
    ramps: selected.ramps.filter(ramp => ramp.z + ramp.length >= low && ramp.z <= high),
  };
  const obstacles = [], ramps = [];
  const seed = selected.id === 'ridge' ? 79 : selected.id === 'pines' ? 43 : 17;
  // Rebuild only the queried chunks. IDs/positions do not depend on query history.
  for (let chunk = Math.max(1, Math.floor((low - 24) / 180)); chunk <= Math.floor(high / 180); chunk++) {
    const start = chunk * 180;
    for (let side = 0; side < 2; side++) {
      const x = (side ? 1 : -1) * (selected.halfWidth * 0.53 + random(chunk, seed + side) * selected.halfWidth * 0.28);
      const z = start + 24 + random(chunk, seed + side + 3) * 90;
      if (z + 1.8 >= low && z - 1.8 <= high) obstacles.push({ id: `${selected.id}-free-tree-${chunk}-${side}`, type: 'tree', x, z, radius: 1.8, height: 12 + random(chunk, seed + side + 7) * 4 });
    }
    const z = start + 88;
    if (z + 1.35 >= low && z - 1.35 <= high) obstacles.push({ id: `${selected.id}-free-rock-${chunk}`, type: 'rock', x: (random(chunk, seed + 11) - 0.5) * selected.halfWidth * 0.85, z, radius: 1.35, height: 0.8 + random(chunk, seed + 12) * 0.3 });
    if (chunk % 3 === 1) {
      const ramp = { id: `${selected.id}-free-ramp-${chunk}`, x: (random(chunk, seed + 16) - 0.5) * selected.halfWidth * 0.8, z: start + 132, width: 13, length: 16, height: 1.9 };
      if (ramp.z + ramp.length >= low && ramp.z <= high) ramps.push(ramp);
    }
  }
  return { flags: [], obstacles, ramps };
}

function surfaceHeight(run, x, z, ramps, mode) {
  return terrainHeight(run, x, z, mode) + ramps.reduce((height, ramp) => Math.max(height, rampHeight(ramp, x, z)), 0);
}

export function createRide(runId, mode = 'course') {
  const run = getRun(runId);
  return {
    runId: run.id, mode: mode === 'free' ? 'free' : 'course', status: 'riding',
    x: 0, y: terrainHeight(run, 0, 0), z: 0, vx: 0, vy: -run.slope * run.startSpeed, vz: run.startSpeed,
    speed: run.startSpeed, heading: 0, lean: 0, onGround: true,
    time: 0, flagIndex: 0, passed: 0, missed: 0, airTime: 0, jumps: 0, adjustedTime: 0,
    lastEvent: null, _remainder: 0, _eventId: 0, _jumpHeld: false,
  };
}
function event(state, type, text) {
  state._eventId = finite(state._eventId) + 1;
  state.lastEvent = { id: state._eventId, type, text };
}

// Return the part of the segment inside an obstacle's horizontal footprint.
function sweptInterval(before, after, obstacle) {
  const dx = after.x - before.x, dz = after.z - before.z;
  const ox = before.x - obstacle.x, oz = before.z - obstacle.z;
  const radius = obstacle.radius + RIDER_RADIUS;
  const a = dx * dx + dz * dz, c = ox * ox + oz * oz - radius * radius;
  if (a < 1e-15) return c <= 0 ? [0, 1] : null;
  const b = 2 * (ox * dx + oz * dz), discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const root = Math.sqrt(discriminant);
  const enter = Math.max(0, (-b - root) / (2 * a)), exit = Math.min(1, (-b + root) / (2 * a));
  return enter <= exit ? [enter, exit] : null;
}

function integrate(state, run, controls) {
  const before = { x: state.x, y: state.y, z: state.z, time: state.time, airTime: state.airTime };
  const world = getWorld(run, state.z - 40, state.z + 60, state.mode);
  const turn = controls.turn;
  const jump = controls.jump && !state._jumpHeld;
  state._jumpHeld = controls.jump;
  if (jump && state.onGround) {
    state.onGround = false; state.vy += 6.6; state.jumps++;
    event(state, 'jump', 'A little airtime. Keep your landing line clear.');
  }
  const airborne = !state.onGround;
  const response = airborne ? 1.4 : 4.8;
  state.heading += (turn * 0.68 - state.heading) * (1 - Math.exp(-response * STEP));
  state.lean += (turn * 0.57 - state.lean) * (1 - Math.exp(-5 * STEP));
  const directionX = Math.sin(state.heading), directionZ = Math.cos(state.heading);
  const grade = terrainHeight(run, state.x - directionX * 0.5, state.z - directionZ * 0.5, state.mode)
    - terrainHeight(run, state.x + directionX * 0.5, state.z + directionZ * 0.5, state.mode);
  const gravity = airborne ? 0 : GRAVITY * grade / Math.sqrt(1 + grade * grade);
  const drag = (controls.tuck ? 0.0026 : 0.0058) * state.speed * state.speed + 0.03 * state.speed;
  const carving = airborne ? 0 : 0.8 * Math.abs(directionX) + 0.045 * state.speed * Math.abs(turn);
  const braking = controls.brake && !airborne ? 5.8 : 0;
  state.speed = clamp(state.speed + (gravity - drag - carving - braking) * STEP, 0, 38);
  state.vx = state.speed * directionX; state.vz = state.speed * directionZ;
  state.x += state.vx * STEP; state.z += state.vz * STEP;
  const surface = surfaceHeight(run, state.x, state.z, world.ramps, state.mode);
  let airFraction = airborne ? 1 : 0;
  if (airborne) {
    state.y += state.vy * STEP - GRAVITY * STEP * STEP / 2;
    state.vy -= GRAVITY * STEP;
    if (state.y <= surface) {
      const previousSurface = surfaceHeight(run, before.x, before.z, world.ramps, state.mode);
      const oldClearance = Math.max(0, before.y - previousSurface), newClearance = state.y - surface;
      airFraction = oldClearance > 0 ? clamp(oldClearance / (oldClearance - newClearance), 0, 1) : 0;
      state.y = surface; state.onGround = true; state.vy = (state.y - before.y) / STEP;
      event(state, 'land', 'Back on the snow. Find your next turn.');
    }
  } else {
    const crest = world.ramps.find(ramp => before.z < ramp.z + ramp.length && state.z >= ramp.z + ramp.length
      && Math.abs(mix(before.x, state.x, (ramp.z + ramp.length - before.z) / Math.max(1e-12, state.z - before.z)) - ramp.x) <= ramp.width / 2);
    if (crest) {
      const fraction = clamp((crest.z + crest.length - before.z) / Math.max(1e-12, state.z - before.z), 0, 1);
      const x = mix(before.x, state.x, fraction), z = crest.z + crest.length;
      const launchY = terrainHeight(run, x, z, state.mode) + crest.height;
      const gradeZ = terrainHeight(run, x, z + 0.5, state.mode) - terrainHeight(run, x, z - 0.5, state.mode);
      const launchVy = state.vz * (gradeZ + crest.height / crest.length) + 2.3;
      const remainder = STEP * (1 - fraction);
      state.y = launchY + launchVy * remainder - GRAVITY * remainder * remainder / 2;
      state.vy = launchVy - GRAVITY * remainder; state.onGround = false; state.jumps++;
      airFraction = 1 - fraction;
      event(state, 'jump', 'Off the lip. Keep a clear landing line.');
    } else if (before.y - surface > Math.max(0.2, Math.abs(state.vy) * STEP + 0.08)) {
      state.onGround = false; state.y = before.y + state.vy * STEP - GRAVITY * STEP * STEP / 2;
      state.vy -= GRAVITY * STEP; airFraction = 1;
    } else {
      state.y = surface; state.vy = (state.y - before.y) / STEP;
    }
  }
  state.time += STEP; state.airTime += airFraction * STEP;

  let stop = 1, reason = null, finish = false;
  if (Math.abs(state.x) >= run.halfWidth) {
    const edge = Math.sign(state.x) * run.halfWidth;
    stop = clamp((edge - before.x) / (state.x - before.x || 1), 0, 1);
    reason = 'Beyond the marked snow. Try an earlier, gentler turn.';
  }
  for (const obstacle of world.obstacles) {
    const interval = sweptInterval(before, state, obstacle);
    if (!interval) continue;
    const top = terrainHeight(run, obstacle.x, obstacle.z, state.mode) + obstacle.height + 0.12;
    const entryY = mix(before.y, state.y, interval[0]), exitY = mix(before.y, state.y, interval[1]);
    if (Math.min(entryY, exitY) > top) continue;
    const impact = entryY <= top ? interval[0] : mix(interval[0], interval[1], clamp((entryY - top) / (entryY - exitY), 0, 1));
    if (impact <= stop) {
      stop = impact; reason = obstacle.type === 'tree' ? 'Caught a pine. Give the next one a wider line.' : 'Caught a rock. Turn around it, or time a jump before it.';
    }
  }
  if (state.mode !== 'free' && state.z >= run.length) {
    const fraction = before.z < run.length ? (run.length - before.z) / Math.max(1e-12, state.z - before.z) : 0;
    if (!reason || fraction < stop) { stop = clamp(fraction, 0, 1); reason = null; finish = true; }
  }
  if (stop < 1) {
    state.x = mix(before.x, state.x, stop); state.y = mix(before.y, state.y, stop); state.z = mix(before.z, state.z, stop);
    state.time = before.time + STEP * stop; state.airTime = before.airTime + airFraction * STEP * stop;
  }
  if (state.mode !== 'free') {
    while (state.flagIndex < run.flags.length && state.z >= run.flags[state.flagIndex].z) {
      const flag = run.flags[state.flagIndex], crossed = before.z < flag.z;
      const fraction = crossed ? clamp((flag.z - before.z) / Math.max(1e-12, state.z - before.z), 0, 1) : 0;
      const x = mix(before.x, state.x, fraction);
      state.flagIndex++;
      if (crossed && Math.abs(x - flag.x) <= flag.width / 2) {
        state.passed++; event(state, 'flag', `Flag ${state.flagIndex} cleared. Keep your rhythm.`);
      } else {
        state.missed++; event(state, 'miss', `Flag ${state.flagIndex} missed · four seconds added.`);
      }
    }
  }
  if (reason) { state.status = 'crashed'; event(state, 'crash', reason); }
  else if (finish) { state.status = 'finished'; event(state, 'finish', `${run.name} complete · ${state.passed} of ${run.flags.length} flags.`); }
  state.adjustedTime = state.time + state.missed * 4;
}

export function stepRide(state, controls = {}, dt = 0) {
  if (state.status !== 'riding') return state;
  const elapsed = clamp(finite(dt), 0, MAX_FRAME);
  if (!elapsed) return state;
  const run = getRun(state.runId), next = { ...state };
  const input = { turn: clamp(finite(controls?.turn), -1, 1), brake: controls?.brake === true, tuck: controls?.tuck === true, jump: controls?.jump === true };
  let remainder = clamp(finite(state._remainder), 0, STEP) + elapsed;
  while (remainder + 1e-12 >= STEP && next.status === 'riding') { integrate(next, run, input); remainder -= STEP; }
  next._remainder = next.status === 'riding' ? Math.max(0, remainder) : 0;
  return next;
}
