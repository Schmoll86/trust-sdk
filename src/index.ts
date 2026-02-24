/**
 * Trust Then Verify SDK v3.0.0
 *
 * TypeScript SDK for the AI agent trust registry.
 * Supports: registration, trust lookup, verification (9 chains),
 * search, evidence submission, reviews, and L402 payment flows.
 *
 * https://trustthenverify.com
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TrustDimension {
  score: number;
  max: number;
}

export interface TrustScore {
  total: number;
  confidence: number;
  version: string;
  dimensions: {
    identity: TrustDimension;
    economic: TrustDimension;
    social: TrustDimension;
    behavioral: TrustDimension;
  };
  risk_flags: string[];
  computed_at: string;
}

export interface EvidenceSummary {
  identity_proofs: number;
  transactions_received: number;
  reviews: number;
  disputes: number;
  account_age_days: number;
  verification_methods: string[];
}

/** Full trust lookup response from /v1/trust/:id */
export interface TrustLookup {
  subject_id: string;
  identifiers: Record<string, string>;
  trust_score: TrustScore;
  safe_to_transact: boolean;
  risk_level: "low" | "medium" | "high" | "unknown";
  evidence_summary: EvidenceSummary;
}

export interface Agent {
  id: string;
  name: string;
  description?: string;
  contact?: string;
  trust_score?: number;
  trust_tier?: number;
  capabilities?: string[];
  lightning_pubkey?: string;
  lightning_verified?: boolean;
  ethereum_address?: string;
  ethereum_verified?: boolean;
  solana_address?: string;
  solana_verified?: boolean;
  nostr_npub?: string;
  nostr_verified?: boolean;
  x_handle?: string;
  x_verified?: boolean;
  website?: string;
  website_verified?: boolean;
  ens_name?: string;
  ens_verified?: boolean;
  github_username?: string;
  github_verified?: boolean;
  endpoint_url?: string;
  endpoint_verified?: boolean;
  created_at?: string;
}

export interface PaginatedAgents {
  agents: Agent[];
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface ListAgentsOptions {
  page?: number;
  limit?: number;
}

export interface RegisterResponse {
  agent_id: string;
  trust_score: number;
  badge: string;
  next_steps: Array<{ action: string; points: string }>;
}

export interface ReviewResponse {
  success: boolean;
  review_id?: string;
  error?: string;
}

// ─── Verification Types ──────────────────────────────────────────────────────

export type VerificationChain =
  | "lightning"
  | "ethereum"
  | "solana"
  | "nostr"
  | "domain"
  | "twitter"
  | "ens"
  | "endpoint"
  | "github";

export interface ChallengeResponse {
  success: boolean;
  agent_id: string;
  chain: string;
  challenge: string;
  expires_in_seconds: number;
  instructions: string;
}

export interface VerifyResponse {
  success: boolean;
  message: string;
  verified: boolean;
  /** Chain-specific verified identifier (pubkey, address, domain, etc.) */
  [key: string]: unknown;
}

export interface VerifyLightningParams {
  agent_id: string;
  signature: string;
  pubkey: string;
}

export interface VerifyEthereumParams {
  agent_id: string;
  signature: string;
  address: string;
}

export interface VerifySolanaParams {
  agent_id: string;
  signature: string;
  address: string;
}

export interface VerifyNostrParams {
  agent_id: string;
  event_id?: string;
}

export interface VerifyDomainParams {
  agent_id: string;
  domain: string;
}

export interface VerifyTwitterParams {
  agent_id: string;
  handle: string;
}

export interface VerifyENSParams {
  agent_id: string;
  ens_name: string;
}

export interface VerifyEndpointParams {
  agent_id: string;
  endpoint_url: string;
}

export interface VerifyGitHubParams {
  agent_id: string;
  code?: string;
  access_token?: string;
}

export interface VerifyGitHubRedirect {
  success: true;
  action: "redirect";
  url: string;
  message: string;
}

// ─── Search Types ────────────────────────────────────────────────────────────

export interface SearchOptions {
  q?: string;
  min_score?: number;
  has_lightning?: boolean;
  verified?: boolean;
  capability?: string;
  limit?: number;
}

// ─── Evidence Types ──────────────────────────────────────────────────────────

export type EvidenceType =
  | "stripe_payment"
  | "paypal_payment"
  | "bank_transfer"
  | "crypto_payment"
  | "escrow_completed"
  | "service_delivered";

export interface EvidenceResponse {
  success: boolean;
  message: string;
  type: string;
  verified: boolean;
  weight: number;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class TrustRegistryOfflineError extends Error {
  constructor(message = "Trust registry is temporarily offline") {
    super(message);
    this.name = "TrustRegistryOfflineError";
  }
}

// ─── Client ──────────────────────────────────────────────────────────────────

export class TrustClient {
  private baseUrl: string;

