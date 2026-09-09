# Rollback Runbook

Application rollback and database rollback are separate decisions.

- Prefer rolling the Worker back to the previous known-good version when application behavior regresses and the new schema is backward compatible.
- Do not delete or edit an already-applied migration.
- Migration `0015` is additive; if a code rollback is required, leave additive schema in place unless a separately reviewed forward migration is required.
- For corrupt data, stop writes first, preserve evidence, and use the backup/restore runbook rather than ad-hoc SQL deletion.
- Record incident time, affected tenants/data families, Worker version, migration state and corrective action.
