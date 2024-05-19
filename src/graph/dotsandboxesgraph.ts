import { Player } from "./../player";
import { GameGraph } from "./gamegraph";
import { UndirectedEdge, areUndirectedEdgesEqual, edgeToString, stringToEdge } from "./undirectedgraph";

export type Move = UndirectedEdge | UndirectedEdge[]; // A single move

export function arrayifyMove(move: Move): UndirectedEdge[] {
    if (Array.isArray(move)) {
        return move;
    } else {
        return [move];
    }
}

export function arrayifyAllMoves(moves: Move[]): UndirectedEdge[][] {
    return moves.map((move) => arrayifyMove(move));
}

export function reduceAllMoves(moves: Move[]): UndirectedEdge[] {
    return moves.reduce<UndirectedEdge[]>(
        (previous, move) => previous.concat(arrayifyMove(move)),
        [] as UndirectedEdge[]
    );
}

export function* moveIterator(move: Move) {
    if (Array.isArray(move)) {
        for (const m of move) {
            yield m;
        }
    } else {
        yield move;
    }
}

export type MoveResult = { move: UndirectedEdge; completedBox: boolean };

export class DotsAndBoxesGraph extends GameGraph {
    /** Which player owns which box (or None if it's incomplete) */
    protected readonly boxOwners: Map<number, Player> = new Map<number, Player>();

    private currentPlayer: Player = Player.Player1;
    private player1Score: number = 0;
    private player2Score: number = 0;

    private readonly moveLog: { player: Player; moves: UndirectedEdge[] }[] = [];

    constructor(otherDotsAndBoxesGraph?: DotsAndBoxesGraph) {
        super(otherDotsAndBoxesGraph);

        if (otherDotsAndBoxesGraph) {
            this.boxOwners = new Map(otherDotsAndBoxesGraph.boxOwners);
            this.currentPlayer = otherDotsAndBoxesGraph.currentPlayer;
            this.moveLog = [...otherDotsAndBoxesGraph.moveLog];

            this.player1Score = otherDotsAndBoxesGraph.player1Score;
            this.player2Score = otherDotsAndBoxesGraph.player2Score;
        } else {
            // Add all the box controls
            for (const innerNode of this.getInnerNodes()) {
                this.boxOwners.set(innerNode, Player.None);
            }
        }
    }

