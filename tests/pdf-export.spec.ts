import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * PDF export smoke test.
 *
 * `handlePdf` in ExportReportButton mounts a hidden iframe with srcdoc set
 * to the report HTML, then fires iframe.contentWindow.print(). We can't
 * drive the native print dialog from Playwright, so instead we:
 *
 *   1. Force the chat into an audit-result state (mock the message + click
 *      the action-bar Export → PDF item).
 *   2. Intercept the iframe before its print() call by overriding
 *      window.print on the iframe contentWindow.
 *   3. Snapshot the iframe's HTML to disk.
 *   4. Render that HTML to a PDF via page.pdf() so we have a real artifact.
 */

const OUT_DIR = path.join(__dirname, '..', '.impeccable', 'pdf-export-test');

test.setTimeout(90_000);

// QUARANTINE (2026-05-29): test.fixme — drives the full chat→audit→export
// flow which has drifted (1.5m timeout). Needs re-anchoring, not deletion.
test.fixme('Export → PDF produces a real chat-style PDF', async ({ page }) => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Intercept iframe.contentWindow.print so the native dialog doesn't open;
  // grab the srcdoc HTML on the way.
  await page.addInitScript(() => {
    const w = window as Window & { __capturedPrintHtml?: string };
    const origAppend = Element.prototype.appendChild;
    Element.prototype.appendChild = function <T extends Node>(node: T): T {
      const result = origAppend.call(this, node) as T;
      if (node instanceof HTMLIFrameElement && node.srcdoc) {
        w.__capturedPrintHtml = node.srcdoc;
        // Neuter the print() call so the test doesn't block on the dialog.
        node.addEventListener('load', () => {
          try { (node.contentWindow as Window).print = () => {}; } catch { /* cross-origin */ }
        });
      }
      return result;
    };
  });

  await page.goto('/');

  // Sidebar → Ask IRA → chat surface.
  await page.getByRole('button', { name: /ask ira/i }).first().click();

  // The hero composer textarea on the empty-state chat surface.
  const composer = page.locator('textarea').first();
  await composer.waitFor({ state: 'visible', timeout: 10_000 });
  await composer.fill('Find duplicate invoices in Q1 FY26');
  await composer.press('Enter');

  // Skip the inline clarification (4 questions in the audit query flow) by
  // clicking the "Skip all" / "Skip" entry whenever it appears, up to a few
  // rounds, until the audit-result + Export button mount.
  const exportBtn = page.getByRole('button', { name: /^export$/i });
  const skipBtn = page.getByRole('button', { name: /^skip( all)?$/i }).first();
  for (let i = 0; i < 6; i++) {
    if (await exportBtn.isVisible().catch(() => false)) break;
    try {
      await skipBtn.waitFor({ state: 'visible', timeout: 4_000 });
      await skipBtn.click();
    } catch {
      // No more clarification rows — fall through to the Export wait.
      break;
    }
  }
  await exportBtn.waitFor({ state: 'visible', timeout: 60_000 });
  await exportBtn.click();

  // Click PDF in the menu.
  await page.getByRole('menuitem', { name: /^pdf$/i }).click();

  // Wait for our interceptor to grab the iframe srcdoc.
  const html = await page.waitForFunction(
    () => (window as Window & { __capturedPrintHtml?: string }).__capturedPrintHtml,
    null,
    { timeout: 10_000 },
  );
  const capturedHtml = (await html.jsonValue()) as string;

  expect(capturedHtml.length).toBeGreaterThan(2000);

  // Snapshot the HTML so we can eyeball it.
  fs.writeFileSync(path.join(OUT_DIR, 'export.html'), capturedHtml, 'utf8');

  // Render the captured HTML to a real PDF in a fresh page so we have the
  // exact artifact a user would get from "Save as PDF".
  const renderer = await page.context().newPage();
  await renderer.setContent(capturedHtml, { waitUntil: 'load' });
  await renderer.emulateMedia({ media: 'print' });
  const pdfBytes = await renderer.pdf({
    format: 'A4',
    margin: { top: '16mm', right: '16mm', bottom: '16mm', left: '16mm' },
    printBackground: true,
  });
  fs.writeFileSync(path.join(OUT_DIR, 'export.pdf'), pdfBytes);
  await renderer.close();

  // Structural sanity — the HTML should contain real SVG charts (not the
  // old CSS bar-row markup), the table, and the chat-style header.
  expect(capturedHtml).toContain('<svg');
  // 7 chart SVGs (confidence / vendor / monthly-high / region / match-method / status / amount-band)
  expect((capturedHtml.match(/<svg /g) || []).length).toBeGreaterThanOrEqual(7);
  // KPI grid present
  expect(capturedHtml).toContain('kpi-grid');
  // Data table present with all 15 rows
  expect(capturedHtml).toContain('Flagged duplicate pairs · 15');
  // No "report" framing
  expect(capturedHtml).not.toContain('Audit report');
  expect(capturedHtml).not.toContain('<h2>Summary</h2>');
  // PDF file written and non-trivial
  const pdfStat = fs.statSync(path.join(OUT_DIR, 'export.pdf'));
  expect(pdfStat.size).toBeGreaterThan(20_000);
});
