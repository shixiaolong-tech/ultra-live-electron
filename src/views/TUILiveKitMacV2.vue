<template>
  <UIKitProvider language="zh-CN" theme="dark">
    <div class="tui-livekit-mac-v2">
      <LiveHeader @logout="handleLogout" />
      <div class="live-pusher-main">
        <div class="main-left">
          <div class="main-left-top">
            <div class="main-left-top-title card-title">
              <div class="title-text">
                {{ t("Video Source") }}
              </div>
            </div>
            <div class="main-left-top-content">
              <LiveScenePanel />
            </div>
          </div>
        </div>
        <div class="main-center">
          <div class="main-center-top">
            <div class="main-center-top-left">
              <div class="main-center-top-left-owner">
                <div class="main-center-top-left-owner-name">
                  <span class="main-center-top-left-owner-name-text">
                    直播间名称：{{ liveParams.liveName }}
                  </span>
                  <span class="main-center-top-left-owner-name-id">
                    直播间ID：{{ liveParams.liveId }}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div 
            class="main-center-center" 
            :class="[
              currentLive?.layoutTemplate === TUISeatLayoutTemplate.LandscapeDynamic_1v3 ? 'landscape' : 'portrait'
            ]"
          >
            <!-- <StreamMixer /> -->
            <!-- 显示麦上观众 -->
            <div
              class="main-center-online-audience"
              v-if="
                liveSeatList.length > 0 &&
                currentLive?.layoutTemplate ===
                  TUISeatLayoutTemplate.LandscapeDynamic_1v3
              "
            >
              <div class="main-center-online-audience-title">
                {{
                  t("CoGuest Audience Count", { count: liveSeatList.length })
                }}
              </div>
              <template
                v-for="item in liveSeatList"
                :key="item.userInfo.userId"
              >
                <div class="main-center-online-audience-item">
                  <div class="main-center-online-audience-item-avatar">
                    <Avatar :src="item.userInfo.avatarUrl" :size="60" />
                    <div class="main-center-online-audience-item-name-icon">
                      <IconMicOff
                        v-if="
                          item.userInfo.microphoneStatus !== DeviceStatus.On
                        "
                      />
                      <IconMicOn v-else />
                    </div>
                  </div>
                  <div class="main-center-online-audience-item-name">
                    <span class="main-center-online-audience-item-name-text">{{
                      item.userInfo.userName
                    }}</span>
                    <span
                      class="main-center-online-audience-item-name-text-id"
                      >ID: {{ item.ownerId }}</span
                    >
                  </div>
                </div>
              </template>
            </div>
          </div>
          <div class="main-center-bottom">
            <div class="main-center-bottom-content">
              <div class="main-center-bottom-left">
                <MicVolumeSetting />
                <SpeakerVolumeSetting />
                <div class="main-center-bottom-tools">
                  <CoGuestButton />
                  <OrientationSwitch />
                  <!-- <LayoutSwitch /> -->
                  <SettingButton />
                </div>
              </div>
              <div class="main-center-bottom-right">
                <TUIButton
                  v-if="!isInLive"
                  type="primary"
                  :disabled="loading"
                  @click="handleCreateLive"
                >
                  <IconLiveLoading v-if="loading" class="loading-icon" />
                  <IconLiveStart v-else />
                  {{ t("Start live") }}
                </TUIButton>
                <TUIButton
                  v-else
                  color="red"
                  :disabled="loading"
                  @click="showEndLiveDialog"
                >
                  <IconLiveLoading v-if="loading" class="loading-icon" />
                  <IconEndLive v-else />
                  {{ t("End live") }}
                </TUIButton>
                <TUIButton
                  :disabled="!currentLive?.liveId"
                  color="orange"
                  type="primary"
                >
                  <IconVideo />
                  {{ t("Enter Live Room") }}
                </TUIButton>
                <TUIButton
                  type="primary"
                  @click="handleReCreateLive"
                >
                  <IconVideo />
                  重新开播
                </TUIButton>
              </div>
            </div>
          </div>
        </div>
        <div class="main-right">
          <div class="main-right-top">
            <div class="main-right-top-title card-title">
              <div class="title-text">
                {{ t("Online viewers") }}
              </div>
              <div class="title-count">({{ audienceCount }})</div>
            </div>
            <LiveAudienceList height="calc(100% - 40px)" />
          </div>
          <MessageComponent :roomId="liveParams.liveId" :userId="liveUserInfo?.userId || ''" />
        </div>
        <LivePusherNotification />
        <TUIDialog
          v-model:visible="exitLiveDialogVisible"
          :title="t('End live')"
        >
          {{ endLiveDialogMessage }}
          <template #footer>
            <div class="action-buttons">
              <TUIButton color="gray" @click="exitLiveDialogVisible = false">
                {{ t("Cancel") }}
              </TUIButton>
              <TUIButton color="red" @click="handleEndLive">
                {{ t("End live") }}
              </TUIButton>
            </div>
          </template>
        </TUIDialog>
      </div>
    </div>
  </UIKitProvider>
