// 工具函数
import { billionEmoji, type BillionEmoji } from '../../const/emoji';
import numeral from 'numeral';

// 根据 name 查找 emote
export function getEmoteByName(name: string): BillionEmoji | undefined {
  return billionEmoji.find(emote => emote.name === name);
}

// 智能格式化数字
export const smartFormat = (number: string) => {
  const num = parseFloat(number);
  // 错误处理
  if (isNaN(num) || !isFinite(num)) {
    return '0';
  }
  const absNum = Math.abs(num);

  if (absNum >= 1000000000) {
    return numeral(num / 1000000000).format('0.00') + 'B'; // 十亿
  } else if (absNum >= 1000000) {
    return numeral(num / 1000000).format('0.00') + 'M'; // 百万
  } else if (absNum >= 1000) {
    return numeral(num / 1000).format('0.00') + 'K'; // 千
  }
  return numeral(num).format(`0.${'0'.repeat(2)}`);
};


/**
 * 格式化小数中间过多的0，显示为0{N}格式
 * @param value 数值字符串
 * @returns 格式化后的字符串
 */
function formatDecimalZeros(value: string): string {
  // 检查是否包含小数点
  if (!value.includes('.')) {
    return value
  }

  const [integerPart, decimalPart] = value.split('.')
  
  // 如果小数部分为空或只有0，直接返回
  if (!decimalPart || decimalPart === '0') {
    return integerPart
  }

  // 查找连续的0
  const zeroMatch = decimalPart.match(/^0+/)
  if (zeroMatch) {
    const zeroCount = zeroMatch[0].length
    const remainingDecimals = decimalPart.slice(zeroCount)
    
    // 如果连续0的数量大于等于3，使用0{N}格式
    if (zeroCount >= 3) {
      if (remainingDecimals) {
        return `${integerPart}.0{${zeroCount}}${remainingDecimals}`
      } else {
        return `${integerPart}.0{${zeroCount}}`
      }
    }
  }

  return value
}

/**
 * 限制小数位数，0{N}视为1位
 * @param value 数值字符串
 * @param maxDecimals 最大小数位数
 * @returns 限制后的字符串
 */
function limitDecimalPlaces(value: string, maxDecimals: number): string {
  // 检查是否包含小数点
  if (!value.includes('.')) {
    return value
  }

  const [integerPart, decimalPart] = value.split('.')
  
  // 如果小数部分为空，直接返回
  if (!decimalPart) {
    return integerPart
  }

  // 计算实际小数位数（0{N}视为1位）
  let actualDecimals = 0
  let processedDecimal = decimalPart
  
  // 查找0{N}模式
  const zeroPatternMatch = decimalPart.match(/^0\{(\d+)\}(.*)$/)
  if (zeroPatternMatch) {
    actualDecimals = 1 + zeroPatternMatch[2].length // 0{N}视为1位 + 后续数字位数
    processedDecimal = zeroPatternMatch[2] // 剩余的小数部分
  } else {
    // 计算普通小数位数
    actualDecimals = decimalPart.length
  }

  // 如果超过最大小数位数，进行截断
  if (actualDecimals > maxDecimals) {
    if (zeroPatternMatch) {
      // 如果有0{N}模式，保持0{N}，截断剩余部分
      const remainingDecimals = maxDecimals - 1
      if (remainingDecimals > 0) {
        processedDecimal = processedDecimal.slice(0, remainingDecimals)
        return `${integerPart}.0{${zeroPatternMatch[1]}}${processedDecimal}`
      } else {
        return `${integerPart}.0{${zeroPatternMatch[1]}}`
      }
    } else {
      // 普通小数截断
      const truncatedDecimal = decimalPart.slice(0, maxDecimals)
      return `${integerPart}.${truncatedDecimal}`
    }
  }

  return value
}

/**
 * 抹除末尾的0，但保留0{N}格式
 * @param value 数值字符串
 * @returns 抹除末尾0后的字符串
 */
function removeTrailingZeros(value: string): string {
  // 检查是否包含小数点
  if (!value.includes('.')) {
    return value
  }

  const [integerPart, decimalPart] = value.split('.')
  
  // 如果小数部分为空，直接返回整数部分
  if (!decimalPart) {
    return integerPart
  }

  // 检查是否有0{N}模式
  const zeroPatternMatch = decimalPart.match(/^0\{(\d+)\}(.*)$/)
  if (zeroPatternMatch) {
    // 对于0{N}模式，只处理后续数字的末尾0
    const remainingDecimals = zeroPatternMatch[2]
    const trimmedDecimals = remainingDecimals.replace(/0+$/, '')
    
    if (trimmedDecimals) {
      return `${integerPart}.0{${zeroPatternMatch[1]}}${trimmedDecimals}`
    } else {
      return `${integerPart}.0{${zeroPatternMatch[1]}}`
    }
  } else {
    // 普通小数，抹除末尾的0
    const trimmedDecimals = decimalPart.replace(/0+$/, '')
    
    if (trimmedDecimals) {
      return `${integerPart}.${trimmedDecimals}`
    } else {
      return integerPart
    }
  }
}

// 格式化价格
/**
 * 格式化价格，最多保留5位小数并处理中间的0
 * @param value 价格数值
 * @returns 格式化后的价格字符串
 */
export function formatPrice(value: number | string | undefined | null): string {
  if (!value || value === 0) {
    return '0'
  }

  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) {
    return '0'
  }

  // 转换为字符串，保留所有小数位
  let priceStr = num.toString()
  
  // 处理科学计数法
  if (priceStr.includes('e')) {
    // 使用 toFixed 来避免科学计数法，但需要确定合适的小数位数
    const absNum = Math.abs(num)
    if (absNum < 1e-10) {
      priceStr = num.toFixed(20) // 对于极小的数字，使用更多小数位
    } else if (absNum < 1e-5) {
      priceStr = num.toFixed(15)
    } else {
      priceStr = num.toFixed(10)
    }
  }
  // 如果priceStr 大约1，则走smartFormat逻辑
  if (parseFloat(priceStr) >= 1) {
    return smartFormat(priceStr)
  }
  // 处理小数中间过多的0，显示为0{N}格式
  priceStr = formatDecimalZeros(priceStr)
  
  // 限制小数位数最多5位，0{N}视为1位
  priceStr = limitDecimalPlaces(priceStr, 5)
  
  // 抹除末尾的0
  priceStr = removeTrailingZeros(priceStr)
  
  return priceStr
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
