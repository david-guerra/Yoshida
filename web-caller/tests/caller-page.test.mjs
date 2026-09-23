import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('obsolete token and dispatch endpoints cannot bypass durable call orchestration',async()=>{
  const token=await import('../app/api/token/route.ts');
  const dispatch=await import('../app/api/dispatch/route.ts');
  assert.equal(token.GET().status,410);assert.equal(dispatch.POST().status,410);
});

test('stale localhost service workers unregister instead of reloading Firefox forever',()=>{
  const source=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
  assert.match(source,/registration\.unregister\(\)/);
  assert.match(source,/client\.navigate\(client\.url\)/);
});
