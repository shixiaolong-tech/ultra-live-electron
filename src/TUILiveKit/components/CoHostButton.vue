<template>
  <div
    class="custom-icon-container"
    :class="{ 'disabled': isCoHostDisabled }"
    @click="handleCoHost"
  >
    <IconCoHost class="custom-icon" />
    <span class="custom-text co-host-text">{{ t('CoHost') }}</span>
  </div>
  <!-- Self-managed mode (Mac, or Windows without child-window flag): kit panel owns its state. -->
  <CoHostPanel
    v-if="!props.isShowingInChildWindow"
    v-model:visible="coHostPanelVisible"
    class="co-host-panel"
  />
</template>

<script lang="ts" setup>
/**
 * CoHostButton supports two modes:
 *
 * - `isShowingInChildWindow=false` (default, Mac): renders the kit's stateful
 *   `<CoHostPanel>` inline. The kit panel owns CoHostState / BattleState
 *   directly and runs the full UX without IPC.
 *
 * - `isShowingInChildWindow=true` (Windows): opens a real child BrowserWindow
 *   and pushes a read-only `CoHostPanelSnapshot` over IPC. This component
 *   (main window) remains the sole owner of the CoHost / Battle state and the
 *   "pending invitation" / "muted hosts" / "config form" bookkeeping; the child
 *   window's `<CoHostPanelDialog>` is a pure view that emits user intents back
 *   over IPC (`COHOST_ACTION`), and toast UX is driven via `COHOST_EVENT`.
 *
 * Mirrors the dual-mode pattern already in use by MusicButton.vue.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Ref } from 'vue';
import {
  IconCoHost,
  TOAST_TYPE,
  TUIToast,
  useUIKit,
} from '@tencentcloud/uikit-base-component-vue3';
import { TUIConnectionCode } from '@tencentcloud/tuiroom-engine-electron';
import {
  BattleEvent,
  CoHostEvent,
  CoHostLayoutTemplate,
  CoHostPanel,
  LiveOrientation,
  useBattleState,
  useCoGuestState,
  useCoHostState,
  useLiveListState,
  useLiveSeatState,
  useLoginState,
} from 'tuikit-atomicx-vue3-electron';
import type { SeatUserInfo } from 'tuikit-atomicx-vue3-electron';
import {
  ChildPanelType,
  IPCMessageType,
  ipcBridge,
  toPlainIpcPayload,
} from '../ipc';
import type {
  CoHostActionPayload,
  CoHostEventPayload,
  CoHostPanelSnapshot,
  ShowChildPanelPayload,
  UpdateChildDataPayload,
} from '../ipc';

const props = defineProps({
  isShowingInChildWindow: {
    type: Boolean,
    default: false,
  },
});

const { t } = useUIKit();

// ==================== State (single ownership on main window) ====================
// useCoHostState / useBattleState are module-level singletons; resolving them
// here on the main window guarantees we own the canonical state regardless of
// whether the child window is open. The Mac path's <CoHostPanel> resolves the
// same singletons internally — duplicate resolution is cheap and idempotent.
const { loginUserInfo } = useLoginState();
const { currentLive } = useLiveListState();
const { seatList } = useLiveSeatState();
const { applicants: coGuestApplicants } = useCoGuestState();

const {
  coHostStatus,
  connected,
  invitees,
  applicant,
  candidates,
  candidatesCursor,
  requestHostConnection,
  cancelHostConnection,
  exitHostConnection,
  acceptHostConnection,
  rejectHostConnection,
  muteRemoteHostAudio,
  getCoHostCandidates,
  subscribeEvent: subscribeCoHostEvent,
  unsubscribeEvent: unsubscribeCoHostEvent,
} = useCoHostState();
const {
  currentBattleInfo,
  battleUsers,
  battleScore,
  requestBattle,
  cancelBattleRequest,
  exitBattle,
  subscribeEvent: subscribeBattleEvent,
  unsubscribeEvent: unsubscribeBattleEvent,
} = useBattleState();

// Mirrors kit's CoHostButton enable/disable rules: cannot start co-host when
// not yet live, or when audience co-guest is already running.
const isInCoGuest = computed(() =>
  seatList.value.filter((item: { userInfo?: { userId?: string; liveId?: string } }) =>
    item.userInfo?.userId && item.userInfo?.liveId === currentLive.value?.liveId).length >= 2,
);
const hasCoGuestApplicants = computed(() => coGuestApplicants.value.length > 0);
const isCoHostDisabled = computed(() => !currentLive.value?.liveId || isInCoGuest.value || hasCoGuestApplicants.value);

// Mac-mode self-managed visibility for the kit's <CoHostPanel>.
const coHostPanelVisible = ref(false);

// ==================== Main-window owned bookkeeping ====================
// All of these refs are window-local "intermediate" state that the kit panel
// keeps internally on Mac (in BattlePanel / ConnectionPanel / ConfigSettingPanel).
// In Windows mode the child dialog is read-only, so the bookkeeping moves up
// here and is pushed to the child via the snapshot.
const mutedHostLiveIds = ref<Set<string>>(new Set());
// Outbound co-host "Invitation sent" toasts whose close-handle lives in the
// child window. We only need the userId set on main to know who to dismiss.
const sentCoHostRequestUserList = ref<Set<string>>(new Set());
// Battle-invite probing set. A user lands here right after we send a co-host
// request with `withBattle: true`, and is removed once we either successfully
// kick off the battle (CoHostRequestAccepted), the invite is rejected/timed-out,
// or the user cancels it manually.
const pendingPkInviteeUserIds = ref<Set<string>>(new Set());
// Outbound battle invitation list (after the connection is established and
// the user explicitly clicks "Start battle"). Cleared on accept/reject/timeout
// or on battle started/ended.
const pendingBattleRequestUserIds = ref<Set<string>>(new Set());
const pendingBattleRequestId = ref('');
// Battle settings form. Owned here so it survives child window reopen.
const configForm = ref<{ battleDuration: number; coHostLayoutTemplate: CoHostLayoutTemplate }>({
  battleDuration: 5 * 60,
  coHostLayoutTemplate: CoHostLayoutTemplate.HostDynamicGrid,
});

// Whether the child CoHost window is currently open. Updated locally on click
// and by HIDE_CHILD_PANEL from the main process.
const isCoHostChildOpen = ref(false);

// Error code -> i18n key for battle request rejections. Mirrors kit constants.
const BATTLE_ERROR_MESSAGE: Record<number, string> = {
  100412: 'there is no one valid room for battle',
};

// ==================== Layout-template orientation helper ====================
// Same rule used by kit BattlePanel / ConnectionPanel: layoutTemplate ids in
// [200, 599] are landscape; landscape lives must use the fixed 2-seat layout.
const currentLiveOrientation = computed(() => {
  const layout = currentLive.value?.layoutTemplate;
  if (typeof layout === 'number' && layout >= 200 && layout <= 599) {
    return LiveOrientation.Landscape;
  }
  return LiveOrientation.Portrait;
});
const effectiveCoHostLayoutTemplate = computed(() => {
  if (currentLiveOrientation.value === LiveOrientation.Landscape) {
    return CoHostLayoutTemplate.HostVideoLandscapeFixed2Seats;
  }
  return configForm.value.coHostLayoutTemplate;
});

// Keep `configForm.coHostLayoutTemplate` in sync with the current live
// orientation so the settings dialog always renders a default option as
// "selected", and so the canonical `configForm` (the one pushed via the
// snapshot to the child window) reflects a value that is legal for the
// running live's orientation.
//
// Without this watcher the form stays at its initialization value
// (`HostDynamicGrid`) forever, which causes the highlight to disappear in
// landscape lives (only `HostVideoLandscapeFixed2Seats` is offered there)
// and stays on `HostVideoLandscapeFixed2Seats` if the user switches back to
// a portrait live after picking it. Mirrors the same fix in the kit's
// `CoHostPanel.vue`.
watch(currentLiveOrientation, (orientation) => {
  if (orientation === LiveOrientation.Landscape) {
    if (configForm.value.coHostLayoutTemplate !== CoHostLayoutTemplate.HostVideoLandscapeFixed2Seats) {
      configForm.value.coHostLayoutTemplate = CoHostLayoutTemplate.HostVideoLandscapeFixed2Seats;
    }
  } else if (configForm.value.coHostLayoutTemplate === CoHostLayoutTemplate.HostVideoLandscapeFixed2Seats) {
    // Coming back to a portrait live after the landscape-only template was
    // selected: fall back to the portrait default so the dialog has a valid
    // selection on next open.
    configForm.value.coHostLayoutTemplate = CoHostLayoutTemplate.HostDynamicGrid;
  }
}, { immediate: true });

// ==================== Snapshot construction & push ====================
function buildSnapshot(): CoHostPanelSnapshot {
  return {
    loginUserInfo: loginUserInfo.value
      ? {
        userId: loginUserInfo.value.userId,
        userName: loginUserInfo.value.userName,
        avatarUrl: loginUserInfo.value.avatarUrl,
      }
      : null,
    currentLive: currentLive.value
      ? {
        liveId: currentLive.value.liveId,
        liveName: currentLive.value.liveName,
        coverUrl: currentLive.value.coverUrl,
        layoutTemplate: currentLive.value.layoutTemplate,
      }
      : null,

    coHostStatus: coHostStatus.value,
    candidates: candidates.value.map(u => ({ ...u })),
    candidatesCursor: candidatesCursor.value,
    invitees: invitees.value.map(u => ({ ...u })),
    connected: connected.value.map(u => ({ ...u })),
    applicant: applicant.value ? { ...applicant.value } : null,
    mutedHostLiveIds: Array.from(mutedHostLiveIds.value),

    battleId: currentBattleInfo.value?.battleId || '',
    battleUsers: battleUsers.value.map(u => ({ ...u })),
    // Map<string, number> is not structured-cloneable across all renderer-
    // process boundaries reliably; serialize to a plain entries array.
    battleScore: Array.from(battleScore.value.entries()),
    pendingBattleRequestUserIds: Array.from(pendingBattleRequestUserIds.value),
    pendingBattleRequestId: pendingBattleRequestId.value,
    pendingPkInviteeUserIds: Array.from(pendingPkInviteeUserIds.value),

    configForm: { ...configForm.value },
  };
}

function pushSnapshot() {
  if (!props.isShowingInChildWindow || !isCoHostChildOpen.value) return;
  ipcBridge.sendToChild<UpdateChildDataPayload<CoHostPanelSnapshot>>(IPCMessageType.UPDATE_CHILD_DATA, {
    panelType: ChildPanelType.CoHostConnection,
    data: toPlainIpcPayload(buildSnapshot()),
  });
}

function emitCoHostEvent(payload: CoHostEventPayload) {
  if (!props.isShowingInChildWindow || !isCoHostChildOpen.value) return;
  ipcBridge.sendToChild<CoHostEventPayload>(IPCMessageType.COHOST_EVENT, toPlainIpcPayload(payload));
}

// ==================== Button click ====================
const handleCoHost = () => {
  if (isCoHostDisabled.value) {
    const message = !currentLive.value?.liveId
      ? t('Cannot use co-host before live starts')
      : t('Cannot co-host with other hosts while audience co-hosting is active');
    TUIToast({ type: TOAST_TYPE.ERROR, message });
    return;
  }
  if (props.isShowingInChildWindow) {
    isCoHostChildOpen.value = true;
    ipcBridge.sendToChild<ShowChildPanelPayload<CoHostPanelSnapshot>>(IPCMessageType.SHOW_CHILD_PANEL, {
      panelType: ChildPanelType.CoHostConnection,
      initialData: toPlainIpcPayload(buildSnapshot()),
    });
  } else {
    coHostPanelVisible.value = true;
  }
};

// ==================== Disable-side-effect cleanup ====================
// Same behavior the Mac kit panel implements internally: when the live ends
// or the user enters CoGuest, the CoHost panel must auto-close. In Windows
// mode the child window is hidden via the main process bridge.
watch(isCoHostDisabled, (disabled) => {
  if (!disabled) return;
  coHostPanelVisible.value = false;
  if (props.isShowingInChildWindow && isCoHostChildOpen.value) {
    ipcBridge.sendToElectronMain(IPCMessageType.HIDE_CHILD_PANEL, {
      panelType: ChildPanelType.CoHostConnection,
    });
    isCoHostChildOpen.value = false;
  }
});

// ==================== Action handler (child -> main) ====================
async function onCoHostAction(payload: CoHostActionPayload) {
  switch (payload.action) {
  case 'getCandidates':
    try {
      await getCoHostCandidates(payload.cursor);
    } catch (e) {
      console.warn('[CoHostButton] getCoHostCandidates failed:', e);
    }
    break;

  case 'requestConnection': {
    const { liveId, userId, userName, withBattle, timeoutSec } = payload;
    try {
      const result = await requestHostConnection({
        liveId,
        layoutTemplate: effectiveCoHostLayoutTemplate.value,
        timeout: timeoutSec,
        extensionInfo: JSON.stringify({ timeout: timeoutSec, withBattle }),
      });
      const code = result.get(liveId);
      if (code === TUIConnectionCode.TUIConnectionCodeSuccess) {
        if (withBattle) {
          // BattlePanel path: track the invitee so a follow-up
          // requestBattle is fired once the co-host accept event arrives.
          pendingPkInviteeUserIds.value.add(userId);
          emitCoHostEvent({ event: 'battleSentToast', userId, userName });
        } else {
          // ConnectionPanel path: keep an "invitation sent" toast on the child;
          // its close-handle is owned by the child window per userId.
          sentCoHostRequestUserList.value.add(userId);
          emitCoHostEvent({ event: 'connectionSentToast', userId, userName });
        }
      } else {
        const errMsg = (() => {
          switch (code) {
          case TUIConnectionCode.TUIConnectionCodeRoomNotExist:
            return withBattle
              ? t('Send battle request failed, Room not exist')
              : t('Send co-host request failed, Room not exist');
          case TUIConnectionCode.TUIConnectionCodeConnecting:
            return withBattle
              ? t('Send battle request failed, Room is connecting')
              : t('Send co-host request failed, Room is connecting');
          case TUIConnectionCode.TUIConnectionCodeConnectingOtherRoom:
            return withBattle
              ? t('Send battle request failed, Room is connecting other room')
              : t('Send co-host request failed, Room is connecting other room');
          case TUIConnectionCode.TUIConnectionCodeFull:
            return withBattle
              ? t('Send battle request failed, Connected count is full')
              : t('Send co-host request failed, Connected count is full');
          case TUIConnectionCode.TUIConnectionCodeRetry:
            return withBattle
              ? t('Send battle request failed')
              : t('Send co-host request failed');
          default:
            return withBattle ? t('Send battle request failed') : t('Send co-host request failed');
          }
        })();
        emitCoHostEvent({ event: 'errorToast', message: errMsg });
      }
    } catch (e) {
      console.warn('[CoHostButton] requestConnection failed:', e);
      emitCoHostEvent({
        event: 'errorToast',
        message: withBattle ? t('Send battle request failed') : t('Send co-host request failed'),
      });
    }
    break;
  }

  case 'cancelConnection': {
    const { liveId, userId } = payload;
    try {
      await cancelHostConnection({ liveId });
    } catch (e) {
      console.warn('[CoHostButton] cancelConnection failed:', e);
      emitCoHostEvent({ event: 'errorToast', message: t('Cancel co-host request failed') });
      return;
    }
    if (sentCoHostRequestUserList.value.delete(userId)) {
      emitCoHostEvent({ event: 'closeSentToast', userId });
    }
    pendingPkInviteeUserIds.value.delete(userId);
    break;
  }

  case 'acceptConnection':
    // Reserved for inbound co-host application accept. The current child UI
    // does not wire this yet; we keep the action variant for protocol symmetry.
    if (applicant.value?.liveId) {
      try {
        await acceptHostConnection({ liveId: applicant.value.liveId });
      } catch (e) {
        console.warn('[CoHostButton] acceptConnection failed:', e);
      }
    }
    break;

  case 'rejectConnection':
    if (applicant.value?.liveId) {
      try {
        await rejectHostConnection({ liveId: applicant.value.liveId });
      } catch (e) {
        console.warn('[CoHostButton] rejectConnection failed:', e);
      }
    }
    break;

  case 'exitConnection':
    try {
      await exitHostConnection();
      mutedHostLiveIds.value.clear();
    } catch (e) {
      console.warn('[CoHostButton] exitConnection failed:', e);
    }
    break;

  case 'muteRemoteHostAudio': {
    const { liveId, mute } = payload;
    try {
      await muteRemoteHostAudio(liveId, mute);
      if (mute) mutedHostLiveIds.value.add(liveId);
      else mutedHostLiveIds.value.delete(liveId);
    } catch (e) {
      console.warn('[CoHostButton] muteRemoteHostAudio failed:', e);
      emitCoHostEvent({ event: 'errorToast', message: t('Mute failed') });
    }
    break;
  }

  case 'requestBattle': {
    const { userIdList, battleDuration, timeoutSec } = payload;
    try {
      const battleRes = await requestBattle({
        config: { duration: battleDuration, needResponse: true, extensionInfo: '' },
        userIdList,
        timeout: timeoutSec,
      });
      pendingBattleRequestId.value = battleRes?.battleId || '';
      userIdList.forEach(id => pendingBattleRequestUserIds.value.add(id));
    } catch (error: any) {
      const key = BATTLE_ERROR_MESSAGE[error?.code] || 'Request battle failed';
      emitCoHostEvent({ event: 'errorToast', message: t(key) });
    }
    break;
  }

  case 'cancelBattleRequest':
    try {
      if (pendingBattleRequestId.value) {
        await cancelBattleRequest({
          battleId: pendingBattleRequestId.value,
          userIdList: Array.from(pendingBattleRequestUserIds.value),
        });
      }
    } catch (e) {
      console.warn('[CoHostButton] cancelBattleRequest failed:', e);
    }
    pendingBattleRequestId.value = '';
    pendingBattleRequestUserIds.value.clear();
    break;

  case 'exitBattle':
    if (currentBattleInfo.value?.battleId) {
      try {
        await exitBattle({ battleId: currentBattleInfo.value.battleId });
      } catch (e) {
        console.warn('[CoHostButton] exitBattle failed:', e);
      }
    }
    break;

  case 'setConfigForm':
    configForm.value = {
      battleDuration: payload.battleDuration,
      coHostLayoutTemplate: payload.coHostLayoutTemplate,
    };
    break;

  default: {
    // Exhaustiveness guard: any new variant must be handled above.
    const _exhaustive: never = payload;
    void _exhaustive;
  }
  }
}

// ==================== CoHost / Battle event handlers (main window) ====================
// Each handler keeps the local bookkeeping (sentCoHostRequestUserList /
// pendingPkInviteeUserIds / pendingBattleRequestUserIds / pendingBattleRequestId)
// in sync with the kit's authoritative state-layer events, then forwards the
// resulting toast UX to the child via COHOST_EVENT. Mirrors kit BattlePanel
// + ConnectionPanel handlers.

const handleCoHostRequestAccepted = async ({ invitee }: { invitee: SeatUserInfo }) => {
  // Drop from co-host "Invitation sent" tracking (do NOT close the toast — let
  // it finish its own life-cycle since the invite was actually accepted).
  sentCoHostRequestUserList.value.delete(invitee.userId);

  // If this invitee was a battle invitation pivot, fire the actual battle
  // request now that they've joined the connection.
  if (pendingPkInviteeUserIds.value.has(invitee.userId)) {
    try {
      await requestBattle({
        config: { duration: configForm.value.battleDuration, needResponse: false, extensionInfo: '' },
        userIdList: [invitee.userId],
        timeout: 0,
      });
    } catch (e) {
      console.warn('[CoHostButton] auto-battle request failed:', e);
      emitCoHostEvent({ event: 'errorToast', message: t('Request battle failed') });
    } finally {
      pendingPkInviteeUserIds.value.delete(invitee.userId);
    }
  }
};

const handleCoHostRequestCancelled = ({ inviter }: { inviter: SeatUserInfo }) => {
  // Local user is the cancelled invitee in this case; clean up any pending PK probe.
  pendingPkInviteeUserIds.value.delete(inviter.userId);
};

const handleCoHostRequestRejected = ({ invitee }: { invitee: SeatUserInfo }) => {
  if (sentCoHostRequestUserList.value.delete(invitee.userId)) {
    // Dismiss the just-shown "invitation sent" toast on the child window so
    // the user does not see "sent" and "rejected" toasts at the same time.
    emitCoHostEvent({ event: 'closeSentToast', userId: invitee.userId });
  }
  pendingPkInviteeUserIds.value.delete(invitee.userId);
};

const handleCoHostRequestTimeout = ({ inviter, invitee }: { inviter: SeatUserInfo; invitee: SeatUserInfo }) => {
  if (inviter.userId !== loginUserInfo.value?.userId) return;
  if (sentCoHostRequestUserList.value.delete(invitee.userId)) {
    emitCoHostEvent({ event: 'closeSentToast', userId: invitee.userId });
  }
  pendingPkInviteeUserIds.value.delete(invitee.userId);
};

const onBattleRequestAccept = (eventInfo: { battleId: string; inviter: SeatUserInfo; invitee: SeatUserInfo }) => {
  if (eventInfo.inviter.userId === loginUserInfo.value?.userId) {
    pendingBattleRequestUserIds.value.delete(eventInfo.invitee.userId);
  }
};
const onBattleRequestRejected = (eventInfo: { battleId: string; inviter: SeatUserInfo; invitee: SeatUserInfo }) => {
  if (eventInfo.inviter.userId === loginUserInfo.value?.userId) {
    pendingBattleRequestUserIds.value.delete(eventInfo.invitee.userId);
  }
};
const onBattleRequestTimeout = (eventInfo: { battleId: string; inviter: SeatUserInfo; invitee: SeatUserInfo }) => {
  if (eventInfo.inviter.userId === loginUserInfo.value?.userId) {
    pendingBattleRequestUserIds.value.delete(eventInfo.invitee.userId);
  }
};
const onBattleStarted = () => {
  pendingBattleRequestId.value = '';
  pendingBattleRequestUserIds.value.clear();
};
const onBattleEnded = () => {
  pendingBattleRequestId.value = '';
  pendingBattleRequestUserIds.value.clear();
};

// ==================== HIDE_CHILD_PANEL observer ====================
const onHideChildPanel = (payload: { panelType: ChildPanelType }) => {
  if (payload.panelType === ChildPanelType.CoHostConnection) {
    isCoHostChildOpen.value = false;
  }
};

// ==================== Child-panel candidate freshness ====================
// Win mode only: the child window is a read-only mirror of the snapshot the
// main window pushes. The kit panel's own visibility/disconnect watches
// (uikit-component-vue3-electron `CoHostPanel.vue`) cannot run there, so we
// reproduce the same two refresh triggers here at the main-window owner of
// the candidates list. Once `getCoHostCandidates('')` resolves, the existing
// snapshot-push watch below picks up the `candidates` change and forwards a
// fresh `UPDATE_CHILD_DATA` payload to the child renderer.
//
// Trigger 1: child panel transitions from closed to open. Without this,
// reopening keeps a stale snapshot — for example, a host whose connection
// was just ended would not reappear in "Recommend hosts".
//
// Side-effect note: passing '' resets the candidates pagination cursor in
// the kit store. If the user had paged past the first screen in the child
// panel before closing it, that scroll position is discarded on reopen —
// we trade scroll retention for "just-disconnected host shows up at the
// top", which is the higher-priority UX here.
watch(isCoHostChildOpen, (open) => {
  if (!props.isShowingInChildWindow || !open) return;
  getCoHostCandidates('').catch((error) => {
    console.warn('[CoHostButton] refresh candidates on child open failed', error);
  });
});

// Trigger 2: connected list shrinks while child panel is open. The kit's
// `handleConnectionUserListChanged` only filters joiners out of candidates
// and never adds disconnected hosts back, so we pull a fresh page so the
// just-left host can be re-invited without manual refresh. Gated on
// `isCoHostChildOpen` to avoid burning SDK rate-limit budget while the
// panel is closed (Win-only path; Mac mode runs the kit panel directly).
//
// Edge case: this only fires on a net length decrease. A same-tick join+leave
// (e.g. SDK batches `connectionUserListChanged` with both add and remove in
// one event) leaves `connected.length` unchanged and the watcher is silent.
// Acceptable trade-off — the child panel's manual refresh button is the
// fallback for this rare case. If misses become noticeable in production,
// switch to `watch(connected, …, { deep: true })` with a Set diff against
// previous user ids to detect leavers regardless of net length.
watch(() => connected.value.length, (newCount, oldCount) => {
  if (!props.isShowingInChildWindow || !isCoHostChildOpen.value) return;
  if (newCount >= oldCount) return;
  getCoHostCandidates('').catch((error) => {
    console.warn('[CoHostButton] refresh candidates after disconnect failed', error);
  });
});

// ==================== State -> snapshot push wiring ====================
// Deep-watch reactive sources whose nested fields the child UI reads. This is
// cheap because pushSnapshot is a no-op when the child window is closed.
// Aggregating into a single watch avoids duplicate snapshot pushes when
// multiple sources mutate together (e.g. accept event flips both `connected`
// and `invitees`).
watch(
  [
    coHostStatus,
    connected,
    invitees,
    candidates,
    candidatesCursor,
    applicant,
    mutedHostLiveIds,
    () => currentBattleInfo.value?.battleId || '',
    battleUsers,
    battleScore,
    pendingBattleRequestUserIds,
    pendingBattleRequestId,
    pendingPkInviteeUserIds,
    configForm,
    () => loginUserInfo.value,
    () => currentLive.value,
  ],
  () => pushSnapshot(),
  { deep: true },
);

// ==================== Lifecycle ====================
onMounted(() => {
  if (props.isShowingInChildWindow) {
    ipcBridge.on(IPCMessageType.COHOST_ACTION, onCoHostAction);
    ipcBridge.on(IPCMessageType.HIDE_CHILD_PANEL, onHideChildPanel);
  }
  subscribeCoHostEvent(CoHostEvent.onCoHostRequestAccepted, handleCoHostRequestAccepted);
  subscribeCoHostEvent(CoHostEvent.onCoHostRequestCancelled, handleCoHostRequestCancelled);
  subscribeCoHostEvent(CoHostEvent.onCoHostRequestRejected, handleCoHostRequestRejected);
  subscribeCoHostEvent(CoHostEvent.onCoHostRequestTimeout, handleCoHostRequestTimeout);

  subscribeBattleEvent(BattleEvent.onBattleRequestAccept, onBattleRequestAccept);
  subscribeBattleEvent(BattleEvent.onBattleRequestReject, onBattleRequestRejected);
  subscribeBattleEvent(BattleEvent.onBattleRequestTimeout, onBattleRequestTimeout);
  subscribeBattleEvent(BattleEvent.onBattleStarted, onBattleStarted);
  subscribeBattleEvent(BattleEvent.onBattleEnded, onBattleEnded);
});

onBeforeUnmount(() => {
  if (props.isShowingInChildWindow) {
    ipcBridge.off(IPCMessageType.COHOST_ACTION, onCoHostAction);
    ipcBridge.off(IPCMessageType.HIDE_CHILD_PANEL, onHideChildPanel);
  }
  unsubscribeCoHostEvent(CoHostEvent.onCoHostRequestAccepted, handleCoHostRequestAccepted);
  unsubscribeCoHostEvent(CoHostEvent.onCoHostRequestCancelled, handleCoHostRequestCancelled);
  unsubscribeCoHostEvent(CoHostEvent.onCoHostRequestRejected, handleCoHostRequestRejected);
  unsubscribeCoHostEvent(CoHostEvent.onCoHostRequestTimeout, handleCoHostRequestTimeout);

  unsubscribeBattleEvent(BattleEvent.onBattleRequestAccept, onBattleRequestAccept);
  unsubscribeBattleEvent(BattleEvent.onBattleRequestReject, onBattleRequestRejected);
  unsubscribeBattleEvent(BattleEvent.onBattleRequestTimeout, onBattleRequestTimeout);
  unsubscribeBattleEvent(BattleEvent.onBattleStarted, onBattleStarted);
  unsubscribeBattleEvent(BattleEvent.onBattleEnded, onBattleEnded);
});

</script>

<style lang="scss" scoped>
@import '../assets/mac.scss';

.custom-icon-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 56px;
  width: auto;
  height: 56px;
  cursor: pointer;
  color: $text-color1;
  border-radius: 12px;
  position: relative;

  .unread-count {
    position: absolute;
    top: 0;
    right: 0;
    background-color: var(--text-color-error);
    border-radius: 50%;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
  }

  .custom-icon {
    @include icon-size-24;
    background: transparent;
  }
  .custom-text {
    @include text-size-12;
  }

  &:not(.disabled):hover {
    box-shadow: 0 0 10px 0 var(--bg-color-mask);
    .custom-icon {
      color: $icon-hover-color;
    }
    .custom-text {
      color: $icon-hover-color;
    }
  }

  &.disabled {
    cursor: not-allowed;
    opacity: 0.5;
    color: $text-color3;
    .custom-icon {
      cursor: not-allowed;
    }
    .custom-text {
      color: $text-color3;
    }
  }
}
</style>
