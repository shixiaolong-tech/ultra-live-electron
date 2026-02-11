<template>
  <div class="live-swap-message">
    <div class="swap-badge">
      <span class="badge-icon">⇄</span>
      {{ t('liveDetail.swap') }}
    </div>
    <div class="swap-user-info">
      <UserLevel 
        class="user-level" 
        :level="content?.consumeLevel" 
        :is-dark-mode="!content?.lighted" 
      />
      <span 
        v-if="Number(roomInfo?.userId) === Number(content?.userId)"
        class="broadcaster-tag"
      >
        {{ t('liveDetail.broadcaster') }}
      </span>
      <span
        class="user-name"
        @click="handleUserClick"
      >
        {{ content?.userName }}
      </span>
    </div>
    <div class="swap-amount">
      <div class="amount-item">
        {{ formatPrice(content.fromAmount || 0) }} {{ content?.fromSymbol || '' }}
      </div>
      <span class="arrow-icon">→</span>
      <div class="amount-item">
        ≈ {{ formatPrice(content.amount || 0) }} {{ content?.symbol || '' }}
      </div>
      <div class="thumbs-up-icon">
        <span class="thumbs-icon">👍</span>
      </div>
      <span class="total-price">
        (${{ totalPrice }})
      </span>
    </div>
    <div class="swap-details">
      <span>币价:</span>
      <span class="price-link" @click="handlePriceClick">
        ${{ formatPrice(content.price || 0) }}
      </span>
      <span class="separator">|</span>
      <span>交易哈希:</span>
      <span class="hash-link" @click="handleHashClick">
        [{{ convertAddress(content.txHash) }}]
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineProps } from 'vue';
import { useUIKit } from '@tencentcloud/uikit-base-component-vue3';
import UserLevel from './UserLevel.vue';
import Tooltip from './Tooltip.vue';
import { formatPrice, convertAddress } from './utils';

interface Props {
  roomInfo: {
    userId?: number | string;
  };
  content: {
    consumeLevel?: number;
    lighted?: boolean;
    userId?: number | string;
    userName?: string;
    fromAmount?: number;
    fromSymbol?: string;
    amount?: number;
    symbol?: string;
    totalPrice?: number;
    price?: number;
    chainId?: number;
    txHash?: string;
    address?: string;
    tagList?: {
      communityRecognized?: boolean;
    };
  };
}

const props = defineProps<Props>();
const { t } = useUIKit();


const totalPrice = computed(() => {
  const price = props.content?.totalPrice || 0;
  return formatPrice(price);
});

const handleUserClick = () => {
  if (props.content?.userId) {
    window.open(`/profile/detail?id=${props.content.userId}`, '_blank');
  }
};

const handlePriceClick = () => {
  if (props.content?.chainId && props.content?.address) {
    window.open(`/line/?chainId=${props.content.chainId}&tokenAddress=${props.content.address}`, '_blank');
  }
};

const handleHashClick = () => {
  // 需要根据 chainId 找到对应的交易详情 URL
  // 这里简化处理，实际应该从配置中获取
  // 临时实现：直接打开区块链浏览器
  if (props.content?.txHash) {
    // 可以根据 chainId 选择不同的区块链浏览器
    const explorerUrl = `https://etherscan.io/tx/${props.content.txHash}`;
    window.open(explorerUrl, '_blank');
  }
};
</script>

<style lang="scss" scoped>
.live-swap-message {
  position: relative;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  display: flex;
  flex-direction: column;
  padding: 0.25rem 0;
  gap: 0.25rem;
}

.swap-badge {
  position: absolute;
  top: -0.25rem;
  right: -0.5rem;
  background: linear-gradient(to right, #09E308, #02A684);
  color: black;
  padding: 0.125rem 0.25rem;
  border-radius: 0 0 0 0.5rem;
  font-size: 0.625rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.badge-icon {
  width: 0.75rem;
  height: 0.75rem;
}

.swap-user-info {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.user-level {
  margin-right: 0.25rem;
  vertical-align: middle;
}

.broadcaster-tag {
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

.user-name {
  font-size: 0.75rem;
  border-radius: 0.125rem;
  color: var(--text-color-primary, #1890FF);
  font-weight: bold;
  cursor: pointer;
  word-break: break-all;
  line-height: 1.125rem;
  margin-right: 0.25rem;

  &:hover {
    text-decoration: underline;
  }
}

.swap-amount {
  display: flex;
  align-items: center;
}

.amount-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin: 0 0.125rem;
}

.arrow-icon {
  width: 0.625rem;
  height: 0.625rem;
}

.thumbs-up-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 0.875rem;
  height: 0.875rem;
  border-radius: 50%;
  background-color: rgba(24, 144, 255, 0.9);
  cursor: pointer;
  color: black;
}

.thumbs-icon {
  width: 0.625rem;
  height: 0.625rem;
}

.total-price {
  display: flex;
  align-items: center;
  margin-left: 0.125rem;
}

.dollar-icon {
  width: 0.625rem;
  height: 0.625rem;
}

.swap-details {
  display: flex;
  align-items: center;
  font-size: 0.625rem;
  gap: 0.125rem;
}

.price-link,
.hash-link {
  font-weight: bold;
  display: flex;
  align-items: center;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;

  &:hover {
    color: #60a5fa;
  }
}

.dollar-icon-small {
  width: 0.5rem;
  height: 0.5rem;
}

.separator {
  margin: 0 0.25rem;
  opacity: 0.5;
}
</style>
