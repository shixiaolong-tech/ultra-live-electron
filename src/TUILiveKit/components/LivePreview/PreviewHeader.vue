
<template>
  <div class="tui-title tui-preview-title">
    <div class="tui-title-left">
      <span>{{ roomName }}</span>
      <span class="tui-title-room-id">{{ roomId }}</span>
      <svg-icon v-if="roomId" class="tui-copy-icon" :icon="CopyIcon" @click="copyLiveInfo"/>
    </div>
    <div class="tui-title-right">
      <span class="tui-statis-item tui-online-count">{{ remoteUserList.length }}{{ t("viewer") }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { TUIToast, TOAST_TYPE } from '@tencentcloud/uikit-base-component-vue3';
import SvgIcon from '../../common/base/SvgIcon.vue';
import CopyIcon from '../../common/icons/CopyIcon.vue';
import { useI18n } from '../../locales/index';
import { useBasicStore } from '../../store/main/basic';
import { useRoomStore } from '../../store/main/room';
import logger from '../../utils/logger';

const logPrefix = '[PreviewHeader]';

const { t } = useI18n();
const basicStore = useBasicStore();
const roomStore = useRoomStore();

const { roomName, roomId, phone, sdkAppId } = storeToRefs(basicStore);
const { remoteUserList } = storeToRefs(roomStore);

const copyLiveInfo = async () => {
  if (!roomId.value) {
    logger.warn(`${logPrefix}copyLiveInfo: no room ID`);
    return;
  }

  let liveInfo = '';
  if (phone.value) {
    liveInfo = `${roomName.value} ${roomId.value}`;
  } else {
    liveInfo = `https://web.sdk.qcloud.com/trtc/livekit/player/index.html#/live-player?liveId=${roomId.value}&sdkAppId=${sdkAppId.value}`;
  }

  try {
    await navigator.clipboard.writeText(liveInfo);
    TUIToast({
      message: t('Copy successfully'),
      type: TOAST_TYPE.SUCCESS,
    });
  } catch (error) {
    TUIToast({
      message: t('Copy failed'),
      type: TOAST_TYPE.ERROR,
    });
  }
};
</script>

<style scoped lang="scss">
@import "../../assets/variable.scss";

.tui-preview-title {
  display: flex;
  justify-content: space-between;

  .tui-title-left {
    display: flex;
    align-items: center;

    .tui-title-room-id {
      margin-left: 0.5rem;
    }

    .tui-copy-icon {
      margin-left: 0.5rem;
      cursor: pointer;
      opacity: 0.7;
      transition: opacity 0.2s;

      &:hover {
        opacity: 1;
      }
    }
  }

  .tui-statis-item {
    padding: 0 0.5rem;
    border-right: 1px solid $color-divider-line;

    &:first-child {
      padding-left: 0;
    }

    &:last-child {
      padding-right: 0;
      border-right: none;
    }
  }
}
</style>
