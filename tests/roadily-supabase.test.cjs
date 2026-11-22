const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createRoadilySupabase}=require('../roadily-supabase.js');
const user={id:'a1',phone:'2348031234567',user_metadata:{display_name:'Example'}};
const body=v=>({method:'POST',body:JSON.stringify(v)});
test('signup normalizes a login label and succeeds only with a session; no bank fields',async()=>{
 let received, session={};
 const api=createRoadilySupabase({auth:{
  signUp:async input=>{received=input;return {data:{user,session}}}
 }});
 const payload={phone:'0803 123 4567',name:'Example',password:'example8',bank_account_number:'9999999999'};
 assert.deepEqual(await api('/register',body(payload)),{user:{id:'a1',phone:'+2348031234567',display_name:'Example'}});
 assert.deepEqual(received,{phone:'+2348031234567',password:'example8',options:{data:{display_name:'Example'}}});
 session=null;
 await assert.rejects(api('/register',body(payload)),/sign-up did not finish/);
});
test('unauthenticated vehicle registration and unconnected money paths make no database calls',async()=>{
 const api=createRoadilySupabase({auth:{getSession:async()=>({data:{session:null}})},from:()=>assert.fail('unexpected write')});
 await assert.rejects(api('/vehicles',{method:'POST',body:'{"plate":"ABC123X","kind":"Car"}'}),/Sign in first/);
 await assert.rejects(api('/wallet/withdraw',{method:'POST'}),/not connected/);
 assert.deepEqual(await api('/wallet'),{available_balance:null,payout_account:null});
});
test('sign-in uses password with no OTP calls, managed user ID gates data',async()=>{
 const api=createRoadilySupabase({auth:{
  signInWithPassword:async v=>{assert.deepEqual(v,{phone:'+2348031234567',password:'example8'});return {data:{user}}},
  getSession:async()=>({data:{session:{}}}),
  getUser:async()=>({data:{user:{id:'a1',is_anonymous:true}}})
 },from:()=>assert.fail('unexpected data access')});
 assert.equal((await api('/login',body({phone:'08031234567',password:'example8'}))).user.id,'a1');
 await assert.rejects(api('/vehicles'),/Use a Roadily phone and password account/);
});
