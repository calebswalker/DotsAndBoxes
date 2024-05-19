import { EndgameAlphaBetaAgent } from "../agent/endgamealphabeta";
import { SmartRandomAgent, SmartRandomAgentState } from "../agent/smartrandomagent";
import { DotsAndBoxesGraph, Move, reduceAllMoves } from "../graph/dotsandboxesgraph";
import { WorkerMessage, WorkerResponse } from "./workercommon";

console.log("WORKER LIVE");

self.onmessage = (event) => {
    const data = event.data as WorkerMessage;

    const { moves } = data.game;
    const currentPlayer = data.currentPlayer;
    const settings = data.settings;

    let action: Move | undefined;
    let value: number | undefined;

    const dotsAndBoxesGraph = new DotsAndBoxesGraph();
    for (const move of moves) {
        dotsAndBoxesGraph.makeMove(move);
    }

    const safeEdges = dotsAndBoxesGraph.getUnclaimedEdgesThatDoNotCreateABox();
    console.log("Safe Edge Count", safeEdges.length);

    if (safeEdges.length > (settings?.threshold ?? 24)) {
        const agent = new SmartRandomAgent();
        const result = agent.getOptimalAction(new SmartRandomAgentState(dotsAndBoxesGraph));
        action = result.action;
        console.log(`Random Move:`, result);
    } else {
        const endGameAlphaBeta = new EndgameAlphaBetaAgent(dotsAndBoxesGraph);
        const start = performance.now();
        const result = endGameAlphaBeta.getOptimalAction();
        const time = performance.now() - start;
        action = reduceAllMoves(result.bestAction);
        value = result.value;
        console.log(
            `Endgame Move:`,
            action,
            "Value:",
            value,
            "Time (ms):",
            time,
            "Cache Hit Rate:",
            endGameAlphaBeta.getCacheHitRate()
        );
    }

    self.postMessage({ move: action } as WorkerResponse);
};
