"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTimeSliceStart = exports.addToSlice = exports.updateSlices = exports.SLICE_DURS = exports.TimeSlice = void 0;
var utils_1 = require("../utils");
var websockets_1 = require("../websockets");
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
exports.SLICE_DURS = ["1m", "5m", "15m", "30m", "1h", "4h", "12h", "1D", "1W", "1M"];
function updateSlices(pairState, trade) {
    var _a, _b;
    var changes = [];
    var changeType;
    var changeChannel;
    if (!trade.date) {
        throw Error("Unexpected error: Trade has no date specified. " + trade.id);
    }
    exports.SLICE_DURS.forEach(function (sliceDurStr) {
        var changeChannel = "slices" + sliceDurStr;
        var sliceStart = getTimeSliceStart(trade.date, sliceDurStr);
        var durSlices = pairState.slices.get(sliceDurStr);
        if (!durSlices) {
            throw Error("Unexpected error: No duration slice map for duration " + sliceDurStr);
        }
        var newValue;
        if (durSlices.has(sliceStart)) {
            changeType = websockets_1.ChangeType.UPDATE;
            newValue = addToSlice(durSlices.get(sliceStart), trade);
        }
        else {
            changeType = websockets_1.ChangeType.ADD;
            newValue = addToSlice(new TimeSlice(sliceStart, trade.pair, trade.price, trade.price, trade.price, trade.price), trade);
        }
        durSlices.set(sliceStart, newValue);
        changes.push({ type: changeType, channel: changeChannel, data: newValue });
        pairState.slices.set(sliceDurStr, durSlices);
    });
    // calc slice24h - updated every 5 mins
    changeChannel = "slice24h";
    var sliceStartTime = getTimeSliceStart(trade.date, "24h");
    var newState;
    var oldState = pairState.slice24h;
    if (oldState) {
        changeType = websockets_1.ChangeType.UPDATE;
    }
    else {
        changeType = websockets_1.ChangeType.ADD;
    }
    if (oldState && sliceStartTime == oldState.startTime) {
        newState = addToSlice(oldState, trade);
    }
    else {
        var slicesArray = (_a = pairState.slices.get("5m")) === null || _a === void 0 ? void 0 : _a.values();
        if (slicesArray) {
            newState = Array.from(slicesArray)
                .filter(function (slice) { return slice.startTime >= sliceStartTime; })
                .sort(function (a, b) { return a.startTime - b.startTime; })
                .reduce(function (state, slice, index) {
                if (index = 0) {
                    return __assign(__assign({}, slice), { startTime: sliceStartTime });
                }
                else {
                    return __assign(__assign({}, state), { close: slice.close, high: slice.high > state.high ? slice.high : state.high, low: slice.low < state.low ? slice.low : state.low, token1Volume: state.token1Volume + slice.token1Volume, token2Volume: state.token2Volume + slice.token2Volume, noOfTrades: state.noOfTrades + slice.noOfTrades });
                }
            });
        }
        else {
            var new5mEndSlice = (_b = pairState.slices.get("5m")) === null || _b === void 0 ? void 0 : _b.get(getTimeSliceStart(trade.date, "5m"));
            newState = __assign(__assign({}, new5mEndSlice), { startTime: sliceStartTime });
        }
    }
    pairState.slice24h = newState;
    changes.push({ type: changeType, channel: changeChannel, data: newState });
    return { pairState: pairState, changes: changes };
}
exports.updateSlices = updateSlices;
function addToSlice(oldSlice, trade) {
    var newSlice = __assign(__assign({}, oldSlice), { close: trade.price, high: trade.price > oldSlice.high ? trade.price : oldSlice.high, low: trade.price < oldSlice.low ? trade.price : oldSlice.low, token1Volume: oldSlice.token1Volume + trade.quantity, token2Volume: oldSlice.token2Volume + utils_1.roundTo(8, trade.price * trade.quantity), noOfTrades: oldSlice.noOfTrades + 1 });
    return newSlice;
}
exports.addToSlice = addToSlice;
function getTimeSliceStart(date, TSDuration) {
    switch (TSDuration) {
        case "1m": return new Date(date).setUTCSeconds(0, 0);
        case "5m": {
            var oldDate = new Date(date);
            var mins = oldDate.getUTCMinutes();
            return new Date(date).setUTCMinutes(mins - (mins % 5), 0, 0);
        }
        case "15m": {
            var oldDate = new Date(date);
            var mins = oldDate.getUTCMinutes();
            return new Date(date).setUTCMinutes(mins - (mins % 15), 0, 0);
        }
        case "30m": {
            var oldDate = new Date(date);
            var mins = oldDate.getUTCMinutes();
            return new Date(date).setUTCMinutes(mins - (mins % 30), 0, 0);
        }
        case "1h": {
            var oldDate = new Date(date);
            var hours = oldDate.getUTCHours();
            return new Date(date).setUTCHours(hours, 0, 0, 0);
        }
        case "4h": {
            var oldDate = new Date(date);
            var hours = oldDate.getUTCHours();
            return new Date(date).setUTCHours(hours - (hours % 4), 0, 0, 0);
        }
        case "12h": {
            var oldDate = new Date(date);
            var hours = oldDate.getUTCHours();
            return new Date(date).setUTCHours(hours - (hours % 12), 0, 0, 0);
        }
        case "1D": {
            return new Date(date).setUTCHours(0, 0, 0, 0);
        }
        case "1W": return startOfWeek(date);
        case "1M": return startOfMonth(date);
        case "24h": {
            // console.log("Old 24h time:" + new Date(date).toUTCString());
            var oldDate = new Date(date);
            var mins = oldDate.getUTCMinutes();
            var last5m = new Date(date).setUTCMinutes(mins - (mins % 5), 0, 0);
            var day = new Date(last5m).getUTCDate();
            var newDate = new Date(last5m).setUTCDate(day - 1);
            // console.log("New 24h time:" + new Date(newDate).toUTCString());
            return newDate;
        }
        default: throw Error("Unexpected error: Unrecognised TimeSlice duration: " + TSDuration);
    }
}
exports.getTimeSliceStart = getTimeSliceStart;
function startOfWeek(date) {
    // console.log("Calculating start of week for date: "+ new Date(date).toISOString());
    var currentDate = new Date(date);
    var year = currentDate.getUTCFullYear();
    var month = currentDate.getUTCMonth();
    var dayOfMonth = currentDate.getUTCDate();
    var dayOfWeek = currentDate.getUTCDay();
    var SoW = new Date(0).setFullYear(year, month, dayOfMonth - dayOfWeek);
    // console.log("Calculated start of week: "+ new Date(SoW).toISOString());
    return SoW;
}
function startOfMonth(date) {
    // console.log("Calculating start of month for date: "+ new Date(date).toISOString());
    var currentDate = new Date(date);
    var year = currentDate.getUTCFullYear();
    var month = currentDate.getUTCMonth();
    var SoM = new Date(0).setFullYear(year, month, 1);
    // console.log("Calculated start of week: "+ new Date(SoM).toISOString());
    return SoM;
}
