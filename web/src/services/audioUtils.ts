export function getWavDurationFromBytes(buffer: ArrayBuffer): number {
  const view = new DataView(buffer)
  let offset = 12
  while (offset < buffer.byteLength) {
    const chunkId = String.fromCharCode(...new Uint8Array(buffer, offset, 4))
    const chunkSize = view.getUint32(offset + 4, true)
    if (chunkId === 'fmt ') {
      const numChannels = view.getUint16(offset + 10, true)
      const sampleRate = view.getUint32(offset + 12, true)
      const bitsPerSample = view.getUint16(offset + 22, true)
      offset += 8 + chunkSize
      while (offset < buffer.byteLength) {
        const dChunkId = String.fromCharCode(...new Uint8Array(buffer, offset, 4))
        const dChunkSize = view.getUint32(offset + 4, true)
        if (dChunkId === 'data') {
          const bytesPerSec = sampleRate * numChannels * (bitsPerSample / 8)
          return bytesPerSec > 0 ? dChunkSize / bytesPerSec : 0
        }
        offset += 8 + dChunkSize
      }
      return 0
    }
    offset += 8 + chunkSize
  }
  return 0
}
export async function getWavDurationFromBlob(blob: Blob): Promise<number> {
  return getWavDurationFromBytes(await blob.arrayBuffer())
}
export function genId(): string { return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}` }
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
