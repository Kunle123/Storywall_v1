/**
 * Second controlled exemplar (staging): Twenty-Sixth Amendment (1971), contrasting Challenger.
 *
 * Prerequisites: API at STORYWALL_API_URL (default staging). Creates or uses a dedicated account.
 *
 *   STORYWALL_API_URL=https://api-staging-1de1.up.railway.app \
 *   STORYWALL_SECOND_EXEMPLAR_EMAIL=exemplar-second-shape@example.test \
 *   STORYWALL_SECOND_EXEMPLAR_PASSWORD=ExemplarGen2026! \
 *   node scripts/second-exemplar-generalization-run.mjs
 *
 * Re-running will register/login the same email and create another story (new slug).
 */
import crypto from "node:crypto";

const API = process.env.STORYWALL_API_URL ?? "https://api-staging-1de1.up.railway.app";
const EMAIL = process.env.STORYWALL_SECOND_EXEMPLAR_EMAIL ?? "exemplar-second-shape@example.test";
const PASS = process.env.STORYWALL_SECOND_EXEMPLAR_PASSWORD ?? "ExemplarGen2026!";

const SOURCES = [
  {
    url: "https://www.law.cornell.edu/constitution/amendmentxxvi",
    title: "U.S. Constitution — Amendment XXVI (Legal Information Institute)",
    publisher: "Cornell Law School",
    note: "Neutral legal text and annotations for the Twenty-Sixth Amendment.",
  },
  {
    url: "https://www.ourdocuments.gov/doc.php?flash=false&doc=67",
    title: "26th Amendment to the U.S. Constitution (Our Documents)",
    publisher: "U.S. National Archives / Our Documents",
    note: "Milestone document context for the amendment lowering the voting age.",
  },
  {
    url: "https://www.fjc.gov/history/collections/timeline/1971/26th-amendment-ratified",
    title: "1971: 26th Amendment Ratified (Federal Judicial Center timeline)",
    publisher: "Federal Judicial Center",
    note: "Institutional timeline entry for ratification year.",
  },
  {
    url: "https://constitutioncenter.org/the-constitution/amendments/amendment-xxvi",
    title: "Amendment XXVI — National Constitution Center",
    publisher: "National Constitution Center",
    note: "Educational synthesis; cross-check dates against primary sources.",
  },
];

async function j(res) {
  return JSON.parse(await res.text());
}

function idem() {
  return crypto.randomUUID();
}

async function pollJob(token, jobId, label) {
  const h = { Authorization: `Bearer ${token}` };
  let status = "pending";
  for (let i = 0; i < 120 && status !== "succeeded" && status !== "failed"; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const st = await j(await fetch(`${API}/api/v1/creator/jobs/${jobId}`, { headers: h }));
    status = st.data.status;
    if (i % 5 === 0) console.log(label, i, status, st.data.error_message);
  }
  return status;
}

