import { UndirectedEdge } from "../graph/undirectedgraph";
import { Player } from "../player";

export interface WorkerSettings {
    threshold?: number | undefined;
}

export interface WorkerMessage {
    game: { moves: UndirectedEdge[] };
    currentPlayer: Player;
    settings?: WorkerSettings | undefined;
}

export interface WorkerResponse {
    move: UndirectedEdge[];
}
