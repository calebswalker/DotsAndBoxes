import { EndgameMinimaxState, canGiveAHandoutWithThisCapturableComponent } from "../src/agent/endgameminimaxstate";
import { RNG, selectRandomElement, shuffleArray } from "../src/agent/random";
import { DotsAndBoxesGraph } from "../src/graph/dotsandboxesgraph";
import { UndirectedEdge } from "../src/graph/undirectedgraph";

function move(u: number, v: number): UndirectedEdge {
    return { u: Math.min(u, v), v: Math.max(u, v) };
}

describe("EndgameMinimaxState", () => {
    const baseSetOfMoves: UndirectedEdge[] = [
        move(1, 11),
        move(46, 47),
        move(2, 12),
        move(26, 36),
        move(3, 13),
        move(31, 41),
        move(4, 14),
        move(23, 24),
        move(5, 15),
        move(30, 31),
        move(35, 36),
        move(15, 16),
        move(46, 56),
        move(32, 42),
        move(22, 23),
        move(20, 21),
        move(22, 32),
        move(10, 11),
        move(13, 23),
        move(23, 33),
        move(41, 42),
        move(43, 53),
        move(26, 27),
        move(44, 54),
        move(45, 55),
        move(16, 17),
        move(33, 34),
        move(34, 44),
        move(14, 24),
        move(25, 35),
    ];

    it("should produce the sequence of capture moves when there are joints that are capturable", () => {
        const baseBoard = new DotsAndBoxesGraph();
        baseSetOfMoves.forEach((move) => baseBoard.makeMove(move));
        expect(baseBoard.isEndGame()).toBeTruthy();

        const numberOfTrials = 50;
        // const additionalMoves = [move(11, 12), move(12, 13)];
        const edges = baseBoard.getUnclaimedEdges();
        for (let numberOfMovesToChoose = 1; numberOfMovesToChoose <= 20; numberOfMovesToChoose++) {
            for (let i = 0; i < numberOfTrials; i++) {
                const board = new DotsAndBoxesGraph(baseBoard);
                shuffleArray(edges);
                const randomMoves = edges.slice(0, numberOfMovesToChoose);

                randomMoves.forEach((move) => board.makeMove(move));
                expect(board.isEndGame()).toBeTruthy();

                const endgameMinimax = new EndgameMinimaxState(board);
                const { capturableComponentSequence } = endgameMinimax.computeAllCurrentComponents();

                const handoutPossibility = capturableComponentSequence.map(canGiveAHandoutWithThisCapturableComponent);
                if (handoutPossibility.length > 0) {
                    const lastMove = handoutPossibility[handoutPossibility.length - 1];
                    if (!lastMove) {
                        // If you can't handout the last move, then no other should be possible
                        expect(handoutPossibility).not.toContain(true);
                    }
                }

                for (const capturableComponent of capturableComponentSequence) {
                    const move = endgameMinimax.getFullCaptureMove(capturableComponent);
                    // Every move should not change player
                    const completedBoxesArray = board.makeMove(move);
                    completedBoxesArray.forEach(({ completedBox }) => expect(completedBox).toBeTruthy());
                }

                // Check to make sure that there are no more capturable boxes after the full capture move is done
                for (const v of board.getInnerNodes()) {
                    const degree = board.degree(v);
                    expect(degree).not.toEqual(1);
                }
            }
        }
    });

    function assertIsDefined<T>(value: T | undefined): asserts value is T {
        expect(value).not.toBeNull();
        expect(value).not.toBeUndefined();
    }

    it("should work well for all manner of end games", () => {
        for (let n = 0; n < 100; n++) {
            const board = new DotsAndBoxesGraph();

            while (!board.isEndGame()) {
                const randomMove = selectRandomElement(board.getUnclaimedEdgesThatDoNotCreateABox());
                assertIsDefined(randomMove);
                board.makeMove(randomMove);
            }

            const remainingMoves = board.getUnclaimedEdges();
            shuffleArray(remainingMoves);

            const randomNumberOfRemainingMoves = Math.floor(RNG() * remainingMoves.length);
            for (let i = 0; i < randomNumberOfRemainingMoves; i++) {
                const move = remainingMoves[i];
                board.makeMove(move);
            }

            const endgameMinimax = new EndgameMinimaxState(board);
            const { capturableComponentSequence } = endgameMinimax.computeAllCurrentComponents();

            const handoutPossibility = capturableComponentSequence.map(canGiveAHandoutWithThisCapturableComponent);
            if (handoutPossibility.length > 0) {
                const lastMove = handoutPossibility[handoutPossibility.length - 1];
                if (!lastMove) {
                    // If you can't handout the last move, then no other should be possible
                    expect(handoutPossibility).not.toContain(true);
                }
            }

            for (const capturableComponent of capturableComponentSequence) {
                const move = endgameMinimax.getFullCaptureMove(capturableComponent);
                // Every move should not change player
                const completedBoxesArray = board.makeMove(move);
                completedBoxesArray.forEach((completedBox) => expect(completedBox).toBeTruthy());
            }

            // Check to make sure that there are no more capturable boxes after the full capture move is done
            for (const v of board.getInnerNodes()) {
                const degree = board.degree(v);
                expect(degree).not.toEqual(1);
            }
        }
    });

    it("should have no noncapturable components if the game is one move away", () => {
        const board = new DotsAndBoxesGraph();
        baseSetOfMoves.forEach((move) => board.makeMove(move));
        expect(board.isEndGame()).toBeTruthy();

        const edges = board.getUnclaimedEdges();
        shuffleArray(edges);
        edges.pop(); // Delete one edge so the game is one move away from being over
        edges.forEach((move) => board.makeMove(move));
        expect(board.isGameOver()).toBeFalsy(); // Game is not over yet

        const endgameMinimax = new EndgameMinimaxState(board);
        const { nonCapturableComponents, capturableComponentSequence } = endgameMinimax.computeAllCurrentComponents();

        expect(nonCapturableComponents.length).toBe(0);
        expect(capturableComponentSequence.length).not.toBe(0);
    });

    it("should have no components if the game is over", () => {
        const board = new DotsAndBoxesGraph();
        baseSetOfMoves.forEach((move) => board.makeMove(move));
        expect(board.isEndGame()).toBeTruthy();

        const edges = board.getUnclaimedEdges();
        shuffleArray(edges);
        edges.forEach((move) => board.makeMove(move));
        expect(board.isGameOver()).toBeTruthy();

        const endgameMinimax = new EndgameMinimaxState(board);
        const { nonCapturableComponents, capturableComponentSequence } = endgameMinimax.computeAllCurrentComponents();

        expect(nonCapturableComponents.length).toBe(0);
        expect(capturableComponentSequence.length).toBe(0);
    });

    it("should be able to identify capturable components, even when not in an endgame", () => {
        const moves = [
            move(5, 15),
            move(1, 11),
            move(33, 34),
            move(46, 56),
            move(4, 14),
            move(40, 41),
            move(21, 31),
            move(46, 47),
            move(3, 13),
            move(16, 17),
            move(34, 44),
            move(6, 16),
            move(35, 36),
            move(10, 11),
            move(45, 55),
            move(41, 51),
            move(31, 32),
            move(12, 13),
            move(25, 26),
            move(42, 43),
            move(43, 44),
            move(36, 37),
            move(32, 42),
            move(20, 21),
            move(12, 22),
            move(26, 27),
            move(15, 25),
            move(35, 45),
            move(14, 24),
        ];

        const board = new DotsAndBoxesGraph();
        moves.forEach((move) => board.makeMove(move));
        expect(board.isEndGame()).toBeFalsy();

        const endgameState = new EndgameMinimaxState(board);
        const capturableComponents1 = endgameState.getCapturableMovesFromCapturableVertices();
        expect(capturableComponents1.length).toBe(0);

        // This move opens a component
        endgameState.execute(move(30, 31));
        const capturableComponents2 = endgameState.getCapturableMovesFromCapturableVertices();
        expect(capturableComponents2.length).toBe(1);

        const component = capturableComponents2[0];
        assertIsDefined(component);
        expect(component.vertices).toEqual([31, 41, 42]);
        expect(component.tailJoint).toBe(52);
    });
});
