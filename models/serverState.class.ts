import { PairState } from "./pairState.class";

export class ServerState {
    constructor(
        public pairsState: Map<string, PairState> = new Map<string, PairState>(),
    ) {}
}