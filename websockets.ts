
import WebSocket from 'ws';
import HTTP from "http";
import { port, db } from "./app";
import { Trade } from "./models/trade.class";
import { Order } from "./models/order.class";
import { Pair } from "./models/pair.class";
import { TimeSlice } from './models/time-slice.class';

enum MsgMethod {
    TEXT = "TEXT",
    SUBSCRIBE = "SUBSCRIBE",
    UNSUBSCRIBE = "UNSUBSCRIBE",
    NEWORDER = "NEWORDER",
    CANCELORDER = "CANCELORDER",
    UPDATE = "UPDATE",
    ERROR = "ERROR",
}

enum ChangeType {
    ADD = "ADD",
    UPDATE = "UPDATE",
    DELETE = "DELETE"
}

enum ClientStatus {
    ALIVE = "ALIVE",
    DEAD = "DEAD"
}

interface ChangeRec {
    type: ChangeType,
    channel: PairChannel,
    data: any
}

interface ListenerData {
    seq: number,
    clients: Set<WebSocket>,
    unsub: any;
}

interface OrderBook {
    buys: Map<number, Order[]>,
    sells: Map<number, Order[]>,
}

interface PairDB {
    "info"?: Pair,
    "trades"?: Map<string, Trade>,
    "buy-orders"?: Map<string, Order>,
    "sell-orders"?: Map<string, Order>,
    "completed-orders"?: Map<string, Order>,
    "slices"?: Map<string, Map<number, TimeSlice>>,
    "book"?: OrderBook,
    "listeners"?: Map<PairChannel,ListenerData>,
}

type DBPairChannel = "buy-orders" | "sell-orders" | "completed-orders" | "trades"; 
const DBPairChannelArray: DBPairChannel[] = ["trades", "buy-orders", "sell-orders", "completed-orders"];
type PairChannel = "info" | DBPairChannel | "slices" | "book";
const pairChannelArray: PairChannel[] = ["info", ...DBPairChannelArray, "slices", "book"];
type SliceDur = "1m" | "5m" | "15m" | "30m" | "1hr" | "4h" | "12h" | "1D" | "1W" | "1M";
const SliceDurArray = ["1m", "5m", "15m", "30m", "1hr", "4h", "12h", "1D", "1W", "1M"];

const pairsDB = new Map<string, PairDB>();

// const pairMap = new Map<string, PairData>()
// const listeners = new Map<string, ListenerData>();
const clientStatusMap = new Map<WebSocket, ClientStatus>()
const checkClientStatusInterval = 5000;


export function initWss(server: HTTP.Server): WebSocket.Server {
    const wss = new WebSocket.Server({server: server});
    setupDBListeners();
    wss.on("listening", () => {
        console.log("Websocket server is listening on "+ port +"...");
    })
    
    wss.on("connection", (client: WebSocket) => {
        console.log("New websocket client connected");
        clientStatusMap.set(client, ClientStatus.ALIVE);
        sendText(client, "Welcome new wss client!");
    
        client.on("message", (messageStr: any) => {
            console.log("Received message from client: ", messageStr);
            const message = JSON.parse(messageStr);
            switch (message.method) {
                case MsgMethod.TEXT: 
                    console.log("Received TEXT message:", message.text);
                    break;
                case MsgMethod.SUBSCRIBE:
                    handleMsgSubscribe(message, client);
                    break;
                default:
                    sendText(client, "Non-Valid message method: "+ message.method +".", MsgMethod.ERROR);
            }
        })
        client.on("ping", () => {
            client.pong();
        })
        client.on("pong", () => {
            // console.log("Received PONG from client");
            clientStatusMap.set(client, ClientStatus.ALIVE);
        })
        client.on("close", () => {
            closeClient(client);
        })
    })
    
    // setup interval to check client liveness
    const clientInterval = setInterval(
        checkClientStatus,
        checkClientStatusInterval
    );
    
    wss.on("close", () => {
        console.log("Websocket Server closed");
        clearInterval(clientInterval);
    })
    
    return wss;
}

