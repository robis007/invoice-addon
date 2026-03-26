/**
 * /parse — AI-powered email parsing endpoint
 *
 * Accepts email content, returns structured invoice data.
 */

const express = require('express');
const router = express.Router();
const { parseEmail } = require('../services/aiParser');

router.post('/', async (req, res) => {
  try {
    const { subject, from, to, date, body, threadId } = req.body;

    if (!body) {
      return res.status(400).json({ error: 'Email body is required' });
    }

    const parsed = await parseEmail({ subject, from, to, date, body, threadId });

    res.json(parsed);
  } catch (err) {
    console.error('Parse error:', err);
    res.status(500).json({ error: 'Failed to parse email', details: err.message });
  }
});

module.exports = router;
