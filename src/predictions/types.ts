export type {
  PredictionExecutionQuote,
  PredictionMarketTickerUpdate,
  PredictionWsMessage,
} from './schemas';

export type PredictionCategory = 'crypto' | 'politics' | 'sports' | 'economy' | 'tech' | 'other';

export interface PredictionOutcome {
  outcomeId?: string;
  label: string;
  tokenId: string;
  pricing: {
    bidPriceUsd: number | null;
    askPriceUsd: number | null;
    probabilityQ6: number | null;
  };
}

export interface PredictionMarket {
  provider: string;
  marketId: string;
  status: 'open' | 'closed';
  result: string | null;
  title: string;
  openTime: number;
  closeTime: number;
  resolveAt: number;
  rulesPrimary: string;
  rulesSecondary: string;
  priceToBeat?: number;
  imageUrl: string | null;
  volume: string | null;
  outcomes: [PredictionOutcome, PredictionOutcome];
}

export interface PredictionTimeline {
  marketId: string;
  feedName: string;
  eventSlug: string;
  marketSlug: string;
  opensAt: number;
  tradeClosesAt: number;
  eventEndsAt: number;
  resolutionSource: string;
  requiresStartPrice: boolean;
  startPriceFixed: boolean | null;
  marketAddress: string | null;
  checkedAt: number | null;
  phase:
    | 'scheduled'
    | 'not_deployed'
    | 'awaiting_start'
    | 'trading'
    | 'paused'
    | 'awaiting_resolution'
    | 'claim_available'
    | 'refund_available'
    | 'unavailable';
  result: 'yes' | 'no' | 'void' | null;
}

export interface PredictionProbabilityHistoryPoint {
  observedAtMs: number;
  probabilityQ6: [number, number];
}

export interface PredictionProbabilityHistoryResponse {
  marketId: string;
  intervalMs: number;
  data: PredictionProbabilityHistoryPoint[];
}

export interface PredictionOnchainMarket {
  marketId: string;
  address?: string;
  provider: 'polymarket' | 'kalshi' | 'storm';
  providerMarketId: string;
  marketIndex: string;
  marketEpoch: number;
  tradeCloseAt: number;
  vaultId: string;
  vaultAddress: string;
  collateralMinterAddress: string;
  network: 'testnet' | 'mainnet';
  deploymentStatus: 'pending' | 'active';
}

interface PredictionPositionOutcomeView {
  label: string;
  shares: string;
  costBasis: string;
  averageEntryPriceQ9: string | null;
  markPriceQ9: string | null;
  markValue: string | null;
  unrealizedPnl: string | null;
  maxPayout: string;
}

export interface PredictionOpenOrderView {
  storageHash?: string;
  orderId: number;
  kind: 'market' | 'limit' | 'stop' | 'take-profit';
  action: 'buy' | 'sell';
  outcome: 'yes' | 'no';
  shares: string;
  collateralLimit: string;
  triggerProbability: string;
  deadline: number;
  marketEpoch: number;
}

export interface PredictionPositionView {
  positionAddress: string;
  vaultAddress: string;
  vaultId: string | null;
  marketIndex: string;
  marketId: string | null;
  marketAddress: string | null;
  status: 'open' | 'orders_only' | 'closed';
  marketStatus: 'trading' | 'awaiting_resolution' | 'resolved' | 'unknown';
  result?: PredictionResolutionResult | null;
  title: string | null;
  closeTime: number | null;
  outcomes: { yes: PredictionPositionOutcomeView; no: PredictionPositionOutcomeView };
  orders: PredictionOpenOrderView[];
  costBasis: string;
  markValue: string | null;
  realizedPnl: string;
  unrealizedPnl: string | null;
  totalPnl: string | null;
  cashFlow: string;
  feesPaid: string;
  openedAt: string;
  lastActivityAt: string;
  closedAt: string | null;
}

export interface PredictionPortfolioResponse {
  accountAddress: string;
  collateralDecimals: number;
  valuation: { kind: 'reference_bid'; executable: false };
  summary: {
    activePositions: number;
    openOrders: number;
    costBasis: string;
    markValue: string | null;
    realizedPnl: string;
    unrealizedPnl: string | null;
    totalPnl: string | null;
    feesPaid: string;
  };
  data: PredictionPositionView[];
}

export interface PredictionActivityItem {
  id: string;
  transactionHash: string;
  logicalTime: string;
  occurredAt: string;
  positionAddress: string;
  vaultAddress: string;
  marketIndex: string;
  marketId: string | null;
  traderAddress: string;
  action: 'buy' | 'sell' | 'redeem';
  outcome: 'yes' | 'no' | null;
  shares: string;
  yesShares: string;
  noShares: string;
  grossAmount: string;
  feeAmount: string;
  refundAmount: string;
  realizedPnl: string;
  yesSharesAfter: string;
  noSharesAfter: string;
  costBasisAfter: string;
}

export interface PredictionActivityResponse {
  data: PredictionActivityItem[];
  pagination: { nextCursor: string | null; hasNext: boolean };
}

export type PredictionActivityActionFilter = 'buy' | 'sell' | 'claim';

export interface PublicPredictionActivityQuery {
  marketId?: string;
  trader?: string;
  actions?: PredictionActivityActionFilter[];
  cursor?: string;
  limit?: number;
}

export interface PublicPredictionActivityResponse extends PredictionActivityResponse {
  collateralDecimals: number;
}

export interface PredictionEvent {
  eventId: string;
  isActive: boolean;
  isLive: boolean;
  category: PredictionCategory;
  subcategory: string;
  tags: string[];
  metadata: {
    eventId: string;
    slug: string;
    title: string;
    subtitle: string;
    series: string;
    closeTime: string;
    isLive: boolean;
    imageUrl: string | null;
  };
  volumeUsd: string | null;
  volume24hr: string | null;
  beginAt: string;
  closeCondition: string;
  rulesPdf: string;
  markets?: PredictionMarket[];
}

export interface PredictionEventsResponse {
  data: PredictionEvent[];
  pagination: {
    start: number;
    end: number;
    hasNext: boolean;
    count?: number;
  };
  snapshotCursor: string;
}

export interface PredictionEventsQuery {
  category?: PredictionCategory;
  tags?: string[];
  filter?: 'live';
  start: number;
  end: number;
  includeCount?: boolean;
}

export type PredictionResolutionResult = 'yes' | 'no' | 'void';

export interface PredictionResolutionHistoryItem {
  marketId: string;
  durationMinutes: number;
  closeTime: number;
  result: PredictionResolutionResult;
}

export interface PredictionResolutionHistoryResponse {
  data: PredictionResolutionHistoryItem[];
}

export interface PredictionResolutionHistoryQuery {
  assetId: string;
  durationMinutes: Array<5 | 15>;
  limit: number;
}

export type PredictionQuoteRequest =
  | { action: 'buy'; outcome: 'yes' | 'no'; collateralBudget: string; trader?: string }
  | { action: 'sell'; outcome: 'yes' | 'no'; shares: string; trader: string };
