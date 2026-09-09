import { getD1 } from "./runtime";

export type SeoRedirectRecord = {
  id: string;
  fromPath: string;
  toPath: string;
  statusCode: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export async function listSeoRedirects(): Promise<SeoRedirectRecord[]> {
  const result = await getD1().prepare(
    `SELECT id, from_path AS fromPath, to_path AS toPath, status_code AS statusCode,
            active, created_at AS createdAt, updated_at AS updatedAt
     FROM seo_redirects ORDER BY updated_at DESC LIMIT 500`,
  ).all<Omit<SeoRedirectRecord, "active"> & { active: number }>();
  return result.results.map((row) => ({ ...row, active: Boolean(row.active) }));
}

export async function saveSeoRedirect(input: { id?: string; fromPath: string; toPath: string; statusCode: 301 | 302 | 307 | 308; active: boolean }, userId: string) {
  const db = getD1();
  const now = new Date().toISOString();
  const id = input.id ?? `redir_${crypto.randomUUID()}`;
  await db.prepare(
    `INSERT INTO seo_redirects (id, from_path, to_path, status_code, active, created_at, updated_at, updated_by)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6, ?7)
     ON CONFLICT(from_path) DO UPDATE SET
       to_path = excluded.to_path,
       status_code = excluded.status_code,
       active = excluded.active,
       updated_at = excluded.updated_at,
       updated_by = excluded.updated_by`,
  ).bind(id, input.fromPath, input.toPath, input.statusCode, input.active ? 1 : 0, now, userId).run();
  return id;
}

export async function deleteSeoRedirect(id: string) {
  await getD1().prepare("DELETE FROM seo_redirects WHERE id = ?1").bind(id).run();
}
