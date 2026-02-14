<template>
  <div v-if="isOffLine || messages.length === 0" class="empty-message">
    {{ t('liveDetail.noMessages') }}
  </div>
  <template v-else>
    <template v-for="(item, index) in messagesWithHTML" :key="index">
      <div
        v-if="!item.isNewMessage"
        :class="[
          'message-item',
          {
            'gradient-bg': ['8', '6'].includes(String(item.messageType || '')),
          }
        ]"
      >
      <!-- 回复内容 -->
      <div v-if="item.replyContent" class="reply-content">
        <span class="reply-icon">↩</span>
        {{ t('liveDetail.replyingTo') }}
        <span class="reply-user-name" :title="item.replyContent.userName">
          {{ item.replyContent.userName }}
        </span>
        <span class="reply-text" :title="item.replyContent.content">
          : {{ item.replyContent.content }}
        </span>
      </div>

      <!-- 消息类型 9: 交易消息 -->
      <div v-if="item.messageType === '9'" class="trade-message">
        <span class="broadcaster-label">{{ t('liveDetail.broadcaster') }}</span>
        <span class="trade-type">
          {{ item.content?.isMarket ? t('liveDetail.marketPrice') : t('perps.limit') }}
          <span v-if="item.content?.side === 'Long'">{{ t('liveDetail.buyOpen') }}</span>
          <span v-if="item.content?.side === 'Short'">{{ t('liveDetail.sellOpen') }}</span>
          <span v-if="item.content?.side === 'CloseLong'">{{ t('liveDetail.sellClose') }}</span>
          <span v-if="item.content?.side === 'CloseShort'">{{ t('liveDetail.buyClose') }}</span>
        </span>
        <CryptoIcon
          :coin="{
            coinSymbol: item.content?.symbol || '',
            coinIcon: item.content?.icon || '',
          }"
          :size="4"
          class="crypto-icon"
        />
        <span class="trade-amount">
          {{ item.content?.symbol || '' }} x {{ item.content?.amount || '' }}
        </span>
      </div>

      <!-- 消息类型 8, 6: Swap 消息 -->
      <LiveSwapMessage
        v-if="['8', '6'].includes(String(item.messageType || ''))"
        :room-info="roomInfo"
        :content="item.content"
      />

      <!-- 消息类型 5: 礼物消息 -->
      <div v-if="String(item.messageType) === '5'" class="gift-message">
        <UserLevel :level="item?.consumeLevel" :is-dark-mode="!item?.lighted" />
        <span
          class="user-name-link"
          @click="handleUserClick(item?.content?.userId)"
        >
          {{ item.userName || t('liveDetail.defaultUserName') }}
        </span>
        <span class="sent-label">{{ t('liveDetail.sent') }}</span>
        <img
          :src="item.content?.giftGif || item.content?.giftImg || ''"
          :alt="getLangName(item.content?.giftName, item.content?.giftNameEn) || ''"
          class="gift-image"
        />
        <span class="gift-info">
          {{ getLangName(item.content?.giftName, item.content?.giftNameEn) }} x {{ item.content?.giftQuantity || 0 }}
        </span>
      </div>

      <!-- 消息类型 1: 普通消息 -->
      <template v-if="item.messageType === '1'">
        <div :class="['message-content', { 'reply-indent': item.replyContent }]">
          <UserLevel
            class="user-level"
            :level="item?.consumeLevel"
            :is-dark-mode="!item?.lighted"
          />
          <template v-if="item.isSuperAdmin">
            <span class="super-admin-tag">{{ t('liveDetail.superAdmin') }}</span>
            <span class="official-label">{{ t('liveDetail.official') }}：</span>
          </template>
          <template v-else>
            <span
              v-if="Number(roomInfo?.userId) === Number(item.userId)"
              class="broadcaster-tag"
            >
              {{ t('liveDetail.broadcaster') }}
            </span>
            <span
              v-if="Number(userId) === Number(item.userId)"
              class="self-tag"
            >
              {{ t('dynamic.comment.self') }}
            </span>
            <span
              class="user-name-link"
              @click="handleUserClick(item?.userId)"
            >
              {{ item.userName }}：
            </span>
          </template>
          <span class="message-text">
            <template v-for="(content, idx) in item.parsedContent" :key="idx">
              <img
                v-if="getEmoteByName(content.text)"
                :src="getEmoteByName(content.text)?.url"
                :alt="content.text"
                :class="[
                  'emote-image',
                  item.parsedContent.length > 1 ? 'emote-small' : 'emote-medium'
                ]"
                :data-emote-id="getEmoteByName(content.text)?.id"
                :data-emote-name="getEmoteByName(content.text)?.name"
              />
              <span v-else>{{ content.text }}</span>
            </template>
          </span>
        </div>
        <div
          v-if="!item.isSuperAdmin && isLive && !isMobile"
          class="reply-button"
          @click="handleReply(item)"
        >
          <span>{{ t('liveDetail.reply') }}</span>
        </div>
      </template>
      </div>
      
      <!-- 新消息提示 -->
      <div v-if="item.isNewMessage" class="new-message-notice">
        <div class="notice-divider">
          <i class="divider-line"></i>
          {{ t('liveDetail.notice') }}
          <i class="divider-line"></i>
        </div>
        <span class="welcome-message">{{ t('liveDetail.welcomeMessage') }}</span>
      </div>
    </template>
  </template>
</template>

<script setup lang="ts">
import { computed, ref, defineProps, defineEmits } from 'vue';
import { useUIKit } from '@tencentcloud/uikit-base-component-vue3';
import LiveSwapMessage from './Swap.vue';
import UserLevel from './UserLevel.vue';
import CryptoIcon from './CryptoIcon.vue';
import { useEmoteParser } from '@/composables/useEmoteParser';
import { getLangName } from './utils';

