<template>
  <div class="connection-panel">
    <div
      v-if="isConnected"
      class="user-list-container"
    >
      <div class="user-list-title">
        <span class="user-list-title-text">{{ t('Current seat') }}</span>
        <span class="user-list-title-count">
          {{ `(${props.data.connected.length}/${seatNumber})` }}
        </span>
      </div>
      <div class="user-list">
        <div
          v-for="user in props.data.connected"
          :key="`${user.userId}-${user.liveId}`"
          class="user-item"
        >
          <div class="user-item-left">
            <Avatar :src="user.avatarUrl" :size="40" />
          </div>
          <div class="user-item-right">
            <div class="user-info">
              <span class="user-name">{{ user.userName || user.userId }}</span>
            </div>
            <div
              v-if="user.userId !== props.data.loginUserInfo?.userId"
              class="user-actions"
            >
              <TUIButton
                size="small"
                :type="isMuted(user.liveId) ? 'primary' : 'default'"
                @click="handleToggleMuteHost(user)"
              >
                {{ isMuted(user.liveId) ? t('Unmute') : t('Mute') }}
              </TUIButton>
            </div>
            <div v-else class="user-status">
              {{ t('Connecting') }}...
            </div>
          </div>
        </div>
      </div>
      <div
        v-if="props.data.connected.length === 0"
        class="empty-state"
      >
        <span>{{ t('Seat is empty') }}</span>
      </div>
    </div>

    <RecommendHostListDialog
      class="recommend-host-list"
      :coHostStatus="props.data.coHostStatus"
      :candidates="props.data.candidates"
      :candidatesCursor="props.data.candidatesCursor"
      :invitees="props.data.invitees"
      :connected="props.data.connected"
      @getCandidates="(cursor: string) => emit('action', { action: 'getCandidates', cursor })"
    >
      <template #host-item-actions="{ user }">
        <TUIButton
          v-if="!isUserInvited(user.userId, user.liveId)"
          size="small"
          :type="isConnected ? 'default' : 'primary'"
          @click="handleSendCoHostRequest(user)"
        >
          {{ t('Invite connection') }}
        </TUIButton>
        <TUIButton
          v-else
          size="small"
          color="gray"
          @click="handleCancelCoHostRequest(user)"
        >
          {{ t('Cancel invitation') }}
        </TUIButton>
      </template>
    </RecommendHostListDialog>
  </div>
  <div v-if="isConnected" class="connection-panel-footer">
    <TUIButton :color="'red'" @click="showExitDialog = true">
      {{ t('Exit connection') }}
    </TUIButton>
    <template v-if="!hasActiveBattle">
      <TUIButton
        v-if="!inPk && pendingBattleCount === 0"
        type="primary"
        @click="handleBattleRequest"
      >
        {{ t('Start battle') }}
      </TUIButton>
      <TUIButton
        v-if="!inPk && pendingBattleCount > 0"
        @click="handleCancelBattleRequest"
      >
        {{ t('Cancel battle') }}
      </TUIButton>
    </template>
  </div>
  <TUIDialog
    :visible="isConnected && showExitDialog"
    :showClose="false"
    :modal="false"
    :customClasses="['exit-co-host-dialog']"
    @confirm="handleExitConnection"
    @cancel="showExitDialog = false"
  >
    {{ t('Are you sure you want to exit the connection') }}
    <template #footer>
      <TUIButton type="default" color="gray" @click="showExitDialog = false">
        {{ t('Cancel') }}
      </TUIButton>
      <TUIButton type="primary" color="red" @click="handleExitConnection">
        {{ t('Exit connection') }}
      </TUIButton>
    </template>
  </TUIDialog>
</template>

<script setup lang="ts">
/**
 * Read-only counterpart of kit `ConnectionPanel.vue` for child-window mode.
 *
 * The "outbound invitation sent" toast lifecycle (open on send / close on
 * reject/timeout/cancel) is owned by the main window and replayed to the
 * child via COHOST_EVENT, so this file only handles the in-list
 * "Invite connection" / "Cancel invitation" toggle. See CoHostButton.vue
 * for the toast orchestration.
 */
import { computed, ref } from 'vue';
import { TUIButton, TUIDialog, useUIKit } from '@tencentcloud/uikit-base-component-vue3';
import { Avatar, CoHostLayoutTemplate, CoHostStatus, LiveOrientation } from 'tuikit-atomicx-vue3-electron';
import type { SeatUserInfo } from 'tuikit-atomicx-vue3-electron';
import RecommendHostListDialog from './RecommendHostListDialog.vue';
import { COHOST_REQUEST_TIMEOUT_SECONDS, BATTLE_REQUEST_TIMEOUT_SECONDS } from './constants';
import type { CoHostActionPayload, CoHostPanelSnapshot } from '../../ipc';

const { t } = useUIKit();

const props = defineProps<{
  data: CoHostPanelSnapshot;
  /**
   * Current live orientation derived in the parent dialog from
   * `data.currentLive.layoutTemplate`. In landscape lives the connection
   * layout is forced to `HostVideoLandscapeFixed2Seats` regardless of the
   * user's saved form value, so `seatNumber` must follow the effective
   * template rather than the raw form selection. Mirrors kit
   * `ConnectionPanel.vue` after the upstream PK layout-selection commit.
   */
  currentLiveOrientation: LiveOrientation;
}>();

