/**
 * InvoiceFly Backend — Express server for Cloud Run
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const parseRoutes = require('./routes/parse');
const pdfRoutes = require('./routes/pdf');
const healthRoutes = require('./routes/health');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Routes
app.use('/health', healthRoutes);
app.use('/parse', parseRoutes);
app.use('/pdf', pdfRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`InvoiceFly backend running on port ${PORT}`);
});

module.exports = app;
