/** Coarse, non-invasive device identifier — a random id persisted client-side, not a
 * fingerprint derived from browser/hardware characteristics (Authentication Design
 * doc §4: device registration, not tracking). */
const STORAGE_KEY = "scv_device_id";

export function getDeviceFingerprint(): string {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}
