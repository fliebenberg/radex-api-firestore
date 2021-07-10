import { ListenerData, PairState } from "./pairState.class";

export class ServerState {
    constructor(
        public pairsState: Map<string, PairState> = new Map<string, PairState>(),
        public listeners: Map<string, ListenerData> = new Map(),
    ) {}
}