import { RNG } from "../agent/random";
import { getBoxesAdjacentToEdge, getEdgesAdjacentToBoxThatStillExist } from "../graph/binarydotsandboxes";
import { DotsAndBoxesGraph } from "../graph/dotsandboxesgraph";
import { GameGraph } from "../graph/gamegraph";
import { UndirectedEdge, edgeToString } from "../graph/undirectedgraph";
import { Player } from "../player";
import { HashedState, MonteCarloNode, shuffle } from "./montecarlonode";

type PlayerState = { node: MonteCarloNode; currentPlayer: Player };

export class MonteCarloTreeSelection {
    private expandedNodes = new Map<HashedState, MonteCarloNode>();
    private rootNode: MonteCarloNode;

    private initialPlayer1Score: number;
    private initialPlayer2Score: number;

    constructor(game: DotsAndBoxesGraph, private UCB1ExploreParam: number = 2) {
        MonteCarloNode.unexpandedNodes = 0;

        const gameHash = game.getEdgeHash();
        this.rootNode = new MonteCarloNode(gameHash);
        console.log("Current Player", game.getCurrentPlayer());
        this.initialPlayer1Score =
            game.getCurrentPlayer() == Player.Player1 ? game.getPlayer1Score() : game.getPlayer2Score();
        this.initialPlayer2Score =
            game.getCurrentPlayer() == Player.Player2 ? game.getPlayer1Score() : game.getPlayer2Score();
        this.expandedNodes.set(gameHash, this.rootNode);
    }

    private getNodeOrThrow(state: HashedState | undefined) {
        if (state == undefined) {
            debugger;
            throw new Error(`State is undefined`);
        }

        const node = this.expandedNodes.get(state);
        if (node == undefined) {
            debugger;
            throw new Error(`Node for state ${state.toString(2)} does not exist`);
        }
        return node;
    }

    private getEdgeIndicesFromStateDelta(currentState: HashedState, previousState: HashedState = this.rootNode.state) {
        const edgeIndices: number[] = [];

        let differentBits = previousState ^ currentState;
        let index = 0;
        while (differentBits > 0n) {
            if ((differentBits & 1n) == 1n) {
                // This is a different edge
                edgeIndices.push(index);
            }

            differentBits = differentBits >> 1n;
            index++;
        }

        return edgeIndices;
    }

    private getEdgesFromStateDelta(currentState: HashedState, previousState: HashedState = this.rootNode.state) {
        return this.getEdgeIndicesFromStateDelta(currentState, previousState).map(
            (edgeIndex) => GameGraph.EdgeIndex[edgeIndex]
        );
    }

    private arrayOfStatesToMoves(states: HashedState[]) {
        const output: string[] = [];
        for (let i = 0; i < states.length - 1; i++) {
            const previous = states[i];
            const next = states[i + 1];

            const moves = this.getEdgesFromStateDelta(next, previous)
                .map((edge) => edgeToString(edge))
                .join("|");
            output.push(moves);
        }
        return output;
    }

    public summarize(node = this.rootNode) {
        for (const childState of this.rootNode.allChildStates()) {
            const childNode = this.expandedNodes.get(childState);

            if (childNode != undefined) {
                console.log({
                    moves: this.getEdgesFromStateDelta(childState)
                        .map((edge) => edgeToString(edge))
                        .join(","),
                    hash: childNode.state,
                    numberOfPlays: childNode.numberOfPlays,
                    sumOfWins: childNode.sumOfWins,
                    ratio: childNode.sumOfWins / childNode.numberOfPlays,
                    UCB1: childNode.getUCB1(this.rootNode.numberOfPlays, this.UCB1ExploreParam),
                });
            }
        }
    }

    /** Get the best move from available statistics. */
    public bestMove(policy: "robust" | "max" = "max") {
        const stateNode = this.rootNode;
        let bestNode: MonteCarloNode | undefined;

        if (stateNode.numberOfChildStates() == 1) {
            return { move: this.getEdgesFromStateDelta([...stateNode.allChildStates()][0])[0] };
        }

        if (!stateNode.isFullyExpanded()) {
            debugger;
            throw new Error("Not enough information!");
        }

        if (bestNode == undefined) {
            const allChildStates = stateNode.allChildStates();
            // Most visits (robust child)
            if (policy === "robust") {
                let max = -Infinity;
                for (let childState of allChildStates) {
                    const childNode = this.getNodeOrThrow(childState);
                    if (childNode.numberOfPlays > max) {
                        bestNode = childNode;
                        max = childNode.numberOfPlays;
                    }
                }
            }
            // Highest winrate (max child)
            else if (policy === "max") {
                let max = -Infinity;
                for (let childState of allChildStates) {
                    let childNode = this.getNodeOrThrow(childState);
                    let ratio = childNode.sumOfWins / childNode.numberOfPlays;
                    if (ratio > max) {
                        bestNode = childNode;
                        max = ratio;
                    }
                }
            }

            if (bestNode == undefined) {
                debugger;
                throw new Error("best state is undefined after searching");
            }
        }

        const bestMove = this.getEdgesFromStateDelta(bestNode.state)[0];
        return { move: bestMove, value: bestNode.sumOfWins / Math.max(bestNode.numberOfPlays, 1) };
    }

