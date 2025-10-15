export type LazerMessage = {
  magic: 2593727018;
  r: bigint;
  s: bigint;
  v: number;
  payloadLength: number;
  payload: LazerPayload;
}

export type LazerFeed = {
  numberOfProperties: 2;
  pricePropertyId: 0;
  pricePropertyValue: bigint;
  exponentPropertyId: 4;
  exponentPropertyValue: number;
}

export type LazerPayloadSingle = {
  type: 'single';
  magic: 2479346549;
  timestamp: bigint;
  channelId: number;
  numberOfFeeds: 1;
  indexFeedId: number;
  indexFeed: LazerFeed;
}

export type LazerPayloadDouble = {
  type: 'double';
  magic: 2479346549;
  timestamp: bigint;
  channelId: number;
  numberOfFeeds: 2;
  indexFeedId: number;
  indexFeed: LazerFeed;
  settlementFeedId: number;
  settlementFeed: LazerFeed;
}

export type LazerPayload = LazerPayloadSingle | LazerPayloadDouble;
