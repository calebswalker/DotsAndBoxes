import { RNG } from "../agent/random";
import { getBoxesAdjacentToEdge, getEdgesAdjacentToBox } from "../graph/binarydotsandboxes";
import { GameGraph } from "../graph/gamegraph";
import { UndirectedEdge, edgeToString } from "../graph/undirectedgraph";

export type HashedState = bigint;

export class MonteCarloNode {
    public numberOfPlays: number = 0;
    public sumOfWins: number = 0;

    public static unexpandedNodes = 0;

    private childStates: HashedState[] = [];
    /** The index of the first child state that is unexpanded */
    private unexpandedIndex: number = 0;

    constructor(public readonly state: HashedState) {
        // These are states that would allow the next player to take a box
        const rejectedStates: HashedState[] = [];

        let mask = 1n;
        for (let i = 0; i < 58; i++) {
            if ((state & mask) != 0n) {
                // This is a takeable edge
                const childState = state & ~mask;

                // Before we consider adding this, ask: does this edge allow a capture next turn?
                const remainingAdjacentEdges = getBoxesAdjacentToEdge(i).map((boxId) => {
                    return getEdgesAdjacentToBox(boxId).reduce((previous, current) => {
                        // Count the number of edges that haven't been taken from the neighboring boxes in the child state
                        const edgeMask = 1n << BigInt(current);

                        if ((childState & edgeMask) != 0n) {
                            // This edge is takeable
                            return previous + 1;
                        }
                        return previous;
                    }, 0);
                });

                if (remainingAdjacentEdges[0] == 1 || remainingAdjacentEdges[1] == 1) {
                    // This edge allows your opponent to take a box next turn
                    rejectedStates.push(childState);
                } else {
                    // This edge is pretty safe
                    this.childStates.push(childState);
                }
            }

            mask = mask << 1n;
        }

        if (this.childStates.length == 0) {
            // If every state was rejected, then just use those
            this.childStates = rejectedStates;
        }

        // Randomize the states
        shuffle(this.childStates);

        if (this.childStates.length > 0 && this.state != 0n) {
            MonteCarloNode.unexpandedNodes++;
        }
    }

    /**
     * Iterates over all children from this node.
     */
    *allChildStates() {
        for (const child of this.childStates) {
            yield child;
        }
    }

    public numberOfChildStates() {
        return this.childStates.length;
    }

    public getNextUnexpandedState() {
        if (this.isFullyExpanded()) {
            throw new Error("Cannot expand state any further!");
        }

        const nextState = this.childStates[this.unexpandedIndex++];

        if (this.isFullyExpanded()) {
            MonteCarloNode.unexpandedNodes--;
        }

        return nextState;
    }

    /**
     * Whether this node is fully expanded.
     * @return {boolean} Whether this node is fully expanded.
     */
    public isFullyExpanded(): boolean {
        // If the pointer isn't pointing to a valid index anymore, all must've been expanded
        return this.unexpandedIndex >= this.childStates.length;
    }

    /**
     * Whether this node is terminal in the game tree, NOT INCLUSIVE of termination due to winning.
     * @return {boolean} Whether this node is a leaf in the tree.
     */
    public isLeaf(): boolean {
        return this.state == 0n;
    }

    /**
     * Get the UCB1 value for this node.
     * @param {number} parentNumberOfPlays - The number of plays of the parent.
     * @param {number} biasParam - The square of the bias parameter in the UCB1 algorithm, defaults to 2.
     * @return {number} The UCB1 value of this node.
     */
    public getUCB1(parentNumberOfPlays: number, biasParam: number = 2): number {
        return (
            this.sumOfWins / this.numberOfPlays +
            Math.sqrt((biasParam * Math.log(parentNumberOfPlays)) / this.numberOfPlays)
        );
    }

    public getStateFromMove(move: UndirectedEdge) {
        const index = BigInt(GameGraph.EdgeIndex.findIndex((value) => value.u == move.u && value.v == move.v));

        const mask = 1n << index;
        const state = this.state & ~mask;

        if (!this.childStates.includes(state)) {
            throw new Error(`Could not find ${state} among child states`);
        }

        return state;
    }

    public getRemainigStateEdges() {
        const edges: UndirectedEdge[] = [];

        let cloneState = this.state;
        let index = 0;
        while (cloneState > 0n) {
            if ((cloneState & 1n) == 1n) {
                edges.push(GameGraph.EdgeIndex[index]);
            }
            index++;
            cloneState = cloneState >> 1n;
        }

        return edges.map((edge) => edgeToString(edge));
    }
}

export function shuffle<T>(array: T[]) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(RNG() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}
