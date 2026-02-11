<template>
  <div class="emoji-picker">
    <button
      type="button"
      :class="[
        'emoji-picker-trigger',
        disabled ? 'disabled' : 'enabled'
      ]"
      @click="togglePicker"
    >
      <span class="emoji-icon">😊</span>
    </button>
    
    <div v-if="isOpen" class="emoji-picker-popover">
      <div class="emoji-picker-content">
        <div v-if="showTabs" class="emoji-picker-tabs">
          <button
            :class="['tab-button', activeTab === 'sticker' ? 'active' : '']"
            @click="activeTab = 'sticker'"
          >
            {{ t('emoji.sticker') }}
          </button>
          <button
            :class="['tab-button', activeTab === 'emoji' ? 'active' : '']"
            @click="activeTab = 'emoji'"
          >
            {{ t('emoji.emoji') }}
          </button>
        </div>
        
        <div v-if="activeTab === 'sticker'" class="sticker-grid">
          <div
            v-for="emote in billionEmoji"
            :key="emote.id"
            class="sticker-item"
            @click="handleStickerSelect(emote)"
          >
            <img
              :src="emote.url"
              :alt="getDisplayName(emote)"
              class="sticker-image"
            />
          </div>
        </div>
        
        <div v-if="activeTab === 'emoji'" class="emoji-grid">
          <!-- 简化版 emoji 选择器，可以后续集成 emoji-mart -->
          <div class="emoji-placeholder">
            {{ t('emoji.emojiPickerPlaceholder') }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, defineProps, withDefaults, defineEmits } from 'vue';
import { useUIKit } from '@tencentcloud/uikit-base-component-vue3';
import { billionEmoji, type BillionEmoji } from '../../const/emoji';

interface Props {
  disabled?: boolean;
  onEmojiSelect?: (emoji: any) => void;
  showTabs?: boolean;
}

const emit = defineEmits<{
  emojiSelect: [emoji: any];
}>();

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  showTabs: true,
});

const { t, language } = useUIKit();
const isOpen = ref(false);
const activeTab = ref<'sticker' | 'emoji'>(props.showTabs ? 'sticker' : 'emoji');

// 根据语言获取显示名称
const getDisplayName = (emote: BillionEmoji): string => {
  if (language.value === 'zh-CN') {
    return emote.nameCn;
  }
  return emote.nameEn || emote.nameCn;
};

// 当 showTabs 变化时，如果隐藏 tabs，则切换到表情符号
watch(() => props.showTabs, (newVal) => {
  if (!newVal) {
    activeTab.value = 'emoji';
  }
});

const togglePicker = () => {
  if (!props.disabled) {
    isOpen.value = !isOpen.value;
  }
};

const closePicker = () => {
  isOpen.value = false;
};

const handleStickerSelect = (emote: BillionEmoji) => {
  // 将贴纸转换为类似 emoji 的格式，使用 [name] 格式
  const emojiData = {
    native: `[${emote.name}]`,
    emote: emote,
  };
  props.onEmojiSelect?.(emojiData);
  emit('emojiSelect', emojiData);
  closePicker();
};

// 点击外部关闭
let clickOutsideHandler: ((event: MouseEvent) => void) | null = null;

onMounted(() => {
  clickOutsideHandler = (event: MouseEvent) => {
    const popover = document.querySelector('.emoji-picker-popover');
    const trigger = document.querySelector('.emoji-picker-trigger');
    if (
      popover &&
      !popover.contains(event.target as Node) &&
      !trigger?.contains(event.target as Node)
    ) {
      closePicker();
    }
  };
  document.addEventListener('click', clickOutsideHandler);
});

onBeforeUnmount(() => {
  if (clickOutsideHandler) {
    document.removeEventListener('click', clickOutsideHandler);
  }
});
</script>

<style lang="scss" scoped>
.emoji-picker {
  position: relative;
}

.emoji-picker-trigger {
  cursor: pointer;
  background: none;
  border: none;
  padding: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.5);
  transition: color 0.2s;

  &.enabled:hover {
    color: var(--color-primary, #1890ff);
  }

  &.disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .emoji-icon {
    font-size: 1.5rem;
  }
}

.emoji-picker-popover {
  position: absolute;
  bottom: 100%;
  right: 0;
  margin-bottom: 0.5rem;
  background: var(--bg-color-operate, #1a1c24);
  border: 1px solid rgba(56, 63, 77, 0.5);
  border-radius: 0.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  width: 356px;
}

.emoji-picker-content {
  padding: 0.75rem;
}

.emoji-picker-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(56, 63, 77, 0.5);
}

.tab-button {
  padding: 0.25rem 0.75rem;
  background: transparent;
  border: 1px solid rgba(56, 63, 77, 0.5);
  border-radius: 0.25rem;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(56, 63, 77, 0.3);
  }

  &.active {
    background: var(--color-primary, #1890ff);
    border-color: var(--color-primary, #1890ff);
    color: white;
  }
}

.sticker-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.25rem;
  max-height: 300px;
  overflow-y: auto;
}

.sticker-item {
  aspect-ratio: 1;
  padding: 0.25rem;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgba(56, 63, 77, 0.3);
  }
}

.sticker-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 0.125rem;
}

.emoji-grid {
  max-height: 300px;
  overflow-y: auto;
}

.emoji-placeholder {
  padding: 2rem;
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
}
</style>
