export type StubRetrievalPolicy = { mode: "stub" };

export type InvalidLiveRetrievalPolicy = {
  mode: "invalid_live";
  reasons: readonly string[];
};

/** Active outbound policy (Wikipedia search API only in M5-T04 implementation). */
export type LiveBoundedRetrievalPolicy = {
  mode: "live";
  timeoutMs: number;
  maxCandidates: number;
  maxResponseBytes: number;
  maxQueryChars: number;
  allowedApiHosts: readonly string[];
  userAgent: string;
};

export type BoundedRetrievalPolicy = StubRetrievalPolicy | LiveBoundedRetrievalPolicy | InvalidLiveRetrievalPolicy;
