<template>
  <div class="tui-live-kit-child dark-theme">
    <CameraSettingDialog
      v-if="currentPanel === ChildPanelType.Camera"
      custom-classes="dialog-in-child-window"
      :media-source="editingMediaSource"
      @add-camera-material="handleAddCameraMaterial"
      @update-camera-material="handleUpdateCameraMaterial"
      @close="handleClose"
    />
    <ScreenShareSettingDialog
      v-else-if="currentPanel === ChildPanelType.Screen"
      custom-classes="dialog-in-child-window"
      :media-source="editingMediaSource"
      @add-screen-material="handleAddScreenMaterial"
      @update-screen-material="handleUpdateScreenMaterial"
      @close="handleClose"
    />
    <LocalVideoDialog
      v-else-if="currentPanel === ChildPanelType.VideoFile"
      :key="`video-file-${panelOpenSeq}`"
      custom-classes="dialog-in-child-window"
      :media-source="editingMediaSource"
      @add-local-video-material="handleAddLocalVideoMaterial"
      @update-local-video-material="handleUpdateLocalVideoMaterial"
      @close="handleClose"
    />
    <OnlineVideoDialog
      v-else-if="currentPanel === ChildPanelType.OnlineVideo"
      :key="`online-video-${panelOpenSeq}`"
      custom-classes="dialog-in-child-window"
      :media-source="editingMediaSource"
      @add-online-video-material="handleAddOnlineVideoMaterial"
      @update-online-video-material="handleUpdateOnlineVideoMaterial"
      @close="handleClose"
    />
    <MaterialRenameDialog
      v-else-if="currentPanel === ChildPanelType.Rename && editingMediaSource"
      custom-classes="dialog-in-child-window"
      :material="editingMediaSource"
      @rename="handleRenameMaterialConfirm"
      @close="handleClose"
    />
    <CoGuestPanelDialog
      v-else-if="currentPanel === ChildPanelType.CoGuestConnection"
      custom-classes="dialog-in-child-window"
      :data="dataInEdit as any"
      @close="handleClose"
    />
    <LayoutConfigPanelDialog
      v-else-if="currentPanel === ChildPanelType.LayoutConfig"
      custom-classes="dialog-in-child-window"
      :layoutSwitchVisible="dataInEdit?.layoutSwitchVisible ?? false"
      :currentLayoutTemplate="dataInEdit?.currentLayoutTemplate ?? null"
      @close="handleClose"
    />
    <SettingPanelDialog
      v-else-if="currentPanel === ChildPanelType.Setting"
      :data="dataInEdit"
      @close="handleClose"
    />
    <UserProfileDialog
      v-else-if="currentPanel === ChildPanelType.UserProfile"
      custom-classes="dialog-in-child-window"
      :visible="true"
      :user-info="dataInEdit as UserProfileInfo"
      @close="handleClose"
    />
    <LiveTitleSettingDialog
      v-else-if="currentPanel === ChildPanelType.LiveTitleSetting"
      :data="liveTitleSettingData"
      @close="handleClose"
    />
    <MusicPanelDialog
      v-else-if="currentPanel === ChildPanelType.Music"
      custom-classes="dialog-in-child-window"
      :data="musicPanelData"
      @action="handleMusicAction"
      @close="handleClose"
    />
    <CoHostPanelDialog
      v-else-if="currentPanel === ChildPanelType.CoHostConnection"
      custom-classes="dialog-in-child-window"
      :data="coHostPanelData"
      @action="handleCoHostAction"
      @close="handleClose"
    />
    <div v-else class="child-view-placeholder"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { TUIToast, TOAST_TYPE, useUIKit } from '@tencentcloud/uikit-base-component-vue3';
