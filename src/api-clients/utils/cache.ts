export class CustomCache<V> {
  private readonly map: Map<unknown, V> = new Map()

  public get(...args: string[]) {
    return this.map.get(args.join(':'))
  }

  public getOrThrow(...args: string[]) {
    const v = this.get(args.join(':'))
    if (v === undefined) throw new Error(`Could not find value for ${args} in ${this.map}`)
    return v;
  }

  public set(key: string[] | string, value: V) {
    this.map.set(Array.isArray(key) ? key.join(':') : key, value)
  }
}