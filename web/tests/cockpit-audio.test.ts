import test from 'node:test'
import assert from 'node:assert/strict'
import { radioClip, radioNoise, radioElement } from '../src/lib/cockpit-audio'

test('radio cue, static and HTML fallback release playback when aborted', async () => {
  const originalContext = globalThis.AudioContext, originalFetch = globalThis.fetch
  let stopped = 0, disconnected = 0
  const node = () => ({ connect(next: unknown) { return next }, disconnect() { disconnected++ } })
  class FakeContext {
    state = 'running'; sampleRate = 32; destination = {}
    createBuffer() { return { getChannelData: () => new Float32Array(64) } }
    decodeAudioData() { return Promise.resolve({}) }
    createBufferSource() { return { ...node(), buffer: null, loop: false, onended: null, start() {}, stop() { stopped++ } } }
    createGain() { return { ...node(), gain: { value: 0 } } }
    createAnalyser() { return { ...node(), fftSize: 0 } }
    createBiquadFilter() { return { ...node(), type: '', frequency: { value: 0 }, Q: { value: 0 } } }
  }
  globalThis.AudioContext = FakeContext as unknown as typeof AudioContext
  globalThis.fetch = async () => new Response(new Uint8Array([1]))
  try {
    for (const play of [(signal: AbortSignal) => radioClip('/test.mp3', signal), radioNoise]) {
      const cue = new AbortController()
      const playback = await play(cue.signal)
      cue.abort(); await playback.ended; playback.stop()
    }
    assert.equal(stopped, 2)
    assert.equal(disconnected, 7)
    const audio = Object.assign(new EventTarget(), { src: '', currentTime: 0, volume: 0, paused: false, play: async () => {}, pause() { this.paused = true } })
    const abort = new AbortController()
    const ended = radioElement(audio as unknown as HTMLAudioElement, '/end.mp3', abort.signal)
    abort.abort()
    await assert.rejects(ended)
    assert.equal(audio.paused, true)
  } finally {
    globalThis.AudioContext = originalContext; globalThis.fetch = originalFetch
  }
})
