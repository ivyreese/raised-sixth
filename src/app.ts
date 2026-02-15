const START_BPM = 10
const MULTIPLES = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32]
const MIN_BPM = 20
const MAX_MULTIPLE = Math.max(...MULTIPLES)
const MAX_BPM = MIN_BPM * MAX_MULTIPLE
const OCTAVE_RANGE = Math.log2(MAX_MULTIPLE)
const FADE_OCTAVES = 3 // should prob be smaller than OCTAVE_RANGE/2
const INTERVAL_RATIO = 2 // set to 2 for octaves, 4/3 for forths, etc
const BASE_PITCH = 0.125 // pitch of the lowest voice at MIN_BPM
const BPM_PITCH_TRACK = 1 // 0 = off, 1 = one octave per BPM doubling, fractional for partial

let bpm = START_BPM
let phase = 0
let accel = 1
let time = 0

const preloadElm = document.querySelector(".preload") as HTMLElement
const canvas = document.querySelector("canvas") as HTMLCanvasElement
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D

preloadElm.textContent = "Click To Play"

const clip = (i: number, min = 0, max = 1) => Math.min(Math.max(i, min), max)
const mod = (n: number, m = 1) => ((n % m) + m) % m
const rand = (min = 0, max = 1) => Math.random() * (max - min) + min
const remap = (v: number, inMin = 0, inMax = 1, outMin = 0, outMax = 1) =>
  outMin + ((v - inMin) / (inMax - inMin)) * (outMax - outMin)

function metronomeTick() {
  accel = 1.05 //remap(time, 0, 10, 1, 1.1) // MAKE THIS SPECIAL

  // apply accel
  bpm *= accel ** dt

  // keep in the range [MIN_BPM, MIN_BPM * 2), adjusting phase to preserve beat alignment
  const octave = Math.log2(bpm / MIN_BPM)
  const wrap = Math.floor(octave)
  bpm = MIN_BPM * 2 ** (octave - wrap)
  phase /= 2 ** wrap

  const deltaPhase = (bpm / 60) * dt
  phase += deltaPhase

  for (const multiple of MULTIPLES) {
    const voiceBPM = bpm * multiple
    if (voiceBPM < MIN_BPM || voiceBPM > MAX_BPM) continue

    const prev = (phase - deltaPhase) * multiple
    const curr = phase * multiple

    if (Math.floor(curr) > Math.floor(prev)) {
      const pitch = BASE_PITCH * multiple ** Math.log2(INTERVAL_RATIO) * (bpm / MIN_BPM) ** BPM_PITCH_TRACK
      play(pitch, voiceVolume(voiceBPM))
    }
  }
}

function voiceVolume(bpm: number): number {
  const octaves = Math.log2(bpm / MIN_BPM)
  const fadeIn = clip(octaves / FADE_OCTAVES)
  const fadeOut = clip((OCTAVE_RANGE - octaves) / FADE_OCTAVES)
  return fadeIn * fadeOut
}

// Engine

let wallTime = 0
let dt = 0

function firstTick(ms: number) {
  wallTime = ms / 1000
}

function engineTick(ms: number) {
  const lastWallTime = wallTime
  wallTime = ms / 1000
  dt = Math.min(wallTime - lastWallTime, 0.1)
  time += dt
}

// Audio

let audioContext: AudioContext
let masterInput: GainNode
let buffer: AudioBuffer | undefined

function play(pitch: number, volume: number) {
  if (buffer) {
    const source = new AudioBufferSourceNode(audioContext, { buffer, playbackRate: pitch })
    const gain = new GainNode(audioContext, { gain: clip(volume) })
    source.connect(gain).connect(masterInput)
    source.start()
  }
}

