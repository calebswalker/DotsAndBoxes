import { DotsAndBoxesGraph, Move } from "../graph/dotsandboxesgraph";
import { EndgameMinimaxState } from "./endgameminimaxstate";

type MinimaxResponse = { value: number; bestAction: Move[] };

export class EndgameAlphaBetaAgent {
    private readonly endgameMinimax: EndgameMinimaxState;

    public constructor(board: DotsAndBoxesGraph) {
        this.endgameMinimax = new EndgameMinimaxState(board);
    }

    public getOptimalAction(): MinimaxResponse {
        const alpha = -Infinity;
        const beta = Infinity;

        this.depth = 0n;
        this.cacheHit = 0;
        this.cacheCount = 0;
        this.cachedStates.clear();

        const { bestAction, value } = this.getValue(alpha, beta);

        return { bestAction: bestAction, value: value };
    }

    private cachedStates = new Map<bigint, MinimaxResponse>();
    private cacheHit = 0;
    private cacheCount = 0;
    private depth = 0n;

    public getCacheHitRate() {
        return this.cacheHit / Math.max(this.cacheCount, 1);
    }

    private getValue(
        alpha: number,
        beta: number,
        /** If we know we're in an endgame, set this to true to stop checking */
        forceEndgame?: boolean
    ) {
        this.cacheCount++;
        this.depth++;
        const state = this.endgameMinimax.getStateHash(alpha, beta, this.depth);

        const previousValue = this.cachedStates.get(state);
        if (previousValue != undefined) {
            this.cacheHit++;
            this.depth--;
            return previousValue;
        }

        let value: MinimaxResponse;
        const isPlayer1sTurn = this.endgameMinimax.isPlayer1sTurn();
        if (forceEndgame || this.endgameMinimax.isEndGame()) {
            if (isPlayer1sTurn) {
                value = this.maxEndgameValue(alpha, beta);
            } else {
                value = this.minEndgameValue(alpha, beta);
            }
        } else {
            if (isPlayer1sTurn) {
                value = this.maxNormalWithCapturesValue(alpha, beta);
            } else {
                value = this.minNormalWithCapturesValue(alpha, beta);
            }
        }
        this.cachedStates.set(state, value);
        this.depth--;
        return value;
    }

    /** @deprecated */
    private getEndgameValue(alpha: number, beta: number) {
        this.cacheCount++;
        const state = this.endgameMinimax.getStateHash(alpha, beta, this.depth);

        const previousValue = this.cachedStates.get(state);
        if (previousValue != undefined) {
            this.cacheHit++;
            return previousValue;
        }

        let value: MinimaxResponse;
        if (this.endgameMinimax.isPlayer1sTurn()) {
            value = this.maxEndgameValue(alpha, beta);
        } else {
            value = this.minEndgameValue(alpha, beta);
        }
        this.cachedStates.set(state, value);
        return value;
    }

