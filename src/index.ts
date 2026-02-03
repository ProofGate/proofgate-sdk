/**
 * ProofGate SDK
 * 
 * Blockchain guardrails for AI agents. Validate transactions
 * before execution to prevent wallet drains, infinite approvals,
 * and other security risks.
 * 
 * @example
 * ```typescript
 * import { ProofGate } from '@proofgate/sdk';
 * 
 * const pg = new ProofGate({ apiKey: 'pg_your_key' });
 * 
 * // Validate before sending
 * const result = await pg.validate({
 *   from: agentWallet,
 *   to: contractAddress,
 *   data: calldata,
 *   value: '0',
 * });
 * 
 * if (result.safe) {
 *   await wallet.sendTransaction({ to, data, value });
 * } else {
 *   console.log('Blocked:', result.reason);
 * }
 * ```
 * 
 * @packageDocumentation
 */

// =============================================================================
// Types
// =============================================================================

export type Address = `0x${string}`;
export type Hex = `0x${string}`;

export interface ProofGateConfig {
  /** API key from ProofGate dashboard (starts with pg_) */
  apiKey: string;
  /** Base URL for API (default: https://www.proofgate.xyz/api) */
  baseUrl?: string;
  /** Default chain ID (default: 56 for BSC) */
  chainId?: number;
  /** Default guardrail ID to use for validations */
  guardrailId?: string;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
}

export interface ValidateRequest {
  /** Sender address (your agent's wallet) */
  from: Address;
  /** Target contract address */
  to: Address;
  /** Transaction calldata */
  data: Hex;
  /** Value in wei (default: '0') */
  value?: string;
  /** Guardrail ID (overrides default) */
  guardrailId?: string;
  /** Chain ID (overrides default) */
  chainId?: number;
}

export interface ValidateResponse {
  /** Unique validation ID */
  validationId: string;
  /** Result: PASS, FAIL, or PENDING */
  result: 'PASS' | 'FAIL' | 'PENDING';
  /** Human-readable reason */
  reason: string;
  /** Evidence URI */
  evidenceUri: string;
  /** Is the transaction safe to execute? */
  safe: boolean;
  /** Detailed check results */
  checks: ValidationCheck[];
  /** Chain ID validated on */
  chainId: number;
  /** Was API key authenticated? */
  authenticated: boolean;
  /** User tier (free/pro) */
  tier: string;
  /** Backend used (local/evidence-service) */
  backend: string;
  /** Was proof recorded on-chain? */
  onChainRecorded: boolean;
}

export interface ValidationCheck {
  /** Check name (e.g., 'allowed_contracts', 'daily_limit') */
  name: string;
  /** Did this check pass? */
  passed: boolean;
  /** Human-readable details */
  details: string;
  /** Severity: info, warning, critical */
  severity: 'info' | 'warning' | 'critical';
}

export interface AgentCheckResponse {
  /** Wallet address (lowercase) */
  wallet: string;
  /** Is this agent registered on ProofGate? */
  isRegistered: boolean;
  /** Verification status */
  verificationStatus: 'verified' | 'registered' | 'unverified' | 'unknown';
  /** Human-readable message */
  verificationMessage: string;
  /** Trust score (0-100) */
  trustScore: number;
  /** Trust tier */
  tier: 'diamond' | 'gold' | 'silver' | 'bronze' | 'unverified';
  /** Tier emoji */
  tierEmoji: string;
  /** Tier display name */
  tierName: string;
  /** Validation statistics */
  stats: {
    totalValidations: number;
    passedValidations: number;
    failedValidations: number;
    passRate: number;
  };
  /** Registration info (if registered) */
  registration: {
    name: string | null;
    registeredAt: string;
  } | null;
  /** Safety recommendation */
  recommendation: string;
}

export interface EvidenceResponse {
  /** Validation ID */
  validationId: string;
  /** Timestamp */
  timestamp: string;
  /** Chain ID */
  chainId: number;
  /** Transaction details */
  transaction: {
    from: string;
    to: string;
    data: string;
    value: string;
  };
  /** Validation result */
  result: {
    status: 'PASS' | 'FAIL' | 'PENDING';
    reason: string;
    safe: boolean;
  };
  /** Guardrail used */
  guardrailId: string | null;
  /** Agent info */
  agent: {
    wallet: string;
    name?: string;
    verified: boolean;
  };
  /** Proof metadata */
  proof: {
    authenticated: boolean;
    onChainRecorded: boolean;
    batchId: string | null;
    recordedAt: string | null;
  };
}

export interface GuardrailConfig {
  name: string;
  description?: string;
  /** Whitelisted contract addresses */
  allowedContracts?: Address[];
  /** Max approval amount in token units (e.g., '1000' for 1000 USDC) */
  maxApproval?: string;
  /** Max slippage in percentage (e.g., '1.0' for 1%) */
  maxSlippage?: string;
  /** Daily spending limit in token units */
  dailyLimit?: string;
}

export class ProofGateError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public validationResult?: ValidateResponse
  ) {
    super(message);
    this.name = 'ProofGateError';
  }
}

// =============================================================================
// Main SDK Class
// =============================================================================

/**
 * ProofGate SDK Client
 * 
 * @example
 * ```typescript
 * const pg = new ProofGate({
 *   apiKey: 'pg_your_api_key',
 *   chainId: 56, // BSC Mainnet
 * });
 * 
 * // Validate a transaction
 * const result = await pg.validate({
 *   from: '0xYourAgent...',
 *   to: '0xContract...',
 *   data: '0xa9059cbb...',
 * });
 * 
 * // Check an agent's trust score
 * const agent = await pg.checkAgent('0xSomeAgent...');
 * console.log(`Trust score: ${agent.trustScore}`);
 * ```
 */
