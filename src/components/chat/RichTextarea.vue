<template>
  <div
    v-if="editor"
    :class="[
      'rich-textarea',
      disabled ? 'disabled' : '',
      className
    ]"
  >
    <!-- 编辑器内容 -->
    <div
      ref="editorRef"
      :class="['editor-wrapper', disabled ? 'pointer-events-none' : '']"
      @click="handleClick"
      @keydown="handleKeyDown"
      @compositionstart="handleCompositionStart"
      @compositionend="handleCompositionEnd"
    >
      <div
        :style="{
          minHeight: `${minRows * 22}px`,
          maxHeight: `${maxRows * 22}px`,
          overflow: autoSize ? 'auto' : 'visible',
        }"
      >
        <EditorContent :editor="editor" />
      </div>
      <!-- 禁用时手动显示 placeholder -->
      <div v-if="isEmpty" class="placeholder">
        {{ placeholder || t('Commit.input_placeholder') }}
      </div>
    </div>

    <!-- 底部工具栏 -->
    <div class="toolbar">
      <span :class="['text-length', isExceeded ? 'exceeded' : '']">
        {{ textLength }}/{{ maxLength }}
      </span>
        <EmojiPicker
          :show-tabs="showTabs"
          :disabled="disabled"
          @emojiSelect="handleEmojiSelect"
        />
      <slot />
      <slot name="right" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, withDefaults, defineProps, defineEmits } from 'vue';
import { useEditor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { useUIKit } from '@tencentcloud/uikit-base-component-vue3';
import { useEmoteParser } from '../../composables/useEmoteParser';
import EmojiPicker from './EmojiPicker.vue';

interface Props {
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  maxLength?: number;
  enterKey?: boolean;
  rows?: number;
  showTabs?: boolean;
  allowExceed?: boolean;
  autoSize?: boolean | { minRows: number; maxRows: number };
  onValueChange?: (value: string, selectionStart: number) => void;
  onSendMessage?: (message: string) => void;
  onExceedMaxLength?: (isExceeded: boolean, currentLength: number, maxLength: number) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  onPasteFiles?: (files: File[]) => void;
  onCompositionChange?: (isComposing: boolean) => void;
}

const emit = defineEmits<{
  valueChange: [value: string, selectionStart: number];
  sendMessage: [message: string];
  pasteFiles: [files: File[]];
  exceedMaxLength: [isExceeded: boolean, currentLength: number, maxLength: number];
  keyDown: [e: KeyboardEvent];
  compositionChange: [isComposing: boolean];
}>();

const props = withDefaults(defineProps<Props>(), {
  value: '',
  placeholder: '',
  disabled: false,
  className: '',
  maxLength: 44,
  enterKey: false,
  rows: 2,
  showTabs: true,
  allowExceed: false,
  autoSize: false,
});

const { t } = useUIKit();
const { parseTextToHTML, parseHTMLToText, getTextLength, truncateText } = useEmoteParser();

const textLength = ref(0);
const isComposing = ref(false);
const isEmpty = ref(true);
const editorRef = ref<HTMLDivElement | null>(null);
const isUpdatingFromExternalRef = ref(false);
const updateTimerRef = ref<number | null>(null);
const handleSendMessageRef = ref<(() => void) | null>(null);
const isComposingRef = ref(false);

// enterKey 为 true 时：编辑器 HTML → 带换行符的文本（</p><p>、<br> 转为 \n）
const getTextFromEditorHtml = (html: string): string => {
  if (!props.enterKey) return parseHTMLToText(html);
  const withNewlines = html
    .replace(/<\/p>\s*<p[^>]*>/gi, '</p>\n<p>')
    .replace(/<br\s*\/?>/gi, '\n');
  return parseHTMLToText(withNewlines);
};

// enterKey 为 true 时：带换行符的文本 → 编辑器 HTML（\n 转为段落）
const getHTMLFromValue = (text: string): string => {
  console.log('getHTMLFromValue', text);
  if (!props.enterKey) return parseTextToHTML(text);
  const segments = text.split('\n');
  const htmlSegments = segments.map((line) => parseTextToHTML(line));
  return htmlSegments.length > 0 ? `<p>${htmlSegments.join('</p><p>')}</p>` : '';
};

// 处理粘贴文件的函数
const handleEditorPaste = (view: any, event: ClipboardEvent): boolean => {
  if (!props.onPasteFiles || props.disabled) return false;

  const clipboardData = event.clipboardData;
  if (!clipboardData) return false;

  const items = clipboardData.items;
  const files: File[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'file') {
      const file = item.getAsFile();
      if (file) {
        if (
          file.type.startsWith('image/') ||
          file.type.startsWith('video/') ||
          file.type !== '' ||
          (file.name && file.name !== '')
        ) {
          files.push(file);
        }
      }
    }
  }

  if (files.length > 0) {
    event.preventDefault();
    event.stopPropagation();
    props.onPasteFiles?.(files);
    emit('pasteFiles', files);
    return true;
  }

  return false;
};

