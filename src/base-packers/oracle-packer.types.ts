import { Cell } from '@ton/ton';

export type SimpleOraclePayload = {
  oraclePayloadKind: 'simple';
  priceRef: Cell;
  signaturesRef: Cell;
};
export type SettlementOraclePayload = {
  oraclePayloadKind: 'withSettlement';
  priceRef: Cell;
  signaturesRef: Cell;
  settlementPriceRef: Cell;
  settlementSignaturesRef: Cell;
};

export type OraclePayload =
  | SimpleOraclePayload
  | SettlementOraclePayload