function setupDBListeners() {
    db.collection("pairs").onSnapshot(snapshot => {
        processDBChanges(snapshot.docChanges(), "info");
    })
}

function processDBChanges(changes: FirebaseFirestore.DocumentChange<FirebaseFirestore.DocumentData>[], channel: PairChannel) {
    changes.forEach(change => {
        const newDoc = change.doc.data();
        const pairCode = newDoc.pair ? newDoc.pair : newDoc.code
        // console.log("Processing change: Type: "+ change.type +" Channel: "+ channel +" Pair: "+ pairCode);
        let changeObj: any;
        switch (channel) {
            case "info": changeObj = Pair.create(newDoc); break;
            case "buy-orders": changeObj = Order.create(newDoc); break;
            case "sell-orders": changeObj = Order.create(newDoc); break;
            case "completed-orders": changeObj = Order.create(newDoc); break;
            case "trades": changeObj = Trade.create(newDoc); break;
            default: return;
        }
        if (!changeObj) {
            throw Error("Unexpected error: Could not create DB changeObj.");
        }
        if (channel == "info") {
            const pairDB = pairsDB.get(changeObj.code);
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
                        pairDB.listeners?.forEach(listenerData => {
                            if (listenerData.unsub) {
                                listenerData.unsub()
                            }
                        }); // unsibscribe from DB listeners
                        pairsDB.delete(changeObj.code); // delete pair from pairsDB
                        break;
                    }
                }
            } else if (change.type != "removed") {
                const pairDB = {info: changeObj, listeners: new Map<PairChannel, ListenerData>()};
                // initialise listener map for all channels in pair
                const newListener = {seq: 0 , clients: new Set<WebSocket>(), unsub: null};
                pairChannelArray.forEach(pairChannel => {
                    pairDB.listeners?.set(pairChannel, newListener);
                })
                // subscribe to feeds from DB for pair
                DBPairChannelArray.forEach(DBChannel => {
                    // console.log("Creating new pair listener: "+ DBChannel);
                    const unsub = db.collection("/pairs/"+ changeObj.code +"/"+ DBChannel).onSnapshot(snapshot => {
                        console.log("CHange detected for channel "+ DBChannel +" in pair "+ changeObj.code);
                        processDBChanges(snapshot.docChanges(), DBChannel)
                    });
                    pairDB.listeners?.set(DBChannel, {...newListener, unsub: unsub})
                })
                pairsDB.set(changeObj.code, pairDB);
            }
        } else {
            const pairDB = pairsDB.get(changeObj.pair);
            if (pairDB) {
                switch (change.type) {
                    case "added": {
                        pairDB[channel]?.set(changeObj.id, changeObj);
                        break;
                    }
                    case "modified": {
                        pairDB[channel]?.set(changeObj.id, changeObj);
                        break;
                    }
                    case "removed": {
                        pairDB[channel]?.delete(changeObj.id);
                        break;
                    }
                }
                pairsDB.set(changeObj.pair, pairDB);
                sendChangeToSubs(changeObj.pair, createChangeRec(change, channel));
            } else {
                console.log("Unexpected error (ignored): Received DB update for unrecognised pair.", changeObj);
            }
        }
    })
}

// message handlers
function handleMsgSubscribe(message: any, client: WebSocket) {
    if (message.channel === "all" && message.symbol) {
        pairChannelArray.forEach(channel => {
            const newMsg = {...message, channel: channel};
            handleMsgSubscribe(newMsg, client);
        })
    } else if (message.channel.includes("allpairs")) {

    } else if (pairChannelArray.includes(message.channel)) {
        if (message.symbol && Array.from(pairsDB.keys()).includes(message.symbol)) {
            pairsDB.get(message.symbol)?.listeners?.get(message.channel)?.clients.add(client);
        } else {
            sendError(client, "Could not subscribe client to channel: "+ message.channel +". Unknown or unspecified symbol: "+ message.symbol);
        }
        sendText(client, "Successfully subscribed client to channel: "+ message.channel);
    } else {
        sendError(client, "Could not subscribe client to specified channel: " + message.channel);
    }
}