function setupAudio() {
  audioContext = new window.AudioContext()
  const sampleRate = audioContext.sampleRate

  masterInput = new GainNode(audioContext, { gain: 1 })
  const analyser = audioContext.createAnalyser()
  const softCompressor = audioContext.createDynamicsCompressor()
  const hardCompressor = audioContext.createDynamicsCompressor()
  const output = audioContext.createGain()

  // Reverb
  const reverbWet = audioContext.createGain()
  const reverbDry = audioContext.createGain()
  const reverbInput = audioContext.createGain()
  const reverbOutput = audioContext.createGain()
  const convolver = audioContext.createConvolver()
  const duration = sampleRate * 0.5
  const impulse = audioContext.createBuffer(2, duration, sampleRate)
  const impulseL = impulse.getChannelData(0)
  const impulseR = impulse.getChannelData(1)
  for (let i = 0; i < duration; i++) {
    impulseL[i] = impulseR[i] = rand(-1, 1) * (1 - i / duration) ** 3
  }
  convolver.buffer = impulse
  reverbInput.connect(reverbDry).connect(reverbOutput)
  reverbInput.connect(convolver).connect(reverbWet).connect(reverbOutput)
  reverbWet.gain.value = 0.2
  reverbDry.gain.value = 0.8

  softCompressor.attack.value = 0.05
  softCompressor.knee.value = 10
  softCompressor.ratio.value = 3
  softCompressor.release.value = 0.1
  softCompressor.threshold.value = -15

  hardCompressor.attack.value = 0.003
  hardCompressor.knee.value = 5
  hardCompressor.ratio.value = 15
  hardCompressor.release.value = 0.01
  hardCompressor.threshold.value = -6
  output.gain.value = 0.5

  masterInput.connect(analyser).connect(reverbInput)
  reverbOutput.connect(softCompressor).connect(hardCompressor).connect(output)
  output.connect(audioContext.destination)

  fetch("samples/MaternalXylo.mp3")
    .then((resp) => resp.arrayBuffer())
    .then((ab) => audioContext.decodeAudioData(ab))
    .then((b) => (buffer = b))
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = ctx.strokeStyle = "#FFF"

  // HUD
  let hx = 36
  for (const text of [`BPM ${bpm.toFixed(1)}`, `Phase ${phase.toFixed(2)}`, `Accel ${accel.toFixed(4)}`]) {
    ctx.fillText(text, hx, 16)
    hx += 20 + ctx.measureText(text).width
  }

  // Voices
  for (let i = 0; i < MULTIPLES.length; i++) {
    const multiple = MULTIPLES[i]
    const voiceBPM = bpm * multiple
    if (voiceBPM < MIN_BPM || voiceBPM > MAX_BPM) continue

    const vol = voiceVolume(voiceBPM)
    const voicePhase = mod(phase * multiple, 1)
    const w = window.innerWidth
    const x = 0.1 * w + 0.8 * w * (i / (MULTIPLES.length - 1))
    const y = window.innerHeight / 2
    const alpha = 0.2 + 0.8 * vol

    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`

    const tau = Math.PI * 2
    ctx.beginPath()
    ctx.lineWidth = 2
    ctx.arc(x, y, 30, -tau / 4, -tau / 4 + tau * voicePhase)
    ctx.stroke()

    ctx.fillText(`${voiceBPM.toFixed(0)}`, x, y + 50)
  }
}

// Controls

function reset() {
  bpm = START_BPM
  phase = 0
  time = 0
}

document.getElementById("reset")!.addEventListener("click", reset)

// App

window.addEventListener("mousedown", init, { once: true })
window.addEventListener("touchstart", init, { once: true })

function init() {
  setupAudio()
  preloadElm.remove()
  resize()

  window.addEventListener("resize", resize)
  window.requestAnimationFrame((ms) => {
    firstTick(ms)
    window.requestAnimationFrame(tick)
  })
}

function tick(ms: number) {
  engineTick(ms)
  metronomeTick()
  render()
  window.requestAnimationFrame(tick)
}

function resize() {
  const dpi = window.devicePixelRatio
  canvas.width = dpi * window.innerWidth
  canvas.height = dpi * window.innerHeight
  ctx.resetTransform()
  ctx.scale(dpi, dpi)
  ctx.font = "12px sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  render()
}
