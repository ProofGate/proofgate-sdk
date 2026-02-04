# @proofgate/sdk

> Blockchain guardrails for AI agents. Validate transactions before execution.

[![npm version](https://badge.fury.io/js/@proofgate%2Fsdk.svg)](https://www.npmjs.com/package/@proofgate/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What is ProofGate?

ProofGate validates blockchain transactions before your AI agent executes them. It prevents:

- 🚫 **Wallet drains** from prompt injection attacks
- 🚫 **Infinite approvals** to malicious contracts  
- 🚫 **Excessive spending** beyond daily limits
- 🚫 **High slippage** swaps that lose money

**Supports 19 EVM chains** — Ethereum, Base, Arbitrum, Polygon, Optimism, and more.

## Installation

```bash
npm install @proofgate/sdk
# or
yarn add @proofgate/sdk
# or
pnpm add @proofgate/sdk
```

## Quick Start

```typescript
import { ProofGate } from '@proofgate/sdk';

// Initialize client
const pg = new ProofGate({
  apiKey: 'pg_live_xxx', // Get from www.proofgate.xyz/dashboard/keys
});

// Validate before sending
const result = await pg.validate({
  chainId: 8453, // Base
  from: '0xYourAgentWallet',
  to: '0xContractAddress', 
  data: '0xa9059cbb...', // Transaction calldata
  value: '0',
});

if (result.safe) {
  // ✅ Execute the transaction
  await wallet.sendTransaction({ to, data, value });
} else {
  // 🚫 Transaction blocked
  console.log('Blocked:', result.reason);
}
```

## Supported Chains

| Chain | ID | Chain | ID |
|-------|-------|-------|-------|
| Ethereum | 1 | Base | 8453 |
| Arbitrum | 42161 | Optimism | 10 |
| Polygon | 137 | BNB Chain | 56 |
| zkSync Era | 324 | Linea | 59144 |
| Scroll | 534352 | Avalanche | 43114 |
| Mantle | 5000 | Fantom | 250 |

**Testnets:** Base Sepolia (84532), Sepolia (11155111), Polygon Amoy (80002), BSC Testnet (97)

## API Reference

### `new ProofGate(config)`

Create a new ProofGate client.

```typescript
const pg = new ProofGate({
  apiKey: 'pg_live_xxx',       // Required: Your API key
  chainId: 8453,               // Optional: Default chain (8453 = Base)
  guardrailId: 'xxx',          // Optional: Default guardrail/policy
  baseUrl: 'https://www.proofgate.xyz', // Optional: Custom API URL
  timeout: 30000,              // Optional: Request timeout (ms)
});
```

### `pg.validate(request)`

Validate a transaction.

```typescript
const result = await pg.validate({
  from: '0xAgent...',
  to: '0xContract...',
  data: '0x...',
  value: '0',           // Optional, defaults to '0'
  guardrailId: 'xxx',   // Optional: Override default
  chainId: 8453,        // Optional: Override default
});

// Returns:
{
  validationId: 'val_abc123',
  result: 'PASS' | 'FAIL',
  reason: 'Transaction approved',
  safe: true,
  checks: [
    { check: 'allowed_contracts', passed: true, message: '...', severity: 'info' }
  ],
  authenticated: true,
  creditsRemaining: 95,
  tier: 'free',
  chainId: 8453,
  chainName: 'Base',
}
```

### `pg.validateOrThrow(request)`

Validate and throw error if unsafe.

```typescript
try {
  await pg.validateOrThrow({ from, to, data, chainId: 8453 });
  // Safe to execute
} catch (error) {
  if (error instanceof ProofGateError) {
    console.log('Blocked:', error.message);
  }
}
```

### `pg.getEvidence(validationId)`

Get evidence for a past validation.

```typescript
const evidence = await pg.getEvidence('val_abc123');
console.log(evidence.transaction);
console.log(evidence.result);
```

## Guardrails

Guardrails define what your agent can do. Create them at [www.proofgate.xyz/guardrails](https://www.proofgate.xyz/guardrails).

Example guardrail rules:
- **Whitelist contracts**: Only Uniswap, Aave, Aerodrome
- **Max approval**: 1,000 USDC per approval
- **Max slippage**: 1% on swaps
- **Daily limit**: $10,000 total spending

**136 pre-built templates** available for all 19 chains!

## Pricing & Rate Limits

| Tier | Credits/Month | Rate Limit | Price |
|------|---------------|------------|-------|
| Free | 100 | 10/min | $0 |
| Pro | 10,000 | 60/min | $49/mo |
| Enterprise | Unlimited | 600/min | Contact us |

All validations cost 1 credit (mainnet + testnet).

## Error Handling

```typescript
import { ProofGate, ProofGateError } from '@proofgate/sdk';

try {
  await pg.validate({ from, to, data, chainId });
} catch (error) {
  if (error instanceof ProofGateError) {
    console.log('Code:', error.code);
    console.log('Message:', error.message);
  }
}
```

Error codes:
- `AUTHENTICATION_REQUIRED` - Missing or invalid API key
- `PAYMENT_REQUIRED` - No credits remaining
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `VALIDATION_FAILED` - Transaction failed validation
- `API_ERROR` - API returned an error
- `NETWORK_ERROR` - Network request failed

## Framework Integrations

### Eliza (ai16z)

Use [`@proofgate/eliza-plugin`](https://www.npmjs.com/package/@proofgate/eliza-plugin) for native Eliza integration.

```typescript
import { proofgatePlugin } from '@proofgate/eliza-plugin';

const agent = new AgentRuntime({
  plugins: [proofgatePlugin],
  settings: {
    PROOFGATE_API_KEY: 'pg_live_xxx',
    PROOFGATE_DEFAULT_CHAIN_ID: '8453',
  }
});
```

### GOAT SDK

Use [`@proofgate/goat-plugin`](https://www.npmjs.com/package/@proofgate/goat-plugin) for GOAT SDK integration. Protects all 50+ DeFi plugins.

```typescript
import { ProofGatePlugin } from '@proofgate/goat-plugin';
import { getOnChainTools } from '@goat-sdk/adapter-vercel-ai';
import { viem } from '@goat-sdk/wallet-viem';

const proofgate = new ProofGatePlugin({
  apiKey: process.env.PROOFGATE_API_KEY,
  autoBlock: true,
});

const tools = await getOnChainTools({
  wallet: viem(walletClient),
  plugins: [proofgate, /* uniswap, aave, etc. */],
});
```

### LangChain / AutoGPT / Custom

Use this SDK directly in your transaction handler:

```typescript
import { ProofGate } from '@proofgate/sdk';

const pg = new ProofGate({ apiKey: process.env.PROOFGATE_API_KEY! });

async function sendTransaction(to: string, data: string, value: string, chainId: number) {
  // Validate first
  const result = await pg.validate({
    from: agentWallet,
    to: to as `0x${string}`,
    data: data as `0x${string}`,
    value,
    chainId,
  });
  
  if (!result.safe) {
    throw new Error(`Transaction blocked: ${result.reason}`);
  }
  
  // Safe to send
  return wallet.sendTransaction({ to, data, value });
}
```

## TypeScript

Full TypeScript support with exported types:

```typescript
import type {
  ProofGateConfig,
  ValidateRequest,
  ValidateResponse,
  ValidationCheck,
} from '@proofgate/sdk';
```

## Get Your API Key

1. Go to [www.proofgate.xyz](https://www.proofgate.xyz)
2. Connect your wallet
3. Go to Dashboard → API Keys
4. Create a new key (starts with `pg_live_`)

**Free tier:** 100 validations/month — no credit card required!

## Links

- **Website:** [www.proofgate.xyz](https://www.proofgate.xyz)
- **Documentation:** [www.proofgate.xyz/docs](https://www.proofgate.xyz/docs)
- **Dashboard:** [www.proofgate.xyz/dashboard](https://www.proofgate.xyz/dashboard)
- **Templates:** [www.proofgate.xyz/guardrails](https://www.proofgate.xyz/guardrails)
- **GitHub:** [github.com/ProofGate/proofgate-sdk](https://github.com/ProofGate/proofgate-sdk)

## License

MIT © [0xCR6](https://twitter.com/0xCR6)