// 创建编辑器实例
const editor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: false,
      blockquote: false,
      horizontalRule: false,
      codeBlock: false,
    }),
    Image.configure({
      inline: true,
      allowBase64: true,
      HTMLAttributes: {
        class: 'emote-image',
      },
    }),
  ],
  content: props.value ? getHTMLFromValue(props.value) : '',
  onCreate: ({ editor: editorInstance }) => {
    console.log('Editor created, initial HTML:', editorInstance.getHTML());
  },
  editable: !props.disabled,
  onUpdate: ({ editor }) => {
    // const content = convertEditorContent(editor.getJSON());
    // console.log('onUpdate - content:', content);
  },
});

// 同步 disabled 状态到编辑器
watch(() => props.disabled, (newVal) => {
  if (editor.value) {
    editor.value.setEditable(!newVal);
  }
});

// 同步外部 value 到编辑器
watch(() => props.value, (newVal) => {
  if (editor.value && !isUpdatingFromExternalRef.value) {
    const currentText = getTextFromEditorHtml(editor.value.getHTML());
    if (newVal !== currentText) {
      isUpdatingFromExternalRef.value = true;
      const html = getHTMLFromValue(newVal || '');
      editor.value.commands.setContent(html);
      requestAnimationFrame(() => {
        isUpdatingFromExternalRef.value = false;
      });
    }
  }
});

// 计算文本长度和检查是否为空
watch(() => editor.value, (newEditor) => {
  if (newEditor) {
    let rafId: number | null = null;

    const updateTextLength = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        const html = newEditor.getHTML();
        const text = getTextFromEditorHtml(html);
        textLength.value = getTextLength(text);
        isEmpty.value = newEditor.isEmpty;
        rafId = null;
      });
    };

    updateTextLength();
    newEditor.on('update', updateTextLength);

    return () => {
      newEditor.off('update', updateTextLength);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }
}, { immediate: true });

// 检查是否超出最大长度
const isExceeded = computed(() => {
  if (!props.allowExceed || !editor.value) return false;
  const html = editor.value.getHTML();
  const text = getTextFromEditorHtml(html);
  return getTextLength(text) > props.maxLength;
});

// 监听超出状态变化
watch(isExceeded, (newVal) => {
  if (props.allowExceed) {
    props.onExceedMaxLength?.(newVal, textLength.value, props.maxLength);
    emit('exceedMaxLength', newVal, textLength.value, props.maxLength);
  }
});

// 处理发送消息
const handleSendMessage = () => {
  if (!editor.value) return;
  const html = editor.value.getHTML();
  const text = getTextFromEditorHtml(html).trim();
  if (text) {
    props.onSendMessage?.(text);
    emit('sendMessage', text);
    editor.value.commands.clearContent();
  }
};

// 更新 ref
watch(handleSendMessage, () => {
  handleSendMessageRef.value = handleSendMessage;
}, { immediate: true });

// 处理键盘事件
const handleKeyDown = (e: KeyboardEvent) => {
  if (props.onKeyDown) {
    props.onKeyDown(e);
    return;
  }

  if (e.key === 'Enter' && !props.enterKey && !e.shiftKey && !isComposing.value) {
    e.preventDefault();
    handleSendMessage();
  }
};

