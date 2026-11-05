import { z } from 'zod';

/** An on-chain amount in atomic units: a non-negative integer of at most 36 digits, as a string, no leading zeros. */
const atomicAmount = z.string().regex(/^(0|[1-9][0-9]{0,35})$/);

const safeInteger = z.number().int().safe();

const sequence = safeInteger.nonnegative();

const predictionOutcome = z.enum(['yes', 'no']);

const Q6_ONE = 1_000_000;

/** The fields of a server quote the client reads; the rest of the response is not part of the contract it relies on. */
export const predictionExecutionQuoteSchema = z.object({
  marketId: z.string(),
  network: z.enum(['testnet', 'mainnet']),
  vault: z.string(),
  marketIndex: z.string(),
  marketEpoch: z.number(),
  action: z.enum(['buy', 'sell']),
  outcome: predictionOutcome,
  trader: z.string().optional(),
  leverage: z.string(),
  expiresAt: safeInteger,
  shares: atomicAmount,
  gross: atomicAmount,
  margin: atomicAmount,
  vaultFinancing: atomicAmount,
  payout: atomicAmount,
  fee: atomicAmount,
  userDebit: atomicAmount,
  userCredit: atomicAmount,
  collateralLimit: atomicAmount,
});

export type PredictionExecutionQuote = z.infer<typeof predictionExecutionQuoteSchema>;

/** Up and Down probabilities in millionths; they add up to one. */
const probabilityQ6Pair = z
  .tuple([safeInteger.nonnegative(), safeInteger.nonnegative()])
  .refine(([up, down]) => up + down === Q6_ONE);

const marketTickerUpdateSchema = z.object({
  marketId: z.string(),
  askPriceUsdQ6: z.tuple([safeInteger, safeInteger]),
  probabilityQ6: probabilityQ6Pair,
});

const subscriptionId = safeInteger;
// every v2 stream message carries the cursor and sequence it resumes from
const v2Stream = { v: z.literal(2), subscriptionId, cursor: z.string(), sequence };

export const predictionWsMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('subscribed'), subscriptionId }),
  z.object({ type: z.literal('unsubscribed'), subscriptionId }),
  z.object({ type: z.literal('subscriptionError'), subscriptionId, error: z.string() }),
  // msgpack tickers name markets by slot, so a msgpack subscription must come with its market ids
  z.object({
    type: z.literal('subscriptionReady'),
    ...v2Stream,
    encoding: z.literal('msgpack').optional(),
    marketIds: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal('marketTickerBatch'),
    ...v2Stream,
    asOfMs: safeInteger,
    markets: z.array(marketTickerUpdateSchema),
  }),
  z.object({
    type: z.literal('catalogChanged'),
    ...v2Stream,
    eventIds: z.array(z.string()),
    reason: z.enum(['rotation', 'status', 'mapping']),
  }),
  z.object({
    type: z.literal('resyncRequired'),
    v: z.literal(2),
    subscriptionId,
    reason: z.string(),
  }),
]);

/** A msgpack ticker batch: [version 1, subscription, sequence, cursor, asOfMs, [slot, Up ask, Down ask, Up probability][]]. */
export const msgpackTickerBatchSchema = z.tuple([
  z.literal(1),
  subscriptionId.nonnegative(),
  sequence,
  z.string(),
  safeInteger,
  z.array(z.tuple([sequence, safeInteger, safeInteger, safeInteger.nonnegative().max(Q6_ONE)])),
]);

export type PredictionMarketTickerUpdate = z.infer<typeof marketTickerUpdateSchema>;
export type PredictionWsMessage = z.infer<typeof predictionWsMessageSchema>;
