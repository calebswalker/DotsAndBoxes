import { UndirectedEdge, UndirectedGraph } from "./undirectedgraph";

const rowsOfBoxes = 4;
const columnsOfBoxes = 6;

/**
 * A special Undirected Graph that has inner and outer nodes
 * which generates all the edges of a normal Dots and Boxes game.
 */
export class GameGraph extends UndirectedGraph {
    /** All the nodes that correspond to a "box" */
    protected readonly innerNodes: Set<number> = new Set();
    /** All the phantom nodes that exist to a link a "box" to the outside */
    protected readonly outerNodes: Set<number> = new Set();
    /** All the inner nodes that are currently capturable */
    protected readonly degreeOneInnerNodes: Set<number> = new Set();

    public readonly rowFactor: number = 10;

    constructor(otherGameGraph?: GameGraph) {
        super(otherGameGraph);

        if (otherGameGraph) {
            // We're cloning
            this.innerNodes = new Set(otherGameGraph.innerNodes);
            this.outerNodes = new Set(otherGameGraph.outerNodes);
            this.rowFactor = otherGameGraph.rowFactor;
        } else {
            while (this.rowFactor < Math.max(rowsOfBoxes, columnsOfBoxes)) {
                this.rowFactor *= 10;
            }

            // Add all the main vertices
            for (let row = 1; row <= rowsOfBoxes; row++) {
                for (let col = 1; col <= columnsOfBoxes; col++) {
                    const id = row * this.rowFactor + col;

                    this.innerNodes.add(id);
                    this.addVertex(id);
                }
            }

            // Add the top outer nodes
            for (let col = 1; col <= columnsOfBoxes; col++) {
                const id = 0 * this.rowFactor + col;

                this.outerNodes.add(id);
                this.addVertex(id);
            }

            // Add the bottom outer nodes
            for (let col = 1; col <= columnsOfBoxes; col++) {
                const id = (rowsOfBoxes + 1) * this.rowFactor + col;

                this.outerNodes.add(id);
                this.addVertex(id);
            }

            // Add the left outer nodes
            for (let row = 1; row <= rowsOfBoxes; row++) {
                const id = row * this.rowFactor + 0;

                this.outerNodes.add(id);
                this.addVertex(id);
            }

            // Add the right outer nodes
            for (let row = 1; row <= rowsOfBoxes; row++) {
                const id = row * this.rowFactor + (columnsOfBoxes + 1);

                this.outerNodes.add(id);
                this.addVertex(id);
            }

            // Fill out the edges
            for (const boxId of this.vertices()) {
                if (this.outerNodes.has(boxId)) {
                    continue;
                }

                const baseRow = Math.floor(boxId / this.rowFactor);
                const baseCol = boxId % this.rowFactor;

                const northBox: [number, number] = [baseRow - 1, baseCol];
                const eastBox: [number, number] = [baseRow, baseCol + 1];
                const southBox: [number, number] = [baseRow + 1, baseCol];
                const westBox: [number, number] = [baseRow, baseCol - 1];

                [northBox, eastBox, southBox, westBox].forEach(([row, col]) => {
                    const newBoxId = row * this.rowFactor + col;

                    // Add the edge
                    this.addEdge(boxId, newBoxId);
                });
            }
        }

        this.edgeHash = this.computeHash();
        this.degreeOneInnerNodes = this.computeDegreeOneInnerNodes();
    }

    private computeDegreeOneInnerNodes() {
        const degree1Vertices = new Set<number>();
        for (const v of this.vertices()) {
            if (this.isInnerNode(v) && this.degree(v) == 1) {
                degree1Vertices.add(v);
            }
        }
        return degree1Vertices;
    }

    public getDegreeOneInnerNodes() {
        return new Set(this.degreeOneInnerNodes);
    }

    public getInnerNodes() {
        return [...this.innerNodes];
    }

    public isInnerNode(v: number) {
        return this.innerNodes.has(v);
    }

    public isOuterNode(v: number) {
        return this.outerNodes.has(v);
    }

    private edgeHash: bigint = 0n;

    public computeHash(): bigint {
        let hash: bigint = 0n;
        for (let i = GameGraph.EdgeIndex.length - 1; i >= 0; i--) {
            const { u, v } = GameGraph.EdgeIndex[i];
            hash = hash << 1n;
            hash += this.hasEdge(u, v) ? 1n : 0n;
        }

        return hash;
    }

