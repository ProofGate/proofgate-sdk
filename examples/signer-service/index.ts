/**
 * ProofGate Signer Service Example
 * 
 * A secure microservice that sits between your LLM and the blockchain.
 * The LLM never has access to the private key.
 * 
 * Architecture:
 * ┌─────────────────┐     ┌──────────────────────┐     ┌─────────────┐
 * │   LLM / Agent   │────▶│  Signer Microservice │────▶│  Blockchain │
 * │  (NO priv key)  │     │  (has priv key)      │     │             │
 * └─────────────────┘     └──────────────────────┘     └─────────────┘
 *                                │
 *                                ▼
 *                         ┌──────────────┐
 *                         │  ProofGate   │
 *                         │  Validates   │
 *                         └──────────────┘
 */

import express from 'express';
import { createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { ProofGate } from '@proofgate/sdk';

// ============================================
// CONFIGURATION
// ============================================

const PORT = process.env.PORT || 3000;
const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
const PROOFGATE_API_KEY = process.env.PROOFGATE_API_KEY!;
const RPC_URL = process.env.RPC_URL || 'https://mainnet.base.org';

if (!PRIVATE_KEY) {
  throw new Error('PRIVATE_KEY environment variable required');
}

if (!PROOFGATE_API_KEY) {
  throw new Error('PROOFGATE_API_KEY environment variable required');
}

// ============================================
// SETUP
// ============================================

// Initialize ProofGate client
const proofgate = new ProofGate({
  apiKey: PROOFGATE_API_KEY,
  chainId: 8453, // Base
});

// Initialize wallet (private key ONLY here, not in LLM)
const account = privateKeyToAccount(PRIVATE_KEY);
const walletClient = createWalletClient({
  account,
  chain: base,
  transport: http(RPC_URL),
});

const app = express();
app.use(express.json());

// ============================================
// TYPES
// ============================================

interface TransactionRequest {
  to: string;
  data?: string;
  value?: string;
  guardrailId?: string;
}

interface TransactionResponse {
  success: boolean;
  txHash?: string;
  error?: string;
  validation?: {
    result: 'PASS' | 'FAIL';
    reason: string;
    checks: any[];
  };
}

// ============================================
// ENDPOINTS
// ============================================

/**
 * POST /execute
 * 
 * Receives a transaction request from the LLM,
 * validates it via ProofGate, and executes if safe.
 */
app.post('/execute', async (req, res) => {
  const { to, data, value, guardrailId }: TransactionRequest = req.body;

  console.log(`[${new Date().toISOString()}] Transaction request received`);
  console.log(`  To: ${to}`);
  console.log(`  Value: ${value || '0'}`);
  console.log(`  Data: ${data?.slice(0, 20)}...`);

  try {
    // ========================================
    // STEP 1: Validate with ProofGate
    // ========================================
    console.log('  → Validating with ProofGate...');
    
    const validation = await proofgate.validate({
      from: account.address,
      to: to as `0x${string}`,
      data: data || '0x',
      value: value || '0',
      guardrailId,
    });

    console.log(`  → Validation result: ${validation.result}`);

    // ========================================
    // STEP 2: Reject if unsafe
    // ========================================
    if (!validation.safe) {
      console.log(`  ✗ Transaction BLOCKED: ${validation.reason}`);
      
      const response: TransactionResponse = {
        success: false,
        error: `Transaction blocked by ProofGate: ${validation.reason}`,
        validation: {
          result: validation.result,
          reason: validation.reason,
          checks: validation.checks,
        },
      };
      
      return res.status(400).json(response);
    }

    // ========================================
    // STEP 3: Sign and execute if safe
    // ========================================
    console.log('  → Transaction validated, signing and executing...');

    const txHash = await walletClient.sendTransaction({
      to: to as `0x${string}`,
      data: (data || '0x') as `0x${string}`,
      value: value ? parseEther(value) : 0n,
    });

    console.log(`  ✓ Transaction sent: ${txHash}`);

    const response: TransactionResponse = {
      success: true,
      txHash,
      validation: {
        result: validation.result,
        reason: validation.reason,
        checks: validation.checks,
      },
    };

    return res.json(response);

  } catch (error: any) {
    console.error(`  ✗ Error: ${error.message}`);
    
    const response: TransactionResponse = {
      success: false,
      error: error.message,
    };
    
    return res.status(500).json(response);
  }
});

/**
 * GET /address
 * 
 * Returns the wallet address (so LLM can use it in transactions).
 * Does NOT expose the private key.
 */
app.get('/address', (req, res) => {
  res.json({ address: account.address });
});

/**
 * GET /health
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    address: account.address,
    chain: 'base',
  });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`\n🔐 ProofGate Signer Service`);
  console.log(`   Wallet: ${account.address}`);
  console.log(`   Chain:  Base (8453)`);
  console.log(`   Port:   ${PORT}`);
  console.log(`\n   The LLM can call /execute without ever seeing the private key.\n`);
});
