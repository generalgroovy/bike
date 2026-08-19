export function hashSeed(input) {
  const text = String(input ?? '');
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class RNG {
  constructor(seed = Date.now()) {
    this.state = hashSeed(seed) || 0x6d2b79f5;
  }

  next() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  float(min = 0, max = 1) {
    return min + (max - min) * this.next();
  }

  int(min, maxInclusive) {
    return Math.floor(this.float(min, maxInclusive + 1));
  }

  chance(probability) {
    return this.next() < probability;
  }

  pick(items) {
    if (!items.length) return undefined;
    return items[Math.floor(this.next() * items.length)];
  }

  shuffle(items) {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
}

export function createSeed() {
  const a = Math.floor(Math.random() * 0xffffff).toString(36);
  const b = Date.now().toString(36).slice(-5);
  return `${a}-${b}`.toUpperCase();
}
