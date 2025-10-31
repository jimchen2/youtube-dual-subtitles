// background.js

chrome.runtime.onInstalled.addListener(() => {
  const defaultSettings = {
    originalLangs: ['es', 'de', 'ru', 'ua', 'zh'],
    targetLang: 'en',
    autoPlay: true
  };

  chrome.storage.local.set(defaultSettings, () => {
    console.log('Default settings saved.');
  });
});