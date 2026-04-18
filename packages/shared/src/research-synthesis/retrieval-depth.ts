/**
 * M5-T23 — truthful retrieval depth from persisted synthesis + optional candidate URLs/count.
 * Deterministic only; no LLM scoring.
 */

import { parseResearchSynthesisPackageV1 } from "./parse";
import type { ResearchSynthesisPackageV1 } from "./types";

export type RetrievalDepthTier = "thin" | "partial" | "solid";

export type RetrievalDepthEvidence = {
  retrieval_mode: "stub" | "live" | null;
  synthesis_retrieval_partial: boolean | null;
  /** Row count used for tiering (max of explicit list, override, and synthesis UUID references). */
  candidate_source_count: number;
  /** Distinct URL hostnames when URLs were supplied; null when hosts were not evaluated. */
  distinct_source_hosts: number | null;
  synthesis_finding_count: number;
  sourced_claim_finding_count: number;
  synthesis_cluster_count: number;
};

export type RetrievalDepthAssessment = {
  tier: RetrievalDepthTier;
  evidence: RetrievalDepthEvidence;
  headline: string;
  next_action: string;
  /** Single line for honesty `ui_hints`. */
  ui_hint_line: string;
};

function distinctHostsFromUrls(urls: readonly string[]): number {
  const hosts = new Set<string>();
  for (const raw of urls) {
    const u = raw.trim();
    if (!u) continue;
    try {
      const parsed = new URL(u);
      if (parsed.hostname) hosts.add(parsed.hostname.toLowerCase());
    } catch {
      /* skip */
    }
  }
  return hosts.size;
}

function inferCandidateIdCountFromSynthesis(syn: ResearchSynthesisPackageV1): number {
  const ids = new Set<string>();
  for (const f of syn.findings) {
    for (const id of f.supporting_research_candidate_source_ids) {
      if (id.trim()) ids.add(id);
    }
  }
  return ids.size;
}

function sourcedClaimCount(syn: ResearchSynthesisPackageV1): number {
  return syn.findings.filter((f) => f.kind === "sourced_claim").length;
}

function resolveTier(params: {
  syn: ResearchSynthesisPackageV1;
  candidateCount: number;
  distinctHosts: number | null;
}): RetrievalDepthTier {
  const { syn, candidateCount, distinctHosts } = params;
  const sourced = sourcedClaimCount(syn);
  const findings = syn.findings.length;

  if (syn.retrieval_mode === "stub") {
    if (candidateCount < 2 || findings < 3 || sourced < 2) return "thin";
    return "partial";
  }

  if (syn.retrieval_mode === "live") {
    if (syn.retrieval_partial) {
      if (candidateCount <= 2 && sourced <= 2) return "thin";
      return "partial";
    }
    const hostsOk = distinctHosts === null ? false : distinctHosts >= 2;
    const breadthOk = candidateCount >= 5 && sourced >= 4;
    if (breadthOk && hostsOk) return "solid";
    if (candidateCount >= 3 || sourced >= 3) return "partial";
    return "thin";
  }

  return "thin";
}

function headlineFor(tier: RetrievalDepthTier, syn: ResearchSynthesisPackageV1 | null): string {
  if (!syn) return "Retrieval depth: thin — synthesis package missing or unparsable.";
  if (tier === "thin") {
    return syn.retrieval_mode === "stub"
      ? "Retrieval depth: thin — stub placeholders only; not enough candidate rows or findings to treat as substantive."
      : "Retrieval depth: thin — live package is small, partial, or under-diversified for chronology work.";
  }
  if (tier === "partial") {
    return syn.retrieval_mode === "stub"
      ? "Retrieval depth: partial — deterministic stub/scaffold material exists, but it is not live-web-grounded."
      : syn.retrieval_partial
        ? "Retrieval depth: partial — bounded retrieval reported incomplete coverage; corroboration may be incomplete."
        : "Retrieval depth: partial — usable material, but breadth or host diversity is below the substantive bar.";
  }
  return "Retrieval depth: solid — bounded live retrieval produced enough diversified candidates for downstream chronology/draft work.";
}

