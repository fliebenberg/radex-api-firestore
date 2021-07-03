"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeSlice = void 0;
var TimeSlice = /** @class */ (function () {
    function TimeSlice(startTime, pair, open, close, high, low, token1Volume, token2Volume, noOfTrades) {
        if (startTime === void 0) { startTime = 0; }
        if (pair === void 0) { pair = ""; }
        if (open === void 0) { open = 0; }
        if (close === void 0) { close = 0; }
        if (high === void 0) { high = 0; }
        if (low === void 0) { low = 0; }
        if (token1Volume === void 0) { token1Volume = 0; }
        if (token2Volume === void 0) { token2Volume = 0; }
        if (noOfTrades === void 0) { noOfTrades = 0; }
        this.startTime = startTime;
        this.pair = pair;
        this.open = open;
        this.close = close;
        this.high = high;
        this.low = low;
        this.token1Volume = token1Volume;
        this.token2Volume = token2Volume;
        this.noOfTrades = noOfTrades;
    }
    return TimeSlice;
}());
exports.TimeSlice = TimeSlice;
