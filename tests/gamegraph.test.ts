import { GameGraph } from "../src/graph/gamegraph";

describe("Game Graph", () => {
    it("should match the respective indexes", () => {
        for (let index = 0; index < GameGraph.EdgeIndex.length; index++) {
            const { u, v } = GameGraph.EdgeIndex[index];
            const computedIndex = GameGraph.getEdgeIndex(u, v);

            expect(computedIndex).toBe(index);
        }
    });
});
