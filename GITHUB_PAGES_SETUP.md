# Roadily GitHub Pages deployment

Project base URL (unless a custom domain is configured): https://kingamada.github.io/roadily/

## Publishing
In Settings → Pages, select Deploy from a branch → main / (root) after merging this PR. If you use a custom domain, update sitemap.xml and the absolute social preview URLs to that HTTPS domain.

## Important backend limitation
GitHub Pages only publishes static files. The frontend calls `/api/*` and cannot register, sign in, access vehicles, or chat until a separate backend is deployed. Configure `window.ROADILY_API_BASE` to your backend origin before app initialization and allow appropriate CORS/credentials securely. Never put payment secrets in GitHub Pages.

The QR generator operates in the browser, but the destination /v/<token> must exist on the public backend; configure `roadily-public-origin` to that public backend URL before distributing stickers. Do not print QR stickers that point to github.io unless the public route actually resolves.

## SEO
GitHub Pages serves actual `.html` files. This branch updates links to include that extension and makes asset paths relative to /roadily/. After publishing verify robots.txt, sitemap.xml, icons, share previews, and indexed pages in Search Console. Private vehicle and account records should not be indexed. Sitemap assumes project Pages URL, so change it if you move to a domain.

## Dedicated Supabase connection: private vehicles only

The public browser URL and publishable key in `roadily.config.js` point to
Roadily's own project. Never add a secret or service-role key here.
The hosted `roadily_core` migration creates only the private vehicle table;
it does not handle payment, balances, withdrawals, messages or public QR lookup.

The site remains unchanged while `ROADILY_SUPABASE.enabled` is false. To
test in a local/private preview, configure an approved SMS provider under
[Authentication → Phone](https://supabase.com/dashboard/project/asazccxbrlflreeamokl/auth/providers),
enable phone sign-in and keep phone confirmation on. Set `enabled: true` only
in the preview configuration and leave `ROADILY_API_BASE` blank. Test SMS
verification, reload, sign-out, and separate vehicle lists for two accounts
before enabling on GitHub Pages. The existing Roadily API takes precedence
when configured; its sessions are not interchangeable with Supabase sessions.
