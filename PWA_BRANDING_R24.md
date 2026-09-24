# iMersOrder r24 — Dynamic PWA Branding

PWA manifest, favicon, Apple touch icon, and installable PWA icons now resolve the currently uploaded business logo through the public branding RPC.

- No manual image URL input is required.
- Uploaded branding remains stored in Supabase Storage.
- If a custom favicon is selected, PWA icon resolution follows the same favicon preference.
- Service worker cache version is bumped so the old shell is retired on activation.
- `/icon.png` remains only as a fallback when no branding is available.
