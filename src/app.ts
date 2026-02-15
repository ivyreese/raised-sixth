import Orchestra from "./orchestra.js"
import * as Engine from "./engine.js"
import * as Audio from "./audio.js"

const preloadElm = document.querySelector(".preload") as HTMLElement
const canvas = document.querySelector("canvas") as HTMLCanvasElement
const context = canvas.getContext("2d") as CanvasRenderingContext2D

const mouse = { x: 0, y: window.innerHeight / 2 }

// Wait until the JS is running to give the user some indication that their clicks will be received
preloadElm.textContent = "Click To Play"

window.addEventListener("mousedown", init, { once: true })
window.addEventListener("touchstart", init, { once: true })

function init() {
  Audio.setupAudio()
  preloadElm.remove()
  resize()

  window.addEventListener("resize", resize)
  window.requestAnimationFrame((ms) => {
    Engine.firstTick(ms)
    window.requestAnimationFrame(tick)
  })
}

function tick(ms: number) {
  Engine.tick(ms)
  Orchestra.tick(mouse)
  render()
  window.requestAnimationFrame(tick)
}

function render() {
  context.clearRect(0, 0, canvas.width, canvas.height)

  Orchestra.render(context)
  Orchestra.allPlayers.forEach((p, index) => {
    context.save()
    p.draw(context, index, Orchestra.allPlayers)
    context.restore()
  })
}

function resize() {
  const dpi = window.devicePixelRatio
  canvas.width = dpi * window.innerWidth
  canvas.height = dpi * window.innerHeight
  context.resetTransform()
  context.scale(dpi, dpi)
  initFont()
  render()
}

function initFont() {
  context.font = "12px sans-serif"
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.lineCap = "round"
  context.lineJoin = "round"
}
