import { Address, TonClient } from '@ton/ton';
import {
  TonConnectButton,
  TonConnectUIProvider,
  useTonAddress,
  useTonConnectUI,
} from '@tonconnect/ui-react';
import React, { useEffect, useState } from 'react';
import { OracleClient, StormClient } from '@storm-trade/trading-sdk/api-clients';
import { StormTradingSdk, CollateralAssets } from '@storm-trade/trading-sdk/sdk';
import { Direction } from '@storm-trade/trading-sdk/base-packers';
import './App.css';
import { TXParams } from '@storm-trade/trading-sdk/common-packers';

// Get environment variables (already validated in main.tsx)
const STORM_API_URL = import.meta.env.VITE_STORM_API_URL;
const ORACLE_URL = import.meta.env.VITE_ORACLE_URL;
const TON_CENTER_URL = import.meta.env.VITE_TON_CENTER_URL;
const TONCENTER_API_KEY = import.meta.env.VITE_TONCENTER_API_KEY;

console.log('Environment variables loaded:', {
  STORM_API_URL,
  ORACLE_URL,
  TON_CENTER_URL,
  // Don't log API key for security
  HAS_API_KEY: !!TONCENTER_API_KEY
});

// Asset constants
const ASSET_DECIMALS: Record<string, number> = {
  TON: 9, // 10^9 nanoTON = 1 TON
  USDT: 6, // 10^6 micro USDT = 1 USDT
  NOT: 8, // 10^8 nano NOT = 1 NOT
};

// Available assets
const ASSETS = [
  { name: 'TON', label: 'TON' },
  { name: 'USDT', label: 'USDT' },
  { name: 'NOT', label: 'NOT' },
];

