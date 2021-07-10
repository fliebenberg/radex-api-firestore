"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerState = void 0;
var ServerState = /** @class */ (function () {
    function ServerState(pairsState, listeners) {
        if (pairsState === void 0) { pairsState = new Map(); }
        if (listeners === void 0) { listeners = new Map(); }
        this.pairsState = pairsState;
        this.listeners = listeners;
    }
    return ServerState;
}());
exports.ServerState = ServerState;
