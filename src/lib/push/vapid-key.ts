/**
 * #108 — push utiliteta: pretvori VAPID base64URL javni ključ v Uint8Array
 * za `pushManager.subscribe({ applicationServerKey })`. Deljena med
 * admin push-card in javnim walk-in push gumbom.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  // Explicit ArrayBuffer: `applicationServerKey` requires BufferSource and
  // TS 5.7+ narrows Uint8Array<ArrayBufferLike> away from ArrayBufferView.
  const output = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}
