/**
 * PDF Invoice Generator using PDFKit
 */

const PDFDocument = require('pdfkit');

const COLORS = {
  primary: '#2563EB',
  dark: '#1E293B',
  gray: '#64748B',
  lightGray: '#F1F5F9',
  white: '#FFFFFF',
  border: '#E2E8F0'
};

/**
 * Generate a professional PDF invoice.
 * @param {Object} data - Invoice data
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generatePDF(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // --- Header ---
      doc
        .rect(0, 0, doc.page.width, 100)
        .fill(COLORS.primary);

      doc
        .fontSize(28)
        .fillColor(COLORS.white)
        .text('INVOICE', 50, 35, { align: 'left' });

      doc
        .fontSize(12)
        .fillColor(COLORS.white)
        .text(data.invoiceNumber || 'DRAFT', 400, 30, { align: 'right' })
        .fontSize(10)
        .text(data.date || new Date().toLocaleDateString('lt-LT'), 400, 50, { align: 'right' });

      // --- Business Info (left) & Client Info (right) ---
      const infoY = 130;

      // Business (from)
      doc
        .fontSize(10)
        .fillColor(COLORS.gray)
        .text('FROM', 50, infoY);

      doc
        .fontSize(11)
        .fillColor(COLORS.dark)
        .text(data.businessName || 'Your Business', 50, infoY + 18)
        .fontSize(9)
        .fillColor(COLORS.gray)
        .text(data.businessEmail || '', 50, infoY + 35)
        .text(data.businessAddress || '', 50, infoY + 50)
        .text(data.taxId ? `VAT: ${data.taxId}` : '', 50, infoY + 65);

      // Client (to)
      doc
        .fontSize(10)
        .fillColor(COLORS.gray)
        .text('BILL TO', 350, infoY);

      doc
        .fontSize(11)
        .fillColor(COLORS.dark)
        .text(data.clientName || 'Client', 350, infoY + 18)
        .fontSize(9)
        .fillColor(COLORS.gray)
        .text(data.clientEmail || '', 350, infoY + 35)
        .text(data.clientAddress || '', 350, infoY + 50);

      // --- Items Table ---
      const tableTop = 250;
      const colX = { desc: 50, qty: 320, price: 390, total: 470 };

      // Table header
      doc
        .rect(50, tableTop, 500, 25)
        .fill(COLORS.lightGray);

      doc
        .fontSize(9)
        .fillColor(COLORS.gray)
        .text('DESCRIPTION', colX.desc + 10, tableTop + 8)
        .text('QTY', colX.qty, tableTop + 8)
        .text('PRICE', colX.price, tableTop + 8)
        .text('TOTAL', colX.total, tableTop + 8);

      // Table rows
      let rowY = tableTop + 30;
      const items = data.items || [];

      items.forEach((item, i) => {
        if (i % 2 === 0) {
          doc.rect(50, rowY - 5, 500, 22).fill('#FAFAFA');
        }

        doc
          .fontSize(9)
          .fillColor(COLORS.dark)
          .text(item.description || '', colX.desc + 10, rowY, { width: 260 })
          .text(String(item.quantity || 1), colX.qty, rowY)
          .text(item.unitPrice || '0.00', colX.price, rowY)
          .text(item.total || '0.00', colX.total, rowY);

        rowY += 22;
      });

      // Separator
      rowY += 10;
      doc
        .moveTo(350, rowY)
        .lineTo(550, rowY)
        .strokeColor(COLORS.border)
        .stroke();

      // --- Totals ---
      rowY += 15;
      const currency = data.currency || 'EUR';

      doc
        .fontSize(9)
        .fillColor(COLORS.gray)
        .text('Subtotal:', 370, rowY)
        .fillColor(COLORS.dark)
        .text(`${currency} ${data.subtotal || '0.00'}`, 470, rowY);

      rowY += 18;
      doc
        .fillColor(COLORS.gray)
        .text(`Tax (${data.taxRate || 21}%):`, 370, rowY)
        .fillColor(COLORS.dark)
        .text(`${currency} ${data.tax || '0.00'}`, 470, rowY);

      rowY += 25;
      doc
        .rect(360, rowY - 5, 190, 28)
        .fill(COLORS.primary);

      doc
        .fontSize(12)
        .fillColor(COLORS.white)
        .text('TOTAL:', 370, rowY + 2)
        .text(`${currency} ${data.total || '0.00'}`, 470, rowY + 2);

      // --- Payment Info ---
      rowY += 60;
      if (data.paymentTerms || data.notes) {
        doc
          .fontSize(10)
          .fillColor(COLORS.gray)
          .text('PAYMENT DETAILS', 50, rowY);

        rowY += 18;
        doc
          .fontSize(9)
          .fillColor(COLORS.dark);

        if (data.paymentTerms) {
          doc.text(`Payment terms: ${data.paymentTerms} days`, 50, rowY);
          rowY += 15;
        }

        if (data.bankAccount) {
          doc.text(`Bank account: ${data.bankAccount}`, 50, rowY);
          rowY += 15;
        }

        if (data.notes) {
          rowY += 5;
          doc
            .fontSize(8)
            .fillColor(COLORS.gray)
            .text(data.notes, 50, rowY, { width: 400 });
        }
      }

      // --- Footer ---
      doc
        .fontSize(8)
        .fillColor(COLORS.gray)
        .text(
          'Generated by InvoiceFly',
          50,
          doc.page.height - 50,
          { align: 'center', width: doc.page.width - 100 }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generatePDF };