    /** Phase 1, Selection: Select until not fully expanded OR leaf */
    private select(state: HashedState) {
        let selectedNode = this.getNodeOrThrow(state);

        const nodesVisited: MonteCarloNode[] = [selectedNode];

        while (selectedNode.isFullyExpanded() && !selectedNode.isLeaf()) {
            let bestState: HashedState | undefined;
            let bestUCB1 = -Infinity;
            let countOfContenders = 1;
            const ucbs: number[] = [];
            for (const childState of selectedNode.allChildStates()) {
                const childUCB1 = this.getNodeOrThrow(childState).getUCB1(
                    nodesVisited[nodesVisited.length - 1].numberOfPlays,
                    this.UCB1ExploreParam
                );
                if (childUCB1 > bestUCB1 || (childUCB1 == bestUCB1 && RNG() < 1 / countOfContenders++)) {
                    bestState = childState;
                    bestUCB1 = childUCB1;
                }
                ucbs.push(childUCB1);
            }
            selectedNode = this.getNodeOrThrow(bestState);
            nodesVisited.push(selectedNode);
        }
        return { nodesVisited, selectedNode };
    }

    /** Phase 2, Expansion: Expand a random unexpanded child node */
    private expand(node: MonteCarloNode) {
        const unexpandedState = node.getNextUnexpandedState();

        let childNode = this.expandedNodes.get(unexpandedState);
        if (childNode == undefined) {
            childNode = new MonteCarloNode(unexpandedState);
            this.expandedNodes.set(unexpandedState, childNode);
        }

        return childNode;
    }

    /** Phase 3, Simulation: Play game to terminal state, return winner */
    private simulate(node: MonteCarloNode) {
        const gameGraph = GameGraph.fromHash(node.state);
        const cleanGame = DotsAndBoxesGraph.cleanFromGameGraph(gameGraph);

        const moves = shuffle(cleanGame.getUnclaimedEdges());
        for (const move of moves) {
            cleanGame.makeMove(move);
        }

        const winner = cleanGame.getWinner();
        if (winner == undefined) {
            debugger;
            throw new Error("winner was not defined");
        }

        return winner;
    }

    private getNumberOfCompletedBoxesAdjacentToEdge(state: HashedState, edgeIndex: number) {
        const adjacentBoxes: number[] = getBoxesAdjacentToEdge(edgeIndex);

        const numberOfBoxesCompleted = adjacentBoxes.reduce((previous, boxIndex) => {
            const row = Math.floor(boxIndex / 6);

            const topEdge = boxIndex;
            const bottomEdge = topEdge + 6;
            const leftEdge = boxIndex + 30 + row;
            const rightEdge = leftEdge + 1;

            const completedABox = [topEdge, bottomEdge, leftEdge, rightEdge].every((edge) => {
                const mask = 1n << BigInt(edge);
                return (state & mask) == 0n;
            });

            if (completedABox) {
                return previous + 1;
            }
            return previous;
        }, 0);

        return numberOfBoxesCompleted;
    }

    /** Phase 3, Simulation: Play game to terminal state, return winner */
    private simulateBinary(playerState: PlayerState, player1Score = 0, player2Score = 0) {
        // TODO: Test
        let state = playerState.node.state;
        let currentPlayer = playerState.currentPlayer;

        const moveMaskMap = new Map<number, HashedState>();
        const moveIndices: number[] = [];

        // Compute all the legal moves
        let index = 0;
        let mask = 1n;
        let tempState = state;
        while (tempState > 0) {
            if ((tempState & 1n) == 1n) {
                // There is a legal edge here
                moveMaskMap.set(index, mask);
                moveIndices.push(index);
            }

            index++;
            mask = mask << 1n;
            tempState = tempState >> 1n;
        }

        // Shuffle the legal moves
        shuffle(moveIndices);

        // Simulate all the moves
        for (const edgeIndex of moveIndices) {
            const mask = moveMaskMap.get(edgeIndex);
            if (mask == undefined) {
                // This means that the move wasn't valid after all (shouldn't happen)
                throw new Error("edge was invalid");
            }

            // Perform the move by masking out the edge
            const newState = state & ~mask;
            if (newState == state) {
                throw new Error("edge was an invalid move");
            }
            state = newState;

            moveMaskMap.delete(edgeIndex); // We're done with the edge

            const boxesCompleted = this.getNumberOfCompletedBoxesAdjacentToEdge(state, edgeIndex);
            if (boxesCompleted == 0) {
                // Didn't complete a box, flip players
                currentPlayer = -currentPlayer;
            } else {
                // Completed boxes! Award points.
                if (currentPlayer == Player.Player1) {
                    player1Score += boxesCompleted;
                } else {
                    player2Score += boxesCompleted;
                }
            }
        }

        // Compute the winner
        const scoreDifference = player1Score - player2Score;
        const reward = scoreDifference / Math.max(player1Score + player2Score, 1);
        return reward;
    }

