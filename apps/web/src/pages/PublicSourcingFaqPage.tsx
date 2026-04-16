import { Link } from "react-router-dom";

const items: { q: string; a: string }[] = [
  {
    q: "What is a published Storywall story?",
    a: "It is a reader-facing version of a story, curated by its creator and fixed at publication. The narrative and timeline you see are part of that published snapshot—not a live feed of every edit that happens afterward.",
  },
  {
    q: "What are public references?",
    a: "They are links and titles the creator chose to disclose for that published version. Only material marked for public readers is included; other research or notes stay in the creator workflow and are not shown here.",
  },
  {
    q: "Why do references appear under timeline events and also in a Sources section?",
    a: "Event-level references show context next to a moment in the story. The Sources section lists the same publish-frozen public set in one place so you can scan everything without scrolling the whole timeline.",
  },
  {
    q: "What is the dedicated references page?",
    a: "It is an optional full-page list of the same publish-frozen public references, with a light grouping by timeline where that helps. It does not add hidden sources or backstage detail—only what was already public for that publication.",
  },
  {
    q: "Why might I see few or no links?",
    a: "The creator may have published with minimal sourcing, chosen not to expose certain links publicly, or published before a fuller reference snapshot existed. Absence of a link does not imply anything about private editorial review.",
  },
  {
    q: "Does this public view update automatically when the creator keeps working?",
    a: "No. What you see reflects the published snapshot. If the story is updated and republished in the future, a new public version would apply then—until then, the reader view stays as it was at publication.",
  },
];

export function PublicSourcingFaqPage() {
  return (
    <article className="page public-story-page public-sourcing-faq">
      <header className="public-story-header">
        <p className="public-story-eyebrow muted small">Storywall</p>
        <h1 className="public-story-title">Reader help: sourcing</h1>
        <p className="public-story-subtitle muted">
          Short answers for readers. This page is static and does not use your account or load private editorial data.
        </p>
      </header>

      <div className="public-sourcing-faq__list">
        {items.map((item, i) => (
          <section key={item.q} className="public-sourcing-faq__item" aria-labelledby={`public-faq-q-${i}`}>
            <h2 id={`public-faq-q-${i}`} className="public-sourcing-faq__question">
              {item.q}
            </h2>
            <p className="public-sourcing-faq__answer">{item.a}</p>
          </section>
        ))}
      </div>

      <footer className="public-story-footer">
        <Link to="/" className="public-story-back">
          Home
        </Link>
      </footer>
    </article>
  );
}
