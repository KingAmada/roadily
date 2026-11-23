// Public configuration only. NEVER put bank/Peygo secret keys here.
// Point this to your separately hosted Roadily API, e.g. https://api.yourdomain.tld
window.ROADILY_API_BASE = '';
// Public HTTPS URL for scanned vehicle profiles on the backend.
window.ROADILY_PUBLIC_ORIGIN = '';

// Dedicated Roadily backend / private vehicle pilot. Leave off until hosted
// signup, revocation and record isolation smoke checks pass.
window.ROADILY_PRIVATE_ACCOUNTS = Object.freeze({ enabled: true });
