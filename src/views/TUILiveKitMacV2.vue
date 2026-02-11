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
            <StreamMixer />
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
          <div class="main-right-bottom">
            <div class="main-right-bottom-header">
              <div class="main-right-bottom-title card-title">
                {{ t("Barrage list") }}
              </div>
            </div>
            <div class="message-list-container">
              <MessageList
                :isLive="true"
                :messages="messages"
              />
            </div>
            <div class="message-input-container">
              <!-- <LiveSend /> -->
              <BarrageInput
                height="56px"
                :placeholder="isInLive ? '' : t('Live not started')"
              />
              <!-- <LiveSend
                :disabled="isConnectedLoading"
                @sendMessage="handleSendMessage"
              /> -->
            </div>
          </div>
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
import trtcCloud from '../TUILiveKit/utils/trtcCloud';
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
  BarrageList,
  Avatar,
  DeviceStatus,
} from 'tuikit-atomicx-vue3-electron';
import TUIRoomEngine, {
  TUISeatMode,
} from '@tencentcloud/tuiroom-engine-electron';
import { TUISeatLayoutTemplate } from '@/TUILiveKit/types';
import { useElectronLogin } from '../TUILiveKit/hooks/useElectronLogin';
import MessageList from '@/components/message/List.vue'
import LiveSend from '@/components/chat/LiveSend.vue';
import CoGuestButton from '../TUILiveKit/components/v2/CoGuestButton.vue';
import LayoutSwitch from '../TUILiveKit/components/v2/LayoutSwitch.vue';
import MicVolumeSetting from '../TUILiveKit/components/v2/MicVolumeSetting.vue';
import OrientationSwitch from '../TUILiveKit/components/v2/OrientationSwitch.vue';
import SettingButton from '../TUILiveKit/components/v2/SettingButton.vue';
import SpeakerVolumeSetting from '../TUILiveKit/components/v2/SpeakerVolumeSetting.vue';
import LiveHeader from '../TUILiveKit/components/v2/LiveHeader/index.vue';
import LiveSettingButton from '../TUILiveKit/components/v2/LiveSettingButton.vue';
import LivePusherNotification from '../TUILiveKit/components/v2/LivePusherNotification.vue';
import { BarrageInput } from '@/components/BarrageInput';
import {
  copyToClipboard,
  isNetworkOffline,
  isNetworkTimeoutError,
} from '../TUILiveKit/utils/utils';
import { api } from '../lib/api';
import { useWebSocket, type WebSocketMessage } from '../composables/useWebSocket';

console.log('TRTC SDK version:', trtcCloud.getSDKVersion());

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
  liveId: '10001264' || liveResultInfo.value?.roomId || '',
  liveName: liveResultInfo.value?.roomName || '',
  seatMode: props.seatMode || TUISeatMode.kApplyToTake,
}));

// 是否开播
const isPushingLive = ref(false);
// 连麦-麦上用户列表
const liveSeatList = ref<any>([]);
// 直播间状态轮询定时器
let liveStatusPollingTimer: number | null = null;

// 消息相关状态
const messages = ref<WebSocketMessage[]>([]);
const totalPage = ref(0);
const page = ref(1);
const isConnectedLoading = ref(true);
const userToken = ref<string | null>(null);

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
    console.log('onLogout');
    // router.replace({ name: 'login' });
  },
  onLoginFailed: () => {
    console.log('onLoginFailed');
    // router.replace({ name: 'login' });
  },
});

// Handle logout with live status check
const handleLogout = async () => {
  try {
    await handleElectronLogout();
  } catch (error) {
    redirectToLogin();
  }
};

function redirectToLogin() {
  window.localStorage.removeItem('billion-live-userInfo');
  window.localStorage.removeItem('billion-liveResult');
  // router.replace({ name: 'login' });
}

const endLiveDialogMessage = computed(() => {
  if (coGuestConnected.value.length > 1) {
    return t(
      'You are currently co-guesting with other streamers. Would you like to [End Live] ?'
    );
  }
  return t('You are currently live streaming. Do you want to end it?');
});

