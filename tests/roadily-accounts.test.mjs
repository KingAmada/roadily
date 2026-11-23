import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, makeHandler, number } from '../supabase/functions/roadily-accounts/handler.mjs';

export function request(handler,path,body,token,origin='https://kingamada.github.io') {
 return handler(new Request('https://service.test/functions/v1/roadily-accounts'+path,{
  method:body===undefined?'GET':'POST',
  headers:{Origin:origin,...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{'X-Roadily-Session':token}:{})},
  body:body===undefined?undefined:JSON.stringify(body)
 }));
}
test('KDF matches independent PBKDF2 test vector; salt changes the hash',async()=>{
 assert.equal(number('0803 123 4567'),'+2348031234567');
 const {pbkdf2Sync}=await import('node:crypto');
 const password='test-password-45';
 const salt='ab'.repeat(16);
 const expected=pbkdf2Sync(password,Buffer.from(salt,'hex'),600000,32,'sha256').toString('hex');
 assert.equal(await hashPassword(password,salt),expected);
 assert.notEqual(await hashPassword(password,'bc'.repeat(16)),expected);
});
test('unexpected origin, invalid credentials, oversized bodies and exhausted limits do not reach record writes',async()=>{
 let calls=[];
 const handler=makeHandler({rpc:async (op,p)=>{calls.push([op,p]);return false;}});
 const denied=await request(handler,'/register',{phone:'08031234567',password:'test-password-45',name:'A'},null,'https://elsewhere.invalid');
 assert.equal(denied.status,403);
 assert.equal(denied.headers.get('access-control-allow-origin'),null);
 assert.equal((await request(handler,'/vehicles')).status,401);
 assert.equal((await request(handler,'/login',{phone:'08031234567',password:'a'.repeat(3000)})).status,400);
 assert.deepEqual(calls,[]);
 assert.equal((await request(handler,'/login',{phone:'08031234567',password:'test-password-45'})).status,429);
 assert.deepEqual(calls.map(x=>x[0]),['limits']);
});