</template>

<script setup lang='ts'>
import { onMounted, onBeforeUnmount, computed, ref, watch, defineProps } from 'vue';
import { useRouter } from 'vue-router';
import {
  IconEndLive,
  IconLiveLoading,
  IconLiveStart,
  TUIButton,
  TUIDialog,
  TUIMessageBox,
  TUIToast,
  UIKitProvider,
  useUIKit,
  IconVideo,
  IconMicOff,
  IconMicOn,
} from '@tencentcloud/uikit-base-component-vue3';
import {
  useLiveSeatState,
  useLoginState,
  useLiveAudienceState,
  useLiveListState,
  useDeviceState,
  useCoGuestState,
  LiveScenePanel,
  StreamMixer,
  LiveAudienceList,
  DeviceStatus,
  Avatar,
} from 'tuikit-atomicx-vue3-electron';
import TUIRoomEngine, {
  TUISeatMode,
} from '@tencentcloud/tuiroom-engine-electron';
import { TUISeatLayoutTemplate } from '@/TUILiveKit/types';
import { useElectronLogin } from '../TUILiveKit/hooks/useElectronLogin';
import MessageComponent from '@/components/message/index.vue'
// import LayoutSwitch from '../TUILiveKit/components/v2/LayoutSwitch.vue';
import CoGuestButton from '../TUILiveKit/components/v2/CoGuestButton.vue';
import MicVolumeSetting from '../TUILiveKit/components/v2/MicVolumeSetting.vue';
import OrientationSwitch from '../TUILiveKit/components/v2/OrientationSwitch.vue';
import SettingButton from '../TUILiveKit/components/v2/SettingButton.vue';
import SpeakerVolumeSetting from '../TUILiveKit/components/v2/SpeakerVolumeSetting.vue';
import LiveHeader from '../TUILiveKit/components/v2/LiveHeader/index.vue';
import LivePusherNotification from '../TUILiveKit/components/v2/LivePusherNotification.vue';
import {
  isNetworkOffline,
  isNetworkTimeoutError,
} from '../TUILiveKit/utils/utils';
import { api } from '../lib/api';
import { LOCAL_STORAGE_KEY_USER_INFO, LOCAL_STORAGE_KEY_LIVE_RESULT, LOCAL_STORAGE_KEY_TOKEN, clearAllLocalStorage } from '@/const/local';
import { getUserInfo } from '@/utils/base';

const router = useRouter();
const { loginUserInfo } = useLoginState();
const { t, language } = useUIKit();

const props = defineProps<{
  liveId?: string;
  liveName?: string;
  seatMode?: TUISeatMode;
}>();
// 连麦-连麦列表
const { seatList } = useLiveSeatState();
const { currentLive, createLive, endLive, joinLive } = useLiveListState();
const { audienceCount } = useLiveAudienceState();
const { openLocalMicrophone } = useDeviceState();
const { connected: coGuestConnected } = useCoGuestState();
const isInLive = computed(() => !!currentLive.value?.liveId);
const loading = ref(false);
const exitLiveDialogVisible = ref(false);
const liveResultInfo = ref<Record<string, any> | null>(null);
const liveUserInfo = ref<Record<string, any> | null>(null);
const liveParams = computed(() => ({
  liveId: liveResultInfo.value?.roomId || '',
  liveName: liveResultInfo.value?.roomName || '',
  seatMode: props.seatMode || TUISeatMode.kApplyToTake,
}));

// 是否开播
const isPushingLive = ref(false);
// 连麦-麦上用户列表
const liveSeatList = ref<any>([]);
// 直播间状态轮询定时器
let liveStatusPollingTimer: number | null = null;