import CameraSettingDialog from './components/LiveScenePanel/CameraSettingDialog.vue';
import ScreenShareSettingDialog from './components/LiveScenePanel/ScreenShareSettingDialog.vue';
import LocalVideoDialog from './components/LiveScenePanel/LocalVideoDialog.vue';
import OnlineVideoDialog from './components/LiveScenePanel/OnlineVideoDialog.vue';
import MaterialRenameDialog from './components/LiveScenePanel/MaterialRenameDialog.vue';
import CoGuestPanelDialog from './components/CoGuestPanel';
import LayoutConfigPanelDialog from './components/LayoutConfigPanel/LayoutConfigPanelDialog.vue';
import SettingPanelDialog from './components/SettingPanel/index.vue';
import UserProfileDialog from './components/LiveHeader/UserProfileDialog.vue';
import { UserProfileInfo } from './components/LiveUserProfile/index.vue';
import LiveTitleSettingDialog from './components/LiveHeader/LiveTitleSettingDialog.vue';
import MusicPanelDialog from './components/MusicPanel/MusicPanelDialog.vue';
import CoHostPanelDialog from './components/CoHostPanel/CoHostPanelDialog.vue';
import { ipcBridge, IPCMessageType, toPlainIpcPayload, ChildPanelType } from './ipc';
import type {
  ShowChildPanelPayload,
  UpdateChildDataPayload,
  LiveTitleSettingInitialData,
  AddLocalVideoPayload,
  UpdateLocalVideoPayload,
  AddOnlineVideoPayload,
  UpdateOnlineVideoPayload,
  MusicPanelSnapshot,
  MusicActionPayload,
  MusicEventPayload,
  CoHostActionPayload,
  CoHostEventPayload,
  CoHostPanelSnapshot,
} from './ipc';
import { useDeviceState, MusicPlayStatus, CoHostStatus, CoHostLayoutTemplate } from 'tuikit-atomicx-vue3-electron';
import type { MediaSource } from 'tuikit-atomicx-vue3-electron';
import { getPlayErrorMessage } from './components/MusicPanel/helpers';
import logger from './utils/logger';

const logPrefix = '[ChildView]';

const { getCameraList } = useDeviceState();

/** Current panel: only driven by window-message (ipcBridge), not by main process 'show' */
const currentPanel = ref<ChildPanelType>(ChildPanelType.None);
const dataInEdit = ref<Record<string, any> | undefined>(undefined);

/**
 * Monotonic counter incremented on every SHOW_CHILD_PANEL event.
 *
 * The child window is `hide()`-d rather than destroyed between opens (see the
 * main process `close-child` handler), so this script context survives across
 * multiple open/close cycles. When the same panelType is shown twice in a row,
 * `currentPanel` does not change, so Vue's v-if keeps the existing dialog
 * instance mounted and its internal refs (filePath / videoUrl / ...) retain
 * stale values from the previous session.
 *
 * Binding `:key="panelOpenSeq"` on state-carrying dialogs (VideoFile / OnlineVideo)
 * forces Vue to unmount the old instance and mount a fresh one on each open,
 * guaranteeing a clean form state. Dialogs that read all state from props
 * (Camera / Screen / Rename / LayoutConfig / ...) don't need the key since they
 * would already rebuild when the bound prop reference changes — but these two
 * video dialogs capture props.mediaSource only at setup and never re-sync.
 *
 * Explicitly NOT applied to MusicPanelDialog: its controlled-mode snapshot flows
 * through UPDATE_CHILD_DATA and is designed to persist across reopens (so the
 * user sees the same playback position / list after closing and reopening the
 * panel mid-session).
 */
const panelOpenSeq = ref(0);

/**
 * Unified MediaSource resolved from `dataInEdit`.
 * Returns the raw payload when it looks like a MediaSource (carries `sourceId` or
 * `sourceType`), otherwise null. A null value tells dialog components to render
 * in "add" mode, while a non-null value switches them to "edit" mode.
 *
 * All MediaSource-shaped panels (Camera / Screen / Rename / VideoFile / OnlineVideo)
 * share this single computed instead of duplicating the resolver per panel.
 *
 * The cast to `MediaSource` is intentional: the IPC payload only carries a partial
 * shape (e.g. add-mode panels rely on dialogs to fill remaining fields), but each
 * dialog is designed to tolerate this and the downstream state layer reconstructs
 * the full SDK MediaSource via `childPayloadToMediaSource()`.
 */
