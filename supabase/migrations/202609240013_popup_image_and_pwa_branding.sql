-- iMersOrder r27: popup image support + branding cache-busting metadata.
-- Existing installations keep their current popup settings and gain image_url.

update public.business_settings
set value = value || jsonb_build_object('image_url', coalesce(value->>'image_url',''))
where key = 'promo_popup';

-- Ensure the public branding RPC remains available for PWA/login/public surfaces.
-- The application derives the cache-busting version from the uploaded asset URL.