TUIRoomEngine.once('ready', () => {
  TUIRoomEngine.callExperimentalAPI(JSON.stringify({
    api: 'enableMultiPlaybackQuality',
    params: {
      enable: true,
    },
  }));
});

const showEndLiveDialog = async () => {
  if (loading.value) {
    return;
  }
  exitLiveDialogVisible.value = true;
};

// Setup useElectronLogin Hook
const {
  loginWithRetry,
  setupEventListeners,
  cleanupEventListeners,
  handleLogout: handleElectronLogout,
} = useElectronLogin({
  onLogout: () => {
    reset();
  },
  onLoginFailed: () => {
    reset();
  },
});

// Handle logout with live status check
const handleLogout = async () => {
  try {
    await handleElectronLogout();
  } catch (error) {
    reset();
  }
};

const endLiveDialogMessage = computed(() => {
  if (coGuestConnected.value.length > 1) {
    return t(
      'You are currently co-guesting with other streamers. Would you like to [End Live] ?'
    );
  }
  return t('You are currently live streaming. Do you want to end it?');
});

const handleCreateLive = async () => {
  try {
    if (loading.value) {
      return;
    }
    if (isNetworkOffline()) {
      TUIToast.error({
        message: t('Network error, please check your connection and try again'),
      });
      return;
    }
    loading.value = true;
    // 更新直播
    const res = await api.room.updateRoomStatus({
      roomId: liveParams.value.liveId,
      status: 1,
    });
  
    if (res.code !== 200) {
      if (res.code === 202) {
        TUIToast.error({
          message: t('Live Room Closed Redirect Message'),
        });
        setTimeout(() => {
          router.replace({ name: 'stream' });
        }, 3000);
        return;
      }
      TUIToast.error({
        message: t('Failed to update live status'),
      });
      return;
    }
    await TUIRoomEngine.callExperimentalAPI(
      JSON.stringify({
        api: 'enableUnlimitedRoom',
        params: {
          enable: true,
        },
      })
    );
    await TUIRoomEngine.callExperimentalAPI(
      JSON.stringify({
        api: 'setCurrentLanguage',
        params: {
          language: language.value === 'zh-CN' ? 'zh-Hans' : 'en',
        },
      })
    );
    // 创建直播间
    const params = {
      liveId: liveParams.value.liveId,
      liveName: liveParams.value.liveName,
      isMessageDisableForAllUser: false,
      isGiftEnabled: true,
      isLikeEnabled: true,
      isPublicVisible: true,
      isSeatEnabled: true,
      keepOwnerOnSeat: true,
      seatLayoutTemplateId: currentLive.value?.layoutTemplate || 0,
      seatMode: liveParams.value.seatMode,
      categoryList: [],
      activityStatus: 0,
      maxSeatCount: 0,
    }
    console.log('创建直播间', params);
    const liveInfo = await createLive(params);
    console.log('创建直播间结果', liveInfo);
    // 加入直播间
    await joinLive({
      liveId: liveParams.value.liveId,
    });
    loading.value = false;
    isPushingLive.value = true;
    await openLocalMicrophone();
    // 成功
    TUIToast.success({
      message: t('Live started successfully'),
    });
  } catch (error: any) {
    loading.value = false;
    if (isNetworkTimeoutError(error)) {
      TUIToast.error({
        message: t('Network error, please check your connection and try again'),
      });
      return;
    }
    if (
      typeof error.message === 'string' &&
      error.message.indexOf(
        'this room already exists, and you are the owner'
      ) !== -1
    ) {
      await joinLive({
        liveId: liveParams.value.liveId,
      });
      await openLocalMicrophone();
      return;
    }
    TUIToast.error({
      message: t('Failed to create live'),
    });
  }
};

const handleEndLive = async () => {
  try {
    if (isNetworkOffline()) {
      TUIToast.error({
        message: t('Network error, please check your connection and try again'),
      });
      return;
    }
    loading.value = true;
    exitLiveDialogVisible.value = false;
    // 停止TRTC
    if (liveParams.value.liveId) {
      try {
        await api.room.stopLiveWithTRTC(Number(liveParams.value.liveId));
      } catch (error) {
        console.error('停止TRTC失败:', error);
      }
    }
    // 更新直播状态
    await endLive();
    isPushingLive.value = false;
    loading.value = false;
    TUIToast.success({
      message: t('Live ended successfully'),
    });
  } catch (error: any) {
    console.error('End live error:', error);
    loading.value = false;
    isPushingLive.value = false;
    if (isNetworkTimeoutError(error)) {
      TUIToast.error({
        message: t('Network error, please check your connection and try again'),
      });
      return;
    }
    exitLiveDialogVisible.value = false;
  } finally {
    window.localStorage.removeItem(LOCAL_STORAGE_KEY_LIVE_RESULT);
  }
};

