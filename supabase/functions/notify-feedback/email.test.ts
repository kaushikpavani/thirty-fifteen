import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFeedbackEmail } from './email.ts';

const row = {
  id: 'b1c2',
  body: 'Love the countdown!\nCould the EASY beep be louder?',
  created_at: '2026-09-30T21:55:00Z',
  user_id: 'u-1',
  rider_name: 'Sam',
  platform: 'ios',
  app_version: '1.0.0',
};

test('a signed-in rider’s note carries their address as reply-to and in the details', () => {
  const email = buildFeedbackEmail(row, 'sam@example.com')!;
  assert.equal(email.replyTo, 'sam@example.com');
  assert.match(email.text, /^Love the countdown!\nCould the EASY beep be louder\?/);
  assert.match(email.text, /From: Sam <sam@example.com>/);
  assert.match(email.text, /App: ios · 1\.0\.0/);
  assert.match(email.text, /Reply to this email/);
});

test('the subject is one line and short, so a note can’t smuggle in extra lines', () => {
  const email = buildFeedbackEmail({ ...row, body: 'line one\r\nBcc: someone@else.com\n' + 'x'.repeat(200) }, null)!;
  assert.doesNotMatch(email.subject, /[\r\n]/);
  assert.ok(email.subject.length <= 72, email.subject);
  assert.match(email.subject, /^30\/15 note: line one Bcc:/);
});

test('anonymous notes say so and have no reply-to', () => {
  const email = buildFeedbackEmail({ ...row, user_id: null, rider_name: null }, null)!;
  assert.equal(email.replyTo, null);
  assert.match(email.text, /From: An anonymous rider \(not signed in\)/);
  assert.match(email.text, /no address to reply to/);
});

test('HTML in a note is escaped, not rendered', () => {
  const email = buildFeedbackEmail({ ...row, body: '<img src=x onerror=alert(1)> & "hi"' }, null)!;
  assert.doesNotMatch(email.html, /<img/);
  assert.match(email.html, /&lt;img src=x onerror=alert\(1\)&gt; &amp; &quot;hi&quot;/);
});

test('an empty note sends nothing', () => {
  assert.equal(buildFeedbackEmail({ ...row, body: '   ' }, null), null);
});
