<template>
  <div
    ref="streamCoverRef"
    class="tui-live-cover-stream"
    :class="{ 'is-dynamic-1v6': isDynamic1v6, 'has-video': hasVideo }"
    :style="positonStyle"
  >
    <template v-if="region.userId">
      <div class="tui-stream-avatar" v-if="region.userCameraStatus !== TUIDeviceStatus.TUIDeviceStatusOpened">
        <img :src="avatarSrc" @error="handleAvatarError" />
      </div>
      <div class="tui-stream-state">
        <span class="tui-mic-state">
          <MicOffIcon v-if="region.userMicrophoneStatus !== TUIDeviceStatus.TUIDeviceStatusOpened" />
        </span>
        <span class="tui-stream-name">{{ props.region.userName || props.region.userId }}</span>
      </div>
    </template>
    <div v-else class="tui-empty-region">
      <span class="tui-seat-index">{{ props.region.seatIndex }}</span>
      <span class="tui-seat-hint">{{ t('LiveView.WaitingForConnection') }}</span>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import type { Ref } from 'vue';
import { TUIDeviceStatus } from '@tencentcloud/tuiroom-engine-electron';
import { TUIConnectionMode, TUISeatLayoutTemplate, TUIUserSeatStreamRegion } from '../../types';
import { useUIKit } from '@tencentcloud/uikit-base-component-vue3';
import MicOffIcon from '../../common/icons/MicOffIcon.vue';
import { DEFAULT_USER_AVATAR_URL } from '../../constants/tuiConstant';
import { useCoverBattleState } from './coverBattleState';
import logger from '../../utils/logger';

type Props = {
  region: TUIUserSeatStreamRegion;
  mode: TUIConnectionMode;
};

const logPrefix = '[TUILiveKitStreamCover]';

const { t } = useUIKit();
const props = defineProps<Props>();

const streamCoverRef: Ref<HTMLElement | null> = ref(null);

// The layout template is synced from the main window via SYNC_BATTLE_STATE.
// Used to toggle the borderless / filled style only for the dynamic 1v6 layout.
const { layoutTemplate } = useCoverBattleState();
const isDynamic1v6 = computed(
  () => layoutTemplate.value === TUISeatLayoutTemplate.PortraitDynamic_1v6,
);

// The cover is a transparent overlay sitting on top of the native video. When the
// camera is on, the slot shows the live camera frame, so the overlay must stay
// transparent; otherwise the solid slot background would hide the video. We only
// fill the background for slots without a camera frame (avatar / empty seat).
const hasVideo = computed(
  () => props.region.userCameraStatus === TUIDeviceStatus.TUIDeviceStatusOpened,
);

// Max retries and backoff base (ms) used to recover the remote default avatar.
const AVATAR_RETRY_LIMIT = 3;
const AVATAR_RETRY_BASE_DELAY = 1000;

const avatarSrc = ref(props.region.userAvatar || DEFAULT_USER_AVATAR_URL);
let avatarRetryCount = 0;
// eslint-disable-next-line no-undef
let avatarRetryTimer: ReturnType<typeof setTimeout> | undefined;

// A failed src counts as the default one even after a cache-busting query is appended.
const isDefaultAvatar = (src: string) => src.split('?')[0] === DEFAULT_USER_AVATAR_URL;

const resetAvatarRetry = () => {
  avatarRetryCount = 0;
  if (avatarRetryTimer) {
    clearTimeout(avatarRetryTimer);
    avatarRetryTimer = undefined;
  }
};

// Keep the rendered avatar in sync when the seat user (or their avatar) changes.
watch(
  () => props.region.userAvatar,
  (newAvatar) => {
    resetAvatarRetry();
    avatarSrc.value = newAvatar || DEFAULT_USER_AVATAR_URL;
  },
);

// The cover is a transparent overlay window mostly running in the background, where a
// remote avatar request can intermittently fail. A bare <img> never recovers and stays
// broken. Recover without depending on any local asset:
// 1) a failed real avatar falls back to the shared remote default;
// 2) a failed default retries a few times with backoff and a cache-busting query, so a
//    transient network/timing failure can heal itself.
const handleAvatarError = () => {
  if (!isDefaultAvatar(avatarSrc.value)) {
    avatarSrc.value = DEFAULT_USER_AVATAR_URL;
    return;
  }
  if (avatarRetryCount < AVATAR_RETRY_LIMIT) {
    avatarRetryCount += 1;
    const retry = avatarRetryCount;
    avatarRetryTimer = setTimeout(() => {
      avatarSrc.value = `${DEFAULT_USER_AVATAR_URL}?retry=${retry}`;
    }, AVATAR_RETRY_BASE_DELAY * retry);
  }
};

const positonStyle = computed(() => {
  return {
    left: `${props.region.rect.left}px`,
    top: `${props.region.rect.top}px`,
    width: `${props.region.rect.right - props.region.rect.left}px`,
    height: `${props.region.rect.bottom - props.region.rect.top}px`,
  };
});

// eslint-disable-next-line no-undef
let timerId: string | number | NodeJS.Timeout | undefined;
const bindMouseEnterLeaveEvent = () => {
  if (streamCoverRef.value) {
    streamCoverRef.value.addEventListener('mouseleave', () => {
      window.ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });
    });
    streamCoverRef.value.addEventListener('mouseenter', () => {
      window.ipcRenderer.send('set-ignore-mouse-events', false);
    });
  } else {
    logger.warn(`${logPrefix}onMounted error, streamCoverRef not exist`);
    timerId = setTimeout(() => {
      timerId = 0;
      bindMouseEnterLeaveEvent();
    }, 200);
  }
};

onMounted(() => {
  bindMouseEnterLeaveEvent();
});

onUnmounted(() => {
  if (timerId) {
    clearTimeout(timerId);
  }
  resetAvatarRetry();
});
</script>

<style lang="scss" scoped>
@import '../../assets/variable.scss';

.tui-live-cover-stream {
  position: absolute;
  border: 1px solid var(--stroke-color-primary);

  // Fill the slot background only when there is no camera frame, so an opened
  // camera's native video is never covered by the overlay.
  &:not(.has-video) {
    background-color: var(--bg-color-operate);
  }

  // In the dynamic 1v6 layout, drop the border.
  &.is-dynamic-1v6 {
    border: none;
  }

  .tui-stream-avatar {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);

    img {
      width: 3rem;
      height: 3rem;
      border-radius: 1.5rem;
    }
  }

  .tui-stream-state {
    position: absolute;
    left: 0.125rem;
    bottom: 0.125rem;
    display: inline-flex;
    align-items: center;
    height: 1rem;
    width: 3rem;
    padding: 0.125rem 0 0.125rem 0.125rem;
    border-radius: 0.5rem;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    background-color: $color-cover-pendant-background;
    font-size: 0.75rem;
    color: var(--text-color-button);

    .tui-mic-state {
      display: inline-flex;
      justify-content: center;
      align-items: center;
      width: auto;
      max-width: 0.75rem;
      height: 0.75rem;
      margin-right: 0.25rem;
    }

    .tui-stream-name {
      width: auto;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .tui-empty-region {
    width: 100%;
    height: 100%;
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    color: var(--text-color-secondary);

    .tui-seat-index {
      font-size: 1.5rem;
      font-weight: 500;
    }

    .tui-seat-hint {
      max-width: 80%;
      font-size: 0.875rem;
      font-weight: 400;
      overflow-wrap: break-word;
    }
  }
}
</style>
