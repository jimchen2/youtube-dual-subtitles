
// Listen for a request from the content script
document.addEventListener('DUALSUBS_GET_TRACKS', (event) => {
  try {
    const captionTracks = document.querySelector("#movie_player")?.getPlayerResponse()?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (captionTracks && captionTracks.length > 0) {
      // Data found, send it back to the content script
      document.dispatchEvent(new CustomEvent('DUALSUBS_SEND_TRACKS', {
        detail: { tracks: captionTracks }
      }));
    } else {
      // Data not found or empty, send back an empty response
      document.dispatchEvent(new CustomEvent('DUALSUBS_SEND_TRACKS', {
        detail: { tracks: null }
      }));
    }
  } catch (error) {
    // An error occurred, send back an error response
     document.dispatchEvent(new CustomEvent('DUALSUBS_SEND_TRACKS', {
        detail: { error: error.toString() }
      }));
  }
});