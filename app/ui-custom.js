import UI from "./ui.js";

// showStatus() function removed
UI.connectFinished = function (e) {
    UI.connected = true;
    UI.inhibitReconnect = false;

    // let msg;
    // if (UI.getSetting('encrypt')) {
    //    msg = _("Connected (encrypted) to ") + UI.desktopName;
    // } else {
    //    msg = _("Connected (unencrypted) to ") + UI.desktopName;
    // }
    // UI.showStatus(msg);
    // UI.showStats();
    UI.updateVisualState('connected');

    UI.rfb.focus();
};

// sync images with quality instead video_quality
const receiveMessageOriginal = UI.receiveMessage;
UI.receiveMessage = (e) =>
  e?.data?.action === "setvideoquality"
    ? (UI.forceSetting("quality", parseInt(e.data.value), false), UI.updateQuality())
    : receiveMessageOriginal(e);

// Display the desktop name in the document title
UI.updateDesktopName = function (e) {
    UI.desktopName = e.detail.name;
    document.title = "SwapVNC";
};

export default UI;