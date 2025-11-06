// content.js
(function () {
  const isMobile = location.href.startsWith("https://m.youtube.com");
  let fired = false;
  let currentVideoID = extractYouTubeVideoID();

  // --- SETTINGS (with defaults, to be overwritten by storage) ---
  let settings = {
    originalLangs: ["es", "de", "ru", "ua", "zh"],
    targetLang: "en",
    autoPlay: true,
    saveSubtitles: false, // New setting
  };

  // Function to load settings from storage
  async function loadSettings() {
    settings = await chrome.storage.local.get(settings);
    console.log("[DUAL SUBS] Settings loaded:", settings);
  }

  function sendErrorToPopup(message) {
    console.error(`[DUAL SUBS] Error: ${message}`);
    chrome.runtime.sendMessage({ type: "error", message: message });
  }

  // --- SAVE FUNCTION ---
  async function saveSubtitleFile(videoId, langCode, subtitleData) {
    if (!settings.saveSubtitles || !videoId || !langCode || !subtitleData) return;

    try {
      const cleanedData = subtitleData.replaceAll("align:start position:0%", "");
      const filename = `youtube-subtitles/${langCode}/${videoId}.vtt`;
      
      chrome.runtime.sendMessage({
        type: "downloadSubtitle",
        data: cleanedData,
        filename: filename
      });
      
      console.log(`[DUAL SUBS] Sending save request for: ${filename}`);
    } catch (error) {
      console.error("[DUAL SUBS] Error preparing subtitle for saving:", error);
    }
  }

  // --- MESSAGE LISTENER ---
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "removeSubtitles") {
      removeSubs();
      sendResponse({ status: "Subtitles removed" });
    }
    return true;
  });

  // --- TRIGGERS ---
  handleVideoNavigation();
  addTrigger();

  function addTrigger() {
    document.addEventListener("yt-navigate-finish", handleVideoNavigation);
    // Note: Mobile triggers could be added here if needed
  }

  // ***********************
  // MAIN LOGIC (REWRITTEN)
  // ***********************
  async function handleVideoNavigation() {
    await loadSettings();

    const newVideoID = extractYouTubeVideoID();
    if (!newVideoID) {
      console.log("[DUAL SUBS] Not a video page.");
      currentVideoID = null;
      fired = false;
      return;
    }
    if (newVideoID !== currentVideoID) {
      console.log("[DUAL SUBS] Video ID changed, resetting.", newVideoID);
      currentVideoID = newVideoID;
      fired = false;
    }

    if (fired) return;
    fired = true;

    console.log("[DUAL SUBS] FIRED");
    removeSubs();

    // --- STEP 1: Get the subtitle URL FIRST ---
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    let subtitleURL = null;
    for (let attempt = 0; attempt < 3 && subtitleURL == null; attempt++) {
      if (attempt > 0) await sleep(3000);
      try {
        subtitleURL = await extractSubtitleUrl();
      } catch (error) {
        console.log(`[DUAL SUBS] Attempt ${attempt + 1} to get URL failed:`, error);
      }
    }

    if (!subtitleURL) {
      sendErrorToPopup("No default subtitle track found to process.");
      return;
    }

    // --- STEP 2: Extract info, fetch data, and save if enabled ---
    const originalUrl = new URL(subtitleURL);
    originalUrl.searchParams.set("fmt", "vtt");
    originalUrl.searchParams.delete("tlang");
    const langCode = originalUrl.searchParams.get("lang");

    if (!langCode) {
      sendErrorToPopup("Could not determine language from subtitle URL.");
      return;
    }

    let originalSubtitleData;
    try {
      console.log(`[DUAL SUBS] Fetching original subtitle (${langCode})`);
      const response = await fetch(originalUrl.toString());
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      originalSubtitleData = await response.text();
    } catch (error) {
      sendErrorToPopup(`Failed to fetch original subtitles: ${error.message}`);
      return;
    }

    // Save the fetched data if the setting is on. This is INDEPENDENT of display.
    await saveSubtitleFile(currentVideoID, langCode, originalSubtitleData);

    // --- STEP 3: Check if this language should be DISPLAYED ---
    const shouldDisplay = settings.originalLangs.some(displayLang => langCode.includes(displayLang));

    if (!shouldDisplay) {
      console.log(`[DUAL SUBS] Subtitle language "${langCode}" is not in the display list. Process finished.`);
      // Optional: auto-play video even if subtitles aren't shown
      if (settings.autoPlay) setTimeout(ensureVideoPlaying, 500);
      return; // Stop here.
    }

    console.log(`[DUAL SUBS] Language "${langCode}" is in the display list. Proceeding to show subtitles.`);

    // --- STEP 4: Display original and translated subtitles ---
    displaySubtitleTrack(originalSubtitleData);

    const transUrl = new URL(originalUrl);
    transUrl.searchParams.set("tlang", settings.targetLang);

    try {
      const response = await fetch(transUrl.toString());
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const translatedSubtitleData = await response.text();
      displaySubtitleTrack(translatedSubtitleData);
    } catch (error) {
      sendErrorToPopup(`Failed to fetch translated subtitles: ${error.message}`);
    }

    // --- FINAL ACTIONS ---
    const subtitleButton = document.querySelector(".ytp-subtitles-button");
    if (subtitleButton?.getAttribute("aria-pressed") === "true") {
      subtitleButton.click();
    }
    if (settings.autoPlay) {
      setTimeout(ensureVideoPlaying, 500);
    }
  }

  // **********************************
  // UTIL FUNCTIONS
  // **********************************

  async function extractSubtitleUrl() {
    const subtitleButton = document.querySelector(".ytp-subtitles-button");
    if (!subtitleButton) {
        console.log("[DUAL SUBS] Subtitle button not found.");
        return null;
    }

    const initialEntryCount = performance.getEntriesByType("resource").length;
    // Click twice to force a refresh of the subtitle track request if it was already on
    subtitleButton.click();
    subtitleButton.click(); 

    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for network request

    const newEntries = performance.getEntriesByType("resource").slice(initialEntryCount);
    for (const entry of newEntries.reverse()) { // Check newest entries first
      if (entry.name.includes("timedtext")) {
        console.log("[DUAL SUBS] ✅ Found timedtext request:", entry.name);
        return entry.name;
      }
    }
    console.log("[DUAL SUBS] ❌ No new timedtext requests found after clicking CC button.");
    return null;
  }

  function displaySubtitleTrack(subtitleData) {
    const video = document.querySelector("video");
    if (!video) return;

    const cleanedData = subtitleData.replaceAll("align:start position:0%", "");
    const trackSrc = "data:text/vtt;charset=utf-8," + encodeURIComponent(cleanedData);

    const track = document.createElement("track");
    track.src = trackSrc;
    video.appendChild(track);

    setTimeout(() => {
      if (track && track.track) {
        track.track.mode = "showing";
      }
    }, 100);
  }

  function extractYouTubeVideoID() {
    const match = window.location.search.match(/[?&]v=([^&]+)/);
    return match ? match[1] : null;
  }

  function removeSubs() {
    const video = document.querySelector("video");
    if (!video) return;
    const tracks = video.getElementsByTagName("track");
    Array.from(tracks).forEach((track) => track.remove());
  }

  function ensureVideoPlaying() {
    const video = document.querySelector("video");
    if (video && video.paused) {
      video.play().catch(e => console.error("Autoplay failed:", e));
    }
  }
})();