import { mulberry32 } from "../src/agent/random";
import { BinaryDotsAndBoxes } from "../src/graph/binarydotsandboxes";
import { DotsAndBoxesGraph } from "../src/graph/dotsandboxesgraph";
import { edgeToString } from "../src/graph/undirectedgraph";

describe("Binary Tests", () => {
    it("should be equivalent to the normal game", () => {
        for (let i = 0; i < 10; i++) {
            const seed = Math.floor(Math.random() * 1e9);
            // console.log("Seed", seed);
            const rng = mulberry32(seed);

            const blankGraph = new DotsAndBoxesGraph();
            const binaryGame = BinaryDotsAndBoxes.fromDotsAndBoxesGraph(blankGraph);

            while (!blankGraph.isGameOver()) {
                const edgeMoves = blankGraph.getUnclaimedEdges();
                const edgeIndexMoves = binaryGame.getAllLegalMoves();

                // Check the moves are the same
                expect(edgeIndexMoves.length == edgeMoves.length).toBe(true);
                const setOfEdges = new Set<string>(edgeMoves.map((edge) => edgeToString(edge)));
                const setOfEdgesBinaryGraph = new Set<string>();

                for (const correspondingEdge of edgeIndexMoves.map((edgeIndex) =>
                    edgeToString(BinaryDotsAndBoxes.edgeIndexToUndirectedEdge(edgeIndex))
                )) {
                    expect(setOfEdgesBinaryGraph.has(correspondingEdge)).toBe(false);
                    setOfEdgesBinaryGraph.add(correspondingEdge);
                    expect(setOfEdges.has(correspondingEdge)).toBe(true);
                }

                const randomEdge = edgeMoves[Math.floor(rng() * edgeMoves.length)];
                const correspondingEdgeIndex = BinaryDotsAndBoxes.undirectedEdgeToEdgeIndex(randomEdge);

                // Check that this is a move on the binary game too
                expect(edgeIndexMoves.includes(correspondingEdgeIndex)).toBe(true);

                blankGraph.makeMove(randomEdge);
                binaryGame.makeMove(correspondingEdgeIndex);

                expect(blankGraph.isGameOver() == binaryGame.isGameOver()).toBe(true);
                expect(blankGraph.getPlayer1Score() == binaryGame.getPlayer1Score()).toBe(true);
                expect(blankGraph.getPlayer2Score() == binaryGame.getPlayer2Score()).toBe(true);
                expect(blankGraph.getCurrentPlayer() == binaryGame.getCurrentPlayer()).toBe(true);
            }

            expect(blankGraph.getWinner()).toBeDefined();
            expect(binaryGame.getWinner()).toBeDefined();
            expect(binaryGame.getWinner() == blankGraph.getWinner()).toBe(true);
        }
    });
});
