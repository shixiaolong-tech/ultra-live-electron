<template>
    <div class="tui-voice-chat">
        <div class="tui-voice-chat-title tui-window-header" >
            <span>{{ t('Voice Chat Management') }}</span>
            <button class="tui-icon" @click="handleCloseWindow">
              <svg-icon :icon="CloseIcon" class="tui-secondary-icon"></svg-icon>
            </button>
        </div>
        <div class="tui-voice-chat-list-container" >
            <div class="tui-voice-chat-list" >
                <div class="tui-voice-chat-list-title">
                  <span>{{ t('Apply for chat') }}</span>
                  <span v-if="isAllowed">{{applyNumber}}</span>
                </div>
                <div class="tui-voice-chat-member">
                    <span v-if="!isAllowed" class="tui-voice-chat-status">{{ t('Not allowed') }}</span>
                    <div v-else v-for="user in applyToAnchorList" :key="user.userId"  class="tui-voice-chat-apply">
                        <img class="tui-voice-chat-avatar" :src="user.avatarUrl" alt="">
                        <span class="tui-voice-chat-name">{{ user.userName || user.userId }}</span>
                        <div class="tui-voice-chat-options">
                          <span class="tui-voice-chat-accept" @click="handleUserApply(user, true)">{{ t('Accept')}}</span>
                          <span class="tui-voice-chat-reject" @click="handleUserApply(user, false)">{{ t('Rejection')}}</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="tui-voice-chat-list">
                <div class="tui-voice-chat-list-title">
                    <span>{{ t('Chat Seat List') }}</span>
                    <span v-if="isAllowed">{{currentSeat}}</span>
                </div>
                <div class="tui-voice-chat-member">
                    <span class="tui-voice-chat-status" v-if="!isAllowed">{{ t('Not allowed') }}</span>
                    <div v-else class="tui-voice-chat-seat" v-for="( item, index ) in anchorList" :key="item.userInfo.userId || index">
                        <span class="tui-voice-chat-seatIndex">{{item.seat}}</span>
                        <img v-if="item.userInfo.avatarUrl" class="tui-voice-chat-avatar" :src="item.userInfo.avatarUrl" alt="">
                        <span class="tui-voice-chat-name"> {{ item.userInfo.userName || item.userInfo.userId }}</span>
                        <mic-more-icon class="tui-voice-chat-more"  @click.stop="handleShowMemberControl(item)" ></mic-more-icon>
                        <live-member-control v-if="controlUserId === item.userInfo.userId" 
                         :userId="controlUserId"
                         v-click-outside="handleClickOutsideMemberControl"
                         @on-close="handleClose">
                        </live-member-control>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from '../../locales';
import SvgIcon from '../../common/base/SvgIcon.vue';
import CloseIcon from '../../common/icons/CloseIcon.vue';
import MicMoreIcon from '../../common/icons/MicMoreIcon.vue';
import SeatIcon from '../../common/icons/SeatIcon.vue';
import vClickOutside from '../../utils/vClickOutside';
import LiveMemberControl from './LiveMemberControl.vue';
import { useCurrentSourceStore } from '../../store/child/currentSource';
import { TUILiveUserInfo } from '../../types';

const logger = console;
const logPrefix = '[LiveVoiceChat]';

const currentSourceStore = useCurrentSourceStore();
const { applyToAnchorList, currentAnchorList } = storeToRefs(currentSourceStore);
const { t } = useI18n();
const controlUserId = ref('');
const isAllowed = ref(true);
const applyNumber = computed(() => {
  return '(' + applyToAnchorList.value.length + ')'
})
const currentNumber = ref(0);
const currentSeat = computed(() => {
  return '(' + currentNumber.value + '/' + anchorList.value.length+ ')'
})
const anchorList = ref([
  {
    seat: t('Position 1'),
    icon: SeatIcon,
    userInfo: {} as TUILiveUserInfo,
  },
  {
    seat: t('Position 2'),
    icon: SeatIcon,
    userInfo: {} as TUILiveUserInfo,
  },
  {
    seat: t('Position 3'),
    icon: SeatIcon,
    userInfo: {} as TUILiveUserInfo,
  },
  {
    seat: t('Position 4'),
    icon: SeatIcon,
    userInfo: {} as TUILiveUserInfo,
  },
  {
    seat: t('Position 5'),
    icon: SeatIcon,
    userInfo: {} as TUILiveUserInfo,
  },
  {
    seat: t('Position 6'),
    icon: SeatIcon,
    userInfo: {} as TUILiveUserInfo,
  },
  {
    seat: t('Position 7'),
    icon: SeatIcon,
    userInfo: {} as TUILiveUserInfo,
  },
  {
    seat: t('Position 8'),
    icon: SeatIcon,
    userInfo: {} as TUILiveUserInfo,
  },
])

