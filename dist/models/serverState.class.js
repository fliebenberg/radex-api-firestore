"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerState = void 0;
var ServerState = /** @class */ (function () {
    function ServerState(pairsState) {
        if (pairsState === void 0) { pairsState = new Map(); }
        this.pairsState = pairsState;
    }
    return ServerState;
}());
exports.ServerState = ServerState;
