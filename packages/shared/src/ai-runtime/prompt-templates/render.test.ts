import { describe, expect, it } from "vitest";
import { PromptTemplateRenderError } from "./errors";
import { getCanonicalPromptTemplate } from "./registry";
import {
  applyPromptAuditToInvocationContext,
  buildVariableShapeFingerprintSha256,
  renderPromptTemplate,
} from "./render";

describe("renderPromptTemplate", () => {
  it("renders system+user with deterministic audit metadata", () => {
    const def = getCanonicalPromptTemplate({ key: "research.retrieval.bounded_query" });
    const variables = { story_title: "Alpha", query_seed: "Beta" };
    const a = renderPromptTemplate(def, variables);
    const b = renderPromptTemplate(def, variables);
    expect(a.messages).toEqual(b.messages);
    expect(a.audit.prompt_key).toBe("research.retrieval.bounded_query");
    expect(a.audit.prompt_version).toBe("1.0.0");
    expect(a.audit.variables_bound_sorted).toEqual(["query_seed", "story_title"]);
    expect(a.audit.variable_shape_fingerprint_sha256).toBe(
      buildVariableShapeFingerprintSha256({
        story_title: "Alpha",
        query_seed: "Beta",
      }),
    );
    expect(a.messages[0]!.role).toBe("system");
    expect(a.messages[1]!.role).toBe("user");
    expect(a.messages[1]!.content).toContain("Alpha");
    expect(a.messages[1]!.content).toContain("Beta");
  });

  it("throws missing_variables when a key is absent", () => {
    const def = getCanonicalPromptTemplate({ key: "framing.candidate_axes_stub" });
    expect(() => renderPromptTemplate(def, {})).toThrow(PromptTemplateRenderError);
    try {
      renderPromptTemplate(def, {});
    } catch (e) {
      expect(e).toBeInstanceOf(PromptTemplateRenderError);
      expect((e as PromptTemplateRenderError).code).toBe("missing_variables");
    }
  });

  it("throws extra_variables when strict and unknown keys are passed", () => {
    const def = getCanonicalPromptTemplate({ key: "validation.issue_explainer_stub" });
    expect(() =>
      renderPromptTemplate(
        def,
        { issue_code: "X", extra: "nope" },
        { strictExtraKeys: true },
      ),
    ).toThrow(PromptTemplateRenderError);
    try {
      renderPromptTemplate(def, { issue_code: "X", extra: "nope" });
    } catch (e) {
      expect((e as PromptTemplateRenderError).code).toBe("extra_variables");
    }
  });

  it("allows extra keys when strictExtraKeys is false", () => {
    const def = getCanonicalPromptTemplate({ key: "validation.issue_explainer_stub" });
    const r = renderPromptTemplate(
      def,
      { issue_code: "X", extra: "ignored" },
      { strictExtraKeys: false },
    );
    expect(r.messages[0]!.content).toContain("X");
  });

  it("fingerprint changes when UTF-8 byte lengths differ", () => {
    const a = buildVariableShapeFingerprintSha256({ k: "é" });
    const b = buildVariableShapeFingerprintSha256({ k: "e" });
    expect(a).not.toBe(b);
  });
});

describe("getCanonicalPromptTemplate", () => {
  it("throws version_mismatch when version does not match registry", () => {
    expect(() =>
      getCanonicalPromptTemplate({ key: "research.synthesis.package_stub", version: "9.9.9" }),
    ).toThrow(PromptTemplateRenderError);
  });
});

describe("applyPromptAuditToInvocationContext", () => {
  it("copies prompt key and version onto invocation context", () => {
    const def = getCanonicalPromptTemplate({ key: "scoped_enrichment.field_stub" });
    const { audit } = renderPromptTemplate(def, {
      target_label: "T",
      field_name: "F",
    });
    const merged = applyPromptAuditToInvocationContext({ purpose: "scoped_enrichment" }, audit);
    expect(merged.promptTemplateKey).toBe(audit.prompt_key);
    expect(merged.promptTemplateVersion).toBe(audit.prompt_version);
    expect(merged.promptVersion).toBe(audit.prompt_version);
  });
});
