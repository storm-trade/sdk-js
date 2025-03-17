export class Cache<V> {
  private readonly map: Map<unknown, V> = new Map();

  public get(key: string[] | string) {
    return this.map.get(Array.isArray(key) ? key.join(':') : key);
  }

  public getOrThrow(key: string[] | string) {
    const v = this.get(key);
    if (v === undefined) throw new Error(`Could not find value for ${key} in ${this.map}`);
    return v;
  }

  public set(key: string[] | string, value: V) {
    this.map.set(Array.isArray(key) ? key.join(':') : key, value);
  }
}
