import { DotsAndBoxesGraph, Move } from "../graph/dotsandboxesgraph";
import { UndirectedEdge } from "../graph/undirectedgraph";
import { Player } from "../player";

function deleteFromArrayOrThrow<T>(array: T[], element: T, error?: string) {
    const index = array.indexOf(element);
    if (index < 0) {
        throw new Error(error ?? "Element is not part of array");
    }
    array.splice(index, 1);
}

interface BaseComponent {
    /**
     * The actual capturable boxes
     *
     * Combined with the vertices, a jointed component should go
     * `headJoint, vertices[0], vertices[1], ..., vertices[n - 1], tailJoint`,
     * where adjacent terms are connected to each other.
     *
     * For a loop, `vertices[0]` and `vertices[n - 1]` are adjacent, closing the loop.
     */
    vertices: number[];
    /**
     * This is a vertex that is NOT a capturable part of this chain, but is essential to form it.
     *
     * If the component is capturable, this is undefined;
     */
    headJoint?: number | undefined;
    /** This is a vertex that is NOT a capturable part of this chain, but is essential to form it */
    tailJoint?: number | undefined;
    isLoop: boolean;
    /** Can you capture this entire component right now? */
    isCapturable: boolean;
}

interface BaseCapturableComponent extends BaseComponent {
    headJoint: undefined; // `vertices[0]` has degree 1, so it cannot have anything before it.
    isCapturable: true;
    isLoop: false;

    /** Whether this component has both endpoints with a degree of 1 (true) or not (false). Only applies to capturable chains. */
    // isClosed: boolean; // ! Redundant: Simply check if there's a tail joint (not closed) or not (closed)
    /** If this does NOT have a tail joint, then it's a "closed" chain, meaning both endpoints have degree 1, instead of just one. */
    tailJoint: number | undefined;
}

interface OpenCapturableComponent extends BaseCapturableComponent {
    tailJoint: number;
}

interface ClosedCapturableComponent extends BaseCapturableComponent {
    tailJoint: undefined;
}

export type CapturableComponent = OpenCapturableComponent | ClosedCapturableComponent;

export function canGiveAHandoutWithThisCapturableComponent(component: CapturableComponent) {
    const numberOfBoxes = component.vertices.length;
    return (
        numberOfBoxes >= 4 || // Both open and closed components are handout-able if they have at least 4 boxes
        (numberOfBoxes >= 2 && component.tailJoint != undefined) // Open components are handout-able if they have at least 2 boxes
    );
}

interface ChainComponent extends BaseComponent {
    isCapturable: false;
    isLoop: false;
    headJoint: number;
}

interface LoopComponent extends BaseComponent {
    isCapturable: false;
    isLoop: true;

    // A loop does not have any virtual vertices
    headJoint: undefined;
    tailJoint: undefined;
}
export type NonCapturableComponent = ChainComponent | LoopComponent;

type Component = CapturableComponent | NonCapturableComponent;

export class EndgameMinimaxState {
    private readonly dotsAndBoxesGraph: DotsAndBoxesGraph;

    constructor(dotsAndBoxesGraph: DotsAndBoxesGraph) {
        // if (!dotsAndBoxesGraph.isEndGame()) {
        //     throw new Error("not an endgame!");
        // }

        this.dotsAndBoxesGraph = new DotsAndBoxesGraph(dotsAndBoxesGraph);
    }

    private classifyVertices() {
        /** Vertices that have a degree of 1 and are not outer nodes */
        const oneVertices = new Set<number>();
        /** Vertices that have a degree of 1 and ARE outer nodes */
        const outerVertices = new Set<number>();
        /** Vertices that have a degree of 2 */
        const twoVertices = new Set<number>();
        /** Vertices that have a degree of 3+ */
        const jointVertices = new Set<number>();

        /** Maps a joint to its virtual neighbors (i.e. neighbors after simulating capturing) */
        const jointNeighbors = new Map<number, Set<number>>();

        // Process all the vertices
        for (const vertex of this.dotsAndBoxesGraph.vertices()) {
            const neighbors = this.dotsAndBoxesGraph.neighbors(vertex);
            const degree = neighbors.size;

            if (degree == 0) {
                // Already captured
                continue;
            }

            if (this.dotsAndBoxesGraph.isOuterNode(vertex)) {
                // This outer vertex is still available (degree should be implied 1)
                outerVertices.add(vertex);
                continue;
            }

            if (degree == 1) {
                oneVertices.add(vertex);
            } else if (degree == 2) {
                twoVertices.add(vertex);
            } else if (degree == 3 || degree == 4) {
                jointVertices.add(vertex);
                jointNeighbors.set(vertex, new Set(neighbors));
            } else {
                // Wut?
                throw new Error(`Impossible degree ${degree} at vertex ${vertex}`);
            }
        }
        return {
            /** Vertices that have a degree of 1 and are not outer nodes */
            oneVertices,
            /** Vertices that have a degree of 1 and ARE outer nodes */
            outerVertices,
            /** Vertices that have a degree of 2 */
            twoVertices,
            /** Vertices that have a degree of 3+ */
            jointVertices,
            /** Maps a joint to its virtual neighbors (i.e. neighbors after simulating capturing) */
            jointNeighbors,
        };
    }

