# Shared implementation contract

Stack: Next.js App Router, React, TypeScript, Tailwind, @supabase/ssr, Supabase JS. PostgreSQL migrations are also executed in PGlite for an isolated, explicit DEMO. Production uses Supabase Auth and PostgreSQL RPC with the user's JWT, never service role in application.

Roles: student, supervisor, university, admin. Experience states: declared, pending_validation, changes_requested, rejected, verified, revoked. All UUIDs. DEMO seed fictional only.

RPCs: nexus_snapshot() -> jsonb; nexus_action(action text, payload jsonb) -> jsonb; nexus_public_skillpass(p_slug text) -> jsonb/null; nexus_public_credential(p_id uuid) -> jsonb/null.

Snapshot arrays: profiles, organizations, organization_members, skills, challenges, challenge_skills, challenge_participants, experiences, experience_skills, evidence, validation_requests, validations, credentials, credential_skills, activity_events. profile is current profile. Each row snake_case. Experience skill references are separate arrays. Credential skill fields skill_id, level. RLS-scoped reads. Public functions return a narrowed snapshot plus profile and credential as appropriate, exposing only opted-in verified/revoked records, public evidence, no emails, private comments or audit logs.

Actions and payloads:
- update_profile: full_name, headline, location, university, career, bio, interests, semester, is_public (boolean); slug created automatically from UUID, immutable.
- join_challenge: challenge_id.
- create_experience: challenge_id (optional), organization_id, title, description, responsibilities, deliverables, start_date, end_date, hours (number), skill_ids (UUID[]). Returns {id}.
- update_experience: id and same fields as create; only own editable states, clears rejected/changes_requested back to declared. No deletion.
- add_evidence: experience_id, title, description, url (https only), kind (url/repository/document/image/presentation/result), is_public boolean.
- request_validation: experience_id. Requires nonempty evidence and skills. Reviewer is an organization supervisor, never oneself.
- validate_experience: experience_id, decision (approve/request_changes/reject), comment, rating (1..5), verified_hours (0..declared hours). Approval atomically creates validation, credential, credential_skills (rating as each level), updates state and emits audit events. No self validation. Organization-scoped supervisor or admin.
- revoke_credential: credential_id, reason. Admin only, atomic revoke and experience status revoked; metrics exclude revoked.
- create_organization: name, type (company/university/nonprofit/government/aindev).
- create_skill: name, category (technical/business/human).
- create_challenge: organization_id,title,description,problem,expected_outcome,modality,start_date,end_date,skill_ids. Admin only (or scoped supervisor if safe).
- set_member: user_id, organization_id, role (supervisor/university/student). Admin only. Assign corresponding profile role unless admin.

Demo constants: student 10000000-0000-4000-8000-000000000001, supervisor ...0002, university ...0003, admin ...0004. Demo starts with one verified experience/credential and one available challenge for full flow. Another organization/user in DB tests verifies isolation.

Frontend API:
GET /api/state -> {mode:'demo'|'supabase', snapshot: Snapshot, demoId?:string}
POST /api/actions body {action,payload} -> {result}; error {error} with 400/401/403. Server validates action payloads.
POST /api/auth {intent:'login'|'signup',email,password,full_name?} or {intent:'demo',role} or {intent:'logout'} -> {ok,message?}; demo role switch persists current isolated demo database. Real signup always student.
GET /api/public?slug=...&demo=... or ?credential=UUID&demo=... -> {snapshot,mode,demoId?}. Anonymous curated DB RPC.

Routes: /, /demo, /login, /signup, /dashboard, /profile, /challenges, /challenges/[id], /experiences/new, /experiences/[id], /review, /admin, /skillpass/[slug], /verify/[id]. Public links include ?demo=demoId only in demo. All dashboards show explicit DEMO banner. API session uses HttpOnly signed random demo identity; demo ID in share URLs is not an authentication credential. Share URL origin NEXT_PUBLIC_APP_URL or window.location.origin. Public UI displays QR via qrcode package and link copy. No file uploads. No fake traction or job guarantees. Spanish UI.

Final schema details supersede the initial design sketch above: credentials persist `active` or `revoked`; the public UI translates active to VERIFIED. Validations store `reviewer_id` and derive organization through the experience. Activity events store `action` and `details`. Profile semester is nullable integer. student_skills is a security-invoker view derived from active credentials. See migrations and docs/DATA_MODEL.md for the normative implemented model.
