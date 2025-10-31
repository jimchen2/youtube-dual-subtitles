
// Listen for a request from the content script
document.addEventListener('DUALSUBS_GET_TRACKS', (event) => {
  try {
    const captionTracks = document.querySelector("#movie_player")?.getPlayerResponse()?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (captionTracks && captionTracks.length > 0) {
      document.dispatchEvent(new CustomEvent('DUALSUBS_SEND_TRACKS', {
        detail: { tracks: captionTracks }
      }));
    } else {
      document.dispatchEvent(new CustomEvent('DUALSUBS_SEND_TRACKS', {
        detail: { tracks: null }
      }));
    }
  } catch (error) {
     document.dispatchEvent(new CustomEvent('DUALSUBS_SEND_TRACKS', {
        detail: { error: error.toString() }
      }));
  }
});