    private computeCapturableComponents(
        /** Vertices that have a degree of 1 and are not outer nodes */
        oneVertices: Set<number>,
        /** Vertices that have a degree of 1 and ARE outer nodes */
        outerVertices: Set<number>,
        /** Vertices that have a degree of 2 */
        twoVertices: Set<number>,
        /** Vertices that have a degree of 3+ */
        jointVertices: Set<number>,
        /** Maps a joint to its virtual neighbors (i.e. neighbors after simulating capturing) */
        jointNeighbors: Map<number, Set<number>>
    ): CapturableComponent[] {
        if (oneVertices.size == 0) {
            return [];
        }

        const capturableComponents: CapturableComponent[] = [];
        const jointToAdjacentCapturableComponent: Map<number, CapturableComponent[]> = new Map();

        const captureTraversal = (
            takeableVertex: number,
            allowLazyInitialization?: boolean | undefined,
            alreadyVisited?: Iterable<number> | undefined
        ) => {
            const componentVertices: number[] = [];
            let componentTailJoint: number | undefined = undefined;

            const stack = [takeableVertex];
            const visited = new Set<number>(alreadyVisited);

            while (stack.length != 0) {
                const current = stack.pop();
                if (current == undefined || visited.has(current)) {
                    continue;
                }

                visited.add(current);

                const maybeJointNeighbors = jointNeighbors.get(current);
                const actualNeighbors = this.dotsAndBoxesGraph.neighbors(current);
                const neighbors = maybeJointNeighbors ?? actualNeighbors;
                for (const n of neighbors) {
                    if (!visited.has(n)) {
                        stack.push(n);
                    }
                }

                let isJoint = jointVertices.has(current);
                if (
                    allowLazyInitialization &&
                    !isJoint &&
                    actualNeighbors.size >= 3 &&
                    maybeJointNeighbors == undefined
                ) {
                    // * Lazy initialization: if the joint wasn't previously initialized, then initialize it here
                    isJoint = true;
                    jointVertices.add(current);
                    jointNeighbors.set(current, new Set(neighbors));
                }

                if (isJoint || this.dotsAndBoxesGraph.isOuterNode(current)) {
                    // We've reached the end (and terminated at a joint or outer node)
                    componentTailJoint = current;
                    // Make sure we don't mark the joint as processed (because there are others)
                    // But do mark it as processed from the outer vertices
                    outerVertices.delete(current);

                    break;
                }

                componentVertices.push(current);

                // If this was in our vertices to check, we already know the outcome
                oneVertices.delete(current); // This can happen if this is a closed chain (i.e. a loop that was just opened)
                twoVertices.delete(current); // This is likely the most common case
            }
            return { componentVertices, componentTailJoint };
        };

        // Get all the immediately capturable components
        for (const takeableVertex of oneVertices) {
            const { componentVertices, componentTailJoint } = captureTraversal(takeableVertex, true);

            // Create the component
            const component: CapturableComponent = {
                vertices: componentVertices,

                isCapturable: true, // Since the endpoint is a degree one, this is immediately capturable
                isLoop: false, // A capturable component cannot be a loop
                headJoint: undefined,

                // Determines if it's closed (undefined) or not (number)
                tailJoint: componentTailJoint,
            };

            if (component.tailJoint != undefined && this.dotsAndBoxesGraph.isInnerNode(component.tailJoint)) {
                // It ends at a joint, which means it might become capturable
                const joint = component.tailJoint;

                let neighboringCapturableComponents = jointToAdjacentCapturableComponent.get(joint);
                if (neighboringCapturableComponents == undefined) {
                    neighboringCapturableComponents = [];
                    jointToAdjacentCapturableComponent.set(joint, neighboringCapturableComponents);
                }
                neighboringCapturableComponents.push(component);
            }

            capturableComponents.push(component);
        }

        if (oneVertices.size != 0) {
            debugger; // This should be empty now
        }

        // Now, we need to resolve all capturable components
        const capturableSort = (a: CapturableComponent, b: CapturableComponent) => {
            // We want small, dependencies, closed to go first, with components that can be handed out to go later
            let compare: number;

            // Handouts should come later (since we want to make sure the last component is one that can be handed out)
            const aCanBeHandedOut = canGiveAHandoutWithThisCapturableComponent(a) ? 1 : 0;
            const bCanBeHandedOut = canGiveAHandoutWithThisCapturableComponent(b) ? 1 : 0;
            compare = aCanBeHandedOut - bCanBeHandedOut;

            if (compare == 0) {
                // Put all the ones that are connected to a joint first (they could either become closed or potentially get longer)
                const aIsAttachedToJoint = a.tailJoint != undefined && jointVertices.has(a.tailJoint) ? -1 : 0;
                const bIsAttachedToJoint = b.tailJoint != undefined && jointVertices.has(b.tailJoint) ? -1 : 0;
                compare = aIsAttachedToJoint - bIsAttachedToJoint;

                if (compare == 0) {
                    // Put all the small ones first (easier to take right out of the gate)
                    const aSize = a.vertices.length;
                    const bSize = b.vertices.length;
                    compare = aSize - bSize;

                    if (compare == 0) {
                        // Put closed components first (closed components have a higher demand to be handed out)
                        const aIsClosed = a.tailJoint == undefined ? -1 : 0;
                        const bIsClosed = b.tailJoint == undefined ? -1 : 0;
                        compare = aIsClosed - bIsClosed;
                    }
                }
            }
            return compare;
        };

        capturableComponents.sort(capturableSort);

        /** The set of all capturable components, organized in an order-specific manner to capture all of them efficiently */
        const capturableComponentSequence: CapturableComponent[] = [];
        while (capturableComponents.length != 0) {
            const capturableComponent = capturableComponents.shift();
            if (capturableComponent == undefined) {
                // Shouldn't happen
                throw Error();
            }

            // Add this as the next component to capture
            capturableComponentSequence.push(capturableComponent);

            const joint = capturableComponent.tailJoint;
            if (joint == undefined || this.dotsAndBoxesGraph.isOuterNode(joint)) {
                // This is a closed capturable component, so once it's captured, there is nothing further to do
                continue;
            }

            const capturedAdjacentBox = capturableComponent.vertices[capturableComponent.vertices.length - 1];
            const adjacentCapturableComponents = jointToAdjacentCapturableComponent.get(joint);
            const virtualNeighbors = jointNeighbors.get(joint);

            if (
                capturedAdjacentBox == undefined ||
                adjacentCapturableComponents == undefined ||
                virtualNeighbors == undefined
            ) {
                // This shouldn't happen
                throw new Error("adjacent stuff isn't valid");
            }

            // Remove this component since we've added it to the list of capture moves
            deleteFromArrayOrThrow(
                adjacentCapturableComponents,
                capturableComponent,
                "Adjacent capturable component is not actually adjacent"
            );

            // Remove it from the neighbor list since it's captured
            virtualNeighbors.delete(capturedAdjacentBox);

            if (virtualNeighbors.size > 2) {
                // Still counts as a joint. Continue.
                continue;
            }

            // It must be a degree of 2 then since we only removed one vertex
            // Thus, this is now not a joint anymore and is theoretically capturable
            jointVertices.delete(joint);

            if (adjacentCapturableComponents.length == 0) {
                // Nothing more to do here, label it as a degree two vertex and move on
                twoVertices.add(joint);
                continue;
            }

            // Two cases:
            // In both cases, the joint gets used up, so we don't need to add it to the 2-vertices
            if (adjacentCapturableComponents.length == 1) {
                // We can extend the one remaining component to capture this joint
                const component1 = adjacentCapturableComponents[0];
                const attachmentPoint = component1.vertices[component1.vertices.length - 1];

                // Go ahead and add the joint
                component1.vertices.push(joint);

                // Next, we must continue down the only remaining neighbor
                let startingNeighbor: number | undefined;
                virtualNeighbors.forEach((virtualNeighbor) => {
                    if (attachmentPoint != virtualNeighbor) {
                        startingNeighbor = virtualNeighbor;
                    }
                });
                if (startingNeighbor == undefined) {
                    // This shouldn't happen
                    throw new Error("undefined starting neighbor");
                }

                // Then, proceed to capture until you can't
                const { componentVertices, componentTailJoint } = captureTraversal(startingNeighbor, false, [joint]);
                component1.vertices.push(...componentVertices);
                component1.tailJoint = componentTailJoint;

                if (componentTailJoint != undefined && this.dotsAndBoxesGraph.isInnerNode(componentTailJoint)) {
                    // Add it to the adjacency list of the new neighbor
                    let neighboringCapturableComponents = jointToAdjacentCapturableComponent.get(componentTailJoint);
                    if (neighboringCapturableComponents == undefined) {
                        neighboringCapturableComponents = [];
                        jointToAdjacentCapturableComponent.set(componentTailJoint, neighboringCapturableComponents);
                    }
                    neighboringCapturableComponents.push(component1);
                }
            } else if (adjacentCapturableComponents.length == 2) {
                // They encapsulate the component
                const component1 = adjacentCapturableComponents[0];
                const component2 = adjacentCapturableComponents[1];

                // Remove the second component as it won't be needed any more
                deleteFromArrayOrThrow(
                    capturableComponents,
                    component2,
                    "adjacent capturable component is not in list"
                );

                // Then fuse them together
                component1.vertices.push(joint);
                component1.vertices.push(...component2.vertices.reverse());
                component1.tailJoint = undefined; // This is now a closed capturable component
            } else {
                // Not possible. The number of adjacent capturable components cannot exceed the joint's degree.
            }

            // We have to re-sort since some components got longer
            capturableComponents.sort(capturableSort);
        }

        return capturableComponentSequence;
    }

