import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources } from './resources';

// 暂时只支持简体中文：移除语言切换后固定使用 zh，资源文件中保留多语文案便于日后恢复。
export const supportedLanguages = ['zh'] as const;
export type AppLanguage = (typeof supportedLanguages)[number];

void i18n.use(initReactI18next).init({
  resources,
  lng: 'zh',
  initAsync: false,
  fallbackLng: 'zh',
  supportedLngs: ['zh'],
  interpolation: { escapeValue: false },
  returnNull: false,
});

document.documentElement.lang = 'zh-CN';

export function currentLocale(): string {
  return 'zh-CN';
}

export default i18n;
