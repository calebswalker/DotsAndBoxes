import { Player } from "../player";

export interface State<T> {
    evaluate(): number;
    isPlayer1sTurn(): boolean;
    getActions(): T[];
    execute(action: T): void;
    revert(action: T): void;
    getWinner(): Player | undefined;
    isGameOver(): boolean;
}
