<template>
  <div class="main-right-bottom">
    <div class="main-right-bottom-header">
      <div class="main-right-bottom-title card-title">
        {{ t("Barrage list") }}
      </div>
    </div>
    <div class="message-list-container">
      <MessageList :isLive="true" :messages="messages" @reply="handleReply" />
    </div>
    <div class="message-input-container">
      <div v-if="replyMessage" class="reply-preview">
        <div class="reply-preview-header">
          <span>回复：{{ replyMessage.userName }}</span>
          <div
            class="reply-preview-header-close"
            @click="handleClearReplyMessage"
          >
            <CloseIcon />
          </div>
        </div>
        <div class="reply-preview-content">
          {{ replyMessage.content }}
        </div>
      </div>
      <BarrageInput
        height="56px"
        :placeholder="isInLive ? '' : t('Live not started')"
        @send="handleSendMessage"
      />
    </div>
  </div>
</template>
  
<script setup lang='ts'>
import { onMounted, computed, ref, defineProps, watch } from 'vue';
import { useUIKit } from '@tencentcloud/uikit-base-component-vue3';
import { useLiveListState } from 'tuikit-atomicx-vue3-electron';
import MessageList from '@/components/message/List.vue';
import CloseIcon from '@/TUILiveKit/common/icons/CloseIcon.vue';
import { BarrageInput } from '@/components/BarrageInput';
import {
  MessageContentType,
  type InputContent,
} from '@/components/BarrageInput/type';
import { api } from '@/lib/api';
import {
  useWebSocket,
  type WebSocketMessage,
} from '@/composables/useWebSocket';

const props = defineProps<{
  roomId: string;
  userId: string;
}>();
const { t, language } = useUIKit();

console.log('language', language)
// 连麦-连麦列表
const { currentLive } = useLiveListState();
const isInLive = computed(() => !!currentLive.value?.liveId);
// 消息相关状态
const messages = ref<WebSocketMessage[]>([]);
const replyMessage = ref<WebSocketMessage | null>(null);
const totalPage = ref(0);
const isConnectedLoading = ref(true);
const userToken = ref<string | null>(null);
const isPushingLive = ref(false);
// 发送消息
const handleSendMessage = (content: InputContent[]) => {
  const currentMessage = content
    .map((item) => {
      if (item.type === MessageContentType.TEXT) {
        return item.content;
      }
      if (item.type === MessageContentType.EMOJI) {
        return item?.content?.key;
      }
      return '';
    })
    .join('');
  console.log('发送信息', currentMessage);
  if (currentMessage.trim()) {
    // 拼接一下
    const message = {
      content: currentMessage,
      replyContent: replyMessage.value,
    };
    wsSendMessage.value?.(JSON.stringify(message));
    replyMessage.value = null;
  }
};

const handleReply = (message: WebSocketMessage) => {
  replyMessage.value = message;
};

const handleClearReplyMessage = () => {
  replyMessage.value = null;
};
// 格式化消息内容
const formatMessageContent = (list: any[]) => {
  const orderInfoList = list
    .filter((item: any) => item.messageType === '8')
    .reverse();
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
        formatContent =
          typeof item.content === 'string'
            ? JSON.parse(item.content)
            : item.content;
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
  if (!props.roomId) {
    return;
  }
  try {
    const res = await api.room.selectRoomChatList({
      page: 1,
      limit: 1000,
      roomId: Number(props.roomId),
    });

    // 是否在直播
    const isLive = isInLive.value;
    totalPage.value = res.data?.totalPage || 0;
    // 消息格式处理
    const { messagesList } = formatMessageContent(res.data?.list || []);
    // 第一次加载的时候，将最后一条插入isNewMessage
    messages.value = [...(messagesList || []), ...messages.value];
    if (isLive && messagesList && messagesList.length > 0) {
      // 检查是否已经存在 isNewMessage 为 true 的消息
      const hasNewMessageMarker = messages.value.some(
        (msg) => msg.isNewMessage === true
      );
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
const wsSendMessage = ref<((content: string) => void) | null>(null);
const wsIsConnected = ref(false);

// 初始化 WebSocket
const initWebSocket = () => {
  if (!props.roomId) {
    return;
  }

  // 获取 token
  const token = window.localStorage.getItem('billion-live-token') || userToken.value || '';
  const userId = props.userId || '';
  console.log('userId', userId)
  const ws = useWebSocket({
    autoReconnect: false,
    isLive: true,
    roomId: String(props.roomId),
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

  wsSendMessage.value = ws.sendMessage;
  wsIsConnected.value = ws.isConnected.value;
};

watch(isInLive, (newVal) => {
  isPushingLive.value = newVal;
}, 
{
  immediate: true,
  deep: true,
});

onMounted(async () => {
  try {
    // 通过 billion-liveResult 里面的 roomId 进行入口判断
    // 注意：liveParams.value.liveId 是从 liveResultInfo.value?.roomId 计算出来的
    // 所以这里直接使用 roomId 来判断
    if (props.roomId ) {
      // 初始化 WebSocket 和聊天列表
      initWebSocket();
      // 加载聊天列表
      await selectRoomChatList();
    }
  } catch (e) {
    console.error('获取直播间聊天列表失败:', e);
  }
});
</script>
  
<style lang="scss" scoped>
@import "@/TUILiveKit/assets/mac.scss";

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
</style>
  