"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initWss = void 0;
var ws_1 = __importDefault(require("ws"));
var app_1 = require("./app");
var MsgType;
(function (MsgType) {
    MsgType["TEXT"] = "TEXT";
    MsgType["SUBSCRIBE"] = "SUBSCRIBE";
    MsgType["UPDATE"] = "UPDATE";
    MsgType["ERROR"] = "ERROR";
})(MsgType || (MsgType = {}));
var ChangeType;
(function (ChangeType) {
    ChangeType["ADD"] = "ADD";
    ChangeType["UPDATE"] = "UPDATE";
    ChangeType["DELETE"] = "DELETE";
})(ChangeType || (ChangeType = {}));
var TransType;
(function (TransType) {
    TransType["BUY_ORDERS"] = "BUY_ORDERS";
    TransType["SELL_ORDERS"] = "SELL_ORDERS";
    TransType["COMPLETED_ORDERS"] = "COMPLETED_ORDERS";
    TransType["TRADES"] = "TRADES";
})(TransType || (TransType = {}));
var ClientStatus;
(function (ClientStatus) {
    ClientStatus["ALIVE"] = "ALIVE";
    ClientStatus["DEAD"] = "DEAD";
})(ClientStatus || (ClientStatus = {}));
var pairMap = new Map();
var clientStatusMap = new Map();
var checkClientStatusInterval = 5000;
function initWss(server) {
    var wss = new ws_1.default.Server({ server: server });
    wss.on("listening", function () {
        console.log("Websocket server is listening on " + app_1.port + "...");
    });
    wss.on("connection", function (client) {
        console.log("New websocket client connected");
        clientStatusMap.set(client, ClientStatus.ALIVE);
        sendText(client, "Welcome new wss client!");
        client.on("message", function (messageStr) {
            var _a;
            console.log("Received message from client: ", messageStr);
            var message = JSON.parse(messageStr);
            switch (message.type) {
                case MsgType.TEXT:
                    console.log("Recevied TEXT message:", message.text);
                    break;
                case MsgType.SUBSCRIBE:
                    if (message.pair) {
                        var pair = message.pair.toUpperCase();
                        if (pairMap.has(pair)) {
                            (_a = pairMap.get(pair)) === null || _a === void 0 ? void 0 : _a.subs.add(client);
                        }
                        else {
                            pairMap.set(pair, {
                                seq: 0,
                                subs: new Set().add(client),
                            });
                            addPairListener(pair);
                        }
                        sendText(client, "Succesfully subscribed to pair: " + pair);
                    }
                    else {
                        sendText(client, "Did not include pair to subscribe to", MsgType.ERROR);
                    }
                    break;
                default:
                    sendText(client, "Non-Valid message type: " + message.type + ".", MsgType.ERROR);
            }
        });
        client.on("ping", function () {
            client.pong();
        });
        client.on("pong", function () {
            console.log("Received PONG from client");
            clientStatusMap.set(client, ClientStatus.ALIVE);
        });
        client.on("close", function () {
            closeClient(client);
        });
    });
    var clientInterval = setInterval(checkClientStatus, checkClientStatusInterval);
    wss.on("close", function () {
        console.log("Websocket Server closed");
        clearInterval(clientInterval);
    });
    return wss;
}
exports.initWss = initWss;
var checkClientStatus = function (wss) {
    console.log("Checking client statuses...", clientStatusMap.size);
    clientStatusMap.forEach(function (status, client) {
        console.log("For client");
        if (!client || status === ClientStatus.DEAD) {
            console.log("Client DEAD. Closing client");
            closeClient(client);
        }
        else {
            console.log("Client still alive...");
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
function sendText(client, msg, type) {
    if (type === void 0) { type = MsgType.TEXT; }
    client.send(JSON.stringify({ type: type, text: msg }));
}
function addPairListener(pair) {
    console.log("Adding listener for pair " + pair);
    app_1.db.collection("/pairs/" + pair + "/trades").onSnapshot(function (querySnapshot) {
        var changes = querySnapshot.docChanges().map(function (change) {
            return createChangeRec(change, TransType.TRADES);
        });
        // console.log("Changes for pair "+ pair, changes);
        sendPairUpdates(pair, changes);
    });
    app_1.db.collection("/pairs/" + pair + "/buy-orders").onSnapshot(function (querySnapshot) {
        var changes = querySnapshot.docChanges().map(function (change) {
            return createChangeRec(change, TransType.BUY_ORDERS);
        });
        // console.log("Changes for pair "+ pair, changes);
        sendPairUpdates(pair, changes);
    });
    app_1.db.collection("/pairs/" + pair + "/sell-orders").onSnapshot(function (querySnapshot) {
        var changes = querySnapshot.docChanges().map(function (change) {
            return createChangeRec(change, TransType.BUY_ORDERS);
        });
        // console.log("Changes for pair "+ pair, changes);
        sendPairUpdates(pair, changes);
    });
    app_1.db.collection("/pairs/" + pair + "/completed-orders").onSnapshot(function (querySnapshot) {
        var changes = querySnapshot.docChanges().map(function (change) {
            return createChangeRec(change, TransType.COMPLETED_ORDERS);
        });
        // console.log("Changes for pair "+ pair, changes);
        sendPairUpdates(pair, changes);
    });
}
function sendPairUpdates(pair, changes) {
    if (pairMap.has(pair)) {
        incSeq(pair);
        var thisPair_1 = pairMap.get(pair);
        thisPair_1.subs.forEach(function (client) {
            var _a;
            if (client.readyState == 1) {
                client.send(JSON.stringify({ type: MsgType.UPDATE, pair: pair, seq: thisPair_1.seq, changes: changes }));
            }
            else {
                console.log("Removing non-open client from subs for pair " + pair);
                (_a = pairMap.get(pair)) === null || _a === void 0 ? void 0 : _a.subs.delete(client); // remove client from subs if no longer open
            }
        });
    }
}
function createChangeRec(change, transType) {
    return {
        changeType: convertChangeType(change.type),
        transType: transType,
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
function incSeq(pair) {
    if (pairMap.has(pair)) {
        pairMap.get(pair).seq++; // increase the sequence number for the pair
    }
}
