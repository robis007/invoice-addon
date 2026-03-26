/**
 * /pdf — Generate PDF invoice from structured data
 */

const express = require('express');
const router = express.Router();
const { generatePDF } = require('../services/pdfGenerator');

router.post('/', async (req, res) => {
  try {
    const invoiceData = req.body;

    if (!invoiceData.clientName || !invoiceData.items) {
      return res.status(400).json({ error: 'clientName and items are required' });
    }

    const pdfBuffer = await generatePDF(invoiceData);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${invoiceData.invoiceNumber || 'draft'}.pdf"`,
      'Content-Length': pdfBuffer.length
    });

    res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ error: 'Failed to generate PDF', details: err.message });
  }
});

module.exports = router;
