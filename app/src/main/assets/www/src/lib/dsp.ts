export class FFT {
  size: number;
  rev: Uint32Array;
  cosTable: Record<number, Float64Array> = {};
  sinTable: Record<number, Float64Array> = {};

  constructor(size: number) {
    this.size = size;
    this.rev = new Uint32Array(size);
    for (let i = 0; i < size; i++) {
      let x = 0, bits = Math.log2(size);
      for (let b = 0; b < bits; b++) { x = (x << 1) | ((i >> b) & 1); }
      this.rev[i] = x;
    }
    for (let len = 2; len <= size; len <<= 1) {
      const half = len / 2;
      const cosArr = new Float64Array(half);
      const sinArr = new Float64Array(half);
      for (let k = 0; k < half; k++) {
        const ang = -2 * Math.PI * k / len;
        cosArr[k] = Math.cos(ang);
        sinArr[k] = Math.sin(ang);
      }
      this.cosTable[len] = cosArr;
      this.sinTable[len] = sinArr;
    }
  }

  transform(re: Float64Array, im: Float64Array, inverse: boolean) {
    const n = this.size;
    for (let i = 0; i < n; i++) {
      const j = this.rev[i];
      if (i < j) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const half = len / 2;
      const cosArr = this.cosTable[len];
      const sinArr = this.sinTable[len];
      for (let i = 0; i < n; i += len) {
        for (let k = 0; k < half; k++) {
          const cw = cosArr[k];
          const sw = inverse ? -sinArr[k] : sinArr[k];
          const uRe = re[i + k], uIm = im[i + k];
          const vRe = re[i + k + half] * cw - im[i + k + half] * sw;
          const vIm = re[i + k + half] * sw + im[i + k + half] * cw;
          re[i + k] = uRe + vRe;
          im[i + k] = uIm + vIm;
          re[i + k + half] = uRe - vRe;
          im[i + k + half] = uIm - vIm;
        }
      }
    }
    if (inverse) {
      for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
    }
  }
}

export function hannWindow(size: number) {
  const w = new Float64Array(size);
  for (let i = 0; i < size; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (size - 1));
  return w;
}

export const FRAME_SIZE = 4096;
export const HOP = FRAME_SIZE / 4;

