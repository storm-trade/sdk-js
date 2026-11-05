import { unpack } from 'msgpackr/unpack';
import {
  msgpackTickerBatchSchema,
  predictionWsMessageSchema,
  type PredictionWsMessage,
} from './schemas';

const parseMsgpackTickerBatch = (
  data: ArrayBuffer,
  marketIds: readonly string[],
): PredictionWsMessage | null => {
  try {
    const batch = msgpackTickerBatchSchema.safeParse(unpack(new Uint8Array(data)));
    if (!batch.success) return null;
    const [, subscriptionId, sequence, cursor, asOfMs, rows] = batch.data;
    const markets = rows.map(([slot, upAsk, downAsk, upProbability]) => ({
      marketId: marketIds[slot],
      askPriceUsdQ6: [upAsk, downAsk] as [number, number],
      probabilityQ6: [upProbability, 1_000_000 - upProbability] as [number, number],
    }));
    return markets.every(({ marketId }) => marketId !== undefined)
      ? { type: 'marketTickerBatch', v: 2, subscriptionId, cursor, sequence, asOfMs, markets }
      : null;
  } catch {
    return null;
  }
};

export const parsePredictionWsMessage = (
  event: MessageEvent,
  marketIds: readonly string[] = [],
): PredictionWsMessage | null => {
  if (event.data instanceof ArrayBuffer) return parseMsgpackTickerBatch(event.data, marketIds);
  if (typeof event.data !== 'string') return null;
  let json: unknown;
  try {
    json = JSON.parse(event.data);
  } catch {
    return null;
  }
  const message = predictionWsMessageSchema.safeParse(json);
  if (!message.success) return null;
  if (message.data.type !== 'subscriptionReady') return message.data;
  const { encoding, marketIds: slots, ...ready } = message.data;
  if (encoding !== 'msgpack') return ready;
  return slots ? { ...ready, encoding, marketIds: slots } : null;
};
