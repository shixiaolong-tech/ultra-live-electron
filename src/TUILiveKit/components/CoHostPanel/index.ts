/**
 * Demo-layer CoHostPanel barrel.
 *
 * Currently we only need to expose `CoHostPanelDialog` for child-window mode.
 * The Mac path imports the kit's `CoHostPanel` directly from
 * `tuikit-atomicx-vue3-electron`, so no wrapper is needed here.
 */
import CoHostPanelDialog from './CoHostPanelDialog.vue';

export default CoHostPanelDialog;
export { CoHostPanelDialog };
