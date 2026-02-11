<template>
  <div v-if="!isLoggedIn" :class="['login-prompt', className]">
    {{ t('Commit.need_login_first') }}
    <span class="login-link" @click="handleLogin">{{ t('Commit.login') }}</span>
    {{ t('Commit.to_start_chat') }}
  </div>
  
  <div v-else-if="isOffLine" :class="['offline-message', className]">
    {{ t('Commit.offlineMessage') }}
  </div>
  
  <div v-else-if="isBan" :class="['ban-message', className]">
    {{ t('Commit.banMessage') }}
  </div>
  
  <div v-else :class="['live-send', className]">
    <RichTextarea
      :show-tabs="showTabs"
      :max-length="maxLength"
      :auto-size="{ minRows: 2, maxRows: 4 }"
      :value="currentMessage"
      :disabled="disabled"
      @valueChange="handleValueChange"
      @sendMessage="handleSendMessage"
      @pasteFiles="handlePasteFiles"
    >
      <div
        :class="[
          'send-button',
          !currentMessage.trim() || disabled ? 'disabled' : 'enabled'
        ]"
        @click="handleSendMessage"
      >
        <span class="send-icon">↑</span>
      </div>
      <template #right>
        <slot name="right" />
      </template>
    </RichTextarea>
  </div>
</template>

<script setup lang="ts">
import { ref, withDefaults, defineProps } from 'vue';
import { useUIKit, TUIToast, TOAST_TYPE } from '@tencentcloud/uikit-base-component-vue3';
import RichTextarea from './RichTextarea.vue';

interface Props {
  showTabs?: boolean;
  isBan?: boolean;
  isOffLine?: boolean;
  disabled?: boolean;
  className?: string;
  maxLength?: number;
  onSendMessage?: (message: string) => void;
}

const props = withDefaults(defineProps<Props>(), {
  showTabs: true,
  isBan: false,
  isOffLine: false,
  disabled: false,
  className: '',
  maxLength: 250,
});

const { t } = useUIKit();
const currentMessage = ref('');
const isLoggedIn = ref(true); // TODO: 从 store 获取登录状态

const handlePasteFiles = (files: File[]) => {
  TUIToast({
    type: TOAST_TYPE.WARNING,
    message: t('richTextarea.copyRestricted'),
  });
};

const handleSendMessage = () => {
  console.log('currentMessage', currentMessage.value);
  props.onSendMessage?.(currentMessage.value);
  currentMessage.value = '';
};

const handleValueChange = (value: string) => {
  console.log('handleValueChange', value);
  currentMessage.value = value;
};

const handleLogin = () => {
  // TODO: 处理登录逻辑
  console.log('Login clicked');
};
</script>

<style lang="scss" scoped>
.live-send {
  width: 100%;
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem 0;
}

.login-prompt,
.offline-message,
.ban-message {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 0.5rem;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.5);
}

.login-link {
  color: #ff4d4f;
  cursor: pointer;
  margin: 0 0.25rem;
  transition: color 0.2s;

  &:hover {
    color: #ff7875;
  }
}

.send-button {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  transition: all 0.2s;

  &.enabled {
    background: var(--color-primary, #1890ff);
    color: white;
    cursor: pointer;

    &:hover {
      background: rgba(24, 144, 255, 0.85);
    }
  }

  &.disabled {
    background: rgba(255, 255, 255, 0.3);
    color: rgba(255, 255, 255, 0.5);
    cursor: not-allowed;
  }

  .send-icon {
    font-size: 1rem;
  }
}
</style>
