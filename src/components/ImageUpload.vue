<template>
  <div class="image-upload" :class="{ disabled, 'drag-over': dragOver }">
    <div
      class="upload-container"
      :class="{ 'is-loading': isLoading, 'has-image': value}"
      :style="{ aspectRatio: aspectRatio }"
      @click="handleClick"
      @drop="handleDrop"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
    >
      <input
        ref="fileInputRef"
        type="file"
        :accept="accept"
        class="file-input"
        :disabled="disabled || isLoading"
        @change="handleFileSelect"
      />
      <!-- 加载状态 -->
      <div v-if="isLoading" class="upload-state loading-state">
        <div class="spinner"></div>
        <span class="state-text">{{ t('Uploading...') }}</span>
      </div>

      <!-- 已上传图片 -->
      <template v-else-if="value">
        <img :src="value" alt="Uploaded image" class="uploaded-image" />
        <div v-if="!disabled" class="image-overlay">
          <div class="overlay-content">
            <span class="remove-icon">✕</span>
          </div>
        </div>
        <button
          v-if="!disabled"
          type="button"
          class="remove-button"
          @click.stop="handleRemove"
        >
          <span class="remove-icon-small">✕</span>
        </button>
      </template>

      <!-- 空状态 -->
      <div v-else class="upload-state empty-state">
        <div class="upload-icon">📷</div>
        <span class="state-text">{{ placeholderText }}</span>
        <span class="hint-text">{{ t('Support paste image') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, defineProps, withDefaults, defineEmits } from 'vue';
import { TUIToast, TOAST_TYPE, useUIKit } from '@tencentcloud/uikit-base-component-vue3';
import { api } from '@/lib/api';

interface Props {
  value?: string | null;
  onChange?: (url: string | null) => void;
  onUpload?: (file: File) => Promise<string>;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  accept?: string;
  compressSize?: number; // MB，-1 表示不压缩
  maxSize?: number; // MB
  aspectRatio?: number;
}

const props = withDefaults(defineProps<Props>(), {
  value: null,
  disabled: false,
  placeholder: '',
  accept: 'image/*',
  compressSize: -1,
  maxSize: 10,
  aspectRatio: 16 / 9,
});

const emit = defineEmits<{
  'update:value': [value: string | null];
}>();

const { t } = useUIKit();
const isLoading = ref(false);
const dragOver = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);

const placeholderText = computed(() => {
  if (props.placeholder) {
    return props.placeholder;
  }
  return `${t('Click to upload image')} (${t('File size limit')}: ${props.maxSize}MB)`;
});

// 上传文件到服务器
const uploadFile = async (file: File): Promise<string | null> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

    const response = await api.room.uploadLiveCover(file);
    clearTimeout(timeoutId);
    
    return response.data || '';
  } catch (err: any) {
    console.error('上传失败:', err);
    if (err.name === 'AbortError') {
      TUIToast({
        type: TOAST_TYPE.ERROR,
        message: t('Upload timeout, please try again'),
      });
    }
    return null;
  }
};

// 压缩图片
const compressImage = (file: File): Promise<File> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      const maxWidth = 1200;
      const maxHeight = 1200;
      let { width, height } = img;

      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            resolve(file);
          }
        },
        file.type,
        0.8 // 80%质量
      );
    };

    img.src = URL.createObjectURL(file);
  });
};

// 处理上传
const handleUpload = async (file: File) => {
  if (!file) return;

  // 检查文件类型
  if (!file.type.startsWith('image/')) {
    TUIToast({
      type: TOAST_TYPE.ERROR,
      message: t('Please upload image file'),
    });
    return;
  }

  // 检查文件大小
  if (file.size > props.maxSize * 1024 * 1024) {
    TUIToast({
      type: TOAST_TYPE.ERROR,
      message: t('File size cannot exceed') + ` ${props.maxSize}MB`,
    });
    return;
  }

  // 压缩图片（如果大于指定大小）
  let fileToUpload = file;
  if (props.compressSize > 0 && file.size > props.compressSize * 1024 * 1024) {
    console.log('压缩图片');
    fileToUpload = await compressImage(file);
  }

  isLoading.value = true;
  try {
    let url: string | null = null;

    if (props.onUpload) {
      url = await props.onUpload(fileToUpload);
    } else {
      // 使用默认上传接口
      const uploadUrl = await uploadFile(fileToUpload);
      if (uploadUrl) {
        url = uploadUrl;
      } else {
        // 如果接口报错了，创建本地预览URL
        url = URL.createObjectURL(fileToUpload);
      }
      console.log('url', url)
    }

    if (url) {
      emit('update:value', url);
      props.onChange?.(url);
    }
  } catch (error) {
    console.error('上传失败:', error);
    TUIToast({
      type: TOAST_TYPE.ERROR,
      message: t('Upload failed, please try again'),
    });
  } finally {
    isLoading.value = false;
  }
};

