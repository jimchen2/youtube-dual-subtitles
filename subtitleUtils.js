export async function extractSubtitleUrl() {
  const isMobile = location.href.startsWith("https://m.youtube.com");
  const subtitleButtonSelector = isMobile ? ".ytmClosedCaptioningButtonButton" : ".ytp-subtitles-button";

  if (isMobile) {
    document.querySelector("#movie_player").click();
    document.querySelector("#movie_player").click();
  }

  async function findSubtitleButtonWithRetry(subtitleButtonSelector, maxAttempts = 3, delayMs = 1000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const subtitleButton = document.querySelector(subtitleButtonSelector);
      if (subtitleButton) return subtitleButton;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    return null;
  }

  const subtitleButton = await findSubtitleButtonWithRetry(subtitleButtonSelector);
  if (!subtitleButton) return;

  const initialEntryCount = performance.getEntriesByType("resource").length;

  // Toggle button twice to trigger timedtext request
  subtitleButton.click();
  subtitleButton.click();

  await new Promise((resolve) => setTimeout(resolve, 1000));

  const newEntries = performance.getEntriesByType("resource").slice(initialEntryCount);
  console.log(`[DUAL SUBS] New entries detected: ${newEntries.length}`);
  let timedtextUrl = null;

  for (const entry of newEntries) {
    const isTimedtext = entry.name.includes("timedtext");
    const hasPot = entry.name.includes("&pot=");

    if (isTimedtext && hasPot) {
      console.log("[DUAL SUBS] ✅ Found matching timedtext request with &pot= parameter!");
      timedtextUrl = entry.name;
      break;
    }
  }

  if (!timedtextUrl) {
    console.log("[DUAL SUBS] ❌ No timedtext requests with &pot= parameter found");
  }

  return timedtextUrl;
}

export async function addOneSubtitle(url, maxRetries = 5, delay = 1000) {
  const video = document.querySelector("video");
  try {
    const response = await fetch(url);
    const subtitleData = (await response.text()).replaceAll("align:start position:0%", "");
    const track = document.createElement("track");
    track.src = "data:text/vtt," + encodeURIComponent(subtitleData);
    await new Promise((resolve) => setTimeout(resolve, delay));
    video.appendChild(track);
    track.track.mode = "showing";
  } catch (error) {
    if (maxRetries > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return addOneSubtitle(url, maxRetries - 1, delay * maxRetries);
    }
  }
}

