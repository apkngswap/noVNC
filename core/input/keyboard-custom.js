import BaseKeyboard from "./keyboard.js";
import { stopEvent } from '../util/events.js';
import * as KeyboardUtil from "./util.js";
import KeyTable from "./keysym.js";
import * as browser from "../util/browser.js";
import * as Log from "../util/logging.js";


export default class CustomKeyboard extends BaseKeyboard {
    constructor(screenInput, touchInput, keyboardInput) {
        super(screenInput, touchInput, keyboardInput);

        this._Layout = "us";                    // We add this to fix keyboard issue
        this._lastLayoutChangeAt = 0;           // (added) debounce timestamp
        this._pendingKeys = [];                 // Queue of keys held back until layout change is confirmed
        this._layoutChangePending = false;      // Flag indicating a layout change is in progress
        this._layoutFallbackTimeout = null;     // Handle for the layout-change fallback timer

        // Register layout_ack handler for grab/ungrab lifecycle
        this._eventHandlers['message'] = this._handleLayoutAck.bind(this);
    }
    // We add these functions to fix keyboard issue
    _detectLayout(key) {
        if (!key || key.length !== 1) return null;

        const isPersian = /[\u0600-\u06FF]/.test(key);
        const isLatin   = /[A-Za-z]/.test(key);

        if (isPersian) return "ir";
        if (isLatin)   return "us";
        return null;
    }
    // Switch layout with debounce
    _switchLayout(layout) {
        if (!layout || layout === this._Layout) return;

        const now = Date.now();
        if (now - this._lastLayoutChangeAt < 50) return;

        this._Layout = layout;
        this._lastLayoutChangeAt = now;
        window.parent.postMessage({ layout: this._Layout }, "*");
        // Block incoming keys until the remote layout is ready
        this._layoutChangePending = true;
        // Reset fallback timer on each layout switch
        clearTimeout(this._layoutFallbackTimeout);
        // If no ack arrives within 250ms, flush the queue anyway
        this._layoutFallbackTimeout = setTimeout(() => this._flushPendingKeys(), 250);
    }

    // Cancel the fallback timer, then send all queued keys to the remote
    _flushPendingKeys() {
        clearTimeout(this._layoutFallbackTimeout);
        this._layoutChangePending = false;
        const queue = this._pendingKeys;
        this._pendingKeys = [];
        queue.forEach(({ keysym, code }) => this._sendKeyEvent(keysym, code, true));
    }

