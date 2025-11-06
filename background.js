// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "downloadSubtitle") {
    // Create a data URI from the received text data.
    const dataUrl = 'data:text/vtt;charset=utf-8,' + encodeURIComponent(request.data);

    chrome.downloads.download({
      url: dataUrl, // Use the new data URI
      filename: request.filename,
      saveAs: false, // Don't prompt for location
      conflictAction: "overwrite" // Overwrite if file exists
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error(`Download failed for ${request.filename}:`, chrome.runtime.lastError.message);
      } else {
        console.log(`Subtitle download started for ${request.filename} with download ID: ${downloadId}`);
      }
    });

    // Return true to indicate you will send a response asynchronously,
    // which is good practice even if you don't use it here.
    return true; 
  }
});