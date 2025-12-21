import BaseKeyboard from "./keyboard.js";
import * as Log from "../util/logging.js";

export default class CustomKeyboard extends BaseKeyboard {
    constructor(screenInput, touchInput, keyboardInput) {
        super(screenInput, touchInput, keyboardInput);

        this._Layout = "us"; // We add this to fix keyboard issue
        this._lastLayoutChangeAt = 0; // (added) debounce timestamp
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
        if (now - this._lastLayoutChangeAt < 150) {
            return;
        }

        this._Layout = layout;
        this._lastLayoutChangeAt = now;
        window.parent.postMessage({ layout: this._Layout }, "*");
    }

    _handleKeyDown(e) {
        Log.Debug("Key Down (custom): " + e.keyCode + " isComposing: " + e.isComposing);

        if (e.isComposing || e.keyCode === 229) {
            Log.Debug("Skipping keydown, IME interaction, keycode: " + e.keyCode);
            return;
        }
        // we added this line to disable window keys
        if (e.keyCode === 91 || e.keyCode === 92) {
            return;
        }
        // Do not switch on space
        if (e.keyCode !== 32) {
            this._switchLayout(this._detectLayout(e.key));
        }

        return super._handleKeyDown(e);
    }
}

