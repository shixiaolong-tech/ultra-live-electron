<template>
  <div ref="containerRef" class="live-message-input">
    <div
      :class="['message-input-container', containerClass, disabledAndPlaceholder.disabled && 'disabled']"
      :style="containerStyle"
    >
      <TextEditor
        style="width: 100%; height: 100%"
        :placeholder="disabledAndPlaceholder.placeholder"
        :disabled="disabledAndPlaceholder.disabled"
        :autoFocus="autoFocus"
        :maxLength="maxLength"
        @focus="emit('focus')"
        @blur="emit('blur')"
        @change="handleChange"
        @send="handleSend"
      >
        <template #prefix>
          <div class="input-actions">
            <EmojiPicker
              :disabled="disabledAndPlaceholder.disabled"
              :trigger-style="{ display: 'flex' }"
            />
          </div>
        </template>
      </TextEditor>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineProps, withDefaults, defineEmits, ref } from 'vue';
import { useUIKit } from '@tencentcloud/uikit-base-component-vue3';
import {
  useLiveAudienceState,
  useLoginState,
} from 'tuikit-atomicx-vue3-electron';
import { EmojiPicker } from './EmojiPicker';
import TextEditor from './TextEditor/TextEditor.vue';
import type { InputContent } from './type';
import { useMessageInputState } from './MessageInputState';

const emit = defineEmits<{
  (e: 'focus'): void;
  (e: 'blur'): void;
  (e: 'change', content: InputContent[]): void;
  (e: 'send', content: InputContent[]): void;
}>();
const { t } = useUIKit();
const { focusEditor } = useMessageInputState();
const containerRef = ref<HTMLElement | null>(null);
const { loginUserInfo } = useLoginState();
const { audienceList } = useLiveAudienceState();

interface Props {
  containerClass?: string;
  containerStyle?: Record<string, any>;
  width?: string;
  height?: string;
  minHeight?: string;
  maxHeight?: string;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
}

const props = withDefaults(defineProps<Props>(), {
  containerClass: '',
  containerStyle: () => ({}),
  height: '',
  minHeight: '40px',
  maxHeight: '140px',
  disabled: false,
  autoFocus: true,
  maxLength: 80,
});

const containerStyle = computed(() => {
  const defaultStyle: Record<string, any> = {
    minHeight: props.minHeight,
    maxHeight: props.maxHeight,
  };

  if (props.height) {
    defaultStyle.height = props.height;
  }

  if (props.width) {
    defaultStyle.width = props.width;
  }

  return { ...defaultStyle, ...props.containerStyle };
});

const disabledAndPlaceholder = computed(() => {
  const localUser = audienceList.value.find(item => item.userId === loginUserInfo.value?.userId);
  return {
    disabled: props.disabled || localUser?.isMessageDisabled,
    placeholder: localUser?.isMessageDisabled ? t('You have been muted') : props.placeholder,
  };
});

const handleChange = (content: InputContent[]) => {
  if (document.activeElement && containerRef.value && !containerRef.value.contains(document.activeElement)) {
    focusEditor();
  }
  emit('change', content);
};

const handleSend = (content: InputContent[]) => {
  // 发送消息
  emit('send', content);
};
</script>

<style lang="scss" scoped>
.live-message-input {
  width: 100%;

  .message-input-container {
    position: relative;
    display: flex;
    align-items: stretch;
    background-color: var(--bg-color-operate);
    border: 2px solid var(--stroke-color-primary);
    border-radius: 8px;
    padding: 6px 16px;
    overflow: auto;
    box-sizing: border-box;

    &:focus-within {
      border-color: var(--text-color-link);
    }

    .input-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-right: 12px;
      flex-shrink: 0;

      .send-button {
        padding: 8px 20px;
        background: var(--text-color-link);
        color: var(--text-color-primary);
        border: none;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s ease;
        min-width: 60px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;

        &:hover {
          background: var(--text-color-link-hover);
        }

        &:active {
          background: var(--text-color-link-active);
        }

        &:disabled {
          background: var(--text-color-disabled);
          cursor: not-allowed;
        }
      }
    }
  }

  .disabled {
    cursor: not-allowed;
    user-select: none;
  }
}
</style>
