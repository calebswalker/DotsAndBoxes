/** Invariant: u < v */
export interface UndirectedEdge {
    u: number;
    v: number;
}

export function areUndirectedEdgesEqual(edge1: UndirectedEdge | undefined, edge2: UndirectedEdge | undefined) {
    if (edge1 == undefined || edge2 == undefined) {
        return edge1 == edge2;
    }

    return (edge1.u == edge2.u && edge1.v == edge2.v) || (edge1.u == edge2.v && edge1.v == edge2.u);
}

export function edgeToString({ u, v }: UndirectedEdge) {
    return v < u ? `${v} ${u}` : `${u} ${v}`;
}

export function stringToEdge(string: String): UndirectedEdge {
    const parts = string.split(" ");

    const a = Number(parts[0]);
    const b = Number(parts[1]);

    return {
        u: Math.min(a, b),
        v: Math.max(a, b),
    };
}

export class UndirectedGraph {
    private adjacencyLists: Map<number, Set<number>> = new Map();

    private vertexCount = 0;
    private edgeCount = 0;

    constructor(otherGraph?: UndirectedGraph) {
        if (otherGraph) {
            otherGraph.adjacencyLists.forEach((neighbors, vertex) => {
                const set: Set<number> = new Set();
                neighbors.forEach((neighbor) => set.add(neighbor));

                this.adjacencyLists.set(vertex, set);
            });

            this.vertexCount = otherGraph.vertexCount;
            this.edgeCount = otherGraph.edgeCount;
        }
    }

    /**
     * @param {number} v
     */
    public addVertex(v: number): void {
        if (!this.adjacencyLists.has(v)) {
            this.adjacencyLists.set(v, new Set());
            this.vertexCount++;
        }
    }

    /**
     * @param {number} u
     * @param {number} v
     */
    public addEdge(u: number, v: number): void {
        const uSet = this.adjacencyLists.get(u);
        const vSet = this.adjacencyLists.get(v);

        // TODO: Remove the checks if they slow things down
        if (!uSet) {
            throw new Error(`No vertex ${u} exists`);
        } else if (!vSet) {
            throw new Error(`No vertex ${v} exists`);
        } else if (u == v) {
            throw new Error(`Cannot add a self-edge`);
        }

        if (!this.hasEdge(u, v)) {
            uSet.add(v);
            vSet.add(u);
            this.edgeCount++;
        }
    }

    /**
     * Returns the edge between two vertices. Throws if the edge doesn't exist.
     * @param u
     * @param v
     */
    public getEdge(u: number, v: number): UndirectedEdge {
        if (!this.hasEdge(u, v)) {
            throw new Error(`Edge ${u}, ${v} doesn't exist`);
        }

        return { u: Math.min(u, v), v: Math.max(u, v) };
    }

    /**
     * Returns the edge between two vertices. If the edge doesn't exist, returns undefined.
     * @param u
     * @param v
     */
    public getEdgeIfExists(u: number, v: number): UndirectedEdge | undefined {
        if (this.hasEdge(u, v)) {
            return { u: Math.min(u, v), v: Math.max(u, v) };
        }

        return undefined;
    }

    /**
     * @param {number} u
     * @param {number} v
     */
    public hasEdge(u: number, v: number): boolean {
        const uSet = this.adjacencyLists.get(u);
        const vSet = this.adjacencyLists.get(v);

        return uSet != undefined && vSet != undefined && uSet.has(v) && vSet.has(u);
    }

    /**
     * Removes the edge if it exists, else returns `undefined`.
     * @param u
     * @param v
     */
    public removeEdgeIfExists(u: number, v: number): UndirectedEdge | undefined {
        if (this.hasEdge(u, v)) {
            return this.removeEdge(u, v);
        }
        return undefined;
    }

    /**
     * Removes the edge. Will throw if edge doesn't exist.
     * @param {number} u
     * @param {number} v
     */
    public removeEdge(u: number, v: number): UndirectedEdge {
        const uSet = this.adjacencyLists.get(u);
        const vSet = this.adjacencyLists.get(v);

        if (!this.hasEdge(u, v) || !uSet || !vSet) {
            throw new Error(`Edge ${u}-${v} doesn't exist`);
        }

        uSet.delete(v);
        vSet.delete(u);
        this.edgeCount--;

        const removedEdge: UndirectedEdge = u < v ? { u: u, v: v } : { u: v, v: u };
        return removedEdge;
    }

    /**
     * Returns a set of all adjacent vertices to v
     * @param {number} v a vertex in the graph
     */
    public neighbors(v: number): Set<number> {
        const adjacencyList = this.adjacencyLists.get(v);
        if (!adjacencyList) {
            throw new Error(`${v} is not a vertex in the graph`);
        }

        return adjacencyList;
    }

    /**
     * Returns the number of adjacent vertices to v
     * @param {number} v a vertex in the graph
     */
    public degree(v: number): number {
        const neighbors = this.adjacencyLists.get(v);

        if (!neighbors) {
            throw new Error(`${v} is not a vertex in the graph`);
        }

        return neighbors.size;
    }

    public vertices() {
        return this.adjacencyLists.keys();
    }

    public *edges() {
        for (const [u, neighbors] of this.adjacencyLists.entries()) {
            for (const v of neighbors) {
                if (u > v) {
                    continue;
                }
                yield { u: u, v: v } as UndirectedEdge;
            }
        }
    }

    public numberOfEdges() {
        return this.edgeCount;
    }

    public numberOfVertices() {
        return this.vertexCount;
    }

    public *bfs(v: number) {
        const queue = [v];
        const visited = new Set<number>();

        while (queue.length != 0) {
            const current = queue.shift();
            if (current == undefined || visited.has(current)) {
                continue;
            }

            visited.add(current);
            for (const n of this.neighbors(current)) {
                if (!visited.has(n)) {
                    queue.unshift(n);
                }
            }
            yield current;
        }
    }

    public *dfs(v: number) {
        const stack = [v];
        const visited = new Set<number>();

        while (stack.length != 0) {
            const current = stack.pop();
            if (current == undefined || visited.has(current)) {
                continue;
            }

            visited.add(current);
            for (const n of this.neighbors(current)) {
                if (!visited.has(n)) {
                    stack.push(n);
                }
            }
            yield current;
        }
    }
}
