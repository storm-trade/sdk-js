import { toNano } from '@ton/ton';

export const Fees = {
  addMargin: { msgValue: toNano('0.35'), forwardValue: toNano('0.305') },
  createOrder: { msgValue: toNano('0.225'), forwardValue: toNano('0.18') },
  removeMargin: { msgValue: toNano('0.35') },
  cancelOrder: { msgValue: toNano('0.3') },
  provideLiquidity: { msgValue: toNano('0.35'), forwardValue: toNano('0.305') },
  withdrawLiquidity: { msgValue: toNano('0.3') },
} as const;
