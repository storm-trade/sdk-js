import { Address, internal, OpenedContract, TonClient, TonClient4, WalletContractV4 } from '@ton/ton';
import { KeyPair, mnemonicToPrivateKey } from '@ton/crypto';
import { TransactionSender } from './transaction/transaction-sender';
import { LiteClient } from 'ton-lite-client';
import { TXParams } from '../../common-packers';

export class SdkManager {
  private walletContract!: OpenedContract<WalletContractV4>;
  private transactionSender: TransactionSender;
  private keyPair!: KeyPair;

  private constructor(
    private readonly walletAddress: Address | string,
    stormApiUrl: string,
  ) {
    this.transactionSender = new TransactionSender(stormApiUrl);
  }

  static async initialize(
    mnemonic: string[],
    tonClient: TonClient | TonClient4 | LiteClient,
    stormApiUrl: string,
  ): Promise<SdkManager> {
    const keyPair = await mnemonicToPrivateKey(mnemonic);
    const walletContract = tonClient.open(
      WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey }),
    );

    const instance = new SdkManager(walletContract.address.toRawString(), stormApiUrl);

    instance.keyPair = keyPair;
    instance.walletContract = walletContract;
    return instance;
  }

  async sendTransactionToSequencer(params: TXParams): Promise<Response> {
    const seqno = await this.walletContract.getSeqno();
    const transfer = this.walletContract.createTransfer({
      seqno,
      messages: [internal(params)],
      secretKey: this.keyPair.secretKey,
    });
    console.log(
      `Sending ${JSON.stringify({
        to: params.to.toRawString(),
        value: params.value.toString(),
        body: params.body.toBoc().toString('hex'),
      })} tx to sequencer`,
    );
    const sequencerResponse = await this.transactionSender.broadcastTransaction(
      transfer,
      this.walletAddress,
    );
    console.log(sequencerResponse);
    return sequencerResponse;
  }

  async sendTransactionToBlockChain(params: TXParams) {
    const seqno = await this.walletContract.getSeqno();
    console.log(
      `Sending ${JSON.stringify({
        to: params.to.toRawString(),
        value: params.value.toString(),
        body: params.body.toBoc().toString('hex'),
      })} external message to wallet contract`,
    );
    return this.walletContract.sendTransfer({
      seqno,
      messages: [internal(params)],
      secretKey: this.keyPair.secretKey,
    });
  }
}