    public getEdgeHash(): bigint {
        return this.edgeHash;
    }

    private updateDegreeOneSet(v: number) {
        if (this.isOuterNode(v)) {
            return;
        }

        if (this.degree(v) == 1) {
            this.degreeOneInnerNodes.add(v);
        } else {
            this.degreeOneInnerNodes.delete(v);
        }
    }

    public override addEdge(u: number, v: number): void {
        super.addEdge(u, v);

        const edgeIndex = BigInt(GameGraph.getEdgeIndex(u, v));
        const mask: bigint = 1n << edgeIndex;

        this.edgeHash = this.edgeHash | mask;

        this.updateDegreeOneSet(u);
        this.updateDegreeOneSet(v);
    }

    public override removeEdge(u: number, v: number): UndirectedEdge {
        const edgeRemoved = super.removeEdge(u, v);

        const edgeIndex = BigInt(GameGraph.getEdgeIndex(u, v));
        const mask: bigint = 1n << edgeIndex;

        this.edgeHash = this.edgeHash & ~mask;

        this.updateDegreeOneSet(u);
        this.updateDegreeOneSet(v);

        return edgeRemoved;
    }

    public static fromHash(hash: bigint): GameGraph {
        const gameGraph = new GameGraph();

        let index = 0;
        while (hash > 0n) {
            const hasEdge = hash & 1n;
            if (!hasEdge) {
                const edge = GameGraph.EdgeIndex[index];
                gameGraph.removeEdgeIfExists(edge.u, edge.v);
            }

            hash = hash >> 1n;
            index++;
        }
        return gameGraph;
    }

    public static readonly EmptyHash: bigint = 0b1111111111111111111111111111111111111111111111111111111111n;

    public static getEdgeIndex(u: number, v: number): number {
        if (v < u) {
            return GameGraph.getEdgeIndex(v, u);
        }

        const isHorizontal = v - u == 10;

        if (isHorizontal) {
            const row = Math.floor((u - 1) / 10);

            return row * 6 + ((u - 1) % 10);
        } else {
            const row = Math.floor(u / 10) - 1;

            return 30 + 7 * row + (u % 10);
        }
    }

    public static EdgeIndex = [
        // Horizontal Edge
        { u: 1, v: 11 },
        { u: 2, v: 12 },
        { u: 3, v: 13 },
        { u: 4, v: 14 },
        { u: 5, v: 15 },
        { u: 6, v: 16 },

        { u: 11, v: 21 },
        { u: 12, v: 22 },
        { u: 13, v: 23 },
        { u: 14, v: 24 },
        { u: 15, v: 25 },
        { u: 16, v: 26 },

        { u: 21, v: 31 },
        { u: 22, v: 32 },
        { u: 23, v: 33 },
        { u: 24, v: 34 },
        { u: 25, v: 35 },
        { u: 26, v: 36 },

        { u: 31, v: 41 },
        { u: 32, v: 42 },
        { u: 33, v: 43 },
        { u: 34, v: 44 },
        { u: 35, v: 45 },
        { u: 36, v: 46 },

        { u: 41, v: 51 },
        { u: 42, v: 52 },
        { u: 43, v: 53 },
        { u: 44, v: 54 },
        { u: 45, v: 55 },
        { u: 46, v: 56 },
        // Vertical Edges
        { u: 10, v: 11 },
        { u: 11, v: 12 },
        { u: 12, v: 13 },
        { u: 13, v: 14 },
        { u: 14, v: 15 },
        { u: 15, v: 16 },
        { u: 16, v: 17 },

        { u: 20, v: 21 },
        { u: 21, v: 22 },
        { u: 22, v: 23 },
        { u: 23, v: 24 },
        { u: 24, v: 25 },
        { u: 25, v: 26 },
        { u: 26, v: 27 },

        { u: 30, v: 31 },
        { u: 31, v: 32 },
        { u: 32, v: 33 },
        { u: 33, v: 34 },
        { u: 34, v: 35 },
        { u: 35, v: 36 },
        { u: 36, v: 37 },

        { u: 40, v: 41 },
        { u: 41, v: 42 },
        { u: 42, v: 43 },
        { u: 43, v: 44 },
        { u: 44, v: 45 },
        { u: 45, v: 46 },
        { u: 46, v: 47 },
    ];
}