// 选择文件
const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    handleUpload(file);
  }
  // 重置input值，允许重复选择同一文件
  if (fileInputRef.value) {
    fileInputRef.value.value = '';
  }
};

// 粘贴处理
const handlePaste = (event: ClipboardEvent) => {
  if (props.disabled || isLoading.value) return;

  const items = event.clipboardData?.items;
  if (!items) return;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) {
        handleUpload(file);
        break;
      }
    }
  }
};

// 拖拽处理
const handleDrop = (event: DragEvent) => {
  event.preventDefault();
  dragOver.value = false;

  if (props.disabled || isLoading.value) return;

  const files = event.dataTransfer?.files;
  if (files && files.length > 0) {
    handleUpload(files[0]);
  }
};

const handleDragOver = (event: DragEvent) => {
  event.preventDefault();
  dragOver.value = true;
};

const handleDragLeave = (event: DragEvent) => {
  event.preventDefault();
  dragOver.value = false;
};

// 点击上传
const handleClick = () => {
  if (!props.disabled && !isLoading.value) {
    fileInputRef.value?.click();
  }
};

// 删除图片
const handleRemove = () => {
  emit('update:value', null);
  props.onChange?.(null);
};

// 监听粘贴事件
onMounted(() => {
  if (!props.disabled) {
    document.addEventListener('paste', handlePaste);
  }
});

onBeforeUnmount(() => {
  document.removeEventListener('paste', handlePaste);
});
</script>

<style lang="scss" scoped>
@import '../TUILiveKit/assets/variable.scss';

.image-upload {
  width: 100%;
  position: relative;

  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &.drag-over {
    .upload-container {
      border-color: $color-primary;
      background-color: rgba(24, 144, 255, 0.05);
    }
  }
}

.upload-container {
  width: 100%;
  position: relative;
  border: 1px solid rgba(56, 63, 77, 0.5);
  border-radius: 0.5rem;
  overflow: hidden;
  cursor: pointer;
  background-color: #1a1c24;
  transition: all 0.2s ease;

  &:hover:not(.is-loading) {
    border-color: rgba(56, 63, 77, 1);
  }

  &.is-loading {
    cursor: wait;
  }

  &.has-image {
    .image-overlay {
      opacity: 0;
    }

    &:hover .image-overlay {
      opacity: 1;
    }
  }
}

.file-input {
  display: none;
}

.upload-state {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.loading-state {
  color: #adb6cc;

  .spinner {
    width: 2rem;
    height: 2rem;
    border: 3px solid rgba(173, 182, 204, 0.2);
    border-top-color: #adb6cc;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 0.5rem;
  }

  .state-text {
    font-size: 0.875rem;
    color: #adb6cc;
  }
}

.empty-state {
  color: #6b7280;

  .upload-icon {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }

  .state-text {
    font-size: 0.875rem;
    text-align: center;
    color: #adb6cc;
    margin-bottom: 0.25rem;
  }

  .hint-text {
    font-size: 0.75rem;
    color: #6b7280;
    margin-top: 0.25rem;
  }
}

.uploaded-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-overlay {
  position: absolute;
  inset: 0;
  background-color: rgba(0, 0, 0, 0);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;

  &:hover {
    background-color: rgba(0, 0, 0, 0.2);
  }

  .overlay-content {
    opacity: 0;
    transition: opacity 0.2s ease;

    .remove-icon {
      font-size: 1.5rem;
      color: white;
    }
  }

  &:hover .overlay-content {
    opacity: 1;
  }
}

.remove-button {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 1.5rem;
  height: 1.5rem;
  background-color: rgba(242, 60, 91, 0.5);
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: rgba(242, 60, 91, 1);
  }

  .remove-icon-small {
    font-size: 0.75rem;
    color: white;
    font-weight: bold;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
