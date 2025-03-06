export enum VaultOpcodes {
  withdrawLiquidity = 0x595f07bc, // jetton burn
  requestCreateOrder = 0xe0db7753,
  provideLiquidity = 0xc89a3ee4,
}

export enum AmmOpcodes {
  addMargin = 0xb9e810e2,
  removeMargin = 0xecded426,
}

export enum PositionManagerOpcodes {
  createOrder = 0xa39843f4,
  cancelOrder = 0x67134629,
  providePosition = 0x13076670,
}
