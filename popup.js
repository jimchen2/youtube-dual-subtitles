// popup.js

// Import the full language list from its own file
import { allLanguages } from "./languages.js";

document.addEventListener("DOMContentLoaded", () => {
  // --- DOM Elements ---
  const mainLangsContainer = document.getElementById("mainLangsContainer");
  const otherLangsContainer = document.getElementById("otherLangsContainer");
  const targetLangSelect = document.getElementById("targetLang");
  const autoPlayCheckbox = document.getElementById("autoPlay");
  const selectAllBtn = document.getElementById("selectAll");
  const clearAllBtn = document.getElementById("clearAll");
  const removeSubsBtn = document.getElementById("removeSubsBtn");
  const errorBox = document.getElementById("errorBox");

  // --- Configuration ---
  // Define the 5 main official languages of UN + German, Japanese, Ukrainian
  const mainLangCodes = ["zh-Hans", "zh-Hant", "en", "ru", "es", "fr", "de", "ja", "uk"];

  let langCheckboxes; // Will be populated after UI is built

  // --- UI Population ---
  function populateLanguageOptions() {
    // Sort languages alphabetically by their Russian name for better usability
    allLanguages.sort((a, b) => a.languageName.simpleText.localeCompare(b.languageName.simpleText, "ru"));

    // Create option groups for the target language dropdown
    const mainOptgroup = document.createElement("optgroup");
    mainOptgroup.label = "Main Languages";
    const otherOptgroup = document.createElement("optgroup");
    otherOptgroup.label = "Other Languages";

    // Helper function to create a checkbox item
    const createCheckboxItem = (lang) => {
      const div = document.createElement("div");
      div.className = "checkbox-item";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = `lang-${lang.languageCode}`;
      checkbox.value = lang.languageCode;
      const label = document.createElement("label");
      label.htmlFor = `lang-${lang.languageCode}`;
      label.textContent = lang.languageName.simpleText; // Display full name
      div.appendChild(checkbox);
      div.appendChild(label);
      return div;
    };

    allLanguages.forEach((lang) => {
      const isMainLang = mainLangCodes.includes(lang.languageCode);

      // 1. Populate Original Language Checkboxes
      const checkboxItem = createCheckboxItem(lang);
      if (isMainLang) {
        mainLangsContainer.appendChild(checkboxItem);
      } else {
        otherLangsContainer.appendChild(checkboxItem);
      }

      // 2. Populate Target Language Dropdown
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

    // After creating all checkboxes, select them for event handling
    langCheckboxes = document.querySelectorAll('#originalLangs input[type="checkbox"]');
  }

  // --- Settings Management ---
  function loadSettings() {
    const defaults = {
      originalLangs: ["es", "de", "ru", "uk", "zh-Hans"], // Default selection
      targetLang: "en",
      autoPlay: true,
    };
    chrome.storage.local.get(defaults, (settings) => {
      langCheckboxes.forEach((cb) => {
        cb.checked = settings.originalLangs.includes(cb.value);
      });
      targetLangSelect.value = settings.targetLang;
      autoPlayCheckbox.checked = settings.autoPlay;
    });
  }

  function saveSettings() {
    const selectedLangs = Array.from(langCheckboxes)
      .filter((cb) => cb.checked)
      .map((cb) => cb.value);

    const settings = {
      originalLangs: selectedLangs,
      targetLang: targetLangSelect.value,
      autoPlay: autoPlayCheckbox.checked,
    };
    chrome.storage.local.set(settings);
  }

  // --- Event Listeners ---
  function addEventListeners() {
    // Use event delegation for checkboxes for performance
    document.getElementById("originalLangs").addEventListener("change", (event) => {
      if (event.target.type === "checkbox") {
        saveSettings();
      }
    });
    targetLangSelect.addEventListener("change", saveSettings);
    autoPlayCheckbox.addEventListener("change", saveSettings);

    selectAllBtn.addEventListener("click", () => {
      langCheckboxes.forEach((cb) => (cb.checked = true));
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
