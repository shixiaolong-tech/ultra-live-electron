import { defineStore } from 'pinia';

interface MessageItem {
  ID: string;
  type: string;
  payload: {
    text: string;
  };
  nick: string;
  from: string;
  flow: string;
  sequence: number;
}

interface GiftItem {
  ID: string;
  type: string;
  gift: {
    giftId: string;
    imageUrl: string;
    animationUrl: string;
    price: number
    giftName: string;
    type: number;
    giftCount: number;
  };
  nick: string;
  from: string;
  flow: string;
  sequence: number;
}

interface ChatState {
  messageList: MessageItem[];
  giftList: GiftItem[];
}

export const useChatStore = defineStore('chat', {
  state: (): ChatState => ({
    messageList: [],
    giftList: [],
  }),
  getters: {
  },
  actions: {
    updateMessageList(message: MessageItem) {
      const messageIndex = this.messageList.findIndex(item => item.ID === message.ID);
      if (messageIndex === -1) {
        if (this.messageList.length >= 200) {
          this.messageList.shift();
        }
        this.messageList.push(message);
      }
    },
    updateGiftList(gift: GiftItem) {
      const giftIndex = this.giftList.findIndex(item => item.ID === gift.ID);
      if (giftIndex === -1) {
        if (this.giftList.length >= 200) {
          this.giftList.shift();
        }
        this.giftList.push(gift);
      }
    },
    reset() {
      this.messageList = [];
      this.giftList = [];
    },
  },
});