    private computeNonCapturableComponents(
        /** Vertices that have a degree of 1 and ARE outer nodes */
        outerVertices: Set<number>,
        /** Vertices that have a degree of 2 */
        twoVertices: Set<number>,
        /** Vertices that have a degree of 3+ */
        jointVertices: Set<number>
    ): NonCapturableComponent[] {
        const nonCapturableComponents: NonCapturableComponent[] = [];

        // Next, go over the chains that link to the edges
        for (const vertex of outerVertices) {
            // Create the component
            const component: ChainComponent = {
                vertices: [],

                isCapturable: false,
                isLoop: false, // If this is linked to the edge, there is no way it can be a loop
                headJoint: vertex,
            };

            for (const v of this.dotsAndBoxesGraph.dfs(vertex)) {
                if (v == vertex) {
                    // We already took care of this (it's the head joint)
                    continue;
                }

                if (jointVertices.has(v) || this.dotsAndBoxesGraph.isOuterNode(v)) {
                    // We've reached the end (and terminated at a joint or outer node)
                    component.tailJoint = v;
                    // Make sure we don't mark the joint as processed (because there are others)
                    // But do mark it as processed from the outer vertices
                    outerVertices.delete(v);

                    break;
                } else {
                    component.vertices.push(v);
                }

                // If this was in our vertices to check, we already know the outcome
                twoVertices.delete(v); // We can really only run into this kind of vertices
            }

            outerVertices.delete(vertex);
            nonCapturableComponents.push(component);
        }

        if (outerVertices.size != 0) {
            debugger; // This should be empty now
        }

        // Next, start from the joints and branch outwards
        for (const joint of jointVertices) {
            for (const neighbor of this.dotsAndBoxesGraph.neighbors(joint)) {
                // Each neighbor can generate its own component
                if (!twoVertices.has(neighbor) && !jointVertices.has(neighbor)) {
                    // We've already processed this
                    continue;
                }

                // Create the component
                const component: ChainComponent = {
                    vertices: [],

                    isCapturable: false,
                    headJoint: joint,
                    isLoop: false,
                };

                const stack: number[] = [neighbor];
                const visited = new Set<number>();
                while (stack.length != 0) {
                    const current = stack.pop();
                    if (current == undefined || visited.has(current)) {
                        continue; // Shouldn't happen, but type safety
                    }
                    visited.add(current);

                    if (jointVertices.has(current)) {
                        // We've reached the end (and terminated at a joint or outer node)
                        // component.isLoop = current == joint; // We've gone in a loop
                        component.tailJoint = current;

                        break;
                    }

                    // Add this to the list of vertices in the component
                    component.vertices.push(current);

                    // If this was in our vertices to check, we already know the outcome
                    twoVertices.delete(current); // We can really only run into this kind of vertices

                    for (const v of this.dotsAndBoxesGraph.neighbors(current)) {
                        if (visited.has(v) || (current == neighbor && v == joint)) {
                            continue;
                        }
                        stack.push(v);
                    }
                }

                nonCapturableComponents.push(component);
            }

            // We need to delete this in case we run into it again (such as two joints that are adjacent)
            jointVertices.delete(joint);
        }

        if (jointVertices.size != 0) {
            debugger; // This should be empty now
        }

        // Finally, whatever remains of the 2-vertices, must constitute loops
        if (twoVertices.size > 0 && (twoVertices.size % 2 != 0 || twoVertices.size < 4)) {
            // Failed parity sanity check
            debugger;
            throw new Error("invalid parity for generating loops");
        }

        for (const vertex of twoVertices) {
            // Create the component
            const component: LoopComponent = {
                vertices: [],

                isCapturable: false,
                isLoop: true, // The only way a sequence of 2 vertices can exist without being connected to a joint, the edge, or a degree 1 is in a loop
                headJoint: undefined,
                tailJoint: undefined,
            };

            for (const v of this.dotsAndBoxesGraph.dfs(vertex)) {
                component.vertices.push(v);
                twoVertices.delete(v);
            }

            nonCapturableComponents.push(component);
        }

        if (twoVertices.size != 0) {
            debugger; // This should be empty now
        }

        nonCapturableComponents.sort((a, b) => a.vertices.length - b.vertices.length); // Sort them so the smallest ones come first
        return nonCapturableComponents;
    }

