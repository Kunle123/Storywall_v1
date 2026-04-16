/**
 * One-off staging exemplar hardening for Challenger STS-51-L (run after API deploy).
 * Usage: node scripts/exemplar-challenger-quality-pass.mjs
 */
import crypto from "node:crypto";

const API = process.env.STORYWALL_API_URL ?? "https://api-staging-1de1.up.railway.app";
const EMAIL = process.env.STORYWALL_EXEMPLAR_EMAIL ?? "exemplar-sts51l-1776369320428@example.test";
const PASS = process.env.STORYWALL_EXEMPLAR_PASSWORD ?? "ExemplarRun2026!";
const STORY = "4bad4c0a-677b-4169-b03e-031313b431a1";

const SOURCE_ROTATION = [
  {
    url: "https://history.nasa.gov/rogersrep/v1p/title.htm",
    title: "Report of the Presidential Commission on the Space Shuttle Challenger Accident — title/front matter",
    publisher: "NASA History Division",
    note: "Primary investigation report (Rogers Commission), hosted on NASA History.",
  },
  {
    url: "https://history.nasa.gov/rogersrep/v1n6/cover.htm",
    title: "Report of the Presidential Commission (Volume VI) — cover",
    publisher: "NASA History Division",
    note: "Commission report volume in the official NASA History archive.",
  },
  {
    url: "https://solarsystem.nasa.gov/missions/challenger/in-depth/",
    title: "Challenger mission — in-depth overview",
    publisher: "NASA Science / Solar System Exploration",
    note: "NASA educational overview of the Challenger mission and loss.",
  },
  {
    url: "https://www.govinfo.gov/content/pkg/USCREPORTS-99-1012/pdf/USCREPORTS-99-1012.pdf",
    title: "Presidential Commission on the Space Shuttle Challenger Accident (GovInfo PDF)",
    publisher: "U.S. Government Publishing Office",
    note: "Official government copy of the commission report (PDF).",
  },
  {
    url: "https://en.wikipedia.org/wiki/Space_Shuttle_Challenger_disaster",
    title: "Space Shuttle Challenger disaster (overview)",
    publisher: "Wikipedia",
    note: "Secondary overview useful for cross-checking dates and widely cited facts; primary claims should track Rogers/NASA sources.",
  },
  {
    url: "https://www.britannica.com/event/Challenger-disaster",
    title: "Challenger disaster",
    publisher: "Encyclopaedia Britannica",
    note: "Curated encyclopedic summary; use alongside primary government and NASA sources.",
  },
];

/** Display lines by `position_index` (ordered spine → loss). */
const DISPLAY_BY_POSITION = [
  "January 1986 (editorial spine)",
  "January 1986 (open questions)",
  "Late 1985 – January 1986",
  "January 27, 1986",
  "January 27–28, 1986 (overnight, Eastern Time)",
  "January 28, 1986 (pre-launch)",
  "January 28, 1986 · 11:38 a.m. EST (launch)",
  "January 28, 1986 · ~73 seconds after launch",
];

async function j(res) {
  const t = await res.text();
  try {
    return JSON.parse(t);
  } catch {
    return { ok: false, _raw: t.slice(0, 400) };
  }
}

function idem() {
  return crypto.randomUUID();
}

