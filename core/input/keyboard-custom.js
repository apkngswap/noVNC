import BaseKeyboard from "./keyboard.js";
import * as Log from "../util/logging.js";

export default class CustomKeyboard extends BaseKeyboard {
    constructor(screenInput, touchInput, keyboardInput) {
        super(screenInput, touchInput, keyboardInput);

        this._Layout = "us";
        this._lastLayoutChangeAt = 0;
    }

    _detectLayout(key) {
        if (!key || key.length !== 1) return null;

        const isPersian = /[\u0600-\u06FF]/.test(key);
        const isLatin   = /[A-Za-z]/.test(key);

        if (isPersian) return "ir";
        if (isLatin)   return "us";
        return null;
    }

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

        if (e.keyCode === 91 || e.keyCode === 92) {
            return;
        }

        if (e.keyCode !== 32) {
            this._switchLayout(this._detectLayout(e.key));
        }

        return super._handleKeyDown(e);
    }
}

