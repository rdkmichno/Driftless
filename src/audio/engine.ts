import type { AmbienceId } from '../state/store';

/**
 * Fully procedural Web Audio engine — no audio files. A constant "bed"
 * (brown-noise hum + low drone) plays during missions, with one selectable
 * ambience layered on top, plus soft one-shot cues at mission milestones.
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bed: { nodes: AudioNode[]; gain: GainNode } | null = null;
  private ambience: { nodes: AudioNode[]; gain: GainNode; timers: number[] } | null = null;
  private ambienceId: AmbienceId = 'drift';
  private volume = 0.5;
  private muted = false;
  private bedActive = false;

  unlock() {
    if (!this.ctx) {
      const ctx = new AudioContext();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.targetGain();
      this.master.connect(ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    if (this.bedActive && !this.bed) this.buildBed();
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
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
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
      // three detuned triangles through a slowly sweeping lowpass + echo
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 600;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 300;
      lfo.connect(lfoGain).connect(lp.frequency);
      lfo.start();
      const pad = ctx.createGain();
      pad.gain.value = 0.05;
      lp.connect(pad).connect(gain);
      const delay = ctx.createDelay(2);
      delay.delayTime.value = 0.9;
      const fb = ctx.createGain();
      fb.gain.value = 0.45;
      const wet = ctx.createGain();
      wet.gain.value = 0.4;
      pad.connect(delay);
      delay.connect(fb).connect(delay);
      delay.connect(wet).connect(gain);
      nodes.push(lp, lfo, lfoGain, pad, delay, fb, wet);
      for (const f of [110, 164.8, 220.5]) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = f;
        osc.detune.value = Math.random() * 8 - 4;
        osc.connect(lp);
        osc.start();
        nodes.push(osc);
      }
    } else if (this.ambienceId === 'cockpit') {
      // faint machinery + occasional soft blips
      const saw = ctx.createOscillator();
      saw.type = 'sawtooth';
      saw.frequency.value = 50;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 120;
      const sg = ctx.createGain();
      sg.gain.value = 0.04;
      saw.connect(lp).connect(sg).connect(gain);
      saw.start();
      nodes.push(saw, lp, sg);
      const blip = () => {
        if (!this.ambience || this.ambience.gain !== gain) return;
        this.playTone({ freq: 620 + Math.random() * 280, type: 'sine', attack: 0.01, release: 0.06, peak: 0.02, out: gain });
        timers.push(window.setTimeout(blip, 8000 + Math.random() * 12000));
      };
      timers.push(window.setTimeout(blip, 5000));
    } else {
      // deep silence: a distant tone every 35–70 s
      const tone = () => {
        if (!this.ambience || this.ambience.gain !== gain) return;
        this.playTone({ freq: 330, type: 'sine', attack: 2.5, release: 2.5, peak: 0.015, out: gain });
        timers.push(window.setTimeout(tone, 35000 + Math.random() * 35000));
      };
      timers.push(window.setTimeout(tone, 15000));
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
    this.playTone({ freq: 320, startFreq: 180, sweepDuration: 1.8, type: 'sine', attack: 0.4, release: 0.8, peak: 0.12 });
  }

  cueArrival() {
    // warm resolving chord: F3, A3, C4 staggered
    const chord = [174.6, 220, 261.6];
    chord.forEach((f, i) => {
      this.playTone({ freq: f, type: 'triangle', attack: 0.3, release: 3, peak: 0.09, delay: i * 0.4 });
    });
  }

  cueHalfway() {
    this.playTone({ freq: 523.3, type: 'sine', attack: 0.05, release: 1.2, peak: 0.04 });
  }
}

export const audio = new AudioEngine();
