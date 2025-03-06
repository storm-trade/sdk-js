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

  constructor(baseURL: string) {
    this.client = createFetchInstance({ baseURL });
  }

  async getPrice(symbol: string) {
    const res = await this.client.get(`feed/${symbol}/last`);
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
