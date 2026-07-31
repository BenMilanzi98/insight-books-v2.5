/**
 * Seeded PRNG for property-based style tests (reproducible on failure).
 */

export function createSeededRandom(seed = 1) {
  let s = Number(seed) >>> 0 || 1;
  const next = () => {
    // xorshift32
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };
  return {
    seed: Number(seed),
    next,
    int(min, max) {
      return Math.floor(next() * (max - min + 1)) + min;
    },
    pick(arr) {
      return arr[Math.floor(next() * arr.length)];
    },
  };
}
