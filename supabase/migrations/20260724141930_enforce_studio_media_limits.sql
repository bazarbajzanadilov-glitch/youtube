-- Uploaded admin images are converted client-side to WebP before they reach
-- Storage. Keep the bucket limit aligned with the application invariant so a
-- modified client cannot persist an oversized asset.
update storage.buckets
set public = false,
    file_size_limit = 204800,
    allowed_mime_types = array['image/webp', 'image/svg+xml']::text[]
where id = 'studio-media';

create index if not exists site_settings_updated_by_idx
  on public.site_settings (updated_by);
