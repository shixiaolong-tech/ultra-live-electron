<template>
  <div class="battle-panel">
    <div v-if="hasActiveBattle" class="battle-user-list">
      <!-- Inline UserList: avoid pulling kit's UserList.vue here so this child-window
           stays a standalone read-only view that doesn't drag in any kit-internal state. -->
      <div class="user-list">
        <div
          v-for="user in props.data.battleUsers"
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
            <div class="user-status">
              {{ t('In battle') }}...
            </div>
          </div>
        </div>
      </div>
    </div>
    <RecommendHostListDialog
      v-else
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
          v-if="!isPkInvited(user.userId)"
          size="small"
          type="primary"
          @click="handleSendBattleRequest(user)"
        >
          {{ t('Invite battle') }}
        </TUIButton>
        <TUIButton
          v-else
          size="small"
          color="gray"
          @click="handleCancelBattleRequest(user)"
        >
          {{ t('Cancel invitation') }}
        </TUIButton>
      </template>
    </RecommendHostListDialog>
  </div>
  <div v-if="hasActiveBattle" class="battle-panel-footer">
    <TUIButton
      type="primary"
      :color="'red'"
      @click="showExitDialog = true"
    >
      {{ t('End battle') }}
    </TUIButton>
  </div>
  <TUIDialog
    :visible="showExitDialog"
    :showClose="false"
    :modal="false"
    :customClasses="['exit-co-host-dialog']"
    @confirm="handleExitBattle"
    @cancel="showExitDialog = false"
  >
    {{ t('Are you sure you want to exit the battle') }}
    <template #footer>
      <TUIButton type="default" color="gray" @click="showExitDialog = false">
        {{ t('Cancel') }}
      </TUIButton>
      <TUIButton type="primary" color="red" @click="handleExitBattle">
        {{ t('End battle') }}
      </TUIButton>
    </template>
  </TUIDialog>
</template>

<script setup lang="ts">
/**
 * Read-only counterpart of kit `BattlePanel.vue` for child-window mode.
 *
 * Behavioral contract: every user gesture is forwarded to the parent dialog
 * via `emit('action', ...)`; the parent in turn relays it to the main window
 * over IPC. No SDK / state-layer call is made directly from this file.
 */
import { computed, ref } from 'vue';
import { TUIButton, TUIDialog, useUIKit } from '@tencentcloud/uikit-base-component-vue3';
import { Avatar } from 'tuikit-atomicx-vue3-electron';
import type { SeatUserInfo } from 'tuikit-atomicx-vue3-electron';
import RecommendHostListDialog from './RecommendHostListDialog.vue';
import { COHOST_REQUEST_TIMEOUT_SECONDS } from './constants';
import type { CoHostActionPayload, CoHostPanelSnapshot } from '../../ipc';

const { t } = useUIKit();

const props = defineProps<{
  data: CoHostPanelSnapshot;
}>();

const emit = defineEmits<{
  action: [payload: CoHostActionPayload];
}>();

const showExitDialog = ref(false);

const hasActiveBattle = computed(() => Boolean(props.data.battleId));

// "Invited but not yet accepted" set for the current PK invite cycle.
// The set lives on the main window (snapshot.pendingPkInviteeUserIds) to
// survive child re-opens, which is why we read it from props rather than
// keeping a local ref.
const isPkInvited = (userId: string): boolean =>
  props.data.pendingPkInviteeUserIds.includes(userId);

function handleSendBattleRequest(user: SeatUserInfo) {
  emit('action', {
    action: 'requestConnection',
    liveId: user.liveId,
    userId: user.userId,
    userName: user.userName,
    withBattle: true,
    timeoutSec: COHOST_REQUEST_TIMEOUT_SECONDS,
  });
}

function handleCancelBattleRequest(user: SeatUserInfo) {
  emit('action', { action: 'cancelConnection', liveId: user.liveId, userId: user.userId });
}

function handleExitBattle() {
  showExitDialog.value = false;
  emit('action', { action: 'exitBattle' });
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
.battle-panel {
  width: 100%;
  height: 100%;
  display: flex;
  overflow: auto;
}

.battle-user-list {
  flex: 1;
  min-height: 0;
  overflow: hidden;

  .user-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
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
  }
}

.recommend-host-list {
  flex: 1;
  min-height: 0;
}

.battle-panel-footer {
  display: flex;
  gap: 12px;
  justify-content: right;
  align-items: center;
  padding: 20px 0 0 0;
}
</style>
