import { Address, beginCell, Cell, external, storeMessage } from '@ton/ton';

export class TransactionSender {
  constructor(private apiEndpoint: string) {
    this.apiEndpoint = apiEndpoint.replace(/\/api\/?$/, '');
  }

  async broadcastTransaction(tx: Cell, walletAddress: Address | string): Promise<Response> {
    const ext = beginCell()
      .store(storeMessage(external({ body: tx, to: walletAddress })))
      .endCell();

    return await fetch(`${this.apiEndpoint}/matcher/tx/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tx: ext.toBoc().toString('hex'), format: 'hex' }),
    });
  }
}