const editingMediaSource = computed<MediaSource | null>(() => {
  const data = dataInEdit.value;
  if (!data || typeof data !== 'object') return null;
  if ('sourceId' in data || 'sourceType' in data) return data as unknown as MediaSource;
  return null;
});

const liveTitleSettingData = computed<LiveTitleSettingInitialData | undefined>(() => {
  const data = dataInEdit.value;
  if (!data || typeof data !== 'object') return undefined;
  if (!('dialogId' in data) || !data.dialogId) return undefined;
  return data as LiveTitleSettingInitialData;
});

/**
 * Read-only MusicPanelSnapshot for MusicPanelDialog.
 *
 * dataInEdit carries the snapshot pushed from the main window via both
 * SHOW_CHILD_PANEL initialData (first frame) and UPDATE_CHILD_DATA (incremental).
 * We provide a safe default so the panel can render even before the first message
 * arrives (which happens during the brief window between v-if flip and IPC delivery).
 */
const musicPanelData = computed<MusicPanelSnapshot>(() => {
  const data = dataInEdit.value;
  if (data && typeof data === 'object' && 'musicList' in data) {
    return data as MusicPanelSnapshot;
  }
  return {
    musicList: [],
    playURL: null,
    playStatus: MusicPlayStatus.Idle,
    playProgress: 0,
    totalDuration: 0,
    musicVolume: 60,
    musicPitch: 0,
  };
});

/**
 * Read-only CoHostPanelSnapshot for CoHostPanelDialog.
 *
 * Same pattern as `musicPanelData`: dataInEdit carries the snapshot pushed
 * from the main window via SHOW_CHILD_PANEL initialData and UPDATE_CHILD_DATA
 * incremental frames. A safe default keeps the panel renderable even before
 * the first IPC frame arrives.
 */
const coHostPanelData = computed<CoHostPanelSnapshot>(() => {
  const data = dataInEdit.value;
  if (data && typeof data === 'object' && 'coHostStatus' in data) {
    return data as CoHostPanelSnapshot;
  }
  return {
    loginUserInfo: null,
    currentLive: null,
    coHostStatus: CoHostStatus.Disconnected,
    candidates: [],
    candidatesCursor: '',
    invitees: [],
    connected: [],
    applicant: null,
    mutedHostLiveIds: [],
    battleId: '',
    battleUsers: [],
    battleScore: [],
    pendingBattleRequestUserIds: [],
    pendingBattleRequestId: '',
    pendingPkInviteeUserIds: [],
    hasPendingBattleInvite: false,
    hasPendingConnectionInvite: false,
    hasPendingBattleAutoStart: false,
    configForm: {
      battleDuration: 5 * 60,
      coHostLayoutTemplate: CoHostLayoutTemplate.HostDynamicGrid,
    },
  };
});

function handleAddCameraMaterial(payload: Record<string, unknown>) {
  logger.log(`${logPrefix} addCameraMaterial`, payload);
  ipcBridge.sendToMain(IPCMessageType.ADD_MEDIA_SOURCE, toPlainIpcPayload(payload));
  window.ipcRenderer.send('close-child');
}

function handleUpdateCameraMaterial(oldMediaSource: Record<string, unknown>, updateCameraInfo: Record<string, unknown>) {
  logger.log(`${logPrefix} updateCameraMaterial`, oldMediaSource, updateCameraInfo);
  const merged = { ...updateCameraInfo, predata: oldMediaSource };
  ipcBridge.sendToMain(IPCMessageType.UPDATE_MEDIA_SOURCE, toPlainIpcPayload(merged));
  window.ipcRenderer.send('close-child');
}

