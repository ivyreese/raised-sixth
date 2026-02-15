export type Stack = { x: number; y: number }

export function beginStack(x: number, y: number): Stack {
  return { x, y }
}

export function stackH(context: CanvasRenderingContext2D, stack: Stack, text: any) {
  context.fillText(text, stack.x, stack.y)
  stack.x += 20 + context.measureText(text).width
}

export function stackV(context: CanvasRenderingContext2D, stack: Stack, text: any) {
  context.fillText(text, stack.x, stack.y)
  stack.y += 20
}
