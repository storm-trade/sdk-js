import { beginCell, Cell } from '@ton/ton';
import { OraclePayload } from './oracle-packer.types';

export function packOraclePayload(data: OraclePayload): Cell {
  switch (data.oraclePayloadKind) {
    case 'simple':
      return beginCell()
        .storeUint(0, 8)
        .storeRef(data.priceRef)
        .storeRef(data.signaturesRef)
        .endCell();
    case 'withSettlement':
      return beginCell()
        .storeUint(1, 8)
        .storeRef(data.priceRef)
        .storeRef(data.signaturesRef)
        .storeRef(data.settlementPriceRef)
        .storeRef(data.settlementSignaturesRef)
        .endCell();
  }
}