function handleAddScreenMaterial(payload: Record<string, unknown>) {
  logger.log(`${logPrefix} addScreenMaterial`, payload);
  ipcBridge.sendToMain(IPCMessageType.ADD_MEDIA_SOURCE, toPlainIpcPayload(payload));
  window.ipcRenderer.send('close-child');
}

function handleUpdateScreenMaterial(oldMediaSource: Record<string, unknown>, updateInfo: Record<string, unknown>) {
  logger.log(`${logPrefix} updateScreenMaterial`, oldMediaSource, updateInfo);
  const merged = { ...updateInfo, predata: oldMediaSource };
  ipcBridge.sendToMain(IPCMessageType.UPDATE_MEDIA_SOURCE, toPlainIpcPayload(merged));
  window.ipcRenderer.send('close-child');
}

function handleAddLocalVideoMaterial(payload: Omit<AddLocalVideoPayload, 'mediaKind'>) {
  logger.log(`${logPrefix} addLocalVideoMaterial`, payload);
  // Tag the message kind so the main window can dispatch to the correct MediaSource builder.
  const tagged: AddLocalVideoPayload = { ...payload, mediaKind: 'localVideo' };
  ipcBridge.sendToMain(IPCMessageType.ADD_MEDIA_SOURCE, toPlainIpcPayload(tagged));
  window.ipcRenderer.send('close-child');
}

function handleUpdateLocalVideoMaterial(oldMediaSource: MediaSource, updateInfo: Omit<AddLocalVideoPayload, 'mediaKind'>) {
  logger.log(`${logPrefix} updateLocalVideoMaterial`, oldMediaSource, updateInfo);
  const merged: UpdateLocalVideoPayload = {
    ...updateInfo,
    mediaKind: 'localVideo',
    predata: oldMediaSource as unknown as Record<string, unknown>,
  };
  ipcBridge.sendToMain(IPCMessageType.UPDATE_MEDIA_SOURCE, toPlainIpcPayload(merged));
  window.ipcRenderer.send('close-child');
}

function handleAddOnlineVideoMaterial(payload: Omit<AddOnlineVideoPayload, 'mediaKind'>) {
  logger.log(`${logPrefix} addOnlineVideoMaterial`, payload);
  const tagged: AddOnlineVideoPayload = { ...payload, mediaKind: 'onlineVideo' };
  ipcBridge.sendToMain(IPCMessageType.ADD_MEDIA_SOURCE, toPlainIpcPayload(tagged));
  window.ipcRenderer.send('close-child');
}

function handleUpdateOnlineVideoMaterial(oldMediaSource: MediaSource, updateInfo: Omit<AddOnlineVideoPayload, 'mediaKind'>) {
  logger.log(`${logPrefix} updateOnlineVideoMaterial`, oldMediaSource, updateInfo);
  const merged: UpdateOnlineVideoPayload = {
    ...updateInfo,
    mediaKind: 'onlineVideo',
    predata: oldMediaSource as unknown as Record<string, unknown>,
  };
  ipcBridge.sendToMain(IPCMessageType.UPDATE_MEDIA_SOURCE, toPlainIpcPayload(merged));
  window.ipcRenderer.send('close-child');
}

function handleRenameMaterialConfirm(newName: string) {
  const mediaSource = editingMediaSource.value;
  logger.log(`${logPrefix} renameMaterialConfirm`, newName, mediaSource);
  if (!mediaSource) {
    window.ipcRenderer.send('close-child');
    return;
  }
  const trimmed = (newName || '').trim();
  if (!trimmed || trimmed === mediaSource.name) {
    window.ipcRenderer.send('close-child');
    return;
  }

  const payload = {
    predata: mediaSource,
    name: trimmed,
  };
  ipcBridge.sendToMain(IPCMessageType.UPDATE_MEDIA_SOURCE, toPlainIpcPayload(payload));
  window.ipcRenderer.send('close-child');
}

