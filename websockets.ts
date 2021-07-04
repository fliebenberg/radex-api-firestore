
import WebSocket from 'ws';
import HTTP from "http";
import { port, db } from "./app";
import { Trade } from "./models/trade.class";
import { Order } from "./models/order.class";
import { Pair } from "./models/pair.class";
import { addToSlice, getTimeSliceStart, SLICE_DURS, TimeSlice, updateSlices } from './models/time-slice.class';
import { convertDBChannel, DBChannel, PairState, PAIR_CHANNELS, PAIR_DB_CHANNELS } from './models/pairState.class';
import { ServerState } from './models/serverState.class';

enum MsgMethod {
    TEXT = "TEXT",
    SUBSCRIBE = "SUBSCRIBE",
    UNSUBSCRIBE = "UNSUBSCRIBE",
    NEWORDER = "NEWORDER",
    CANCELORDER = "CANCELORDER",
    UPDATE = "UPDATE",
    ERROR = "ERROR",
}

export enum ChangeType {
    ADD = "ADD",
    UPDATE = "UPDATE",
    DELETE = "DELETE"
}

enum ClientStatus {
    ALIVE = "ALIVE",
    DEAD = "DEAD"
}

export interface ChangeRec {
    type: ChangeType,
    channel: string,
    data: any
}



const serverState = new ServerState();
const pairsState = serverState.pairsState;

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

function processDBChanges(changes: FirebaseFirestore.DocumentChange<FirebaseFirestore.DocumentData>[], channel: DBChannel) {
    changes.forEach(change => {
        const newDoc = change.doc.data();
        // const pairCode = newDoc.pair ? newDoc.pair : newDoc.code
        // console.log("Processing change: Type: "+ change.type +" Channel: "+ channel +" Pair: "+ pairCode);
        let changeObj: any;
        switch (channel) {
            case "info": changeObj = Pair.create(newDoc); break;
            case "buyOrders": changeObj = Order.create(newDoc); break;
            case "sellOrders": changeObj = Order.create(newDoc); break;
            case "completedOrders": changeObj = Order.create(newDoc); break;
            case "trades": changeObj = Trade.create(newDoc); break;
            default: return;
        }
        if (!changeObj) {
            throw Error("Unexpected error: Could not create DB changeObj.");
        }
        if (channel == "info") {
            const pairState = pairsState.get(changeObj.code);
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
                        pairState.listeners?.forEach(listenerData => {
                            if (listenerData.unsub) {
                                listenerData.unsub()
                            }
                        }); // unsibscribe from DB listeners
                        pairsState.delete(changeObj.code); // delete pair from pairsDB
                        break;
                    }
                }
            } else if (change.type != "removed") { 
            // create new PairDB
                const pairState = new PairState(changeObj);
                // initialise listener map for all channels in pair
                PAIR_CHANNELS.forEach(pairChannel => {
                        let unsub: any = null;
                        if (PAIR_DB_CHANNELS.includes(pairChannel)) {
                            // console.log("Creating new pair listener: "+ DBChannel);
                            const pairPath = "/pairs/"+ changeObj.code +"/"+ convertDBChannel(pairChannel as DBChannel);
                            unsub = db.collection(pairPath).onSnapshot(snapshot => {
                                processDBChanges(snapshot.docChanges(), pairChannel as DBChannel)
                            });
                        }
                        if (pairChannel == "slices") {
                            const slices = new Map<string, Map<number, TimeSlice>>();
                            SLICE_DURS.forEach(sliceDur => {
                                slices.set(sliceDur, new Map<number, TimeSlice>());
                                pairState.listeners.set(pairChannel+sliceDur, {seq: 0, clients: new Set<WebSocket>(), unsub: unsub});
                            })
                            pairState.slices = slices;
                        } else {
                            pairState.listeners.set(pairChannel, {seq: 0, clients: new Set<WebSocket>(), unsub: unsub})
                        }
                })
                pairsState.set(changeObj.code, pairState);
            }
        } else {
            console.log("Change detected: Type "+change.type+" Channel: "+ channel +" Pair: "+ changeObj.pair +" Doc: "+changeObj.id);
            let pairState = pairsState.get(changeObj.pair);
            if (pairState) {
                switch (change.type) {
                    case "added": {
                        pairState[channel]?.set(changeObj.id, changeObj);
                        break;
                    }
                    case "modified": {
                        pairState[channel]?.set(changeObj.id, changeObj);
                        break;
                    }
                    case "removed": {
                        pairState[channel]?.delete(changeObj.id);
                        break;
                    }
                }
                if (change.type != "removed" && channel == "trades") {
                    const result = updateSlices(pairState, changeObj);
                    pairState = result.pairState;
                    sendChangesToSubs(changeObj.pair, result.changes);
                }
                pairsState.set(changeObj.pair, pairState as PairState);
                sendChangesToSubs(changeObj.pair, [createChangeRec(change, channel)]);
            } else {
                console.log("Unexpected error (ignored): Received DB update for unrecognised pair.", changeObj);
            }
        }
    })
}



// message handlers
function handleMsgSubscribe(message: any, client: WebSocket) {
    if (message.channel === "all" && message.symbol) {
        PAIR_CHANNELS
            .filter(channel => channel != "slices")
            .forEach(channel => {
                const newMsg = {...message, channel: channel};
                handleMsgSubscribe(newMsg, client);
            })
    } else if (message.channel == "listeners") {
        return; // clinet cannot subscribe to listeners channel in pair
    } else if (message.channel.includes("allpairs")) {

    } else if (message.channel == "slices" || message.channel.includes("slices")) {
        if (message.symbol && pairsState.has(message.symbol)) {
            if (message.slice_dur && SLICE_DURS.includes(message.slice_dur)) {
                pairsState.get(message.symbol)?.listeners.get(message.channel+message.slice_dur)?.clients.add(client);
                sendText(client, "Successfully subscribed client to slices with duration "+ message.slice_dur);
            } else {
                console.log("ERROR. Unknown or unspecified slice duration", message);
                sendError(client, "Could not subscribe to channel: "+ message.channel +". Unknown or unspecified slice duration: "+ message.slice_dur)
            }
        } else {
            sendError(client, "Could not subscribe client to channel: "+ message.channel +". Unknown or unspecified symbol: "+ message.symbol);         
        }
    } else if (PAIR_CHANNELS.includes(message.channel)) {
        if (message.symbol && pairsState.has(message.symbol)) {
            pairsState.get(message.symbol)?.listeners?.get(message.channel)?.clients.add(client);
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

function parseListenerId(listenerId: string): {channel: string, symbol: string, extra: string} {
    let channel =""; 
    let symbol = "";
    let extra = "";
    if (listenerId) {
        const parts = listenerId.split(":");
        if (parts.length === 1) {
            channel = parts[0];
        } else if (parts.length >= 2) {
            symbol = parts[0];
            channel = parts[1];
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

function sendChangesToSubs(pair: string, changes: ChangeRec[]) {
    changes.forEach(change => {
        // console.log("Sending change to subs", change);
        if (pair) {
            const listener = pairsState.get(pair)?.listeners?.get(change.channel);
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
                        pairsState.get(pair)?.listeners?.set(change.channel, listener);
                    }
                })
            }
        }
    })
}

function createChangeRec(
    change: FirebaseFirestore.DocumentChange<FirebaseFirestore.DocumentData>,
    channel: string
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


