// Web Audio API Retro Sound FX Synthesizer

class SoundSynthesizer {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  playCapture() {
    try {
      this.init();
      if (!this.ctx) return;
      
      const time = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = "sine";
      // Cyber slide up sound
      osc.frequency.setValueAtTime(150, time);
      osc.frequency.exponentialRampToValueAtTime(800, time + 0.15);
      
      gain.gain.setValueAtTime(0.15, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(time);
      osc.stop(time + 0.2);
    } catch (e) {
      // Audio context might be blocked or unsupported
    }
  }

  playCash() {
    try {
      this.init();
      if (!this.ctx) return;
      
      const time = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc1.frequency.setValueAtTime(880, time); // High chime
      osc2.frequency.setValueAtTime(1760, time + 0.05); // Dual register sound
      
      gain.gain.setValueAtTime(0.1, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.25);
      
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc1.start(time);
      osc2.start(time);
      
      osc1.stop(time + 0.25);
      osc2.stop(time + 0.25);
    } catch (e) {
      // Audio blocked or unsupported
    }
  }

  playBuzz() {
    try {
      this.init();
      if (!this.ctx) return;
      
      const time = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(120, time);
      osc.frequency.linearRampToValueAtTime(80, time + 0.18);
      
      gain.gain.setValueAtTime(0.15, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(time);
      osc.stop(time + 0.2);
    } catch (e) {
      // Audio blocked or unsupported
    }
  }
}

export const sounds = new SoundSynthesizer();
