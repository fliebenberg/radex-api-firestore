"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertDBChannel = exports.PAIR_CHANNELS = exports.PAIR_DB_CHANNELS = exports.PairState = void 0;
var PairState = /** @class */ (function () {
    function PairState(info, trades, buyOrders, sellOrders, completedOrders, orderbook, listeners, slices, slice24h) {
        if (info === void 0) { info = null; }
        if (trades === void 0) { trades = new Map(); }
        if (buyOrders === void 0) { buyOrders = new Map(); }
        if (sellOrders === void 0) { sellOrders = new Map(); }
        if (completedOrders === void 0) { completedOrders = new Map(); }
        if (orderbook === void 0) { orderbook = null; }
        if (listeners === void 0) { listeners = new Map(); }
        if (slices === void 0) { slices = new Map(); }
        if (slice24h === void 0) { slice24h = null; }
        this.info = info;
        this.trades = trades;
        this.buyOrders = buyOrders;
        this.sellOrders = sellOrders;
        this.completedOrders = completedOrders;
        this.orderbook = orderbook;
        this.listeners = listeners;
        this.slices = slices;
        this.slice24h = slice24h;
    }
    return PairState;
}());
exports.PairState = PairState;
exports.PAIR_DB_CHANNELS = ["trades", "buyOrders", "sellOrders", "completedOrders"];
exports.PAIR_CHANNELS = __spreadArray(["orderbook", "listeners", "slices", "slice24h"], exports.PAIR_DB_CHANNELS);
function convertDBChannel(channel) {
    switch (channel) {
        case "trades": return "trades";
        case "buyOrders": return "buy-orders";
        case "sellOrders": return "sell-orders";
        case "completedOrders": return "completed-orders";
        default: throw Error("Unexpected error: Unrecognised DBChannel: " + channel);
    }
}
exports.convertDBChannel = convertDBChannel;