function App() {
  // TON Connect state
  const [tonConnectUI] = useTonConnectUI();
  const userAddress = useTonAddress();
  const [isConnected, setIsConnected] = useState(false);

  // SDK state
  const [tradingSdk, setTradingSdk] = useState<StormTradingSdk | null>(null);

  // Form state
  const [selectedAsset, setSelectedAsset] = useState('TON');
  const [amount, setAmount] = useState('');

  // Market Order specific state
  const [leverage, setLeverage] = useState('1');
  const [direction, setDirection] = useState<'long' | 'short'>('long');
  const [baseAsset, setBaseAsset] = useState('XRP');

  // Transaction state
  const [transactionStatus, setTransactionStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Initialize the SDK when the user connects their wallet
  useEffect(() => {
    const checkConnection = async () => {
      const connected = !!tonConnectUI.account;
      setIsConnected(connected);

      if (connected && userAddress && !tradingSdk) {
        initializeSdk(userAddress);
      }
    };

    checkConnection();

    // Event listener for wallet connection changes
    tonConnectUI.onStatusChange(checkConnection);

    return () => {
      // Cleanup
    };
  }, [tonConnectUI, userAddress, tradingSdk]);

  // Initialize the Trading SDK
  const initializeSdk = async (address: string) => {
    try {
      setTransactionStatus('Initializing Trading SDK...');

      const tonClient = new TonClient({
        endpoint: TON_CENTER_URL,
        apiKey: TONCENTER_API_KEY,
      });
      console.log('user address:', address, Address.parse(address).toRawString())
      const sdk = new StormTradingSdk(
        new StormClient(STORM_API_URL, new OracleClient(ORACLE_URL)),
        tonClient,
        Address.parse(address).toRawString()
      );

      await sdk.init();
      setTradingSdk(sdk);
      setTransactionStatus('Trading SDK initialized successfully');
    } catch (error) {
      console.error('Error initializing SDK:', error);
      setTransactionStatus(`Error initializing SDK: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Convert human-readable amount to blockchain amount (with decimals)
  const convertToBlockchainAmount = (amount: string, asset: string): bigint => {
    const decimals = ASSET_DECIMALS[asset] || 9;
    const floatAmount = parseFloat(amount);
    return BigInt(Math.floor(floatAmount * Math.pow(10, decimals)));
  };

  // Format SDK transaction params for TON Connect
  const formatTxParamsForTonConnect = (txParams: TXParams) => {
    return {
      validUntil: Math.floor(Date.now() / 1000) + 300, // 5 minutes
      messages: [
        {
          address: txParams.to.toString(),
          amount: txParams.value.toString(),
          payload: txParams.body ? txParams.body.toBoc().toString('base64') : undefined
        }
      ]
    };
  };

  // Handle liquidity provision
  const handleProvideLiquidity = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isConnected) {
      setTransactionStatus('Please connect your wallet first');
      return;
    }

    if (!tradingSdk) {
      setTransactionStatus('Trading SDK not initialized. Please reconnect your wallet.');
      return;
    }

    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      setTransactionStatus('Please enter a valid amount');
      return;
    }

    setIsLoading(true);
    setTransactionStatus('Preparing transaction...');

    try {
      const blockchainAmount = convertToBlockchainAmount(amount, selectedAsset);

      // Create transaction parameters using the Trading SDK
      const txParams = await tradingSdk.provideLiquidity({
        assetName: selectedAsset as CollateralAssets,
        amount: blockchainAmount,
      });
      const transaction = formatTxParamsForTonConnect(txParams);
      setTransactionStatus('Transaction prepared. Sending to wallet for approval...');
      const result = await tonConnectUI.sendTransaction(transaction);

      setTransactionStatus(`Transaction sent successfully!\nTransaction ID: ${result.boc}`);

      // Log for debugging
      console.log('Transaction result:', result);
    } catch (error) {
      console.error('Error sending transaction:', error);
      setTransactionStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle market open order
  const handleMarketOpenOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isConnected) {
      setTransactionStatus('Please connect your wallet first');
      return;
    }

    if (!tradingSdk) {
      setTransactionStatus('Trading SDK not initialized. Please reconnect your wallet.');
      return;
    }

    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      setTransactionStatus('Please enter a valid amount');
      return;
    }

    if (!leverage || isNaN(parseFloat(leverage)) || parseFloat(leverage) <= 0) {
      setTransactionStatus('Please enter a valid leverage');
      return;
    }

    setIsLoading(true);
    setTransactionStatus('Preparing transaction...');

    try {
      const blockchainAmount = convertToBlockchainAmount(amount, selectedAsset);
      // Convert leverage to bigint with 9 decimals (as per SDK requirements)
      const leverageBigInt = BigInt(Math.floor(parseFloat(leverage) * 1_000_000_000));
      const marketOpenOrderParams = {
        baseAssetName: baseAsset,
        collateralAssetName: selectedAsset as CollateralAssets,
        direction: direction === 'long' ? Direction.long : Direction.short,
        amount: blockchainAmount,
        leverage: leverageBigInt,
      }
      await tradingSdk.prefetchCreateMarketOpenOrderCaches(marketOpenOrderParams);
      // Create transaction parameters using the Trading SDK
      const txParams = tradingSdk.syncCreateMarketOpenOrderParams(marketOpenOrderParams);;
      const transaction = formatTxParamsForTonConnect(txParams);
      setTransactionStatus('Transaction prepared. Sending to wallet for approval...');
      const result = await tonConnectUI.sendTransaction(transaction);

      setTransactionStatus(`Transaction sent successfully!\nTransaction ID: ${result.boc}`);

      // Log for debugging
      console.log('Transaction result:', result);
    } catch (error) {
      console.error('Error sending transaction:', error);
      setTransactionStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Trading SDK with TON-Connect</h1>
        <div className="wallet-connection">
          <TonConnectButton />
        </div>
      </header>

      <main className="app-main">
        <div className="card">
          <h2>Provide Liquidity</h2>

          <form onSubmit={handleProvideLiquidity} className="form">
            <div className="form-group">
              <label htmlFor="asset-select">Asset:</label>
              <select
                id="asset-select"
                value={selectedAsset}
                onChange={e => setSelectedAsset(e.target.value)}
                className="select-input"
                disabled={!isConnected || isLoading}
              >
                {ASSETS.map(asset => (
                  <option key={asset.name} value={asset.name}>
                    {asset.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="amount-input">Amount:</label>
              <input
                id="amount-input"
                type="number"
                step="0.000001"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="text-input"
                disabled={!isConnected || isLoading}
              />
            </div>

            <button
              type="submit"
              className="submit-button"
              disabled={!isConnected || isLoading || !amount || !tradingSdk}
            >
              {isLoading ? 'Processing...' : 'Provide Liquidity'}
            </button>
          </form>

          <div className="transaction-status">
            <h3>Transaction Status:</h3>
            <pre>{transactionStatus || 'No transaction sent yet'}</pre>
          </div>
        </div>
        
        {/* New Market Open Order Card */}
        <div className="card">
          <h2>Market Open Order</h2>

          <form onSubmit={handleMarketOpenOrder} className="form">
            <div className="form-group">
              <label htmlFor="base-asset-select">Base Asset:</label>
              <select
                id="base-asset-select"
                value={baseAsset}
                onChange={e => setBaseAsset(e.target.value)}
                className="select-input"
                disabled={!isConnected || isLoading}
              >
                <option value="XRP">XRP</option>
                <option value="BTC">BTC</option>
                <option value="ETH">ETH</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="collateral-asset-select">Collateral Asset:</label>
              <select
                id="collateral-asset-select"
                value={selectedAsset}
                onChange={e => setSelectedAsset(e.target.value)}
                className="select-input"
                disabled={!isConnected || isLoading}
              >
                {ASSETS.map(asset => (
                  <option key={asset.name} value={asset.name}>
                    {asset.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="direction-select">Direction:</label>
              <select
                id="direction-select"
                value={direction}
                onChange={e => setDirection(e.target.value as 'long' | 'short')}
                className="select-input"
                disabled={!isConnected || isLoading}
              >
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="amount-input-market">Amount:</label>
              <input
                id="amount-input-market"
                type="number"
                step="0.000001"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="text-input"
                disabled={!isConnected || isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="leverage-input">Leverage:</label>
              <div className="slider-container">
                <input
                  id="leverage-slider"
                  type="range"
                  min="1"
                  max="50"
                  step="0.1"
                  value={leverage}
                  onChange={e => setLeverage(e.target.value)}
                  className="slider-input"
                  disabled={!isConnected || isLoading}
                />
                <input
                  id="leverage-input"
                  type="number"
                  step="0.1"
                  min="1"
                  max="50"
                  value={leverage}
                  onChange={e => setLeverage(e.target.value)}
                  placeholder="Enter leverage"
                  className="text-input"
                  disabled={!isConnected || isLoading}
                />
              </div>
              <div className="leverage-display">
                <span>Current Leverage: {leverage}x</span>
              </div>
            </div>

            <button
              type="submit"
              className="submit-button"
              disabled={!isConnected || isLoading || !amount || !tradingSdk}
            >
              {isLoading ? 'Processing...' : 'Create Market Order'}
            </button>
          </form>
        </div>
      </main>

      <footer className="app-footer">
        <p>Trading SDK Example with TON-Connect UI</p>
      </footer>
    </div>
  );
}

// Wrap with TON-Connect UI Provider
function AppWithTonConnect() {
  return (
    <TonConnectUIProvider manifestUrl="http://localhost:3001/tonconnect-manifest.json">
      <App />
    </TonConnectUIProvider>
  );
}

export default AppWithTonConnect;
