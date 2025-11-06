// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "downloadSubtitle") {
    chrome.downloads.download({
      url: request.url,
      filename: request.filename,
      saveAs: false, // Don't prompt for location
      conflictAction: "overwrite" // Overwrite if file exists
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error("Download failed:", chrome.runtime.lastError);
      } else {
        console.log(`Subtitle saved with download ID: ${downloadId}`);
      }
    });
  }
});