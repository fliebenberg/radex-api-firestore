
import WebSocket from 'ws';
import HTTP from "http";
import { port, db } from "./app";
import { Trade } from "./models/trade.class";
import { Order } from "./models/order.class";
import { Pair } from "./models/pair.class";
import { addToSlice, getTimeSliceStart, SLICE_DURS, TimeSlice, updateSlices } from './models/time-slice.class';
import { convertDBChannel, DBChannel, ListenerData, PairState, PAIR_CHANNELS, PAIR_DB_CHANNELS } from './models/pairState.class';
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
                    handleMsgSub(message, client);
                    break;
                case MsgMethod.UNSUBSCRIBE:
                    handleMsgUnsub(message, client);
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
                            // console.log("Creating new pair listener: "+ pairChannel, changeObj);
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
function handleMsgSub(message: any, client: WebSocket) {
    if (message.channel === "all" && message.pair) {
        PAIR_CHANNELS
            .filter(channel => channel != "slices")
            .forEach(channel => {
                const newMsg = {...message, channel: channel};
                handleMsgSub(newMsg, client);
            })
    } else if (message.channel == "listeners") {
        return; // client cannot subscribe to listeners channel
    } else if (message.channel == "allpairs" || message.channel == "tickers") {
        const channelStr = message.channel == "allpairs"? "info" : "slice24h";
        serverState.pairsState.forEach(pairState => {
            pairState.listeners.get(channelStr)?.clients.add(client);
            sendDataOnSub(client, pairState?.info?.code as string, channelStr)
        })
    } else if (message.channel == "slices" || message.channel.includes("slices")) {
        if (message.pair && pairsState.has(message.pair)) {
            const sliceDur = message.channel.slice(6);
            if (sliceDur && SLICE_DURS.includes(sliceDur)) {
                sendDataOnSub(client, message.pair, message.channel);
                pairsState.get(message.pair)?.listeners.get(message.channel)?.clients.add(client);
                sendText(client, "Successfully subscribed client to slices with duration "+ sliceDur);
            } else {
                console.log("ERROR. Unknown or unspecified slice duration", message);
                sendError(client, "Could not subscribe to channel: "+ message.channel +" Unknown slice duration.");
            }
        } else {
            sendError(client, "Could not subscribe client to channel: "+ message.channel +". Unknown or unspecified pair: "+ message.pair);         
        }
    } else if (PAIR_CHANNELS.includes(message.channel)) {
        if (message.pair && pairsState.has(message.pair)) {
            sendDataOnSub(client, message.pair, message.channel);
            pairsState.get(message.pair)?.listeners?.get(message.channel)?.clients.add(client);
            sendText(client, "Successfully subscribed client to channel: "+ message.channel);
        } else {
            sendError(client, "Could not subscribe client to channel: "+ message.channel +". Unknown or unspecified pair: "+ message.pair);
        }
    } else {
        sendError(client, "Could not subscribe client to specified channel: " + message.channel);
    }
}

function handleMsgUnsub(message: any, client: WebSocket) {
    if (message.channel === "all" && message.pair) {
        PAIR_CHANNELS
            .filter(channel => channel != "slices")
            .forEach(channel => {
                const newMsg = {...message, channel: channel};
                handleMsgUnsub(newMsg, client);
            })
    } else if (message.channel == "listeners") {
        return; // client cannot subscribe to listeners channel
    } else if (message.channel == "allpairs" || message.channel == "tickers") {
        serverState.pairsState.forEach(pairState => {
            const channelStr = message.channel == "allpairs"? "info" : "slice24h";
            pairState.listeners.get(channelStr)?.clients.delete(client);
        })
        sendText(client, "Successfully unsubscribed client from " + message.channel);
    } else if (message.channel == "tickers") {
        serverState.listeners.get(message.channel)?.clients.delete(client);
        sendText(client, "Successfully unsubscribed client from " + message.channel);
    } else if (message.channel == "slices" || message.channel.includes("slices")) {
        if (message.pair && pairsState.has(message.pair)) {
            const sliceDur = message.channel.slice(6);
            if (sliceDur && SLICE_DURS.includes(sliceDur)) {
                pairsState.get(message.pair)?.listeners.get(message.channel)?.clients.delete(client);
                sendText(client, "Successfully unsubscribed client from slices with duration "+ sliceDur);
            } else {
                console.log("ERROR. Unknown or unspecified slice duration", message);
                sendError(client, "Could not unsubscribe from channel: "+ message.channel +" Unknown slice duration.");
            }
        } else {
            sendError(client, "Could not unsubscribe client from channel: "+ message.channel +". Unknown or unspecified pair: "+ message.pair);         
        }
    } else if (PAIR_CHANNELS.includes(message.channel)) {
        if (message.pair && pairsState.has(message.pair)) {
            pairsState.get(message.pair)?.listeners?.get(message.channel)?.clients.delete(client);
            sendText(client, "Successfully unsubscribed client from channel: "+ message.channel);
        } else {
            sendError(client, "Could not unsubscribe client from channel: "+ message.channel +". Unknown or unspecified pair: "+ message.pair);
        }
    } else {
        sendError(client, "Could not unsubscribe client from specified channel: " + message.channel);
    }
}

function sendDataOnSub(client: WebSocket, pair: string, channel: keyof PairState) {
    console.log("Sending first time subscribe data for pair "+ pair +" and channel "+ channel);
    const changes: ChangeRec[] = [];
    if (pair && pairsState.has(pair)) {
        const pairState = pairsState.get(pair) as PairState;
        channel = channel as keyof PairState
        if (pairState) {
            const seq = pairState.listeners.get(channel)?.seq as number;
            if (channel == "info" || channel == "slice24h" || channel == "orderbook") {
                const data = pairState[channel];
                changes.push({
                    type: ChangeType.ADD,
                    channel: channel,
                    data: data,
                })
            } else if (PAIR_DB_CHANNELS.includes(channel)) {
                pairState[channel].forEach (value => {
                    changes.push({
                        type: ChangeType.ADD,
                        channel: channel,
                        data: value
                    })
                })
            } else if (channel.includes("slices")) {
                const sliceDur = channel.slice(6);
                pairState["slices"].get(sliceDur)?.forEach(value => {
                    changes.push({
                        type: ChangeType.ADD,
                        channel: channel,
                        data: value
                    })
                });
            } else {
                throw Error("Unexpected error: Cannot send subscribe data to unknown channel: "+ channel);
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
                            seq: listener.seq,
                            pair: pair,
                            changes: [change],
                        };
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

function createListenerId(channel: string, pair: string): string {
    let listenerId = "";
    if (!channel) {
        return "Error: No channel specified for listenerId";
    }
    if (channel.includes("allpairs")) {
        listenerId = channel;
    } else { // pair specific channels
        if (!pair) {
            return "Error: No pair specified for listenerId";
        }
        listenerId = pair + ":" + channel;
    }
    return listenerId;
} 

function parseListenerId(listenerId: string): {channel: string, pair: string, extra: string} {
    let channel =""; 
    let pair = "";
    let extra = "";
    if (listenerId) {
        const parts = listenerId.split(":");
        if (parts.length === 1) {
            channel = parts[0];
        } else if (parts.length >= 2) {
            pair = parts[0];
            channel = parts[1];
            if (parts.length > 2) {
                extra = parts[2];
            }
        }
    } else {
        throw Error("Unexpected error: no listenerId provided for function parseListenerId");
    }
    return { channel, pair, extra};
}

const checkClientStatus = function () {
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


