import fs from 'fs'
import path from 'path'

const sampleRate = 44100
const durationSec = 110
const totalSamples = sampleRate * durationSec

function clamp(v) {
  return Math.max(-1, Math.min(1, v))
}

function fract(v) {
  return v - Math.floor(v)
}

function hash(v) {
  return fract(Math.sin(v * 127.1 + 311.7) * 43758.5453123)
}

function bipolarHash(v) {
  return hash(v) * 2 - 1
}

function writeWav(filePath, sampleFn) {
  const channels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * channels * (bitsPerSample / 8)
  const blockAlign = channels * (bitsPerSample / 8)
  const dataSize = totalSamples * blockAlign
  const buffer = Buffer.alloc(44 + dataSize)

  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(channels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(byteRate, 28)
  buffer.writeUInt16LE(blockAlign, 32)
  buffer.writeUInt16LE(bitsPerSample, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)

  for (let i = 0; i < totalSamples; i += 1) {
    const t = i / sampleRate
    const v = clamp(sampleFn(t, i))
    buffer.writeInt16LE(Math.floor(v * 32767), 44 + i * 2)
  }

  fs.writeFileSync(filePath, buffer)
}

function lowBed(t, base, wobbleHz, wobbleAmt) {
  const drift = Math.sin(2 * Math.PI * wobbleHz * t) * wobbleAmt
  return Math.sin(2 * Math.PI * (base + drift) * t)
}

function filteredNoise(t, seed, rate) {
  const a = bipolarHash(t * rate + seed)
  const b = bipolarHash(t * rate * 0.5 + seed * 1.7)
  return (a * 0.7 + b * 0.3)
}

function gatedBurst(t, seed, gateHz) {
  const gate = Math.max(0, Math.sin(2 * Math.PI * gateHz * t + seed))
  return filteredNoise(t, seed * 2.3, 60 + seed * 8) * gate
}

function sparseCrackle(t, i, seed) {
  const step = Math.floor(i / 520)
  const n = hash(step * 1.37 + seed)
  if (n < 0.989) return 0
  const phase = (i % 520) / 520
  const env = Math.exp(-phase * 26)
  return (bipolarHash(step * 17.13 + seed * 3.1) * 0.7 + 0.3) * env
}

function doomHit(t, everySec, widthSec, phase = 0) {
  const m = (t + phase) % everySec
  if (m > widthSec) return 0
  const x = m / widthSec
  const env = Math.exp(-x * 5.5)
  const thump = Math.sin(2 * Math.PI * 28 * t) + Math.sin(2 * Math.PI * 41 * t) * 0.5
  return thump * env
}

function triWave(freq, t) {
  return (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * freq * t))
}

function celloPad(t, freq, wobbleHz = 0.02, wobbleAmt = 1.2) {
  const f = freq + Math.sin(2 * Math.PI * wobbleHz * t) * wobbleAmt
  const a = triWave(f, t) * 0.65
  const b = Math.sin(2 * Math.PI * (f * 0.5) * t) * 0.35
  return a + b
}

function choirTone(t, base, slowHz, driftAmt) {
  const drift = Math.sin(2 * Math.PI * slowHz * t) * driftAmt
  const f = base + drift
  return (
    Math.sin(2 * Math.PI * f * t) * 0.55 +
    Math.sin(2 * Math.PI * (f * 2.01) * t) * 0.25 +
    Math.sin(2 * Math.PI * (f * 2.98) * t) * 0.2
  )
}

function apocalypseSample(t, i) {
  // Dark zombie ambience: low drones, distant impacts, no symphonic motifs.
  const root = 31.8 + Math.sin(2 * Math.PI * 0.004 * t) * 1.4
  const subA = lowBed(t, root, 0.006, 0.55) * 0.3
  const subB = lowBed(t, root * 0.5, 0.004, 0.35) * 0.22
  const iron = triWave(root * 1.98, t) * 0.07
  const wind = filteredNoise(t, 0.32, 2.1) * 0.03
  const fog = filteredNoise(t, 0.57, 6.7) * 0.02
  const thumpA = doomHit(t, 8.5, 2.8, 0.41) * 0.2
  const thumpB = doomHit(t, 13.0, 3.4, 1.17) * 0.17
  const metalCreak = gatedBurst(t, 0.27, 0.42) * 0.03
  const embers = sparseCrackle(t, i, 0.19) * 0.01
  const swell = 0.62 + 0.38 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 0.017 * t))
  return (subA + subB + iron) * swell + wind + fog + thumpA + thumpB + metalCreak + embers
}

function duskSample(t, i) {
  const root = lowBed(t, 70.5, 0.013, 0.6) * 0.14
  const fifth = lowBed(t, 106.0, 0.011, 0.4) * 0.08
  const farTone = Math.sin(2 * Math.PI * 210.8 * t) * 0.02

  const wind = filteredNoise(t, 0.17, 4.1) * 0.03
  const rainSoft = filteredNoise(t, 0.62, 18.5) * 0.013
  const rainTick = sparseCrackle(t, i, 0.72) * 0.012

  const swell = 0.65 + 0.35 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 0.015 * t))
  return (root + fifth + farTone) * swell + wind + rainSoft + rainTick
}

function tensionSample(t, i) {
  // Tight stalking tension: heartbeat pulse, nervous high squeal, gritty decay.
  const bass = lowBed(t, 52.4, 0.018, 0.7) * 0.16
  const pulseGate = Math.max(0, Math.sin(2 * Math.PI * 1.35 * t))
  const heartbeat = Math.sin(2 * Math.PI * 46.8 * t) * pulseGate * 0.11
  const strain = Math.sin(2 * Math.PI * (91.3 + Math.sin(2 * Math.PI * 0.11 * t) * 2.1) * t) * 0.08
  const dissonant = Math.sin(2 * Math.PI * 97.8 * t) * 0.055
  const staticBed = filteredNoise(t, 0.66, 28) * 0.013
  const rustle = gatedBurst(t, 0.91, 7.3) * 0.018
  const pops = sparseCrackle(t, i, 0.63) * 0.015
  return bass + heartbeat + strain + dissonant + staticBed + rustle + pops
}

function safehouseSample(t, i) {
  const root = lowBed(t, 81.6, 0.008, 0.4) * 0.11
  const third = lowBed(t, 102.9, 0.007, 0.35) * 0.07
  const fifth = lowBed(t, 122.6, 0.007, 0.3) * 0.06

  const room = filteredNoise(t, 0.11, 3.3) * 0.014
  const fireBody = filteredNoise(t, 0.21, 12.2) * 0.009
  const embers = sparseCrackle(t, i, 0.21) * 0.01

  const warmth = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 0.018 * t))
  return (root + third + fifth) * warmth + room + fireBody + embers
}

const outDir = '/opt/greyhourrp/public/audio'
fs.mkdirSync(outDir, { recursive: true })

writeWav(path.join(outDir, 'apocalypse.wav'), apocalypseSample)
writeWav(path.join(outDir, 'dusk.wav'), duskSample)
writeWav(path.join(outDir, 'tension.wav'), tensionSample)
writeWav(path.join(outDir, 'safehouse.wav'), safehouseSample)

console.log('Generated distinct audio presets in', outDir)