async function handleClose() {
  const current = currentPanel.value;
  currentPanel.value = ChildPanelType.None;
  dataInEdit.value = undefined;
  await nextTick();
  ipcBridge.sendToElectronMain(IPCMessageType.HIDE_CHILD_PANEL, {
    panelType: current,
  });
}

/**
 * Forward a MusicPanelDialog user intent back to the main window.
 *
 * Unlike media-source add/update handlers which also call `close-child` after
 * sending, we deliberately keep the child window open so the user can keep
 * interacting (e.g. pause then adjust volume then resume); the window is only
 * closed by an explicit close click or by the main window sending HIDE_CHILD_PANEL.
 */
function handleMusicAction(action: MusicActionPayload) {
  logger.log(`${logPrefix} musicAction`, action);
  ipcBridge.sendToMain(IPCMessageType.MUSIC_ACTION, toPlainIpcPayload(action));
}

/**
 * Forward a CoHost / Battle user intent back to the main window.
 *
 * Same lifecycle contract as handleMusicAction: the child window is kept open
 * across action dispatches so the user can keep interacting; only an explicit
 * close click or a HIDE_CHILD_PANEL from the main window tears it down.
 */
function handleCoHostAction(action: CoHostActionPayload) {
  logger.log(`${logPrefix} cohostAction`, action);
  ipcBridge.sendToMain(IPCMessageType.COHOST_ACTION, toPlainIpcPayload(action));
}

/**
 * Outbound co-host invitation toasts authoritatively live on the main window
 * (so they can be coordinated with reject/timeout/cancel events). The main
 * window tells the child via COHOST_EVENT when to open / close them; the
 * child stores the close-handle locally per userId so a later closeSentToast
 * event can dismiss the right toast.
 */
const cohostSentToastHandles = new Map<string, () => void>();

function onCoHostEvent(event: CoHostEventPayload) {
  logger.log(`${logPrefix} cohostEvent`, event);
  switch (event.event) {
  case 'connectionSentToast': {
    const sent = TUIToast({
      type: TOAST_TYPE.SUCCESS,
      message: t('Co-host invitation sent to user', { userName: event.userName || event.userId }),
    });
    if (sent?.close) {
      cohostSentToastHandles.set(event.userId, sent.close);
    }
    break;
  }
  case 'closeSentToast': {
    const close = cohostSentToastHandles.get(event.userId);
    if (close) {
      try {
        close();
      } catch (_e) {
        // Ignore: toast may already be closed by its own timer.
      }
      cohostSentToastHandles.delete(event.userId);
    }
    break;
  }
  case 'battleSentToast': {
    // Battle invite "sent" toasts are not tracked for later dismissal — kit
    // BattlePanel lets them complete their own life-cycle. We just render.
    TUIToast({
      type: TOAST_TYPE.SUCCESS,
      message: t('Battle invitation sent to user', { userName: event.userName || event.userId }),
    });
    break;
  }
  case 'errorToast':
    TUIToast({ type: TOAST_TYPE.ERROR, message: event.message });
    break;
  default: {
    // Exhaustiveness guard: any new variant must be handled here.
    const _exhaustive: never = event;
    void _exhaustive;
  }
  }
}

const { t } = useUIKit();

/** Show a localized toast triggered by MUSIC_EVENT from the main window. */
function onMusicEvent(event: MusicEventPayload) {
  logger.log(`${logPrefix} musicEvent`, event);
  if (event.event === 'onPlayError') {
    TUIToast({
      type: TOAST_TYPE.ERROR,
      message: getPlayErrorMessage(event.code, t),
    });
  }
}

