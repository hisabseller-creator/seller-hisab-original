-- Forward only; existing article bodies and URLs remain valid.
ALTER TABLE blog_posts ADD locale_metadata_json text NOT NULL DEFAULT '{}';
