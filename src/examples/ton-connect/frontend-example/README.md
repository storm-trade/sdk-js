# TON-Connect UI Frontend Example

This directory contains a React-based frontend example that demonstrates how to integrate the Trading SDK with TON-Connect UI without requiring a backend API.

## Features

- Connect to TON wallets using TON-Connect UI
- Generate real transactions using the Trading SDK
- Send transactions directly through TON-Connect to the blockchain
- Provide liquidity using the Trading SDK

## Setup and Installation

1. Install dependencies:

```bash
npm install
```

2. Set up environment variables (REQUIRED):

Create a `.env` file in this directory using the `.env.example` as a template:

```bash
cp .env.example .env
```

Then edit the `.env` file to add your TON Center API key and adjust other settings as needed.

> **Important**: All environment variables are mandatory. The application will throw an error at startup if any required variables are missing.
> 
> **Note**: Vite uses the `VITE_` prefix for environment variables, not `REACT_APP_` (which is used by Create React App).

3. Start the development server:

```bash
npm run dev
```

The application will be accessible at http://localhost:3001

## Project Structure

- `src/App.tsx` - Main React component with TON-Connect UI and Trading SDK integration
- `src/main.tsx` - Entry point for the React application
- `src/polyfills.ts` - Polyfills for Buffer and other Node.js features needed by TON libraries
- `src/App.css` - Styling for the application
- `public/` - Static assets including the TON Connect manifest
- `vite.config.ts` - Vite configuration

## Implementation Details

### TON-Connect UI Integration

This example uses `@tonconnect/ui-react` to:

1. Connect to TON wallets
2. Send transactions to the user's wallet for signing

### Trading SDK Integration

The frontend uses the Trading SDK directly to:

1. Generate transaction parameters for providing liquidity
2. Format these parameters for TON-Connect

This approach eliminates the need for a backend API, making the example simpler and more portable.

## Environment Variables

This example uses the following environment variables, which should be defined in a `.env` file:

- `VITE_STORM_API_URL`: URL for the Storm API
- `VITE_ORACLE_URL`: URL for the Oracle API
- `VITE_TON_CENTER_URL`: URL for TON Center API
- `VITE_TONCENTER_API_KEY`: Your TON Center API key

## Troubleshooting

- If you encounter `Buffer is not defined` errors, check that the polyfills are properly loaded
- If transactions fail, check your API keys and network connectivity
- For TON-Connect issues, ensure your manifest is properly configured

## Resources

- [TON-Connect Documentation](https://docs.ton.org/develop/dapps/ton-connect/overview)
- [Vite Documentation](https://vitejs.dev/guide/)
- [Storm Trading SDK Documentation](https://docs.storm.tg)
