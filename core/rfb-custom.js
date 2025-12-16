import RFB from './rfb.js';

export default class RFBCustom extends RFB {
  constructor(target, touchInput, urlOrChannel, options = {}, isPrimaryDisplay) {
    super(target, touchInput, urlOrChannel, options, isPrimaryDisplay);

    this._autoKeepAlive = options.autoKeepAlive !== false;
    this._keepAliveDelayMs = Number.isInteger(options.keepAliveDelayMs)
      ? options.keepAliveDelayMs
      : 500;

    this._throttledKeepAlive = this._autoKeepAlive
      ? this._createThrottledKeepAlive(this._keepAliveDelayMs)
      : null;
  }

  _createThrottledKeepAlive(delayMs) {
    return this._throttleHandler(this.sendKeepAlive.bind(this), delayMs);
  }

  _throttleHandler(mainFunction, delayMs) {
    let isRunning = false;

    return (...args) => {
      if (isRunning) return;

      isRunning = true;
      try {
        mainFunction(...args);
      } finally {
        setTimeout(() => {
          isRunning = false;
        }, delayMs);
      }
    };
  }

  _setLastActive() {
    super._setLastActive();

    if (this._autoKeepAlive && this._throttledKeepAlive) {
      this._throttledKeepAlive();
    }
  }

  _handleWheel(ev) {
    this._setLastActive();
    return super._handleWheel(ev);
  }

  _handleFocusChange(event) {
    this._setLastActive();
    return super._handleFocusChange(event);
  }

  _handleVisibilityChange(event) {
    this._setLastActive();
    return super._handleVisibilityChange(event);
  }

  setAutoKeepAlive(enabled, delayMs) {
    this._autoKeepAlive = !!enabled;

    if (!this._autoKeepAlive) {
      this._throttledKeepAlive = null;
      return;
    }

    if (Number.isInteger(delayMs)) {
      this._keepAliveDelayMs = delayMs;
    }

    this._throttledKeepAlive = this._createThrottledKeepAlive(
      this._keepAliveDelayMs
    );
  }
}