function nextActionFor(tier: RetrievalDepthTier, syn: ResearchSynthesisPackageV1 | null): string {
  if (!syn) return "Re-run research after fixing package persistence, or contact support if this persists.";
  if (syn.retrieval_mode === "stub") {
    if (tier === "thin") {
      return "Enable live bounded retrieval on the worker (when your host supports it) and re-run research, or paste manual sources before relying on chronology.";
    }
    return "Treat findings as structural only; enable live retrieval and re-run when you need web-grounded evidence, or add manual sources.";
  }
  if (tier === "thin") {
    return "Broaden the brief or re-run research; if retrieval stays thin, add manual candidate sources.";
  }
  if (tier === "partial") {
    return syn.retrieval_partial
      ? "Retry research with a clearer brief or wider scope, or add sources manually where gaps appear."
      : "Optionally re-run research for more hits, or proceed while manually strengthening weak claims.";
  }
  return "Proceed to framing and draft assembly while still verifying claims against primaries before publish.";
}

export type ComputeRetrievalDepthAssessmentInput = {
  researchSynthesisPackage: unknown;
  candidateSources?: ReadonlyArray<{ source_url?: string | null }>;
  /** When URLs are unavailable (e.g. framing rail) but DB count is known. */
  candidateSourceCountOverride?: number;
};

export function computeRetrievalDepthAssessment(input: ComputeRetrievalDepthAssessmentInput): RetrievalDepthAssessment {
  const syn = parseResearchSynthesisPackageV1(input.researchSynthesisPackage ?? null);
  const fromUrls = (input.candidateSources ?? []).map((s) => (typeof s.source_url === "string" ? s.source_url : "")).filter(Boolean);
  const listCount = input.candidateSources?.length ?? 0;
  const override = input.candidateSourceCountOverride ?? 0;
  const inferred = syn ? inferCandidateIdCountFromSynthesis(syn) : 0;
  const candidateCount = Math.max(listCount, override, inferred);

  const distinctHosts = fromUrls.length > 0 ? distinctHostsFromUrls(fromUrls) : null;

  if (!syn) {
    const evidence: RetrievalDepthEvidence = {
      retrieval_mode: null,
      synthesis_retrieval_partial: null,
      candidate_source_count: candidateCount,
      distinct_source_hosts: distinctHosts,
      synthesis_finding_count: 0,
      sourced_claim_finding_count: 0,
      synthesis_cluster_count: 0,
    };
    return {
      tier: "thin",
      evidence,
      headline: headlineFor("thin", null),
      next_action: nextActionFor("thin", null),
      ui_hint_line: "Retrieval depth (M5-T23): thin — no parseable research_synthesis_package; treat material as incomplete.",
    };
  }

  const tier = resolveTier({ syn, candidateCount, distinctHosts });
  const evidence: RetrievalDepthEvidence = {
    retrieval_mode: syn.retrieval_mode,
    synthesis_retrieval_partial: syn.retrieval_partial,
    candidate_source_count: candidateCount,
    distinct_source_hosts: distinctHosts,
    synthesis_finding_count: syn.findings.length,
    sourced_claim_finding_count: sourcedClaimCount(syn),
    synthesis_cluster_count: syn.clusters.length,
  };

  const headline = headlineFor(tier, syn);
  const next_action = nextActionFor(tier, syn);
  const ui_hint_line = `Retrieval depth (M5-T23): ${tier} — ${candidateCount} candidate row(s), ${evidence.sourced_claim_finding_count} sourced_claim finding(s), mode=${syn.retrieval_mode}${distinctHosts !== null ? `, ${distinctHosts} distinct host(s)` : ""}.`;

  return { tier, evidence, headline, next_action, ui_hint_line };
}