export async function separate(left: Float32Array, right: Float32Array, sampleRate: number, onProgress: (pct: number) => void) {
  const n = Math.min(left.length, right.length);
  const window_ = hannWindow(FRAME_SIZE);
  const fft = new FFT(FRAME_SIZE);

  const vocalOut = new Float64Array(n + FRAME_SIZE);
  const instruLOut = new Float64Array(n + FRAME_SIZE);
  const instruROut = new Float64Array(n + FRAME_SIZE);
  const normSum = new Float64Array(n + FRAME_SIZE);

  const numFrames = Math.max(1, Math.floor((n - FRAME_SIZE) / HOP) + 1);
  let prevMask: Float64Array | null = null;

  const freqWeight = new Float64Array(FRAME_SIZE / 2 + 1);
  for (let k = 0; k <= FRAME_SIZE / 2; k++) {
    const freq = k * sampleRate / FRAME_SIZE;
    let weight = 0.15;
    if (freq >= 200 && freq <= 5000) weight = 1.0;
    else if (freq < 200) weight = 0.15 + 0.85 * (freq / 200);
    else if (freq < 8000) weight = 1.0 - 0.85 * ((freq - 5000) / 3000);
    freqWeight[k] = weight;
  }

  const midRe = new Float64Array(FRAME_SIZE), midIm = new Float64Array(FRAME_SIZE);
  const sideRe = new Float64Array(FRAME_SIZE), sideIm = new Float64Array(FRAME_SIZE);

  for (let f = 0; f < numFrames; f++) {
    const start = f * HOP;
    for (let i = 0; i < FRAME_SIZE; i++) {
      const idx = start + i;
      const l = idx < n ? left[idx] : 0;
      const r = idx < n ? right[idx] : 0;
      const w = window_[i];
      midRe[i] = ((l + r) * 0.5) * w; midIm[i] = 0;
      sideRe[i] = ((l - r) * 0.5) * w; sideIm[i] = 0;
    }

    fft.transform(midRe, midIm, false);
    fft.transform(sideRe, sideIm, false);

    const half = FRAME_SIZE / 2;
    const mask = new Float64Array(FRAME_SIZE);

    for (let k = 0; k <= half; k++) {
      const midMag = Math.hypot(midRe[k], midIm[k]);
      const sideMag = Math.hypot(sideRe[k], sideIm[k]);
      const centerRatio = midMag / (midMag + sideMag + 1e-9);
      const threshold = 0.62, steepness = 14;
      let sharp = 1 / (1 + Math.exp(-steepness * (centerRatio - threshold)));
      let m = sharp * freqWeight[k];
      m = Math.max(0, Math.min(1, m));
      if (prevMask) m = prevMask[k] * 0.3 + m * 0.7;
      mask[k] = m;
      if (k > 0 && k < half) mask[FRAME_SIZE - k] = m;
    }
    prevMask = mask;

    const vocRe = new Float64Array(FRAME_SIZE), vocIm = new Float64Array(FRAME_SIZE);
    const instMidRe = new Float64Array(FRAME_SIZE), instMidIm = new Float64Array(FRAME_SIZE);
    for (let i = 0; i < FRAME_SIZE; i++) {
      vocRe[i] = midRe[i] * mask[i]; vocIm[i] = midIm[i] * mask[i];
      instMidRe[i] = midRe[i] * (1 - mask[i]); instMidIm[i] = midIm[i] * (1 - mask[i]);
    }
    fft.transform(vocRe, vocIm, true);
    fft.transform(instMidRe, instMidIm, true);
    fft.transform(sideRe, sideIm, true);

    for (let i = 0; i < FRAME_SIZE; i++) {
      const idx = start + i;
      const w = window_[i];
      vocalOut[idx] += vocRe[i] * w;
      const instMid = instMidRe[i];
      const side = sideRe[i];
      instruLOut[idx] += (instMid + side) * w;
      instruROut[idx] += (instMid - side) * w;
      normSum[idx] += w * w;
    }

    if (f % 12 === 0) {
      onProgress(Math.min(99, Math.round((f / numFrames) * 100)));
      await new Promise(r => setTimeout(r, 0));
    }
  }

  const vocalL = new Float32Array(n), vocalR = new Float32Array(n);
  const instL = new Float32Array(n), instR = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const norm = normSum[i] > 1e-6 ? normSum[i] : 1;
    const v = vocalOut[i] / norm;
    vocalL[i] = Math.max(-1, Math.min(1, v));
    vocalR[i] = Math.max(-1, Math.min(1, v));
    instL[i] = Math.max(-1, Math.min(1, instruLOut[i] / norm));
    instR[i] = Math.max(-1, Math.min(1, instruROut[i] / norm));
  }
  onProgress(100);
  return { vocalL, vocalR, instL, instR };
}

export function drawWaveform(canvas: HTMLCanvasElement, floatArr: Float32Array, color: string) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(rect.width, 200), h = canvas.clientHeight || 60;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const mid = h / 2;
  const step = Math.max(1, Math.floor(floatArr.length / w));
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.shadowColor = color; ctx.shadowBlur = 5;
  ctx.beginPath();
  for (let x = 0; x < w; x++) {
    const start = x * step;
    let min = 1, max = -1;
    for (let i = 0; i < step && start + i < floatArr.length; i++) {
      const v = floatArr[start + i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    ctx.moveTo(x, mid + min * mid * 0.9);
    ctx.lineTo(x, mid + max * mid * 0.9);
  }
  ctx.stroke();
}

export function encodeWAV(left: Float32Array, right: Float32Array, sampleRate: number) {
  const numFrames = left.length;
  const bytesPerSample = 2, numChannels = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  let o = 0;
  function writeStr(s: string) { for (let i = 0; i < s.length; i++) view.setUint8(o++, s.charCodeAt(i)); }
  writeStr('RIFF'); view.setUint32(o, 36 + dataSize, true); o += 4; writeStr('WAVE');
  writeStr('fmt '); view.setUint32(o, 16, true); o += 4;
  view.setUint16(o, 1, true); o += 2;
  view.setUint16(o, numChannels, true); o += 2;
  view.setUint32(o, sampleRate, true); o += 4;
  view.setUint32(o, sampleRate * blockAlign, true); o += 4;
  view.setUint16(o, blockAlign, true); o += 2;
  view.setUint16(o, 16, true); o += 2;
  writeStr('data'); view.setUint32(o, dataSize, true); o += 4;
  for (let i = 0; i < numFrames; i++) {
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    view.setInt16(o, Math.round(clamp(left[i]) * 32767), true); o += 2;
    view.setInt16(o, Math.round(clamp(right[i]) * 32767), true); o += 2;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