const handleReCreateLive = async () => {
  await handleEndLive();
  router.replace({ name: 'stream' });
};

/** Handles app quit request (e.g. Cmd+Q / close main window): confirm end live then quit or cancel. */
const handleAppRequestQuit = () => {
  console.log('handleAppRequestQuit', isInLive.value);
  if (!isInLive.value) {
    window.ipcRenderer?.send('app-quit-confirmed');
    return;
  }
  TUIMessageBox.confirm({
    title: t('End live and quit?'),
    content: t(
      'You are currently live streaming. Do you want to end the live and quit the app?'
    ),
    confirmText: t('End live and quit'),
    cancelText: t('Cancel'),
    callback: async (action) => {
      if (action !== 'confirm') {
        window.ipcRenderer?.send('app-quit-cancel');
        return;
      }
      await handleEndLive();
      if (isInLive.value) {
        TUIToast.error({
          message: t('Failed to end live, please try again later'),
        });
        window.ipcRenderer?.send('app-quit-cancel');
      } else {
        window.ipcRenderer?.send('app-quit-confirmed');
      }
    },
  });
};

// 检查直播间状态
const checkLiveStatus = async (): Promise<boolean> => {
  try {
    if (!liveParams.value.liveId) {
      console.warn('直播间ID不存在，无法检查状态');
      return false;
    }

    const res = await api.room.checkUserLiveStatus(
      Number(liveParams.value.liveId)
    );
    console.log('当前直播间状态', res.data);

    // 如果直播间状态为0（已关闭），执行结束直播操作
    if (res.data?.status === 0) {
      // 执行结束直播
      await handleEndLive();
      return true; // 返回 true 表示检测到关闭状态
    }

    return false; // 返回 false 表示直播间仍在运行
  } catch (error) {
    console.error('检查直播间状态失败:', error);
    // 发生错误时返回 false，不中断轮询
    return false;
  }
};

// 重置
const reset = () => {
  clearAllLocalStorage();
  router.replace({ name: 'login' });
}
// 监听麦上用户数据
watch(
  seatList,
  (newVal) => {
    // 过滤item.userInfo.userId !== currentLive.liveOwner.userId
    liveSeatList.value = newVal
      .filter(
        (item) => item.userInfo?.userId !== currentLive.value?.liveOwner.userId
      )
      .map((item) => {
        return {
          ...item,
          ownerId: item.userInfo?.userId?.split('_')[1],
        };
      });
  },
  {
    immediate: true,
    deep: true,
  }
);

// 监听 isPushingLive 状态，启动/停止轮询
// 监听 liveParams 变化
watch(
  liveParams,
  (newVal) => {
    if (newVal.liveId) {
      checkLiveStatus();
    }
  },
  {
    immediate: true,
    deep: true,
  }
);

