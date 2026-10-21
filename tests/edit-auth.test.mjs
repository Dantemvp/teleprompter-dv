import test from 'node:test';
import assert from 'node:assert/strict';
import { canEdit } from '../lib/edit-auth.mjs';

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