    /** @deprecated */
    public computeCurrentComponents() {
        /** Vertices that have a degree of 1 and are not outer nodes */
        const oneVertices = new Set<number>();
        /** Vertices that have a degree of 1 and ARE outer nodes */
        const outerVertices = new Set<number>();
        /** Vertices that have a degree of 2 */
        const twoVertices = new Set<number>();
        /** Vertices that have a degree of 3+ */
        const jointVertices = new Set<number>();

        /** Maps a joint to its virtual neighbors (i.e. neighbors after simulating capturing) */
        const jointNeighbors = new Map<number, Set<number>>();

        // Process all the vertices
        for (const vertex of this.dotsAndBoxesGraph.vertices()) {
            const neighbors = this.dotsAndBoxesGraph.neighbors(vertex);
            const degree = neighbors.size;

            if (degree == 0) {
                // Already captured
                continue;
            }

            if (this.dotsAndBoxesGraph.isOuterNode(vertex)) {
                // This outer vertex is still available (degree should be implied 1)
                outerVertices.add(vertex);
                continue;
            }

            if (degree == 1) {
                oneVertices.add(vertex);
            } else if (degree == 2) {
                twoVertices.add(vertex);
            } else if (degree == 3 || degree == 4) {
                jointVertices.add(vertex);
                jointNeighbors.set(vertex, new Set(neighbors));
            } else {
                // Wut?
                throw new Error(`Impossible degree ${degree} at vertex ${vertex}`);
            }
        }

        const capturableComponents: CapturableComponent[] = [];
        const jointToAdjacentCapturableComponent: Map<number, CapturableComponent[]> = new Map();

        const captureTraversal = (takeableVertex: number, alreadyVisited?: Iterable<number> | undefined) => {
            const componentVertices: number[] = [];
            let componentTailJoint: number | undefined = undefined;

            const stack = [takeableVertex];
            const visited = new Set<number>(alreadyVisited);

            while (stack.length != 0) {
                const current = stack.pop();
                if (current == undefined || visited.has(current)) {
                    continue;
                }

                visited.add(current);

                const maybeJointNeighbors = jointNeighbors.get(current);
                const neighbors = maybeJointNeighbors ?? this.dotsAndBoxesGraph.neighbors(current);
                for (const n of neighbors) {
                    if (!visited.has(n)) {
                        stack.push(n);
                    }
                }

                const isJoint = jointVertices.has(current);
                if (isJoint || this.dotsAndBoxesGraph.isOuterNode(current)) {
                    // We've reached the end (and terminated at a joint or outer node)
                    componentTailJoint = current;
                    // Make sure we don't mark the joint as processed (because there are others)
                    // But do mark it as processed from the outer vertices
                    outerVertices.delete(current);

                    if (isJoint && maybeJointNeighbors == undefined) {
                        // * Lazy initialization: if the joint wasn't previously initialized, then initialize it here
                        jointNeighbors.set(current, new Set(neighbors));
                    }

                    break;
                }

                componentVertices.push(current);

                // If this was in our vertices to check, we already know the outcome
                oneVertices.delete(current); // This can happen if this is a closed chain (i.e. a loop that was just opened)
                twoVertices.delete(current); // This is likely the most common case
            }
            return { componentVertices, componentTailJoint };
        };

        // Get all the immediately capturable components
        for (const takeableVertex of oneVertices) {
            const { componentVertices, componentTailJoint } = captureTraversal(takeableVertex);

            // Create the component
            const component: CapturableComponent = {
                vertices: componentVertices,

                isCapturable: true, // Since the endpoint is a degree one, this is immediately capturable
                isLoop: false, // A capturable component cannot be a loop
                headJoint: undefined,

                // Determines if it's closed (undefined) or not (number)
                tailJoint: componentTailJoint,
            };

            if (component.tailJoint != undefined && this.dotsAndBoxesGraph.isInnerNode(component.tailJoint)) {
                // It ends at a joint, which means it might become capturable
                const joint = component.tailJoint;

                let neighboringCapturableComponents = jointToAdjacentCapturableComponent.get(joint);
                if (neighboringCapturableComponents == undefined) {
                    neighboringCapturableComponents = [];
                    jointToAdjacentCapturableComponent.set(joint, neighboringCapturableComponents);
                }
                neighboringCapturableComponents.push(component);
            }

            capturableComponents.push(component);
        }

        if (oneVertices.size != 0) {
            debugger; // This should be empty now
        }

        // Now, we need to resolve all capturable components
        const capturableSort = (a: CapturableComponent, b: CapturableComponent) => {
            // We want small, dependencies, closed to go first, with components that can be handed out to go later
            let compare: number;

            // Handouts should come later (since we want to make sure the last component is one that can be handed out)
            const aCanBeHandedOut = canGiveAHandoutWithThisCapturableComponent(a) ? 1 : 0;
            const bCanBeHandedOut = canGiveAHandoutWithThisCapturableComponent(b) ? 1 : 0;
            compare = aCanBeHandedOut - bCanBeHandedOut;

            if (compare == 0) {
                // Put all the ones that are connected to a joint first (they could either become closed or potentially get longer)
                const aIsAttachedToJoint = a.tailJoint != undefined && jointVertices.has(a.tailJoint) ? -1 : 0;
                const bIsAttachedToJoint = b.tailJoint != undefined && jointVertices.has(b.tailJoint) ? -1 : 0;
                compare = aIsAttachedToJoint - bIsAttachedToJoint;

                if (compare == 0) {
                    // Put all the small ones first (easier to take right out of the gate)
                    const aSize = a.vertices.length;
                    const bSize = b.vertices.length;
                    compare = aSize - bSize;

                    if (compare == 0) {
                        // Put closed components first (closed components have a higher demand to be handed out)
                        const aIsClosed = a.tailJoint == undefined ? -1 : 0;
                        const bIsClosed = b.tailJoint == undefined ? -1 : 0;
                        compare = aIsClosed - bIsClosed;
                    }
                }
            }
            return compare;
        };

        capturableComponents.sort(capturableSort);

        /** The set of all capturable components, organized in an order-specific manner to capture all of them efficiently */
        const capturableComponentSequence: CapturableComponent[] = [];
        while (capturableComponents.length != 0) {
            const capturableComponent = capturableComponents.shift();
            if (capturableComponent == undefined) {
                // Shouldn't happen
                throw Error();
            }

            // Add this as the next component to capture
            capturableComponentSequence.push(capturableComponent);

            const joint = capturableComponent.tailJoint;
            if (joint == undefined || this.dotsAndBoxesGraph.isOuterNode(joint)) {
                // This is a closed capturable component, so once it's captured, there is nothing further to do
                continue;
            }

            const capturedAdjacentBox = capturableComponent.vertices[capturableComponent.vertices.length - 1];
            const adjacentCapturableComponents = jointToAdjacentCapturableComponent.get(joint);
            const virtualNeighbors = jointNeighbors.get(joint);

            if (
                capturedAdjacentBox == undefined ||
                adjacentCapturableComponents == undefined ||
                virtualNeighbors == undefined
            ) {
                // This shouldn't happen
                throw new Error("adjacent stuff isn't valid");
            }

            // Remove this component since we've added it to the list of capture moves
            deleteFromArrayOrThrow(
                adjacentCapturableComponents,
                capturableComponent,
                "Adjacent capturable component is not actually adjacent"
            );

            // Remove it from the neighbor list since it's captured
            virtualNeighbors.delete(capturedAdjacentBox);

            if (virtualNeighbors.size > 2) {
                // Still counts as a joint. Continue.
                continue;
            }

            // It must be a degree of 2 then since we only removed one vertex
            // Thus, this is now not a joint anymore and is theoretically capturable
            jointVertices.delete(joint);

            if (adjacentCapturableComponents.length == 0) {
                // Nothing more to do here, label it as a degree two vertex and move on
                twoVertices.add(joint);
                continue;
            }

            // Two cases:
            // In both cases, the joint gets used up, so we don't need to add it to the 2-vertices
            if (adjacentCapturableComponents.length == 1) {
                // We can extend the one remaining component to capture this joint
                const component1 = adjacentCapturableComponents[0];
                const attachmentPoint = component1.vertices[component1.vertices.length - 1];

                // Go ahead and add the joint
                component1.vertices.push(joint);

                // Next, we must continue down the only remaining neighbor
                let startingNeighbor: number | undefined;
                virtualNeighbors.forEach((virtualNeighbor) => {
                    if (attachmentPoint != virtualNeighbor) {
                        startingNeighbor = virtualNeighbor;
                    }
                });
                if (startingNeighbor == undefined) {
                    // This shouldn't happen
                    throw new Error("undefined starting neighbor");
                }

                // Then, proceed to capture until you can't
                const { componentVertices, componentTailJoint } = captureTraversal(startingNeighbor, [joint]);
                component1.vertices.push(...componentVertices);
                component1.tailJoint = componentTailJoint;

                if (componentTailJoint != undefined && this.dotsAndBoxesGraph.isInnerNode(componentTailJoint)) {
                    // Add it to the adjacency list of the new neighbor
                    let neighboringCapturableComponents = jointToAdjacentCapturableComponent.get(componentTailJoint);
                    if (neighboringCapturableComponents == undefined) {
                        neighboringCapturableComponents = [];
                        jointToAdjacentCapturableComponent.set(componentTailJoint, neighboringCapturableComponents);
                    }
                    neighboringCapturableComponents.push(component1);
                }
            } else if (adjacentCapturableComponents.length == 2) {
                // They encapsulate the component
                const component1 = adjacentCapturableComponents[0];
                const component2 = adjacentCapturableComponents[1];

                // Remove the second component as it won't be needed any more
                deleteFromArrayOrThrow(
                    capturableComponents,
                    component2,
                    "adjacent capturable component is not in list"
                );

                // Then fuse them together
                component1.vertices.push(joint);
                component1.vertices.push(...component2.vertices.reverse());
                component1.tailJoint = undefined; // This is now a closed capturable component
            } else {
                // Not possible. The number of adjacent capturable components cannot exceed the joint's degree.
            }

            // We have to re-sort since some components got longer
            capturableComponents.sort(capturableSort);
        }

        const nonCapturableComponents: NonCapturableComponent[] = [];

        // Next, go over the chains that link to the edges
        for (const vertex of outerVertices) {
            // Create the component
            const component: ChainComponent = {
                vertices: [],

                isCapturable: false,
                isLoop: false, // If this is linked to the edge, there is no way it can be a loop
                headJoint: vertex,
            };

            for (const v of this.dotsAndBoxesGraph.dfs(vertex)) {
                if (v == vertex) {
                    // We already took care of this (it's the head joint)
                    continue;
                }

                if (jointVertices.has(v) || this.dotsAndBoxesGraph.isOuterNode(v)) {
                    // We've reached the end (and terminated at a joint or outer node)
                    component.tailJoint = v;
                    // Make sure we don't mark the joint as processed (because there are others)
                    // But do mark it as processed from the outer vertices
                    outerVertices.delete(v);

                    break;
                } else {
                    component.vertices.push(v);
                }

                // If this was in our vertices to check, we already know the outcome
                twoVertices.delete(v); // We can really only run into this kind of vertices
            }

            outerVertices.delete(vertex);
            nonCapturableComponents.push(component);
        }

        if (outerVertices.size != 0) {
            debugger; // This should be empty now
        }

        // Next, start from the joints and branch outwards
        for (const joint of jointVertices) {
            for (const neighbor of this.dotsAndBoxesGraph.neighbors(joint)) {
                // Each neighbor can generate its own component
                if (!twoVertices.has(neighbor) && !jointVertices.has(neighbor)) {
                    // We've already processed this
                    continue;
                }

                // Create the component
                const component: ChainComponent = {
                    vertices: [],

                    isCapturable: false,
                    headJoint: joint,
                    isLoop: false,
                };

                const stack: number[] = [neighbor];
                const visited = new Set<number>();
                while (stack.length != 0) {
                    const current = stack.pop();
                    if (current == undefined || visited.has(current)) {
                        continue; // Shouldn't happen, but type safety
                    }
                    visited.add(current);

                    if (jointVertices.has(current)) {
                        // We've reached the end (and terminated at a joint or outer node)
                        // component.isLoop = current == joint; // We've gone in a loop
                        component.tailJoint = current;

                        break;
                    }

                    // Add this to the list of vertices in the component
                    component.vertices.push(current);

                    // If this was in our vertices to check, we already know the outcome
                    twoVertices.delete(current); // We can really only run into this kind of vertices

                    for (const v of this.dotsAndBoxesGraph.neighbors(current)) {
                        if (visited.has(v) || (current == neighbor && v == joint)) {
                            continue;
                        }
                        stack.push(v);
                    }
                }

                nonCapturableComponents.push(component);
            }

            // We need to delete this in case we run into it again (such as two joints that are adjacent)
            jointVertices.delete(joint);
        }

        if (jointVertices.size != 0) {
            debugger; // This should be empty now
        }

        // Finally, whatever remains of the 2-vertices, must constitute loops
        if (twoVertices.size > 0 && (twoVertices.size % 2 != 0 || twoVertices.size < 4)) {
            // Failed parity sanity check
            debugger;
            throw new Error("invalid parity for generating loops");
        }

        for (const vertex of twoVertices) {
            // Create the component
            const component: LoopComponent = {
                vertices: [],

                isCapturable: false,
                isLoop: true, // The only way a sequence of 2 vertices can exist without being connected to a joint, the edge, or a degree 1 is in a loop
                headJoint: undefined,
                tailJoint: undefined,
            };

            for (const v of this.dotsAndBoxesGraph.dfs(vertex)) {
                component.vertices.push(v);
                twoVertices.delete(v);
            }

            nonCapturableComponents.push(component);
        }

        if (twoVertices.size != 0) {
            debugger; // This should be empty now
        }

        nonCapturableComponents.sort((a, b) => a.vertices.length - b.vertices.length); // Sort them so the smallest ones come first

        return { nonCapturableComponents, capturableComponentSequence };
    }

