export interface VersionedMap<K, V> extends ReadonlyMap<K, V> {
  get revision(): number;
}

export class VersionedMapImpl<K, V>
  extends Map<K, V>
  implements ProjectableMap<K, V>
{
  #revision: number = 0;

  projected<X>(
    callbackfn: (value: V, key: K) => X | undefined,
  ): ProjectableMap<K, X> {
    return projectedVersionedMap(this, callbackfn);
  }

  set(key: K, value: V): this {
    this.#revision++;
    return super.set(key, value);
  }

  clear(): void {
    this.#revision++;
    return super.clear();
  }

  delete(key: K): boolean {
    if (super.delete(key)) {
      this.#revision++;
      return true;
    }
    return false;
  }

  get revision(): number {
    return this.#revision;
  }

  /** Bump the revision number at most once for all of the operations that occur. */
  asSingleRevision<T>(op: (self: this) => T): T {
    const startingRevision = this.#revision;
    try {
      return op(this);
    } finally {
      if (this.#revision > startingRevision) {
        this.#revision = startingRevision + 1;
      }
    }
  }
}

export interface ProjectableMap<K, V> extends VersionedMap<K, V> {
  projected<U>(
    callbackfn: (value: V, key: K) => U | undefined,
  ): ProjectableMap<K, U>;
}

export function projectedVersionedMap<K, V, U>(
  baseMap: VersionedMap<K, V>,
  select: (value: V, key: K) => U | undefined,
): ProjectableMap<K, U> {
  return new ProjectedVersionedMap(baseMap, select);
}

class ProjectedVersionedMap<K, V, U> implements ProjectableMap<K, U> {
  #innerMap: VersionedMap<K, V>;

  constructor(
    innerMap: VersionedMap<K, V>,
    readonly select: (value: V, key: K) => U | undefined,
  ) {
    this.#innerMap = innerMap;
  }

  get revision(): number {
    return this.#innerMap.revision;
  }

  projected<X>(
    callbackfn: (value: U, key: K) => X | undefined,
  ): ProjectableMap<K, X> {
    return projectedVersionedMap(this, callbackfn);
  }

  forEach(
    callbackfn: (value: U, key: K, map: VersionedMap<K, U>) => void,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    thisArg?: any,
  ): void {
    this.#innerMap.forEach((value, key) => {
      const selected = this.select(value, key);
      if (selected) {
        callbackfn.bind(thisArg)(selected, key, this);
      }
    }, thisArg);
  }

  get(key: K): U | undefined {
    const val = this.#innerMap.get(key);
    return val && this.select(val, key);
  }

  has(key: K): boolean {
    if (!this.#innerMap.has(key)) return false;
    const val = this.#innerMap.get(key);
    return !!this.select(val!, key);
  }

  get size(): number {
    let count: number = 0;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const _key of this.keys()) {
      count++;
    }
    return count;
  }

  entries(): IterableIterator<[K, U]> {
    return this[Symbol.iterator]();
  }

  *keys(): IterableIterator<K> {
    for (const entry of this) {
      yield entry[0];
    }
  }

  *values(): IterableIterator<U> {
    for (const entry of this) {
      yield entry[1];
    }
  }

  *[Symbol.iterator](): IterableIterator<[K, U]> {
    for (const [key, value] of this.#innerMap) {
      const selected = this.select(value, key);
      if (selected) {
        yield [key, selected];
      }
    }
  }
}
