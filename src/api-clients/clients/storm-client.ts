import { createFetchInstance, Fetcher } from '@hastom/fetch';
import { ConfigClient } from './config-client';
import { OracleClient } from './oracle-client';

export class StormClient {
  private readonly client: Fetcher;
  public readonly config: ConfigClient;

  constructor(
    baseURL: string,
    public readonly oracleClient: OracleClient,
  ) {
    this.client = createFetchInstance({
      baseURL,
    });
    this.config = new ConfigClient(`${baseURL}/config`);
  }
}
