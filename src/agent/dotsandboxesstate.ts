import { DotsAndBoxesGraph, Move, arrayifyMove } from "../graph/dotsandboxesgraph";
import { GameGraph } from "../graph/gamegraph";
import { UndirectedEdge } from "../graph/undirectedgraph";
import { State } from "./state";

type EvaluationCache = { playerIndependentScore: number; playerDependentScore: number };
export class DotsAndBoxesState extends DotsAndBoxesGraph implements State<Move> {
    private stateEvaluationCache = new Map<bigint, EvaluationCache>();
    private forcedEdgesCache = new Map<bigint, EvaluationCache>();

    private computeCachedEvaluation(cachedValue: EvaluationCache) {
        return cachedValue.playerIndependentScore + cachedValue.playerDependentScore * this.getCurrentPlayer();
    }

    public evaluate(): number {
        if (this.isGameOver()) {
            return (this.getPlayer1Score() - this.getPlayer2Score()) * 1e6;
        }

        // Check the cache
        const currentHash = this.getEdgeHash();
        const cachedEvaluationValue = this.stateEvaluationCache.get(currentHash);
        if (cachedEvaluationValue != undefined) {
            return this.computeCachedEvaluation(cachedEvaluationValue);
        }

        const inferredGraph = new GameGraph(this);
        const forcedEdges = new GameGraph();
        [...forcedEdges.edges()].forEach(({ u, v }) => forcedEdges.removeEdgeIfExists(u, v)); // Empty the graph

        const disconnectCapturableComponents = (verticesToCheck: Set<number>) => {
            const nextRound: Set<number> = new Set(verticesToCheck);
            const visited = new Set<number>();
            const edgesToDelete: UndirectedEdge[] = [];

            for (const vertex of verticesToCheck) {
                const degree = inferredGraph.degree(vertex);

                // Start with any free takeable square
                if (degree == 1 && inferredGraph.isInnerNode(vertex) && !visited.has(vertex)) {
                    // Create the component
                    let parent = vertex;
                    for (const v of inferredGraph.dfs(vertex)) {
                        if (v == vertex) {
                            continue;
                        }

                        edgesToDelete.push({ u: Math.min(parent, v), v: Math.max(parent, v) });
                        parent = v;
                        nextRound.delete(parent); // Won't need to check that next round
                        if (inferredGraph.degree(v) > 2) {
                            // We've reached the end
                            if (inferredGraph.isInnerNode(v)) {
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
                inferredGraph.removeEdgeIfExists(u, v);
                forcedEdges.removeEdgeIfExists(u, v);

                if (inferredGraph.degree(u) == 0 && inferredGraph.isInnerNode(u)) {
                    boxesForcedToBeTaken.push(u);
                }
                if (inferredGraph.degree(v) == 0 && inferredGraph.isInnerNode(v)) {
                    boxesForcedToBeTaken.push(u);
                }
            });

            return { nextRound, boxesForcedToBeTaken };
        };

        const forceAnyTwoEdges = (verticesToCheck: Set<number>) => {
            const nextRound: Set<number> = new Set();

            for (const vertex of verticesToCheck) {
                const degree = inferredGraph.degree(vertex);
                const forcedConnections = forcedEdges.neighbors(vertex);

                if (degree == 2 && forcedConnections.size < 2) {
                    // This is only connected to 2 things, so it's automatically forced to those two
                    for (const neighbor of inferredGraph.neighbors(vertex)) {
                        if (!forcedEdges.hasEdge(neighbor, vertex)) {
                            forcedEdges.addEdge(neighbor, vertex);
                        }

                        if (inferredGraph.isInnerNode(neighbor)) {
                            // We want to check if this cascades
                            nextRound.add(neighbor);
                        }
                    }
                }
            }

            return { nextRound };
        };

        const deleteEdgesIfClearlyForced = (verticesToCheck: Set<number>) => {
            const nextRound: Set<number> = new Set();

            const neighborsRemainingAfterRemoval: Map<number, Set<number>> = new Map(); // A map keeping track of how much a vertex will be left
            const edgesToRemove: UndirectedEdge[] = [];

            for (const vertex of verticesToCheck) {
                const degree = inferredGraph.degree(vertex);
                const forcedConnections = forcedEdges.neighbors(vertex);

                if (degree != 2 && forcedConnections.size >= 2) {
                    // This is a vertex that has been forced, so remove all non-forced edges
                    for (const neighbor of inferredGraph.neighbors(vertex)) {
                        if (!forcedConnections.has(neighbor)) {
                            // This is an edge to be removed
                            edgesToRemove.push({ u: vertex, v: neighbor });

                            // Record that these vertices will lose an edge
                            let vertexNeighborsRemaining = neighborsRemainingAfterRemoval.get(vertex);
                            if (vertexNeighborsRemaining == undefined) {
                                vertexNeighborsRemaining = new Set(inferredGraph.neighbors(vertex));
                                neighborsRemainingAfterRemoval.set(vertex, vertexNeighborsRemaining);
                            }
                            vertexNeighborsRemaining.delete(neighbor);

                            let neighborNeighborsRemaining = neighborsRemainingAfterRemoval.get(neighbor);
                            if (neighborNeighborsRemaining == undefined) {
                                neighborNeighborsRemaining = new Set(inferredGraph.neighbors(neighbor));
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
                    (inferredGraph.isInnerNode(u) && neighborsRemainingForU.size < 2) ||
                    (inferredGraph.isInnerNode(v) && neighborsRemainingForV.size < 2)
                ) {
                    // If we were do delete all target edges to one of the vertices, it'd have a degree less than 2, and that's unacceptable.
                    continue;
                }

                const removedEdge = inferredGraph.removeEdgeIfExists(u, v);
                const removedForcedEdge = forcedEdges.removeEdgeIfExists(u, v);

                if (inferredGraph.isInnerNode(v)) {
                    // We want to check this next round
                    nextRound.add(v);
                }
            }

            return { nextRound };
        };

        const checkForForcedEdges = (verticesToCheck: Set<number>) => {
            let nextRound: Set<number> = verticesToCheck;

            // Label any components that could be taken next turn
            const disconnectedResults = disconnectCapturableComponents(nextRound);
            nextRound = disconnectedResults.nextRound;

            while (nextRound.size != 0) {
                // Check for any vertices with 2 edges that aren't forced
                const forcingResults = forceAnyTwoEdges(nextRound);
                nextRound = forcingResults.nextRound;

                if (nextRound.size == 0) {
                    break;
                }

                // Delete any extraneous edges based on the forcing information
                const deleteInferredEdgesResults = deleteEdgesIfClearlyForced(nextRound);
                nextRound = deleteInferredEdgesResults.nextRound;
            }

            return disconnectedResults.boxesForcedToBeTaken;
        };

        const untakenBoxes = new Set(this.unownedBoxes());
        const numberOfBoxesForcedToBeTaken = checkForForcedEdges(untakenBoxes);

        // Cache check for forced edges
        const forcedEdgesHash = forcedEdges.getEdgeHash();
        const cachedForcedEdgesValue = this.forcedEdgesCache.get(forcedEdgesHash);
        if (cachedForcedEdgesValue != undefined) {
            return this.computeCachedEvaluation(cachedForcedEdgesValue);
        }

        type Component = { nodes: number[]; hasLoop: boolean; joints: number[]; openEndpoints: number[] };
        const computeComponents = (verticesToCheck: Set<number>) => {
            const innerNodesProcessed = new Set();
            const components: Component[] = [];

            let allClosed = true;

            for (const innerNode of verticesToCheck) {
                if (this.getBoxOwner(innerNode) || innerNodesProcessed.has(innerNode)) {
                    // This box is already taken or we've already talked about this one
                    continue;
                }

                if (inferredGraph.degree(innerNode) == 0) {
                    // This will be taken by the current player, so just factor that into their score
                    innerNodesProcessed.add(innerNode);
                    continue;
                }

                const stack: { node: number; parent?: number | undefined }[] = [{ node: innerNode }];
                const visited = new Set();

                const component: number[] = []; // An unordered set of the vertices that make up this component
                const joints: number[] = []; // Joints are nodes that are forced to 3+ neighbors
                const openEndpoints: number[] = []; // These are vertices that are kinda forced, but not really
                let hasLoop = false; // Does this have a loop?

                while (stack.length != 0) {
                    const current = stack.pop();
                    if (current == undefined) {
                        break;
                    }
                    const { node, parent } = current;

                    if (visited.has(node)) {
                        continue;
                    }

                    visited.add(node);
                    // Add this to the component
                    component.push(node);

                    const forcedCount = forcedEdges.degree(node);
                    const numberOfNeighbors = inferredGraph.degree(node);
                    if (numberOfNeighbors > forcedCount) {
                        // This vertex is not completely forced, so it's an open endpoint
                        openEndpoints.push(node);
                        allClosed = false;
                    }
                    if (forcedCount == 0) {
                        // Short-circuit
                        continue;
                    } else if (forcedCount >= 3) {
                        // This is a joint
                        joints.push(node);
                        continue; // ! Is this wise to split at joints?
                    }

                    for (const neighbor of inferredGraph.neighbors(node)) {
                        // Check that the neighbor is forced for the component
                        if (!forcedEdges.hasEdge(node, neighbor)) {
                            continue; // Not forced
                        }
                        if (inferredGraph.isOuterNode(neighbor)) {
                            continue; // ? We don't need to count outer nodes?
                        }
                        if (visited.has(neighbor) && neighbor != parent) {
                            // Loop detection
                            hasLoop = true;
                        }
                        stack.push({ node: neighbor, parent: node });
                    }
                }

                // Mark that we've processed these nodes so they don't need to be processed again
                component.forEach((node) => innerNodesProcessed.add(node));
                components.push({ nodes: component, hasLoop: hasLoop, joints: joints, openEndpoints: openEndpoints }); // Add this component to the master list
            }

            return { components, allClosed };
        };
        const { components, allClosed } = computeComponents(untakenBoxes);

        const numberOfEdgesUntilTheForcedState = this.numberOfEdges() - forcedEdges.numberOfEdges();
        let cacheObject: EvaluationCache;

        const closedFactor = allClosed
            ? numberOfEdgesUntilTheForcedState == 0
                ? 10
                : 5 / numberOfEdgesUntilTheForcedState
            : 1 / (numberOfEdgesUntilTheForcedState + 1);

        let baseValue = 0;
        let numberOfLongChains = 0;
        let numberOfShortOpenChains = 0;
        let numberOfShortClosedChains = 0;
        let numberOfLongLoops = 0;
        let totalBoxes = 0;
        for (const component of components) {
            totalBoxes += component.nodes.length;
            const assuredBoxes = component.nodes.length - component.openEndpoints.length;

            if (!component.hasLoop) {
                if (assuredBoxes >= 3) {
                    numberOfLongChains++;
                } else if (assuredBoxes == 2) {
                    if (component.openEndpoints.length == 0) {
                        // This is a closed 2-chain
                        numberOfShortClosedChains++;
                    } else {
                        // This is an open 2-chain
                        numberOfShortOpenChains++;
                    }
                }
            } else {
                if (assuredBoxes >= 6) {
                    numberOfLongLoops++;
                }
            }

            numberOfLongChains = Math.max(numberOfLongChains - component.joints.length / 3, 0);

            baseValue += assuredBoxes;
        }
        baseValue /= Math.max(totalBoxes, 1);

        const numberOfLongChainsIsOdd = numberOfLongChains % 2 == 1;
        let parityBonus = numberOfLongChainsIsOdd ? 1 : -1; // 1st Player wants an odd number of long chains, 2nd Player wants and even number of long chains
        if (((numberOfShortOpenChains + numberOfLongChains) % 2 == 1) == numberOfLongChainsIsOdd) {
            parityBonus *= 2; // More likely that we'll get the correct parity
        }

        const playerIndependentScore =
            10 * parityBonus * baseValue + (this.getPlayer1Score() - this.getPlayer2Score()) * 1000;
        const playerDependentScore = numberOfBoxesForcedToBeTaken.length * 1000;
        cacheObject = { playerDependentScore, playerIndependentScore };

        // Cache the evaluation
        this.stateEvaluationCache.set(currentHash, cacheObject);
        this.forcedEdgesCache.set(forcedEdgesHash, cacheObject);
        const evaluate = this.computeCachedEvaluation(cacheObject);
        return evaluate;
    }

    public getActions(): Move[] {
        const allLegalMoves = this.getAllLegalMoves();

        // TODO: We might need to treat this differently in an endgame situation

        /**
         * The degree priority:
         *  - Degree 1s should be prioritized as these are probably the last moves of the game (normally all capturing should've been taken by the last move).
         *  - Degree 3s allow us to force stuff in the graph after taking, which is really nice.
         *  - Degree 4s are nothing special.
         *  - Degree 2s open components. Not what we want to generally do.
         */
        const DegreePriority = [0, 1, 4, 2, 3];

        allLegalMoves.sort((move1, move2) => {
            const flattenedMove1 = arrayifyMove(move1);
            const flattenedMove2 = arrayifyMove(move2);

            const lastMove1 = flattenedMove1[flattenedMove1.length - 1];
            const lastMove2 = flattenedMove2[flattenedMove2.length - 1];

            const degrees1: [number, number] = [this.degree(lastMove1.u), this.degree(lastMove1.v)];
            const degrees2: [number, number] = [this.degree(lastMove2.u), this.degree(lastMove2.v)];

            const priority1Low = DegreePriority[Math.min(degrees1[0], degrees1[1])];
            const priority2Low = DegreePriority[Math.min(degrees2[0], degrees2[1])];

            if (priority1Low != priority2Low) {
                // Highest priority (i.e. lowest index in the priorty array) first
                return priority1Low - priority2Low;
            }
            // Same priority, so check the other vertex
            const priority1High = DegreePriority[Math.max(degrees1[0], degrees1[1])];
            const priority2High = DegreePriority[Math.max(degrees2[0], degrees2[1])];

            if (priority1Low != priority2Low) {
                // Highest secondary priority (i.e. lowest index in the priorty array) first
                return priority1High - priority2High;
            }

            // If they're still equal, then... *shrug*
            return 0;
        });

        return allLegalMoves;
    }

    public execute(action: Move): void {
        this.makeMove(action);
    }

    public revert(action: Move): void {
        this.revertMove(action);
    }
}
