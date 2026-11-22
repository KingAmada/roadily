/* Optional first-party data integration; enable only for the dedicated Roadily project. */
function createRoadilySupabase(client) {
  const checked = result => {
    if (result.error) throw Error(result.error.message);
    return result.data;
  };
  const profile = u => u ? { id: u.id, phone: '+' + String(u.phone || '').replace(/^\+/, ''), display_name: String(u.user_metadata?.display_name || 'Roadily user').slice(0, 80) } : null;
  const phoneOf = value => {
    let s = String(value || '').replace(/[\s()-]/g, '');
    if (/^0\d{10}$/.test(s)) s = '+234' + s.slice(1);
    else if (/^234\d{10}$/.test(s)) s = '+' + s;
    if (!/^\+[1-9]\d{7,14}$/.test(s)) throw Error('Enter a valid phone number including the country code.');
    return s;
  };
  const phoneAccount = u => {
    if (!u?.phone || u.is_anonymous) throw Error('Use a Roadily phone and password account.');
    return u;
  };
  const user = async () => {
    if (!checked(await client.auth.getSession()).session) return null;
    return phoneAccount(checked(await client.auth.getUser()).user);
  };
  return async function api(path, options = {}) {
    const method = options.method || 'GET';
    const b = options.body ? JSON.parse(options.body) : {};
    if (path === '/me' && method === 'GET') return { user: profile(await user()) };
    if (path === '/login' && method === 'POST') {
      return { user: profile(phoneAccount(checked(await client.auth.signInWithPassword({ phone: phoneOf(b.phone), password: b.password })).user)) };
    }
    if (path === '/register' && method === 'POST') {
      const phone = phoneOf(b.phone);
      const name = String(b.name || '').trim();
      if (!name || name.length > 80) throw Error('Enter a name up to 80 characters.');
      if (typeof b.password !== 'string' || b.password.length < 8) throw Error('Use a password of at least 8 characters.');
      const data = checked(await client.auth.signUp({phone, password: b.password, options: { data: { display_name: name } }}));
      if (!data.session) throw Error('Roadily sign-up did not finish. If you already have an account, sign in.');
      return { user: profile(phoneAccount(data.user)) };
    }
    if (path === '/logout' && method === 'POST') { checked(await client.auth.signOut({scope:'local'})); return {}; }
    if (path === '/wallet' && method === 'GET') return {available_balance: null, payout_account: null};
    if (path === '/requests' && method === 'GET') return {requests: []};
    if (path === '/vehicles' || /^\/vehicles\/\d+\/settings$/.test(path)) {
      const u = await user();
      if (!u) throw Error('Sign in first.');
      const fields = 'id,plate,kind,qr_token,accept_pay,open_chat,open_social,show_name';
      const table = () => client.from('roadily_vehicles');
      if (path === '/vehicles' && method === 'GET') {
        return { vehicles: checked(await table().select(fields).eq('owner_id', u.id).order('id')) };
      }
      if (path === '/vehicles' && method === 'POST') {
        const plate = String(b.plate || '').trim().toUpperCase(), kind = String(b.kind || '').trim();
        if (!/^[A-Z0-9]{1,7}$/.test(plate) || !kind || kind.length > 32) throw Error('Enter a valid plate and vehicle type.');
        return { vehicle: checked(await table().insert({ owner_id:u.id, plate, kind }).select(fields).single()) };
      }
      if (path !== '/vehicles' && method === 'POST') {
        if (b.accept_pay || b.open_chat || b.open_social || b.show_name) throw Error('Public discovery and payments are not enabled yet.');
        const id = path.split('/')[2];
        return { vehicle: checked(await table().update({open_chat:false,open_social:false,show_name:false,accept_pay:false}).eq('id',id).eq('owner_id',u.id).select(fields).single()) };
      }
    }
    throw Error('This feature is not connected yet.');
  };
}
if (typeof module === 'object') module.exports = {createRoadilySupabase};
