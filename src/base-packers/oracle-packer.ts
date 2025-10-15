import { beginCell, Cell } from '@ton/ton';
import { OraclePayload } from './oracle-packer.types';
import { packLazerMessage } from './lazer-packers';

export function packOraclePayload(data: OraclePayload): Cell {
  switch (data.oraclePayloadKind) {
    case 'simple':
      return beginCell()
        .storeUint(0, 8)
        .storeRef(beginCell()
          .storeRef(data.priceRef)
          .storeRef(data.signaturesRef)
          .endCell()
        )
        .storeMaybeRef(data.lazerMessage ? packLazerMessage(data.lazerMessage) : null)
        .endCell();
    case 'withSettlement':
      return beginCell()
        .storeUint(1, 8)
        .storeRef(
          beginCell()
            .storeRef(data.priceRef)
            .storeRef(data.signaturesRef)
            .storeRef(data.settlementPriceRef)
            .storeRef(data.settlementSignaturesRef)
            .endCell()
        )
        .storeMaybeRef(data.lazerMessage ? packLazerMessage(data.lazerMessage) : null)
        .endCell();
    default:
      // @ts-expect-error expect ts error
      throw new Error('Unknown oracle payload kind: ' + data.oraclePayloadKind);
  }
}