    public computeAllCurrentComponents() {
        const { oneVertices, twoVertices, jointVertices, outerVertices, jointNeighbors } = this.classifyVertices();
        const capturableComponentSequence = this.computeCapturableComponents(
            oneVertices,
            outerVertices,
            twoVertices,
            jointVertices,
            jointNeighbors
        );
        const nonCapturableComponents = this.computeNonCapturableComponents(outerVertices, twoVertices, jointVertices);

        return { capturableComponentSequence, nonCapturableComponents };
    }

    public splitCapturableComponent(component: CapturableComponent): {
        /** A list of the moves that are common to both a handout move and a full capture (in other words, these are always executed) */
        intersection: UndirectedEdge[];
        /** To finish a full capture, capture these remaining edges after taking the intersection */
        fullCaptureSuffix: UndirectedEdge[];
        /** If you want to give a handout, take this edge after the intersection */
        handoutSuffix?: UndirectedEdge | undefined;
    } {
        const vertices = component.vertices;
        const numberOfBoxes = vertices.length;

        const intersection: UndirectedEdge[] = [];
        const fullCaptureSuffix: UndirectedEdge[] = [];
        let handoutSuffix: UndirectedEdge | undefined = undefined;

        // Get all the edges that are common to both a handout move and a full capture
        const intersectionCutoff = component.tailJoint != undefined ? numberOfBoxes - 2 : numberOfBoxes - 4;
        for (let i = 0; i < intersectionCutoff; i++) {
            intersection.push(this.dotsAndBoxesGraph.getEdge(vertices[i], vertices[i + 1]));
        }

        // Remaining edges for a full capture
        for (let i = Math.max(intersectionCutoff, 0); i < numberOfBoxes - 1; i++) {
            fullCaptureSuffix.push(this.dotsAndBoxesGraph.getEdge(vertices[i], vertices[i + 1]));
        }
        if (component.tailJoint != undefined) {
            fullCaptureSuffix.push(this.dotsAndBoxesGraph.getEdge(vertices[numberOfBoxes - 1], component.tailJoint));
        }

        if (canGiveAHandoutWithThisCapturableComponent(component)) {
            // These is the handout move
            if (component.tailJoint != undefined) {
                handoutSuffix = this.dotsAndBoxesGraph.getEdge(vertices[numberOfBoxes - 1], component.tailJoint);
            } else {
                handoutSuffix = this.dotsAndBoxesGraph.getEdge(
                    vertices[numberOfBoxes - 3],
                    vertices[numberOfBoxes - 2]
                );
            }
        }

        return { intersection, fullCaptureSuffix, handoutSuffix };
    }

