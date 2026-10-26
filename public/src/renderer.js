import { terrainHeight, getWorld, rampHeight } from './ride.js';

// Projection/clipping utilities adapt our original Driftwing Canvas renderer.
// Fallline's alpine scene, world objects, tracks and articulated rider are new.
const TAU = Math.PI * 2, NEAR = 1.4, FAR = 1050;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const mix = (a, b, amount) => a + (b - a) * amount;
const fract = value => value - Math.floor(value);
const noise = (a, b = 0) => fract(Math.sin(a * 127.1 + b * 311.7) * 43758.5453);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
function unit(point) {
  const size = Math.hypot(point.x, point.y, point.z) || 1;
  return { x: point.x / size, y: point.y / size, z: point.z / size };
}
function rgb(value, fallback) {
  const hex = typeof value === 'string' ? value.replace('#', '') : '';
  if (/^[\da-f]{6}$/i.test(hex)) return [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16));
  if (/^[\da-f]{3}$/i.test(hex)) return [...hex].map(digit => parseInt(digit + digit, 16));
  return fallback;
}
const tint = (a, b, amount) => a.map((value, index) => mix(value, b[index], clamp(amount, 0, 1)));
const color = (values, alpha = 1) => `rgba(${values.map(value => Math.round(clamp(value, 0, 255))).join(',')},${clamp(alpha, 0, 1)})`;