  constructor(baseUrl: string = "https://trustthenverify.com") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private async safeFetch(url: string, init?: RequestInit): Promise<Response> {
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (err: any) {
      throw new TrustRegistryOfflineError(
        `Registry unreachable: ${err.message || "network error"}`
      );
    }
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      throw new TrustRegistryOfflineError(
        `Registry returned ${res.status}`
      );
    }
    return res;
  }

  private async postJson(path: string, body: object): Promise<Response> {
    return this.safeFetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  // ─── Core Methods ────────────────────────────────────────────────────────

  /**
   * Full trust lookup — returns score, identifiers, evidence summary, risk level.
   * This is the primary method for checking an agent before transacting.
   */
  async lookup(agentId: string): Promise<TrustLookup | null> {
    const res = await this.safeFetch(`${this.baseUrl}/v1/trust/${agentId}`);
    if (!res.ok) return null;
    return res.json();
  }

  async getAgent(agentId: string): Promise<Agent | null> {
    const res = await this.safeFetch(`${this.baseUrl}/registry/agent/${agentId}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.agent ?? data;
  }

  async listAgents(options?: ListAgentsOptions): Promise<PaginatedAgents> {
    const params = new URLSearchParams();
    if (options?.page) params.set("page", String(options.page));
    if (options?.limit) params.set("limit", String(options.limit));
    const qs = params.toString();
    const res = await this.safeFetch(`${this.baseUrl}/registry/agents${qs ? `?${qs}` : ""}`);
    if (!res.ok) return { agents: [], page: 1, limit: 50, total: 0, total_pages: 0 };
    const data = await res.json();
    return {
      agents: data.agents || [],
      page: data.page || 1,
      limit: data.limit || 50,
      total: data.total || 0,
      total_pages: data.total_pages || 0,
    };
  }

  async updateAgent(
    agentId: string,
    updates: Partial<Pick<Agent, "description" | "capabilities" | "lightning_pubkey" | "x_handle" | "website" | "contact">>,
    authSecret: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await this.safeFetch(`${this.baseUrl}/registry/agent/${agentId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Agent-Secret": authSecret,
      },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Update failed (${res.status})`);
    }
    return res.json();
  }

  async deleteAgent(
    agentId: string,
    authSecret: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await this.safeFetch(`${this.baseUrl}/registry/agent/${agentId}`, {
      method: "DELETE",
      headers: { "X-Agent-Secret": authSecret },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Delete failed (${res.status})`);
    }
    return res.json();
  }