    public getNumberOfBoxesCapturedInFullCapture(component: CapturableComponent): number {
        const numberOfSegments = component.vertices.length;
        return component.tailJoint != undefined ? numberOfSegments : numberOfSegments - 1;
    }

    public getFullCaptureMove(component: CapturableComponent): UndirectedEdge[] {
        const vertices = component.vertices;
        const numberOfBoxes = vertices.length;

        const edges: UndirectedEdge[] = [];

        for (let i = 0; i < numberOfBoxes - 1; i++) {
            edges.push(this.dotsAndBoxesGraph.getEdge(vertices[i], vertices[i + 1]));
        }

        if (component.tailJoint != undefined) {
            edges.push(this.dotsAndBoxesGraph.getEdge(vertices[numberOfBoxes - 1], component.tailJoint));
        }

        return edges;
    }

    public getNonCapturableComponentOpenMove(component: NonCapturableComponent): UndirectedEdge {
        const vertices = component.vertices;
        const numberOfBoxes = vertices.length;

        if (component.isLoop) {
            return this.dotsAndBoxesGraph.getEdge(vertices[0], vertices[1]); // It doesn't matter where you open the loop
        } else {
            if (numberOfBoxes == 0) {
                if (component.tailJoint == undefined) {
                    // This shouldn't happen
                    throw new Error("Component of length 0 with insufficient virtual vertices found");
                }

                return this.dotsAndBoxesGraph.getEdge(component.headJoint, component.tailJoint);
            } else if (numberOfBoxes == 1) {
                return this.dotsAndBoxesGraph.getEdge(component.headJoint, vertices[0]);
            } else if (component.tailJoint != undefined && component.headJoint == component.tailJoint) {
                // Special case where a loop loops back to the same joint
                return this.dotsAndBoxesGraph.getEdge(component.headJoint, vertices[0]);
            } else {
                return this.dotsAndBoxesGraph.getEdge(vertices[0], vertices[1]);
            }
        }
    }

