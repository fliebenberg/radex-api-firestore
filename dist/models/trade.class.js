"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Trade = exports.TradeFeePayer = void 0;
var TradeFeePayer;
(function (TradeFeePayer) {
    TradeFeePayer["EMPTY"] = "";
    TradeFeePayer["BUYER"] = "BUYER";
    TradeFeePayer["SELLER"] = "SELLER";
})(TradeFeePayer = exports.TradeFeePayer || (exports.TradeFeePayer = {}));
var Trade = /** @class */ (function () {
    function Trade(id, pair, buyer, buyOrderId, seller, sellOrderId, token1, token2, quantity, price, feePayer, feeToken, liquidityFee, platformFee, date, parties) {
        if (id === void 0) { id = ''; }
        if (pair === void 0) { pair = ''; }
        if (buyer === void 0) { buyer = ''; }
        if (buyOrderId === void 0) { buyOrderId = ''; }
        if (seller === void 0) { seller = ''; }
        if (sellOrderId === void 0) { sellOrderId = ''; }
        if (token1 === void 0) { token1 = ''; }
        if (token2 === void 0) { token2 = ''; }
        if (quantity === void 0) { quantity = 0; }
        if (price === void 0) { price = 0; }
        if (feePayer === void 0) { feePayer = TradeFeePayer.EMPTY; }
        if (feeToken === void 0) { feeToken = ''; }
        if (liquidityFee === void 0) { liquidityFee = 0; }
        if (platformFee === void 0) { platformFee = 0; }
        if (date === void 0) { date = new Date().getTime(); }
        if (parties === void 0) { parties = []; }
        this.id = id;
        this.pair = pair;
        this.buyer = buyer;
        this.buyOrderId = buyOrderId;
        this.seller = seller;
        this.sellOrderId = sellOrderId;
        this.token1 = token1;
        this.token2 = token2;
        this.quantity = quantity;
        this.price = price;
        this.feePayer = feePayer;
        this.feeToken = feeToken;
        this.liquidityFee = liquidityFee;
        this.platformFee = platformFee;
        this.date = date;
        this.parties = parties;
    }
    Trade.create = function (tradeObj) {
        var newTrade = new Trade();
        Object.keys(newTrade).forEach(function (field) {
            if (tradeObj[field]) {
                // @ts-ignore
                newTrade[field] = tradeObj[field];
            }
            else if (Trade.requiredFields.includes(field)) {
                throw new Error(field + ' is a required field to create a trade');
            }
        });
        if (newTrade.parties.length === 0) {
            newTrade.parties = [newTrade.buyer, newTrade.seller];
        }
        return newTrade;
    };
    Trade.requiredFields = [
        'buyer',
        'buyQuantity',
        'buyOrderId',
        'seller',
        'sellQuantity',
        'sellOrderId',
        'token1',
        'token2',
        'feePayer',
    ];
    return Trade;
}());
exports.Trade = Trade;
