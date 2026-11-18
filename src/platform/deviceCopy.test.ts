import assert from 'node:assert/strict';
import test from 'node:test';
import { deleteAccountPhoneButton, deviceCopy, silentRideNote } from './deviceCopy.ts';

const IOS_ACCOUNT =
  'This permanently deletes your 30/15 account and the cloud copy of your rides, profile, notes, and analytics. The second button also erases rides and settings on this iPhone. This cannot be undone.';

test('iOS device copy is unchanged', () => {
  assert.equal(deviceCopy('ios', 'Saved on this iPhone'), 'Saved on this iPhone');
  assert.equal(deviceCopy('ios', 'Erase this iPhone?'), 'Erase this iPhone?');
  assert.equal(deviceCopy('ios', IOS_ACCOUNT), IOS_ACCOUNT);
  assert.equal(deleteAccountPhoneButton('ios'), 'Delete account and iPhone data');
  assert.equal(silentRideNote('ios'), 'The iPhone silent switch never mutes a ride.');
});

test('Android says phone, and the silent-mode line is not a broken substitution', () => {
  assert.equal(deviceCopy('android', 'Saved on this iPhone'), 'Saved on this phone');
  assert.equal(deviceCopy('android', 'Erase data on this iPhone'), 'Erase data on this phone');
  assert.match(deviceCopy('android', IOS_ACCOUNT), /on this phone/);
  assert.doesNotMatch(deviceCopy('android', IOS_ACCOUNT), /iPhone/);
  assert.equal(deleteAccountPhoneButton('android'), 'Delete account and phone data');
  assert.equal(silentRideNote('android'), 'Silent mode and vibrate never mute a ride.');
  assert.doesNotMatch(silentRideNote('android'), /iPhone/);
});