onMounted(async () => {
  // Setup event listeners
  setupEventListeners();
  if (window.ipcRenderer) {
    window.ipcRenderer.on('app-request-quit', handleAppRequestQuit);
  }
  // 登录信息获取失败
  const storedUserInfo = window.localStorage.getItem(LOCAL_STORAGE_KEY_USER_INFO);
  if (!storedUserInfo) {
    const token = window.localStorage.getItem(LOCAL_STORAGE_KEY_TOKEN);
    if (!token) {
      reset();
      return;
    }
    const userInfoResponse = await getUserInfo();
    if (!userInfoResponse) {
      reset();
      return;
    }
    liveUserInfo.value = userInfoResponse;
  }
  else {
    liveUserInfo.value = JSON.parse(storedUserInfo);
  }
  // 已登录，但是未创建直播间
  const liveResult = window.localStorage.getItem(LOCAL_STORAGE_KEY_LIVE_RESULT);
  if (!liveResult) {
    const liveInfo = await api.room.getCurrentLiveStatus();
    const isLiveStatus = liveInfo.data?.isLive;
    console.log('当前直播间状态', isLiveStatus);
    if (!isLiveStatus) {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY_LIVE_RESULT);
      router.replace({ name: 'stream' });
      return;
    }
    else {
      const liveResult = {
        userId: 'live_' + liveUserInfo.value?.userId,
        roomName: liveInfo.data?.roomName,
        roomId: liveInfo.data?.roomId || 0,
        userSig: liveInfo.data?.userSig || '',
        sdkAppId: liveInfo.data?.sdkAppId || '',
        avatarUrl: liveUserInfo.value?.avatarUrl || '',
        userName: liveUserInfo.value?.userName || '',
      }
      window.localStorage.setItem(LOCAL_STORAGE_KEY_LIVE_RESULT, JSON.stringify(liveResult));
      liveResultInfo.value = liveResult;
    }
  }
  else {
    liveResultInfo.value = JSON.parse(liveResult);
  }
  // 获取直播信息，开始登录
  try {
    const { sdkAppId, userSig, userId, userName, avatarUrl } = liveResultInfo.value || {};
    // 开始登录
    await loginWithRetry({
      sdkAppId,
      userId,
      userSig,
      userName,
      avatarUrl,
    });
    console.log('登录成功');
  } catch (e) {
    console.log('登录失败', e);
  }
});

onBeforeUnmount(() => {
  // 组件卸载时清除轮询定时器
  cleanupEventListeners();
  if (window.ipcRenderer) {
    window.ipcRenderer.off('app-request-quit', handleAppRequestQuit);
  }
});
</script>

<style lang="scss" scoped>
@import "../TUILiveKit/assets/mac.scss";

