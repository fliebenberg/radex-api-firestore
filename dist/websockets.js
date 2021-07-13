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
exports.initWss = exports.ChangeType = void 0;
var ws_1 = __importDefault(require("ws"));
var app_1 = require("./app");
var trade_class_1 = require("./models/trade.class");
var order_class_1 = require("./models/order.class");
var pair_class_1 = require("./models/pair.class");
var time_slice_class_1 = require("./models/time-slice.class");
var pairState_class_1 = require("./models/pairState.class");
var serverState_class_1 = require("./models/serverState.class");
var utils_1 = require("./utils");
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
    return __awaiter(this, void 0, void 0, function () {
        var wss, clientInterval;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("Initializing websocket server");
                    setupDBListeners();
                    console.log("Waiting 10 seconds for database to load...");
                    return [4 /*yield*/, delay(10000)];
                case 1:
                    _a.sent();
                    console.log("Waited 10 seconds for database to load...");
                    wss = new ws_1.default.Server({ server: server });
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
                                    handleMsgSub(message, client);
                                    break;
                                case MsgMethod.UNSUBSCRIBE:
                                    handleMsgUnsub(message, client);
                                    break;
                                case MsgMethod.NEWORDER:
                                    break;
                                default:
                                    // console.log("ERROR! Non valid message method.", message);
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
                    clientInterval = setInterval(checkClientStatus, checkClientStatusInterval);
                    wss.on("close", function () {
                        console.log("Websocket Server closed");
                        clearInterval(clientInterval);
                    });
                    return [2 /*return*/, wss];
            }
        });
    });
}
exports.initWss = initWss;
function delay(ms) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, new Promise(function (res) { return setTimeout(res, ms); })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
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
                        // console.log("Creating new pair listener: "+ pairChannel, changeObj);
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
                var oldObj = null;
                switch (change.type) {
                    case "added": {
                        (_b = pairState[channel]) === null || _b === void 0 ? void 0 : _b.set(changeObj.id, changeObj);
                        break;
                    }
                    case "modified": {
                        oldObj = pairState[channel].get(changeObj.id);
                        (_c = pairState[channel]) === null || _c === void 0 ? void 0 : _c.set(changeObj.id, changeObj);
                        break;
                    }
                    case "removed": {
                        (_d = pairState[channel]) === null || _d === void 0 ? void 0 : _d.delete(changeObj.id);
                        break;
                    }
                }
                // update orderbook
                if (channel == "buyOrders" || channel == "sellOrders") {
                    var orderbookChannel = channel == "buyOrders" ? "orderbookBuys" : "orderbookSells";
                    var oldOrder = change.type == "modified" ? order_class_1.Order.create(oldObj) : null;
                    var newEntry = utils_1.updateOrderbookEntry(change.type, changeObj, pairState[orderbookChannel].get(changeObj.price), oldOrder);
                    var orderbookChange = {
                        type: newEntry ? ChangeType.UPDATE : ChangeType.DELETE,
                        channel: orderbookChannel,
                        data: newEntry ? newEntry : changeObj.price,
                    };
                    if (newEntry) {
                        pairState[orderbookChannel] = pairState[orderbookChannel].set(changeObj.price, newEntry);
                    }
                    else {
                        var newState = pairState[orderbookChannel];
                        newState.delete(changeObj.price);
                        pairState[orderbookChannel] = newState;
                    }
                    sendChangesToSubs(changeObj.pair, [orderbookChange]);
                }
                // update slices
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
function handleMsgSub(message, client) {
    var _a, _b, _c, _d, _e;
    if (message.channel == "listeners") {
        return; // client cannot subscribe to listeners channel
    }
    else if (message.channel == "allpairs" || message.channel == "tickers") {
        var channelStr_1 = message.channel == "allpairs" ? "info" : "slice24h";
        serverState.pairsState.forEach(function (pairState) {
            var _a, _b;
            (_a = pairState.listeners.get(channelStr_1)) === null || _a === void 0 ? void 0 : _a.clients.add(client);
            sendDataOnSub(client, (_b = pairState === null || pairState === void 0 ? void 0 : pairState.info) === null || _b === void 0 ? void 0 : _b.code, channelStr_1);
        });
    }
    else if (message.channel == "slices" || message.channel.includes("slices")) {
        if (message.pair && pairsState.has(message.pair)) {
            var sliceDur = message.channel.slice(6);
            if (sliceDur && time_slice_class_1.SLICE_DURS.includes(sliceDur)) {
                sendDataOnSub(client, message.pair, message.channel);
                (_b = (_a = pairsState.get(message.pair)) === null || _a === void 0 ? void 0 : _a.listeners.get(message.channel)) === null || _b === void 0 ? void 0 : _b.clients.add(client);
                sendText(client, "Successfully subscribed client to slices with duration " + sliceDur);
            }
            else {
                console.log("ERROR. Unknown or unspecified slice duration", message);
                sendError(client, "Could not subscribe to channel: " + message.channel + " Unknown slice duration.");
            }
        }
        else {
            sendError(client, "Could not subscribe client to channel: " + message.channel + ". Unknown or unspecified pair: " + message.pair);
        }
    }
    else if (pairState_class_1.PAIR_CHANNELS.includes(message.channel)) {
        if (message.pair && pairsState.has(message.pair)) {
            sendDataOnSub(client, message.pair, message.channel);
            (_e = (_d = (_c = pairsState.get(message.pair)) === null || _c === void 0 ? void 0 : _c.listeners) === null || _d === void 0 ? void 0 : _d.get(message.channel)) === null || _e === void 0 ? void 0 : _e.clients.add(client);
            sendText(client, "Successfully subscribed client to channel: " + message.channel);
        }
        else {
            sendError(client, "Could not subscribe client to channel: " + message.channel + ". Unknown or unspecified pair: " + message.pair);
        }
    }
    else {
        sendError(client, "Could not subscribe client to specified channel: " + message.channel);
    }
}
function handleMsgUnsub(message, client) {
    var _a, _b, _c, _d, _e;
    if (message.channel === "all" && message.pair) {
        pairState_class_1.PAIR_CHANNELS
            .filter(function (channel) { return channel != "slices"; })
            .forEach(function (channel) {
            var newMsg = __assign(__assign({}, message), { channel: channel });
            handleMsgUnsub(newMsg, client);
        });
    }
    else if (message.channel == "listeners") {
        return; // client cannot subscribe to listeners channel
    }
    else if (message.channel == "allpairs" || message.channel == "tickers") {
        serverState.pairsState.forEach(function (pairState) {
            var _a;
            var channelStr = message.channel == "allpairs" ? "info" : "slice24h";
            (_a = pairState.listeners.get(channelStr)) === null || _a === void 0 ? void 0 : _a.clients.delete(client);
        });
        sendText(client, "Successfully unsubscribed client from " + message.channel);
    }
    else if (message.channel == "slices" || message.channel.includes("slices")) {
        if (message.pair && pairsState.has(message.pair)) {
            var sliceDur = message.channel.slice(6);
            if (sliceDur && time_slice_class_1.SLICE_DURS.includes(sliceDur)) {
                (_b = (_a = pairsState.get(message.pair)) === null || _a === void 0 ? void 0 : _a.listeners.get(message.channel)) === null || _b === void 0 ? void 0 : _b.clients.delete(client);
                sendText(client, "Successfully unsubscribed client from slices with duration " + sliceDur);
            }
            else {
                console.log("ERROR. Unknown or unspecified slice duration", message);
                sendError(client, "Could not unsubscribe from channel: " + message.channel + " Unknown slice duration.");
            }
        }
        else {
            sendError(client, "Could not unsubscribe client from channel: " + message.channel + ". Unknown or unspecified pair: " + message.pair);
        }
    }
    else if (pairState_class_1.PAIR_CHANNELS.includes(message.channel)) {
        if (message.pair && pairsState.has(message.pair)) {
            (_e = (_d = (_c = pairsState.get(message.pair)) === null || _c === void 0 ? void 0 : _c.listeners) === null || _d === void 0 ? void 0 : _d.get(message.channel)) === null || _e === void 0 ? void 0 : _e.clients.delete(client);
            sendText(client, "Successfully unsubscribed client from channel: " + message.channel);
        }
        else {
            sendError(client, "Could not unsubscribe client from channel: " + message.channel + ". Unknown or unspecified pair: " + message.pair);
        }
    }
    else {
        sendError(client, "Could not unsubscribe client from specified channel: " + message.channel);
    }
}
function sendDataOnSub(client, pair, channel) {
    var _a, _b;
    console.log("Sending first time subscribe data for pair " + pair + " and channel " + channel);
    var changes = [];
    if (pair && pairsState.has(pair)) {
        var pairState = pairsState.get(pair);
        channel = channel;
        if (pairState) {
            var seq = (_a = pairState.listeners.get(channel)) === null || _a === void 0 ? void 0 : _a.seq;
            if (channel == "info" || channel == "slice24h") {
                var data = pairState[channel];
                changes.push({
                    type: ChangeType.ADD,
                    channel: channel,
                    data: data,
                });
            }
            else if (pairState_class_1.PAIR_DB_CHANNELS.includes(channel) || channel == "orderbookBuys" || channel == "orderbookSells") {
                pairState[channel].forEach(function (value) {
                    changes.push({
                        type: ChangeType.ADD,
                        channel: channel,
                        data: value
                    });
                });
            }
            else if (channel.includes("slices")) {
                var sliceDur = channel.slice(6);
                (_b = pairState["slices"].get(sliceDur)) === null || _b === void 0 ? void 0 : _b.forEach(function (value) {
                    changes.push({
                        type: ChangeType.ADD,
                        channel: channel,
                        data: value
                    });
                });
            }
            else {
                throw Error("Unexpected error: Cannot send subscribe data to unknown channel: " + channel);
            }
            client.send(JSON.stringify({
                method: MsgMethod.UPDATE,
                seq: seq,
                pair: pair,
                changes: changes
            }));
        }
    }
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
                            seq: listener_1.seq,
                            pair: pair,
                            changes: [change],
                        };
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
function createListenerId(channel, pair) {
    var listenerId = "";
    if (!channel) {
        return "Error: No channel specified for listenerId";
    }
    if (channel.includes("allpairs")) {
        listenerId = channel;
    }
    else { // pair specific channels
        if (!pair) {
            return "Error: No pair specified for listenerId";
        }
        listenerId = pair + ":" + channel;
    }
    return listenerId;
}
function parseListenerId(listenerId) {
    var channel = "";
    var pair = "";
    var extra = "";
    if (listenerId) {
        var parts = listenerId.split(":");
        if (parts.length === 1) {
            channel = parts[0];
        }
        else if (parts.length >= 2) {
            pair = parts[0];
            channel = parts[1];
            if (parts.length > 2) {
                extra = parts[2];
            }
        }
    }
    else {
        throw Error("Unexpected error: no listenerId provided for function parseListenerId");
    }
    return { channel: channel, pair: pair, extra: extra };
}
var checkClientStatus = function () {
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
