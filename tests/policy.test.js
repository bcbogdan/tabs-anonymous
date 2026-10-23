import {test} from 'node:test';
import assert from 'node:assert/strict';
import {choose,positive,destination} from '../extension/policy.js';
test('selection uses age, protects pinned tabs, and supports random',()=>{
 const tabs=[{id:1,pinned:true},{id:2},{id:3},{id:4}],meta={1:{born:0},2:{born:30},3:{born:10},4:{born:20}};
 assert.equal(choose(tabs,meta,'fifo').id,3);assert.equal(choose(tabs,meta,'lifo').id,2);assert.equal(choose(tabs,meta,'random',()=>0.5).id,4);assert.throws(()=>choose([{id:1,pinned:true}],meta,'fifo'));
});
test('invalid limits and executable destinations are rejected',()=>{
 for(const n of [0,-1,1.1,Infinity,'abc',501])assert.throws(()=>positive(n));assert.equal(positive('8'),8);assert.equal(destination('javascript:alert(1)'),'chrome://newtab/');assert.equal(destination('https://example.com/a'),'https://example.com/a');
});