    private maxEndgameValue(alpha: number, beta: number): MinimaxResponse {
        if (!this.endgameMinimax.isPlayer1sTurn()) {
            throw new Error("Wrong Player");
        }

        const { capturableComponentSequence, nonCapturableComponents } =
            this.endgameMinimax.computeAllCurrentComponents();
        const gameIsEnding = nonCapturableComponents.length == 0; // There are no remaining non-capturable, which means everything must be capturable, ending the game

        if (gameIsEnding) {
            return {
                value: this.endgameMinimax.evaluate(true),
                bestAction: capturableComponentSequence.map((capturableComponent) =>
                    this.endgameMinimax.getFullCaptureMove(capturableComponent)
                ),
            };
        }

        let v = -Infinity;
        let lastAction: Move[] | undefined = undefined;
        const mandatoryMoves: Move[] = [];

        // Capture all the capturable components (except for the last one, we'll handle that specially)
        for (let i = 0; i < capturableComponentSequence.length - 1; i++) {
            const capturableComponent = capturableComponentSequence[i];

            const fullCapture = this.endgameMinimax.getFullCaptureMove(capturableComponent);

            mandatoryMoves.push(fullCapture);
            this.endgameMinimax.execute(fullCapture);
        }

        let shortCircuit = false;
        let lastMoveFullCapture: Move | undefined = undefined;

        const lastMove = capturableComponentSequence[capturableComponentSequence.length - 1];
        if (lastMove != undefined) {
            // For the last one, split between handing out and continuing onwards
            const { intersection, handoutSuffix, fullCaptureSuffix } =
                this.endgameMinimax.splitCapturableComponent(lastMove);

            if (intersection.length > 0) {
                mandatoryMoves.push(intersection);
                this.endgameMinimax.execute(intersection);
            }

            if (handoutSuffix != undefined) {
                // Give a handout
                this.endgameMinimax.execute(handoutSuffix);
                const { value } = this.getValue(alpha, beta, true);
                this.endgameMinimax.revert(handoutSuffix);

                if (lastAction == undefined || value > v) {
                    lastAction = [handoutSuffix];
                    v = value;
                }

                if (v >= beta) {
                    // Short Circuit
                    shortCircuit = true;
                } else {
                    alpha = Math.max(alpha, v);
                }
            }

            // Continue onwards with a full capture
            lastMoveFullCapture = fullCaptureSuffix;
        }

        if (!shortCircuit) {
            if (lastMoveFullCapture != undefined) {
                // Do the full capture of the last move
                this.endgameMinimax.execute(lastMoveFullCapture);
            }

            for (const nonCapturableComponent of nonCapturableComponents) {
                const move = this.endgameMinimax.getNonCapturableComponentOpenMove(nonCapturableComponent);

                this.endgameMinimax.execute(move);
                const { value } = this.getValue(alpha, beta, true);
                this.endgameMinimax.revert(move);

                if (lastAction == undefined || value > v) {
                    lastAction = lastMoveFullCapture != undefined ? [lastMoveFullCapture, move] : [move];
                    v = value;
                }

                if (v >= beta) {
                    // Short Circuit
                    break;
                }
                alpha = Math.max(alpha, v);
            }

            if (lastMoveFullCapture != undefined) {
                this.endgameMinimax.revert(lastMoveFullCapture);
            }
        }

        // Undo all the mandatory captures
        for (let i = mandatoryMoves.length - 1; i >= 0; i--) {
            this.endgameMinimax.revert(mandatoryMoves[i]);
        }

        const bestAction: Move[] = mandatoryMoves;
        if (lastAction != undefined) {
            bestAction.push(...lastAction);
        }

        return {
            value: v,
            bestAction,
        };
    }

    private minEndgameValue(alpha: number, beta: number): MinimaxResponse {
        if (this.endgameMinimax.isPlayer1sTurn()) {
            throw new Error("Wrong Player");
        }

        const { capturableComponentSequence, nonCapturableComponents } =
            this.endgameMinimax.computeAllCurrentComponents();
        const gameIsEnding = nonCapturableComponents.length == 0; // There are no remaining non-capturable, which means everything must be capturable, ending the game

        if (gameIsEnding) {
            return {
                value: this.endgameMinimax.evaluate(true),
                bestAction: capturableComponentSequence.map((capturableComponent) =>
                    this.endgameMinimax.getFullCaptureMove(capturableComponent)
                ),
            };
        }

        let v = Infinity;
        let lastAction: Move[] | undefined = undefined;
        const mandatoryMoves: Move[] = [];

        // Capture all the capturable components (except for the last one, we'll handle that specially)
        for (let i = 0; i < capturableComponentSequence.length - 1; i++) {
            const capturableComponent = capturableComponentSequence[i];

            const fullCapture = this.endgameMinimax.getFullCaptureMove(capturableComponent);

            mandatoryMoves.push(fullCapture);
            this.endgameMinimax.execute(fullCapture);
        }

        let shortCircuit = false;
        let lastMoveFullCapture: Move | undefined = undefined;

        const lastMove = capturableComponentSequence[capturableComponentSequence.length - 1];
        if (lastMove != undefined) {
            // For the last one, split between handing out and continuing onwards
            const { intersection, handoutSuffix, fullCaptureSuffix } =
                this.endgameMinimax.splitCapturableComponent(lastMove);

            if (intersection.length > 0) {
                mandatoryMoves.push(intersection);
                this.endgameMinimax.execute(intersection);
            }

            if (handoutSuffix != undefined) {
                // Give a handout
                this.endgameMinimax.execute(handoutSuffix);
                const { value } = this.getValue(alpha, beta, true);
                this.endgameMinimax.revert(handoutSuffix);

                if (lastAction == undefined || value < v) {
                    lastAction = [handoutSuffix];
                    v = value;
                }

                if (v <= alpha) {
                    // Short Circuit
                    shortCircuit = true;
                } else {
                    beta = Math.min(beta, v);
                }
            }

            // Continue onwards with a full capture
            lastMoveFullCapture = fullCaptureSuffix;
        }

        if (!shortCircuit) {
            if (lastMoveFullCapture != undefined) {
                // Do the full capture of the last move
                this.endgameMinimax.execute(lastMoveFullCapture);
            }

            for (const nonCapturableComponent of nonCapturableComponents) {
                const move = this.endgameMinimax.getNonCapturableComponentOpenMove(nonCapturableComponent);

                this.endgameMinimax.execute(move);
                const { value } = this.getValue(alpha, beta, true);
                this.endgameMinimax.revert(move);

                if (lastAction == undefined || value < v) {
                    lastAction = lastMoveFullCapture != undefined ? [lastMoveFullCapture, move] : [move];
                    v = value;
                }

                if (v <= alpha) {
                    // Short Circuit
                    break;
                }
                beta = Math.min(beta, v);
            }

            if (lastMoveFullCapture != undefined) {
                this.endgameMinimax.revert(lastMoveFullCapture);
            }
        }

        // Undo all the mandatory captures
        for (let i = mandatoryMoves.length - 1; i >= 0; i--) {
            this.endgameMinimax.revert(mandatoryMoves[i]);
        }

        const bestAction: Move[] = mandatoryMoves;
        if (lastAction != undefined) {
            bestAction.push(...lastAction);
        }

        return {
            value: v,
            bestAction,
        };
    }