const emit = defineEmits<{
  action: [payload: CoHostActionPayload];
}>();

const showExitDialog = ref(false);

const isConnected = computed(() => props.data.coHostStatus === CoHostStatus.Connected);
const hasActiveBattle = computed(() => Boolean(props.data.battleId));
const inPk = computed(
  () => props.data.battleUsers.some(u => u.userId === props.data.loginUserInfo?.userId),
);
const pendingBattleCount = computed(() => props.data.pendingBattleRequestUserIds.length);

// In landscape mode the co-host layout is forced to the fixed 2-seat
// landscape template regardless of the user's saved form value. This mirrors
// the main-window `effectiveCoHostLayoutTemplate` used when actually issuing
// `requestHostConnection` (see `CoHostButton.vue`).
const effectiveCoHostLayoutTemplate = computed<CoHostLayoutTemplate>(() => {
  if (props.currentLiveOrientation === LiveOrientation.Landscape) {
    return CoHostLayoutTemplate.HostVideoLandscapeFixed2Seats;
  }
  return props.data.configForm.coHostLayoutTemplate;
});

// Seat capacity per layout template — mirrors kit ConnectionPanel.vue.
const seatNumber = computed(() => {
  switch (effectiveCoHostLayoutTemplate.value) {
  case CoHostLayoutTemplate.HostDynamicGrid:
    return 9;
  case CoHostLayoutTemplate.HostDynamic1v6:
    return 7;
  case CoHostLayoutTemplate.HostVideoLandscapeFixed2Seats:
    return 2;
  default:
    return 9;
  }
});

const isUserInvited = (userId: string, liveId: string): boolean =>
  props.data.invitees.some(u => u.userId === userId && u.liveId === liveId);

const isMuted = (liveId: string): boolean =>
  props.data.mutedHostLiveIds.includes(liveId);

function handleSendCoHostRequest(user: SeatUserInfo) {
  emit('action', {
    action: 'requestConnection',
    liveId: user.liveId,
    userId: user.userId,
    userName: user.userName,
    withBattle: false,
    timeoutSec: COHOST_REQUEST_TIMEOUT_SECONDS,
  });
}

function handleCancelCoHostRequest(user: SeatUserInfo) {
  emit('action', { action: 'cancelConnection', liveId: user.liveId, userId: user.userId });
}

function handleToggleMuteHost(user: SeatUserInfo) {
  emit('action', {
    action: 'muteRemoteHostAudio',
    liveId: user.liveId,
    mute: !isMuted(user.liveId),
  });
}

function handleExitConnection() {
  showExitDialog.value = false;
  emit('action', { action: 'exitConnection' });
}

function handleBattleRequest() {
  const userIdList = props.data.connected
    .filter(u => u.userId !== props.data.loginUserInfo?.userId)
    .map(u => u.userId);
  if (userIdList.length === 0) return;
  emit('action', {
    action: 'requestBattle',
    userIdList,
    battleDuration: props.data.configForm.battleDuration,
    timeoutSec: BATTLE_REQUEST_TIMEOUT_SECONDS,
  });
}

function handleCancelBattleRequest() {
  emit('action', { action: 'cancelBattleRequest' });
}
</script>

<style lang="scss">
.exit-co-host-dialog {
  width: 300px;
  border-radius: 16px;
  border: 1px solid var(--stroke-color-module, #48494F);
  background: var(--bg-color-operate, #1F2024);
  box-shadow: 0 1px 8px 0 rgba(0, 0, 0, 0.40),
              0 4px 12px 0 rgba(0, 0, 0, 0.40),
              0 10px 30px 0 rgba(0, 0, 0, 0.40);
}
</style>

<style scoped lang="scss">
.connection-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}

.user-list-container {
  display: flex;
  flex-direction: column;
  margin-bottom: 8px;
  max-height: 220px;

  .user-list-title {
    display: flex;
    align-items: center;
    color: var(--text-color-secondary);
    font-size: 14px;
    font-weight: 400;
    gap: 8px;
    margin: 12px 0 8px 0;
  }

  .user-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: scroll;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .user-item {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 50px;
    box-sizing: border-box;

    .user-item-left {
      height: 100%;
      display: flex;
      align-items: center;
    }

    .user-item-right {
      flex: 1;
      display: flex;
      height: 100%;
      align-items: center;
      border-bottom: 1px solid var(--stroke-color-secondary);
    }

    .user-info {
      flex-grow: 1;
      display: flex;
      align-items: center;
      gap: 8px;

      .user-name {
        font-size: 16px;
        font-weight: 500;
        color: var(--text-color-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 200px;
      }
    }

    .user-status {
      color: var(--text-color-secondary);
      font-size: 14px;
      margin-right: 12px;
    }

    .user-actions {
      display: flex;
      gap: 6px;
    }
  }
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: center;
  flex: 1;
  color: var(--text-color-secondary);
  min-height: 60px;
}

.recommend-host-list {
  flex: 1;
  min-height: 0;
}

.connection-panel-footer {
  display: flex;
  gap: 12px;
  justify-content: right;
  align-items: center;
  padding: 20px 0 0 0;
}
</style>
