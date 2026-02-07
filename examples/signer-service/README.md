# ProofGate Signer Service

A secure microservice architecture that keeps your private keys **away from your LLM**.

## The Problem

Most AI agent architectures give the LLM direct access to the private key:

```
❌ UNSAFE: LLM has private key
┌─────────────────────────────┐
│   LLM / Agent               │
│   - Has private key         │──────▶ Blockchain
│   - Can sign anything       │
└─────────────────────────────┘
```

If the LLM gets prompt-injected, the attacker can drain the wallet.

## The Solution

Separate the LLM from the signer. Add ProofGate as a validation layer:

```
✅ SECURE: LLM cannot access private key
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────┐
│   LLM / Agent   │────▶│  Signer Microservice │────▶│  Blockchain │
│  (NO priv key)  │     │  (has priv key)      │     │             │
└─────────────────┘     └──────────────────────┘     └─────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │  ProofGate   │
                        │  Validates   │
                        └──────────────┘
```

The LLM sends transaction **intent**. The signer validates and executes.

## How It Works

1. **LLM decides** what transaction to make (swap, transfer, etc.)
2. **LLM calls** the signer service with `{ to, data, value }`
3. **Signer validates** the transaction via ProofGate
4. **If safe** → Signer signs and submits to blockchain
5. **If unsafe** → Signer rejects, returns error to LLM

The LLM **never** sees the private key. Even a prompt injection attack cannot sign arbitrary transactions.

## Setup

```bash
# Install dependencies
npm install

# Set environment variables
export PRIVATE_KEY=0x...
export PROOFGATE_API_KEY=pg_live_...
export RPC_URL=https://mainnet.base.org  # Optional

# Start the service
npm start
```

## API Endpoints

### POST /execute

Execute a transaction (with ProofGate validation).

**Request:**
```json
{
  "to": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  "data": "0xa9059cbb000000000000000000000000...",
  "value": "0",
  "guardrailId": "optional-guardrail-id"
}
```

**Response (success):**
```json
{
  "success": true,
  "txHash": "0x...",
  "validation": {
    "result": "PASS",
    "reason": "All checks passed",
    "checks": [...]
  }
}
```

**Response (blocked):**
```json
{
  "success": false,
  "error": "Transaction blocked by ProofGate: Infinite approval detected",
  "validation": {
    "result": "FAIL",
    "reason": "Infinite approval detected",
    "checks": [...]
  }
}
```

### GET /address

Get the wallet address (so LLM can include it in transactions).

```json
{
  "address": "0x..."
}
```

### GET /health

Health check.

```json
{
  "status": "healthy",
  "address": "0x...",
  "chain": "base"
}
```

## Example: LLM Integration

Your LLM/agent calls the signer service via HTTP:

```typescript
// In your LLM/agent code (no private key here!)

async function executeSwap(tokenIn: string, tokenOut: string, amount: string) {
  // Build the transaction data
  const swapData = buildSwapCalldata(tokenIn, tokenOut, amount);
  
  // Get wallet address from signer service
  const { address } = await fetch('http://signer:3000/address').then(r => r.json());
  
  // Send to signer service for validation + execution
  const result = await fetch('http://signer:3000/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: UNISWAP_ROUTER,
      data: swapData,
      value: '0',
    }),
  }).then(r => r.json());
  
  if (result.success) {
    return `✅ Swap executed: ${result.txHash}`;
  } else {
    return `❌ Swap blocked: ${result.error}`;
  }
}
```

## Security Benefits

| Attack | Without Signer Service | With Signer Service |
|--------|----------------------|---------------------|
| Prompt injection | Attacker can sign any tx | Attacker can only request txs; ProofGate blocks dangerous ones |
| Infinite approval | LLM might approve | ProofGate blocks |
| Drain to attacker address | Possible | ProofGate blacklist blocks known drainers |
| Zero slippage swap | LLM might allow | ProofGate blocks |

## Deployment

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PRIVATE_KEY` | Yes | Wallet private key (0x...) |
| `PROOFGATE_API_KEY` | Yes | Your ProofGate API key |
| `RPC_URL` | No | RPC endpoint (default: Base mainnet) |
| `PORT` | No | Server port (default: 3000) |

## Best Practices

1. **Run signer service on isolated infrastructure** — separate from LLM
2. **Use guardrails** — create a ProofGate guardrail with specific rules
3. **Monitor transactions** — check ProofGate dashboard for blocked txs
4. **Rotate keys** — if you suspect compromise, rotate immediately
5. **Rate limit** — add rate limiting to prevent abuse

---

Built with ❤️ by [ProofGate](https://proofgate.xyz)
