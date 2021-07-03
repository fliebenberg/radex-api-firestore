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
var __spreadArray = (this && this.__spreadArray) || function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initWss = void 0;
var ws_1 = __importDefault(require("ws"));
var app_1 = require("./app");
var trade_class_1 = require("./models/trade.class");
var order_class_1 = require("./models/order.class");
var pair_class_1 = require("./models/pair.class");
var MsgMethod;
(function (MsgMethod) {
    MsgMethod["TEXT"] = "TEXT";
    MsgMethod["SUBSCRIBE"] = "SUBSCRIBE";
    MsgMethod["UNSUBSCRIBE"] = "UNSUBSCRIBE";
    MsgMethod["NEWORDER"] = "NEWORDER";
    MsgMethod["CANCELORDER"] = "CANCELORDER";
    MsgMethod["UPDATE"] = "UPDATE";
    MsgMethod["ERROR"] = "ERROR";
})(MsgMethod || (MsgMethod = {}));
var ChangeType;
(function (ChangeType) {
    ChangeType["ADD"] = "ADD";
    ChangeType["UPDATE"] = "UPDATE";
    ChangeType["DELETE"] = "DELETE";
})(ChangeType || (ChangeType = {}));
var ClientStatus;
(function (ClientStatus) {
    ClientStatus["ALIVE"] = "ALIVE";
    ClientStatus["DEAD"] = "DEAD";
})(ClientStatus || (ClientStatus = {}));
var DBPairChannelArray = ["trades", "buy-orders", "sell-orders", "completed-orders"];
var pairChannelArray = __spreadArray(__spreadArray(["info"], DBPairChannelArray), ["slices", "book"]);
var SliceDurArray = ["1m", "5m", "15m", "30m", "1hr", "4h", "12h", "1D", "1W", "1M"];
var pairsDB = new Map();
// const pairMap = new Map<string, PairData>()
// const listeners = new Map<string, ListenerData>();
var clientStatusMap = new Map();
var checkClientStatusInterval = 5000;
function initWss(server) {
    var wss = new ws_1.default.Server({ server: server });
    setupDBListeners();
    wss.on("listening", function () {
        console.log("Websocket server is listening on " + app_1.port + "...");
    });
    wss.on("connection", function (client) {
        console.log("New websocket client connected");
        clientStatusMap.set(client, ClientStatus.ALIVE);
        sendText(client, "Welcome new wss client!");
        client.on("message", function (messageStr) {
            console.log("Received message from client: ", messageStr);
            var message = JSON.parse(messageStr);
            switch (message.method) {
                case MsgMethod.TEXT:
                    console.log("Received TEXT message:", message.text);
                    break;
                case MsgMethod.SUBSCRIBE:
                    handleMsgSubscribe(message, client);
                    break;
                default:
                    sendText(client, "Non-Valid message method: " + message.method + ".", MsgMethod.ERROR);
            }
        });
        client.on("ping", function () {
            client.pong();
        });
        client.on("pong", function () {
            // console.log("Received PONG from client");
            clientStatusMap.set(client, ClientStatus.ALIVE);
        });
        client.on("close", function () {
            closeClient(client);
        });
    });
    // setup interval to check client liveness
    var clientInterval = setInterval(checkClientStatus, checkClientStatusInterval);
    wss.on("close", function () {
        console.log("Websocket Server closed");
        clearInterval(clientInterval);
    });
    return wss;
}
exports.initWss = initWss;
function setupDBListeners() {
    app_1.db.collection("pairs").onSnapshot(function (snapshot) {
        processDBChanges(snapshot.docChanges(), "info");
    });
}
function processDBChanges(changes, channel) {
    changes.forEach(function (change) {
        var _a, _b, _c, _d;
        var newDoc = change.doc.data();
        var pairCode = newDoc.pair ? newDoc.pair : newDoc.code;
        // console.log("Processing change: Type: "+ change.type +" Channel: "+ channel +" Pair: "+ pairCode);
        var changeObj;
        switch (channel) {
            case "info":
                changeObj = pair_class_1.Pair.create(newDoc);
                break;
            case "buy-orders":
                changeObj = order_class_1.Order.create(newDoc);
                break;
            case "sell-orders":
                changeObj = order_class_1.Order.create(newDoc);
                break;
            case "completed-orders":
                changeObj = order_class_1.Order.create(newDoc);
                break;
            case "trades":
                changeObj = trade_class_1.Trade.create(newDoc);
                break;
            default: return;
        }
        if (!changeObj) {
            throw Error("Unexpected error: Could not create DB changeObj.");
        }
        if (channel == "info") {
            var pairDB = pairsDB.get(changeObj.code);
            if (pairDB) {
                switch (change.type) {
                    case "added": {
                        pairDB[channel] = changeObj;
                        pairsDB.set(changeObj.code, pairDB);
                        break;
                    }
                    case "modified": {
                        pairDB[channel] = changeObj;
                        pairsDB.set(changeObj.code, pairDB);
                        break;
                    }
                    case "removed": {
                        (_a = pairDB.listeners) === null || _a === void 0 ? void 0 : _a.forEach(function (listenerData) {
                            if (listenerData.unsub) {
                                listenerData.unsub();
                            }
                        }); // unsibscribe from DB listeners
                        pairsDB.delete(changeObj.code); // delete pair from pairsDB
                        break;
                    }
                }
            }
            else if (change.type != "removed") {
                var pairDB_1 = { info: changeObj, listeners: new Map() };
                // initialise listener map for all channels in pair
                var newListener_1 = { seq: 0, clients: new Set(), unsub: null };
                pairChannelArray.forEach(function (pairChannel) {
                    var _a;
                    (_a = pairDB_1.listeners) === null || _a === void 0 ? void 0 : _a.set(pairChannel, newListener_1);
                });
                // subscribe to feeds from DB for pair
                DBPairChannelArray.forEach(function (DBChannel) {
                    var _a;
                    // console.log("Creating new pair listener: "+ DBChannel);
                    var unsub = app_1.db.collection("/pairs/" + changeObj.code + "/" + DBChannel).onSnapshot(function (snapshot) {
                        console.log("CHange detected for channel " + DBChannel + " in pair " + changeObj.code);
                        processDBChanges(snapshot.docChanges(), DBChannel);
                    });
                    (_a = pairDB_1.listeners) === null || _a === void 0 ? void 0 : _a.set(DBChannel, __assign(__assign({}, newListener_1), { unsub: unsub }));
                });
                pairsDB.set(changeObj.code, pairDB_1);
            }
        }
        else {
            var pairDB = pairsDB.get(changeObj.pair);
            if (pairDB) {
                switch (change.type) {
                    case "added": {
                        (_b = pairDB[channel]) === null || _b === void 0 ? void 0 : _b.set(changeObj.id, changeObj);
                        break;
                    }
                    case "modified": {
                        (_c = pairDB[channel]) === null || _c === void 0 ? void 0 : _c.set(changeObj.id, changeObj);
                        break;
                    }
                    case "removed": {
                        (_d = pairDB[channel]) === null || _d === void 0 ? void 0 : _d.delete(changeObj.id);
                        break;
                    }
                }
                pairsDB.set(changeObj.pair, pairDB);
                sendChangeToSubs(changeObj.pair, createChangeRec(change, channel));
            }
            else {
                console.log("Unexpected error (ignored): Received DB update for unrecognised pair.", changeObj);
            }
        }
    });
}
// message handlers
function handleMsgSubscribe(message, client) {
    var _a, _b, _c;
    if (message.channel === "all" && message.symbol) {
        pairChannelArray.forEach(function (channel) {
            var newMsg = __assign(__assign({}, message), { channel: channel });
            handleMsgSubscribe(newMsg, client);
        });
    }
    else if (message.channel.includes("allpairs")) {
    }
    else if (pairChannelArray.includes(message.channel)) {
        if (message.symbol && Array.from(pairsDB.keys()).includes(message.symbol)) {
            (_c = (_b = (_a = pairsDB.get(message.symbol)) === null || _a === void 0 ? void 0 : _a.listeners) === null || _b === void 0 ? void 0 : _b.get(message.channel)) === null || _c === void 0 ? void 0 : _c.clients.add(client);
        }
        else {
            sendError(client, "Could not subscribe client to channel: " + message.channel + ". Unknown or unspecified symbol: " + message.symbol);
        }
        sendText(client, "Successfully subscribed client to channel: " + message.channel);
    }
    else {
        sendError(client, "Could not subscribe client to specified channel: " + message.channel);
    }
}
function createListenerId(channel, symbol) {
    var listenerId = "";
    if (!channel) {
        return "Error: No channel specified for listenerId";
    }
    if (channel.includes("allpairs")) {
        listenerId = channel;
    }
    else { // pair specific channels
        if (!symbol) {
            return "Error: No symbol specified for listenerId";
        }
        listenerId = symbol + ":" + channel;
    }
    return listenerId;
}
function parseListenerId(listenerId) {
    var channel = "trades";
    var symbol = "";
    var extra = "";
    if (listenerId) {
        var parts = listenerId.split(":");
        if (parts.length === 1) {
            channel = parts[0];
        }
        else if (parts.length >= 2) {
            symbol = parts[0];
            channel = parts[1];
            if (parts.length > 2) {
                extra = parts[2];
            }
        }
    }
    else {
        throw Error("Unexpected error: no listenerId provided for function parseListenerId");
    }
    return { channel: channel, symbol: symbol, extra: extra };
}
var checkClientStatus = function (wss) {
    // console.log("Checking client statuses...", clientStatusMap.size);
    clientStatusMap.forEach(function (status, client) {
        // console.log("For client");
        if (!client || status === ClientStatus.DEAD) {
            console.log("Client DEAD. Closing client");
            closeClient(client);
        }
        else {
            // console.log("Client still alive...")
            clientStatusMap.set(client, ClientStatus.DEAD);
            client.ping();
        }
    });
};
function closeClient(client) {
    console.log("Closing client connection");
    client.close();
    clientStatusMap.delete(client);
}
function sendText(client, msg, method) {
    if (method === void 0) { method = MsgMethod.TEXT; }
    client.send(JSON.stringify({ method: method, text: msg }));
}
function sendError(client, msg) {
    sendText(client, msg, MsgMethod.ERROR);
}
function sendChangeToSubs(pair, change) {
    var _a, _b;
    // console.log("Sending change to subs", change);
    if (pair) {
        var listener_1 = (_b = (_a = pairsDB.get(pair)) === null || _a === void 0 ? void 0 : _a.listeners) === null || _b === void 0 ? void 0 : _b.get(change.channel);
        if (listener_1) {
            listener_1.seq++;
            listener_1.clients.forEach(function (client) {
                var _a, _b;
                if (client.readyState == 1) {
                    var returnMsg = {
                        method: MsgMethod.UPDATE,
                        channel: change.channel,
                        seq: listener_1.seq,
                        change: change,
                    };
                    if (pair) {
                        returnMsg.symbol = pair;
                    }
                    client.send(JSON.stringify(returnMsg));
                }
                else {
                    console.log("Removing non-open client from subscribed clients for listenerId " + createListenerId(change.channel, pair));
                    listener_1.clients.delete(client); // remove client from subs if no longer open
                    (_b = (_a = pairsDB.get(pair)) === null || _a === void 0 ? void 0 : _a.listeners) === null || _b === void 0 ? void 0 : _b.set(change.channel, listener_1);
                }
            });
        }
    }
}
function createChangeRec(change, channel) {
    return {
        type: convertChangeType(change.type),
        channel: channel,
        data: change.doc.data()
    };
}
function convertChangeType(type) {
    switch (type) {
        case "added":
            return ChangeType.ADD;
        case "modified":
            return ChangeType.UPDATE;
        case "removed":
            return ChangeType.DELETE;
        default:
            throw Error("Unexpected error: Unrecognised firestore document change type: " + type);
    }
}
