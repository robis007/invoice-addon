/**
 * AI Email Parser — uses Gemini (Vertex AI) to extract invoice data
 */

const { VertexAI } = require('@google-cloud/vertexai');

const PROJECT_ID = process.env.GCP_PROJECT_ID || '';
const LOCATION = process.env.GCP_LOCATION || 'europe-west1';
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

const SYSTEM_PROMPT = `You are an invoice data extraction assistant. 
Given an email, extract structured invoice data.

ALWAYS respond with valid JSON in this exact format:
{
  "clientName": "string — the client/customer name",
  "clientEmail": "string — client email address",
  "clientAddress": "string — client address if found, empty string if not",
  "items": [
    {
      "description": "string — item/service description",
      "quantity": "number",
      "unitPrice": "string — price per unit with 2 decimals",
      "total": "string — line total with 2 decimals"
    }
  ],
  "subtotal": "string — sum before tax",
  "tax": "string — tax amount",
  "taxRate": "number — tax percentage (e.g. 21)",
  "total": "string — final total",
  "currency": "string — 3-letter code (EUR, USD, etc.)",
  "notes": "string — any relevant notes, payment terms, etc.",
  "confidence": "number 0-1 — how confident you are in the extraction"
}

Rules:
- Extract ALL items/services mentioned
- If prices aren't explicit, estimate from context and set confidence low
- Default currency to EUR if unclear
- Default tax rate to 21% if in EU context
- If it's a conversation (not a formal order), extract the implied order
- Always return valid JSON, nothing else`;

/**
 * Parse an email using Gemini AI.
 */
async function parseEmail({ subject, from, to, date, body }) {
  if (!PROJECT_ID) {
    // Fallback: basic regex parsing when no AI is configured
    return fallbackParse({ subject, from, to, date, body });
  }

  const vertexAI = new VertexAI({ project: PROJECT_ID, location: LOCATION });
  const model = vertexAI.getGenerativeModel({ model: MODEL });

  const prompt = `Extract invoice data from this email:

FROM: ${from}
TO: ${to}
DATE: ${date}
SUBJECT: ${subject}

BODY:
${body}`;

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    });

    const text = result.response.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(text);

    // Validate required fields
    return {
      clientName: parsed.clientName || extractNameFromEmail(from),
      clientEmail: parsed.clientEmail || extractEmailAddress(from),
      clientAddress: parsed.clientAddress || '',
      items: Array.isArray(parsed.items) ? parsed.items : [],
      subtotal: parsed.subtotal || '0.00',
      tax: parsed.tax || '0.00',
      taxRate: parsed.taxRate || 21,
      total: parsed.total || '0.00',
      currency: parsed.currency || 'EUR',
      notes: parsed.notes || '',
      confidence: parsed.confidence || 0.5
    };
  } catch (err) {
    console.error('Gemini parsing failed, using fallback:', err.message);
    return fallbackParse({ subject, from, to, date, body });
  }
}

/**
 * Fallback parser using regex patterns (no AI required).
 */
function fallbackParse({ subject, from, to, date, body }) {
  const fullText = `${subject}\n${body}`;

  // Extract amounts (look for currency patterns)
  const amountRegex = /(?:€|EUR|USD|\$|£|GBP)\s*(\d+[.,]\d{2})/gi;
  const amounts = [];
  let match;
  while ((match = amountRegex.exec(fullText)) !== null) {
    amounts.push(parseFloat(match[1].replace(',', '.')));
  }

  // Also try plain number patterns near keywords
  const priceKeywords = /(?:price|cost|total|amount|sum|charge|fee|pay)[:\s]*(\d+[.,]\d{2})/gi;
  while ((match = priceKeywords.exec(fullText)) !== null) {
    amounts.push(parseFloat(match[1].replace(',', '.')));
  }

  // Detect currency
  let currency = 'EUR';
  if (/USD|\$/i.test(fullText)) currency = 'USD';
  if (/GBP|£/i.test(fullText)) currency = 'GBP';
  if (/PLN|zł/i.test(fullText)) currency = 'PLN';

  const total = amounts.length > 0 ? Math.max(...amounts).toFixed(2) : '0.00';
  const taxRate = 21;
  const subtotal = (parseFloat(total) / (1 + taxRate / 100)).toFixed(2);
  const tax = (parseFloat(total) - parseFloat(subtotal)).toFixed(2);

  return {
    clientName: extractNameFromEmail(from),
    clientEmail: extractEmailAddress(from),
    clientAddress: '',
    items: [{
      description: subject || 'Service/Product (review needed)',
      quantity: 1,
      unitPrice: total,
      total: total
    }],
    subtotal,
    tax,
    taxRate,
    total,
    currency,
    notes: 'Auto-parsed with basic extraction. Please review.',
    confidence: 0.3
  };
}

/**
 * Extract display name from email header.
 */
function extractNameFromEmail(from) {
  if (!from) return '';
  const nameMatch = from.match(/^([^<]+)/);
  return nameMatch ? nameMatch[1].trim().replace(/"/g, '') : from;
}

/**
 * Extract email address from header.
 */
function extractEmailAddress(from) {
  if (!from) return '';
  const emailMatch = from.match(/<([^>]+)>/);
  return emailMatch ? emailMatch[1] : from;
}

module.exports = { parseEmail };