export function removeSubs() {
  console.log(`[DUAL SUBS] Removing Subtitles.`);
  const video = document.getElementsByTagName("video")[0];
  if (!video) return;
  const tracks = video.getElementsByTagName("track");
  console.log(`[DUAL SUBS] Removing tracks ${tracks}.`);
  Array.from(tracks).forEach(function (ele) {
    ele.track.mode = "hidden";
    ele.parentNode.removeChild(ele);
  });
}















  const isMobile = location.href.startsWith("https://m.youtube.com");
  let fired = false;
  let currentVideoID = extractYouTubeVideoID();

  if (location.href.startsWith("https://www.youtube.com")) {
    document.addEventListener("yt-navigate-finish", () => {
      handleVideoNavigation();
    });
    handleVideoNavigation();
  } else if (isMobile) {
    window.addEventListener("popstate", handleVideoNavigation);

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function () {
      const result = originalPushState.apply(this, arguments);
      handleVideoNavigation();
      return result;
    };

    history.replaceState = function () {
      const result = originalReplaceState.apply(this, arguments);
      handleVideoNavigation();
      return result;
    };

    handleVideoNavigation();
  } else if (location.href.startsWith("https://www.youtube.com/embed")) {
    handleVideoNavigation();
  }

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

  async function handleVideoNavigation() {
    console.log("handleVideoNavigation called");
    const newVideoID = extractYouTubeVideoID();
    if (!newVideoID) {
      console.log("[DUAL SUBS] Not on a video page, returning");
      currentVideoID = null;
      fired = false;
      return;
    }
    if (newVideoID !== currentVideoID) {
      console.log("[DUAL SUBS] Video ID changed, resetting fired variable");
      console.log("[DUAL SUBS] Previous Video ID:", currentVideoID);
      console.log("[DUAL SUBS] New Video ID:", newVideoID);
      currentVideoID = newVideoID;
      fired = false;
    }

    if (fired == true) return;

    fired = true;
    console.log("[DUAL SUBS] FIRED");
    removeSubs();

    const languageCheckPassed = await checkLanguageCode();
    if (!languageCheckPassed) return;

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    let subtitleURL = null;

    for (let attempt = 0; attempt < 3 && subtitleURL == null; attempt++) {
      if (attempt > 0) {
        await sleep(5000);
      }

      try {
        subtitleURL = await extractSubtitleUrl();
      } catch (error) {
        console.log(`Attempt ${attempt + 1} failed:`, error);
      }
    }

    if (subtitleURL == null) return;

    const url = new URL(subtitleURL);
    if (!url.searchParams.has("kind")) url.searchParams.set("kind", "asr");
    if (url.searchParams.has("fmt")) {
      url.searchParams.set("fmt", "vtt");
    } else {
      url.searchParams.set("fmt", "vtt");
    }
    url.searchParams.delete("tlang");
    const transUrl = new URL(url);
    transUrl.searchParams.set("tlang", "en");
    const transSub = transUrl.toString();
    console.log(`[DUAL SUBS] transSub ${transSub}`);
    await addOneSubtitle(transSub);
    console.log(`[DUAL SUBS] subtitleURL ${url.toString()}`);
    await addOneSubtitle(url.toString());
    console.log("[DUAL SUBS] AAA");
    const subtitleButtonSelector = isMobile ? ".ytmClosedCaptioningButtonButton" : ".ytp-subtitles-button";
    const subtitleButton = document.querySelector(subtitleButtonSelector);
    console.log("[DUAL SUBS] BBB");
    if (subtitleButton && subtitleButton.getAttribute("aria-pressed") === "true") {
      console.log("[DUAL SUBS] YouTube's subtitle is switched on, switching it off...");
      subtitleButton.click();
    }

    setTimeout(() => ensureVideoPlaying(), 500);
    function ensureVideoPlaying() {
      const video = document.querySelector("video");
      if (video && video.paused) {
        console.log("[DUAL SUBS] Video was paused, attempting to play...");
        video.play();
      }
    }

    console.log("[DUAL SUBS] CCC");
  }

  function checkLanguageCode() {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 5;
      const checkInterval = 2000;

      // Set up message listener for response from injected script
      const messageHandler = (event) => {
        if (event.data && event.data.type === "DUAL_SUBS_CAPTION_TRACKS") {
          console.log("[DUAL SUBS] Received caption tracks from page:", event.data.captionTracks);

          const captionTracks = event.data.captionTracks;

          if (captionTracks && captionTracks.length > 0) {
            const hasTargetLanguage = captionTracks.some(
              (track) => track.languageCode && (track.languageCode.includes("de") || track.languageCode.includes("es"))
            );

            if (hasTargetLanguage) {
              const foundLanguages = captionTracks
                .filter(
                  (track) =>
                    track.languageCode && (track.languageCode.includes("de") || track.languageCode.includes("es"))
                )
                .map((track) => track.languageCode);
              console.log("[DUAL SUBS] Language check passed. Found:", foundLanguages.join(", "));
              window.removeEventListener("message", messageHandler);
              clearInterval(intervalId);
              resolve(true);
            }
          }
        }
      };

      window.addEventListener("message", messageHandler);

      const intervalId = setInterval(() => {
        attempts++;
        console.log(`[DUAL SUBS] Language check attempt ${attempts}/${maxAttempts}`);

        // Inject script to get caption tracks from page context
        injectScript(() => {
          try {
            const player = document.querySelector("#movie_player");
            if (player && typeof player.getPlayerResponse === "function") {
              const playerResponse = player.getPlayerResponse();
              const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];

              // Send the caption tracks back to content script
              window.postMessage(
                {
                  type: "DUAL_SUBS_CAPTION_TRACKS",
                  captionTracks: captionTracks,
                },
                "*"
              );
            } else {
              // Player not ready yet, send empty response
              window.postMessage(
                {
                  type: "DUAL_SUBS_CAPTION_TRACKS",
                  captionTracks: [],
                },
                "*"
              );
            }
          } catch (error) {
            console.error("[DUAL SUBS] Error getting player response:", error);
            window.postMessage(
              {
                type: "DUAL_SUBS_CAPTION_TRACKS",
                captionTracks: [],
              },
              "*"
            );
          }
        });

        // FAILURE: If we've reached max attempts, stop and resolve false
        if (attempts >= maxAttempts) {
          console.log("[DUAL SUBS] Language check failed after all attempts. Target languages not found.");
          window.removeEventListener("message", messageHandler);
          clearInterval(intervalId);
          resolve(false);
        }
      }, checkInterval);
    });
  }
})();
