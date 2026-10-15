import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
const page = await context.newPage();
try {
  await page.goto(process.env.BASE_URL || 'http://localhost:3100/');
  await page.getByTestId('square-e2').waitFor();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  mkdirSync('artifacts/testing', { recursive: true });
  writeFileSync('artifacts/testing/accessibility.json', JSON.stringify({ url: page.url(), timestamp: new Date().toISOString(), violations: results.violations, passes: results.passes.map(p => p.id) }, null, 2));
  console.log(JSON.stringify(results.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })), null, 2));
  console.log(`${results.passes.length} rules passed; ${results.violations.length} violation categories.`);
  if (results.violations.length) process.exitCode = 1;
} finally { await browser.close(); }
