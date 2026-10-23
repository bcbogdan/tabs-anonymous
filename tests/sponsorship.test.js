import {test} from 'node:test';
import assert from 'node:assert/strict';
import {identity,publicKey,sign,verify,processDecision} from '../extension/sponsorship.js';
test('P-256 identity is nonexportable, cards bind email, signatures reject tampering',async()=>{
 const k=await identity(),key=await publicKey(k);
 await assert.rejects(crypto.subtle.exportKey('jwk',k.privateKey));
 const code=await sign(k,{kind:'card',signer:key,name:'Sponsor',email:'sponsor@example.com'});
 assert.equal((await verify(code)).email,'sponsor@example.com');
 const e=JSON.parse(Buffer.from(code.slice(4),'base64url'));e.payload.email='other@example.com';
 await assert.rejects(verify('TA1.'+Buffer.from(JSON.stringify(e)).toString('base64url')),/Signature/);
 await assert.rejects(verify(await sign(k,{kind:'card',signer:key,name:'Sponsor',email:'invalid'})),/email/);
 await assert.rejects(verify(await sign(k,{kind:'card',signer:key,name:'Sponsor',email:'s@example.com',extra:'bad'})),/fields/);
});
test('decisions require correct sponsor, participant, pairing, pending request and increasing sequence',async()=>{
 const sponsor=await identity(),participant=await identity(),stranger=await identity();const sk=await publicKey(sponsor),pk=await publicKey(participant);
 const state=()=>({pairing:{id:'pair-1',sponsor:{signer:sk},sequence:0,active:false,pending:{request:'request-1'}}});
 const payload={kind:'decision',signer:sk,participant:pk,pairing:'pair-1',request:'request-1',sequence:1,approved:true,limit:8};
 for(const patch of [{participant:'someone-else'},{pairing:'another-pair'},{request:'another-request'},{sequence:0},{limit:501}])await assert.rejects(processDecision(state(),await sign(sponsor,{...payload,...patch}),pk));
 await assert.rejects(processDecision(state(),await sign(stranger,{...payload,signer:await publicKey(stranger)}),pk));
 await assert.rejects(processDecision(state(),await sign(stranger,payload),pk));
 const s=state(),code=await sign(sponsor,payload);assert.equal((await processDecision(s,code,pk)).limit,8);assert.equal(s.pairing.active,true);assert.equal(s.pairing.pending,null);
 await assert.rejects(processDecision(s,code,pk),/already used/);
 s.pairing.pending={request:'request-2'};
 const decline=await sign(sponsor,{...payload,sequence:2,request:'request-2',approved:false});assert.equal((await processDecision(s,decline,pk)).approved,false);assert.equal(s.pairing.active,true);assert.equal(s.pairing.sequence,2);
 await assert.rejects(processDecision(s,code,pk),/already used/);
});
