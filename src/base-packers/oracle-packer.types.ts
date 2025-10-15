import { Cell } from '@ton/ton';
import { Maybe } from '@ton/core/dist/utils/maybe';
import { LazerMessage } from './lazer-packers.types';

export type SimpleOraclePayload = {
  oraclePayloadKind: 'simple';
  priceRef: Cell;
  signaturesRef: Cell;
  lazerMessage?: Maybe<LazerMessage>;
};

export type SettlementOraclePayload = {
  oraclePayloadKind: 'withSettlement';
  priceRef: Cell;
  signaturesRef: Cell;
  settlementPriceRef: Cell;
  settlementSignaturesRef: Cell;
  lazerMessage?: Maybe<LazerMessage>;
};

export type OraclePayload =
  | SimpleOraclePayload
  | SettlementOraclePayload
