import { Builder, beginCell, Cell } from "@ton/ton";
import { LazerFeed, LazerMessage } from "./lazer-packers.types";

export function packLazerFeed(feed: LazerFeed): Builder {
  return beginCell()
    .storeUint(feed.numberOfProperties, 8)
    .storeUint(feed.pricePropertyId, 8)
    .storeUint(feed.pricePropertyValue, 64)
    .storeUint(feed.exponentPropertyId, 8)
    .storeInt(feed.exponentPropertyValue, 16);
}

export function packLazerMessage(message: LazerMessage): Cell {
  let builder = beginCell()
    .storeUint(message.magic, 32)
    .storeUint(message.r, 256)
    .storeUint(message.s, 256)
    .storeUint(message.v, 8)
    .storeUint(message.payloadLength, 16)
    .storeUint(message.payload.magic, 32)
    .storeUint(message.payload.timestamp, 64)
    .storeUint(message.payload.channelId, 8)
    .storeUint(message.payload.numberOfFeeds, 8)
    .storeUint(message.payload.indexFeedId, 32)
    .storeBuilder(packLazerFeed(message.payload.indexFeed));

  if (message.payload.type === 'double') {
    builder = builder
      .storeUint(message.payload.settlementFeedId, 32)
      .storeBuilder(packLazerFeed(message.payload.settlementFeed));
  }

  return builder.endCell();
}