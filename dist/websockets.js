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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initWss = exports.ChangeType = void 0;
var ws_1 = __importDefault(require("ws"));
var app_1 = require("./app");
var trade_class_1 = require("./models/trade.class");
var order_class_1 = require("./models/order.class");
var pair_class_1 = require("./models/pair.class");
var time_slice_class_1 = require("./models/time-slice.class");
var pairState_class_1 = require("./models/pairState.class");
var serverState_class_1 = require("./models/serverState.class");
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
})(ChangeType = exports.ChangeType || (exports.ChangeType = {}));
var ClientStatus;
(function (ClientStatus) {
    ClientStatus["ALIVE"] = "ALIVE";
    ClientStatus["DEAD"] = "DEAD";
})(ClientStatus || (ClientStatus = {}));
var serverState = new serverState_class_1.ServerState();
var pairsState = serverState.pairsState;
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
        // const pairCode = newDoc.pair ? newDoc.pair : newDoc.code
        // console.log("Processing change: Type: "+ change.type +" Channel: "+ channel +" Pair: "+ pairCode);
        var changeObj;
        switch (channel) {
            case "info":
                changeObj = pair_class_1.Pair.create(newDoc);
                break;
            case "buyOrders":
                changeObj = order_class_1.Order.create(newDoc);
                break;
            case "sellOrders":
                changeObj = order_class_1.Order.create(newDoc);
                break;
            case "completedOrders":
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
            var pairState = pairsState.get(changeObj.code);
            if (pairState) {
                switch (change.type) {
                    case "added": {
                        pairState[channel] = changeObj;
                        pairsState.set(changeObj.code, pairState);
                        break;
                    }
                    case "modified": {
                        pairState[channel] = changeObj;
                        pairsState.set(changeObj.code, pairState);
                        break;
                    }
                    case "removed": {
                        (_a = pairState.listeners) === null || _a === void 0 ? void 0 : _a.forEach(function (listenerData) {
                            if (listenerData.unsub) {
                                listenerData.unsub();
                            }
                        }); // unsibscribe from DB listeners
                        pairsState.delete(changeObj.code); // delete pair from pairsDB
                        break;
                    }
                }
            }
            else if (change.type != "removed") {
                // create new PairDB
                var pairState_1 = new pairState_class_1.PairState(changeObj);
                // initialise listener map for all channels in pair
                pairState_class_1.PAIR_CHANNELS.forEach(function (pairChannel) {
                    var unsub = null;
                    if (pairState_class_1.PAIR_DB_CHANNELS.includes(pairChannel)) {
                        // console.log("Creating new pair listener: "+ DBChannel);
                        var pairPath = "/pairs/" + changeObj.code + "/" + pairState_class_1.convertDBChannel(pairChannel);
                        unsub = app_1.db.collection(pairPath).onSnapshot(function (snapshot) {
                            processDBChanges(snapshot.docChanges(), pairChannel);
                        });
                    }
                    if (pairChannel == "slices") {
                        var slices_1 = new Map();
                        time_slice_class_1.SLICE_DURS.forEach(function (sliceDur) {
                            slices_1.set(sliceDur, new Map());
                            pairState_1.listeners.set(pairChannel + sliceDur, { seq: 0, clients: new Set(), unsub: unsub });
                        });
                        pairState_1.slices = slices_1;
                    }
                    else {
                        pairState_1.listeners.set(pairChannel, { seq: 0, clients: new Set(), unsub: unsub });
                    }
                });
                pairsState.set(changeObj.code, pairState_1);
            }
        }
        else {
            console.log("Change detected: Type " + change.type + " Channel: " + channel + " Pair: " + changeObj.pair + " Doc: " + changeObj.id);
            var pairState = pairsState.get(changeObj.pair);
            if (pairState) {
                switch (change.type) {
                    case "added": {
                        (_b = pairState[channel]) === null || _b === void 0 ? void 0 : _b.set(changeObj.id, changeObj);
                        break;
                    }
                    case "modified": {
                        (_c = pairState[channel]) === null || _c === void 0 ? void 0 : _c.set(changeObj.id, changeObj);
                        break;
                    }
                    case "removed": {
                        (_d = pairState[channel]) === null || _d === void 0 ? void 0 : _d.delete(changeObj.id);
                        break;
                    }
                }
                if (change.type != "removed" && channel == "trades") {
                    var result = time_slice_class_1.updateSlices(pairState, changeObj);
                    pairState = result.pairState;
                    sendChangesToSubs(changeObj.pair, result.changes);
                }
                pairsState.set(changeObj.pair, pairState);
                sendChangesToSubs(changeObj.pair, [createChangeRec(change, channel)]);
            }
            else {
                console.log("Unexpected error (ignored): Received DB update for unrecognised pair.", changeObj);
            }
        }
    });
}
// message handlers
function handleMsgSubscribe(message, client) {
    var _a, _b, _c, _d, _e;
    if (message.channel === "all" && message.symbol) {
        pairState_class_1.PAIR_CHANNELS
            .filter(function (channel) { return channel != "slices"; })
            .forEach(function (channel) {
            var newMsg = __assign(__assign({}, message), { channel: channel });
            handleMsgSubscribe(newMsg, client);
        });
    }
    else if (message.channel == "listeners") {
        return; // clinet cannot subscribe to listeners channel in pair
    }
    else if (message.channel.includes("allpairs")) {
    }
    else if (message.channel == "slices" || message.channel.includes("slices")) {
        if (message.symbol && pairsState.has(message.symbol)) {
            if (message.slice_dur && time_slice_class_1.SLICE_DURS.includes(message.slice_dur)) {
                (_b = (_a = pairsState.get(message.symbol)) === null || _a === void 0 ? void 0 : _a.listeners.get(message.channel + message.slice_dur)) === null || _b === void 0 ? void 0 : _b.clients.add(client);
                sendText(client, "Successfully subscribed client to slices with duration " + message.slice_dur);
            }
            else {
                console.log("ERROR. Unknown or unspecified slice duration", message);
                sendError(client, "Could not subscribe to channel: " + message.channel + ". Unknown or unspecified slice duration: " + message.slice_dur);
            }
        }
        else {
            sendError(client, "Could not subscribe client to channel: " + message.channel + ". Unknown or unspecified symbol: " + message.symbol);
        }
    }
    else if (pairState_class_1.PAIR_CHANNELS.includes(message.channel)) {
        if (message.symbol && pairsState.has(message.symbol)) {
            (_e = (_d = (_c = pairsState.get(message.symbol)) === null || _c === void 0 ? void 0 : _c.listeners) === null || _d === void 0 ? void 0 : _d.get(message.channel)) === null || _e === void 0 ? void 0 : _e.clients.add(client);
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
    var channel = "";
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
function sendChangesToSubs(pair, changes) {
    changes.forEach(function (change) {
        var _a, _b;
        // console.log("Sending change to subs", change);
        if (pair) {
            var listener_1 = (_b = (_a = pairsState.get(pair)) === null || _a === void 0 ? void 0 : _a.listeners) === null || _b === void 0 ? void 0 : _b.get(change.channel);
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
                        (_b = (_a = pairsState.get(pair)) === null || _a === void 0 ? void 0 : _a.listeners) === null || _b === void 0 ? void 0 : _b.set(change.channel, listener_1);
                    }
                });
            }
        }
    });
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
