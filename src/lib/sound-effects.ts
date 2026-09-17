"use client";

// Web Audio API Synthesizer for Modern UI Sound Effects
// Zero external asset dependencies - instant, crisp, responsive and lightweight.

class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("gk_sound_muted");
      this.isMuted = stored === "true";
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public get muted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (typeof window !== "undefined") {
      localStorage.setItem("gk_sound_muted", muted ? "true" : "false");
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    if (!this.isMuted) {
      this.playTap();
    }
    return this.isMuted;
  }

  /**
   * Crisp energetic "bubble swoosh / pop" when user sends a message
   */
  public playSend() {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      // Upward pitch bend (cheerful pop)
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.08);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch {
      // Audio playback silently fails if blocked
    }
  }

  /**
   * Warm, pleasant harmonic 2-tone chime when AI response is ready / finishes typing
   */
  public playReceive() {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Note 1: E5 (659.25 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Note 2: B5 (987.77 Hz) - slight delay for melodic flourish
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(987.77, now + 0.09);
      gain2.gain.setValueAtTime(0.001, now);
      gain2.gain.setValueAtTime(0.14, now + 0.09);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.09);
      osc2.stop(now + 0.45);
    } catch {
      // Audio playback silently fails if blocked
    }
  }

  /**
   * Snappy subtle click / pop when tapping suggested prompt chips
   */
  public playTap() {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(240, now + 0.04);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch {
      // Audio playback silently fails
    }
  }

  /**
   * Micro haptic tick during streaming text (throttled)
   */
  private lastTick = 0;
  public playTick() {
    if (this.isMuted) return;
    const now = Date.now();
    if (now - this.lastTick < 60) return; // limit frequency
    this.lastTick = now;

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const ct = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(1200, ct);
      gain.gain.setValueAtTime(0.02, ct);
      gain.gain.exponentialRampToValueAtTime(0.0001, ct + 0.015);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ct);
      osc.stop(ct + 0.015);
    } catch {
      // Silent fail
    }
  }
}

export const soundFx = new SoundManager();
