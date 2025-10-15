import { createFetchInstance } from '@hastom/fetch';
import { Cell } from '@ton/ton';

export type LastPriceResponse = {
  result_message: {
    price_ref: string;
    signatures_ref: string;
  };
};


export class OracleClient {
  private client: ReturnType<typeof createFetchInstance>;
  private apiVersion: 1 | 2;

  constructor(baseURL: string, apiVersion: 1 | 2) {
    this.client = createFetchInstance({ baseURL });
    this.apiVersion = apiVersion || 2;
  }

  async getPrice(symbol: string) {
    const url = this.apiVersion === 1 ? `feed/${symbol}/last` : `v2/signed/${symbol}`
    const res = await this.client.get(url);
    const jsonResp: LastPriceResponse = await res.json();
    const { price_ref, signatures_ref } = jsonResp.result_message;

    return {
      ...jsonResp,
      result_message: {
        priceRef: Cell.fromBase64(price_ref),
        signaturesRef: Cell.fromBase64(signatures_ref),
      },
    };
  }
}
