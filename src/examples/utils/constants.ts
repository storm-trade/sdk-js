import { config } from 'dotenv';

config();

export const ORACLE_URL = process.env.ORACLE_URL!;
export const STORM_API_URL = process.env.STORM_API_URL!;
export const TON_CENTER_TESTNET = process.env.TON_CENTER_TESTNET!;
export const TONCENTER_API_KEY = process.env.TONCENTER_API_KEY!;
export const MNEMONICS = process.env.MNEMONICS!.split(' ');
export const TRADER_ADDRESS = process.env.TRADER_ADDRESS!;
