import UI from "./ui.js";
import _ from './localization.js';

const PAGE_TITLE = "SwapVNC";

// Initialize reconnect tracking
UI.reconnectAttempts = 0;
UI.maxReconnectAttempts = 5;

// Override reconnect default to true
const initSettingsOriginal = UI.initSettings;
UI.initSettings = function () {
    initSettingsOriginal.call(UI);
    UI.forceSetting('reconnect', true);
};

// Add cancel reconnect button support
const addConnectionControlHandlersOriginal = UI.addConnectionControlHandlers;
UI.addConnectionControlHandlers = function () {
    addConnectionControlHandlersOriginal.call(UI);
    var cancel_btn_el = document.getElementById("noVNC_cancel_reconnect_button");
    if (typeof(cancel_btn_el) != 'undefined' && cancel_btn_el != null) {
        cancel_btn_el.addEventListener('click', UI.cancelReconnect);
    }
};

// showStatus() function removed
UI.connectFinished = function (e) {
    UI.connected = true;
    UI.inhibitReconnect = false;
    UI.reconnectAttempts = 0; // reset reconnect counter on successful connection

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

// Handles automatic reconnect attempts for all disconnect scenarios with retry limit control.
UI.disconnectFinished = function (e) {
    const wasConnected = UI.connected;

    UI.connected = false;
    UI.rfb = undefined;
    UI.monitors = [];
    UI.sortedMonitors = [];

    if (!e.detail.clean) {
        UI.updateVisualState('disconnected');
        if (wasConnected) {
            UI.showStatus(_("Something went wrong, connection is closed"), 'error');
        } else {
            UI.showStatus(_("Failed to connect to server"), 'error');
        }
    }
    // Handle automatic reconnect logic
    if (UI.getSetting('reconnect', false) === true && !UI.inhibitReconnect) {
        // Stop reconnecting after reaching retry limit
        if (UI.reconnectAttempts >= UI.maxReconnectAttempts) {
            UI.reconnectAttempts = 0;
            UI.updateVisualState('disconnected');
            UI.showStatus(_("Connection failed after maximum retry attempts"), 'error');
            return;
        }
        // Handle automatic reconnect logic
        UI.reconnectAttempts++;
        UI.updateVisualState('reconnecting');
        const delay = parseInt(UI.getSetting('reconnect_delay'));
        UI.reconnectCallback = setTimeout(UI.reconnect, delay);
        return;
    } else {
        UI.updateVisualState('disconnected');
        UI.showStatus(_("Disconnected"), 'normal');
    }

    document.title = PAGE_TITLE;
    UI.openControlbar();

    if (UI.forceReconnect) {
        UI.forceReconnect = false;
        UI.connect(null, UI.reconnectPassword);
    }
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
    document.title = PAGE_TITLE;
};

export default UI;