    private maxNormalValue(alpha: number, beta: number): MinimaxResponse {
        let v = -Infinity;
        const allActions = this.endgameMinimax.getNormalActions();

        let bestAction: Move = allActions[0];

        for (let i = 0; i < allActions.length; i++) {
            const action = allActions[i];
            this.endgameMinimax.execute(action);
            const { value } = this.getValue(alpha, beta);
            this.endgameMinimax.revert(action);

            if (bestAction == undefined || value > v || value == Infinity) {
                bestAction = action;
                v = value;
            }

            if (v >= beta) {
                // Short Circuit
                break;
            }
            alpha = Math.max(alpha, v);
        }

        return { value: v, bestAction: [bestAction] };
    }

    private minNormalValue(alpha: number, beta: number): MinimaxResponse {
        let v = Infinity;
        const allActions = this.endgameMinimax.getNormalActions();

        let bestAction: Move = allActions[0];

        for (let i = 0; i < allActions.length; i++) {
            const action = allActions[i];
            this.endgameMinimax.execute(action);
            const { value } = this.getValue(alpha, beta);
            this.endgameMinimax.revert(action);

            if (bestAction == undefined || value < v || value == -Infinity) {
                bestAction = action;
                v = value;
            }

            if (v <= alpha) {
                // Short Circuit
                break;
            }
            beta = Math.min(beta, v);
        }

        return { value: v, bestAction: [bestAction] };
    }

    private maxNormalWithCapturesValue(alpha: number, beta: number): MinimaxResponse {
        if (!this.endgameMinimax.isPlayer1sTurn()) {
            throw new Error("Wrong Player");
        }

        const capturableComponentSequence = this.endgameMinimax.getCapturableMovesFromCapturableVertices();

        let v = -Infinity;
        let lastAction: Move[] | undefined = undefined;
        const mandatoryMoves: Move[] = [];

        // Capture all the capturable components (except for the last one, we'll handle that specially)
        for (let i = 0; i < capturableComponentSequence.length - 1; i++) {
            const capturableComponent = capturableComponentSequence[i];

            const fullCapture = this.endgameMinimax.getFullCaptureMove(capturableComponent);

            mandatoryMoves.push(fullCapture);
            this.endgameMinimax.execute(fullCapture);
        }

        let shortCircuit = false;
        let lastMoveFullCapture: Move | undefined = undefined;

        const lastMove = capturableComponentSequence[capturableComponentSequence.length - 1];
        if (lastMove != undefined) {
            // For the last one, split between handing out and continuing onwards
            const { intersection, handoutSuffix, fullCaptureSuffix } =
                this.endgameMinimax.splitCapturableComponent(lastMove);

            if (intersection.length > 0) {
                mandatoryMoves.push(intersection);
                this.endgameMinimax.execute(intersection);
            }

            if (handoutSuffix != undefined) {
                // Give a handout
                this.endgameMinimax.execute(handoutSuffix);
                const { value } = this.getValue(alpha, beta);
                this.endgameMinimax.revert(handoutSuffix);

                if (lastAction == undefined || value > v) {
                    lastAction = [handoutSuffix];
                    v = value;
                }

                if (v >= beta) {
                    // Short Circuit
                    shortCircuit = true;
                } else {
                    alpha = Math.max(alpha, v);
                }
            }

            // Continue onwards with a full capture
            lastMoveFullCapture = fullCaptureSuffix;
        }

        if (!shortCircuit) {
            if (lastMoveFullCapture != undefined) {
                // Do the full capture of the last move
                this.endgameMinimax.execute(lastMoveFullCapture);
            }

            for (const move of this.endgameMinimax.getNormalActions()) {
                this.endgameMinimax.execute(move);
                const { value } = this.getValue(alpha, beta);
                this.endgameMinimax.revert(move);

                if (lastAction == undefined || value > v) {
                    lastAction = lastMoveFullCapture != undefined ? [lastMoveFullCapture, move] : [move];
                    v = value;
                }

                if (v >= beta) {
                    // Short Circuit
                    break;
                }
                alpha = Math.max(alpha, v);
            }

            if (lastMoveFullCapture != undefined) {
                this.endgameMinimax.revert(lastMoveFullCapture);
            }
        }

        // Undo all the mandatory captures
        for (let i = mandatoryMoves.length - 1; i >= 0; i--) {
            this.endgameMinimax.revert(mandatoryMoves[i]);
        }

        const bestAction: Move[] = mandatoryMoves;
        if (lastAction != undefined) {
            bestAction.push(...lastAction);
        }

        return {
            value: v,
            bestAction,
        };
    }

