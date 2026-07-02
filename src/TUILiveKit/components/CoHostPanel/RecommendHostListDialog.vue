<template>
  <div class="recommend-host-list-container">
    <div class="recommend-host-list-title">
      <span class="recommend-host-list-title-text">
        {{ isConnected ? t('Invite more') : t('Recommend hosts') }}
      </span>
      <IconRefresh
        :class="['refresh-icon', refreshLoading ? 'loading' : '']"
        @click="handleRefresh"
      />
    </div>
    <div ref="contentRef" class="recommend-host-list-content">
      <div class="recommend-host-list">
        <div
          v-for="user in displayUserList"
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
            <div class="user-actions">
              <slot name="host-item-actions" :user="user" />
            </div>
          </div>
        </div>
      </div>
      <!-- Load more indicator. Mirrors kit RecommendHostList.vue layout 1:1. -->
      <div ref="loadMoreRef" class="load-more-indicator">
        <div v-if="loadMoreLoading" class="loading-content">
          <div class="loading-spinner"></div>
          <span>{{ t('Loading more users...') }}</span>
        </div>
        <div v-else-if="!hasMoreLive && candidates.length > 0" class="no-more-content">
          <span>{{ t('No more users') }}</span>
        </div>
        <div v-else class="load-more-trigger-content">
          <!-- empty trigger content -->
        </div>
      </div>
    </div>
    <div v-if="candidates.length === 0" class="empty-state">
      <span>{{ t('No hosts available to invite') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Read-only counterpart of kit `RecommendHostList.vue` for child-window mode.
 *
 * Differences from the kit version:
 * - All reactive state (candidates / candidatesCursor / invitees / connected) is
 *   passed in via props instead of being read from useCoHostState(). The child
 *   window does not own any CoHost state.
 * - Refresh / load-more do NOT call getCoHostCandidates directly; they emit a
 *   `getCandidates(cursor)` event back to the parent dialog, which forwards it
 *   to the main window over IPC.
 * - Local `refreshLoading` / `loadMoreLoading` are cleared as soon as the next
 *   snapshot frame indicates fetch completion (cursor changed or list grew).
 */
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { IconRefresh, useUIKit } from '@tencentcloud/uikit-base-component-vue3';
import { Avatar, CoHostStatus } from 'tuikit-atomicx-vue3-electron';
import type { SeatUserInfo } from 'tuikit-atomicx-vue3-electron';

const props = defineProps<{
  coHostStatus: CoHostStatus;
  candidates: SeatUserInfo[];
  candidatesCursor: string;
  invitees: SeatUserInfo[];
  connected: SeatUserInfo[];
}>();

const emit = defineEmits<{
  getCandidates: [cursor: string];
}>();

const { t } = useUIKit();

const isConnected = computed(() => props.coHostStatus === CoHostStatus.Connected);

/**
 * Merge invitees and candidates into a unified list for rendering.
 * - Exclude users that are already connected (they should not appear in "Invite more").
 * - De-duplicate by `${userId}-${liveId}` so the same user never appears twice.
 * Invitees come first to preserve the "already invited" visual order.
 */
const displayUserList = computed(() => {
  const connectedKeys = new Set(props.connected.map(u => `${u.userId}-${u.liveId}`));
  const seen = new Set<string>();
  const result: SeatUserInfo[] = [];
  for (const user of [...props.invitees, ...props.candidates]) {
    const key = `${user.userId}-${user.liveId}`;
    if (connectedKeys.has(key) || seen.has(key)) continue;
    seen.add(key);
    result.push(user);
  }
  return result;
});

const hasMoreLive = computed(() => props.candidatesCursor !== '');

const contentRef = ref<HTMLElement | null>(null);
const loadMoreRef = ref<HTMLElement | null>(null);
let intersectionObserver: IntersectionObserver | null = null;

const refreshLoading = ref(false);
const loadMoreLoading = ref(false);

function handleRefresh() {
  if (refreshLoading.value) return;
  refreshLoading.value = true;
  if (contentRef.value) {
    contentRef.value.scrollTop = 0;
  }
  // Min 500ms spinner so refresh always feels acknowledged even on a near-instant fetch.
  setTimeout(() => {
    refreshLoading.value = false;
  }, 500);
  emit('getCandidates', '');
}

// Snapshot-driven completion detection for the load-more spinner.
// Each time `candidates` changes (cursor advanced or list grew), assume the
// in-flight fetch finished and drop the spinner.
watch(
  () => [props.candidatesCursor, props.candidates.length],
  () => {
    loadMoreLoading.value = false;
  },
);

onMounted(() => {
  if (loadMoreRef.value) {
    intersectionObserver = new IntersectionObserver((changes) => {
      const item = changes[0];
      if (item.isIntersecting && !loadMoreLoading.value && hasMoreLive.value) {
        loadMoreLoading.value = true;
        emit('getCandidates', props.candidatesCursor);
      }
    }, {
      root: null,
      rootMargin: '100px',
    });
    intersectionObserver.observe(loadMoreRef.value);
  }
});

onUnmounted(() => {
  // Use disconnect() instead of unobserve(loadMoreRef.value): when the parent
  // dialog is closed, Vue tears down child template refs before onUnmounted
  // runs, so loadMoreRef.value can already be null and unobserve(null) would
  // throw a TypeError. disconnect() drops all observed targets in one call
  // and is safe whether or not the element is still alive.
  if (intersectionObserver) {
    intersectionObserver.disconnect();
    intersectionObserver = null;
  }
});
</script>

<style lang="scss" scoped>
@mixin scrollbar {
  &::-webkit-scrollbar {
    width: 6px;
    background: transparent;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    width: 6px !important;
    background: var(--uikit-color-gray-3) !important;
    border-radius: 3px;
    border: 2px solid transparent;
    background-clip: padding-box;
    &:hover {
      background: var(--uikit-color-gray-3) !important;
    }
  }
}

.recommend-host-list-container {
  display: flex;
  flex-direction: column;
  min-height: 0;

  .recommend-host-list-title {
    display: flex;
    align-items: center;
    color: var(--text-color-secondary);
    font-size: 14px;
    font-weight: 400;
    gap: 8px;
    margin: 12px 0 8px 0;
  }

  .refresh-icon {
    cursor: pointer;
    &.loading {
      animation: spin 1s linear infinite;
    }
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .recommend-host-list-content {
    flex: 1;
    overflow-y: auto;
    @include scrollbar;
  }

  .recommend-host-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .user-item {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 50px !important;
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

    .user-actions {
      display: flex;
      gap: 6px;
    }
  }
}

.load-more-indicator {
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  color: var(--text-color-secondary);
  font-size: 14px;

  .loading-content {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .no-more-content {
    display: flex;
    align-items: center;
  }

  .load-more-trigger-content {
    height: 20px;
    width: 100%;
  }

  .loading-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--stroke-color-secondary);
    border-top: 2px solid var(--uikit-color-theme-6);
    border-radius: 50%;
    animation: spin 1s linear infinite;
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
</style>
