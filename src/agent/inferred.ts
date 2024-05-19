import { GameGraph } from "../graph/gamegraph";
import { UndirectedEdge } from "../graph/undirectedgraph";

export class InferredState {
    public readonly inferredGraph: GameGraph;
    public readonly forcedEdges: GameGraph;

    constructor(gameGraph: GameGraph) {
        this.inferredGraph = new GameGraph(gameGraph);
        this.forcedEdges = new GameGraph();
        [...this.forcedEdges.edges()].forEach(({ u, v }) => this.forcedEdges.removeEdgeIfExists(u, v));

        this.checkForForcedEdges(new Set(this.inferredGraph.vertices()));
    }

    private disconnectCapturableComponents(verticesToCheck: Set<number>) {
        const nextRound: Set<number> = new Set(verticesToCheck);
        const visited = new Set<number>();
        const edgesToDelete: UndirectedEdge[] = [];

        for (const vertex of verticesToCheck) {
            const degree = this.inferredGraph.degree(vertex);

            // Start with any free takeable square
            if (degree == 1 && this.inferredGraph.isInnerNode(vertex) && !visited.has(vertex)) {
                // Create the component
                let parent = vertex;
                for (const v of this.inferredGraph.dfs(vertex)) {
                    if (v == vertex) {
                        continue;
                    }

                    edgesToDelete.push({ u: Math.min(parent, v), v: Math.max(parent, v) });
                    parent = v;
                    nextRound.delete(parent); // Won't need to check that next round
                    if (this.inferredGraph.degree(v) > 2) {
                        // We've reached the end
                        if (this.inferredGraph.isInnerNode(v)) {
                            nextRound.add(v);
                        }
                        break;
                    }

                    // this.currentlyCapturableComponents.set(v, ForcedSimulation.componentId);
                    visited.add(v); // If this was in our vertices to check, we already know the outcome
                }
                // ForcedSimulation.componentId++;
            }
        }

        // Delete all the edges. They won't serve us any further purpose.
        const boxesForcedToBeTaken: number[] = [];
        edgesToDelete.forEach(({ u, v }) => {
            this.inferredGraph.removeEdgeIfExists(u, v);
            this.forcedEdges.removeEdgeIfExists(u, v);

            if (this.inferredGraph.degree(u) == 0 && this.inferredGraph.isInnerNode(u)) {
                boxesForcedToBeTaken.push(u);
            }
            if (this.inferredGraph.degree(v) == 0 && this.inferredGraph.isInnerNode(v)) {
                boxesForcedToBeTaken.push(u);
            }
        });

        return { nextRound, boxesForcedToBeTaken };
    }

    private forceAnyTwoEdges(verticesToCheck: Set<number>) {
        const nextRound: Set<number> = new Set();

        for (const vertex of verticesToCheck) {
            const degree = this.inferredGraph.degree(vertex);
            const forcedConnections = this.forcedEdges.neighbors(vertex);

            if (degree == 2 && forcedConnections.size < 2) {
                // This is only connected to 2 things, so it's automatically forced to those two
                for (const neighbor of this.inferredGraph.neighbors(vertex)) {
                    if (!this.forcedEdges.hasEdge(neighbor, vertex)) {
                        this.forcedEdges.addEdge(neighbor, vertex);
                    }

                    if (this.inferredGraph.isInnerNode(neighbor)) {
                        // We want to check if this cascades
                        nextRound.add(neighbor);
                    }
                }
            }
        }

        return { nextRound };
    }

    private deleteEdgesIfClearlyForced(verticesToCheck: Set<number>) {
        const nextRound: Set<number> = new Set();

        const neighborsRemainingAfterRemoval: Map<number, Set<number>> = new Map(); // A map keeping track of how much a vertex will be left
        const edgesToRemove: UndirectedEdge[] = [];

        for (const vertex of verticesToCheck) {
            const degree = this.inferredGraph.degree(vertex);
            const forcedConnections = this.forcedEdges.neighbors(vertex);

            if (degree != 2 && forcedConnections.size >= 2) {
                // This is a vertex that has been forced, so remove all non-forced edges
                for (const neighbor of this.inferredGraph.neighbors(vertex)) {
                    if (!forcedConnections.has(neighbor)) {
                        // This is an edge to be removed
                        edgesToRemove.push({ u: vertex, v: neighbor });

                        // Record that these vertices will lose an edge
                        let vertexNeighborsRemaining = neighborsRemainingAfterRemoval.get(vertex);
                        if (vertexNeighborsRemaining == undefined) {
                            vertexNeighborsRemaining = new Set(this.inferredGraph.neighbors(vertex));
                            neighborsRemainingAfterRemoval.set(vertex, vertexNeighborsRemaining);
                        }
                        vertexNeighborsRemaining.delete(neighbor);

                        let neighborNeighborsRemaining = neighborsRemainingAfterRemoval.get(neighbor);
                        if (neighborNeighborsRemaining == undefined) {
                            neighborNeighborsRemaining = new Set(this.inferredGraph.neighbors(neighbor));
                            neighborsRemainingAfterRemoval.set(neighbor, neighborNeighborsRemaining);
                        }
                        neighborNeighborsRemaining.delete(vertex);
                    }
                }
            }
        }

        for (const { u, v } of edgesToRemove) {
            const neighborsRemainingForU = neighborsRemainingAfterRemoval.get(u);
            const neighborsRemainingForV = neighborsRemainingAfterRemoval.get(v);

            if (neighborsRemainingForU == undefined || neighborsRemainingForV == undefined) {
                throw new Error("Vertex escaped recording");
            }

            if (
                (this.inferredGraph.isInnerNode(u) && neighborsRemainingForU.size < 2) ||
                (this.inferredGraph.isInnerNode(v) && neighborsRemainingForV.size < 2)
            ) {
                // If we were do delete all target edges to one of the vertices, it'd have a degree less than 2, and that's unacceptable.
                continue;
            }

            const removedEdge = this.inferredGraph.removeEdgeIfExists(u, v);
            const removedForcedEdge = this.forcedEdges.removeEdgeIfExists(u, v);

            if (this.inferredGraph.isInnerNode(v)) {
                // We want to check this next round
                nextRound.add(v);
            }
        }

        return { nextRound };
    }

    public checkForForcedEdges(verticesToCheck: Set<number>) {
        let nextRound: Set<number> = verticesToCheck;

        // Label any components that could be taken next turn
        const disconnectedResults = this.disconnectCapturableComponents(nextRound);
        nextRound = disconnectedResults.nextRound;

        while (nextRound.size != 0) {
            // Check for any vertices with 2 edges that aren't forced
            const forcingResults = this.forceAnyTwoEdges(nextRound);
            nextRound = forcingResults.nextRound;

            if (nextRound.size == 0) {
                break;
            }

            // Delete any extraneous edges based on the forcing information
            const deleteInferredEdgesResults = this.deleteEdgesIfClearlyForced(nextRound);
            nextRound = deleteInferredEdgesResults.nextRound;
        }

        return disconnectedResults.boxesForcedToBeTaken;
    }
}