// 发送消息
const handleSendMessage = (currentMessage: string) => {
  console.log('发送信息', currentMessage)
  if (currentMessage.trim()) {
    // 拼接一下
    // const content = {
    //   content: currentMessage,
    //   replyContent: replyMessage,
    // };
    // sendMessage(JSON.stringify(content));
    // setReplyMessage(null);
  }
};

const handleCreateLive = async () => {
  try {
    if (loading.value) {
      return;
    }
    if (!loginUserInfo.value?.userId) {
      TUIToast.info({
        message: t('Please login first'),
      });
      redirectToLogin();
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
          router.replace({ name: 'loading' });
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
    await createLive({
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
    });
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
    await endLive();
    // 停止TRTC
    if (liveParams.value.liveId) {
      try {
        await api.room.stopLiveWithTRTC(Number(liveParams.value.liveId));
      } catch (error) {
        console.error('停止TRTC失败:', error);
      }
    }
    window.localStorage.removeItem('billion-liveResult');
    // window.localStorage.removeItem('billion-live-userInfo');
    // window.localStorage.removeItem('billion-live-token');
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
    // router.replace({ name: 'login' });
  }
};

const handleReCreateLive = async () => {
  await handleEndLive();
  router.replace({ name: 'loading' });
};

/** Handles app quit request (e.g. Cmd+Q / close main window): confirm end live then quit or cancel. */
const handleAppRequestQuit = () => {
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

onMounted(async () => {
  // Setup event listeners
  setupEventListeners();
  if (window.ipcRenderer) {
    window.ipcRenderer.on('app-request-quit', handleAppRequestQuit);
  }

  // Read user info from localStorage
  const currentUserInfo = window.localStorage.getItem('billion-live-userInfo');
  const liveResult = window.localStorage.getItem('billion-liveResult');
  if (!currentUserInfo) {
    // router.replace({ name: 'login' });
    return;
  }
  if (!liveResult) {
    // router.replace({ name: 'loading' });
    return;
  }
  try {
    liveResultInfo.value = JSON.parse(liveResult);
    liveUserInfo.value = JSON.parse(currentUserInfo);

    const { sdkAppId, userSig, userId, userName, avatarUrl, roomId } =
      liveResultInfo.value || {};
    
    // 通过 billion-liveResult 里面的 roomId 进行入口判断
    // 注意：liveParams.value.liveId 是从 liveResultInfo.value?.roomId 计算出来的
    // 所以这里直接使用 roomId 来判断
    if (roomId && liveParams.value.liveId) {
      console.log('roomId', roomId);
      // 初始化 WebSocket 和聊天列表
      initWebSocket();
      // 加载聊天列表
      await selectRoomChatList();
    }
    
    // Use retry mechanism for login
    await loginWithRetry({
      sdkAppId,
      userId,
      userSig,
      userName,
      avatarUrl,
    });
  } catch (e) {
    // redirectToLogin();
  }
});

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
    console.log('当前直播间状态', res.data?.status);

    // 如果直播间状态为0（已关闭），执行结束直播操作
    if (res.data?.status === 0) {
      console.log('检测到直播间已关闭，执行结束直播操作');
      // 停止轮询
      stopLiveStatusPolling();
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

// 轮询检查直播间状态
const startLiveStatusPolling = () => {
  // 如果已经有定时器在运行，先清除
  if (liveStatusPollingTimer !== null) {
    clearInterval(liveStatusPollingTimer);
  }

  // 如果没有 liveId，不启动轮询
  if (!liveParams.value.liveId) {
    return;
  }

  // 每5秒轮询一次
  liveStatusPollingTimer = window.setInterval(async () => {
    await checkLiveStatus();
  }, 5000);
};

// 停止轮询
const stopLiveStatusPolling = () => {
  if (liveStatusPollingTimer !== null) {
    clearInterval(liveStatusPollingTimer);
    liveStatusPollingTimer = null;
  }
};

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
watch(isPushingLive, (newVal) => {
  if (newVal) {
    startLiveStatusPolling();
  } else {
    stopLiveStatusPolling();
  }
});

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

// 格式化消息内容
const formatMessageContent = (list: any[]) => {
  const orderInfoList = list.filter((item: any) => item.messageType === '8').reverse();
  let messagesList = list
    .filter((item: any) => item.messageType !== '8')
    .reverse()
    .map((item: any) => {
      let formatContent: {
        content: string;
        replyContent: WebSocketMessage | null;
        isSuperAdmin: boolean;
      } = {
        content: '--',
        replyContent: null,
        isSuperAdmin: false,
      };
      try {
        formatContent = typeof item.content === 'string' ? JSON.parse(item.content) : item.content;
      } catch (err) {
        formatContent = {
          content: item.content || '--',
          replyContent: null,
          isSuperAdmin: false,
        };
      }
      return {
        ...item,
        content: formatContent?.content,
        replyContent: formatContent?.replyContent || null,
        isSuperAdmin: formatContent?.isSuperAdmin || false,
      } as unknown as WebSocketMessage;
    });
  return {
    orderInfoList,
    messagesList,
  };
};

// 获取直播间聊天列表
const selectRoomChatList = async () => {
  if (!liveParams.value.liveId) {
    return;
  }
  try {
    const res = await api.room.selectRoomChatList({
      page: 1,
      limit: 1000,
      roomId: Number(liveParams.value.liveId),
    });
    
    // 是否在直播
    const isLive = isPushingLive.value;
    totalPage.value = res.data?.totalPage || 0;
    // 消息格式处理
    const { messagesList } = formatMessageContent(res.data?.list || []);
    // 第一次加载的时候，将最后一条插入isNewMessage
    messages.value = [...(messagesList || []), ...messages.value];
    if (isLive && messagesList && messagesList.length > 0) {
      // 检查是否已经存在 isNewMessage 为 true 的消息
      const hasNewMessageMarker = messages.value.some(msg => msg.isNewMessage === true);
      if (!hasNewMessageMarker) {
        messages.value = [
          ...messages.value,
          {
            isNewMessage: true,
          } as unknown as WebSocketMessage,
        ];
      }
    }
  } catch (error) {
    console.error('获取直播间聊天列表失败:', error);
  }
};

// WebSocket 相关
let wsSendMessage: ((content: string) => void) | null = null;
const wsIsConnected = ref(false);

// 初始化 WebSocket
const initWebSocket = () => {
  if (!liveParams.value.liveId || !liveUserInfo.value) {
    return;
  }
  
  // 获取 token
  const token = window.localStorage.getItem('billion-live-token') || userToken.value || '';
  const userId = liveUserInfo.value.userId || '';

  const ws = useWebSocket({
    autoReconnect: false,
    isLive: true,
    roomId: String(liveParams.value.liveId),
    userId: userId ? String(userId) : 'guest',
    token: token,
    onMessage: (message) => {
      console.log('message', message);
      // 直播间关闭
      if (message.type === '7') {
        isPushingLive.value = false;
        return;
      }
      // 禁言
      if (message.type === '10') {
        // 可以在这里处理禁言逻辑
        return;
      }
      // 直播暂停
      if (message.type === '11') {
        // 可以在这里处理直播暂停逻辑
        return;
      }
      // 直播重新推流
      if (message.type === '12') {
        // 可以在这里处理直播重新推流逻辑
        return;
      }
      // 跟单不加载消息
      if (message.type === '8') {
        // 可以在这里处理跟单消息
        return;
      }
      // 跟单
      if (message.type === '9') {
        // 可以在这里处理跟单消息
        return;
      }
      // 礼物消息
      if (message.type === '5') {
        // 可以在这里处理礼物消息
        return;
      }
      // 普通消息
      messages.value = [...messages.value, message];
    },
    onError: (error) => {
      console.error('WebSocket错误:', error);
    },
    onConnectionReady: () => {
      console.log('WebSocket连接完毕');
      isConnectedLoading.value = false;
    },
    onConnectionClosed: () => {
      console.log('WebSocket被互踢了');
    },
    onConnectionChange: (connected) => {
      wsIsConnected.value = connected;
    },
  });
  
  wsSendMessage = ws.sendMessage;
  wsIsConnected.value = ws.isConnected.value;
};

onBeforeUnmount(() => {
  // 组件卸载时清除轮询定时器
  stopLiveStatusPolling();
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
