# Documentation governance

Status: authoritative
Effective: 25 November 2026

This file defines how source conflicts are resolved across the estimator repository.

## Latest-approved-change rule

The latest approved change wins over older requirements, notes, screenshots, fixtures and implementation history. “Latest” means the newest instruction that is both identifiable and approved through a date, version, explicit supersession statement or direct owner decision. A newer file modification time by itself is not approval.

Apply this order:

1. The latest explicit owner decision or approved source update for the affected subject.
2. The current versioned rules in `data/simplified-calculator-rules.json` and their generated runtime files.
3. [Current system](CURRENT-SYSTEM.md) and the active maintenance/feature guides linked from [Documentation](README.md).
4. Older non-document artifacts retained strictly for migration, testing or traceability.

Within the same level, the later approved effective date/version wins. A narrow later decision supersedes only the subject it changes; unrelated current rules remain in force.

## Conflict handling

- Do not merge contradictory values, average them or preserve an old behavior merely because tests or notes still mention it.
- Do not turn a draft, example, synthetic fixture or proposed amount into an approved rule.
- Record the superseded rule and its replacement in the affected current guide.
- Update source, generated runtime data, tests and current documentation together.
- If approval, scope or effective order is unclear, leave the value unavailable and record the exact decision needed before implementation.
- Git history remains the archive; superseded Markdown should be removed from the active tree.

## Documentation classes

- **Authoritative:** this policy and `CURRENT-SYSTEM.md`.
- **Operational:** maintenance, deployment, testing and current feature guides. These explain how to operate the authoritative system.
Every Markdown file must state or inherit one of the two current classes above. New dated test evidence belongs in the concise current release record or Git history; it should not be copied into multiple guides.

## Required update checklist

For every approved system change:

1. Identify the affected rule and its previous source.
2. Confirm approval, version/effective date and whether the change is narrow or system-wide.
3. Update the canonical rules and implementation.
4. Regenerate compiled assets when required.
5. Update `CURRENT-SYSTEM.md` and only the operational guides affected by the change.
6. Replace contradictory wording and delete superseded Markdown; do not append another competing “latest” section.
7. Update tests and run the relevant release checks.
8. Deploy, verify the exact deployed version and record one concise release result.

## Current source set

- Latest workbook: <https://docs.google.com/spreadsheets/d/1vUDbKYWQPTaVIvJEYGzY5pVDCt0n369Ywel0tPk9M7s/edit>
- Latest change document: <https://docs.google.com/document/d/1ZR-7dAayjtmejgo6GQrtJeI3FSj3kGjNeq_7zIuEPMA/edit>
- Implemented rule version: `simplified-2026-11-25-v7-paid-advertising-coming-soon`
