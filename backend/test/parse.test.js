/**
 * Basic tests for the fallback parser.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

// We test the fallback parser directly (no AI dependency)
// The module uses VertexAI at import time only if GCP_PROJECT_ID is set
delete process.env.GCP_PROJECT_ID;

const { parseEmail } = require('../src/services/aiParser');

describe('Fallback Email Parser', () => {
  it('extracts EUR amounts from email body', async () => {
    const result = await parseEmail({
      subject: 'Order confirmation',
      from: 'John Smith <john@example.com>',
      to: 'shop@mybusiness.com',
      date: '2026-03-26',
      body: 'Hi, I would like to order 2 widgets. Total: €150.00. Thanks!'
    });

    assert.strictEqual(result.clientName, 'John Smith');
    assert.strictEqual(result.clientEmail, 'john@example.com');
    assert.strictEqual(result.total, '150.00');
    assert.strictEqual(result.currency, 'EUR');
    assert.ok(result.items.length > 0);
    assert.strictEqual(result.confidence, 0.3);
  });

  it('extracts USD amounts', async () => {
    const result = await parseEmail({
      subject: 'Invoice request',
      from: 'Jane <jane@corp.com>',
      to: 'me@me.com',
      date: '2026-03-26',
      body: 'Please send invoice for $500.00 for consulting services.'
    });

    assert.strictEqual(result.currency, 'USD');
    assert.strictEqual(result.total, '500.00');
  });

  it('handles email with no amounts gracefully', async () => {
    const result = await parseEmail({
      subject: 'Hello',
      from: 'someone@test.com',
      to: 'me@me.com',
      date: '2026-03-26',
      body: 'Can we discuss the project tomorrow?'
    });

    assert.strictEqual(result.total, '0.00');
    assert.strictEqual(result.confidence, 0.3);
  });

  it('extracts name from email without display name', async () => {
    const result = await parseEmail({
      subject: 'Order',
      from: 'plain@email.com',
      to: 'me@me.com',
      date: '2026-03-26',
      body: 'Order total: EUR 75.50'
    });

    assert.strictEqual(result.clientEmail, 'plain@email.com');
    assert.strictEqual(result.clientName, 'plain@email.com');
  });
});