export function createRenderer(canvas) {
  if (!canvas || typeof canvas.getContext !== 'function') throw new Error('Fallline needs a canvas to draw the mountain.');
  let ctx;
  try { ctx = canvas.getContext('2d', { alpha: false, desynchronized: true }); }
  catch { try { ctx = canvas.getContext('2d'); } catch { ctx = null; } }
  if (!ctx) throw new Error('The mountain view could not start. Try a browser with Canvas 2D enabled.');

  let width = 960, height = 640, ratio = 1, destroyed = false;
  let paletteKey = '', palette, historyKey = '', previous = null;
  const flagHistory = new Map(), trail = [];

  function resize(nextWidth, nextHeight, pixelRatio = 1) {
    if (destroyed) return;
    width = clamp(finite(nextWidth, 960), 1, 8192);
    height = clamp(finite(nextHeight, 640), 1, 8192);
    ratio = Math.min(clamp(finite(pixelRatio, 1), 0.75, 2), 4096 / Math.max(width, height), Math.sqrt(8000000 / (width * height)));
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
  }
  function getPalette(run) {
    const key = JSON.stringify(run.colors);
    if (key !== paletteKey) {
      paletteKey = key;
      palette = {
        sky: rgb(run.colors?.sky, [162, 196, 213]), horizon: rgb(run.colors?.horizon, [246, 227, 199]),
        snow: rgb(run.colors?.snow, [248, 246, 233]), shadow: rgb(run.colors?.shadow, [170, 195, 211]),
        pine: rgb(run.colors?.pine, [38, 77, 83]), accent: rgb(run.colors?.accent, [231, 122, 97]),
        navy: [31, 49, 66], ice: [126, 195, 209], cream: [255, 242, 211],
      };
    }
    return palette;
  }
  function surface(run, world, x, z, mode) {
    let rise = 0;
    for (const ramp of world.ramps) rise = Math.max(rise, rampHeight(ramp, x, z));
    return terrainHeight(run, x, z, mode) + rise;
  }
  function cameraFor(state, run, world, steady, preview) {
    const ground = surface(run, world, state.x, state.z, state.mode);
    const air = Math.max(0, state.y - ground);
    const bob = steady || !state.onGround ? 0 : Math.sin(state.time * 7) * clamp(state.speed / 30, 0, 1) * 0.025;
    const eye = { x: state.x, y: ground + 9 + air * 0.35 + bob, z: state.z - 24 };
    const target = { x: state.x + clamp(state.vx * 0.5, -10, 10), y: terrainHeight(run, state.x, state.z + 85, state.mode) + 1.8, z: state.z + 85 };
    const forward = unit({ x: target.x - eye.x, y: target.y - eye.y, z: target.z - eye.z });
    const right = unit(cross({ x: 0, y: 1, z: 0 }, forward)), up = cross(forward, right);
    const camera = { eye, forward, right, up, focal: height * 0.93, cx: width * (preview ? 0.7 : 0.5), cy: 0, roll: steady ? 0 : -state.lean * 0.022 };
    const anchor = inCamera({ x: state.x, y: ground, z: state.z }, camera);
    camera.cy = height * 0.73 + anchor.y * camera.focal / Math.max(NEAR, anchor.z);
    camera.horizon = camera.cy + camera.focal * forward.y / Math.hypot(forward.x, forward.z);
    return camera;
  }
  function inCamera(point, camera) {
    const relative = { x: point.x - camera.eye.x, y: point.y - camera.eye.y, z: point.z - camera.eye.z };
    return { x: dot(relative, camera.right), y: dot(relative, camera.up), z: dot(relative, camera.forward) };
  }
  function screen(point, camera) {
    return point.z < NEAR ? null : { x: camera.cx + point.x * camera.focal / point.z, y: camera.cy - point.y * camera.focal / point.z, depth: point.z };
  }
  const project = (point, camera) => screen(inCamera(point, camera), camera);
  function clip(points, limit, greater) {
    const result = [];
    for (let index = 0; index < points.length; index++) {
      const a = points[index], b = points[(index + 1) % points.length];
      const insideA = greater ? a.z >= limit : a.z <= limit, insideB = greater ? b.z >= limit : b.z <= limit;
      if (insideA) result.push(a);
      if (insideA !== insideB) {
        const amount = (limit - a.z) / (b.z - a.z);
        result.push({ x: mix(a.x, b.x, amount), y: mix(a.y, b.y, amount), z: limit });
      }
    }
    return result;
  }
  function polygon(points, camera, fill, stroke = null, lineWidth = 1) {
    const clipped = clip(clip(points.map(point => inCamera(point, camera)), NEAR, true), FAR, false);
    if (clipped.length < 3) return;
    const projected = clipped.map(point => screen(point, camera));
    if (projected.every(point => point.x < -40) || projected.every(point => point.x > width + 40)
      || projected.every(point => point.y < -40) || projected.every(point => point.y > height + 40)) return;
    ctx.beginPath(); projected.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }
  function line(a, b, camera, stroke, lineWidth = 1) {
    let p = inCamera(a, camera), q = inCamera(b, camera);
    if ((p.z < NEAR && q.z < NEAR) || (p.z > FAR && q.z > FAR)) return;
    for (const limit of [NEAR, FAR]) {
      const outside = value => limit === NEAR ? value < limit : value > limit;
      if (outside(p.z)) { const t = (limit - p.z) / (q.z - p.z); p = { x: mix(p.x, q.x, t), y: mix(p.y, q.y, t), z: limit }; }
      if (outside(q.z)) { const t = (limit - q.z) / (p.z - q.z); q = { x: mix(q.x, p.x, t), y: mix(q.y, p.y, t), z: limit }; }
    }
    const a2 = screen(p, camera), b2 = screen(q, camera);
    if (!a2 || !b2 || Math.max(Math.abs(a2.x), Math.abs(b2.x), Math.abs(a2.y), Math.abs(b2.y)) > 20000) return;
    ctx.beginPath(); ctx.moveTo(a2.x, a2.y); ctx.lineTo(b2.x, b2.y); ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke();
  }
  const fog = (tone, depth, p) => tint(tone, p.horizon, clamp((depth - 90) / FAR, 0, 0.9) ** 0.9);

  function sky(camera, p) {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, color(tint(p.sky, p.navy, 0.24)));
    gradient.addColorStop(0.4, color(p.sky)); gradient.addColorStop(0.72, color(p.horizon)); gradient.addColorStop(1, color(p.snow));
    ctx.fillStyle = gradient; ctx.fillRect(-width, -height, width * 3, height * 3);
    const sunX = width * 0.78, sunY = clamp(camera.horizon - height * 0.18, height * 0.08, height * 0.3);
    const glow = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, height * 0.45);
    glow.addColorStop(0, color(p.cream, 0.5)); glow.addColorStop(1, color(p.cream, 0));
    ctx.fillStyle = glow; ctx.fillRect(sunX - height / 2, sunY - height / 2, height, height);
    ctx.fillStyle = color(p.cream, 0.9); ctx.beginPath(); ctx.arc(sunX, sunY, height * 0.016, 0, TAU); ctx.fill();
    // A decorative skyline beyond the bounded piste, not collision geometry.
    for (let layer = 0; layer < 3; layer++) {
      const base = camera.horizon + height * (0.07 + layer * 0.028);
      for (let index = -2; index <= 8; index++) {
        const span = width * 0.25, x = index * span + (layer % 2) * span * 0.4;
        const summit = base - height * (0.12 + noise(index + 20, layer) * 0.17) * (1 - layer * 0.13);
        const peakX = x + span * (0.45 + noise(index, layer + 8) * 0.25);
        ctx.beginPath(); ctx.moveTo(x - span * 0.4, base); ctx.lineTo(peakX, summit); ctx.lineTo(x + span * 1.5, base); ctx.closePath();
        ctx.fillStyle = color(tint(p.shadow, p.horizon, 0.65 - layer * 0.17)); ctx.fill();
        ctx.beginPath(); ctx.moveTo(peakX, summit); ctx.lineTo(peakX + span * 0.17, base); ctx.lineTo(x + span * 1.5, base); ctx.closePath();
        ctx.fillStyle = color(tint(p.snow, p.horizon, 0.4 + layer * 0.1), 0.85); ctx.fill();
        ctx.beginPath(); ctx.moveTo(peakX, summit); ctx.lineTo(peakX - span * 0.1, summit + height * 0.042); ctx.lineTo(peakX + span * 0.04, summit + height * 0.026); ctx.lineTo(peakX + span * 0.18, summit + height * 0.051); ctx.closePath();
        ctx.fillStyle = color(p.snow, 0.75); ctx.fill();
      }
    }
  }

  function snow(state, run, camera, p) {
    const columns = [-420, -260, -160, -110];
    for (let index = 0; index <= 24; index++) columns.push(mix(-run.halfWidth, run.halfWidth, index / 24));
    columns.push(110, 160, 260, 420);
    const zBase = Math.floor((state.z - 32) / 8) * 8, vertices = [];
    for (let row = 0; row <= 34; row++) {
      const z = zBase + (row / 34) ** 1.65 * 1080;
      vertices.push(columns.map(x => ({ x, y: terrainHeight(run, x, z, state.mode), z })));
    }
    const faces = [], sun = unit({ x: -0.6, y: 0.8, z: -0.4 });
    for (let row = 0; row < 34; row++) for (let column = 0; column < columns.length - 1; column++) {
      const a = vertices[row][column], b = vertices[row][column + 1], c = vertices[row + 1][column], d = vertices[row + 1][column + 1];
      for (const points of [[a, c, b], [b, c, d]]) {
        const normal = unit(cross({ x: points[1].x - points[0].x, y: points[1].y - points[0].y, z: points[1].z - points[0].z },
          { x: points[2].x - points[0].x, y: points[2].y - points[0].y, z: points[2].z - points[0].z }));
        const depth = points.reduce((sum, point) => sum + inCamera(point, camera).z, 0) / 3;
        const outer = Math.abs((a.x + b.x) / 2) > run.halfWidth;
        const shade = clamp((1 - dot(normal, sun)) * 0.34 + (outer ? 0.16 : 0.03), 0.03, 0.5);
        const variation = (Math.sin(a.z * 0.055 + a.x * 0.03) + 1) * 0.015;
        faces.push({ points, depth, fill: color(fog(tint(p.snow, p.shadow, shade + variation), depth, p)) });
      }
    }
    faces.sort((a, b) => b.depth - a.depth);
    for (const face of faces) polygon(face.points, camera, face.fill, face.fill, 0.6);
    for (let index = 0; index < 15; index++) {
      const z = Math.floor(state.z / 34) * 34 + index * 34;
      const x = (noise(index, Math.floor(z / 34)) - 0.5) * run.halfWidth * 2;
      const tone = color(p.shadow, 0.14 * (1 - index / 17));
      line({ x: x - 3, y: terrainHeight(run, x - 3, z, state.mode) + 0.025, z },
        { x: x + 3, y: terrainHeight(run, x + 3, z + 0.4, state.mode) + 0.025, z: z + 0.4 }, camera, tone, 0.8);
    }
  }

  function updateHistory(state, run, preview) {
    const key = `${run.id}:${state.mode}`;
    if (key !== historyKey || (previous && (state.time < previous.time || state.z < previous.z))) {
      historyKey = key; previous = null; trail.length = 0; flagHistory.clear();
    }
    if (previous && state.flagIndex > previous.flagIndex) {
      const passed = state.passed - previous.passed, missed = state.missed - previous.missed;
      for (let index = previous.flagIndex; index < Math.min(state.flagIndex, run.flags.length); index++) flagHistory.set(index, passed > 0 && !missed ? 'passed' : missed > 0 && !passed ? 'missed' : 'past');
      if (passed && missed) flagHistory.set(state.flagIndex - 1, state.lastEvent?.type === 'miss' ? 'missed' : state.lastEvent?.type === 'flag' ? 'passed' : 'past');
    }
    if (!preview && state.onGround && state.status === 'riding' && (!previous || state.time > previous.time)) {
      const last = trail.at(-1);
      if (!last || Math.hypot(state.x - last.x, state.z - last.z) > 0.8) {
        trail.push({ x: state.x, y: state.y + 0.035, z: state.z, time: state.time, break: !previous?.onGround });
        if (trail.length > 110) trail.shift();
      }
    }
    previous = { time: state.time, z: state.z, flagIndex: state.flagIndex, passed: state.passed, missed: state.missed, onGround: state.onGround };
  }
  function tracks(state, camera, p) {
    for (let index = 1; index < trail.length; index++) {
      const a = trail[index - 1], b = trail[index];
      if (b.break) continue;
      const alpha = clamp(0.32 - (state.time - b.time) / 50, 0.03, 0.32);
      const dx = b.x - a.x, dz = b.z - a.z, size = Math.hypot(dx, dz) || 1;
      const side = { x: dz / size * 0.19, z: -dx / size * 0.19 };
      polygon([{ x: a.x - side.x, y: a.y, z: a.z - side.z }, { x: a.x + side.x, y: a.y, z: a.z + side.z },
        { x: b.x + side.x, y: b.y, z: b.z + side.z }, { x: b.x - side.x, y: b.y, z: b.z - side.z }], camera, color(p.shadow, alpha));
    }
  }
  function edges(state, run, camera, p, preview) {
    const zBase = Math.floor(state.z / 40) * 40;
    for (let row = 0; row < 20; row++) for (const side of [-1, 1]) {
      const x = side * run.halfWidth, z = zBase + row * 40, y = terrainHeight(run, x, z, state.mode);
      const close = run.halfWidth - Math.abs(state.x) < 17 && Math.sign(state.x) === side;
      const alpha = (1 - row / 23) * (preview ? 0.55 : 1), tone = close ? p.accent : p.navy;
      line({ x, y: y + 0.05, z }, { x, y: y + 1.8, z }, camera, color(tone, alpha * 0.78), 1.5);
      line({ x, y: y + 1.35, z }, { x, y: y + 1.8, z }, camera, color(p.accent, alpha), 3);
      line({ x, y: y + 0.05, z }, { x, y: terrainHeight(run, x, z + 18, state.mode) + 0.05, z: z + 18 }, camera, color(close ? p.accent : p.ice, alpha * (close ? 0.6 : 0.26)), 1.1);
    }
  }

  function rampObject(ramp, state, run, camera, p) {
    const left = ramp.x - ramp.width / 2, right = ramp.x + ramp.width / 2;
    const point = (x, z, raised = true) => ({ x, y: terrainHeight(run, x, z, state.mode) + (raised ? rampHeight(ramp, x, z) : 0), z });
    for (let row = 5; row >= 0; row--) {
      const z = ramp.z + ramp.length * row / 6, end = ramp.z + ramp.length * (row + 1) / 6;
      polygon([point(left, z), point(right, z), point(right, end), point(left, end)], camera, color(fog(tint(p.snow, p.ice, 0.21 + row * 0.035), z - state.z, p)), color(p.ice, 0.3), 0.8);
      if (row % 2 === 0) line(point(left + 0.25, end), point(right - 0.25, end), camera, color(p.ice, 0.55), 1.6);
    }
    const end = ramp.z + ramp.length;
    for (const x of [left, right]) polygon([point(x, ramp.z, false), point(x, end, false), point(x, end), point(x, ramp.z)], camera, color(tint(p.shadow, p.ice, 0.25), 0.9));
    polygon([point(left, end, false), point(right, end, false), point(right, end), point(left, end)], camera, color(tint(p.shadow, p.navy, 0.15)));
    line(point(left, end), point(right, end), camera, color(p.accent, 0.85), 1.8);
  }
  function obstacleObject(object, state, run, camera, p) {
    const ground = terrainHeight(run, object.x, object.z, state.mode), faces = [];
    const add = (points, tone) => faces.push({ points, depth: points.reduce((sum, point) => sum + inCamera(point, camera).z, 0) / points.length, tone });
    if (object.type === 'tree') {
      const trunk = object.radius * 0.15;
      polygon([{ x: object.x - trunk, y: ground, z: object.z }, { x: object.x + trunk, y: ground, z: object.z },
        { x: object.x + trunk, y: ground + object.height * 0.45, z: object.z }, { x: object.x - trunk, y: ground + object.height * 0.45, z: object.z }], camera, color(fog(tint(p.pine, p.navy, 0.5), object.z - state.z, p)));
      for (let layer = 0; layer < 3; layer++) {
        const bottom = ground + object.height * (0.12 + layer * 0.23), top = ground + object.height * (0.65 + layer * 0.175);
        const radius = object.radius * (1 - layer * 0.23);
        for (let side = 0; side < 7; side++) {
          const a = side / 7 * TAU, b = (side + 1) / 7 * TAU;
          const points = [{ x: object.x + Math.cos(a) * radius, y: bottom, z: object.z + Math.sin(a) * radius },
            { x: object.x + Math.cos(b) * radius, y: bottom, z: object.z + Math.sin(b) * radius }, { x: object.x, y: top, z: object.z }];
          add(points, tint(p.pine, side < 3 ? p.snow : p.navy, side < 3 ? 0.1 + layer * 0.1 : 0.15));
          if (side < 2) add([points[2], { x: mix(points[0].x, object.x, 0.5), y: mix(bottom, top, 0.5), z: mix(points[0].z, object.z, 0.5) },
            { x: mix(points[1].x, object.x, 0.5), y: mix(bottom, top, 0.5), z: mix(points[1].z, object.z, 0.5) }], tint(p.snow, p.shadow, layer * 0.06));
        }
      }
    } else {
      const count = 7;
      for (let side = 0; side < count; side++) {
        const a = side / count * TAU, b = (side + 1) / count * TAU;
        const bottomA = { x: object.x + Math.cos(a) * object.radius, y: ground, z: object.z + Math.sin(a) * object.radius };
        const bottomB = { x: object.x + Math.cos(b) * object.radius, y: ground, z: object.z + Math.sin(b) * object.radius };
        const topA = { x: object.x + Math.cos(a) * object.radius * 0.6, y: ground + object.height * 0.7, z: object.z + Math.sin(a) * object.radius * 0.6 };
        const topB = { x: object.x + Math.cos(b) * object.radius * 0.6, y: ground + object.height * 0.7, z: object.z + Math.sin(b) * object.radius * 0.6 };
        add([bottomA, bottomB, topB, topA], tint(p.shadow, p.navy, 0.15 + side * 0.035));
        add([topA, topB, { x: object.x - object.radius * 0.12, y: ground + object.height, z: object.z }], tint(p.snow, p.shadow, side * 0.035));
      }
    }
    faces.sort((a, b) => b.depth - a.depth);
    for (const face of faces) polygon(face.points, camera, color(fog(face.tone, face.depth, p)));
  }
  function flagObject(flag, index, state, run, camera, p, preview) {
    const next = index === state.flagIndex, outcome = flagHistory.get(index);
    const tone = outcome === 'missed' ? p.accent : outcome === 'passed' ? p.ice : next ? p.accent : p.navy;
    const alpha = index < state.flagIndex ? 0.45 : 0.9;
    for (const side of [-1, 1]) {
      const x = flag.x + side * flag.width / 2, y = terrainHeight(run, x, flag.z, state.mode);
      line({ x, y, z: flag.z }, { x, y: y + 3.7, z: flag.z }, camera, color(tone, alpha), next ? 2.5 : 1.7);
      polygon([{ x, y: y + 3.65, z: flag.z }, { x: x + side * 1.55, y: y + 3.35, z: flag.z + 0.15 },
        { x: x + side * 1.45, y: y + 2.65, z: flag.z }, { x, y: y + 2.9, z: flag.z }], camera, color(tone, alpha));
      if (next) line({ x, y: y + 3.85, z: flag.z }, { x, y: y + 4.35, z: flag.z }, camera, color(p.cream, 0.9), 2);
    }
    if (next) {
      const y = terrainHeight(run, flag.x, flag.z, state.mode), center = project({ x: flag.x, y: y + 4.3, z: flag.z }, camera);
      for (let part = 0; part < 8; part++) {
        const x = flag.x - flag.width / 2 + flag.width * part / 8, end = x + flag.width / 16;
        line({ x, y: terrainHeight(run, x, flag.z, state.mode) + 0.05, z: flag.z }, { x: end, y: terrainHeight(run, end, flag.z, state.mode) + 0.05, z: flag.z }, camera, color(p.accent, 0.5), 1.7);
      }
      if (!preview && center && center.depth < 400 && center.x > 35 && center.x < width - 35 && center.y > 28 && center.y < height - 20) {
        ctx.font = '600 10px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = color(p.navy, 0.75); ctx.fillRect(center.x - 29, center.y - 20, 58, 19);
        ctx.fillStyle = color(p.cream); ctx.fillText('NEXT', center.x, center.y - 7);
      }
    }
  }

  function powder(state, run, camera, p) {
    if (!state.onGround || state.speed < 4 || state.status !== 'riding') return;
    const power = clamp(state.speed / 30 + Math.abs(state.lean), 0, 1.5);
    for (let index = 0; index < 18; index++) {
      const age = fract(state.time * 1.6 + noise(index, 5)) * 0.65;
      const x = state.x - state.vx * age + (noise(index, 8) - 0.5) * age * 5 * power;
      const z = state.z - state.vz * age - 0.7;
      const y = terrainHeight(run, x, z, state.mode) + Math.sin(age / 0.65 * Math.PI) * power * 0.8 + 0.15;
      const point = project({ x, y, z }, camera);
      if (!point || point.y > height || point.x < 0 || point.x > width) continue;
      ctx.fillStyle = color(p.snow, (1 - age / 0.65) * 0.65); ctx.beginPath(); ctx.arc(point.x, point.y, clamp(camera.focal * 0.035 / point.depth, 0.8, 3), 0, TAU); ctx.fill();
    }
  }
  function rider(state, run, world, camera, p) {
    const heading = state.heading, lean = clamp(state.lean, -0.9, 0.9);
    const forward = { x: Math.sin(heading), z: Math.cos(heading) };
    const ground = surface(run, world, state.x, state.z, state.mode);
    // Sample behind the sole so a ramp's abrupt tip does not point the board down.
    const pitch = state.onGround ? Math.atan2(ground
      - surface(run, world, state.x - forward.x * 0.65, state.z - forward.z * 0.65, state.mode), 0.65) : clamp(state.vy / Math.max(6, state.speed) * 0.35, -0.25, 0.25);
    const transform = vertex => {
      const x = vertex[0] * Math.cos(lean) + vertex[1] * Math.sin(lean);
      const localY = -vertex[0] * Math.sin(lean) + vertex[1] * Math.cos(lean);
      const y = localY * Math.cos(pitch) + vertex[2] * Math.sin(pitch), z = -localY * Math.sin(pitch) + vertex[2] * Math.cos(pitch);
      return { x: state.x + x * Math.cos(heading) + z * Math.sin(heading), y: state.y + y, z: state.z - x * Math.sin(heading) + z * Math.cos(heading) };
    };
    const shadow = [], air = Math.max(0, state.y - ground);
    for (let index = 0; index < 24; index++) {
      const angle = index / 24 * TAU, x = state.x + Math.cos(angle) * (0.65 + air * 0.07), z = state.z + Math.sin(angle) * (1.35 + air * 0.06);
      shadow.push({ x, y: surface(run, world, x, z, state.mode) + 0.025, z });
    }
    polygon(shadow, camera, color(p.navy, clamp(0.24 - air * 0.025, 0.06, 0.24)));
    const board = [[-0.16, 0.1, -1.12], [-0.25, 0.07, -0.85], [-0.25, 0.07, 0.85], [-0.16, 0.15, 1.14], [0.16, 0.15, 1.14], [0.25, 0.07, 0.85], [0.25, 0.07, -0.85], [0.16, 0.1, -1.12]];
    polygon(board.map(transform), camera, color(p.ice), color(p.navy), 1.3);
    polygon([[-0.2, 0.11, -0.9], [-0.16, 0.14, -1.1], [0.16, 0.14, -1.1], [0.2, 0.11, -0.9]].map(transform), camera, color(p.accent));
    const crouch = clamp((state.speed - 14) / 35, 0, 0.45) + (state.onGround ? 0 : 0.12);
    const hip = [0, 1.02 - crouch * 0.3, 0.04], shoulder = [0, 1.62 - crouch * 0.5, 0.16 + crouch * 0.3];
    const limbs = [
      { a: [-0.14, 0.19, -0.43], b: [-0.2, 0.61 - crouch * 0.15, -0.35], size: 0.23, tone: p.navy },
      { a: [-0.2, 0.61 - crouch * 0.15, -0.35], b: hip, size: 0.27, tone: p.navy },
      { a: [0.14, 0.19, 0.43], b: [0.22, 0.61 - crouch * 0.15, 0.28], size: 0.23, tone: p.navy },
      { a: [0.22, 0.61 - crouch * 0.15, 0.28], b: hip, size: 0.27, tone: tint(p.navy, p.shadow, 0.12) },
    ];
    for (const side of [-1, 1]) {
      const elbow = [side * (state.onGround ? 0.48 : 0.63), 1.24 - crouch * 0.4, 0.15 + side * 0.15];
      const wrist = [side * (state.onGround ? 0.64 : 0.9), 1.04 - crouch * 0.3, 0.22 + side * 0.25];
      limbs.push({ a: [side * 0.24, shoulder[1] - 0.04, shoulder[2]], b: elbow, size: 0.19, tone: p.accent }, { a: elbow, b: wrist, size: 0.16, tone: p.accent });
    }
    const drawLimb = limb => {
      const a = project(transform(limb.a), camera), b = project(transform(limb.b), camera);
      if (!a || !b) return;
      ctx.lineWidth = clamp(limb.size * camera.focal / ((a.depth + b.depth) / 2), 1, 24); ctx.strokeStyle = color(limb.tone);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    };
    limbs.sort((a, b) => inCamera(transform(b.a), camera).z - inCamera(transform(a.a), camera).z);
    for (const limb of limbs) drawLimb(limb);
    polygon([[-0.2, hip[1], hip[2]], [0.2, hip[1], hip[2]], [0.28, shoulder[1], shoulder[2]], [-0.28, shoulder[1], shoulder[2]]].map(transform), camera, color(p.accent), color(tint(p.accent, p.navy, 0.25)), 0.8);
    line(transform([-0.19, hip[1] + 0.15, hip[2] - 0.015]), transform([0.19, hip[1] + 0.15, hip[2] - 0.015]), camera, color(p.cream, 0.7), 1.7);
    const head = project(transform([0, shoulder[1] + 0.28, shoulder[2]]), camera);
    if (head) {
      const radius = clamp(camera.focal * 0.205 / head.depth, 2, 20);
      ctx.fillStyle = color(p.navy); ctx.beginPath(); ctx.ellipse(head.x, head.y, radius, radius * 1.08, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = color(p.cream, 0.75); ctx.lineWidth = Math.max(1, radius * 0.18); ctx.beginPath(); ctx.arc(head.x, head.y, radius * 0.75, Math.PI * 1.05, Math.PI * 1.85); ctx.stroke();
    }
  }

  function render(state, run, { steadyCamera = false, preview = false } = {}) {
    if (destroyed || !state || !run) return;
    const world = getWorld(run, state.z - 45, state.z + FAR, state.mode), p = getPalette(run);
    const camera = cameraFor(state, run, world, steadyCamera || preview, preview);
    updateHistory(state, run, preview);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.globalAlpha = 1; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.save(); ctx.translate(camera.cx, camera.cy); ctx.rotate(camera.roll); ctx.translate(-camera.cx, -camera.cy);
    sky(camera, p); snow(state, run, camera, p); tracks(state, camera, p); edges(state, run, camera, p, preview);
    const objects = [...world.obstacles.map(object => ({ object, kind: 'obstacle', z: object.z })), ...world.ramps.map(object => ({ object, kind: 'ramp', z: object.z }))];
    if (state.mode !== 'free') for (const flag of world.flags) objects.push({ object: flag, kind: 'flag', z: flag.z });
    objects.sort((a, b) => b.z - a.z);
    for (const item of objects) {
      if (item.kind === 'ramp') {
        rampObject(item.object, state, run, camera, p);
        continue;
      }
      const center = project({ x: item.object.x, y: terrainHeight(run, item.object.x, item.z, state.mode), z: item.z }, camera);
      if (!center || center.depth > FAR || center.x < -width * 0.6 || center.x > width * 1.6) continue;
      if (item.kind === 'obstacle') obstacleObject(item.object, state, run, camera, p);
      else flagObject(item.object, run.flags.findIndex(flag => flag.id === item.object.id), state, run, camera, p, preview);
    }
    powder(state, run, camera, p); rider(state, run, world, camera, p);
    ctx.restore();
  }
  function destroy() {
    if (destroyed) return;
    destroyed = true; trail.length = 0; flagHistory.clear(); previous = null;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  resize(finite(canvas.clientWidth, 960) || 960, finite(canvas.clientHeight, 640) || 640, 1);
  return { resize, render, destroy };
}