    private minNormalWithCapturesValue(alpha: number, beta: number): MinimaxResponse {
        if (this.endgameMinimax.isPlayer1sTurn()) {
            throw new Error("Wrong Player");
        }

        const capturableComponentSequence = this.endgameMinimax.getCapturableMovesFromCapturableVertices();

        let v = Infinity;
        let lastAction: Move[] | undefined = undefined;
        const mandatoryMoves: Move[] = [];

        // Capture all the capturable components (except for the last one, we'll handle that specially)
        for (let i = 0; i < capturableComponentSequence.length - 1; i++) {
            const capturableComponent = capturableComponentSequence[i];

            const fullCapture = this.endgameMinimax.getFullCaptureMove(capturableComponent);

            mandatoryMoves.push(fullCapture);
            this.endgameMinimax.execute(fullCapture);
        }

        let shortCircuit = false;
        let lastMoveFullCapture: Move | undefined = undefined;

        const lastMove = capturableComponentSequence[capturableComponentSequence.length - 1];
        if (lastMove != undefined) {
            // For the last one, split between handing out and continuing onwards
            const { intersection, handoutSuffix, fullCaptureSuffix } =
                this.endgameMinimax.splitCapturableComponent(lastMove);

            if (intersection.length > 0) {
                mandatoryMoves.push(intersection);
                this.endgameMinimax.execute(intersection);
            }

            if (handoutSuffix != undefined) {
                // Give a handout
                this.endgameMinimax.execute(handoutSuffix);
                const { value } = this.getValue(alpha, beta);
                this.endgameMinimax.revert(handoutSuffix);

                if (lastAction == undefined || value < v) {
                    lastAction = [handoutSuffix];
                    v = value;
                }

                if (v <= alpha) {
                    // Short Circuit
                    shortCircuit = true;
                } else {
                    beta = Math.min(beta, v);
                }
            }

            // Continue onwards with a full capture
            lastMoveFullCapture = fullCaptureSuffix;
        }

        if (!shortCircuit) {
            if (lastMoveFullCapture != undefined) {
                // Do the full capture of the last move
                this.endgameMinimax.execute(lastMoveFullCapture);
            }

            for (const move of this.endgameMinimax.getNormalActions()) {
                this.endgameMinimax.execute(move);
                const { value } = this.getValue(alpha, beta);
                this.endgameMinimax.revert(move);

                if (lastAction == undefined || value < v) {
                    lastAction = lastMoveFullCapture != undefined ? [lastMoveFullCapture, move] : [move];
                    v = value;
                }

                if (v <= alpha) {
                    // Short Circuit
                    break;
                }
                beta = Math.min(beta, v);
            }

            if (lastMoveFullCapture != undefined) {
                this.endgameMinimax.revert(lastMoveFullCapture);
            }
        }

        // Undo all the mandatory captures
        for (let i = mandatoryMoves.length - 1; i >= 0; i--) {
            this.endgameMinimax.revert(mandatoryMoves[i]);
        }

        const bestAction: Move[] = mandatoryMoves;
        if (lastAction != undefined) {
            bestAction.push(...lastAction);
        }

        return {
            value: v,
            bestAction,
        };
    }
}
