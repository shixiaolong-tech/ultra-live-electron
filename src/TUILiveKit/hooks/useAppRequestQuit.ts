import { onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';

const ROUTE_NAME_LIVE_KIT_MAC_V2 = 'tui-livekit-mac-v2';

/**
 * Registers a single app-level handler for `app-request-quit` (e.g. Cmd+Q / close main window)
 * so that any page (Login, Loading, TUILiveKitMacV2, etc.) can respond and allow or cancel quit.
 * Only sends app-quit-confirmed when current route is not tui-livekit-mac-v2 (that page handles quit itself).
 * Call once in a root component that is always mounted (e.g. App.vue).
 */
export function useAppRequestQuit() {
  const router = useRouter();

  const handleAppRequestQuit = () => {
    if (router.currentRoute.value.name !== ROUTE_NAME_LIVE_KIT_MAC_V2) {
      window.ipcRenderer?.send('app-quit-confirmed');
    }
  };

  onMounted(() => {
    if (window.ipcRenderer) {
      window.ipcRenderer.on('app-request-quit', handleAppRequestQuit);
    }
  });

  onBeforeUnmount(() => {
    if (window.ipcRenderer) {
      window.ipcRenderer.off('app-request-quit', handleAppRequestQuit);
    }
  });
}