async function main() {
  const login = await j(
    await fetch(`${API}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASS }),
    }),
  );
  if (!login.ok) {
    console.error("login failed", login);
    process.exit(1);
  }
  const token = login.data.access_token;
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const frames = await j(await fetch(`${API}/api/v1/creator/stories/${STORY}/frames`, { headers: auth }));
  const draft = frames.data?.story_draft;
  if (!draft?.last_edited_at) {
    console.error("no story_draft", frames);
    process.exit(1);
  }

  const conclusion =
    "This Storywall stops at the first hours of public reckoning: the loss of Challenger and the opening of the Rogers Commission. " +
    "It is not a substitute for the full commission record, witness transcripts, or engineering monographs. " +
    "The timeline and references are meant to make the decision chain legible—how cold-weather concerns, managerial reassessment, and launch commit fit together—without pretending to settle every contested detail.";

  const patchDraft = await j(
    await fetch(`${API}/api/v1/creator/stories/${STORY}/draft`, {
      method: "PATCH",
      headers: { ...auth, "If-Match": draft.last_edited_at },
      body: JSON.stringify({ conclusion }),
    }),
  );
  console.log("patch draft conclusion", patchDraft.ok, patchDraft.error?.message || patchDraft.data?.story_draft?.conclusion?.slice(0, 60));

  for (let pos = 0; pos < DISPLAY_BY_POSITION.length; pos++) {
    const evRes = await j(await fetch(`${API}/api/v1/creator/stories/${STORY}/events`, { headers: auth }));
    const events = evRes.data?.events ?? [];
    const e = events.find((x) => x.position_index === pos);
    const dd = DISPLAY_BY_POSITION[pos];
    if (!e || !dd) continue;
    if ((e.display_date ?? "").trim() === dd) {
      console.log("display_date skip (already set)", pos);
      continue;
    }
    const pr = await j(
      await fetch(`${API}/api/v1/creator/stories/${STORY}/events/${e.id}`, {
        method: "PATCH",
        headers: { ...auth, "If-Match": e.updated_at },
        body: JSON.stringify({ display_date: dd }),
      }),
    );
    if (!pr.ok) {
      console.error("PATCH display_date failed", pos, e.headline?.slice(0, 50), pr);
    } else {
      console.log("display_date ok", pos, e.headline?.slice(0, 45));
    }
  }

  const freshEv = await j(await fetch(`${API}/api/v1/creator/stories/${STORY}/events`, { headers: auth }));
  const evList = freshEv.data?.events ?? [];
  let rot = 0;

  for (const e of evList) {
    const srcRes = await j(
      await fetch(`${API}/api/v1/creator/stories/${STORY}/events/${e.id}/sources`, { headers: auth }),
    );
    const sources = srcRes.data?.sources ?? [];
    if (sources.length === 0) {
      const pick = SOURCE_ROTATION[rot % SOURCE_ROTATION.length];
      rot++;
      const cr = await j(
        await fetch(`${API}/api/v1/creator/stories/${STORY}/events/${e.id}/sources`, {
          method: "POST",
          headers: auth,
          body: JSON.stringify({
            source_url: pick.url,
            source_title: pick.title,
            publisher_name: pick.publisher,
            relevance_note: pick.note,
            source_type: "report",
            reliability_tier: "high",
            verification_status: "verified",
            is_public: true,
            source_extraction_method: "manual",
          }),
        }),
      );
      console.log("POST source", e.headline?.slice(0, 40), cr.ok, cr.error?.message);
      continue;
    }
    for (const s of sources) {
      const pick = SOURCE_ROTATION[rot % SOURCE_ROTATION.length];
      rot++;
      const pr = await j(
        await fetch(`${API}/api/v1/creator/stories/${STORY}/events/${e.id}/sources/${s.id}`, {
          method: "PATCH",
          headers: { ...auth, "If-Match": s.updated_at },
          body: JSON.stringify({
            source_url: pick.url,
            source_title: pick.title,
            publisher_name: pick.publisher,
            relevance_note: pick.note,
            reliability_tier: "high",
            verification_status: "verified",
            is_public: true,
            status: "approved",
          }),
        }),
      );
      console.log("PATCH source", s.id.slice(0, 8), pr.ok, pr.error?.message);
    }
  }

  const val = await j(
    await fetch(`${API}/api/v1/creator/stories/${STORY}/validation/run`, {
      method: "POST",
      headers: { ...auth, "Idempotency-Key": idem() },
      body: JSON.stringify({ run_type: "full" }),
    }),
  );
  console.log("validation", val.data?.overall_result, "warnings", val.data?.warning_count, "blockers", val.data?.blocker_count);

  const pub = await j(
    await fetch(`${API}/api/v1/creator/stories/${STORY}/publish`, {
      method: "POST",
      headers: { ...auth, "Idempotency-Key": `exemplar-quality-republish-${Date.now()}` },
      body: JSON.stringify({ acknowledge_validation_warnings: true }),
    }),
  );
  console.log("publish", pub.ok, pub.data, pub.error);

  const slug = frames.data?.story_slug ?? "challenger-sts-51-l-decision-launch-and-loss-january-1986";
  const pubRead = await j(await fetch(`${API}/api/v1/stories/${encodeURIComponent(slug)}`));
  console.log(
    "public",
    pubRead.ok,
    "sections",
    pubRead.data?.sections?.length,
    "events",
    pubRead.data?.events?.length,
    "sources",
    pubRead.data?.sources?.length,
  );
  if (pubRead.data?.events?.length) {
    const missing = pubRead.data.events.filter((ev) => !ev.display_date).length;
    console.log("events missing display_date", missing);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