    public static cleanFromGameGraph(gameGraph: GameGraph, currentPlayer: Player = Player.Player1): DotsAndBoxesGraph {
        const newGraph = new DotsAndBoxesGraph();
        for (const { u, v } of [...newGraph.edges()]) {
            if (!gameGraph.hasEdge(u, v)) {
                newGraph.removeEdge(u, v);
            }
        }

        newGraph.currentPlayer = currentPlayer;
        return newGraph;
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

    public getCurrentPlayer() {
        return this.currentPlayer;
    }

    public isPlayer1sTurn(): boolean {
        return this.getCurrentPlayer() == Player.Player1;
    }

    public getUnclaimedEdges() {
        return [...this.edges()];
    }

    public getUnclaimedEdgesThatDoNotCreateABox() {
        // ! OPTIMIZE
        return [...this.edges()].filter(
            ({ u, v }) => (this.isOuterNode(u) || this.degree(u) > 2) && (this.isOuterNode(v) || this.degree(v) > 2)
        );
    }

    public getEdgesThatEitherCaptureABoxOrDoNotCreateABox(returnEarly?: boolean) {
        // ! OPTIMIZE
        const allEdges = [...this.edges()];

        const capturingMoves = allEdges.filter(
            ({ u, v }) => (this.isInnerNode(u) && this.degree(u) == 1) || (this.isInnerNode(v) && this.degree(v) == 1)
        );

        if (returnEarly && capturingMoves.length > 0) {
            return capturingMoves;
        }

        const nonCapturingMoves = allEdges.filter(({ u, v }) => this.degree(u) != 2 && this.degree(v) != 2);
        if (nonCapturingMoves.length > 0) {
            capturingMoves.push(...nonCapturingMoves);
            return capturingMoves;
        }

        return allEdges;
    }

    public isEndGame() {
        // ! OPTIMIZE
        for (const { u, v } of this.edges()) {
            if ((this.isOuterNode(u) || this.degree(u) > 2) && (this.isOuterNode(v) || this.degree(v) > 2)) {
                // This edge won't open a capturable component
                return false;
            }
        }

        return true;
    }

    public getBoxOwner(boxId: number): Player | undefined {
        return this.boxOwners.get(boxId);
    }

    private setBoxOwner(boxId: number, player: Player) {
        const currentOwner = this.boxOwners.get(boxId);
        if (currentOwner == undefined || (currentOwner != Player.None && player != Player.None)) {
            throw new Error(`Box ${boxId} either doesn't exist or is already taken`);
        }

        if (currentOwner == Player.Player1) {
            this.player1Score--;
        } else if (currentOwner == Player.Player2) {
            this.player2Score--;
        }

        this.boxOwners.set(boxId, player);
        if (player == Player.Player1) {
            this.player1Score++;
        } else if (player == Player.Player2) {
            this.player2Score++;
        }
    }

    public *boxes() {
        for (const boxId of this.boxOwners.keys()) {
            yield boxId;
        }
    }

    public *unownedBoxes() {
        for (const [boxId, owner] of this.boxOwners) {
            if (owner == Player.None) {
                yield boxId;
            }
        }
    }

    public *boxesAndOwners() {
        for (const [boxId, owner] of this.boxOwners) {
            yield [boxId, owner] as [number, Player];
        }
    }

    public makeMove(move: Move): MoveResult[] {
        // Unpack all the moves
        const moveActions: MoveResult[] = [];

        let failedToCompleteBox = false;

        for (const edge of moveIterator(move)) {
            if (failedToCompleteBox) {
                // We failed to complete a box but the move continues. This is an error.
                debugger;
                throw new Error("Move continues past completing no more boxes");
            }

            const moveAction = this.makeSingleMove(edge);

            moveActions.push(moveAction);

            if (!moveAction.completedBox) {
                // Failed to complete a box. In practice, the loop should break naturally here
                failedToCompleteBox = true;
            }
        }

        return moveActions;
    }

    public makeSingleMove({ u, v }: UndirectedEdge): MoveResult {
        if (!this.hasEdge(u, v)) {
            throw new Error(`Illegal move: ${u}-${v}`);
        }

        // Delete the edge
        const deletedEdge = this.removeEdge(u, v);

        // Record the move
        let moveRecord = this.moveLog.length > 0 ? this.moveLog[this.moveLog.length - 1] : undefined;
        if (!moveRecord || moveRecord.player != this.currentPlayer) {
            // Create a new record
            moveRecord = { player: this.currentPlayer, moves: [] };
            this.moveLog.push(moveRecord);
        }
        moveRecord.moves.push(deletedEdge);

        // Check if any boxes are now complete
        let completedBox = false;
        if (this.isInnerNode(u) && this.degree(u) == 0) {
            // Completed this box
            this.setBoxOwner(u, this.currentPlayer);
            completedBox = true;
        }
        if (this.isInnerNode(v) && this.degree(v) == 0) {
            // Completed this box
            this.setBoxOwner(v, this.currentPlayer);
            completedBox = true;
        }

        const moveAction = { move: deletedEdge, completedBox: completedBox };

        if (!completedBox) {
            // Failed to complete a box. Your turn is over.
            this.currentPlayer = -this.currentPlayer;
        }
        return moveAction;
    }

    /**
     * @returns `undefined` if the game isn't over, `Player.None` if this is a draw, otherwise the player who won.
     */
    public getWinner(): Player | undefined {
        if (!this.isGameOver()) {
            return undefined;
        }

        let runningSum = this.getScoreDifference();
        if (runningSum > 0) {
            return Player.Player1;
        } else if (runningSum < 0) {
            return Player.Player2;
        } else {
            // It's a tie
            return Player.None;
        }
    }

    public isGameOver() {
        // The game is over is there are no more edges to take
        return this.numberOfEdges() == 0;
    }

    public revertMove(move: Move) {
        const arrayOfMoves = arrayifyMove(move);

        for (let i = arrayOfMoves.length - 1; i >= 0; i--) {
            const edge = arrayOfMoves[i];
            const revertedEdge = this.revertSingleMove();
            if (!areUndirectedEdgesEqual(revertedEdge, edge)) {
                debugger; // TODO: Remove if nothing is wrong
            }
        }
    }

    public revertEntirePlayerMove() {
        const currentMoveLogLength = this.moveLog.length;

        while (this.moveLog.length == currentMoveLogLength) {
            this.revertSingleMove();
        }
    }

    public revertSingleMove() {
        const moveRecord = this.moveLog.pop();
        if (!moveRecord) {
            throw new Error("No move to revert");
        }

        const lastMove = moveRecord.moves.pop();
        if (!lastMove) {
            throw new Error("no single move to remove");
        }

        // Restore the edge
        this.addEdge(lastMove.u, lastMove.v);

        // Check if a box was created by that edge (if so, unset it)
        const box1 = this.getBoxOwner(lastMove.u);
        const box2 = this.getBoxOwner(lastMove.v);

        if (box1 != undefined && box1 != Player.None) {
            this.setBoxOwner(lastMove.u, Player.None);
        }
        if (box2 != undefined && box2 != Player.None) {
            this.setBoxOwner(lastMove.v, Player.None);
        }

        // Update the player
        this.currentPlayer = moveRecord.player;

        if (moveRecord.moves.length > 0) {
            // Still some left, put it back on the stack
            this.moveLog.push(moveRecord);
        }

        return lastMove;
    }

    public moveLogLength() {
        return this.moveLog.length;
    }

    public getAllLegalMoves(): Move[] {
        const singletonEdgeMoves: Set<String> = new Set(); // The set of all edges that are just moves by themselves
        const allEdgeMoves: Set<String> = new Set(); // The set of all edges that have been processed
        const capturableComponentMoves: { fullCapture: Move; handout?: Move | undefined }[] = [];

        // All the moves are edges, so go through them all
        for (const edge of this.edges()) {
            const edgeKey = edgeToString(edge);
            if (allEdgeMoves.has(edgeKey)) {
                // This is already part of a move
                continue;
            }

            const degreeU = this.degree(edge.u);
            const degreeV = this.degree(edge.v);

            const componentRootVertex =
                this.isInnerNode(edge.u) && degreeU == 1
                    ? edge.u
                    : this.isInnerNode(edge.v) && degreeV == 1
                    ? edge.v
                    : undefined;

            if (componentRootVertex != undefined) {
                // This is a capturable component

                const componentEdges: UndirectedEdge[] = [];
                // We can DFS because one vertex will just lead to another
                let previousNode: number | undefined = componentRootVertex;
                for (const neighbor of this.dfs(componentRootVertex)) {
                    if (neighbor == componentRootVertex) {
                        continue;
                    }

                    if (previousNode != undefined) {
                        componentEdges.push({
                            u: Math.min(previousNode, neighbor),
                            v: Math.max(previousNode, neighbor),
                        });
                    }

                    if (this.degree(neighbor) > 2) {
                        // End of the component
                        break;
                    }
                    previousNode = neighbor;
                }

                if (componentEdges.length == 1) {
                    // This is a capturable component of length 2, which means that it's effectively a singleton move
                    const key = edgeToString(edge);
                    singletonEdgeMoves.add(key);
                    allEdgeMoves.add(key);

                    continue;
                }

                // Remove all the edges that would be moves from this component
                componentEdges.forEach((edge) => {
                    const key = edgeToString(edge);
                    singletonEdgeMoves.delete(key);
                    allEdgeMoves.add(key);
                });

                // This isn't a move yet, so just save it
                const theMove: { fullCapture: Move; handout?: Move | undefined } = {
                    fullCapture: componentEdges,
                };

                const isOpenChain = this.degree(previousNode) == 2;
                const isOpenLoop = this.degree(previousNode) == 1;

                if (isOpenChain && componentEdges.length >= 2) {
                    // We can do a heavy handed handout
                    // To do this, we basically just skip the second to last edge
                    const move = componentEdges.slice(0, -2);
                    move.push(componentEdges[componentEdges.length - 1]);

                    // This will end our turn, so this is a full move
                    theMove.handout = move;
                } else if (isOpenLoop && componentEdges.length >= 5) {
                    // ? Should this just be the minimum componentEdges.length >= 3?
                    // We can do a heavy handed handout

                    // To do this, we basically just skip the last 3 edges and take the penultimate one
                    const move = componentEdges.slice(0, -3);
                    move.push(componentEdges[componentEdges.length - 2]);

                    // This will end our turn, so this is a full move
                    theMove.handout = move;
                }

                // Save this
                capturableComponentMoves.push(theMove);
            } else {
                // This is just a singleton edge move
                singletonEdgeMoves.add(edgeToString(edge));
            }
        }

        // Now, we create the moves
        if (capturableComponentMoves.length >= 2) {
            // If there are two or more captureable moves, we will only consider moves that completely capture the components
            // This is because more captures may be dependent on completing current captures
            // We won't have the foresight to see this, so we'll have to do this for now.
            return capturableComponentMoves.map(({ fullCapture }) => fullCapture);
        }

        if (capturableComponentMoves.length == 1) {
            // There's only one captureable component, so you can either capture it all, or do the handout.
            const allMoves: Move[] = [];

            const onlyCapture = capturableComponentMoves[0];
            allMoves.push(onlyCapture.fullCapture);

            // Just add the handout, if it exists
            const handout = onlyCapture.handout;
            if (handout != undefined) {
                allMoves.push(handout);
            }
            return allMoves;
        }

        // Otherwise, you should only have singleton moves available
        const allMoves: Move[] = [];
        for (const singletonEdge of singletonEdgeMoves) {
            // First, capture all components, then take the edge to complete the move
            allMoves.push(stringToEdge(singletonEdge));
        }

        return allMoves;
    }

    public getAllPlayedMoves() {
        return this.moveLog.flatMap((value) => value.moves);
    }

    public getFullHash() {
        const freshState: bigint = BigInt(
            ((this.getScoreDifference() + 24) << 1) | // Add 24 to make it nonnegative, then shift 1 to allow the player turn bit
                (this.isPlayer1sTurn() ? 0 : 1)
        );
        return (this.getEdgeHash() << 8n) | freshState; // Technically we don't need to shift it 8 bits, but it's close enough and clean enough to work
    }

    public static BoxIndex = [
        11, 12, 13, 14, 15, 16, 21, 22, 23, 24, 25, 26, 31, 32, 33, 34, 35, 36, 41, 42, 43, 44, 45, 46,
    ];
}
