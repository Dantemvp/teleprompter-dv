import test from 'node:test';
import assert from 'node:assert/strict';
import { canEdit, canEditScript } from '../lib/edit-auth.mjs';

test('both configured credentials work without replacing the primary', () => {
  const env = { EDIT_PASSWORD: 'primary-test', EDIT_PASSWORD_SECONDARY: 'secondary-test' };
  assert.equal(canEdit('primary-test', env), true);
  assert.equal(canEdit('secondary-test', env), true);
  for (const value of ['', null, undefined, {}, 'wrong', 'Secondary-test']) assert.equal(canEdit(value, env), false);
});
test('unset credentials never grant access', () => {
  assert.equal(canEdit('', {}), false);
  assert.equal(canEdit('undefined', {}), false);
  assert.equal(canEdit('primary-test', { EDIT_PASSWORD: 'primary-test' }), true);
});

test('Fedra can edit exactly the two R14 scripts, without team permissions', () => {
  const env = { EDIT_PASSWORD:'team-test', FEDRA_R14_EDIT_PASSWORD:'fedra-test' };
  for (const slug of ['r14-01','r14-02']) assert.equal(canEditScript('fedra-test','fedra-ald-t84qz',slug,env),true);
  for (const slug of ['r14-03','r15-01','r13-01','r14-01/../r15-01','R14-01',null]) assert.equal(canEditScript('fedra-test','fedra-ald-t84qz',slug,env),false);
  assert.equal(canEditScript('fedra-test','otro-cliente','r14-01',env),false);
  assert.equal(canEdit('fedra-test',env),false);
  assert.equal(canEditScript('team-test','otro-cliente','r15-01',env),true);
  assert.equal(canEditScript('wrong','fedra-ald-t84qz','r14-01',env),false);
  assert.equal(canEditScript('fedra-test','fedra-ald-t84qz','r14-01',{}),false);
});
