/**
 * Invoice Template Renderer
 *
 * Fills HTML template placeholders with invoice data.
 */

const fs = require('fs');
const path = require('path');

const TEMPLATE_PATH = path.resolve(__dirname, '../../../src/templates/invoice-template.html');

/**
 * Render an invoice HTML from template + data.
 */
function renderInvoice(data) {
  let html = fs.readFileSync(TEMPLATE_PATH, 'utf8');

  // Calculate due date
  const issueDate = data.date ? new Date(data.date) : new Date();
  const paymentTerms = parseInt(data.paymentTerms || '14', 10);
  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + paymentTerms);

  const formatDate = (d) => d.toLocaleDateString('lt-LT'); // YYYY-MM-DD

  // Build items rows
  const itemsHtml = (data.items || []).map((item, i) => `
      <tr>
        <td>
          <div class="item-description">${escapeHtml(item.description || '')}</div>
          ${item.detail ? `<div class="item-subdesc">${escapeHtml(item.detail)}</div>` : ''}
        </td>
        <td>${item.quantity || 1}</td>
        <td>${data.currency || 'EUR'} ${item.unitPrice || '0.00'}</td>
        <td>${data.currency || 'EUR'} ${item.total || '0.00'}</td>
      </tr>`
  ).join('\n');

  // Replace all placeholders
  const replacements = {
    '{{INVOICE_NUMBER}}': data.invoiceNumber || 'DRAFT',
    '{{DATE}}': formatDate(issueDate),
    '{{DUE_DATE}}': formatDate(dueDate),
    '{{STATUS}}': data.status || 'Pending',

    '{{BUSINESS_NAME}}': data.businessName || 'Your Business',
    '{{BUSINESS_TAGLINE}}': data.businessTagline || '',
    '{{BUSINESS_EMAIL}}': data.businessEmail || '',
    '{{BUSINESS_ADDRESS}}': data.businessAddress || '',
    '{{TAX_ID_LABEL}}': data.taxIdLabel || 'VAT',
    '{{TAX_ID}}': data.taxId || '',

    '{{CLIENT_NAME}}': data.clientName || 'Client',
    '{{CLIENT_EMAIL}}': data.clientEmail || '',
    '{{CLIENT_ADDRESS}}': data.clientAddress || '',

    '{{ITEMS_ROWS}}': itemsHtml,

    '{{CURRENCY}}': data.currency || 'EUR',
    '{{SUBTOTAL}}': data.subtotal || '0.00',
    '{{TAX_RATE}}': String(data.taxRate || 21),
    '{{TAX}}': data.tax || '0.00',
    '{{TOTAL}}': data.total || '0.00',

    '{{BANK_NAME}}': data.bankName || '',
    '{{IBAN}}': data.iban || '',
    '{{SWIFT}}': data.swift || '',
    '{{PAYMENT_TERMS}}': String(paymentTerms),

    '{{NOTES}}': escapeHtml(data.notes || 'Thank you for your business!')
  };

  for (const [placeholder, value] of Object.entries(replacements)) {
    html = html.replaceAll(placeholder, value);
  }

  return html;
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = { renderInvoice };
