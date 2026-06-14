/**
 * Main-window singleton cache of per-camera beauty effect properties.
 *
 * This is the authoritative record of "which beauty effects are applied to
 * which camera" for the main window. It is intentionally a module-level
 * singleton (not component state) so that any part of the main-window UI can
 * read or mutate it. Two places need the SAME map:
 *   - `LiveScenePanel/index.vue`: owns the IPC sync with the child beauty
 *     dialog (BEAUTY_UPDATE overwrite, camera-switch migration, edit-mode
 *     effectConstant back-fill).
 *   - `LiveScenePanel/MaterialItem.vue`: owns the camera-removal path and must
 *     drop the entry so that re-adding the same deviceId starts from a clean
 *     state instead of resurrecting the previous camera's effects.
 *
 * It holds plain JS data only (never rendered), so a raw Map is used rather
 * than a reactive structure. The mirror native plugin state is managed
 * separately by `useVideoEffectManager` (also a singleton, keyed by the same
 * camera deviceId).
 */
const beautyPropertiesMap = new Map<string, unknown[]>();

/** Read the cached properties for a camera (undefined when none applied). */
export function getBeautyProperties(cameraId: string): unknown[] | undefined {
  return beautyPropertiesMap.get(cameraId);
}

/** Overwrite the cached properties for a camera. */
export function setBeautyProperties(cameraId: string, properties: unknown[]): void {
  beautyPropertiesMap.set(cameraId, properties);
}

/** Drop the cached properties for a camera (no-op when absent). */
export function deleteBeautyProperties(cameraId: string): void {
  beautyPropertiesMap.delete(cameraId);
}

/**
 * Move the cached entry from one cameraId to another and return the moved
 * properties (or undefined when the source had none). Used on camera deviceId
 * switch so the beauty config follows the user to the newly selected device.
 */
export function migrateBeautyProperties(oldId: string, newId: string): unknown[] | undefined {
  const props = beautyPropertiesMap.get(oldId);
  beautyPropertiesMap.delete(oldId);
  if (props && props.length > 0) {
    beautyPropertiesMap.set(newId, props);
  }
  return props;
}

export default beautyPropertiesMap;
