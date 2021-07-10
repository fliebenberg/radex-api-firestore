
import * as Utils from "./utils";
import cors from "cors";
import fetch from "node-fetch";

// initialise firestore
import fb from "firebase-admin";
const serviceAccount = require("./tokenx-1551e-9b4aaa761724.json");
fb.initializeApp({
    credential: fb.credential.cert(serviceAccount)
});
export const db = fb.firestore();

// initialise express
import express from "express";
import HTTP from "http";
const app = express();
export const server = HTTP.createServer(app);

// set server constants
export const port = process.env.PORT || 3000;

const firestoreUrl = "https://us-central1-tokenx-1551e.cloudfunctions.net";
//  const firestoreUrl = "http://localhost:5001/tokenx-1551e/us-central1";

// initialise websocket server
import { initWss } from "./websockets";
initWss(server);

// implement express API behaviour
app.use(cors());
app.use(express.json());

// post functions
app.post("/order", async (req, res) => {
    // console.log("Request Body:", req.body);
    const bodyString = JSON.stringify(req.body);
    // console.log("Request Header: ", req.headers);
    // console.log("Received a Create order request with body "+ bodyString);
    fetch(firestoreUrl+"/addOrderToQHTTPFn", {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
              },
            body: bodyString,
    }).then (async response => {
        const responseText = await response.text();
        // console.log("Response (text):", responseText);
        // console.log("Response (status):", response.status);

        if (response.status == 200) {
            res.status(200).send(responseText);
        } else {
            res.status(response.status).send(responseText);
        }
    }).catch (error => {
        res.status(404).send("firebase error: " + error);
    })
    
})

// delete functions

// cancel order
app.delete("/order/:order_id", async (req, res) => {
    const orderId = req.params.order_id;
    // const orderPair = orderId.split("_")[0];
    // console.log("Deleting order: " + orderId +" on pair "+ orderPair);
    fetch(firestoreUrl+"/cancelOrderHTTPFn", {
        method: "POST",
        headers: {
            'Content-Type': 'text/plain',
          },
        body: orderId,
    }).then (async response => {
        const responseText = await response.text();
        // console.log("Response (text):", responseText);
        // console.log("Response (status):", response.status);

        if (response.status == 200) {
            res.status(200).send(responseText);
        } else {
            res.status(response.status).send(responseText);
        }
    }).catch (error => {
        res.status(404).send("firebase error: " + error);
    })
})


// get functions

app.get("/", async (req, res) => {
    res.send("radex-api-firestore is working.");
})

app.get("/tokens", async (req, res, next) => {
    const result = (await db.collection("/tokens").get()).docs.map(doc => {
        return doc.data();
    });
    if (!result) {
        res.status(404).send("No tokens found");
    } else {
        res.json(result);
    } 
})

app.get("/token/:token_id", async (req, res, next) => {

    const result = (await db.collection("/tokens").doc(req.params.token_id).get()).data();
    if (!result) {
        res.status(404).send("Token not found: "+ req.params.token_id);
    } else {
        res.json(result);
    } 
})

app.get("/token/:token_id/pairs", async (req, res) => {
    const result = (await db.collection("/pairs").get()).docs
        .map(doc => doc.data())
        .filter(doc => {
            return doc.token1 == req.params.token_id || doc.token2 == req.params.token_id;
        })
    if (!result || result.length == 0) {
        res.status(404).send("No pairs found for token "+ req.params.token_id);
    } else {
        res.json(result);
    }
})

app.get("/pairs", async (req, res, next) => {
    const result = (await db.collection("/pairs").get()).docs.map(doc => {
        return doc.data();
    });
    if (!result || result.length == 0) {
        res.status(404).send("No pairs found");
    } else {
        res.json(result);
    } 
})

app.get("/pair/:pair_id", async (req, res, next) => {
    const result = (await db.collection("/pairs").doc(req.params.pair_id).get()).data();
    if (!result) {
        res.status(404).send("Pair not found: "+ req.params.pair_id);
    } else {
        res.json(result);
    }
})

app.get("/pair/:pair_id/buy-orders", async (req, res, next) => {
    res = await getPairOrdersRes("buy-orders", req, res);
})

app.get("/pair/:pair_id/sell-orders", async (req, res, next) => {
    res = await getPairOrdersRes("sell-orders", req, res);
})

app.get("/pair/:pair_id/completed-orders", async (req, res, next) => {
    res = await getPairOrdersRes("completed-orders", req, res);
})

app.get("/pair/:pair_id/trades", async (req, res, next) => {
    res = await getPairOrdersRes("trades", req, res);
})

app.get("/pair/:pair_id/orderbook", async (req, res, next) => {
    const buyOrders = await getPairOrders(req.params.pair_id, "buy-orders");
    const buyOrdersResult = Utils.aggregateOrders(Utils.createOrdersMap(buyOrders));
    const sellOrders = await getPairOrders(req.params.pair_id, "sell-orders");
    const sellOrdersResult = Utils.aggregateOrders(Utils.createOrdersMap(sellOrders));
    const result = {
        sells: sellOrdersResult,
        buys: buyOrdersResult
    }
    console.log("MapString: ", result);
    if (!result) {
        res.status(404).send("Pair not found: "+ req.params.pair_id);
    } else {
        res.json(result);
    }
})

app.get("/pair/:pair_id/wallet/:wallet_id/buy-orders", async (req, res, next) => {
    res = await getPairWalletRes("buy-orders", req, res);
})

app.get("/pair/:pair_id/wallet/:wallet_id/sell-orders", async (req, res, next) => {
    res = await getPairWalletRes("sell-orders", req, res);
})

app.get("/pair/:pair_id/wallet/:wallet_id/completed-orders", async (req, res, next) => {
    res = await getPairWalletRes("completed-orders", req, res);
})

app.get("/pair/:pair_id/wallet/:wallet_id/trades", async (req, res, next) => {
    res = await getPairWalletRes("trades", req, res);
})


async function getPairOrdersRes(orderType: string, req: any, res: any) : Promise<any> {
    const result = await getPairOrders(req.params.pair_id, orderType);
    if (!result || result.length == 0) {
        res.json([]);
    } else {
        res.json(result);
    }
    return res;
}

async function getPairWalletRes(orderType: string, req: any, res: any): Promise<any> {
    const result = (await getPairOrders(req.params.pair_id, orderType))
        .filter(order => order.owner == req.params.wallet_id || order.buyer == req.params.wallet_id || order.seller == req.params.wallet_id);
    if (!result || result.length == 0) {
        res.status(404).send("No "+ orderType +" found for wallet "+ req.params.wallet_id + " in pair "+ req.params.pair_id);
    } else {
        res.status(200).json(result);
    }
    return res;
}

async function getPairOrders(pair: string, orderType: string): Promise<any[]> {
    const result = (await db.collection("/pairs/"+ pair +"/"+ orderType).get()).docs
        .map(doc => doc.data());
    return result;
}




server.listen(port, () => {
    console.log("API server listening on port "+ port +"...");
})
