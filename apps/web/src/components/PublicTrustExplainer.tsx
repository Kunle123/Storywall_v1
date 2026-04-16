export function PublicTrustExplainer() {
  return (
    <aside className="public-trust-explainer" aria-labelledby="public-trust-explainer-title">
      <h2 id="public-trust-explainer-title" className="public-trust-explainer__title">
        How Storywall shows this publication
      </h2>
      <p className="public-trust-explainer__p">
        You are reading a published reader view, curated by the story's creator. The text and timeline reflect what
        was released at publication, not day-to-day draft work elsewhere.
      </p>
      <p className="public-trust-explainer__p">
        Public references are those the creator chose to disclose for this version, captured when the story was
        published. Other editorial material is intentionally not shown here.
      </p>
      <p className="public-trust-explainer__p">
        This is the reader-facing snapshot for this story, not a window into private editorial tooling or unreleased
        material.
      </p>
    </aside>
  );
}