.tui-livekit-mac-v2 {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;

  .live-pusher-main {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: row;
    user-select: none;
    padding: 0 12px 12px 12px;
    border-radius: 8px;
    background-color: var(--bg-color-topbar);
    @include scrollbar;

    .main-left {
      width: 20%;
      max-width: 320px;
      flex: 0 0 20%;
      height: 100%;
      color: $text-color1;
      display: flex;
      flex-direction: column;
      gap: 6px;

      .main-left-top {
        flex: 1;
        background-color: var(--bg-color-operate);
        padding: 16px;

        .main-left-top-title {
          display: flex;
          align-items: center;
          color: $text-color1;
          height: 40px;
          box-sizing: border-box;
          margin-bottom: 16px;

          .title-text {
            @include text-size-16;
            display: inline-flex;
            align-items: center;
            justify-content: start;

            .icon-back {
              &:hover {
                cursor: pointer;
              }
            }
          }
        }

        .main-left-top-content {
          height: calc(100% - 56px);
        }
      }

      .main-left-bottom {
        display: flex;
        flex-direction: column;
        justify-content: center;
        background-color: var(--bg-color-operate);
        padding: 16px;

        .main-left-bottom-header {
          display: flex;
          justify-content: space-between;
          align-items: center;

          .main-left-bottom-fold {
            display: flex;
            align-items: center;
            gap: 4px;
            cursor: pointer;
            color: $text-color2;
            @include text-size-12;
          }
        }

        .main-left-bottom-title {
          @include text-size-16;
        }

        .main-left-bottom-tools {
          @include dividing-line("top");
          margin-top: 16px;
          display: flex;
        }
      }
    }

    .main-center {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
      margin: 0 6px;

      .main-center-top {
        box-sizing: border-box;
        padding: 0 16px;
        width: 100%;
        height: 56px;
        background-color: var(--bg-color-operate);
        color: $text-color1;
        display: flex;
        justify-content: space-between;
        align-items: center;
        position: relative;

        .main-center-top-left {
          @include text-size-16;
          display: flex;
          align-items: center;
          gap: 8px;

          .copy-icon {
            cursor: pointer;

            &:hover {
              color: $icon-hover-color;
            }
          }
        }
        .main-center-top-left-owner {
          @include text-size-12;
          color: $text-color2;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          .main-center-top-left-owner-name {
            display: flex;
            flex-direction: column;
          }
          .main-center-top-left-owner-name-text {
            @include text-size-14;
            color: $text-color1;
          }
          .main-center-top-left-owner-name-id {
            @include text-size-12;
            color: $text-color2;
            cursor: pointer;
            &:hover {
              color: $text-color1;
            }
          }
        }

        .main-center-top-right {
          @include text-size-12;
        }

        &::after {
          content: "";
          position: absolute;
          bottom: 0;
          left: 16px;
          right: 16px;
          height: 1px;
          background-color: var(--stroke-color-primary);
        }
      }

      .main-center-center {
        flex: 1;
        min-width: 0;
        min-height: 0;
        color: #131417;
        flex: 1;
        position: relative;
        &.landscape :deep(.live-core-ui) {
          display: none !important;
        }
      }
      .main-center-online-audience {
        position: absolute;
        bottom: 20px;
        left: 20px;
        z-index: 1000;
        display: flex;
        flex-direction: column;
        gap: 8px;
        background-color: rgba(255, 255, 255, 0.1);
        color: $text-color1;
        border-radius: 4px;
        padding: 8px;

        .main-center-online-audience-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 8px;
        }
        .main-center-online-audience-item-avatar {
          position: relative;
          .main-center-online-audience-item-name-icon {
            position: absolute;
            bottom: -0px;
            right: -5px;
            background-color: rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(10px);
            padding: 4px;
            border-radius: 100px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
        }
        .main-center-online-audience-item-name {
          margin-left: 8px;
          @include text-size-14;
          color: $text-color1;
          display: flex;
          flex-direction: column;
          gap: 8px;
          .main-center-online-audience-item-name-text,
          .main-center-online-audience-item-name-text-id {
            @include text-size-16;
            color: $text-color1;
          }
          .main-center-online-audience-item-name-text-id {
            @include text-size-14;
            color: $text-color2;
            cursor: pointer;
            &:hover {
              color: $text-color1;
            }
          }
        }
      }

      .main-center-bottom {
        width: 100%;
        background-color: var(--bg-color-operate);
        display: flex;
        justify-content: space-between;
        padding: 0 16px;
        box-sizing: border-box;
        flex-direction: column;
        position: relative;

        &::before {
          content: "";
          position: absolute;
          top: 0;
          left: 16px;
          right: 16px;
          height: 1px;
          background-color: var(--stroke-color-primary);
        }

        .main-center-bottom-header {
          @include text-size-14;
        }

        .main-center-bottom-content {
          display: flex;
          justify-content: space-between;
          height: 72px;

          .main-center-bottom-left {
            flex: 1;
            height: 100%;
            display: flex;
            align-items: center;
            gap: 16px;

            .main-center-bottom-tools {
              display: flex;
              gap: 6px;
              flex-wrap: wrap;
            }
          }

          .main-center-bottom-right {
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
          }
        }
      }
    }

    .main-right {
      height: 100%;
      width: 20%;
      flex: 0 0 20%;
      max-width: 320px;
      color: $text-color1;
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 200px;

      .main-right-top {
        background-color: var(--bg-color-operate);
        color: $text-color1;
        height: 30%;
        padding: 16px;
        user-select: text;

        .main-right-top-title {
          display: flex;
          align-items: center;
          color: $text-color1;
          height: 40px;
          box-sizing: border-box;
          user-select: none;

          .title-text {
            @include text-size-16;
          }

          .title-count {
            font-weight: 400;
            color: $text-color2;
          }
        }
      }

      .main-right-bottom {
        flex: 1;
        background-color: var(--bg-color-operate);
        color: $text-color1;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        padding: 16px;

        .main-right-bottom-header {
          display: flex;
          flex-direction: column;
        }

        .message-list-container {
          flex: 1 1 auto;
          user-select: text;
          overflow-y: auto;
          margin: 0 -0.5rem;
        }
        .message-input-container {
          border-top: 1px solid var(--stroke-color-primary);
          padding-top: 12px;
        }
        .reply-preview {
          display: flex;
          align-items: start;
          flex-direction: column;
          font-size: 12px;
          margin-bottom: 6px;
          gap: 4px;
          .reply-preview-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
          }
          .reply-preview-header-close {
            cursor: pointer;
            width: 14px;
            height: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            &:hover {
              color: $icon-hover-color;
            }
          }
          .reply-preview-content {
            width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            background-color: rgba(255, 255, 255, 0.1);
            padding: 2px 4px;
            border-radius: 4px;
          }
        }
      }
    }
  }
  .card-title {
    @include text-size-16;
    @include dividing-line;
  }
  .action-buttons {
    display: flex;
    gap: 10px;
  }
}
</style>