export class ProofGate {
  private config: Required<Omit<ProofGateConfig, 'guardrailId'>> & { guardrailId?: string };

  constructor(config: ProofGateConfig) {
    if (!config.apiKey) {
      throw new ProofGateError(
        'API key is required. Get one at https://www.proofgate.xyz/dashboard',
        'MISSING_API_KEY'
      );
    }

    if (!config.apiKey.startsWith('pg_')) {
      throw new ProofGateError(
        'Invalid API key format. Keys start with "pg_"',
        'INVALID_API_KEY'
      );
    }

    this.config = {
      baseUrl: 'https://www.proofgate.xyz/api',
      chainId: 56,
      timeout: 30000,
      ...config,
    };
  }

  /**
   * Validate a transaction before execution
   * 
   * @param request - Transaction details
   * @returns Validation result
   * @throws ProofGateError on failure
   * 
   * @example
   * ```typescript
   * const result = await pg.validate({
   *   from: '0xAgent...',
   *   to: '0xUniswap...',
   *   data: '0x38ed1739...', // swap calldata
   *   value: '0',
   * });
   * 
   * if (result.safe) {
   *   // Execute the swap
   * } else {
   *   console.log('Blocked:', result.reason);
   *   // result.checks has detailed breakdown
   * }
   * ```
   */
  async validate(request: ValidateRequest): Promise<ValidateResponse> {
    const response = await this.request<ValidateResponse>('/validate', {
      method: 'POST',
      body: {
        from: request.from,
        to: request.to,
        data: request.data,
        value: request.value || '0',
        guardrailId: request.guardrailId || this.config.guardrailId,
        chainId: request.chainId || this.config.chainId,
      },
    });

    return response;
  }

  /**
   * Validate and throw if unsafe (convenience method)
   * 
   * @param request - Transaction details
   * @returns Validation result (only if safe)
   * @throws ProofGateError if validation fails
   * 
   * @example
   * ```typescript
   * try {
   *   await pg.validateOrThrow({ from, to, data });
   *   // Safe to execute
   *   await wallet.sendTransaction({ to, data });
   * } catch (error) {
   *   if (error instanceof ProofGateError) {
   *     console.log('Blocked:', error.message);
   *   }
   * }
   * ```
   */
  async validateOrThrow(request: ValidateRequest): Promise<ValidateResponse> {
    const result = await this.validate(request);

    if (!result.safe) {
      throw new ProofGateError(
        result.reason,
        'VALIDATION_FAILED',
        undefined,
        result
      );
    }

    return result;
  }

  /**
   * Check an agent's trust score and verification status
   * 
   * @param wallet - Agent wallet address
   * @returns Agent verification info
   * 
   * @example
   * ```typescript
   * const agent = await pg.checkAgent('0x123...');
   * 
   * if (agent.verificationStatus === 'verified') {
   *   console.log(`Trusted agent: ${agent.tierEmoji} ${agent.trustScore}/100`);
   * } else {
   *   console.log('Warning: Unverified agent');
   * }
   * ```
   */
  async checkAgent(wallet: Address): Promise<AgentCheckResponse> {
    return this.request<AgentCheckResponse>(`/agents/check?wallet=${wallet}`);
  }

  /**
   * Get evidence for a past validation
   * 
   * @param validationId - Validation ID
   * @returns Evidence details
   * 
   * @example
   * ```typescript
   * const evidence = await pg.getEvidence('val_abc123');
   * console.log('Transaction:', evidence.transaction);
   * console.log('Result:', evidence.result);
   * ```
   */
  async getEvidence(validationId: string): Promise<EvidenceResponse> {
    return this.request<EvidenceResponse>(`/evidence/${validationId}`);
  }

  /**
   * Get validation usage stats for a wallet
   * 
   * @param wallet - Wallet address
   * @returns Usage statistics
   */
  async getUsage(wallet: Address): Promise<{
    wallet: string;
    tier: string;
    validations_used: number;
    validations_limit: number;
    daily_spent_wei: string;
  }> {
    return this.request(`/validate?wallet=${wallet}`);
  }

  /**
   * Make a request to the ProofGate API
   */
  private async request<T>(
    path: string,
    options: { method?: string; body?: any } = {}
  ): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new ProofGateError(
          data.error || data.message || `HTTP ${response.status}`,
          'API_ERROR',
          response.status
        );
      }

      return data as T;

    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new ProofGateError('Request timeout', 'TIMEOUT');
      }
      if (error instanceof ProofGateError) {
        throw error;
      }
      throw new ProofGateError(error.message, 'NETWORK_ERROR');
    } finally {
      clearTimeout(timeout);
    }
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Create a ProofGate client instance
 * 
 * @param config - Client configuration
 * @returns ProofGate client
 * 
 * @example
 * ```typescript
 * import { createProofGate } from '@proofgate/sdk';
 * 
 * const pg = createProofGate({
 *   apiKey: process.env.PROOFGATE_API_KEY!,
 * });
 * ```
 */
export function createProofGate(config: ProofGateConfig): ProofGate {
  return new ProofGate(config);
}

/**
 * Quick validation helper
 * 
 * @param apiKey - ProofGate API key
 * @param tx - Transaction to validate
 * @returns Whether the transaction is safe
 * 
 * @example
 * ```typescript
 * import { isTransactionSafe } from '@proofgate/sdk';
 * 
 * const safe = await isTransactionSafe('pg_xxx', {
 *   from: agent,
 *   to: contract,
 *   data: calldata,
 * });
 * ```
 */
export async function isTransactionSafe(
  apiKey: string,
  tx: ValidateRequest
): Promise<boolean> {
  const pg = new ProofGate({ apiKey });
  const result = await pg.validate(tx);
  return result.safe;
}

// Default export
export default ProofGate;
