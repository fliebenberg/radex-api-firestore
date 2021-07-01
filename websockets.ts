
import WebSocket from 'ws';
import HTTP from "http";
import { port, db } from "./app";

enum MsgType {
    TEXT = "TEXT",
    SUBSCRIBE = "SUBSCRIBE",
    UPDATE = "UPDATE",
    ERROR = "ERROR",
}

enum ChangeType {
    ADD = "ADD",
    UPDATE = "UPDATE",
    DELETE = "DELETE"
}

enum TransType {
    BUY_ORDERS = "BUY_ORDERS",
    SELL_ORDERS = "SELL_ORDERS",
    COMPLETED_ORDERS = "COMPLETED_ORDERS",
    TRADES = "TRADES",
}

enum ClientStatus {
    ALIVE = "ALIVE",
    DEAD = "DEAD"
}
interface ChangeRec {
    changeType: ChangeType,
    transType: TransType,
    data: any
}

interface PairData {
    seq: number,
    subs: Set<WebSocket>,
}



const pairMap = new Map<string, PairData>()
const clientStatusMap = new Map<WebSocket, ClientStatus>()
const checkClientStatusInterval = 5000;

export function initWss(server: HTTP.Server): WebSocket.Server {
    const wss = new WebSocket.Server({server: server});
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
            switch (message.type) {
                case MsgType.TEXT: 
                    console.log("Recevied TEXT message:", message.text);
                    break;
                case MsgType.SUBSCRIBE:
                    if (message.pair) {
                        const pair = (message.pair as string).toUpperCase();
                        if (pairMap.has(pair)) {
                            pairMap.get(pair)?.subs.add(client);
                        } else {
                            pairMap.set(pair, {
                                seq: 0,
                                subs: new Set<WebSocket>().add(client),
                            });
                            addPairListener(pair);
                        }
                        sendText(client, "Succesfully subscribed to pair: "+ pair);
                    } else {
                        sendText(client, "Did not include pair to subscribe to", MsgType.ERROR);
                    }    
                    break;
                default:
                    sendText(client, "Non-Valid message type: "+ message.type +".", MsgType.ERROR);
            }
        })
        client.on("ping", () => {
            client.pong();
        })
        client.on("pong", () => {
            console.log("Received PONG from client");
            clientStatusMap.set(client, ClientStatus.ALIVE);
        })
        client.on("close", () => {
            closeClient(client);
        })
    })
    
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

const checkClientStatus = function (wss: WebSocket.Server) {
    console.log("Checking client statuses...", clientStatusMap.size);
    clientStatusMap.forEach((status: ClientStatus, client: WebSocket) => {
        console.log("For client");
        if (!client || status === ClientStatus.DEAD) {
            console.log("Client DEAD. Closing client");
            closeClient(client);
        } else {
            console.log("Client still alive...")
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

function sendText(client: WebSocket, msg: string, type: MsgType = MsgType.TEXT) {
    client.send(JSON.stringify({type: type, text: msg}));
}

function addPairListener(pair: string) {
    console.log("Adding listener for pair "+ pair);
    db.collection("/pairs/"+ pair +"/trades").onSnapshot(querySnapshot => {
        const changes = querySnapshot.docChanges().map(change => {
            return createChangeRec(change, TransType.TRADES);
        })
        // console.log("Changes for pair "+ pair, changes);
        sendPairUpdates(pair, changes);
    })
    db.collection("/pairs/"+ pair +"/buy-orders").onSnapshot(querySnapshot => {
        const changes = querySnapshot.docChanges().map(change => {
            return createChangeRec(change, TransType.BUY_ORDERS);
        })
        // console.log("Changes for pair "+ pair, changes);
        sendPairUpdates(pair, changes);
    })
    db.collection("/pairs/"+ pair +"/sell-orders").onSnapshot(querySnapshot => {
        const changes = querySnapshot.docChanges().map(change => {
            return createChangeRec(change, TransType.BUY_ORDERS);
        })
        // console.log("Changes for pair "+ pair, changes);
        sendPairUpdates(pair, changes);
    })
    db.collection("/pairs/"+ pair +"/completed-orders").onSnapshot(querySnapshot => {
        const changes = querySnapshot.docChanges().map(change => {
            return createChangeRec(change, TransType.COMPLETED_ORDERS);
        })
        // console.log("Changes for pair "+ pair, changes);
        sendPairUpdates(pair, changes);
    })
}

function sendPairUpdates(pair: string, changes: ChangeRec[]) {
    if (pairMap.has(pair)) {
        incSeq(pair);
        const thisPair = pairMap.get(pair) as PairData;
        thisPair.subs.forEach(client => {
            if (client.readyState == 1) {
                client.send(JSON.stringify({type: MsgType.UPDATE, pair: pair, seq: thisPair.seq, changes}))
            } else {
                console.log("Removing non-open client from subs for pair "+ pair);
                pairMap.get(pair)?.subs.delete(client);  // remove client from subs if no longer open
            }
        })
    }
}

function createChangeRec(
    change: FirebaseFirestore.DocumentChange<FirebaseFirestore.DocumentData>,
    transType: TransType
): ChangeRec {
    return  {
        changeType: convertChangeType(change.type),
        transType: transType,
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

function incSeq(pair: string) {
    if (pairMap.has(pair)) {
        (pairMap.get(pair) as PairData).seq  ++;  // increase the sequence number for the pair
    }
}
