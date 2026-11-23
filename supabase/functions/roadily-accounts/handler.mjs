import { timingSafeEqual } from 'node:crypto';

const origin = 'https://kingamada.github.io';
const enc = new TextEncoder();
const validToken = /^[0-9a-f]{64}$/;
const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2,'0')).join('');
const fromHex = s => Uint8Array.from(s.match(/../g), b => parseInt(b,16));
const random = n => hex(crypto.getRandomValues(new Uint8Array(n)));
const digest = async s => hex(await crypto.subtle.digest('SHA-256',enc.encode(s)));
export async function hashPassword(password,salt) {
  const key=await crypto.subtle.importKey('raw', enc.encode(password),'PBKDF2',false,['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:fromHex(salt),iterations:600000},key,256));
}
export function number(raw) {
  let s=String(raw??'').replace(/[\s()-]/g,'');
  if (/^0\d{10}$/.test(s)) s='+234'+s.slice(1);
  else if (/^234\d{10}$/.test(s)) s='+'+s;
  return /^\+[1-9]\d{7,14}$/.test(s)?s:null;
}
const same = (a,b) => validToken.test(a)&&validToken.test(b)&&timingSafeEqual(fromHex(a),fromHex(b));
async function readJson(req) {
  if ((req.headers.get('content-type')||'').split(';')[0]!=='application/json' || !req.body) return null;
  const bytes=new Uint8Array(2048);
  let offset=0;
  const reader=req.body.getReader();
  try {
    for (;;) {
      const {done,value}=await reader.read();
      if(done)break;
      if(offset+value.length>bytes.length){await reader.cancel();return null;}
      bytes.set(value,offset);offset+=value.length;
    }
    const result=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,offset)));
    return result&&typeof result==='object'&&!Array.isArray(result)?result:null;
  } catch {return null;} finally {reader.releaseLock();}
}
export function makeHandler({rpc}) {
 return async req => {
  const headers=new Headers({'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','Vary':'Origin'});
  if(req.headers.get('origin')===origin) {
    headers.set('Access-Control-Allow-Origin',origin);
    headers.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers','Content-Type, X-Roadily-Session');
    headers.set('Access-Control-Max-Age','300');
  }
  const response=(body,status=200)=>new Response(body===null?null:JSON.stringify(body),{headers,status});
  if(req.headers.get('origin')!==origin)return response({error:'Origin not allowed.'},403);
  if(req.method==='OPTIONS')return response(null,204);
  const path=new URL(req.url).pathname.replace(/^\/(?:functions\/v1\/)?roadily-accounts(?=\/|$)/,'');
  const method=req.method;
  if(path==='/health'&&method==='GET')return response({service:'roadily-private-accounts-v1'});
  try {
   if ((path==='/register'||path==='/login')&&method==='POST') {
    const b=await readJson(req);const phone=typeof b?.phone==='string'?number(b.phone):null;
    const password=b?.password, name=typeof b?.name==='string'?b.name.trim():'';
    const signup=path==='/register';
    if(!phone||typeof password!=='string'||enc.encode(password).length>(128)||password.length<(signup?10:1)|| (signup&&(!name||name.length>80))) {
      return response({error:signup?'Enter a valid phone number, name, and password of 10 or more characters.':'Enter your phone number and password.'},400);
    }
    if(!await rpc('limits',{action:signup?'register':'login',identity:await digest(phone)})) {
      headers.set('Retry-After','600');
      return response({error:'Too many attempts. Try again shortly.'},429);
    }
    let user;
    const token=random(32),token_hash=await digest(token);
    if(signup){
      const salt=random(16);
      const password_hash=await hashPassword(password,salt);
      user=await rpc('register',{phone,display_name:name,salt,password_hash,token_hash});
      if(!user)return response({error:'This phone number cannot be registered. Sign in if you already have an account.'},409);
    } else {
      const result=await rpc('lookup',{phone});
      const actual=await hashPassword(password,result?.salt||'0370b8509e7bd164c6437dd84cd2bb1d');
      const match=same(actual,result?.password_hash||'0'.repeat(64));
      if(!result||!match)return response({error:'Phone number or password is incorrect.'},401);
      user=await rpc('session',{account_id:result.id,token_hash});
    }
    return response({token,user},signup?201:200);
   }
   const token=req.headers.get('x-roadily-session')||'';
   if(!validToken.test(token))return response({error:'Sign in first.'},401);
   const token_hash=await digest(token);
   if(path==='/logout'&&method==='POST') {
    await rpc('logout',{token_hash});return response({ok:true});
   }
   if(path==='/me'&&method==='GET'){
    const user=await rpc('me',{token_hash});return user?response({user}):response({error:'Sign in first.'},401);
   }
   if(path==='/vehicles'&&method==='GET'){
    const vehicles=await rpc('list',{token_hash});return vehicles?response({vehicles}):response({error:'Sign in first.'},401);
   }
   if(path==='/vehicles'&&method==='POST'){
    const body=await readJson(req);
    const plate=typeof body?.plate==='string'?body.plate.trim().toUpperCase():'';
    const kind=typeof body?.kind==='string'?body.kind.trim():'';
    if(!/^[A-Z0-9]{1,7}$/.test(plate)||!kind||kind.length>32)return response({error:'Enter a valid plate and vehicle type.'},400);
    const vehicle=await rpc('save',{token_hash,plate,kind});
    if(!vehicle)return response({error:'Sign in first.'},401);
    if(vehicle.capacity)return response({error:'This account has reached the private vehicle limit.'},409);
    if(vehicle.duplicate)return response({error:'You already saved this plate.'},409);
    return response({vehicle},201);
   }
   return response({error:'Not available in this private account pilot.'},404);
  } catch {return response({error:'Roadily is temporarily unavailable. Try again.'},503);}
 };
}
