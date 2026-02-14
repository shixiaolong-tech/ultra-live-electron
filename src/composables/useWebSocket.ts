import { ref, onBeforeUnmount, watch } from 'vue';
import { getWebSocketEndpoint } from '../lib/api';

export interface WebSocketMessage {
  type: string;
  content?: string | object | any;
  messageType?: string;
  voiceLength?: number | null;
  avatar?: string | null;
  userName?: string;
  userId?: string | number;
  timestamp?: number;
  replyContent?: WebSocketMessage;
  isNewMessage?: boolean;
  isSuperAdmin?: boolean;
  consumeLevel?: number;
  lighted?: boolean;
  stopSecond?: number;
}

export interface WebSocketError {
  type: 'error';
  message: string;
  code: string;
}

export interface UseWebSocketOptions {
  roomId: string;
  isLive?: boolean;
  userId?: string;
  token?: string;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: WebSocketError) => void;
  onConnectionClosed?: () => void;
  onConnectionChange?: (isConnected: boolean) => void;
  onConnectionReady?: () => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  heartbeatInterval?: number;
}

const HEARTBEAT_INTERVAL = 3000; // 3秒心跳
const DEFAULT_RECONNECT_INTERVAL = 3000; // 3秒重连间隔

export function useWebSocket({
  isLive = true,
  roomId,
  userId = 'guest',
  token,
  onMessage,
  onError,
  onConnectionClosed,
  onConnectionChange,
  onConnectionReady,
  autoReconnect = true,
  reconnectInterval = DEFAULT_RECONNECT_INTERVAL,
  heartbeatInterval = HEARTBEAT_INTERVAL,
}: UseWebSocketOptions) {
  const isConnected = ref(false);
  const error = ref<string | null>(null);
  const wsRef = ref<WebSocket | null>(null);
  const heartbeatRef = ref<number | null>(null);
  const reconnectRef = ref<number | null>(null);
  const statsIntervalRef = ref<number | null>(null);

  const isGuest = userId === 'guest';

  // 清除错误
  const clearError = () => {
    error.value = null;
  };

  // 发送消息
  const sendMessage = (content: string) => {
    console.log('sendMessage', content, wsRef.value, wsRef.value?.readyState, isGuest);
    if (!wsRef.value || wsRef.value.readyState !== WebSocket.OPEN) {
      error.value = 'WebSocket连接未建立';
      return;
    }

    if (isGuest) {
      error.value = '游客用户不能发言，请先登录';
      return;
    }

    const message: WebSocketMessage = {
      type: '1',
      content,
      messageType: '1',
      voiceLength: null,
      avatar: null,
    };
    console.log('message', message);
    try {
      wsRef.value.send(JSON.stringify(message));
    } catch (err) {
      error.value = '发送消息失败';
      console.error('发送消息失败:', err);
    } finally {
      console.log('sendMessage-发送消息成功');
    }
  };

  // 开始心跳
  const startHeartbeat = () => {
    if (heartbeatRef.value) {
      clearInterval(heartbeatRef.value);
    }

    heartbeatRef.value = window.setInterval(() => {
      if (wsRef.value && wsRef.value.readyState === WebSocket.OPEN) {
        wsRef.value.send('HeartBeat');
      }
    }, heartbeatInterval);
  };

  // 停止心跳
  const stopHeartbeat = () => {
    if (heartbeatRef.value) {
      clearInterval(heartbeatRef.value);
      heartbeatRef.value = null;
    }
  };

  // 处理WebSocket消息
  const handleMessage = (event: MessageEvent) => {
    const data = event.data;
    // 处理心跳响应
    if (data === 'HeartBeat') {
      return;
    }
    try {
      const parsedData = JSON.parse(data);
      console.log('接受消息', JSON.stringify(parsedData));

      if (parsedData.type === 'error') {
        const errorObj: WebSocketError = {
          type: 'error',
          message: parsedData.message,
          code: parsedData.code,
        };

        error.value = errorObj.message;
        onError?.(errorObj);

        // 如果是游客用户发言被拒绝，可以触发登录提示
        if (errorObj.code === 'GUEST_NO_PERMISSION') {
          console.warn('游客用户不能发言，请先登录');
        }
      } else if (['1'].includes(parsedData.type)) {
        // 处理聊天消息
        const content =
          typeof parsedData.content === 'string'
            ? JSON.parse(parsedData.content)
            : parsedData.content;
        console.log('content', content);
        const message: WebSocketMessage = {
          type: parsedData.type,
          content: content?.content,
          replyContent: content?.replyContent || null,
          isSuperAdmin: content?.isSuperAdmin || false,
          consumeLevel: ('consumeLevel' in content) ? content.consumeLevel : (parsedData.consumeLevel || 1),
          lighted: ('lighted' in content) ? content.lighted : (parsedData.lighted || false),
          messageType: parsedData.type,
          voiceLength: parsedData.voiceLength,
          avatar: parsedData.avatar,
          userName: parsedData.userName,
          userId: parsedData.userId,
          timestamp: parsedData.timestamp || Date.now(),
        };
        onMessage?.(message);
      } else if (['5'].includes(parsedData.type)) {
        // 处理礼物消息
        const content =
          typeof parsedData.content === 'string'
            ? JSON.parse(parsedData.content)
            : parsedData.content;
        console.log('gift-content', content);
        const message: WebSocketMessage = {
          type: parsedData.type,
          content: content,
          consumeLevel: content.consumeLevel,
          lighted: content.lighted,
          messageType: parsedData.type,
          avatar: parsedData.avatar,
          userName: parsedData.userName,
          userId: parsedData.userId,
          timestamp: parsedData.timestamp || Date.now(),
        };
        onMessage?.(message);
      } else if (['7', '11', '12'].includes(parsedData.type)) {
        // 7 - 直播间关闭
        // 11 - 直播间未推流
        // 12 - 直播间重新推流
        const message: WebSocketMessage = {
          type: parsedData.type,
          content: parsedData.content,
          stopSecond: parsedData.stopSecond,
        };
        onMessage?.(message);
      } else if (String(parsedData.type) === '10') {
        // 禁言
        const message: WebSocketMessage = {
          type: parsedData.type.toString(),
          content: parsedData.code,
        };
        onMessage?.(message);
      } else if (['8', '6'].includes(String(parsedData.type))) {
        // 是主播下单
        const content =
          typeof parsedData.content === 'string'
            ? JSON.parse(parsedData.content)
            : parsedData.content;
        const tagList = content?.toToken?.tagList ? JSON.parse(content?.toToken?.tagList) : {};
        const message: WebSocketMessage = {
          type: String(parsedData.type),
          content: {
            symbol: content.toToken.symbol,
            fromSymbol: content.fromToken.symbol,
            fromTokenLogoUrl: content.fromToken.icon,
            address: content.toToken.address,
            chainId: content.toToken.chainId,
            decimals: content.toToken.decimals,
            icon: content.toToken.icon,
            name: content.toToken.name,
            amount: content.toAmount,
            tagList: tagList,
            fromAmount: content.fromAmount,
            price: content.toToken.price,
            totalPrice: content.toAmount * content.toToken.price,
            txHash: content.txHash,
            mainstreamTokens: content.mainstreamTokens,
            extraContent: content,
            createTime: new Date().getTime(),
            consumeLevel: parsedData.consumeLevel,
            lighted: parsedData.lighted,
            userName: parsedData.userName,
            userId: parsedData.userId,
          },
          messageType: String(parsedData.type),
        };
        console.log('主播下单之后的结果', message);
        onMessage?.(message);
      } else if (String(parsedData.type) === '9') {
        // 是主播perps下单
        const content =
          typeof parsedData.content === 'string'
            ? JSON.parse(parsedData.content)
            : parsedData.content;
        console.log('主播perps下单信息', content);
        const message: WebSocketMessage = {
          type: String(parsedData.type),
          content: {
            ...content,
            createTime: new Date().getTime(),
            extraContent: content,
          },
          messageType: String(parsedData.type),
        };
        console.log('主播下单之后的结果', message);
        onMessage?.(message);
      }
    } catch (err) {
      console.error('处理WebSocket消息失败:', err);
      error.value = '消息格式错误';
    }
  };

  // 连接WebSocket
  const connect = () => {
    if (isConnected.value) {
      console.log('WebSocket连接已建立');
      return;
    }
    if (!roomId) {
      error.value = '房间ID不能为空';
      return;
    }

    // 清理之前的连接
    disconnect();

    try {
      // 构建WebSocket URL
      const wsUrl = token
        ? getWebSocketEndpoint() + `?token=${token}&userId=${userId}&roomId=${roomId}`
        : getWebSocketEndpoint() + `?userId=${userId}&roomId=${roomId}`;
      wsRef.value = new WebSocket(wsUrl);

      wsRef.value.onopen = () => {
        console.log('WebSocket连接成功');
        isConnected.value = true;
        error.value = null;
        onConnectionChange?.(true);
        startHeartbeat();
        onConnectionReady?.();
        // 定期更新统计信息
        if (statsIntervalRef.value) {
          clearInterval(statsIntervalRef.value);
        }
      };

      wsRef.value.onmessage = handleMessage;

      wsRef.value.onclose = (event) => {
        console.log('WebSocket连接关闭:', event.code, event.reason);
        isConnected.value = false;
        onConnectionChange?.(false);
        stopHeartbeat();
        onConnectionReady?.();
        // ws关闭，主动断开连接
        if (event.code === 1000) {
          onConnectionClosed?.();
        }
        if (statsIntervalRef.value) {
          clearInterval(statsIntervalRef.value);
          statsIntervalRef.value = null;
        }

        // 自动重连
        if (autoReconnect && event.code !== 1006) {
          console.log('准备重连...');
          reconnectRef.value = window.setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else {
          console.log('不重连');
          disconnect();
        }
      };

      wsRef.value.onerror = (event) => {
        console.error('WebSocket错误:', event);
        error.value = 'WebSocket连接错误';
        onConnectionReady?.();
      };
    } catch (err) {
      console.error('创建WebSocket连接失败:', err);
      error.value = '创建连接失败';
      onConnectionReady?.();
    }
  };

  // 断开连接
  const disconnect = () => {
    // 清理重连定时器
    if (reconnectRef.value) {
      clearTimeout(reconnectRef.value);
      reconnectRef.value = null;
    }

    // 清理心跳定时器
    stopHeartbeat();

    // 清理统计定时器
    if (statsIntervalRef.value) {
      clearInterval(statsIntervalRef.value);
      statsIntervalRef.value = null;
    }

    // 关闭WebSocket连接
    if (wsRef.value) {
      wsRef.value.close(1000, '主动断开连接');
      wsRef.value = null;
    }

    isConnected.value = false;
    onConnectionChange?.(false);
  };

  // 当roomId存在时自动连接
  watch(
    [() => roomId, () => isLive],
    ([newRoomId, newIsLive]) => {
      if (newRoomId && newIsLive) {
        console.log('开始链接');
        connect();
      } else {
        disconnect();
      }
    },
    { immediate: true }
  );

  // 清理
  onBeforeUnmount(() => {
    disconnect();
  });

  return {
    isConnected,
    isGuest,
    sendMessage,
    connect,
    disconnect,
    error,
    clearError,
  };
}
