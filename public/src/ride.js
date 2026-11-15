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
// Biomes define a visual identity, never a pre-authored scene. Every flag,
// obstacle, ramp and terrain phase is derived from a versioned seed and level.
export const MAPS = freeze([
  { id: 'meadow', name: 'Alpine', sky: '#B9D5E5', snow: '#F4F5EE', pine: '#597B70' },
  { id: 'pines', name: 'Black Pines', sky: '#9BBCC9', snow: '#E8F0EB', pine: '#28584E' },
  { id: 'ridge', name: 'High Ridge', sky: '#B3C9DC', snow: '#F5F4EF', pine: '#56766C' },
  { id: 'glacier', name: 'Blue Glacier', sky: '#8CBADD', snow: '#DAECF6', pine: '#54788E' },
  { id: 'sunset', name: 'Last Light', sky: '#D6AFBE', snow: '#F5E4E4', pine: '#655F7E' },
  { id: 'storm', name: 'Storm Pass', sky: '#8498B0', snow: '#D8E0E9', pine: '#3D536A' },
]);
const generated = new Map();
export function levelId(map, seed, level) {
  if (!MAPS.some(item => item.id === map) || !Number.isInteger(seed) || seed < 1 || seed > 0xffffffff
    || !Number.isInteger(level) || level < 1 || level > 50) return null;
  return `v2-${map}-${seed}-${level}`;
}
export function parseLevel(id) {
  const match = typeof id === 'string' && /^v2-([a-z]+)-(\d{1,10})-(\d{1,2})$/.exec(id);
  if (!match || levelId(match[1], Number(match[2]), Number(match[3])) !== id) return null;
  return { map: match[1], seed: Number(match[2]), level: Number(match[3]) };
}
function generateRun(map, seed, level, id) {
  const biome = MAPS.find(item => item.id === map);
  const difficulty = (level - 1) / 49;
  const count = 9 + Math.floor(difficulty * 9), spacing = 125 - difficulty * 28;
  const phase = random(seed, 91 + MAPS.findIndex(item => item.id === map) * 37) * Math.PI * 2;
  const halfWidth = map === 'ridge' ? 64 : map === 'glacier' ? 78 : 70;
  const line = z => Math.sin(z / 170 + phase) * (15 + difficulty * 8)
    + Math.sin(z / 340 + phase) * 7;
  const flags = Array.from({ length: count }, (_, index) => ({ id: `${id}-flag-${index}`,
    x: line(150 + index * spacing), z: 150 + index * spacing, width: 23 - difficulty * 9 }));
  const racingLine = z => {
    const next = flags.find(flag => flag.z >= z);
    if (!next) return flags.at(-1).x;
    const previous = flags[flags.indexOf(next) - 1] || { x: 0, z: 0 };
    return mix(previous.x, next.x, (z - previous.z) / (next.z - previous.z));
  };
  const length = flags.at(-1).z + 95;
  const obstacles = [], ramps = [];
  const density = 3 + Math.floor(difficulty * 3) + (map === 'pines' ? 2 : 0);
  for (let chunk = 1; chunk * 105 < length - 95; chunk++) {
    for (let index = 0; index < density; index++) {
      const z = chunk * 105 + random(chunk * 13 + index, seed) * 65;
      let x = (random(chunk * 17 + index, seed + 1) - 0.5) * (halfWidth * 1.8);
      // Leave a navigable racing line, with jumpable rocks on optional trick lines.
      const clearance = 12 - difficulty * 3;
      if (Math.abs(x - racingLine(z)) < clearance) x = racingLine(z) + (x < racingLine(z) ? -1 : 1) * clearance;
      const rock = index % 3 === 2;
      obstacles.push({ id: `${id}-object-${chunk}-${index}`, type: rock ? 'rock' : 'tree', x, z,
        radius: rock ? 1.4 : 1.7, height: rock ? 0.9 : 11 + random(chunk, seed + index) * 5 });
    }
    if (chunk % 2 === 0) ramps.push({ id: `${id}-ramp-${chunk}`, x: line(chunk * 105) + (chunk % 4 ? -18 : 18),
      z: chunk * 105 + 5, width: 15, length: 20, height: 2.5 + difficulty });
  }
  return freeze({ id, map, seed, level, phase, name: biome.name, subtitle: 'A new line every seed',
    difficulty: `Level ${level}`, description: `${flags.length} gates · ${obstacles.length} obstacles · ${ramps.length} trick ramps · gusting wind`,
    length, halfWidth, slope: 0.32 + difficulty * 0.16 + (map === 'ridge' ? 0.065 : 0),
    startSpeed: 19 + difficulty * 9, maxSpeed: 38 + difficulty * 10, gust: 1.5 + difficulty * 3.5 + (map === 'storm' ? 2 : 0),
    colors: { sky: biome.sky, horizon: '#E8DCD8', snow: biome.snow, shadow: '#A8BCCD', pine: biome.pine, accent: '#ED865F' },
    flags, obstacles, ramps });
}
export const RUNS = freeze(MAPS.map((map, index) => generateRun(map.id, index + 1, 1, map.id)));
export function getRun(id) {
  const base = RUNS.find(run => run.id === String(id).toLowerCase());
  if (base) return base;
  const parts = parseLevel(id);
  if (!parts) return RUNS[0];
  if (!generated.has(id)) {
    if (generated.size >= 64) generated.delete(generated.keys().next().value);
    generated.set(id, generateRun(parts.map, parts.seed, parts.level, id));
  }
  return generated.get(id);
}
const selectedRun = run => run && typeof run === 'object' ? run : getRun(run);

