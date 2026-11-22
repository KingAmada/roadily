const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createRoadilySupabase}=require('../roadily-supabase.js');
test('signup normalizes phone, discards bank data, and waits for verification',async()=>{
 const uid='verified-user'; let received;
 const api=createRoadilySupabase({auth:{
  signUp:async input=>{received=input;return {data:{user:{id:uid},session:null}}},
  verifyOtp:async input=>{assert.deepEqual(input,{phone:'+2348031234567',token:'123456',type:'sms'});return {data:{user:{id:uid,phone:'2348031234567',phone_confirmed_at:'date'}}}}
 }});
 const post=(p,b)=>api(p,{method:'POST',body:JSON.stringify(b)});
 assert.deepEqual(await post('/register',{phone:'0803 123 4567',name:'A',password:'example8',bank_account_number:'9999999999'}),{verification_required:true,phone:'+2348031234567'});
 assert.deepEqual(received,{phone:'+2348031234567',password:'example8',options:{data:{display_name:'A'}}});
 await assert.rejects(post('/verify-phone',{phone:'+2348031234567',token:'12345'}),/six-digit/);
 assert.equal((await post('/verify-phone',{phone:'+2348031234567',token:'123456'})).user.id,uid);
});
test('unauthenticated vehicle registration and unconnected money paths make no database calls',async()=>{
 const api=createRoadilySupabase({auth:{getSession:async()=>({data:{session:null}})},from:()=>assert.fail('unexpected write')});
 await assert.rejects(api('/vehicles',{method:'POST',body:'{"plate":"ABC123X","kind":"Car"}'}),/Sign in first/);
 await assert.rejects(api('/wallet/withdraw',{method:'POST'}),/not connected/);
 assert.deepEqual(await api('/wallet'),{available_balance:null,payout_account:null});
});

test('misconfigured auto-confirmation is not accepted', async()=>{
 let discarded=false;
 const api=createRoadilySupabase({auth:{
   signUp:async()=>({data:{session:{}}}),
   signOut:async({scope})=>{assert.equal(scope,'local');discarded=true;return {data:{}}}
 }});
 await assert.rejects(api('/register',{method:'POST',body:JSON.stringify({phone:'08031234567',name:'Example',password:'example8'})}),/confirmation must be enabled/);
 assert.equal(discarded,true);
});
