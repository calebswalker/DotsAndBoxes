import { DotsAndBoxesGraph, Move } from "../graph/dotsandboxesgraph";
import { UndirectedEdge } from "../graph/undirectedgraph";
import { Player } from "../player";
import { RNG } from "./random";
import { State } from "./state";

export class SmartRandomAgent {
    public getOptimalAction(state: State<Move>) {
        const moves = state.getActions();

        // Shuffle the moves
        moves.sort(() => RNG() - 0.5);

        let randomMove: Move | undefined;
        randomMove = moves.pop();

        return { action: randomMove };
    }
}

export class SmartRandomAgentState implements State<Move> {
    constructor(private game: DotsAndBoxesGraph) {}

    getActions: () => UndirectedEdge[] = () => {
        return this.game.getEdgesThatEitherCaptureABoxOrDoNotCreateABox(true);
    };
    execute: (action: UndirectedEdge) => any = () => {};
    revert: (action: UndirectedEdge) => any = () => {};
    isPlayer1sTurn: () => boolean = () => true;
    isGameOver: () => boolean = () => false;
    getWinner: () => Player | undefined = () => undefined;
    evaluate: () => number = () => 0;
}
