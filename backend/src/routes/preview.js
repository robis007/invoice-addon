/**
 * /preview — Render invoice as HTML for preview
 */

const express = require('express');
const router = express.Router();
const { renderInvoice } = require('../services/templateRenderer');

router.post('/', (req, res) => {
  try {
    const html = renderInvoice(req.body);
    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error('Preview error:', err);
    res.status(500).json({ error: 'Failed to render preview', details: err.message });
  }
});

module.exports = router;
