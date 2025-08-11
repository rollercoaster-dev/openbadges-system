CI Failures Review — 2025-08-10

Summary
- Scope: 4 open PRs with failing checks.
- Infra: No global CI outage observed; failures are policy- and code-specific.
- Shared themes: PR title format enforcement, TypeScript strictness issues, one build import error, and a coverage gate.

Global/Policy Signals
- PR title policy: Conventional commit title check failing on #21, #20, #19. Valid on #18.
- Coverage gate: Enforces 80% global thresholds (lines, functions, statements, branches). Only #19 fails this gate.

PR #21 — Improve oauth flow robustness
- Link: https://github.com/rollercoaster-dev/openbadges-system/pull/21
- Failing checks:
  - CI: Lint and Type Check — FAILURE
    - Key error: src/server/services/user.ts(627,12) TS2365: Operator '>' cannot be applied to types 'void' and 'number'.
    - Run/job: actions/runs/16853993597 job/47744309556
  - PR Validation: validate — FAILURE
    - Mirrors the same TS error during type-check.
    - Run/job: actions/runs/16854006328 job/47744337211
  - PR Validation: pr-title-check — FAILURE
    - Reason: PR title "Improve oauth flow robustness" does not match conventional commit pattern (e.g., feat(scope): desc).
    - Run/job: actions/runs/16854006328 job/47744337210
- Passing: CI Test, Security Scan, etc.
- Assessment: Branch-specific TypeScript error + global title policy.

PR #20 — Create and switch to new branch
- Link: https://github.com/rollercoaster-dev/openbadges-system/pull/20
- Failing checks:
  - CI: Lint and Type Check — FAILURE
    - Representative errors:
      - src/client/pages/verify/[id].vue(87,18) TS2322: IRI | {...} not assignable to string | undefined.
      - src/client/pages/verify/[id].vue(318,3) TS2305: '@heroicons/vue/24/outline' has no exported member 'ExternalLinkIcon'.
      - src/client/services/openbadges.ts(382,36) TS2339: Property 'name' does not exist on type 'IRI | Profile'.
      - src/server/routes/badges.ts: Response status overload expects ContentfulStatusCode; numeric provided.
      - multiple TS2322 errors in src/test/integration/verification.test.ts due to branded types (IRI, DateTime).
    - Run/job: actions/runs/16853978561 job/47744278160
  - CI: Build — FAILURE
    - Error: "ExternalLinkIcon" is not exported by @heroicons/vue/24/outline (at src/client/pages/verify/[id].vue line 110).
    - Run/job: actions/runs/16853978561 job/47744278164
  - PR Validation: validate — FAILURE
    - Mirrors type-check errors above.
    - Run/job: actions/runs/16853994101 job/47744310496
  - PR Validation: pr-title-check — FAILURE
    - Reason: PR title "Create and switch to new branch" not in conventional commit format.
    - Run/job: actions/runs/16853994101 job/47744310502
- Assessment: Branch-specific TS and import issues + global title policy.

PR #19 — Feature/expand server tests coverage
- Link: https://github.com/rollercoaster-dev/openbadges-system/pull/19
- Failing checks:
  - CI: Test — FAILURE (coverage gate)
    - Tests: All tests passed (98/98), but coverage gate failed.
    - Coverage: lines 10.93%, functions 55.04%, statements 10.93%, branches 65.44% (threshold 80% each).
    - Errors:
      - ERROR: Coverage for lines (10.93%) does not meet global threshold (80%)
      - ERROR: Coverage for functions (55.04%) does not meet global threshold (80%)
      - ERROR: Coverage for statements (10.93%) does not meet global threshold (80%)
      - ERROR: Coverage for branches (65.44%) does not meet global threshold (80%)
    - Run/job: actions/runs/16853956037 job/47744227505
  - PR Validation: pr-title-check — FAILURE
    - Reason: PR title does not match conventional commit format.
    - Runs/jobs: actions/runs/16853956044 job/47744168081; actions/runs/16853975907 job/47744272873
- Assessment: Not a global CI failure; failing due to repo-wide coverage policy + title policy.

PR #18 — feat: implement OB2 completeness and verify flow
- Link: https://github.com/rollercoaster-dev/openbadges-system/pull/18
- Failing checks:
  - CI: Lint and Type Check — FAILURE
    - Error: src/client/pages/verify/[id].vue(335,27) TS2339: Property 'id' does not exist on union incl. Record<never, never>.
    - Run/job: actions/runs/16853928800 job/47744168087
  - PR Validation: validate — FAILURE
    - Mirrors same TS2339 error above.
    - Run/job: actions/runs/16853953162 job/47744221184
  - CI: Test — FAILURE
    - Summary: Multiple failing server endpoint tests; indicative final error in logs:
      - Error: Module "bun:sqlite" has been externalized for browser compatibility. Cannot access "bun:sqlite.Database" in client code.
    - Run/job: actions/runs/16853928800 job/47744168091
- Assessment: Branch-specific type-check and test failures; bun:sqlite error likely due to unintended client-side import or environment mismatch during tests.

Are these failures global?
- No CI outage: Other checks (build/test/lint) succeed on some PRs, indicating workflows are healthy.
- Policy failures: PR title convention enforcement is consistent and expected (affects #21, #20, #19).
- Code-level issues: TypeScript and import errors are branch-specific changes (verify/[id].vue, server routes, user service). Build failure stems from a missing export in @heroicons/vue (ExternalLinkIcon).
- Coverage gate: Global repo policy set at 80% is causing #19 to fail despite passing tests. Other PRs did not hit this gate in their runs, so not an infra issue.

Recommended Next Actions
- Titles: Update PR titles to conventional commit format (e.g., feat(auth): ...; fix(server): ...).
- Type errors:
  - #21: Fix server/services/user.ts comparing a void-returning call with a number.
  - #18/#20: Resolve types in verify/[id].vue (avoid accessing .id on unions incl. Record<never, never>; refine types/guards). Remove or replace ExternalLinkIcon with a valid export.
  - #20: Adjust server badges route JSON responses to use proper ContentfulStatusCode overloads.
  - #20 tests: Update branded types usage (IRI, DateTime) in integration tests to construct proper branded values.
- Build: Replace ExternalLinkIcon with an available icon or upgrade heroicons and update imports accordingly.
- Coverage (#19): Add tests or adjust what is included in coverage (e.g., exclude client UI if appropriate) to meet 80% thresholds, or align thresholds with project goals.

