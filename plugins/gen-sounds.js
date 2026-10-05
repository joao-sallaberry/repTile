// Generates the timer beeps (16-bit mono PCM WAV). Usage: node plugins/gen-sounds.js
const fs = require('fs');
const RATE = 44100;

function tone(freq, ms, gain = 0.8) {
  const n = Math.floor((RATE * ms) / 1000);
  const out = new Float32Array(n);
  const fade = Math.floor(RATE * 0.005);
  for (let i = 0; i < n; i++) {
    const env = Math.min(1, i / fade, (n - i) / fade);
    out[i] = Math.sin((2 * Math.PI * freq * i) / RATE) * gain * env;
  }
  return out;
}
const silence = (ms) => new Float32Array(Math.floor((RATE * ms) / 1000));
const concat = (...parts) => {
  const out = new Float32Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

function wav(samples) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24); buf.writeUInt32LE(RATE * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((s, i) => buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), 44 + i * 2));
  return buf;
}

// Lowercase/underscore names: they also become res/raw resources on Android.
fs.writeFileSync('assets/sounds/beep_tick.wav', wav(tone(880, 150)));
fs.writeFileSync('assets/sounds/beep_go.wav', wav(tone(1320, 600)));
fs.writeFileSync('assets/sounds/beep_end.wav',
  wav(concat(tone(1320, 250), silence(120), tone(1320, 250), silence(120), tone(1760, 700))));
