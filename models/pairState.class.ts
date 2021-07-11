import { AggregateOrderEntry, Order } from "./order.class"
import { Pair } from "./pair.class"
import { TimeSlice } from "./time-slice.class"
import { Trade } from "./trade.class"
import WebSocket from "ws";

export interface OrderBook {
    buys: Map<number, Order[]>,
    sells: Map<number, Order[]>,
}

export interface ListenerData {
    seq: number,
    clients: Set<WebSocket>,
    unsub: any;
}

export class PairState {
    constructor(
        public info: Pair | null = null,
        public trades: Map<string, Trade> = new Map(),
        public buyOrders: Map<string, Order> = new Map<string, Order>(),
        public sellOrders: Map<string, Order> = new Map<string, Order>(),
        public completedOrders: Map<string, Order> = new Map<string, Order>(),
        public orderbookBuys: Map<number, AggregateOrderEntry> = new Map(),
        public orderbookSells: Map<number, AggregateOrderEntry> = new Map(),
        public listeners: Map<string, ListenerData> = new Map<string, ListenerData>(),
        public slices: Map<string, Map<number, TimeSlice>> = new Map<string, Map<number, TimeSlice>>(),
        public slice24h: TimeSlice | null = null,
    ) {}
}

export const PAIR_DB_CHANNELS = ["trades", "buyOrders", "sellOrders", "completedOrders"];
export type DBChannel = "info" | "trades" | "buyOrders" | "sellOrders" | "completedOrders";
export const PAIR_CHANNELS = ["orderbookBuys", "orderbookSells", "listeners", "slices", "slice24h", ...PAIR_DB_CHANNELS];

export function convertDBChannel(channel: DBChannel): string {
    switch (channel) {
        case "trades": return "trades";
        case "buyOrders": return "buy-orders";
        case "sellOrders": return "sell-orders";
        case "completedOrders": return "completed-orders";
        default: throw Error("Unexpected error: Unrecognised DBChannel: "+ channel);
    }
}