import { Player } from "../player";
import { DotsAndBoxesGraph } from "./dotsandboxesgraph";
import { GameGraph } from "./gamegraph";
import { UndirectedEdge } from "./undirectedgraph";

export function getBoxesAdjacentToEdge(edgeIndex: number) {
    const adjacentBoxes: number[] = [];
    if (edgeIndex >= 30) {
        // This is a vertical edge
        const modifiedValue = edgeIndex - 30; // Zeros out the edgeIndex

        // 49 -> 19
        const column = modifiedValue % 7;
        const row = (modifiedValue - column) / 7;

        const difference = modifiedValue - row;

        if (column != 0) {
            const boxLeft = difference - 1;
            adjacentBoxes.push(boxLeft);
        }
        if (column != 6) {
            const boxRight = difference;
            adjacentBoxes.push(boxRight);
        }
    } else {
        // This is a horizontal edge
        const boxBelow = edgeIndex;
        const boxAbove = boxBelow - 6;

        if (boxBelow < 24) {
            adjacentBoxes.push(boxBelow);
        }
        if (boxAbove >= 0) {
            adjacentBoxes.push(boxAbove);
        }
    }

    return adjacentBoxes;
}

export function getEdgesAdjacentToBox(boxIndex: number): [number, number, number, number] {
    const row = Math.floor(boxIndex / 6);

    const topEdge = boxIndex;
    const bottomEdge = topEdge + 6;
    const leftEdge = boxIndex + 30 + row;
    const rightEdge = leftEdge + 1;

    return [topEdge, bottomEdge, leftEdge, rightEdge];
}

export function getEdgesAdjacentToBoxThatStillExist(state: bigint, boxIndex: number) {
    return getEdgesAdjacentToBox(boxIndex).filter((edgeIndex) => {
        const mask = 1n << BigInt(edgeIndex);
        return (state & mask) != 0n;
    });
}

export function getNumberOfCompletedBoxesAdjacentToEdge(state: bigint, edgeIndex: number) {
    const numberOfBoxesCompleted = getBoxesAdjacentToEdge(edgeIndex).reduce((previous, boxIndex) => {
        const completedABox = getEdgesAdjacentToBoxThatStillExist(state, boxIndex).length == 0;

        if (completedABox) {
            return previous + 1;
        }
        return previous;
    }, 0);

    return numberOfBoxesCompleted;
}

export class BinaryDotsAndBoxes {
    constructor(
        private state: bigint = GameGraph.EmptyHash,
        private currentPlayer: Player = Player.Player1,
        private player1Score: number = 0,
        private player2Score: number = 0
    ) {}

    public static fromDotsAndBoxesGraph(dotsAndBoxesGraph: DotsAndBoxesGraph) {
        return new BinaryDotsAndBoxes(
            dotsAndBoxesGraph.getEdgeHash(),
            dotsAndBoxesGraph.getCurrentPlayer(),
            dotsAndBoxesGraph.getPlayer1Score(),
            dotsAndBoxesGraph.getPlayer2Score()
        );
    }

    public makeMove(edgeIndex: number) {
        const mask = 1n << BigInt(edgeIndex);

        // Perform the move by masking out the edge
        const newState = this.state & ~mask;
        if (newState == this.state) {
            throw new Error("edge was an invalid move");
        }
        this.state = newState;

        const boxesCompleted = getNumberOfCompletedBoxesAdjacentToEdge(this.state, edgeIndex);
        if (boxesCompleted == 0) {
            // Didn't complete a box, flip players
            this.currentPlayer = -this.currentPlayer;
        } else {
            // Completed boxes! Award points.
            if (this.currentPlayer == Player.Player1) {
                this.player1Score += boxesCompleted;
            } else {
                this.player2Score += boxesCompleted;
            }
        }
    }

    public getAllLegalMoves() {
        const legalMoves: number[] = [];

        let index = 0;
        let mask = 1n;
        let tempState = this.state;
        while (tempState > 0) {
            if ((tempState & 1n) == 1n) {
                // There is a legal edge here
                legalMoves.push(index);
            }

            index++;
            mask = mask << 1n;
            tempState = tempState >> 1n;
        }

        return legalMoves;
    }

    public static edgeIndexToUndirectedEdge(edgeIndex: number) {
        return GameGraph.EdgeIndex[edgeIndex];
    }
    public static undirectedEdgeToEdgeIndex(edge: UndirectedEdge) {
        return GameGraph.EdgeIndex.findIndex(({ u, v }) => edge.u == u && edge.v == v);
    }

    public getCurrentPlayer() {
        return this.currentPlayer;
    }

    public isGameOver() {
        return this.state == 0n;
    }

    public getPlayer1Score() {
        return this.player1Score;
    }

    public getPlayer2Score() {
        return this.player2Score;
    }

    public getScoreDifference() {
        return this.player1Score - this.player2Score;
    }

    public getWinner() {
        if (!this.isGameOver()) {
            return undefined;
        }

        const scoreDifference = this.getScoreDifference();
        if (scoreDifference > 0) {
            return Player.Player1;
        } else if (scoreDifference < 0) {
            return Player.Player2;
        }
        return Player.None;
    }
}
