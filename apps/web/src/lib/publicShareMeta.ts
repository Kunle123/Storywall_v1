import type { PublicStoryData } from "../api/publicTypes";

export const STORYWALL_DEFAULT_DOCUMENT_TITLE = "Storywall";

const META_MARK = "data-storywall-public-share";

function mark(el: Element): void {
  el.setAttribute(META_MARK, "1");
}

export function publicSiteBaseUrl(): string {
  const raw = import.meta.env.VITE_PUBLIC_SITE_URL;
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim().replace(/\/$/, "");
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  return "";
}

function truncateForShare(text: string, maxLen: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1).trimEnd()}…`;
}

export function buildShareDescription(story: Pick<PublicStoryData, "summary" | "subtitle">): string {
  const primary = (story.summary?.trim() || story.subtitle?.trim() || "").trim();
  if (!primary) return "A Storywall publication.";
  return truncateForShare(primary, 220);
}

export function buildShareTitle(storyTitle: string): string {
  const t = storyTitle.trim() || "Story";
  return `${t} — Storywall`;
}

function upsertMeta(attr: "name" | "property", key: string, content: string): void {
  const sel = `meta[${attr}="${CSS.escape(key)}"][${META_MARK}]`;
  let el = document.querySelector(sel) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    mark(el);
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertCanonical(href: string): void {
  const sel = `link[rel="canonical"][${META_MARK}]`;
  let el = document.querySelector(sel) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    mark(el);
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function applyPublicStoryShareMeta(story: PublicStoryData, routeSlug: string): void {
  if (story.slug !== routeSlug) {
    clearPublicStoryShareMeta();
    return;
  }
  const base = publicSiteBaseUrl();
  const canonical = base ? `${base}/stories/${encodeURIComponent(story.slug)}` : "";
  const title = buildShareTitle(story.title);
  const description = buildShareDescription(story);

  document.title = title;

  upsertMeta("name", "description", description);

  upsertMeta("property", "og:title", title);
  upsertMeta("property", "og:description", description);
  upsertMeta("property", "og:type", "article");
  upsertMeta("property", "og:site_name", STORYWALL_DEFAULT_DOCUMENT_TITLE);
  if (canonical) {
    upsertMeta("property", "og:url", canonical);
    upsertCanonical(canonical);
  }

  upsertMeta("name", "twitter:card", "summary");
  upsertMeta("name", "twitter:title", title);
  upsertMeta("name", "twitter:description", description);
}

export function clearPublicStoryShareMeta(): void {
  document.querySelectorAll(`[${META_MARK}="1"]`).forEach((n) => n.remove());
  document.title = STORYWALL_DEFAULT_DOCUMENT_TITLE;
}