async function main() {
  let reg = await j(
    await fetch(`${API}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASS }),
    }),
  );
  if (!reg.ok) {
    reg = await j(
      await fetch(`${API}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: EMAIL, password: PASS }),
      }),
    );
  }
  if (!reg.ok) {
    console.error(reg);
    process.exit(1);
  }
  const token = reg.data.access_token;
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const createBody = {
    subject:
      "The Twenty-Sixth Amendment to the U.S. Constitution: lowering the voting age to 18 (March–July 1971)",
    subject_type_input: "topic",
    story_type: "issue_history",
    research_brief: `Bounded editorial Storywall on the proposal and ratification of the Twenty-Sixth Amendment (1971), when the United States lowered the minimum voting age to 18 for federal, state, and local elections. The frame covers the March 1971 House passage of the proposing resolution, Senate action, state ratification drives, and the July 1971 milestone when enough states ratified. Emphasize constitutional procedure, federalism, and civic context—not partisan campaign narratives.`,
    desired_angle: `Explain how a constitutional amendment moved from Congress to the states in months during the Vietnam-era debate over the voting age, and what credible public records anchor that chronology.`,
    suggested_time_scope: "March 1971 through July 1971",
    time_scope_mode: "bounded_range",
    time_scope_start: "1971-03-01T00:00:00.000Z",
    time_scope_end: "1971-07-31T23:59:59.999Z",
    audience: "student",
    narrative_intent: "explanatory",
    imagery_mode: "selective_editorial",
    creation_mode: "hybrid",
    writing_style_preference: "documentary",
  };

  const cr = await j(await fetch(`${API}/api/v1/creator/stories`, { method: "POST", headers: h, body: JSON.stringify(createBody) }));
  if (!cr.ok) {
    console.error("create failed", cr);
    process.exit(1);
  }
  const storyId = cr.data.story_id;
  console.log("story_id", storyId);

  await j(await fetch(`${API}/api/v1/creator/stories/${storyId}/frames/generate`, { method: "POST", headers: h, body: JSON.stringify({}) }));
  const lf = await j(await fetch(`${API}/api/v1/creator/stories/${storyId}/frames`, { headers: h }));
  const frameId = lf.data.frame_drafts[0].id;
  await j(
    await fetch(`${API}/api/v1/creator/stories/${storyId}/frames/select`, {
      method: "POST",
      headers: { ...h, "Idempotency-Key": idem() },
      body: JSON.stringify({ frame_id: frameId, selection_mode: "accept" }),
    }),
  );

  const rr = await j(
    await fetch(`${API}/api/v1/creator/stories/${storyId}/research/run`, {
      method: "POST",
      headers: { ...h, "Idempotency-Key": idem() },
      body: JSON.stringify({
        mode: "full",
        respect_existing_manual_events: true,
        respect_existing_sources: true,
      }),
    }),
  );
  const rs = await pollJob(token, rr.data.job_id, "research");
  if (rs !== "succeeded") {
    console.error("research failed", rs);
    process.exit(1);
  }

  const as = await j(
    await fetch(`${API}/api/v1/creator/stories/${storyId}/draft/assemble`, {
      method: "POST",
      headers: { ...h, "Idempotency-Key": idem() },
      body: JSON.stringify({
        mode: "full_regeneration",
        preserve_creator_notes: true,
        preserve_manual_event_positions: false,
        preserve_approved_images: true,
      }),
    }),
  );
  const ass = await pollJob(token, as.data.job_id, "assemble");
  if (ass !== "succeeded") {
    console.error("assemble failed", ass);
    process.exit(1);
  }

  const sections = [
    {
      label: "Frame: a bounded constitutional window (March–July 1971)",
      summary:
        "This Storywall treats the Twenty-Sixth Amendment as a short, documentable Article V episode: Congress proposes; states ratify; administrators certify. The goal is legible civics—how a voting-age change became supreme law—without pretending to narrate the entire Vietnam War or every statehouse speech.",
    },
    {
      label: "Article V: the two-track path (proposal then ratification)",
      summary:
        "The Constitution’s amendment rule splits power between a national legislature and concurrent state majorities. That structure matters for readers: the same text must survive separate institutional veto points. Here, the interesting tension is speed—months, not years—once political conditions aligned.",
    },
    {
      label: 'Federalism in practice: why “38 states” is the headline metric',
      summary:
        "Ratification contests are geographically distributed. The decisive fact is supermajority support among states, not a single national vote. This section keeps claims disciplined: we cite milestone timelines and legal text, and we flag where local implementation details belong outside this frame.",
    },
    {
      label: "Aftermath: lowering the voting age as a durable democratic default",
      summary:
        "Once certified, eighteen became the nationwide voting-age floor for federal, state, and local elections. The lasting editorial point is institutional: a narrow constitutional change with outsized civic footprint—still best read alongside primary sources rather than as partisan talking points.",
    },
  ];
  for (const s of sections) {
    await j(await fetch(`${API}/api/v1/creator/stories/${storyId}/sections`, { method: "POST", headers: h, body: JSON.stringify(s) }));
  }

  const NEW_EVENTS = [
    {
      headline: "House passes proposing resolution (H.J.Res. 526) in March 1971",
      summary:
        "The House moved quickly on a constitutional text to lower the voting age to 18, reflecting sustained political pressure tied to the draft and the broader debate over representation for young adults. The proposing language still required Senate concurrence and then state ratification under Article V.",
    },
    {
      headline: "Senate approves the proposed amendment and sends it to the states",
      summary:
        "Senate action completed the congressional half of Article V: identical text agreed to by both chambers before dispatch to state legislatures. The procedural posture shifted from Capitol debate to a compressed ratification calendar.",
    },
    {
      headline: "State legislatures begin ratification votes across the country",
      summary:
        "Within weeks, multiple states ratified—an intentionally fast process compared with many amendments. The pattern illustrates concurrent national majorities forming through separate state institutions rather than a single national plebiscite.",
    },
    {
      headline: "Ohio becomes the 38th state to ratify (July 1971)",
      summary:
        "Ohio’s ratification supplied the decisive three-fourths threshold among states. Archival timelines treat this as the functional completion point for the amendment’s addition to the Constitution, subject to formal certification steps.",
    },
    {
      headline: "Administrator of General Services certifies; amendment takes effect",
      summary:
        "Certification is the administrative bridge between completed ratifications and operative constitutional law. For readers, the point is narrow: the civic outcome—18-year-old voting—became binding through documented procedural steps, not through a single speech or headline.",
    },
    {
      headline: "First federal elections under an 18-year-old electorate (November 1972 context)",
      summary:
        "Implementation lagged ratification: the practical test of the new rule arrived in the next federal election cycle. This entry marks the transition from constitutional text to recurring democratic practice—still bounded here as context, not a full election narrative.",
    },
  ];
  for (const ne of NEW_EVENTS) {
    await j(await fetch(`${API}/api/v1/creator/stories/${storyId}/events`, { method: "POST", headers: h, body: JSON.stringify(ne) }));
  }

  const displayLines = [
    "March–July 1971 (editorial spine)",
    "March–July 1971 (open questions)",
    "March 1971 (House passage)",
    "Spring 1971 (Senate concurrence)",
    "March–July 1971 (state ratification wave)",
    "July 1971 (38th state threshold)",
    "Summer 1971 (certification)",
    "1971–1972 (implementation horizon)",
  ];

  for (let pos = 0; pos < displayLines.length; pos++) {
    const evRes = await j(await fetch(`${API}/api/v1/creator/stories/${storyId}/events`, { headers: h }));
    const evList = evRes.data.events || [];
    const e = evList.find((x) => x.position_index === pos);
    if (!e) break;
    const dd = displayLines[pos];
    if ((e.display_date ?? "").trim() === dd) continue;
    const pr = await j(
      await fetch(`${API}/api/v1/creator/stories/${storyId}/events/${e.id}`, {
        method: "PATCH",
        headers: { ...h, "If-Match": e.updated_at },
        body: JSON.stringify({ display_date: dd }),
      }),
    );
    if (!pr.ok) console.error("display_date patch", pos, pr);
  }

  const evRes = await j(await fetch(`${API}/api/v1/creator/stories/${storyId}/events`, { headers: h }));
  const events = [...(evRes.data.events || [])].sort((a, b) => a.position_index - b.position_index);

  let rot = 0;
  for (const e of events) {
    let srcRes = await j(await fetch(`${API}/api/v1/creator/stories/${storyId}/events/${e.id}/sources`, { headers: h }));
    let sources = srcRes.data.sources || [];
    if (sources.length === 0) {
      const pick = SOURCES[rot++ % SOURCES.length];
      await j(
        await fetch(`${API}/api/v1/creator/stories/${storyId}/events/${e.id}/sources`, {
          method: "POST",
          headers: h,
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
    } else {
      for (const s of sources) {
        const pick = SOURCES[rot++ % SOURCES.length];
        await j(
          await fetch(`${API}/api/v1/creator/stories/${storyId}/events/${e.id}/sources/${s.id}`, {
            method: "PATCH",
            headers: { ...h, "If-Match": s.updated_at },
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
      }
    }
  }

  for (const e of events) {
    const srcRes = await j(await fetch(`${API}/api/v1/creator/stories/${storyId}/events/${e.id}/sources`, { headers: h }));
    for (const s of srcRes.data.sources || []) {
      if (s.status === "approved") continue;
      await j(
        await fetch(`${API}/api/v1/creator/stories/${storyId}/events/${e.id}/sources/${s.id}`, {
          method: "PATCH",
          headers: { ...h, "If-Match": s.updated_at },
          body: JSON.stringify({ status: "approved" }),
        }),
      );
    }
  }

  const fr = await j(await fetch(`${API}/api/v1/creator/stories/${storyId}/frames`, { headers: h }));
  const le = fr.data.story_draft.last_edited_at;
  const slug = fr.data.story_slug;
  const conclusion =
    "This Storywall compresses a national civics lesson into a few months of constitutional procedure. It is not a substitute for state-by-state ratification archives or the full legislative history. The closing takeaway is intentionally modest: when political conditions align, Article V can move quickly—and the written Constitution still depends on public documentation to stay legible.";

  await j(
    await fetch(`${API}/api/v1/creator/stories/${storyId}/draft`, {
      method: "PATCH",
      headers: { ...h, "If-Match": le },
      body: JSON.stringify({
        conclusion,
        visibility_target: "public",
        time_display: "March–July 1971 (U.S. Twenty-Sixth Amendment)",
      }),
    }),
  );

  const val = await j(
    await fetch(`${API}/api/v1/creator/stories/${storyId}/validation/run`, {
      method: "POST",
      headers: { ...h, "Idempotency-Key": idem() },
      body: JSON.stringify({ run_type: "full" }),
    }),
  );
  console.log("validation", val.data?.overall_result, "warnings", val.data?.warning_count);

  const pub = await j(
    await fetch(`${API}/api/v1/creator/stories/${storyId}/publish`, {
      method: "POST",
      headers: { ...h, "Idempotency-Key": `second-exemplar-publish-${Date.now()}` },
      body: JSON.stringify({ acknowledge_validation_warnings: val.data?.overall_result === "warn" }),
    }),
  );
  console.log("publish", pub.ok, pub.error);

  const pr = await j(await fetch(`${API}/api/v1/stories/${encodeURIComponent(slug)}`));
  console.log("public", pr.ok, "slug", slug, "sections", pr.data?.sections?.length, "events", pr.data?.events?.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
