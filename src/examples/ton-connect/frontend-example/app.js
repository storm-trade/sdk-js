// API Configuration
const API_BASE_URL = 'http://localhost:3000/api';

// Constants for working with amounts
const ASSET_DECIMALS = {
    'TON': 9,  // 10^9 nanoTON = 1 TON
    'USDT': 6, // 10^6 micro USDT = 1 USDT
    'NOT': 8   // 10^8 nano NOT = 1 NOT
};

// TON-Connect Configuration
const manifestUrl = 'https://localhost:3001/tonconnect-manifest.json';
const connector = new TonConnectSDK.TonConnect({ manifestUrl });

// DOM Elements
const connectBtn = document.getElementById('connect-wallet-btn');
const disconnectBtn = document.getElementById('disconnect-wallet-btn');
const connectionStatus = document.getElementById('connection-status');
const provideLiquidityForm = document.getElementById('provide-liquidity-form');
const provideBtn = document.getElementById('provide-btn');
const assetSelect = document.getElementById('asset-select');
const amountInput = document.getElementById('amount-input');
const transactionResult = document.getElementById('transaction-result');

// Check if wallet is connected
async function checkConnection() {
    const walletInfo = connector.wallet;
    
    if (walletInfo) {
        connectionStatus.innerHTML = `Connected to: <strong>${walletInfo.name}</strong>
            <br>Address: <code>${walletInfo.account.address}</code>`;
        connectBtn.classList.add('d-none');
        disconnectBtn.classList.remove('d-none');
        provideBtn.disabled = false;
        return true;
    } else {
        connectionStatus.textContent = 'Not connected';
        connectBtn.classList.remove('d-none');
        disconnectBtn.classList.add('d-none');
        provideBtn.disabled = true;
        return false;
    }
}

// Connect wallet
async function connectWallet() {
    try {
        // Get available wallets for connection
        const availableWallets = await connector.getWallets();
        
        if (availableWallets.length === 0) {
            alert('No TON wallets found. Please install a TON wallet extension or app.');
            return;
        }
        
        // Connect to the first available wallet
        // In a real app, you would show a wallet selection modal
        await connector.connect({ jsBridgeKey: availableWallets[0].jsBridgeKey });
        
        checkConnection();
    } catch (error) {
        console.error('Failed to connect wallet:', error);
        alert(`Failed to connect wallet: ${error.message || 'Unknown error'}`);
    }
}

// Disconnect wallet
function disconnectWallet() {
    connector.disconnect();
    checkConnection();
    transactionResult.textContent = 'No transaction sent yet';
}

// Convert human-readable amount to blockchain format with proper decimals
function convertToBlockchainAmount(amount, assetName) {
    const decimals = ASSET_DECIMALS[assetName] || 9;
    const multiplier = Math.pow(10, decimals);
    return Math.floor(parseFloat(amount) * multiplier).toString();
}

// Send provide liquidity request to API
async function provideLiquidity(assetName, amount) {
    if (!connector.wallet) {
        alert('Please connect your wallet first');
        return;
    }
    
    const userAddress = connector.wallet.account.address;
    const blockchainAmount = convertToBlockchainAmount(amount, assetName);
    
    try {
        // Display loading state
        transactionResult.textContent = 'Preparing transaction...';
        
        // Request transaction parameters from our backend API
        const response = await fetch(`${API_BASE_URL}/provide-liquidity`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userAddress,
                assetName,
                amount: blockchainAmount
            })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'API returned error');
        }
        
        // Display the transaction we're about to send
        transactionResult.textContent = 'Transaction prepared. Sending to wallet for approval...';
        
        // Send transaction using TON-Connect
        const transactionParams = data.transaction;
        
        // Convert API response to TON-Connect format
        const transaction = {
            validUntil: Math.floor(Date.now() / 1000) + 360, // 5 minutes from now
            network: 'testnet', // or 'mainnet' for production
            from: userAddress,
            messages: [
                {
                    address: transactionParams.to,
                    amount: transactionParams.value,
                    payload: transactionParams.payload,
                    stateInit: transactionParams.stateInit,
                }
            ]
        };
        
        // Send the transaction to the wallet for signing and broadcasting
        const result = await connector.sendTransaction(transaction);
        
        // Show success message with transaction ID
        transactionResult.textContent = `Transaction sent successfully!\nTransaction ID: ${result.boc}\n\nPlease check your wallet for confirmation.`;
        
    } catch (error) {
        console.error('Error sending transaction:', error);
        transactionResult.textContent = `Error: ${error.message || 'Unknown error'}`;
    }
}

// Event Listeners
connectBtn.addEventListener('click', connectWallet);
disconnectBtn.addEventListener('click', disconnectWallet);

provideLiquidityForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const assetName = assetSelect.value;
    const amount = amountInput.value;
    
    if (!assetName || !amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        alert('Please enter a valid amount');
        return;
    }
    
    await provideLiquidity(assetName, amount);
});

// Check connection status on page load
document.addEventListener('DOMContentLoaded', () => {
    checkConnection();
    
    // Listen for wallet connection changes
    connector.onStatusChange(checkConnection);
});
