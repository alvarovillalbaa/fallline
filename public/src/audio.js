export function createRideAudio() {
  let context, master, windGain, filter, noise;
  let enabled = false;
  let riding = false;
  let destroyed = false;
  let request = 0;
  const tones = new Set();

  function stopTones() {
    for (const tone of tones) {
      try { tone.oscillator.stop(); } catch { /* A finished tone is already stopped. */ }
      try { tone.oscillator.disconnect(); tone.gain.disconnect(); } catch { /* Context may have closed. */ }
    }
    tones.clear();
  }

  function silence() {
    stopTones();
    if (!context || !windGain) return;
    try {
      windGain.gain.cancelScheduledValues(context.currentTime);
      windGain.gain.setValueAtTime(0, context.currentTime);
    } catch { /* Audio failure must not interrupt the ride. */ }
  }

  function release() {
    silence();
    try { noise?.stop(); noise?.disconnect(); filter?.disconnect(); windGain?.disconnect(); master?.disconnect(); }
    catch { /* Partially initialized and already closed graphs are safe to discard. */ }
    const previous = context;
    context = master = windGain = filter = noise = undefined;
    try { void previous?.close().catch(() => {}); } catch { /* Unsupported or already closed. */ }
  }

  async function setEnabled(next) {
    const currentRequest = ++request;
    if (!next) { enabled = false; silence(); return true; }
    if (destroyed) return false;
    // Only the explicit sound switch should call this; never resume from update().
    if (globalThis.navigator?.userActivation && !globalThis.navigator.userActivation.isActive) {
      enabled = false; silence(); return false;
    }
    try {
      if (!context) {
        const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AudioContext) return false;
        context = new AudioContext();
        master = context.createGain(); master.gain.value = 0.18; master.connect(context.destination);
        windGain = context.createGain(); windGain.gain.value = 0; windGain.connect(master);
        filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 650; filter.connect(windGain);
        const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * 2), context.sampleRate);
        const samples = buffer.getChannelData(0);
        let previous = 0;
        for (let index = 0; index < samples.length; index++) {
          previous = (previous + (Math.random() * 2 - 1) * 0.05) / 1.025;
          samples[index] = previous * 2.5;
        }
        noise = context.createBufferSource(); noise.buffer = buffer; noise.loop = true; noise.connect(filter); noise.start();
      }
      const resumedContext = context;
      await resumedContext.resume();
      if (currentRequest !== request || destroyed || context !== resumedContext) return false;
      if (resumedContext.state !== 'running') { enabled = false; silence(); return false; }
      enabled = true;
      return true;
    } catch {
      if (currentRequest === request) { enabled = false; release(); }
      return false;
    }
  }

  function update(speed, onGround, active) {
    riding = Boolean(active);
    if (!context || !windGain || destroyed) return;
    if (!enabled || !riding || context.state !== 'running') { silence(); return; }
    const movement = Number.isFinite(speed) ? Math.max(0, Math.min(speed, 60)) : 0;
    try {
      windGain.gain.setTargetAtTime(movement === 0 ? 0 : 0.025 + movement / 500, context.currentTime, 0.12);
      filter.frequency.setTargetAtTime((onGround ? 500 : 300) + movement * 12, context.currentTime, 0.18);
    } catch { enabled = false; silence(); }
  }

  function chime(type) {
    if (!enabled || destroyed || !context || context.state !== 'running') return;
    if (type !== 'flag' && type !== 'finish') return;
    if (!riding && type !== 'finish') return;
    if (tones.size > 9) return;
    const frequencies = type === 'finish' ? [440, 554.37, 659.25] : [659.25, 880];
    const now = context.currentTime;
    try {
      for (const [index, frequency] of frequencies.entries()) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const tone = { oscillator, gain };
        tones.add(tone);
        const start = now + index * 0.075;
        oscillator.type = 'sine'; oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.075, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
        oscillator.connect(gain); gain.connect(master);
        oscillator.onended = () => {
          tones.delete(tone);
          try { oscillator.disconnect(); gain.disconnect(); } catch { /* A closed context is already silent. */ }
        };
        oscillator.start(start); oscillator.stop(start + 0.32);
      }
    } catch { silence(); }
  }

  function destroy() {
    destroyed = true; enabled = false; riding = false; request++;
    release();
  }

  return { setEnabled, update, chime, destroy };
}
