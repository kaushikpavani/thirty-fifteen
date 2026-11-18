import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const pages = ['site/index.html', 'site/support/index.html', 'site/privacy/index.html'];

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

test('the public site is static, relative, and free of banned copy', () => {
  const css = read('site/styles.css');
  assert.match(css, /-apple-system/);
  assert.doesNotMatch(css, /https?:\/\//);

  const bodies = pages.map((rel) => read(rel));
  const all = bodies.join('\n');
  assert.doesNotMatch(all, /honest/i);
  assert.doesNotMatch(all, /BioAge/i);
  assert.doesNotMatch(all, /\bRocky\b/i);
  assert.doesNotMatch(all, /subscription|\bIAP\b|\bPro\b|\btier/i);
  assert.doesNotMatch(all, /<script|fonts\.googleapis|googletagmanager|mailto:/i);
  assert.doesNotMatch(all, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);

  assert.match(bodies[0]!, /href="styles\.css"/);
  assert.match(bodies[0]!, /href="support\/"/);
  assert.match(bodies[0]!, /href="privacy\/"/);
  for (const page of bodies.slice(1)) {
    assert.match(page, /href="\.\.\/styles\.css"/);
    assert.doesNotMatch(page, /href="\/(?!\/)/);
  }

  const support = bodies[1]!;
  assert.match(support, /https:\/\/github\.com\/kaushikpavani\/thirty-fifteen\/issues/);
  assert.match(support, /Cycling Power/);
  assert.match(support, /Heart Rate/);
  assert.match(support, /Delete ride history/);
  assert.match(support, /Delete account and cloud data/);
  assert.match(support, /Delete account and iPhone data/);
  assert.match(support, /Continue with Apple/);
  assert.match(support, /Continue with Google/);

  const privacy = bodies[2]!;
  assert.match(privacy, /November 16, 2026/);
  assert.match(privacy, /Sri Kaushik Pavani/);
  assert.match(privacy, /Supabase/);
  assert.match(privacy, /Sign in with Apple|Continue with Apple/);
  assert.match(privacy, /Continue with Google/);
  assert.match(privacy, /delete-account/);
  assert.match(privacy, /No HealthKit/);
  assert.match(privacy, /does not request\s+location/i);
  assert.match(privacy, /https:\/\/github\.com\/kaushikpavani\/thirty-fifteen\/issues/);

  const workflow = read('.github/workflows/pages.yml');
  assert.match(workflow, /enablement:\s*true/);
  assert.match(workflow, /path:\s*site/);
  assert.doesNotMatch(workflow, /path:\s*docs/);

  const store = read('STORE.md');
  assert.match(store, /https:\/\/kaushikpavani\.github\.io\/thirty-fifteen\/support\//);
  assert.match(store, /https:\/\/kaushikpavani\.github\.io\/thirty-fifteen\/privacy\//);
  assert.doesNotMatch(store, /example\.com\/30-15/);

  const submission = read('docs/APP-STORE-SUBMISSION.md');
  assert.match(submission, /https:\/\/kaushikpavani\.github\.io\/thirty-fifteen\/support\//);
  assert.match(submission, /https:\/\/kaushikpavani\.github\.io\/thirty-fifteen\/privacy\//);
});

test('the support page has a data-deletion section for the store listing', () => {
  const support = read('site/support/index.html');
  const start = support.indexOf('id="delete-your-data"');
  assert.ok(start > 0);
  const section = support.slice(start);
  assert.match(support, /href="#delete-your-data"/);
  assert.match(support, /<h2 id="delete-your-data">Delete your data<\/h2>/);
  assert.match(section, /30\/15 Coach/);
  assert.match(section, /Kaushik Pavani/);
  assert.match(section, /Delete this ride/);
  assert.match(section, /Delete ride history/);
  assert.match(section, /keep the account/);
  assert.match(section, /Delete account and cloud data/);
  assert.match(section, /Delete account and iPhone data/);
  assert.match(section, /Email address/);
  assert.match(section, /User id/);
  assert.match(section, /Ride summaries/);
  assert.match(section, /Fitness data/);
  assert.match(section, /Feedback notes/);
  assert.match(section, /What is kept/);
  assert.match(section, /no timed purge/);
  assert.match(section, /mailbox copy/);
  assert.match(section, /If you cannot open the app/);
  assert.match(section, /https:\/\/github\.com\/kaushikpavani\/thirty-fifteen\/issues/);
  assert.doesNotMatch(section, /mailto:/i);
});