onMounted(() => {
  // Tag the child window's <body> so the global Toast override below can be
  // scoped to this window only. Toasts are rendered imperatively into
  // document.body (outside this component subtree), so a scoped style cannot
  // reach them; the marker class lets us cap their width / enable wrapping in
  // the narrow child window without affecting the main window's toasts.
  document.body.classList.add('tui-live-kit-child-window');

  getCameraList().catch((e) => logger.log(`${logPrefix} pre-fetch camera list failed`, e));

  // ============== Unified panel control via SHOW_CHILD_PANEL ==============
  ipcBridge.on(IPCMessageType.SHOW_CHILD_PANEL, (payload: ShowChildPanelPayload) => {
    logger.log(`${logPrefix} received SHOW_CHILD_PANEL, panelType=${payload.panelType}`, payload.initialData);
    currentPanel.value = payload.panelType;
    dataInEdit.value = payload.initialData ?? undefined;
    // Bump the open sequence so dialogs bound with `:key="panelOpenSeq"` remount
    // with a clean internal state even when panelType is identical to the previous
    // open (e.g. user closes and reopens the "Add Local Video" dialog).
    panelOpenSeq.value += 1;

    // Defer the camera list refresh to the next tick so it does not block the
    // first paint of the dialog. The SDK getDevicesList call is a sync-blocking
    // native binding under the hood; calling it inline freezes the renderer
    // for hundreds of ms, manifesting as a black flash on every reopen.
    if (payload.panelType === ChildPanelType.Camera) {
      setTimeout(() => {
        getCameraList().catch((e) => logger.log(`${logPrefix} on-show camera list refresh failed`, e));
      }, 0);
    }
  });

  // ============== Data updates via UPDATE_CHILD_DATA ==============
  ipcBridge.on(IPCMessageType.UPDATE_CHILD_DATA, (payload: UpdateChildDataPayload) => {
    logger.log(`${logPrefix} received UPDATE_CHILD_DATA, panelType=${payload.panelType}, currentPanel=${currentPanel.value}`, payload.data);
    if (payload.panelType === currentPanel.value) {
      dataInEdit.value = payload.data;
    }
    // else: ignore, current panel doesn't match
  });

  // ============== Music event passthrough from main window ==============
  ipcBridge.on(IPCMessageType.MUSIC_EVENT, onMusicEvent);

  // ============== CoHost / Battle event passthrough from main window ==============
  ipcBridge.on(IPCMessageType.COHOST_EVENT, onCoHostEvent);
});
</script>

<!--
  Global (non-scoped) override for the imperative TUIToast.

  TUIToast renders its node into document.body, outside this component's
  subtree, so a scoped style cannot target it. We scope the override under the
  `body.tui-live-kit-child-window` marker class (added in onMounted) so it only
  applies inside the narrow child window — the main window's <body> never gets
  this class, so its toasts stay unchanged.

  On Electron the toast always uses the PC variant (.tui-message-wrap), which is
  capped at a fixed 628px with `white-space: nowrap`, so in the much narrower
  child window long messages overflow the viewport and get clipped. Cap the
  toast at 80% of the (child) window width and let long messages wrap instead.
-->
<style lang="scss">
body.tui-live-kit-child-window {
  .tui-message-wrap {
    max-width: 80vw;
    width: fit-content;
  }

  .tui-message p {
    white-space: normal;
    overflow-wrap: anywhere;
    word-break: break-word;
    text-overflow: clip;
  }
}
</style>

<style lang="scss" scoped>
.tui-live-kit-child {
  position: relative;
  height: 100%;
  background-color: var(--bg-color-dialog, #1f2024);
  color: var(--text-color-primary, #fff);
  font-size: 0.875rem;
  overflow: hidden;
  overflow-y: auto;
  -ms-overflow-style: none;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    width: 0;
    height: 0;
    display: none;
  }
}

.child-view-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 1rem;
  text-align: center;
}

:deep(.dialog-in-child-window) {
  width: 100% !important;
  max-width: none;
  height: 100% !important;
  max-height: none;
  margin: 0;
  padding: 20px;
  display: flex;
  flex-direction: column;
  border-radius: 0;
}
</style>
