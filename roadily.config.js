// Public configuration only. NEVER put bank/Peygo secret keys here.
// Point this to your separately hosted Roadily API, e.g. https://api.yourdomain.tld
window.ROADILY_API_BASE = '';
// Public HTTPS URL for scanned vehicle profiles on the backend.
window.ROADILY_PUBLIC_ORIGIN = '';

// Dedicated Roadily Supabase project. These browser values are public.
// Enable only after hosted phone confirmation and an SMS provider are tested.
// Don't enable alongside a separate Roadily API (sessions are not interchangeable).
window.ROADILY_SUPABASE = Object.freeze({
  enabled: false,
  url: 'https://asazccxbrlflreeamokl.supabase.co',
  publishableKey: 'sb_publishable_f6GvtYDfwrLYn8Lbh7oeHA_h5rq_ug9'
});