watch(currentAnchorList, (newVal,val) => {
  logger.debug(`${logPrefix}wathch currentAnchorList:`, newVal, val);
  if (newVal) {
    if (newVal.length > 8) {
      logger.warn(`${logPrefix}wathch currentAnchorList: too many anchor, max 8, current: ${newVal.length}`);
    }
    for (let i = 0; i < 8; i++) {
      if (i < newVal.length) {
        anchorList.value[i].userInfo = newVal[i];
      } else {
        anchorList.value[i].userInfo = {} as TUILiveUserInfo;
      }
    }
    currentNumber.value = newVal.length <= 8 ? newVal.length : 8;
  }
},{
  immediate: true,
  deep: true,
}
)

const handleShowMemberControl = (item:any) => {
  if(currentNumber.value === 0) return
  if (item.userInfo.userId) {
    controlUserId.value = item.userInfo.userId;
  } else {
    // empty seat
  }
}
const handleClose = () => {
  controlUserId.value = ''
}
const handleClickOutsideMemberControl = () => {
  controlUserId.value = ''
}
const handleCloseWindow = async () => {
  window.ipcRenderer.send("close-child");
  resetCurrentView();
}
const resetCurrentView = () => {
  currentSourceStore.setCurrentViewName('');
}

async function handleUserApply(user:any, agree: boolean) {
  window.mainWindowPort?.postMessage({
    key: "handleUserApply",
    data: {
      user: JSON.stringify(user),
      agree
    }
  });
}

onBeforeUnmount(() => {
  anchorList.value.forEach(item => {
    item.userInfo = {} as TUILiveUserInfo;
  });
});
</script>
<style scoped lang="scss">
@import "../../assets/global.scss";
.tui-voice-chat{
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
    &-title{
        font-weight: $font-live-voice-chat-title-weight;
        padding: 0 1.5rem 0 1.375rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
    } 
    &-control{
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 0 1.5rem;
        border-bottom: 1px solid $color-live-voice-chat-control-border;
        height: 3rem;
        &-text{
            font-size: $font-live-voice-chat-control-text-size;
            font-style: $font-live-voice-chat-control-text-style;
            font-weight: $font-live-voice-chat-control-text-weight;
            line-height: 1.375rem; /* 157.143% */
        }
    }
    &-list-container{
        height: calc(100% - 2.75rem);
        display: flex;
        padding: 0.5rem;
        justify-content: space-between;
        background-color: var(--bg-color-dialog);
    }
    &-list-title{
      font-size: 0.75rem;
    }
    &-list{
        width: 49.5%;

        &-title {
          height: 2rem;
          line-height: 2rem;
        }
    }
    &-member{
        position: relative;
        height: calc(100% - 2rem);
        width: 100%;
        overflow-y: auto;
        overflow-x: hidden;
        border-radius: 0.5rem;
        background-color: var(--bg-color-dialog-module);
        color: $font-live-voice-chat-member-color;
    }
    &-status{
        color: var(--text-color-primary);
        font-size: $font-live-voice-chat-status-size;
        font-style: $font-live-voice-chat-status-style;
        font-weight: $font-live-voice-chat-status-weight;
        line-height: 1.375rem; /* 157.143% */
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
    }
    &-apply{
        display: flex;
        align-items: center;
        padding: 0.875rem 0.875rem 0 0.875rem;
    }
    &-avatar{
        width: 2rem;
        height: 2rem;
        border-radius: 2rem;
        margin-left: 0.5rem;
    }
    &-name{
        flex: 1;
        padding-left: 0.5rem;
        font-size: $font-live-voice-chat-name-size;
        font-style: $font-live-voice-chat-name-style;
        font-weight: $font-live-voice-chat-name-weight;
        line-height: 1.25rem; /* 166.667% */
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        color: var(--text-color-primary);
    }
    &-accept{
        color: var(--text-color-link);
        font-size: $font-live-voice-chat-accept-size;
        font-style: $font-live-voice-chat-accept-style;
        font-weight: $font-live-voice-chat-accept-weight;
        line-height: 1.25rem; /* 166.667% */
        cursor: pointer;
    }
    &-reject{
        padding-left: 0.625rem;
        color: var(--text-color-secondary);
        font-size: $font-live-voice-chat-reject-size;
        font-style: $font-live-voice-chat-reject-style;
        font-weight: $font-live-voice-chat-reject-weight;
        line-height: 1.25rem; /* 166.667% */
        cursor: pointer;
    }
    &-seat{
        height: 3.5rem;
        line-height: 3.5rem;
        display: flex;
        align-items: center;
        padding: 0 0.875rem;
        position: relative;
        color: var(--text-color-secondary);
    }
    &-seatIndex{
        color: var(--text-color-secondary);
        font-size: $font-live-voice-chat-seatIndex-size;
        font-style: $font-live-voice-chat-seatIndex-style;
        font-weight: $font-live-voice-chat-seatIndex-weight;
        line-height: 1.25rem; /* 166.667% */
    }
    &-more{
        position: absolute;
        right: 0.5rem;
        cursor: pointer;
    }
}
</style>