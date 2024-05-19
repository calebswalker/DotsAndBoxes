import { UndirectedEdge } from "../graph/undirectedgraph";
import { Player } from "../player";

export interface WorkerMessage {
    game: { moves: UndirectedEdge[] };
    currentPlayer: Player;
}

export interface WorkerResponse {
    move: UndirectedEdge[];
}