  async register(
    name: string,
    contact: string,
    options?: {
      description?: string;
      capabilities?: string[];
      lightning_pubkey?: string;
      nostr_npub?: string;
      x_handle?: string;
      website?: string;
    }
  ): Promise<RegisterResponse> {
    const res = await this.postJson("/register", { name, contact, ...options });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Registration failed (${res.status})`);
    }
    return res.json();
  }

  async review(
    agentId: string,
    rating: number,
    comment: string,
    options?: {
      reviewer_pubkey?: string;
      service_used?: string;
      proof_of_payment?: string;
    }
  ): Promise<ReviewResponse> {
    const res = await this.postJson("/registry/review", {
      agent_id: agentId,
      rating,
      comment,
      ...options,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Review failed (${res.status})`);
    }
    return res.json();
  }

  badgeUrl(agentId: string): string {
    return `${this.baseUrl}/badge/${agentId}`;
  }

  async isTrusted(agentId: string): Promise<boolean> {
    const result = await this.lookup(agentId);
    if (!result) return false;
    return result.safe_to_transact;
  }

  static getTier(score: number): { label: string; badge: string; safe: boolean } {
    if (score >= 80) return { label: "Highly Trusted", badge: "🏆", safe: true };
    if (score >= 60) return { label: "Trusted", badge: "✅", safe: true };
    if (score >= 40) return { label: "Moderate", badge: "🔵", safe: false };
    if (score >= 20) return { label: "New/Limited", badge: "🟡", safe: false };
    return { label: "Unverified", badge: "⚪", safe: false };
  }

  // ─── Verification Methods ────────────────────────────────────────────────

  /**
   * Get a verification challenge for a specific chain.
   * The agent must sign this challenge to prove identity.
   */
  async getChallenge(agentId: string, chain: VerificationChain): Promise<ChallengeResponse> {
    const res = await this.safeFetch(
      `${this.baseUrl}/registry/challenge/${agentId}/${chain}`
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Challenge request failed (${res.status})`);
    }
    return res.json();
  }

  /**
   * Verify Lightning node ownership.
   * Sign the challenge with `lncli signmessage`, submit signature + pubkey.
   */
  async verifyLightning(params: VerifyLightningParams): Promise<VerifyResponse> {
    const res = await this.postJson("/registry/verify/lightning", params);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Lightning verification failed (${res.status})`);
    }
    return res.json();
  }

  /**
   * Verify Ethereum wallet ownership.
   * Sign the challenge with EIP-191 (ethers.signMessage), submit signature + address.
   */
  async verifyEthereum(params: VerifyEthereumParams): Promise<VerifyResponse> {
    const res = await this.postJson("/registry/verify/ethereum", params);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Ethereum verification failed (${res.status})`);
    }
    return res.json();
  }

  /**
   * Verify Solana wallet ownership.
   * Sign the challenge with nacl.sign.detached, submit base58 signature + address.
   */
  async verifySolana(params: VerifySolanaParams): Promise<VerifyResponse> {
    const res = await this.postJson("/registry/verify/solana", params);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Solana verification failed (${res.status})`);
    }
    return res.json();
  }

  /**
   * Verify Nostr identity.
   * Post the challenge text as a note, then call this endpoint.
   * Agent must have nostr_npub registered.
   */
  async verifyNostr(params: VerifyNostrParams): Promise<VerifyResponse> {
    const res = await this.postJson("/registry/verify/nostr", params);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Nostr verification failed (${res.status})`);
    }
    return res.json();
  }

  /**
   * Verify domain ownership.
   * Either add a DNS TXT record `billy-verify={challenge}` or
   * serve the challenge at `https://domain/.well-known/billy-verify.txt`.
   */
  async verifyDomain(params: VerifyDomainParams): Promise<VerifyResponse> {
    const res = await this.postJson("/registry/verify/domain", params);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Domain verification failed (${res.status})`);
    }
    return res.json();
  }

  /**
   * Verify Twitter/X handle.
   * Place the challenge code (last 12 chars) in bio or tweet it.
   */
  async verifyTwitter(params: VerifyTwitterParams): Promise<VerifyResponse> {
    const res = await this.postJson("/registry/verify/twitter", params);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Twitter verification failed (${res.status})`);
    }
    return res.json();
  }

  /**
   * Verify ENS name.
   * Requires Ethereum wallet to be verified first.
   * ENS must resolve to the agent's verified Ethereum address.
   */
  async verifyENS(params: VerifyENSParams): Promise<VerifyResponse> {
    const res = await this.postJson("/registry/verify/ens", params);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `ENS verification failed (${res.status})`);
    }
    return res.json();
  }

  /**
   * Verify agent endpoint via challenge-response.
   * The endpoint must accept POST to `/_trust_challenge` and echo the nonce.
   */
  async verifyEndpoint(params: VerifyEndpointParams): Promise<VerifyResponse> {
    const res = await this.postJson("/registry/verify/endpoint", params);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Endpoint verification failed (${res.status})`);
    }
    return res.json();
  }

  /**
   * Verify GitHub account via OAuth.
   * First call without code/token returns a redirect URL.
   * Second call with the OAuth code completes verification.
   */
  async verifyGitHub(params: VerifyGitHubParams): Promise<VerifyResponse | VerifyGitHubRedirect> {
    const res = await this.postJson("/registry/verify/github", params);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `GitHub verification failed (${res.status})`);
    }
    return res.json();
  }

  /**
   * Convenience: verify all chains at once.
   * Pass credentials for each chain you want to verify.
   * Skips chains where credentials are not provided.
   * Returns results per chain.
   */
  async verifyAll(
    agentId: string,
    credentials: {
      lightning?: { signature: string; pubkey: string };
      ethereum?: { signature: string; address: string };
      solana?: { signature: string; address: string };
      nostr?: { event_id?: string };
      domain?: { domain: string };
      twitter?: { handle: string };
      ens?: { ens_name: string };
      endpoint?: { endpoint_url: string };
      github?: { code?: string; access_token?: string };
    }
  ): Promise<Record<string, VerifyResponse | VerifyGitHubRedirect | { error: string }>> {
    const results: Record<string, VerifyResponse | VerifyGitHubRedirect | { error: string }> = {};

    const tasks: Array<[string, Promise<VerifyResponse | VerifyGitHubRedirect>]> = [];

    if (credentials.lightning) {
      tasks.push(["lightning", this.verifyLightning({ agent_id: agentId, ...credentials.lightning })]);
    }
    if (credentials.ethereum) {
      tasks.push(["ethereum", this.verifyEthereum({ agent_id: agentId, ...credentials.ethereum })]);
    }
    if (credentials.solana) {
      tasks.push(["solana", this.verifySolana({ agent_id: agentId, ...credentials.solana })]);
    }
    if (credentials.nostr) {
      tasks.push(["nostr", this.verifyNostr({ agent_id: agentId, ...credentials.nostr })]);
    }
    if (credentials.domain) {
      tasks.push(["domain", this.verifyDomain({ agent_id: agentId, ...credentials.domain })]);
    }
    if (credentials.twitter) {
      tasks.push(["twitter", this.verifyTwitter({ agent_id: agentId, ...credentials.twitter })]);
    }
    if (credentials.ens) {
      tasks.push(["ens", this.verifyENS({ agent_id: agentId, ...credentials.ens })]);
    }
    if (credentials.endpoint) {
      tasks.push(["endpoint", this.verifyEndpoint({ agent_id: agentId, ...credentials.endpoint })]);
    }
    if (credentials.github) {
      tasks.push(["github", this.verifyGitHub({ agent_id: agentId, ...credentials.github })]);
    }

    const settled = await Promise.allSettled(tasks.map(([, p]) => p));
    for (let i = 0; i < tasks.length; i++) {
      const [chain] = tasks[i];
      const result = settled[i];
      results[chain] = result.status === "fulfilled"
        ? result.value
        : { error: result.reason instanceof Error ? result.reason.message : String(result.reason) };
    }

    return results;
  }

  // ─── Search ──────────────────────────────────────────────────────────────

  /**
   * Search agents with filters.
   */
  async search(options: SearchOptions): Promise<PaginatedAgents> {
    const params = new URLSearchParams();
    if (options.q) params.set("q", options.q);
    if (options.min_score !== undefined) params.set("min_score", String(options.min_score));
    if (options.has_lightning !== undefined) params.set("has_lightning", String(options.has_lightning));
    if (options.verified !== undefined) params.set("verified", String(options.verified));
    if (options.capability) params.set("capability", options.capability);
    if (options.limit) params.set("limit", String(options.limit));
    const qs = params.toString();
    const res = await this.safeFetch(`${this.baseUrl}/registry/search${qs ? `?${qs}` : ""}`);
    if (!res.ok) return { agents: [], page: 1, limit: 50, total: 0, total_pages: 0 };
    const data = await res.json();
    return {
      agents: data.agents || data.results || [],
      page: data.page || 1,
      limit: data.limit || 50,
      total: data.total || 0,
      total_pages: data.total_pages || 0,
    };
  }

  // ─── Evidence ────────────────────────────────────────────────────────────

  /**
   * Submit self-reported evidence for trust scoring.
   * Unverified evidence is weighted at 50%.
   */
  async submitEvidence(
    agentId: string,
    type: EvidenceType,
    data: Record<string, unknown>,
    proofUrl?: string
  ): Promise<EvidenceResponse> {
    const res = await this.postJson("/registry/evidence/submit", {
      agent_id: agentId,
      type,
      data,
      proof_url: proofUrl,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Evidence submission failed (${res.status})`);
    }
    return res.json();
  }

  /**
   * Check if evidence already exists (deduplication).
   */
  async checkEvidence(eventId: string): Promise<boolean> {
    const res = await this.safeFetch(
      `${this.baseUrl}/registry/evidence/check?event_id=${encodeURIComponent(eventId)}`
    );
    if (!res.ok) return false;
    const data = await res.json();
    return data.exists === true;
  }
}

