import BarrageInput from './BarrageInput.vue';
import { addI18n } from 'tuikit-atomicx-vue3-electron';
import { enResource, zhResource } from './i18n';


addI18n('en-US', { translation: enResource });
addI18n('zh-CN', { translation: zhResource });

export { BarrageInput };
