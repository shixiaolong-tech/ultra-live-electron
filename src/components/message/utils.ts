// 工具函数
import { billionEmoji, type BillionEmoji } from '../../const/emoji';

// 根据 name 查找 emote
export function getEmoteByName(name: string): BillionEmoji | undefined {
  return billionEmoji.find(emote => emote.name === name);
}

// 格式化价格
export function formatPrice(price: number): string {
  if (price < 0.01) {
    return '< 0.01';
  }
  if (price >= 1000000) {
    return (price / 1000000).toFixed(2) + 'M';
  }
  if (price >= 1000) {
    return (price / 1000).toFixed(2) + 'K';
  }
  return price.toFixed(2);
}

// 转换地址显示
export function convertAddress(str?: string): string {
  if (!str) return '';
  if (str.length <= 10) return str;
  return str.substring(0, 6) + '...' + str.substring(str.length - 4);
}

// 获取语言名称
export function getLangName(name?: string, nameEn?: string, lang = 'zh-CN'): string {
  if (lang === 'zh-CN') {
    return name || nameEn || '';
  }
  return nameEn || name || '';
}

// 解析文本为数组（表情符号处理）
export function parseTextToArray(text: string): Array<{ type: 'text' | 'emoji'; text: string }> {
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
}