// ─── Default Instance & Convenience Exports ──────────────────────────────────

export const trust = new TrustClient();

export const lookup = (agentId: string) => trust.lookup(agentId);
export const register = (name: string, contact: string, options?: Parameters<TrustClient["register"]>[2]) =>
  trust.register(name, contact, options);
export const review = (agentId: string, rating: number, comment: string, options?: Parameters<TrustClient["review"]>[3]) =>
  trust.review(agentId, rating, comment, options);
export const listAgents = (options?: ListAgentsOptions) => trust.listAgents(options);
export const updateAgent = (agentId: string, updates: Parameters<TrustClient["updateAgent"]>[1], authSecret: string) =>
  trust.updateAgent(agentId, updates, authSecret);
export const deleteAgent = (agentId: string, authSecret: string) => trust.deleteAgent(agentId, authSecret);
export const isTrusted = (agentId: string) => trust.isTrusted(agentId);
export const badgeUrl = (agentId: string) => trust.badgeUrl(agentId);
export const search = (options: SearchOptions) => trust.search(options);

/**
 * Auto-register helper for agents.
 * Idempotent: searches existing agents by name first.
 */
export async function ensureRegistered(options: {
  name: string;
  contact?: string;
  npub?: string;
  lightning_pubkey?: string;
  description?: string;
}): Promise<string> {
  const result = await trust.listAgents({ limit: 50 });
  const existing = result.agents.find(a => a.name.toLowerCase() === options.name.toLowerCase());
  if (existing) return existing.id;

  const regResult = await trust.register(
    options.name,
    options.contact || `sdk-auto-${Date.now()}`,
    {
      description: options.description,
      nostr_npub: options.npub,
      lightning_pubkey: options.lightning_pubkey,
    }
  );
  return regResult.agent_id;
}

/**
 * Pre-transaction risk check with amount-based thresholds.
 */
export async function checkBeforeTransaction(
  agentId: string,
  amountSats: number
): Promise<{
  proceed: boolean;
  score: number;
  reason: string;
  riskLevel: "low" | "medium" | "high" | "unknown";
}> {
  const result = await trust.lookup(agentId);
  if (!result) {
    return {
      proceed: false,
      score: 0,
      reason: "Agent not found in registry. Unverified counterparty.",
      riskLevel: "unknown",
    };
  }

  const score = result.trust_score.total;
  const tier = TrustClient.getTier(score);
  const requiredScore = amountSats > 10000 ? 60 : amountSats > 1000 ? 40 : 20;

  if (score >= requiredScore) {
    return {
      proceed: true,
      score,
      reason: `${tier.label} agent with score ${score}/100`,
      riskLevel: tier.safe ? "low" : "medium",
    };
  }

  return {
    proceed: false,
    score,
    reason: `Score ${score}/100 below threshold ${requiredScore} for ${amountSats} sats transaction`,
    riskLevel: score < 20 ? "high" : "medium",
  };
}