    _handleKeyDown(e) {
        Log.Debug("Key Down: " + e.keyCode + " isComposing: " + e.isComposing);
        if (e.isComposing || e.keyCode === 229) {
            //skip event if IME related
            Log.Debug("Skipping keydown, IME interaction, keycode: " + e.keyCode);
            return;
        }
        
        if (e.keyCode == 91 || e.keyCode == 92 ) {
            return; //TODO we added this line to disable window keys
        }

        const code = this._getKeyCode(e);
        let keysym = KeyboardUtil.getKeysym(e);

        //TODO : Modified this section because Persian keyboard shortcuts (e.g., Ctrl+C/V/A) were not working in Firefox and some other apps.
        // Read Ctrl state
        const ctrl = e.ctrlKey;

        // Read Meta state in mac or ios
        const meta = (browser.isMac() || browser.isIOS()) && e.metaKey

        // Detect AltGr/AltGraph
        const isAltGraph =
        (e.getModifierState && e.getModifierState('AltGraph')) ||
        (browser.isWindows() && ctrl && e.altKey);

        const isShortcut = (ctrl || meta) && !isAltGraph;

        // On Ctrl/Meta press, force remote layout to US
        if (!isAltGraph &&
            (code === 'ControlLeft' || code === 'ControlRight' ||
            code === 'MetaLeft' || code === 'MetaRight')) {
        this._switchLayout('us');
        }

        // Physical key id (e.g., KeyA..KeyZ) (layout-independent)
        const phys = e.code;

        // If shortcut + KeyA..KeyZ: force Latin keysym for Ctrl+C/V/A/...
        if (isShortcut && phys.startsWith('Key') && phys.length === 4) {
        const letter = phys[3];                
        const ch = e.shiftKey ? letter : letter.toLowerCase();
        keysym = ch.codePointAt(0);
        }
        // Otherwise: normal typing -> detect layout from character
        else if (!isShortcut && e.keyCode !== 32) {
        this._switchLayout(this._detectLayout(e.key));
        }

        // Windows doesn't have a proper AltGr, but handles it using
        // fake Ctrl+Alt. However the remote end might not be Windows,
        // so we need to merge those in to a single AltGr event. We
        // detect this case by seeing the two key events directly after
        // each other with a very short time between them (<50ms).
        if (this._altGrArmed) {
            this._altGrArmed = false;
            clearTimeout(this._altGrTimeout);

            if ((code === "AltRight") &&
                ((e.timeStamp - this._altGrCtrlTime) < 50)) {
                // FIXME: We fail to detect this if either Ctrl key is
                //        first manually pressed as Windows then no
                //        longer sends the fake Ctrl down event. It
                //        does however happily send real Ctrl events
                //        even when AltGr is already down. Some
                //        browsers detect this for us though and set the
                //        key to "AltGraph".
                keysym = KeyTable.XK_ISO_Level3_Shift;
            } else {
                this._sendKeyEvent(KeyTable.XK_Control_L, "ControlLeft", true);
            }
        }

        // We cannot handle keys we cannot track, but we also need
        // to deal with virtual keyboards which omit key info
        if (code === 'Unidentified') {
            if (keysym) {
                // If it's a virtual keyboard then it should be
                // sufficient to just send press and release right
                // after each other
                this._sendKeyStroke(keysym, code);
            }

            stopEvent(e);
            return;
        }

        // Translate MacOs CMD based shortcuts to their CTRL based counterpart
        if (
            browser.isMac() &&
            this._translateShortcuts &&
            code !== "MetaLeft" && code !== "MetaRight" &&
            e.metaKey && !e.ctrlKey && !e.altKey
        ) {
            this._sendKeyEvent(this._keyDownList["MetaLeft"], "MetaLeft", false);
            this._sendKeyEvent(this._keyDownList["MetaRight"], "MetaRight", false);
            this._sendKeyEvent(KeyTable.XK_Control_L, "ControlLeft", true);
            this._sendKeyEvent(keysym, code, true);
            stopEvent(e);
            return;
        }

        // Alt behaves more like AltGraph on macOS, so shuffle the
        // keys around a bit to make things more sane for the remote
        // server. This method is used by RealVNC and TigerVNC (and
        // possibly others).
        if (browser.isMac() || browser.isIOS()) {
            switch (keysym) {
                case KeyTable.XK_Super_L:
                    keysym = KeyTable.XK_Alt_L;
                    break;
                case KeyTable.XK_Super_R:
                    keysym = KeyTable.XK_Super_L;
                    break;
                case KeyTable.XK_Alt_L:
                    keysym = KeyTable.XK_Mode_switch;
                    break;
                case KeyTable.XK_Alt_R:
                    keysym = KeyTable.XK_ISO_Level3_Shift;
                    break;
            }
        }

        // Is this key already pressed? If so, then we must use the
        // same keysym or we'll confuse the server
        if (code in this._keyDownList) {
            keysym = this._keyDownList[code];
        }

        // macOS doesn't send proper key events for modifiers, only
        // state change events. That gets extra confusing for CapsLock
        // which toggles on each press, but not on release. So pretend
        // it was a quick press and release of the button.
        if ((browser.isMac() || browser.isIOS()) && (code === 'CapsLock')) {
            this._sendKeyStroke(KeyTable.XK_Caps_Lock, 'CapsLock');
            stopEvent(e);
            return;
        }

        // Windows doesn't send proper key releases for a bunch of
        // Japanese IM keys so we have to fake the release right away
        const jpBadKeys = [ KeyTable.XK_Zenkaku_Hankaku,
                            KeyTable.XK_Eisu_toggle,
                            KeyTable.XK_Katakana,
                            KeyTable.XK_Hiragana,
                            KeyTable.XK_Romaji ];
        if (browser.isWindows() && jpBadKeys.includes(keysym)) {
            this._sendKeyStroke(keysym, code);
            stopEvent(e);
            return;
        }

        stopEvent(e);

        // Possible start of AltGr sequence? (see above)
        if ((code === "ControlLeft") && browser.isWindows() &&
            !("ControlLeft" in this._keyDownList)) {
            this._altGrArmed = true;
            this._altGrTimeout = setTimeout(this._handleAltGrTimeout.bind(this), 100);
            this._altGrCtrlTime = e.timeStamp;
            return;
        }

        // Hold key until layout is ready, or send immediately if no change is pending
        if (this._layoutChangePending && !isShortcut) {
            this._pendingKeys.push({ keysym, code });
        } else {
            this._sendKeyEvent(keysym, code, true);
        }
    }

    // Flush pending keys once the remote confirms the layout change
    _handleLayoutAck(e) {
        if (!e.data || !e.data.layout_ack) return;
        this._flushPendingKeys();
    }

    grab() {
        super.grab();
        // Listen for layout_ack messages from the parent frame
        window.addEventListener('message', this._eventHandlers.message);
    }

    ungrab() {
        // Stop listening for layout_ack messages
        window.removeEventListener('message', this._eventHandlers.message);
        super.ungrab();
    }
}