    public evaluate(currentPlayerGetsAllTheRemainingBoxes: boolean = false): number {
        let scoreDifference = this.dotsAndBoxesGraph.getScoreDifference();

        if (currentPlayerGetsAllTheRemainingBoxes) {
            const multiplier = this.dotsAndBoxesGraph.isPlayer1sTurn() ? 1 : -1;
            for (const _ of this.dotsAndBoxesGraph.unownedBoxes()) {
                scoreDifference += multiplier;
            }
        }

        return scoreDifference;
    }

    public isPlayer1sTurn(): boolean {
        return this.dotsAndBoxesGraph.isPlayer1sTurn();
    }

    public getStateHash(alpha: number, beta: number, depth: bigint): bigint {
        let baseState = this.dotsAndBoxesGraph.getFullHash();

        const clampedAlpha = Math.min(Math.max(alpha, -24), 24) + 48;
        const clampedBeta = Math.min(Math.max(beta, -24), 24) + 48;

        return (((((baseState << 6n) | BigInt(clampedAlpha)) << 6n) | BigInt(clampedBeta)) << 8n) | depth;
    }

    public execute(move: Move): void {
        // const currentPlayer = this.dotsAndBoxesGraph.getCurrentPlayer();
        this.dotsAndBoxesGraph.makeMove(move);
        // if (this.dotsAndBoxesGraph.getCurrentPlayer() == currentPlayer) {
        //     // This isn't the last move and yet the player failed to swap
        //     debugger;
        //     throw new Error("Move failed to switch player over");
        // }
    }
    public revert(move: Move): void {
        // const currentPlayer = this.dotsAndBoxesGraph.getCurrentPlayer();
        // const gameIsOver = this.dotsAndBoxesGraph.isGameOver();
        this.dotsAndBoxesGraph.revertMove(move);

        // if (this.dotsAndBoxesGraph.getCurrentPlayer() == currentPlayer && !gameIsOver) {
        //     debugger;
        //     throw new Error("Reversion failed as the current player failed to swap");
        // }
    }
    public getWinner(): Player | undefined {
        return this.dotsAndBoxesGraph.getWinner();
    }
    public isGameOver(): boolean {
        return this.dotsAndBoxesGraph.isGameOver();
    }

    public getNormalActions() {
        const normalActions = this.dotsAndBoxesGraph.getUnclaimedEdgesThatDoNotCreateABox();
        // if (this.dotsAndBoxesGraph.hasEdge(42, 52)) {
        //     normalActions.push({ u: 42, v: 52 });
        // }
        return normalActions;
    }

    public getAllActions() {
        return this.dotsAndBoxesGraph.getUnclaimedEdges();
    }

    public getCapturableMovesFromCapturableVertices() {
        const capturableNodes = this.dotsAndBoxesGraph.getDegreeOneInnerNodes();
        if (capturableNodes.size == 0) {
            return [];
        }

        // We'll use the degree one inner nodes as seeds to determine all the capturable components
        const capturableComponentSequence = this.computeCapturableComponents(
            capturableNodes,
            new Set(),
            new Set(),
            new Set(),
            new Map()
        );

        return capturableComponentSequence;
    }

    public isEndGame() {
        return this.dotsAndBoxesGraph.isEndGame();
    }
}
