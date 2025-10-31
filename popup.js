// popup.js

document.addEventListener('DOMContentLoaded', () => {
    const originalLangsContainer = document.getElementById('originalLangs');
    const targetLangSelect = document.getElementById('targetLang');
    const autoPlayCheckbox = document.getElementById('autoPlay');
    const selectAllBtn = document.getElementById('selectAll');
    const clearAllBtn = document.getElementById('clearAll');
    const removeSubsBtn = document.getElementById('removeSubsBtn');
    const errorBox = document.getElementById('errorBox');

    const availableLangs = [
        'es', 'de', 'ru', 'ua', 'zh', 'en', 'fr', 'ja', 'ko', 'pt', 'it', 'ar', 'hi'
    ];

    // Populate language checkboxes
    availableLangs.forEach(lang => {
        const div = document.createElement('div');
        div.className = 'checkbox-item';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `lang-${lang}`;
        checkbox.value = lang;
        const label = document.createElement('label');
        label.htmlFor = `lang-${lang}`;
        label.textContent = lang;
        div.appendChild(checkbox);
        div.appendChild(label);
        originalLangsContainer.appendChild(div);
    });
    
    const langCheckboxes = originalLangsContainer.querySelectorAll('input[type="checkbox"]');

    // Load settings from storage and update the UI
    function loadSettings() {
        const defaults = {
            originalLangs: ['es', 'de', 'ru', 'ua', 'zh'],
            targetLang: 'en',
            autoPlay: true
        };
        chrome.storage.local.get(defaults, (settings) => {
            // Set original languages
            langCheckboxes.forEach(cb => {
                cb.checked = settings.originalLangs.includes(cb.value);
            });
            // Set target language
            targetLangSelect.value = settings.targetLang;
            // Set autoplay
            autoPlayCheckbox.checked = settings.autoPlay;
        });
    }

    // Save settings to storage
    function saveSettings() {
        const selectedLangs = Array.from(langCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);
        
        const settings = {
            originalLangs: selectedLangs,
            targetLang: targetLangSelect.value,
            autoPlay: autoPlayCheckbox.checked
        };
        chrome.storage.local.set(settings);
    }

    // Event Listeners
    originalLangsContainer.addEventListener('change', saveSettings);
    targetLangSelect.addEventListener('change', saveSettings);
    autoPlayCheckbox.addEventListener('change', saveSettings);

    selectAllBtn.addEventListener('click', () => {
        langCheckboxes.forEach(cb => cb.checked = true);
        saveSettings();
    });

    clearAllBtn.addEventListener('click', () => {
        langCheckboxes.forEach(cb => cb.checked = false);
        saveSettings();
    });

    removeSubsBtn.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].url.includes("youtube.com")) {
                 chrome.tabs.sendMessage(tabs[0].id, { action: "removeSubtitles" });
                 errorBox.textContent = "Remove command sent.";
                 errorBox.style.color = "#333";
            } else {
                errorBox.textContent = "Not on a YouTube page.";
                errorBox.style.color = "#d9534f";
            }
        });
    });

    // Listen for error messages from content script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === "error") {
            errorBox.textContent = request.message;
            errorBox.style.color = "#d9534f";
        }
    });

    loadSettings();
});