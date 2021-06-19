"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Pair = void 0;
var time_slice_class_1 = require("./time-slice.class");
var Pair = /** @class */ (function () {
    function Pair(code, token1, // identifier only
    token2, token1Decimals, token2Decimals, liquidityFee, platformFee, latestTimeSlice) {
        if (code === void 0) { code = ''; }
        if (token1 === void 0) { token1 = ''; }
        if (token2 === void 0) { token2 = ''; }
        if (token1Decimals === void 0) { token1Decimals = 0; }
        if (token2Decimals === void 0) { token2Decimals = 0; }
        if (liquidityFee === void 0) { liquidityFee = 0; }
        if (platformFee === void 0) { platformFee = 0; }
        if (latestTimeSlice === void 0) { latestTimeSlice = new time_slice_class_1.TimeSlice(); }
        this.code = code;
        this.token1 = token1;
        this.token2 = token2;
        this.token1Decimals = token1Decimals;
        this.token2Decimals = token2Decimals;
        this.liquidityFee = liquidityFee;
        this.platformFee = platformFee;
        this.latestTimeSlice = latestTimeSlice;
    }
    Pair.create = function (pairObj) {
        var newPair = new Pair();
        Object.keys(newPair).forEach(function (field) {
            if (field === 'latestTimeSlice' && pairObj[field]) {
                newPair[field] = pairObj[field];
            }
            else if (pairObj[field] || typeof pairObj[field] === 'boolean') {
                // @ts-ignore
                newPair[field] = pairObj[field];
            }
            else if (Pair.requiredFields.includes(field)) {
                throw new Error(field + ' is a required field to create a pair');
            }
        });
        return newPair;
    };
    Pair.requiredFields = ['token1', 'token2'];
    return Pair;
}());
exports.Pair = Pair;
