-- M1-T01: first DDL slice after baseline — migration plan §15 item 1 (extension setup).
-- Enables gen_random_uuid() for UUID primary keys aligned with API contracts (UUID fields).
-- Editorial tables are deferred to M1-T02+ per storywall_ticket_ready_implementation_backlog.md.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