function createListenerId(channel: string, symbol: string): string {
    let listenerId = "";
    if (!channel) {
        return "Error: No channel specified for listenerId";
    }
    if (channel.includes("allpairs")) {
        listenerId = channel;
    } else { // pair specific channels
        if (!symbol) {
            return "Error: No symbol specified for listenerId";
        }
        listenerId = symbol + ":" + channel;
    }
    return listenerId;
} 

function parseListenerId(listenerId: string): {channel: PairChannel, symbol: string, extra: string} {
    let channel: DBPairChannel = "trades"; 
    let symbol = "";
    let extra = "";
    if (listenerId) {
        const parts = listenerId.split(":");
        if (parts.length === 1) {
            channel = parts[0] as DBPairChannel;
        } else if (parts.length >= 2) {
            symbol = parts[0];
            channel = parts[1] as DBPairChannel;
            if (parts.length > 2) {
                extra = parts[2];
            }
        }
    } else {
        throw Error("Unexpected error: no listenerId provided for function parseListenerId");
    }
    return { channel, symbol, extra};
}

const checkClientStatus = function (wss: WebSocket.Server) {
    // console.log("Checking client statuses...", clientStatusMap.size);
    clientStatusMap.forEach((status: ClientStatus, client: WebSocket) => {
        // console.log("For client");
        if (!client || status === ClientStatus.DEAD) {
            console.log("Client DEAD. Closing client");
            closeClient(client);
        } else {
            // console.log("Client still alive...")
            clientStatusMap.set(client, ClientStatus.DEAD);
            client.ping();
        }
    })
}

function closeClient(client: WebSocket) {
    console.log("Closing client connection");
    client.close();
    clientStatusMap.delete(client);
}

function sendText(client: WebSocket, msg: string, method: MsgMethod = MsgMethod.TEXT) {
    client.send(JSON.stringify({method: method, text: msg}));
}

function sendError(client: WebSocket, msg: string) {
    sendText(client, msg, MsgMethod.ERROR);
}

function sendChangeToSubs(pair: string, change: ChangeRec) {
    // console.log("Sending change to subs", change);
    if (pair) {
        const listener = pairsDB.get(pair)?.listeners?.get(change.channel);
        if (listener) {
            listener.seq ++;
            listener.clients.forEach(client => {
                if (client.readyState == 1) {
                    let returnMsg: any = {
                        method: MsgMethod.UPDATE,
                        channel: change.channel,
                        seq: listener.seq,
                        change: change,
                    };
                    if (pair) {
                        returnMsg.symbol = pair;
                    }
                    client.send(JSON.stringify(returnMsg))
                } else {
                    console.log("Removing non-open client from subscribed clients for listenerId "+ createListenerId(change.channel, pair));
                    listener.clients.delete(client);  // remove client from subs if no longer open
                    pairsDB.get(pair)?.listeners?.set(change.channel, listener);
                }
            })
        }
    }
}

function createChangeRec(
    change: FirebaseFirestore.DocumentChange<FirebaseFirestore.DocumentData>,
    channel: PairChannel
): ChangeRec {
    return  {
        type: convertChangeType(change.type),
        channel: channel,
        data: change.doc.data()
    }
}

function convertChangeType (type: string): ChangeType {
    switch (type) {
        case "added":
            return ChangeType.ADD;
        case "modified":
            return ChangeType.UPDATE;
        case "removed":
            return ChangeType.DELETE;
        default:
            throw Error("Unexpected error: Unrecognised firestore document change type: "+ type);
    }
}
