import { Player } from "../player";
import { State } from "./state";

type MinimaxResponse<T> = { value: number; bestAction?: T | undefined };

export class AlphaBetaAgent<T> {
    public constructor(private useInfinityForWinners = true, private timeoutAmount = 10 * 1000) {}

    private startTime: number | undefined;
    private hasTimedOut() {
        if (this.timeoutAmount <= 0 || !this.startTime) {
            return false;
        }

        return performance.now() - this.startTime >= this.timeoutAmount;
    }

    public getOptimalAction(state: State<T>, searchDepth?: number | undefined) {
        const alpha = -Infinity;
        const beta = Infinity;

        this.startTime = performance.now();
        const { bestAction, value } = this.getValue(
            state,
            alpha,
            beta,
            searchDepth == undefined ? Infinity : searchDepth
        );

        if (bestAction == undefined) {
            throw new Error("undefined action");
        }

        return { action: bestAction, value: value, timedOut: this.hasTimedOut() };
    }

    protected getValue(state: State<T>, alpha: number, beta: number, depth: number): MinimaxResponse<T> {
        if (state.isGameOver()) {
            // Game is over
            if (this.useInfinityForWinners) {
                const winner = state.getWinner();
                return {
                    value: winner == Player.Player1 ? Infinity : winner == Player.Player2 ? -Infinity : 0,
                    bestAction: undefined,
                };
            } else {
                return {
                    value: state.evaluate(),
                    bestAction: undefined,
                };
            }
        } else if (depth <= 0 || this.hasTimedOut()) {
            // We've reached the depths
            return {
                value: state.evaluate(),
                bestAction: undefined,
            };
        } else if (state.isPlayer1sTurn()) {
            // Maximize for Player 1
            return this.maxValue(state, alpha, beta, depth);
        } else {
            // Minimize for Player 2
            return this.minValue(state, alpha, beta, depth);
        }
    }

    protected maxValue(state: State<T>, alpha: number, beta: number, depth: number): MinimaxResponse<T> {
        let v = -Infinity;
        let bestAction: T | undefined = undefined;

        const allActions = state.getActions();
        for (let i = 0; i < allActions.length; i++) {
            if (this.hasTimedOut()) {
                break;
            }

            const action = allActions[i];
            state.execute(action);
            const { value } = this.getValue(
                state,
                alpha,
                beta,
                state.isPlayer1sTurn() ? depth : depth - 1 // Only decrement the depth if the player has swapped
            );
            state.revert(action);

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

        return { value: v, bestAction: bestAction };
    }

    protected minValue(state: State<T>, alpha: number, beta: number, depth: number): MinimaxResponse<T> {
        let v = Infinity;
        let bestAction: T | undefined = undefined;

        const allActions = state.getActions();
        for (let i = 0; i < allActions.length; i++) {
            if (this.hasTimedOut()) {
                break;
            }

            const action = allActions[i];
            state.execute(action);
            const { value } = this.getValue(
                state,
                alpha,
                beta,
                !state.isPlayer1sTurn() ? depth : depth - 1 // Only decrement the depth if the player has swapped
            );
            state.revert(action);

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

        return { value: v, bestAction: bestAction };
    }
}
