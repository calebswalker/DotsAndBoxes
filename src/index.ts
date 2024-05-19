import { RNG } from "./agent/random";
import { DotsAndBoxesGraph, Move } from "./graph/dotsandboxesgraph";
import { UndirectedEdge } from "./graph/undirectedgraph";
import { Player, PlayerColor } from "./player";
import { WorkerMessage, WorkerResponse } from "./worker/workercommon";

const ai = new Worker("./worker.js");
ai.onmessage = () => {};

const GAME = new DotsAndBoxesGraph();
(window as any).game = GAME;

async function redrawBoard() {
    await changeBorderColor(true);

    await new Promise((resolve) => setTimeout(resolve, 0));
}

async function revealWinner() {
    let p1Count = 0;
    let p2Count = 0;
    for (const [boxId, boxOwner] of GAME.boxesAndOwners()) {
        if (boxOwner != Player.None) {
            const edgeObject = document.getElementById(`S${boxId}`);
            if (edgeObject) {
                edgeObject.textContent = `${boxOwner == Player.Player1 ? ++p1Count : ++p2Count}`;
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        }
    }
}

async function changeBorderColor(resolveInstantly = false) {
    const board = document.getElementById("board");
    if (!board) {
        return;
    }

    const oldColor = board.style.borderColor;
    const newColor =
        GAME.getWinner() != undefined
            ? "#FFFFFF"
            : GAME.getCurrentPlayer() == Player.Player1
            ? PlayerColor.Player1
            : PlayerColor.Player2;

    if (oldColor != newColor) {
        board.style.borderColor = newColor;

        if (!resolveInstantly) {
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }
}

const urlParams = new URLSearchParams(window.location.search);
let HUMAN_PLAYER: Player = Player.Player1;
const tempHuman = parseInt(urlParams.get("human") ?? "1");
if (isNaN(tempHuman) || (tempHuman != 1 && tempHuman != 2 && tempHuman != -2 && tempHuman != -1)) {
    HUMAN_PLAYER = Player.Player1;
} else {
    HUMAN_PLAYER = tempHuman == 1 ? Player.Player1 : Player.Player2;
}

const DEBUG_HUMAN_ONLY = !!urlParams.get("debugHuman");

let randomFillMoves = parseInt(urlParams.get("fill") ?? "0");

function move(u: number, v: number): UndirectedEdge {
    return { u: Math.min(u, v), v: Math.max(u, v) };
}
const gamesToStudy: UndirectedEdge[] = [
    // move(1, 11),
    // move(46, 47),
    // move(2, 12),
    // move(26, 36),
    // move(3, 13),
    // move(31, 41),
    // move(4, 14),
    // move(23, 24),
    // move(5, 15),
    // move(30, 31),
    // move(35, 36),
    // move(15, 16),
    // move(46, 56),
    // move(32, 42),
    // move(22, 23),
    // move(20, 21),
    // move(22, 32),
    // move(10, 11),
    // move(13, 23),
    // move(23, 33),
    // move(41, 42),
    // move(43, 53),
    // move(26, 27),
    // move(44, 54),
    // move(45, 55),
    // move(16, 17),
    // move(33, 34),
    // move(34, 44),
    // move(14, 24),
    // move(25, 35),
    // Different game
    // move(6, 16),
    // move(46, 47),
    // move(1, 11),
    // move(26, 36),
    // move(14, 24),
    // move(32, 33),
    // move(34, 35),
    // move(23, 33),
    // move(12, 22),
    // move(15, 25),
    // move(16, 17),
    // move(31, 41),
    // move(41, 51),
    // move(25, 26),
    // move(46, 56),
    // move(21, 22),
    // move(10, 11),
    // move(12, 13),
    // move(43, 44),
    // move(32, 42),
    // move(45, 55),
    // move(4, 14),
    // move(5, 15),
    // move(24, 34),
    // move(43, 53),
    // move(30, 31),
    // move(3, 13),
    // move(35, 45),
    // move(36, 37),
    // move(42, 52),
    // move(44, 54),
    // move(20, 21),
    // move(26, 27),
    // Different game (human = 2)
    // move(5, 15),
    // move(1, 11),
    // move(33, 34),
    // move(46, 56),
    // move(4, 14),
    // move(40, 41),
    // move(21, 31),
    // move(46, 47),
    // move(3, 13),
    // move(16, 17),
    // move(34, 44),
    // move(6, 16),
    // move(35, 36),
    // move(10, 11),
    // move(45, 55),
    // move(41, 51),
    // move(31, 32),
    // move(12, 13),
    // move(25, 26),
    // move(42, 43),
    // move(43, 44),
    // move(36, 37),
    // move(32, 42),
    // move(20, 21),
    // move(12, 22),
    // move(26, 27),
    // move(15, 25),
    // move(35, 45),
    // move(14, 24),
    // Different game (human = 2)
    // move(5, 15),
    // move(40, 41),
    // move(33, 34),
    // move(16, 17),
    // move(3, 13),
    // move(10, 11),
    // move(22, 23),
    // move(6, 16),
    // move(1, 11),
    // move(46, 56),
    // move(36, 46),
    // move(41, 51),
    // move(35, 45),
    // move(42, 52),
    // move(24, 25),
    // move(44, 45),
    // move(35, 36),
    // move(20, 21),
    // move(14, 24),
    // move(30, 31),
    // move(21, 22),
    // move(42, 43),
    // move(13, 23),
    // move(44, 54),
    // move(33, 43),
    // move(2, 12),
    // move(14, 15),
    // move(26, 27),
    // move(25, 26),
    // move(32, 33), // Making this move will lower the value and handouts will not save it
];
function getNextFillMove() {
    if (randomFillMoves > 0) {
        let randomEdge: UndirectedEdge | undefined = undefined;

        const unclaimedEdges = GAME.getUnclaimedEdgesThatDoNotCreateABox();
        randomEdge = unclaimedEdges[Math.floor(RNG() * unclaimedEdges.length)];
        randomFillMoves--;
        return randomEdge;
    } else if (gamesToStudy.length != 0) {
        return gamesToStudy.splice(0, 1)[0];
    }
    return undefined;
}

async function makeMove(move: Move, delay = 0) {
    const currentPlayer = GAME.getCurrentPlayer();

    if (!Array.isArray(move)) {
        move = [move];
    }

    for (let i = 0; i < move.length; i++) {
        const m = move[i];
        GAME.makeSingleMove(m);

        const takenEdge = `E${m.u}-${m.v}`;
        const edgeObject = document.getElementById(takenEdge);

        if (!edgeObject) {
            debugger;
            throw new Error(`${takenEdge} doesn't exist`);
        }

        edgeObject.classList.add(currentPlayer == Player.Player1 ? "p1" : "p2");

        if (GAME.getBoxOwner(m.u) == currentPlayer) {
            const edgeObject = document.getElementById(`S${m.u}`);
            edgeObject?.classList.add(currentPlayer == Player.Player1 ? "p1" : "p2");
        }
        if (GAME.getBoxOwner(m.v) == currentPlayer) {
            const edgeObject = document.getElementById(`S${m.v}`);
            edgeObject?.classList.add(currentPlayer == Player.Player1 ? "p1" : "p2");
        }

        if (delay > 0 && i < move.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }
}

gameLoop();
async function gameLoop() {
    // await new Promise((resolve) => setTimeout(resolve, 500));
    await redrawBoard();

    while (GAME.getWinner() == undefined) {
        const nextFillMove = getNextFillMove();

        if (GAME.getCurrentPlayer() == HUMAN_PLAYER || nextFillMove != undefined || DEBUG_HUMAN_ONLY) {
            // Make the human player move
            const humanPlayerPromise = new Promise<Move>((resolve) => {
                if (nextFillMove != undefined) {
                    // TODO: Remove?
                    resolve(nextFillMove);
                    return;
                } else {
                    // console.log(
                    //     [...GAME.getUnclaimedEdges()]
                    //         .map(({ u, v }) => {
                    //             return `(${u}, ${v})`;
                    //         })
                    //         .join(", ")
                    // );
                }

                // const agent = new SmartRandomAgent();
                // const newState = new SmartRandomAgentState(GAME);

                // setTimeout(() => resolve(agent.getOptimalAction(newState).action), 1000);

                const clickListeners: Map<string, (ev: MouseEvent) => void> = new Map();

                for (const edgeId of GAME.getUnclaimedEdges()) {
                    const clickListener = (ev: MouseEvent) => {
                        // console.log(`Clicked r${row}c${column}.`);

                        clickListeners.forEach((theListener, theEdgeStringId) => {
                            // Remove each click listener
                            const td = document.getElementById(theEdgeStringId);
                            td?.removeEventListener("click", theListener);
                            td?.classList.remove("clickable");
                        });

                        resolve(edgeId);
                    };

                    const edgeStringId = `E${edgeId.u}-${edgeId.v}`;
                    clickListeners.set(edgeStringId, clickListener);
                    // Valid, playable square
                    const edge = document.getElementById(edgeStringId);

                    if (!edge) {
                        debugger;
                        throw new Error(`Edge ${edgeStringId} element doesn't exist`);
                    }

                    edge.classList.add("clickable");
                    edge.addEventListener("click", clickListener);
                }
            });

            const humanPlayerMove: Move = await humanPlayerPromise;
            if (humanPlayerMove) {
                await makeMove(humanPlayerMove);
            } else {
                debugger;
            }

            if (DEBUG_HUMAN_ONLY) {
                HUMAN_PLAYER = GAME.getCurrentPlayer();
            }
        } else {
            // It's the computer's turn
            const computerPlayerPromise = new Promise<Move>((resolve) => {
                ai.onerror = (error) => {
                    console.error("Unexpected error", error);
                    debugger;
                };

                ai.onmessage = (event) => {
                    const data = event.data as WorkerResponse;
                    resolve(data.move as Move);
                };

                ai.postMessage({
                    game: { moves: GAME.getAllPlayedMoves() },
                    currentPlayer: HUMAN_PLAYER == Player.Player1 ? Player.Player2 : Player.Player1,
                } as WorkerMessage);
            });

            const computerPlayerMove: Move = await computerPlayerPromise;
            if (computerPlayerMove) {
                await makeMove(computerPlayerMove, 1000);
            } else {
                debugger;
            }
        }

        await redrawBoard();
    }

    console.log("GAME OVER!");
    await revealWinner();

    console.log(
        "Move log:",
        GAME.getAllPlayedMoves()
            .map(({ u, v }) => `move(${u}, ${v})`)
            .join(",")
    );

    // Update the board one more time
    // await updateBoardStatus();
}