interface WebSocketMessage {
  messageType?: string | number;
  content?: any;
  userName?: string;
  userId?: string | number;
  replyContent?: {
    userName: string;
    content: string;
  };
  isNewMessage?: boolean;
  isSuperAdmin?: boolean;
  consumeLevel?: number;
  lighted?: boolean;
  parsedContent?: Array<{
    type: 'text' | 'emoji';
    text: string;
  }>;
}

interface Props {
  isOffLine: boolean;
  roomInfo: {
    userId?: number | string;
  };
  isLive: boolean;
  setReplyMessage?: (message: WebSocketMessage) => void;
  messages: WebSocketMessage[];
}

const emit = defineEmits<{
  (e: 'reply', message: WebSocketMessage): void;
}>();

const props = defineProps<Props>();
const { t, language } = useUIKit();
const { parseTextToArray, getEmoteByName } = useEmoteParser();

// 获取当前用户ID（需要从store或props传入）
const userId = ref<string | number | null>(null);
const isMobile = ref(false);

// 使用 computed 缓存消息内容的 HTML 解析结果
const messagesWithHTML = computed(() => {
  return props.messages.map(item => ({
    ...item,
    parsedContent: item.content ? parseTextToArray(item.content) : []
  }));
});

const handleUserClick = (userId?: string | number) => {
  if (userId) {
    window.open(`/profile/detail?id=${userId}`, '_blank');
  }
};

const handleReply = (message: WebSocketMessage) => {
  emit('reply', message);
};
</script>

<style lang="scss" scoped>
.empty-message {
  text-align: center;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.message-item {
  position: relative;
  font-size: 0.75rem;
  display: flex;
  flex-direction: column;
  padding: 0.25rem 0.5rem;
  margin: 0.25rem 0;
  border-radius: 0.5rem;
  transition: all 0.3s;
  word-break: break-all;
  backdrop-filter: blur(4px);

  &:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }

  &.gradient-bg {
    background: linear-gradient(to right, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.15));
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
}

.reply-content {
  display: flex;
  align-items: center;
  font-size: 0.75rem;
  line-height: 1rem;
  color: rgba(255, 255, 255, 0.7);
}

.reply-icon {
  width: 0.75rem;
  height: 0.75rem;
  margin-right: 0.25rem;
}

.reply-user-name {
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  max-width: 6.25rem;
  margin-left: 0.25rem;
}

.reply-text {
  flex: 1 1 auto;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

.trade-message {
  position: relative;
  display: flex;
  border-radius: 0.25rem;
  padding: 0.25rem 0;
  font-size: 0.75rem;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
  color: #1890FF;
}

.broadcaster-label {
  border-radius: 0.125rem;
  color: #f97316;
  font-weight: bold;
}

.trade-type {
  color: #1890FF;
  font-weight: bold;
}

.crypto-icon {
  border: 1px solid white;
}

.trade-amount {
  color: #1890FF;
  font-weight: 500;
}

.gift-message {
  position: relative;
  display: flex;
  border-radius: 0.25rem;
  min-height: 1.125rem;
  font-size: 0.75rem;
  gap: 0.25rem;
  align-items: center;
  flex-wrap: wrap;
  word-break: break-all;
}

.user-name-link {
  border-radius: 0.125rem;
  color: #f97316;
  font-weight: bold;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}

.sent-label {
  color: #1890FF;
  font-weight: bold;
}

.gift-image {
  width: 1.125rem;
  height: 1.125rem;
}

.gift-info {
  font-size: 0.75rem;
  color: #1890FF;
  font-weight: 500;
}

.message-content {
  position: relative;
  border-radius: 0.25rem;

  &.reply-indent {
    margin-left: 1rem;
    padding-top: 0.25rem;
  }
}

.user-level {
  margin-right: 0.25rem;
  vertical-align: middle;
}

.super-admin-tag,
.broadcaster-tag,
.self-tag {
  border-radius: 9999px;
  padding: 0.125rem 0.375rem;
  background-color: rgba(255, 255, 255, 0.1);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.5625rem;
  height: 1rem;
  margin-right: 0.25rem;
}

.official-label {
  font-size: 0.75rem;
  border-radius: 0.125rem;
  color: rgba(255, 255, 255, 0.75);
  font-weight: bold;
}

.message-text {
  color: var(--text-color-primary, #ffffff);
  vertical-align: middle;
  line-height: 1.125rem;
  word-break: break-all;
  font-size: 0.75rem;
}

.emote-image {
  cursor: pointer;
  vertical-align: middle;

  &.emote-small {
    width: 1rem;
    height: 1rem;
  }

  &.emote-medium {
    width: 1.25rem;
    height: 1.25rem;
  }
}

.reply-button {
  opacity: 0;
  border-radius: 0 0.5rem 0.5rem 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.5rem;
  flex-direction: column;
  gap: 0.25rem;
  transition: all 0.3s;
  flex-wrap: wrap;
  color: var(--text-color-primary);
  background-color: var(--bg-color-topbar);

  .message-item:hover & {
    opacity: 1;
  }
}

.reply-icon-btn {
  width: 1rem;
  height: 1rem;
  flex: none;
}

.new-message-notice {
  display: flex;
  flex-direction: column;
  color: rgba(255, 255, 255, 0.75);
  padding-bottom: 0.5rem;
}

.notice-divider {
  display: flex;
  align-items: center;
  font-size: 0.75rem;
  gap: 1rem;
  padding: 0.5rem 0;
}

.divider-line {
  background-color: rgba(255, 255, 255, 0.5);
  height: 1px;
  flex: 1 1 auto;
}

.welcome-message {
  font-size: 0.75rem;
}
</style>
