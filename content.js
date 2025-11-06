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
    const data = await chrome.storage.local.get(settings);
    settings = data;
    console.log("[DUAL SUBS] Settings loaded:", settings);
  }

  // Function to send errors to the popup
  function sendErrorToPopup(message) {
    console.error(`[DUAL SUBS] Error: ${message}`);
    chrome.runtime.sendMessage({ type: "error", message: message });
  }

  // Function to save subtitle to downloads
  async function saveSubtitleFile(videoId, langCode, subtitleData) {
    if (!settings.saveSubtitles) return;
    
    try {
      // Clean the subtitle data (remove YouTube-specific formatting)
      const cleanedData = subtitleData.replaceAll("align:start position:0%", "");
      
      // Create a blob with the subtitle data
      const blob = new Blob([cleanedData], { type: 'text/vtt' });
      const url = URL.createObjectURL(blob);
      
      // Create the filename structure: youtube-subtitles/langCode/videoId.vtt
      const filename = `.youtube-subtitles/${langCode}/${videoId}.vtt`;
      
      // Send download request to background script
      chrome.runtime.sendMessage({
        type: "downloadSubtitle",
        url: url,
        filename: filename,
        langCode: langCode,
        videoId: videoId
      });
      
      console.log(`[DUAL SUBS] Saving subtitle: ${filename}`);
      
      // Clean up the blob URL after a delay
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (error) {
      console.error("[DUAL SUBS] Error saving subtitle:", error);
    }
  }

  // --- MESSAGE LISTENER for commands from popup.js ---
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "removeSubtitles") {
      removeSubs();
      sendResponse({ status: "Subtitles removed" });
    }
    return true; // Indicates that the response is sent asynchronously
  });

  // *****************************************************************
  // TRIGGER ONCE AND PREPARE FUTURE TRIGGERS (YOUTUBE IS SINGLE PAGE)
  // *****************************************************************

  handleVideoNavigation();
  addTrigger();
  function addTrigger() {
    if (location.href.startsWith("https://www.youtube.com")) {
      document.addEventListener("yt-navigate-finish", () => {
        handleVideoNavigation();
      });
    } else if (isMobile) {
      // Mobile triggers (unchanged)
      window.addEventListener("popstate", handleVideoNavigation);
      const originalPushState = history.pushState;
      history.pushState = function () {
        originalPushState.apply(this, arguments);
        handleVideoNavigation();
      };
      history.replaceState = function () {
        originalReplaceState.apply(this, arguments);
        handleVideoNavigation();
      };
    }
  }

  // ***********************
  // MAIN FUNCTION AND LOGIC
  // ***********************

  async function handleVideoNavigation() {
    console.log("handleVideoNavigation called");
    await loadSettings(); // Load latest settings on each navigation

    const newVideoID = extractYouTubeVideoID();
    if (!newVideoID) {
      console.log("[DUAL SUBS] Not on a video page, returning");
      currentVideoID = null;
      fired = false;
      return;
    }
    if (newVideoID !== currentVideoID) {
      console.log("[DUAL SUBS] Video ID changed, resetting fired variable", currentVideoID, newVideoID);
      currentVideoID = newVideoID;
      fired = false;
    }

    if (fired == true) return;

    fired = true;
    console.log("[DUAL SUBS] FIRED");
    removeSubs();

    const languageCheckPassed = await checkLanguageCode();
    if (!languageCheckPassed) {
      sendErrorToPopup("No suitable original language subtitles found.");
      return;
    }

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    let subtitleURL = null;
    for (let attempt = 0; attempt < 3 && subtitleURL == null; attempt++) {
      if (attempt > 0) await sleep(5000);
      try {
        subtitleURL = await extractSubtitleUrl();
      } catch (error) {
        console.log(`Attempt ${attempt + 1} failed:`, error);
      }
    }

    if (subtitleURL == null) {
      sendErrorToPopup("Could not extract subtitle URL. Timedtext not found.");
      return;
    }

    const url = new URL(subtitleURL);
    url.searchParams.set("fmt", "vtt");
    url.searchParams.delete("tlang"); // Ensure no translation on original
    
    // Get the language code from the URL
    const langParam = url.searchParams.get("lang");

    // Create translated URL using target language from settings
    const transUrl = new URL(url);
    transUrl.searchParams.set("tlang", settings.targetLang);

    console.log(`[DUAL SUBS] Original Sub URL: ${url.toString()}`);
    console.log(`[DUAL SUBS] Translated Sub URL: ${transUrl.toString()}`);

    // Add original subtitle and save it if enabled
    await addOneSubtitle(url.toString(), true, langParam);
    
    // Add translated subtitle (don't save this one)
    await addOneSubtitle(transUrl.toString(), false);

    const subtitleButtonSelector = isMobile ? ".ytmClosedCaptioningButtonButton" : ".ytp-subtitles-button";
    const subtitleButton = document.querySelector(subtitleButtonSelector);
    if (subtitleButton && subtitleButton.getAttribute("aria-pressed") === "true") {
      console.log("[DUAL SUBS] YouTube's subtitle is on, switching off...");
      subtitleButton.click();
    }

    if (settings.autoPlay) {
      setTimeout(() => ensureVideoPlaying(), 500);
    }
  }

  function ensureVideoPlaying() {
    const video = document.querySelector("video");
    if (video && video.paused) {
      console.log("[DUAL SUBS] Video was paused, attempting to play...");
      video.play();
    }
  }

  // **********************************
  // UTIL FUNCTIONS FOR ID AND LANGUAGE
  // **********************************

  function extractYouTubeVideoID() {
    const url = window.location.href;
    const patterns = {
      standard: /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?(?:[^?&]+&)*v=([^&]+)/,
      embed: /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^?]+)/,
      mobile: /(?:https?:\/\/)?m\.youtube\.com\/watch\?v=([^&]+)/,
    };
    let videoID = null;
    if (patterns.standard.test(url)) {
      videoID = url.match(patterns.standard)[1];
    } else if (patterns.embed.test(url)) {
      videoID = url.match(patterns.embed)[1];
    } else if (patterns.mobile.test(url)) {
      videoID = url.match(patterns.mobile)[1];
    }
    return videoID;
  }

  function injectScript(filePath) {
    const script = document.createElement("script");
    script.setAttribute("type", "text/javascript");
    script.setAttribute("src", chrome.runtime.getURL(filePath));
    (document.head || document.documentElement).appendChild(script);
    script.onload = () => script.remove();
  }

  injectScript("injected.js");

  // Check lanugages and use settings ---
  function checkLanguageCode() {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 5;
      const checkInterval = 2000;

      const listener = (event) => {
        clearInterval(intervalId);
        document.removeEventListener("DUALSUBS_SEND_TRACKS", listener);

        const { tracks, error } = event.detail;
        if (error) {
          console.log("[DUAL SUBS] Error from injected script:", error);
          resolve(false);
          return;
        }

        if (tracks && tracks.length > 0) {
          console.log("[DUAL SUBS] Received tracks:", tracks);

          // Check for auto-generated tracks first (e.g., a.de)
          const autoTracksFound = tracks.some(
            (track) =>
              track.languageCode && settings.originalLangs.some((lang) => track.languageCode.startsWith(`a.${lang}`))
          );

          if (autoTracksFound) {
            console.log("[DUAL SUBS] Auto-generated track found (prioritized).");
            resolve(true);
            return;
          }

          // Fallback to any track containing the language code
          const manualTracksFound = tracks.some(
            (track) => track.languageCode && settings.originalLangs.some((lang) => track.languageCode.includes(lang))
          );

          if (manualTracksFound) {
            console.log("[DUAL SUBS] Manual track found.");
            resolve(true);
          } else {
            console.log(`[DUAL SUBS] Target languages (${settings.originalLangs.join(", ")}) not found in tracks.`);
            resolve(false);
          }
        } else {
          console.log("[DUAL SUBS] Player data not yet available. Will retry.");
        }
      };

      document.addEventListener("DUALSUBS_SEND_TRACKS", listener);

      const intervalId = setInterval(() => {
        attempts++;
        if (attempts > maxAttempts) {
          console.log("[DUAL SUBS] Language check failed after all attempts.");
          clearInterval(intervalId);
          document.removeEventListener("DUALSUBS_SEND_TRACKS", listener);
          resolve(false);
          return;
        }
        document.dispatchEvent(new CustomEvent("DUALSUBS_GET_TRACKS"));
      }, checkInterval);
    });
  }

  // ****************************
  // UTIL FUNCTIONS FOR SUBTITLES
  // ****************************

  async function extractSubtitleUrl() {
    const isMobile = location.href.startsWith("https://m.youtube.com");
    const subtitleButtonSelector = isMobile ? ".ytmClosedCaptioningButtonButton" : ".ytp-subtitles-button";
    if (isMobile) {
      document.querySelector("#movie_player").click();
      document.querySelector("#movie_player").click();
    }
    async function findSubtitleButtonWithRetry(selector, maxAttempts = 3, delayMs = 1000) {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const button = document.querySelector(selector);
        if (button) return button;
        if (attempt < maxAttempts) await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      return null;
    }
    const subtitleButton = await findSubtitleButtonWithRetry(subtitleButtonSelector);
    if (!subtitleButton) return null;
    const initialEntryCount = performance.getEntriesByType("resource").length;
    subtitleButton.click();
    subtitleButton.click();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const newEntries = performance.getEntriesByType("resource").slice(initialEntryCount);
    for (const entry of newEntries) {
      if (entry.name.includes("timedtext") && entry.name.includes("&pot=")) {
        console.log("[DUAL SUBS] ✅ Found matching timedtext request!");
        return entry.name;
      }
    }
    console.log("[DUAL SUBS] ❌ No timedtext requests found");
    return null;
  }

  async function addOneSubtitle(url, isOriginal = false, langCode = null, maxRetries = 5, delay = 1000) {
    const video = document.querySelector("video");
    try {
      const response = await fetch(url);
      const subtitleData = (await response.text()).replaceAll("align:start position:0%", "");
      
      // Save the original subtitle if enabled and this is the original (not translated)
      if (isOriginal && settings.saveSubtitles && langCode) {
        const videoId = extractYouTubeVideoID();
        await saveSubtitleFile(videoId, langCode, subtitleData);
      }
      
      const track = document.createElement("track");
      track.src = "data:text/vtt," + encodeURIComponent(subtitleData);
      await new Promise((resolve) => setTimeout(resolve, delay));
      video.appendChild(track);
      track.track.mode = "showing";
    } catch (error) {
      if (maxRetries > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        return addOneSubtitle(url, isOriginal, langCode, maxRetries - 1, delay * maxRetries);
      }
    }
  }

  function removeSubs() {
    console.log(`[DUAL SUBS] Removing existing subtitles.`);
    const video = document.getElementsByTagName("video")[0];
    if (!video) return;
    const tracks = video.getElementsByTagName("track");
    Array.from(tracks).forEach(function (ele) {
      ele.track.mode = "hidden";
      ele.parentNode.removeChild(ele);
    });
  }
})();