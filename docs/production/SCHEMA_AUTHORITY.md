# Production schema authority

Ordered immutable SQL in drizzle/*.sql is the DDL authority. db/schema.ts mirrors all relational definitions. db/sql-governance.json explicitly records SQL-only triggers and CHECK constraints. Never use historical SQL as a repair script. Forward changes require reviewed additive migration, matching schema model and schema:check. Test replay uses a disposable in-memory database, never a production database.

The inherited drizzle/meta journal stops at 0008. Automatic db:generate is deliberately disabled to prevent destructive generation against stale snapshots; this is governance, not a new database migration. schema:check verifies table/column/index parity and populated 0014→latest upgrade. Update SQL manifest only after reviewing trigger/constraint changes.

Password v2 uses native node:crypto PBKDF2-SHA256 with 600,000 iterations and a 128-bit salt. Legacy 100,000-round hashes remain readable; successful password login upgrades by compare-and-swap. No password reset is required for existing users. Runtime smoke/load validation is a release gate. References: https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/ and https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html .
