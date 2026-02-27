export const getLangName = (name?: string, nameEn?: string) => {
  const currentLanguage = window.localStorage.getItem('app-language') || 'zh-CN';
  if (currentLanguage === 'zh-CN') {
    return name;
  }
  return nameEn || name;
}
