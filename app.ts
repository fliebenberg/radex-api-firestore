
import * as Utils from "./utils";

// initialise firestore
import fs from "firebase-admin";
const serviceAccount = require("./tokenx-1551e-9b4aaa761724.json");
fs.initializeApp({
    credential: fs.credential.cert(serviceAccount)
});
const db = fs.firestore();

// initialise express
import express from "express";
const app = express();


const port = process.env.PORT || 3000;


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
        res.status(404).send("No "+ orderType +" found for pair "+ req.params.pair_id);
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




app.listen(port, () => {
    console.log("Server listening on port 3000...");
})
