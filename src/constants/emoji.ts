interface IEmojiUrlMap {
  [key: string]: string;
}

const emojiBaseUrl = 'https://static.billion.live/live-thumbnails/20260117/';

const emojiUrlMap: IEmojiUrlMap = {
  '[emojiLove]': 'user_100506/9a92b2f8aae547efa92dd2674f4b91a0.gif',
  '[emojiMovedToTears]': 'user_100506/975d6366ff724a109f6deda9337a28ee.gif',
  '[emojiBlushing]': 'user_100506/7ea714d60fbd4860bc52595410508979.gif',
  '[emojiAngry]': 'user_100506/64174fe01c0f4f24a38fe22461e81f3a.gif',
  '[emojiGoodNight]': 'user_100506/041a440b1daf4b6eb7667b2f0308d3ba.gif',
  '[emojiSpeechless]': 'user_100506/42b628769d244c7eb1a5167425729eff.gif',
  '[emojiAllIn]': 'user_100506/d75b99cefbcb4385a8972e969b0aaf18.gif',
  '[emojiByeBye]': 'user_100506/3c441afe0c10454b9a60a6de3f0b4147.gif',
  '[emojiGoodMorning]': 'user_100506/4bac6239c1b7422282c893e95ba20a52.gif',
  '[emojiHello]': 'user_100506/526c40ec2e444a8c96c1b57a098c6efc.gif',
};

export { emojiUrlMap, emojiBaseUrl };
