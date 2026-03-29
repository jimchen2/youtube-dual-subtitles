// popup.js

// Import the full language list from its own file
import { allLanguages } from "./languages.js";

document.addEventListener("DOMContentLoaded", () => {
  // --- DOM Elements ---
  const mainLangsContainer = document.getElementById("mainLangsContainer");
  const otherLangsContainer = document.getElementById("otherLangsContainer");
  const targetLangSelect = document.getElementById("targetLang");
  const autoPlayCheckbox = document.getElementById("autoPlay");
  
  // ADDED: Show Native Language DOM element
  const showNativeCheckbox = document.getElementById("showNative");

  // Font Size DOM elements
  const fontSizeSlider = document.getElementById("fontSizeSlider");
  const fontSizeInput = document.getElementById("fontSizeInput");

  const selectAllBtn = document.getElementById("selectAll");
  const clearAllBtn = document.getElementById("clearAll");
  const removeSubsBtn = document.getElementById("removeSubsBtn");
  const errorBox = document.getElementById("errorBox");
  const reloadNotice = document.getElementById("reloadNotice");
  const reloadBtn = document.getElementById("reloadBtn");

  // --- Configuration ---
  const mainLangCodes = ["zh-Hans", "zh-Hant", "en", "ru", "es", "fr", "de", "ja", "uk"];

  let langCheckboxes;

  // --- UI Population ---
  function populateLanguageOptions() {
    allLanguages.sort((a, b) => a.languageName.simpleText.localeCompare(b.languageName.simpleText, "ru"));

    const mainOptgroup = document.createElement("optgroup");
    mainOptgroup.label = "Main Languages";
    const otherOptgroup = document.createElement("optgroup");
    otherOptgroup.label = "Other Languages";

    const createCheckboxItem = (lang) => {
      const div = document.createElement("div");
      div.className = "checkbox-item";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = `lang-${lang.languageCode}`;
      checkbox.value = lang.languageCode;
      const label = document.createElement("label");
      label.htmlFor = `lang-${lang.languageCode}`;
      label.textContent = lang.languageName.simpleText;
      div.appendChild(checkbox);
      div.appendChild(label);
      return div;
    };

    allLanguages.forEach((lang) => {
      const isMainLang = mainLangCodes.includes(lang.languageCode);
      const checkboxItem = createCheckboxItem(lang);
      if (isMainLang) {
        mainLangsContainer.appendChild(checkboxItem);
      } else {
        otherLangsContainer.appendChild(checkboxItem);
      }
      const option = document.createElement("option");
      option.value = lang.languageCode;
      option.textContent = lang.languageName.simpleText;
      if (isMainLang) {
        mainOptgroup.appendChild(option);
      } else {
        otherOptgroup.appendChild(option);
      }
    });

    targetLangSelect.appendChild(mainOptgroup);
    targetLangSelect.appendChild(otherOptgroup);
    langCheckboxes = document.querySelectorAll('#originalLangs input[type="checkbox"]');
  }

  // --- Settings Management ---

  function updateOriginalLanguageOptions() {
    const targetLang = targetLangSelect.value;

    langCheckboxes.forEach(cb => {
      const parentDiv = cb.parentElement;
      if (cb.value === targetLang) {
        cb.checked = false; 
        cb.disabled = true;
        parentDiv.classList.add('disabled');
      } else {
        cb.disabled = false;
        parentDiv.classList.remove('disabled');
      }
    });
  }

  function loadSettings() {
    const defaults = {
      originalLangs: ["es", "de", "ru", "uk", "zh-Hans"],
      targetLang: "en",
      autoPlay: true,
      fontSize: 150, 
      showNative: true // ADDED: Default show native
    };
    chrome.storage.local.get(defaults, (settings) => {
      langCheckboxes.forEach((cb) => {
        cb.checked = settings.originalLangs.includes(cb.value);
      });
      targetLangSelect.value = settings.targetLang;
      autoPlayCheckbox.checked = settings.autoPlay;
      showNativeCheckbox.checked = settings.showNative; // Load show native status
      
      // Load font size to both inputs
      fontSizeSlider.value = settings.fontSize;
      fontSizeInput.value = settings.fontSize;

      updateOriginalLanguageOptions();
    });
  }

  function saveSettings() {
    const selectedLangs = Array.from(langCheckboxes)
      .filter((cb) => cb.checked)
      .map((cb) => cb.value);

    // Get value from the number input (validated)
    let finalFontSize = parseInt(fontSizeInput.value, 10);
    if (isNaN(finalFontSize)) finalFontSize = 150;

    const settings = {
      originalLangs: selectedLangs,
      targetLang: targetLangSelect.value,
      autoPlay: autoPlayCheckbox.checked,
      fontSize: finalFontSize,
      showNative: showNativeCheckbox.checked // ADDED: Save show native status
    };
    chrome.storage.local.set(settings, () => {
      reloadNotice.style.display = "flex";
    });
  }

  // --- Event Listeners ---
  function addEventListeners() {
    document.getElementById("originalLangs").addEventListener("change", (event) => {
      if (event.target.type === "checkbox") {
        saveSettings();
      }
    });

    targetLangSelect.addEventListener("change", () => {
      updateOriginalLanguageOptions(); 
      saveSettings(); 
    });

    autoPlayCheckbox.addEventListener("change", saveSettings);
    
    // ADDED: Listener for Show Native toggle
    showNativeCheckbox.addEventListener("change", saveSettings);

    // --- FONT SIZE SYNCING ---
    // When the slider is moved: update the number input instantly
    fontSizeSlider.addEventListener("input", () => {
      fontSizeInput.value = fontSizeSlider.value;
    });
    // When the user lets go of the slider: save
    fontSizeSlider.addEventListener("change", saveSettings);

    // When typing in the number box: update the slider if it's a valid number
    fontSizeInput.addEventListener("input", () => {
      let val = parseInt(fontSizeInput.value, 10);
      if (!isNaN(val) && val >= 50 && val <= 300) {
        fontSizeSlider.value = val;
      }
    });
    // When the user clicks away (blur/change) or hits enter in the number box: 
    // validate, clamp between 50 and 300, and save
    fontSizeInput.addEventListener("change", () => {
      let val = parseInt(fontSizeInput.value, 10);
      if (isNaN(val)) val = 150;
      if (val < 50) val = 50;
      if (val > 300) val = 300;
      
      fontSizeInput.value = val;
      fontSizeSlider.value = val;
      saveSettings();
    });

    selectAllBtn.addEventListener("click", () => {
      langCheckboxes.forEach((cb) => {
        if (!cb.disabled) {
          cb.checked = true;
        }
      });
      saveSettings();
    });

    clearAllBtn.addEventListener("click", () => {
      langCheckboxes.forEach((cb) => (cb.checked = false));
      saveSettings();
    });

    removeSubsBtn.addEventListener("click", () => {
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

    reloadBtn.addEventListener("click", () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url.includes("youtube.com")) {
          chrome.tabs.reload(tabs[0].id);
          window.close();
        }
      });
    });

    chrome.runtime.onMessage.addListener((request) => {
      if (request.type === "error") {
        errorBox.textContent = request.message;
        errorBox.style.color = "#d9534f";
      }
    });
  }

  // --- Initialization ---
  populateLanguageOptions();
  loadSettings();
  addEventListeners();
});