    private simulateBinaryGreedy(playerState: PlayerState, player1Score = 0, player2Score = 0) {
        let state = playerState.node.state;
        let currentPlayer = playerState.currentPlayer;

        const oneVertices: Set<number> = new Set();
        const minDegrees = new Map<number, number>();

        const moveMaskMap = new Map<number, HashedState>();
        const moveIndices: number[] = [];

        // Compute all the legal moves
        let index = 0;
        let mask = 1n;
        let tempState = state;
        while (tempState > 0) {
            if ((tempState & 1n) == 1n) {
                // There is a legal edge here
                moveMaskMap.set(index, mask);
                moveIndices.push(index);

                // Compute what the minimum degree of the edge is, then categorize it by that degree
                const minDegree = getBoxesAdjacentToEdge(index).reduce((accum, boxIndex) => {
                    return Math.min(getEdgesAdjacentToBoxThatStillExist(state, boxIndex).length, accum);
                }, 4);

                minDegrees.set(index, minDegree);
                if (minDegree == 1) {
                    oneVertices.add(index);
                }
            }

            index++;
            mask = mask << 1n;
            tempState = tempState >> 1n;
        }

        const epsilon = 0.01; // The threshold to not choose a free box

        const moveLog: number[] = [];

        while (minDegrees.size != 0) {
            let edgeIndex: number = -1;
            let choseOneVertex: boolean = false;

            // If there are any one vertices, prioritize those
            if (oneVertices.size > 0 && RNG() >= epsilon) {
                edgeIndex = oneVertices.values().next().value;
                choseOneVertex = true;
            } else {
                // Otherwise, just choose a random remaining edge
                const chosenCount = Math.floor(RNG() * minDegrees.size);
                let count = 0;
                for (let key of minDegrees.keys()) {
                    if (count === chosenCount) {
                        edgeIndex = key;
                        break;
                    }
                    count++;
                }
            }

            moveLog.push(edgeIndex);

            const mask = moveMaskMap.get(edgeIndex);
            if (mask == undefined) {
                // This means that the move wasn't valid after all (shouldn't happen)
                throw new Error("edge was invalid");
            }

            // Perform the move by masking out the edge
            const newState = state & ~mask;
            if (newState == state) {
                throw new Error("edge was an invalid move");
            }
            state = newState;

            // Count how many boxes we completed and update the min indexes of each relevant edge
            let boxesCompleted = 0;
            getBoxesAdjacentToEdge(edgeIndex).forEach((boxIndex) => {
                // For each box adjacent to chosen edge, get its edges
                const adjacentEdges = getEdgesAdjacentToBoxThatStillExist(state, boxIndex);

                if (adjacentEdges.length == 0) {
                    // No edges means we completed this box!
                    boxesCompleted++;
                    return;
                }
                adjacentEdges.forEach((adjacentEdgeIndex) => {
                    // For each edge that's adjacent to that box index (that's still remaining), compute its new min degree
                    const currentMinDegree = minDegrees.get(adjacentEdgeIndex);

                    if (currentMinDegree == undefined) {
                        throw new Error("min degree is undefined");
                    }

                    const newMinDegree = getBoxesAdjacentToEdge(adjacentEdgeIndex).reduce((accum, boxIndex) => {
                        return Math.min(getEdgesAdjacentToBoxThatStillExist(state, boxIndex).length, accum);
                    }, currentMinDegree);

                    if (newMinDegree == 1 && !oneVertices.has(adjacentEdgeIndex)) {
                        oneVertices.add(adjacentEdgeIndex);
                    }
                    minDegrees.set(adjacentEdgeIndex, newMinDegree);
                });
            });

            if (boxesCompleted == 0) {
                // Didn't complete a box, flip players
                currentPlayer = -currentPlayer;
            } else {
                // Completed boxes! Award points.
                if (currentPlayer == Player.Player1) {
                    player1Score += boxesCompleted;
                } else {
                    player2Score += boxesCompleted;
                }
            }

            moveMaskMap.delete(edgeIndex); // We're done with the edge
            minDegrees.delete(edgeIndex); // Important to stop iterating
            oneVertices.delete(edgeIndex); // Just in case we were going to consider it anyway
        }

        if (state != 0n) {
            // We didn't get to the end of the game
            throw new Error("did not reach the end of the game");
        }

        // Compute the winner
        const scoreDifference = player1Score - player2Score;
        const reward = scoreDifference / Math.max(player1Score + player2Score, 1);
        return reward;
    }

