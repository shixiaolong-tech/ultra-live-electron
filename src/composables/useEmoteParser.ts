import { getEmoteByName } from '../components/message/utils';

// HTML 转义函数
const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

/**
 * Emote 解析器 composable
 * 提供文本和 HTML 之间的转换功能，支持 [name] 格式
 */
export function useEmoteParser() {
  // 判断消息是否只包含一个 emote 格式 [name]
  const isOnlyEmoji = (text: string): boolean => {
    if (!text || text.trim().length === 0) {
      return false;
    }

    // 移除所有空白字符（空格、换行、制表符等）
    const textWithoutWhitespace = text.replace(/\s/g, '');

    if (textWithoutWhitespace.length === 0) {
      return false;
    }

    // 匹配 emote 格式：[name]
    const emoteRegex = /^\[([^\]]+)\]$/;
    const match = textWithoutWhitespace.match(emoteRegex);

    if (!match) {
      return false;
    }

    // 验证是否是有效的 emote name
    const emoteName = match[1];
    return getEmoteByName(emoteName) !== undefined;
  };

  // 将文本中的 [name] 转换为 HTML（包含图片）
  const parseTextToHTML = (text: string, largeSize = 'emote-image-medium'): string => {
    const onlyEmoji = isOnlyEmoji(text);
    const sizeClass = onlyEmoji ? largeSize : '';
    // 匹配 [name] 格式
    const emoteRegex = /\[([^\]]+)\]/g;

    let html = '';
    let lastIndex = 0;
    let match;

    while ((match = emoteRegex.exec(text)) !== null) {
      // 添加匹配前的文本
      html += escapeHtml(text.substring(lastIndex, match.index));

      const emoteName = match[1];
      const emote = getEmoteByName(emoteName);

      if (emote) {
        // 添加图片标签
        html += `<img src="${emote.url}" alt="${emote.name}" class="emote-image emote-image-small ${sizeClass}" data-emote-id="${emote.id}" data-emote-name="${emote.name}" />`;
      } else {
        // 如果找不到对应的 emote，保留原始文本
        html += escapeHtml(match[0]);
      }

      lastIndex = match.index + match[0].length;
    }

    // 添加剩余的文本
    html += escapeHtml(text.substring(lastIndex));

    return html;
  };

  // 将 HTML（包含图片）转换回文本格式 [name]
  const parseHTMLToText = (html: string): string => {
    if (!html || html.trim() === '' || html === '<p></p>' || html === '<p><br></p>') {
      return '';
    }
    
    // 创建一个临时 DOM 元素来解析 HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // 遍历所有节点
    let text = '';
    const walkNodes = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent || '';
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        if (element.tagName === 'IMG' && element.classList.contains('emote-image')) {
          // 优先从 data-emote-name 获取
          let emoteName = element.getAttribute('data-emote-name');

          // 如果没有 data 属性，尝试从 alt 属性匹配
          if (!emoteName) {
            const alt = element.getAttribute('alt');
            if (alt) {
              const emote = getEmoteByName(alt);
              if (emote) {
                emoteName = emote.name;
              }
            }
          }

          // 如果还是没有，尝试从 src URL 匹配
          if (!emoteName) {
            const src = element.getAttribute('src');
            if (src) {
              // 移除查询参数和锚点，只比较基础 URL
              const baseUrl = src.split('?')[0].split('#')[0];
              const emote = getEmoteByName(''); // 这里需要根据 URL 查找，暂时简化
              // 实际应该实现 getEmoteByUrl 函数
            }
          }

          // 如果找到了 emote 信息，转换为文本格式 [name]
          if (emoteName) {
            text += `[${emoteName}]`;
          } else {
            // 如果没有找到 emote，尝试从 alt 获取原始 emoji 字符
            const alt = element.getAttribute('alt');
            if (alt) {
              text += alt;
            }
          }
        } else {
          // 递归处理子节点
          Array.from(node.childNodes).forEach(walkNodes);
        }
      }
    };

    Array.from(temp.childNodes).forEach(walkNodes);
    return text;
  };

  // 计算文本的显示长度，将 [name] 格式的 emote 算作 2 个字符
  const getTextLength = (text: string): number => {
    if (!text) return 0;

    // 匹配 [name] 格式
    const emoteRegex = /\[([^\]]+)\]/g;
    let length = 0;
    let lastIndex = 0;
    let match;

    while ((match = emoteRegex.exec(text)) !== null) {
      // 添加匹配前的文本长度
      length += match.index - lastIndex;

      // 检查是否是有效的 emote
      const emoteName = match[1];
      const emote = getEmoteByName(emoteName);

      if (emote) {
        // 有效的 emote 算作 2 个字符
        length += 2;
      } else {
        // 无效的 emote 标记，按实际长度计算
        length += match[0].length;
      }

      lastIndex = match.index + match[0].length;
    }

    // 添加剩余的文本长度
    length += text.length - lastIndex;

    return length;
  };

  // 将文本按照 [name] 格式切割成数组
  const parseTextToArray = (text: string): Array<{ text: string; type: 'text' | 'emoji' }> => {
    if (!text) return [];

    // 确保 text 是字符串类型
    const textStr = typeof text === 'string' ? text : String(text);
    if (!textStr) return [];

    const result: Array<{ text: string; type: 'text' | 'emoji' }> = [];
    // 匹配 [name] 格式
    const emoteRegex = /\[([^\]]+)\]/g;

    let lastIndex = 0;
    let match;

    while ((match = emoteRegex.exec(textStr)) !== null) {
      // 添加匹配前的文本
      const textBefore = textStr.substring(lastIndex, match.index);
      if (textBefore) {
        result.push({
          text: textBefore,
          type: 'text',
        });
      }

      // 添加 emoji
      const emoteName = match[1];
      result.push({
        text: emoteName,
        type: 'emoji',
      });

      lastIndex = match.index + match[0].length;
    }

    // 添加剩余的文本
    const remainingText = textStr.substring(lastIndex);
    if (remainingText) {
      result.push({
        text: remainingText,
        type: 'text',
      });
    }

    return result;
  };

  // 截取文本到指定显示长度，确保不破坏 emote 格式
  const truncateText = (text: string, maxLength: number): string => {
    if (!text || getTextLength(text) <= maxLength) {
      return text;
    }

    // 匹配 [name] 格式，记录所有 emote 的位置
    const emoteRegex = /\[([^\]]+)\]/g;
    const emoteRanges: Array<{ start: number; end: number; isEmote: boolean }> = [];
    let match;

    while ((match = emoteRegex.exec(text)) !== null) {
      const emoteName = match[1];
      const emote = getEmoteByName(emoteName);
      emoteRanges.push({
        start: match.index,
        end: match.index + match[0].length,
        isEmote: emote !== undefined,
      });
    }

    // 从末尾开始截取，但要避免破坏 emote
    let result = text;
    let currentLength = getTextLength(result);

    while (currentLength > maxLength && result.length > 0) {
      // 找到最后一个字符的位置
      const lastCharIndex = result.length - 1;

      // 检查这个字符是否在某个 emote 范围内
      const containingEmote = emoteRanges.find(
        range => lastCharIndex >= range.start && lastCharIndex < range.end
      );

      if (containingEmote && containingEmote.isEmote) {
        // 如果是在 emote 范围内，删除整个 emote
        result = result.substring(0, containingEmote.start) + result.substring(containingEmote.end);
        // 重新计算 emote 位置（因为文本改变了）
        const newEmoteRegex = /\[([^\]]+)\]/g;
        emoteRanges.length = 0;
        let newMatch;
        while ((newMatch = newEmoteRegex.exec(result)) !== null) {
          const newEmoteName = newMatch[1];
          const newEmote = getEmoteByName(newEmoteName);
          emoteRanges.push({
            start: newMatch.index,
            end: newMatch.index + newMatch[0].length,
            isEmote: newEmote !== undefined,
          });
        }
      } else {
        // 普通字符，直接删除
        result = result.slice(0, -1);
      }

      currentLength = getTextLength(result);
    }

    return result;
  };

  return {
    parseTextToHTML,
    parseHTMLToText,
    isOnlyEmoji,
    getTextLength,
    truncateText,
    parseTextToArray,
    getEmoteByName,
  };
}
