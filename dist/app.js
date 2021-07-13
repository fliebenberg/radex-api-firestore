"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.port = exports.server = exports.db = void 0;
var Utils = __importStar(require("./utils"));
var cors_1 = __importDefault(require("cors"));
var node_fetch_1 = __importDefault(require("node-fetch"));
// initialise firestore
var firebase_admin_1 = __importDefault(require("firebase-admin"));
var serviceAccount = require("./tokenx-1551e-9b4aaa761724.json");
firebase_admin_1.default.initializeApp({
    credential: firebase_admin_1.default.credential.cert(serviceAccount)
});
exports.db = firebase_admin_1.default.firestore();
// initialise express
var express_1 = __importDefault(require("express"));
var http_1 = __importDefault(require("http"));
var app = express_1.default();
exports.server = http_1.default.createServer(app);
// set server constants
exports.port = process.env.PORT || 3000;
var firestoreUrl = "https://us-central1-tokenx-1551e.cloudfunctions.net";
//  const firestoreUrl = "http://localhost:5001/tokenx-1551e/us-central1";
// initialise websocket server
var websockets_1 = require("./websockets");
websockets_1.initWss(exports.server);
// implement express API behaviour
app.use(cors_1.default());
app.use(express_1.default.json());
// post functions
app.post("/order", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var bodyString;
    return __generator(this, function (_a) {
        bodyString = JSON.stringify(req.body);
        // console.log("Request Header: ", req.headers);
        // console.log("Received a Create order request with body "+ bodyString);
        node_fetch_1.default(firestoreUrl + "/addOrderToQHTTPFn", {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
            body: bodyString,
        }).then(function (response) { return __awaiter(void 0, void 0, void 0, function () {
            var responseText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, response.text()];
                    case 1:
                        responseText = _a.sent();
                        // console.log("Response (text):", responseText);
                        // console.log("Response (status):", response.status);
                        if (response.status == 200) {
                            res.status(200).send(responseText);
                        }
                        else {
                            res.status(response.status).send(responseText);
                        }
                        return [2 /*return*/];
                }
            });
        }); }).catch(function (error) {
            res.status(404).send("firebase error: " + error);
        });
        return [2 /*return*/];
    });
}); });
// delete functions
// cancel order
app.delete("/order", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var orderId;
    return __generator(this, function (_a) {
        orderId = req.body.order_id;
        if (!orderId) {
            res.status(400).send("No order_id specified in body of request.");
            return [2 /*return*/];
        }
        // const orderPair = orderId.split("_")[0];
        // console.log("Deleting order: " + orderId +" on pair "+ orderPair);
        node_fetch_1.default(firestoreUrl + "/cancelOrderHTTPFn", {
            method: "POST",
            headers: {
                'Content-Type': 'text/plain',
            },
            body: orderId,
        }).then(function (response) { return __awaiter(void 0, void 0, void 0, function () {
            var responseText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, response.text()];
                    case 1:
                        responseText = _a.sent();
                        // console.log("Response (text):", responseText);
                        // console.log("Response (status):", response.status);
                        if (response.status == 200) {
                            res.status(200).send(responseText);
                        }
                        else {
                            res.status(response.status).send(responseText);
                        }
                        return [2 /*return*/];
                }
            });
        }); }).catch(function (error) {
            res.status(404).send("firebase error: " + error);
        });
        return [2 /*return*/];
    });
}); });
// get functions
app.get("/", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        res.send("radex-api-firestore is working.");
        return [2 /*return*/];
    });
}); });
app.get("/tokens", function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, exports.db.collection("/tokens").get()];
            case 1:
                result = (_a.sent()).docs.map(function (doc) {
                    return doc.data();
                });
                if (!result) {
                    res.status(404).send("No tokens found");
                }
                else {
                    res.json(result);
                }
                return [2 /*return*/];
        }
    });
}); });
app.get("/token", function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var tokenId, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                tokenId = req.body.token_id;
                if (!tokenId) {
                    res.status(400).send("No token_id specified in body of request.");
                    return [2 /*return*/];
                }
                return [4 /*yield*/, exports.db.collection("/tokens").doc(tokenId).get()];
            case 1:
                result = (_a.sent()).data();
                if (!result) {
                    res.status(404).send("Token not found: " + tokenId);
                }
                else {
                    res.json(result);
                }
                return [2 /*return*/];
        }
    });
}); });
app.get("/token/pairs", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var tokenId, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                tokenId = req.body.token_id;
                if (!tokenId) {
                    res.status(400).send("No token_id specified in body of request.");
                    return [2 /*return*/];
                }
                return [4 /*yield*/, exports.db.collection("/pairs").get()];
            case 1:
                result = (_a.sent()).docs
                    .map(function (doc) { return doc.data(); })
                    .filter(function (doc) {
                    return doc.token1 == tokenId || doc.token2 == tokenId;
                });
                if (!result || result.length == 0) {
                    res.status(404).send("No pairs found for token " + tokenId);
                }
                else {
                    res.json(result);
                }
                return [2 /*return*/];
        }
    });
}); });
app.get("/pairs", function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, exports.db.collection("/pairs").get()];
            case 1:
                result = (_a.sent()).docs.map(function (doc) {
                    return doc.data();
                });
                if (!result || result.length == 0) {
                    res.status(404).send("No pairs found");
                }
                else {
                    res.json(result);
                }
                return [2 /*return*/];
        }
    });
}); });
app.get("/pair", function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var pairId, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                pairId = req.body.pair_id;
                if (!pairId) {
                    res.status(400).send("No pair_id specified in body of request.");
                    return [2 /*return*/];
                }
                return [4 /*yield*/, exports.db.collection("/pairs").doc(pairId).get()];
            case 1:
                result = (_a.sent()).data();
                if (!result) {
                    res.status(404).send("Pair not found: " + pairId);
                }
                else {
                    res.json(result);
                }
                return [2 /*return*/];
        }
    });
}); });
app.get("/pair/buy-orders", function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getPairOrdersRes("buy-orders", req, res)];
            case 1:
                res = _a.sent();
                return [2 /*return*/];
        }
    });
}); });
app.get("/pair/sell-orders", function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getPairOrdersRes("sell-orders", req, res)];
            case 1:
                res = _a.sent();
                return [2 /*return*/];
        }
    });
}); });
app.get("/pair/completed-orders", function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getPairOrdersRes("completed-orders", req, res)];
            case 1:
                res = _a.sent();
                return [2 /*return*/];
        }
    });
}); });
app.get("/pair/trades", function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getPairOrdersRes("trades", req, res)];
            case 1:
                res = _a.sent();
                return [2 /*return*/];
        }
    });
}); });
app.get("/pair/orderbook", function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var pairId, buyOrders, buyOrdersResult, sellOrders, sellOrdersResult, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                pairId = req.body.pair_id;
                if (!pairId) {
                    res.status(400).send("No pair_id specified in body of request.");
                    return [2 /*return*/];
                }
                return [4 /*yield*/, getPairOrders(pairId, "buy-orders")];
            case 1:
                buyOrders = _a.sent();
                buyOrdersResult = Utils.aggregateOrders(Utils.createOrdersMap(buyOrders));
                return [4 /*yield*/, getPairOrders(pairId, "sell-orders")];
            case 2:
                sellOrders = _a.sent();
                sellOrdersResult = Utils.aggregateOrders(Utils.createOrdersMap(sellOrders));
                result = {
                    sells: sellOrdersResult,
                    buys: buyOrdersResult
                };
                console.log("MapString: ", result);
                if (!result) {
                    res.status(404).send("Pair not found: " + pairId);
                }
                else {
                    res.json(result);
                }
                return [2 /*return*/];
        }
    });
}); });
app.get("/pair/wallet/buy-orders", function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getPairWalletRes("buy-orders", req, res)];
            case 1:
                res = _a.sent();
                return [2 /*return*/];
        }
    });
}); });
app.get("/pair/wallet/sell-orders", function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getPairWalletRes("sell-orders", req, res)];
            case 1:
                res = _a.sent();
                return [2 /*return*/];
        }
    });
}); });
app.get("/pair/wallet/completed-orders", function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getPairWalletRes("completed-orders", req, res)];
            case 1:
                res = _a.sent();
                return [2 /*return*/];
        }
    });
}); });
app.get("/pair/wallet/trades", function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, getPairWalletRes("trades", req, res)];
            case 1:
                res = _a.sent();
                return [2 /*return*/];
        }
    });
}); });
function getPairOrdersRes(orderType, req, res) {
    return __awaiter(this, void 0, void 0, function () {
        var pairId, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    pairId = req.body.pair_id;
                    if (!pairId) {
                        res.status(400).send("No pair_id specified in body of request.");
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, getPairOrders(pairId, orderType)];
                case 1:
                    result = _a.sent();
                    if (!result || result.length == 0) {
                        res.json([]);
                    }
                    else {
                        res.json(result);
                    }
                    return [2 /*return*/, res];
            }
        });
    });
}
function getPairWalletRes(orderType, req, res) {
    return __awaiter(this, void 0, void 0, function () {
        var pairId, walletId, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    pairId = req.body.pair_id;
                    walletId = req.body.wallet_id;
                    if (!pairId) {
                        res.status(400).send("No pair_id specified in body of request.");
                        return [2 /*return*/];
                    }
                    if (!walletId) {
                        res.status(400).send("No wallet_id specified in body of request.");
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, getPairOrders(pairId, orderType)];
                case 1:
                    result = (_a.sent())
                        .filter(function (order) { return order.owner == walletId || order.buyer == walletId || order.seller == walletId; });
                    if (!result || result.length == 0) {
                        res.status(404).send("No " + orderType + " found for wallet " + walletId + " in pair " + pairId);
                    }
                    else {
                        res.status(200).json(result);
                    }
                    return [2 /*return*/, res];
            }
        });
    });
}
function getPairOrders(pair, orderType) {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, exports.db.collection("/pairs/" + pair + "/" + orderType).get()];
                case 1:
                    result = (_a.sent()).docs
                        .map(function (doc) { return doc.data(); });
                    return [2 /*return*/, result];
            }
        });
    });
}
exports.server.listen(exports.port, function () {
    console.log("API server listening on port " + exports.port + "...");
});