    /** Phase 4, Backpropagation: Update ancestor statistics */
    private backPropagate(nodes: PlayerState[], reward: number) {
        // TODO: Flip the sign according to the player

        const winner = reward > 0 ? Player.Player1 : reward < 0 ? Player.Player2 : Player.None;

        for (let i = nodes.length - 1; i >= 0; i--) {
            const { node, currentPlayer } = nodes[i];
            node.numberOfPlays += 1;
            // if (nodes[i - 1].currentPlayer == winner) {
            if (i - 1 >= 0) {
                // If the previous node had the winner as it's current player
                node.sumOfWins += nodes[i - 1].currentPlayer * reward;
            }
            // } else {
            // node.sumOfWins -= reward;
            // }
        }
    }

    public runSearch(state: HashedState = this.rootNode.state, timeout = 10) {
        const determineCurrentPlayer = (nodesVisited: MonteCarloNode[]) => {
            let currentPlayer = Player.Player1;
            let player1Score = this.initialPlayer1Score;
            let player2Score = this.initialPlayer2Score;

            const playerStates: PlayerState[] = [{ node: nodesVisited[0], currentPlayer: Player.Player1 }];

            let previousState = nodesVisited[0].state;
            for (let i = 1; i < nodesVisited.length; i++) {
                const currentNode = nodesVisited[i];
                const currentState = currentNode.state;
                const edgeIndices = this.getEdgeIndicesFromStateDelta(currentState, previousState);

                if (edgeIndices.length != 1) {
                    debugger;
                    throw new Error("invalid number of indices");
                }

                const edgeIndex = edgeIndices[0];
                const boxesCompleted = this.getNumberOfCompletedBoxesAdjacentToEdge(currentState, edgeIndex);

                if (boxesCompleted == 0) {
                    // Flip player
                    currentPlayer = -currentPlayer;
                } else {
                    if (currentPlayer == Player.Player1) {
                        player1Score += boxesCompleted;
                    } else {
                        player2Score += boxesCompleted;
                    }
                }

                previousState = currentState;
                playerStates.push({
                    node: currentNode,
                    currentPlayer: currentNode.isLeaf() ? Player.None : currentPlayer, // The terminal state has no meaningful current player
                });
            }

            return { playerStates, currentPlayer, player1Score, player2Score };
        };

        if (this.rootNode.numberOfChildStates() == 1) {
            return;
        }

        let end = Date.now() + timeout * 1000;
        let count = 0;
        while (Date.now() < end) {
            // while (count < 100000) {
            let { selectedNode, nodesVisited } = this.select(state);
            let reward: number | undefined = undefined;

            let visitedPlayerStates: PlayerState[];

            if (!selectedNode.isLeaf()) {
                const expandedNode = this.expand(selectedNode);
                nodesVisited.push(expandedNode);
                const { playerStates, currentPlayer, player1Score, player2Score } =
                    determineCurrentPlayer(nodesVisited);
                reward = this.simulateBinaryGreedy(
                    playerStates[playerStates.length - 1], // Use the last player state
                    player1Score,
                    player2Score
                );

                visitedPlayerStates = playerStates;
            } else {
                // We've reached a terminal state, so just simulate the whole game to determine the winner
                const { playerStates, player1Score, player2Score } = determineCurrentPlayer(nodesVisited);
                const scoreDifference = player1Score - player2Score;

                visitedPlayerStates = playerStates;
                reward = (1 * scoreDifference) / Math.max(player1Score + player2Score, 1);
                // reward = scoreDifference;
                // reward = scoreDifference > 0 ? 1 : scoreDifference < 0 ? -1 : 0;
            }

            this.backPropagate(visitedPlayerStates, reward);
            count++;
        }

        console.log(`Unexpanded Nodes Remaining:`, MonteCarloNode.unexpandedNodes);

        console.log(`MCTS: ${count} iterations`);
    }

    private getChildNodeFromMove(node: MonteCarloNode, move: UndirectedEdge) {
        const childState = node.getStateFromMove(move);

        return this.expandedNodes.get(childState);
    }
}
