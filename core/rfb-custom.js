import RFB from "./rfb.js";

export default class RFBCustom extends RFB {
  constructor(target, touchInput, urlOrChannel, options, isPrimaryDisplay) {
    super(target, touchInput, urlOrChannel, options, isPrimaryDisplay);

    // Wheel compatibility fix:
    // KasmVNC can forward wheel events in dense bursts. Some apps, especially
    // Google Earth, react poorly to those bursts. Keep KasmVNC's original
    // scroll semantics and delta values, but limit the event frequency.
    this._lastWheelSendTime = 0;
    this._wheelMinIntervalMs = 45;
  }

  _sendScroll(x, y, dX, dY) {
    const now = Date.now();

    if (now - this._lastWheelSendTime < this._wheelMinIntervalMs) {
      return;
    }

    this._lastWheelSendTime = now;

    return super._sendScroll(x, y, dX, dY);
  }
}