export function terrainHeight(run, x, z, mode = 'course') {
  const selected = selectedRun(run);
  x = clamp(finite(x), -10_000_000, 10_000_000); z = clamp(finite(z), -10_000_000, 10_000_000);
  return -finite(selected.slope, 0.32) * z + 1.4 * Math.sin(z * 0.012 + finite(selected.phase))
    + 0.5 * Math.sin(z * 0.004 + x * 0.018 + finite(selected.phase)) + 0.0009 * x * x;
}

export function sampleWind(run, z, time) {
  return run.gust * (Math.sin(finite(time) * 0.9 + finite(z) * 0.013 + run.phase)
    + 0.35 * Math.sin(finite(time) * 2.3 + run.phase));
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
  const seed = selected.seed;
  // Rebuild only the queried chunks. IDs/positions do not depend on query history.
  for (let chunk = Math.max(1, Math.floor((low - 24) / 180)); chunk <= Math.floor(high / 180); chunk++) {
    const start = chunk * 180;
    for (let side = 0; side < 4 + Math.floor(selected.level / 10); side++) {
      const x = (side % 2 ? 1 : -1) * (selected.halfWidth * 0.34 + random(chunk, seed + side) * selected.halfWidth * 0.5);
      const z = start + 24 + random(chunk, seed + side + 3) * 90;
      if (z + 1.8 >= low && z - 1.8 <= high) obstacles.push({ id: `${selected.id}-free-tree-${chunk}-${side}`, type: 'tree', x, z, radius: 1.8, height: 12 + random(chunk, seed + side + 7) * 4 });
    }
    const z = start + 88;
    if (z + 1.35 >= low && z - 1.35 <= high) obstacles.push({ id: `${selected.id}-free-rock-${chunk}`, type: 'rock', x: (random(chunk, seed + 11) - 0.5) * selected.halfWidth * 0.85, z, radius: 1.35, height: 0.8 + random(chunk, seed + 12) * 0.3 });
    if (chunk % 2 === 1) {
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
    tricks: 0, trickScore: 0, spin: 0, wind: sampleWind(run, 0, 0),
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
  const before = { x: state.x, y: state.y, z: state.z, time: state.time, airTime: state.airTime,
    tricks: state.tricks, trickScore: state.trickScore };
  const world = getWorld(run, state.z - 40, state.z + 60, state.mode);
  const turn = controls.turn;
  const jump = controls.jump && !state._jumpHeld;
  state._jumpHeld = controls.jump;
  if (jump && state.onGround) {
    state.onGround = false; state.vy += 8.2; state.jumps++; state.spin = 0;
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
  const drag = (controls.tuck ? 0.0018 : 0.0032) * state.speed * state.speed + 0.03 * state.speed;
  const carving = airborne ? 0 : 0.8 * Math.abs(directionX) + 0.045 * state.speed * Math.abs(turn);
  const braking = controls.brake && !airborne ? 5.8 : 0;
  state.speed = clamp(state.speed + (gravity - drag - carving - braking) * STEP, 0, run.maxSpeed);
  state.wind = sampleWind(run, state.z, state.time);
  state.vx = state.speed * directionX + state.wind * (airborne ? 1 : 0.35); state.vz = state.speed * directionZ;
  state.x += state.vx * STEP; state.z += state.vz * STEP;
  const surface = surfaceHeight(run, state.x, state.z, world.ramps, state.mode);
  let airFraction = airborne ? 1 : 0;
  if (airborne) {
    if (controls.trick) state.spin += 7 * STEP;
    state.y += state.vy * STEP - GRAVITY * STEP * STEP / 2;
    state.vy -= GRAVITY * STEP;
    if (state.y <= surface) {
      const previousSurface = surfaceHeight(run, before.x, before.z, world.ramps, state.mode);
      const oldClearance = Math.max(0, before.y - previousSurface), newClearance = state.y - surface;
      airFraction = oldClearance > 0 ? clamp(oldClearance / (oldClearance - newClearance), 0, 1) : 0;
      state.y = surface; state.onGround = true; state.vy = (state.y - before.y) / STEP;
      const turns = Math.floor((state.spin + 1e-9) / (Math.PI * 2));
      state.tricks += turns; state.trickScore += turns * 100; state.spin = 0;
      event(state, 'land', turns ? `${turns * 360}° landed · +${turns * 100} trick points` : 'Back on the snow. Find your next turn.');
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
      state.vy = launchVy - GRAVITY * remainder; state.onGround = false; state.jumps++; state.spin = 0;
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
  if (reason) {
    // Collision can stop the substep before its projected landing. Credit only
    // rotations landed in earlier, collision-free substeps.
    state.tricks = before.tricks; state.trickScore = before.trickScore;
    state.status = 'crashed'; event(state, 'crash', reason);
  }
  else if (finish) { state.status = 'finished'; event(state, 'finish', `${run.name} complete · ${state.passed} of ${run.flags.length} flags.`); }
  state.adjustedTime = state.time + state.missed * 4;
}

export function stepRide(state, controls = {}, dt = 0) {
  if (state.status !== 'riding') return state;
  const elapsed = clamp(finite(dt), 0, MAX_FRAME);
  if (!elapsed) return state;
  const run = getRun(state.runId), next = { ...state };
  const input = { turn: clamp(finite(controls?.turn), -1, 1), brake: controls?.brake === true, tuck: controls?.tuck === true, jump: controls?.jump === true, trick: controls?.trick === true };
  let remainder = clamp(finite(state._remainder), 0, STEP) + elapsed;
  while (remainder + 1e-12 >= STEP && next.status === 'riding') { integrate(next, run, input); remainder -= STEP; }
  next._remainder = next.status === 'riding' ? Math.max(0, remainder) : 0;
  return next;
}
