-- SellerHisab F13: all-surface SEO + content distribution.
-- Additive only. Apply exactly once after guarded local validation.

ALTER TABLE blog_posts ADD COLUMN category TEXT;
ALTER TABLE blog_posts ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE blog_posts ADD COLUMN keywords_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE blog_posts ADD COLUMN image_width INTEGER;
ALTER TABLE blog_posts ADD COLUMN image_height INTEGER;
ALTER TABLE blog_posts ADD COLUMN image_caption TEXT NOT NULL DEFAULT '';
ALTER TABLE blog_posts ADD COLUMN image_credit TEXT NOT NULL DEFAULT '';
ALTER TABLE blog_posts ADD COLUMN content_type TEXT NOT NULL DEFAULT 'blog';
ALTER TABLE blog_posts ADD COLUMN seo_title TEXT NOT NULL DEFAULT '';
ALTER TABLE blog_posts ADD COLUMN seo_description TEXT NOT NULL DEFAULT '';
ALTER TABLE blog_posts ADD COLUMN canonical_url TEXT NOT NULL DEFAULT '';
ALTER TABLE blog_posts ADD COLUMN indexable INTEGER NOT NULL DEFAULT 1;
ALTER TABLE blog_posts ADD COLUMN follow_links INTEGER NOT NULL DEFAULT 1;
ALTER TABLE blog_posts ADD COLUMN discover_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE blog_posts ADD COLUMN news_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE blog_posts ADD COLUMN preferred_source_cta INTEGER NOT NULL DEFAULT 1;
ALTER TABLE blog_posts ADD COLUMN author_name TEXT NOT NULL DEFAULT 'SellerHisab Research Team';
ALTER TABLE blog_posts ADD COLUMN author_url TEXT NOT NULL DEFAULT '/authors/sellerhisab-research';
ALTER TABLE blog_posts ADD COLUMN reviewed_at TEXT;
ALTER TABLE blog_posts ADD COLUMN source_urls_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE blog_posts ADD COLUMN related_slugs_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE blog_posts ADD COLUMN locale_alternates_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE blog_posts ADD COLUMN video_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE blog_posts ADD COLUMN video_title TEXT NOT NULL DEFAULT '';
ALTER TABLE blog_posts ADD COLUMN video_description TEXT NOT NULL DEFAULT '';
ALTER TABLE blog_posts ADD COLUMN video_thumbnail_url TEXT NOT NULL DEFAULT '';
ALTER TABLE blog_posts ADD COLUMN video_embed_url TEXT NOT NULL DEFAULT '';
ALTER TABLE blog_posts ADD COLUMN video_content_url TEXT NOT NULL DEFAULT '';
ALTER TABLE blog_posts ADD COLUMN video_duration_seconds INTEGER;
ALTER TABLE blog_posts ADD COLUMN video_upload_date TEXT;

CREATE INDEX blog_posts_content_type_published_idx
  ON blog_posts(content_type, status, published_at);

CREATE INDEX blog_posts_indexable_published_idx
  ON blog_posts(indexable, status, published_at);

CREATE TABLE seo_redirects (
  id TEXT PRIMARY KEY NOT NULL,
  from_path TEXT NOT NULL,
  to_path TEXT NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 308,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX seo_redirects_from_path_unique ON seo_redirects(from_path);
CREATE INDEX seo_redirects_active_updated_idx ON seo_redirects(active, updated_at);
