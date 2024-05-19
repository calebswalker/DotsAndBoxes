function mulberry32(seed: number) {
    return function () {
        var t = (seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// export const RNG = mulberry32(1536);
export const RNG = Math.random;

export function shuffleArray<T>(array: T[]) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(RNG() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

export function selectRandomElement<T>(array: T[]) {
    if (array.length == 0) {
        return undefined;
    }
    return array[Math.floor(RNG() * array.length)];
}
