export class Cache<V> {
  private readonly map: Map<unknown, V> = new Map();

  private readonly cacheKeySeparator = ':';

  private checkFlatOrMap(key: string[] | string) {
    return Array.isArray(key) ? key.join(this.cacheKeySeparator) : key;
  }

  public get(key: string[] | string) {
    return this.map.get(this.checkFlatOrMap(key));
  }

  public getOrThrow(key: string[] | string) {
    const v = this.get(key);
    if (v === undefined) throw new Error(`Could not find value for ${key} in ${this.map}`);
    return v;
  }

  public set(key: string[] | string, value: V) {
    this.map.set(this.checkFlatOrMap(key), value);
  }
}
