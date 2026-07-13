import type { AmbienceId } from '../state/store';

/**
 * Fully procedural Web Audio engine — no audio files. A constant "bed"
 * (brown-noise hum + low drone) plays during missions, with one selectable
 * ambience layered on top, plus soft one-shot cues at mission milestones.
 */
type AudioSnapshot = {
  ctxState: string;
  muted: boolean;
  volume: number;
  masterGain: number; // instantaneous
  masterTarget: number; // deterministic target (0 when muted)
  ambience: AmbienceId;
  bedActive: boolean;
  bedNodes: number;
  ambienceNodes: number;
  takeoffActive: boolean;
  takeoffNodes: number;
  landingActive: boolean;
  landingNodes: number;
  holdActive: boolean;
  halfwayEnabled: boolean;
  halfwayCueCount: number;
  pans: number[]; // pan value of every panner in the graph — all must be 0
};

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private centerPan: StereoPannerNode | null = null; // explicit centered bus
  private bed: { nodes: AudioNode[]; gain: GainNode } | null = null;
  private ambience: { nodes: AudioNode[]; gain: GainNode; timers: number[] } | null = null;
  private takeoff: { nodes: AudioNode[]; gain: GainNode; endTimer: number } | null = null;
  private landing: { nodes: AudioNode[]; gain: GainNode; endTimer: number } | null = null;
  private holdTone: { osc: OscillatorNode; gain: GainNode } | null = null;
  private ambienceId: AmbienceId = 'drift';
  private volume = 0.5;
  private muted = false;
  private bedActive = false;
  private halfwayEnabled = false;
  private halfwayCueCount = 0;

  unlock() {
    if (!this.ctx) {
      const ctx = new AudioContext();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.targetGain();
      // gentle master lowpass keeps everything free of sharp highs
      const softener = ctx.createBiquadFilter();
      softener.type = 'lowpass';
      softener.frequency.value = 3200;
      // explicit centered stereo bus: everything (bed, ambience, cues,
      // takeoff) routes through master → centerPan(0) → softener, so nothing
      // can drift off-centre in the stereo field.
      this.centerPan = ctx.createStereoPanner();
      this.centerPan.pan.value = 0;
      this.master.connect(this.centerPan).connect(softener).connect(ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    if (this.bedActive && !this.bed) this.buildBed();
  }

  /** Test-only introspection of the live audio graph. */
  snapshot(): AudioSnapshot {
    return {
      ctxState: this.ctx?.state ?? 'none',
      muted: this.muted,
      volume: this.volume,
      masterGain: this.master?.gain.value ?? 0,
      masterTarget: this.targetGain(),
      ambience: this.ambienceId,
      bedActive: this.bedActive,
      bedNodes: this.bed?.nodes.length ?? 0,
      ambienceNodes: this.ambience?.nodes.length ?? 0,
      takeoffActive: !!this.takeoff,
      takeoffNodes: this.takeoff?.nodes.length ?? 0,
      landingActive: !!this.landing,
      landingNodes: this.landing?.nodes.length ?? 0,
      holdActive: !!this.holdTone,
      halfwayEnabled: this.halfwayEnabled,
      halfwayCueCount: this.halfwayCueCount,
      pans: this.centerPan ? [this.centerPan.pan.value] : [],
    };
  }

  setHalfwayEnabled(on: boolean) {
    this.halfwayEnabled = on;
  }

  private targetGain() {
    return this.muted ? 0 : this.volume * this.volume; // perceptual curve
  }

  private applyGain() {
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(this.targetGain(), this.ctx.currentTime, 0.1);
    }
  }

  setVolume(v: number) {
    this.volume = v;
    this.applyGain();
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.applyGain();
  }

  setAmbience(id: AmbienceId) {
    this.ambienceId = id;
    if (this.bedActive && this.ctx) {
      this.stopAmbience();
      this.buildAmbience();
    }
  }

  startBed() {
    this.bedActive = true;
    if (!this.ctx || !this.master) return; // will start on unlock
    if (!this.bed) this.buildBed();
  }

  stopBed() {
    this.bedActive = false;
    if (!this.ctx || !this.bed) return;
    const { gain } = this.bed;
    gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
    const nodes = this.bed.nodes;
    this.bed = null;
    this.stopAmbience();
    window.setTimeout(() => nodes.forEach((n) => { if (n instanceof AudioScheduledSourceNode) n.stop(); n.disconnect(); }), 2000);
  }

  private brownNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const len = ctx.sampleRate * 4;
    const fade = Math.floor(ctx.sampleRate * 0.2);
    const raw = new Float32Array(len + fade);
    let last = 0;
    for (let i = 0; i < raw.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      raw[i] = last * 3.5;
    }
    // Seamless loop via overlap-crossfade: the generated tail beyond `len`
    // fades into the head, so the wrap point is fully continuous (no click).
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    data.set(raw.subarray(0, len));
    for (let i = 0; i < fade; i++) {
      const t = i / fade;
      data[i] = raw[len + i] * (1 - t) + raw[i] * t;
    }
    return buf;
  }

  private buildBed() {
    const ctx = this.ctx!;
    const bedGain = ctx.createGain();
    bedGain.gain.value = 0;
    bedGain.gain.setTargetAtTime(1, ctx.currentTime, 1.2);
    bedGain.connect(this.master!);

    const nodes: AudioNode[] = [bedGain];

    // filtered brown-noise hum
    const noise = ctx.createBufferSource();
    noise.buffer = this.brownNoiseBuffer(ctx);
    noise.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 200;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.1;
    noise.connect(lp).connect(noiseGain).connect(bedGain);
    noise.start();
    nodes.push(noise, lp, noiseGain);

    // slow-beating low drone
    for (const [freq, g] of [[55, 0.035], [55.4, 0.03]] as const) {
      const osc = ctx.createOscillator();
      osc.frequency.value = freq;
      const og = ctx.createGain();
      og.gain.value = g;
      osc.connect(og).connect(bedGain);
      osc.start();
      nodes.push(osc, og);
    }

    this.bed = { nodes, gain: bedGain };
    this.buildAmbience();
  }

  private stopAmbience() {
    if (!this.ambience || !this.ctx) return;
    const { gain, nodes, timers } = this.ambience;
    timers.forEach((t) => window.clearTimeout(t));
    gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    this.ambience = null;
    window.setTimeout(() => nodes.forEach((n) => { if (n instanceof AudioScheduledSourceNode) n.stop(); n.disconnect(); }), 1500);
  }

  private buildAmbience() {
    const ctx = this.ctx!;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(1, ctx.currentTime, 2);
    gain.connect(this.master!);
    const nodes: AudioNode[] = [gain];
    const timers: number[] = [];

    if (this.ambienceId === 'drift') {
      // non-melodic: slow swelling bands of filtered noise, like distant solar
      // wind — no sustained chord, no tune, nothing to latch onto
      const noise = ctx.createBufferSource();
      noise.buffer = this.brownNoiseBuffer(ctx);
      noise.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 320;
      bp.Q.value = 1.4;
      const centerLfo = ctx.createOscillator();
      centerLfo.frequency.value = 0.03; // full sweep every ~33 s
      const centerDepth = ctx.createGain();
      centerDepth.gain.value = 170; // 150–490 Hz
      centerLfo.connect(centerDepth).connect(bp.frequency);
      centerLfo.start();
      const swell = ctx.createGain();
      swell.gain.value = 0.05;
      const ampLfo = ctx.createOscillator();
      ampLfo.frequency.value = 0.017; // one breath per minute
      const ampDepth = ctx.createGain();
      ampDepth.gain.value = 0.025;
      ampLfo.connect(ampDepth).connect(swell.gain);
      ampLfo.start();
      noise.connect(bp).connect(swell).connect(gain);
      noise.start();
      nodes.push(noise, bp, centerLfo, centerDepth, swell, ampLfo, ampDepth);
      // very rare, very low single swell — texture, not melody
      const deep = () => {
        if (!this.ambience || this.ambience.gain !== gain) return;
        const freqs = [55, 62, 73, 82];
        this.playTone({ freq: freqs[Math.floor(Math.random() * freqs.length)], type: 'sine', attack: 4, release: 6, peak: 0.02, out: gain });
        timers.push(window.setTimeout(deep, 45000 + Math.random() * 45000));
      };
      timers.push(window.setTimeout(deep, 30000));
    } else if (this.ambienceId === 'cockpit') {
      // faint machinery + rare soft low blips
      const saw = ctx.createOscillator();
      saw.type = 'sawtooth';
      saw.frequency.value = 50;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 110;
      const sg = ctx.createGain();
      sg.gain.value = 0.03;
      saw.connect(lp).connect(sg).connect(gain);
      saw.start();
      nodes.push(saw, lp, sg);
      const blip = () => {
        if (!this.ambience || this.ambience.gain !== gain) return;
        this.playTone({ freq: 380 + Math.random() * 140, type: 'sine', attack: 0.04, release: 0.25, peak: 0.012, out: gain });
        timers.push(window.setTimeout(blip, 20000 + Math.random() * 25000));
      };
      timers.push(window.setTimeout(blip, 12000));
    } else {
      // deep silence: a barely-there distant tone every 45–90 s
      const tone = () => {
        if (!this.ambience || this.ambience.gain !== gain) return;
        this.playTone({ freq: 220, type: 'sine', attack: 3, release: 3.5, peak: 0.01, out: gain });
        timers.push(window.setTimeout(tone, 45000 + Math.random() * 45000));
      };
      timers.push(window.setTimeout(tone, 20000));
    }

    this.ambience = { nodes, gain, timers };
  }

  private playTone(opts: {
    freq: number;
    type: OscillatorType;
    attack: number;
    release: number;
    peak: number;
    out?: AudioNode;
    startFreq?: number;
    sweepDuration?: number;
    delay?: number;
  }) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = opts.type;
    if (opts.startFreq && opts.sweepDuration) {
      osc.frequency.setValueAtTime(opts.startFreq, t0);
      osc.frequency.linearRampToValueAtTime(opts.freq, t0 + opts.sweepDuration);
    } else {
      osc.frequency.value = opts.freq;
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(opts.peak, t0 + opts.attack);
    g.gain.setTargetAtTime(0, t0 + opts.attack + (opts.sweepDuration ?? 0), opts.release / 3);
    osc.connect(g).connect(opts.out ?? this.master);
    osc.start(t0);
    const stopAt = t0 + opts.attack + (opts.sweepDuration ?? 0) + opts.release + 1;
    osc.stop(stopAt);
    window.setTimeout(() => { osc.disconnect(); g.disconnect(); }, (stopAt - ctx.currentTime) * 1000 + 100);
  }

  cueLaunch() {
    this.playTone({ freq: 320, startFreq: 180, sweepDuration: 1.8, type: 'sine', attack: 0.4, release: 0.8, peak: 0.09 });
  }

  cueArrival() {
    // warm resolving chord: F3, A3, C4 staggered
    const chord = [174.6, 220, 261.6];
    chord.forEach((f, i) => {
      this.playTone({ freq: f, type: 'triangle', attack: 0.3, release: 3, peak: 0.07, delay: i * 0.4 });
    });
  }

  /** Warm "stitched-in" flourish when a mission patch is earned: a soft low
   *  thump (the stamp landing) and a rising three-note figure that resolves
   *  brighter than the arrival chord, so an earned patch feels like a reward.
   *  Routed through master, so a muted session plays it silently. */
  cuePatch() {
    this.playTone({ freq: 88, type: 'sine', attack: 0.006, release: 0.4, peak: 0.09 });
    const notes = [329.6, 415.3, 523.3]; // E4, G#4, C5 — a bright major resolve
    notes.forEach((f, i) => {
      this.playTone({ freq: f, type: 'triangle', attack: 0.02, release: 1.6, peak: 0.055, delay: 0.08 + i * 0.13 });
    });
  }

  cueHalfway() {
    // The engine is authoritative: no midpoint tone unless enabled, so
    // "Halfway ping off" provably creates no cue node.
    if (!this.halfwayEnabled) return;
    this.halfwayCueCount++;
    this.playTone({ freq: 523.3, type: 'sine', attack: 0.05, release: 1.2, peak: 0.03 });
  }

  /* ---- mission-authorization ritual ---- */

  /** Low tone that rises in pitch as the hold-to-authorize ring fills. */
  startHoldTone() {
    if (!this.ctx || !this.master || this.holdTone) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 90;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.035, ctx.currentTime, 0.06);
    osc.connect(gain).connect(this.master);
    osc.start();
    this.holdTone = { osc, gain };
  }

  setHoldProgress(p: number) {
    if (this.holdTone && this.ctx) {
      this.holdTone.osc.frequency.setTargetAtTime(90 + 190 * p, this.ctx.currentTime, 0.04);
    }
  }

  /** Release: completed → clean cut into the chime; cancelled → falls away. */
  stopHoldTone(completed = false) {
    if (!this.holdTone || !this.ctx) return;
    const { osc, gain } = this.holdTone;
    this.holdTone = null;
    const t = this.ctx.currentTime;
    if (!completed) osc.frequency.setTargetAtTime(65, t, 0.12);
    gain.gain.cancelScheduledValues(t);
    gain.gain.setTargetAtTime(0, t, completed ? 0.03 : 0.14);
    osc.stop(t + 0.8);
    window.setTimeout(() => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch { /* already gone */ }
    }, 900);
  }

  /** Stamp-thump + warm two-note confirmation: CLEARED FOR LAUNCH. */
  cueAuthorized() {
    this.playTone({ freq: 70, type: 'sine', attack: 0.005, release: 0.25, peak: 0.1 });
    this.playTone({ freq: 440, type: 'triangle', attack: 0.01, release: 0.5, peak: 0.055, delay: 0.05 });
    this.playTone({ freq: 587.3, type: 'triangle', attack: 0.01, release: 0.9, peak: 0.05, delay: 0.17 });
  }

  /** Soft terminal tick for each systems-check line. */
  cueTick() {
    this.playTone({ freq: 820, type: 'sine', attack: 0.004, release: 0.05, peak: 0.02 });
  }

  /** Low countdown pulse; each step rises in pitch. */
  cuePulse(step: number) {
    this.playTone({ freq: 98 + step * 24, type: 'sine', attack: 0.012, release: 0.32, peak: 0.06 });
  }

  /**
   * Cinematic takeoff roar synced to the ~5 s ascent animation: a warm low
   * rumble that builds at ignition, roars as the rocket accelerates, then
   * thins and fades to near-silence as the atmosphere thins — resolving
   * seamlessly into the ambient bed. Fully torn down afterwards.
   */
  startTakeoff(durationMs = 5000) {
    if (!this.ctx || !this.master || this.takeoff) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const dur = durationMs / 1000;

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.master);

    // low-passed brown noise = the body of the roar; cutoff automated so the
    // sound opens up through max-Q then closes as the air thins (warm, no highs)
    const noise = ctx.createBufferSource();
    noise.buffer = this.brownNoiseBuffer(ctx);
    noise.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(160, t0);
    lp.frequency.linearRampToValueAtTime(760, t0 + dur * 0.35);
    lp.frequency.linearRampToValueAtTime(900, t0 + dur * 0.55);
    lp.frequency.linearRampToValueAtTime(240, t0 + dur);
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.9;
    noise.connect(lp).connect(noiseGain).connect(gain);

    // sub-bass sine for weight, sliding up slightly with the acceleration
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(42, t0);
    sub.frequency.linearRampToValueAtTime(58, t0 + dur * 0.5);
    sub.frequency.linearRampToValueAtTime(38, t0 + dur);
    const subGain = ctx.createGain();
    subGain.gain.value = 0.25;
    sub.connect(subGain).connect(gain);

    // envelope: ignition build → roar peak → thinning → fade to near silence
    const peak = 0.16;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + Math.min(0.9, dur * 0.18)); // ignition
    gain.gain.setValueAtTime(peak, t0 + dur * 0.45); // roar hold
    gain.gain.linearRampToValueAtTime(peak * 0.55, t0 + dur * 0.72); // thinning
    gain.gain.linearRampToValueAtTime(0.0001, t0 + dur); // break into space

    noise.start(t0);
    sub.start(t0);
    const stopAt = t0 + dur + 0.2;
    noise.stop(stopAt);
    sub.stop(stopAt);

    const endTimer = window.setTimeout(() => this.teardownTakeoff(), durationMs + 400);
    this.takeoff = { nodes: [gain, noise, lp, noiseGain, sub, subGain], gain, endTimer };
  }

  /** Stop the takeoff sound early (skip) with a clean fade, then tear down. */
  stopTakeoff(fadeSec = 0.4) {
    if (!this.ctx || !this.takeoff) return;
    window.clearTimeout(this.takeoff.endTimer);
    this.takeoff.gain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.takeoff.gain.gain.setTargetAtTime(0, this.ctx.currentTime, fadeSec / 3);
    this.takeoff.endTimer = window.setTimeout(() => this.teardownTakeoff(), fadeSec * 1000 + 200);
  }

  private teardownTakeoff() {
    if (!this.takeoff) return;
    const { nodes, endTimer } = this.takeoff;
    window.clearTimeout(endTimer);
    this.takeoff = null;
    nodes.forEach((n) => {
      if (n instanceof AudioScheduledSourceNode) {
        try {
          n.stop();
        } catch { /* already stopped */ }
      }
      n.disconnect();
    });
  }

  /**
   * Landing roar — the takeoff reversed: near-silence in space, a building
   * retro-burn rumble, a touchdown thump, then quiet (into the arrival chord).
   * On airless bodies there is no atmospheric roar — only a lower, quieter,
   * heavily muffled hull-conducted burn. Torn down after the arrival card.
   */
  startLanding(airless: boolean, durationMs = 5200) {
    if (!this.ctx || !this.master || this.landing) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const dur = durationMs / 1000;

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.master);

    const noise = ctx.createBufferSource();
    noise.buffer = this.brownNoiseBuffer(ctx);
    noise.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    // airless: muffled hull burn (very low cutoff); atmo: fuller retro roar
    const lo = airless ? 90 : 180;
    const hi = airless ? 260 : 640;
    lp.frequency.setValueAtTime(lo, t0);
    lp.frequency.linearRampToValueAtTime(hi, t0 + dur * 0.45);
    lp.frequency.linearRampToValueAtTime(lo, t0 + dur);
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.9;
    noise.connect(lp).connect(noiseGain).connect(gain);

    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(40, t0);
    sub.frequency.linearRampToValueAtTime(50, t0 + dur * 0.5);
    sub.frequency.linearRampToValueAtTime(34, t0 + dur);
    const subGain = ctx.createGain();
    subGain.gain.value = airless ? 0.16 : 0.24;
    sub.connect(subGain).connect(gain);

    // envelope: near-silent → building burn → quiet
    const peak = airless ? 0.09 : 0.15;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + dur * 0.45); // building retro-burn
    gain.gain.setValueAtTime(peak, t0 + dur * 0.78);
    gain.gain.linearRampToValueAtTime(peak * 0.25, t0 + dur * 0.92);
    gain.gain.linearRampToValueAtTime(0.0001, t0 + dur);

    // touchdown thump routed through the same gain (so mute/volume apply)
    const thumpT = t0 + dur * 0.86;
    const thump = ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(72, thumpT);
    thump.frequency.exponentialRampToValueAtTime(38, thumpT + 0.35);
    const thumpGain = ctx.createGain();
    thumpGain.gain.setValueAtTime(0, thumpT);
    thumpGain.gain.linearRampToValueAtTime(airless ? 0.06 : 0.12, thumpT + 0.02);
    thumpGain.gain.setTargetAtTime(0, thumpT + 0.06, 0.12);
    thump.connect(thumpGain).connect(gain);

    noise.start(t0);
    sub.start(t0);
    thump.start(thumpT);
    const stopAt = t0 + dur + 0.3;
    noise.stop(stopAt);
    sub.stop(stopAt);
    thump.stop(stopAt);

    const endTimer = window.setTimeout(() => this.teardownLanding(), durationMs + 500);
    this.landing = { nodes: [gain, noise, lp, noiseGain, sub, subGain, thump, thumpGain], gain, endTimer };
  }

  stopLanding(fadeSec = 0.4) {
    if (!this.ctx || !this.landing) return;
    window.clearTimeout(this.landing.endTimer);
    this.landing.gain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.landing.gain.gain.setTargetAtTime(0, this.ctx.currentTime, fadeSec / 3);
    this.landing.endTimer = window.setTimeout(() => this.teardownLanding(), fadeSec * 1000 + 200);
  }

  private teardownLanding() {
    if (!this.landing) return;
    const { nodes, endTimer } = this.landing;
    window.clearTimeout(endTimer);
    this.landing = null;
    nodes.forEach((n) => {
      if (n instanceof AudioScheduledSourceNode) {
        try {
          n.stop();
        } catch { /* already stopped */ }
      }
      n.disconnect();
    });
  }
}

export const audio = new AudioEngine();

// Test-only hooks: expose live audio-graph state (reporter) and the engine
// (control surface) for Playwright assertions. Guarded by DEV so both are
// stripped from production builds.
if (import.meta.env.DEV) {
  const w = window as unknown as { __driftlessAudio?: () => AudioSnapshot; __driftlessAudioEngine?: AudioEngine };
  w.__driftlessAudio = () => audio.snapshot();
  w.__driftlessAudioEngine = audio;
}
