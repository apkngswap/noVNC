import UI from "./ui.js";

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

if (typeof UI.receiveMessage === "function") {
    const originalReceiveMessage = UI.receiveMessage;

    UI.receiveMessage = function (event) {
        if (event && event.data && event.data.action === "setvideoquality") {
            return;
        }
        return originalReceiveMessage.call(UI, event);
    };
}

UI.updateDesktopName = function (e) {
    UI.desktopName = e.detail.name;
    document.title = "KasmVNC";
};

export default UI;