// 插入表情符号
const handleEmojiSelect = (emoji: any) => {
  if (!editor.value) return;

  const { from } = editor.value.state.selection;
  const html = editor.value.getHTML();
  const currentText = getTextFromEditorHtml(html);

  let textPosition = 0;
  editor.value.state.doc.nodesBetween(0, from, (node, pos) => {
    if (node.isText && node.text) {
      const nodeText = node.text;
      if (pos + node.nodeSize <= from) {
        textPosition += getTextLength(nodeText);
      } else {
        const offset = from - pos;
        textPosition += getTextLength(nodeText.substring(0, offset));
      }
    } else if (node.type.name === 'image') {
      if (pos + node.nodeSize <= from) {
        textPosition += 1;
      }
    }
    return true;
  });

  const beforeText = currentText.substring(0, textPosition);
  const afterText = currentText.substring(textPosition);
  const newText = beforeText + emoji.native + afterText;

  let finalText = newText;
  let newCursorTextPosition = textPosition + emoji.native.length;
  if (!props.allowExceed && getTextLength(newText) > props.maxLength) {
    finalText = truncateText(newText, props.maxLength);
    newCursorTextPosition = Math.min(newCursorTextPosition, finalText.length);
  }

  isUpdatingFromExternalRef.value = true;
  const finalHtml = getHTMLFromValue(finalText);
  editor.value.commands.setContent(finalHtml);

  setTimeout(() => {
    try {
      const doc = editor.value!.state.doc;
      let targetPos = 0;
      let currentTextPos = 0;

      doc.nodesBetween(0, doc.content.size, (node, pos) => {
        if (currentTextPos >= newCursorTextPosition) {
          return false;
        }

        if (node.isText && node.text) {
          const nodeText = node.text;
          const nodeTextLength = getTextLength(nodeText);
          if (currentTextPos + nodeTextLength <= newCursorTextPosition) {
            currentTextPos += nodeTextLength;
            targetPos = pos + node.nodeSize;
          } else {
            let charOffset = 0;
            for (let i = 0; i < nodeText.length; i++) {
              const char = nodeText[i];
              const charLength = getTextLength(char);
              if (currentTextPos + charLength > newCursorTextPosition) {
                break;
              }
              currentTextPos += charLength;
              charOffset++;
            }
            targetPos = pos + charOffset;
            return false;
          }
        } else if (node.type.name === 'image') {
          if (currentTextPos + 1 <= newCursorTextPosition) {
            currentTextPos += 1;
            targetPos = pos + node.nodeSize;
          } else {
            targetPos = pos;
            return false;
          }
        }

        return true;
      });

      editor.value!.commands.setTextSelection(targetPos);
    } catch (error) {
      console.error('Failed to set cursor position:', error);
      editor.value!.commands.focus('end');
    }
  }, 0);
  props.onValueChange?.(finalText, newCursorTextPosition);
  emit('valueChange', finalText, newCursorTextPosition);

  requestAnimationFrame(() => {
    isUpdatingFromExternalRef.value = false;
  });

  editor.value.chain().focus().run();
};

const handleClick = () => {
  if (!props.disabled && editor.value) {
    editor.value.chain().focus().run();
  }
};

const handleCompositionStart = () => {
  if (!props.disabled) {
    isComposing.value = true;
    isComposingRef.value = true;
    props.onCompositionChange?.(true);
    emit('compositionChange', true);
  }
};

const handleCompositionEnd = () => {
  if (!props.disabled) {
    isComposing.value = false;
    isComposingRef.value = false;
    props.onCompositionChange?.(false);
    emit('compositionChange', false);
  }
};

// 最大rows和最小rows
const minRows = computed(() => {
  return props.autoSize && typeof props.autoSize === 'object'
    ? props.autoSize.minRows
    : props.rows;
});

const maxRows = computed(() => {
  return props.autoSize && typeof props.autoSize === 'object'
    ? props.autoSize.maxRows
    : props.rows;
});

// 清理定时器
onBeforeUnmount(() => {
  if (updateTimerRef.value) {
    clearTimeout(updateTimerRef.value);
  }
  if (editor.value) {
    editor.value.destroy();
  }
});
</script>

<style lang="scss" scoped>
.rich-textarea {
  width: 100%;
  flex: 1;
  min-height: 40px;
  padding-bottom: 1.75rem;
  position: relative;
  border-radius: 0.5rem;
  padding: 0.125rem;
  background: var(--bg-color-operate, #1a1c24);

  &.disabled {
    opacity: 0.6;
  }

  &:not(.disabled) {
    border: 1px solid rgba(56, 63, 77, 0.6);

    &:hover {
      background: var(--bg-color-card, #252730);
      border-color: var(--color-primary, #1890ff);
      box-shadow: 0 0 0 1px var(--color-primary, #1890ff);
    }

    &:focus-within {
      border-color: var(--color-primary, #1890ff);
      background: var(--bg-color-card, #252730);
      box-shadow: 0 0 0 1px var(--color-primary, #1890ff);
    }
  }
}

.editor-wrapper {
  padding: 0.5rem 0.75rem 2rem;
  position: relative;
}

.placeholder {
  position: absolute;
  top: 0.5rem;
  left: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.875rem;
  pointer-events: none;
}

.toolbar {
  position: absolute;
  bottom: 0.375rem;
  right: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.text-length {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);

  &.exceeded {
    color: #ff4d4f;
  }
}

:deep(.prose) {
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.875rem;
  line-height: 1.5;

  p {
    margin: 0;
  }

  .emote-image {
    display: inline-block;
    vertical-align: middle;
    max-width: 1.5rem;
    max-height: 1.5rem;
  }
}
</style>
