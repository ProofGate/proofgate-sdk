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
  apiKey: 'pg_your_api_key', // Get from proofgate.xyz/dashboard
});

// Validate before sending
const result = await pg.validate({
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

## API Reference

### `new ProofGate(config)`

Create a new ProofGate client.

```typescript
const pg = new ProofGate({
  apiKey: 'pg_xxx',           // Required: Your API key
  chainId: 56,                 // Optional: Default chain (56 = BSC)
  guardrailId: 'xxx',          // Optional: Default guardrail
  baseUrl: 'https://...',      // Optional: Custom API URL
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
  value: '0',           // Optional
  guardrailId: 'xxx',   // Optional: Override default
  chainId: 56,          // Optional: Override default
});

// Returns:
{
  validationId: 'val_abc123',
  result: 'PASS' | 'FAIL' | 'PENDING',
  reason: 'Transaction approved',
  safe: true,
  checks: [
    { name: 'daily_limit', passed: true, details: '...', severity: 'info' }
  ],
  authenticated: true,
  evidenceUri: 'https://...',
}
```

### `pg.validateOrThrow(request)`

Validate and throw error if unsafe.

```typescript
try {
  await pg.validateOrThrow({ from, to, data });
  // Safe to execute
} catch (error) {
  if (error instanceof ProofGateError) {
    console.log('Blocked:', error.message);
  }
}
```

### `pg.checkAgent(wallet)`

Check an agent's trust score.

```typescript
const agent = await pg.checkAgent('0x123...');

console.log(agent.trustScore);        // 85
console.log(agent.tier);              // 'gold'
console.log(agent.verificationStatus); // 'verified'
```

### `pg.getEvidence(validationId)`

Get evidence for a past validation.

```typescript
const evidence = await pg.getEvidence('val_abc123');
console.log(evidence.transaction);
console.log(evidence.result);
```

## Guardrails

Guardrails define what your agent can do. Create them at [proofgate.xyz/guardrails](https://www.proofgate.xyz/guardrails).

Example guardrail rules:
- **Whitelist contracts**: Only Uniswap, Aave, Compound
- **Max approval**: 1,000 USDC per approval
- **Max slippage**: 1% on swaps
- **Daily limit**: $10,000 total spending

## Error Handling

```typescript
import { ProofGate, ProofGateError } from '@proofgate/sdk';

try {
  await pg.validate({ from, to, data });
} catch (error) {
  if (error instanceof ProofGateError) {
    console.log('Code:', error.code);         // 'VALIDATION_FAILED'
    console.log('Message:', error.message);   // 'Infinite approval detected'
    console.log('Result:', error.validationResult);
  }
}
```

Error codes:
- `MISSING_API_KEY` - No API key provided
- `INVALID_API_KEY` - Key doesn't start with `pg_`
- `VALIDATION_FAILED` - Transaction failed validation
- `API_ERROR` - API returned an error
- `NETWORK_ERROR` - Network request failed
- `TIMEOUT` - Request timed out

## Frameworks

### Eliza (ai16z)

Use [`@eliza/plugin-proofgate`](https://www.npmjs.com/package/@eliza/plugin-proofgate) for native Eliza integration.

### LangChain / AutoGPT / Custom

Use this SDK directly:

```typescript
import { ProofGate } from '@proofgate/sdk';

// In your agent's transaction handler
async function sendTransaction(to: string, data: string, value: string) {
  const pg = new ProofGate({ apiKey: process.env.PROOFGATE_API_KEY! });
  
  // Validate first
  const result = await pg.validate({
    from: agentWallet,
    to: to as `0x${string}`,
    data: data as `0x${string}`,
    value,
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
  AgentCheckResponse,
  EvidenceResponse,
} from '@proofgate/sdk';
```

## Get Your API Key

1. Go to [proofgate.xyz](https://www.proofgate.xyz)
2. Connect your wallet
3. Register your AI agent
4. Copy your API key (starts with `pg_`)

**Free tier:** 100 validations/month

## Links

- **Website:** [proofgate.xyz](https://www.proofgate.xyz)
- **Documentation:** [proofgate.xyz/docs](https://www.proofgate.xyz/docs)
- **Dashboard:** [proofgate.xyz/dashboard](https://www.proofgate.xyz/dashboard)
- **GitHub:** [github.com/ProofGate/proofgate-sdk](https://github.com/ProofGate/proofgate-sdk)

## License

MIT © [0xCR6](https://twitter.com/0xCR6)
