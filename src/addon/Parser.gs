/**
 * InvoiceFly — Email Parser
 *
 * Extracts invoice-relevant data from emails.
 * Strategy:
 *   1. Try Gemini API (if API key configured)
 *   2. Fall back to built-in regex/heuristic parser
 */

/**
 * Parse the current email and show extracted data.
 */
function onParseEmail(e) {
  var messageId = e.parameters && e.parameters.messageId;

  if (!messageId) {
    return showError('No email selected. Open an email first.');
  }

  var message = GmailApp.getMessageById(messageId);
  var emailData = {
    subject: message.getSubject(),
    from: message.getFrom(),
    to: message.getTo(),
    date: message.getDate().toISOString(),
    body: message.getPlainBody().substring(0, 4000),
    threadId: message.getThread().getId()
  };

  // Parse the email
  var parsed;
  try {
    parsed = parseEmailData(emailData);
  } catch (err) {
    return showError('Parsing failed: ' + err.message);
  }

  // Show extracted data for review
  var card = CardService.newCardBuilder()
    .setHeader(
      CardService.newCardHeader()
        .setTitle('Extracted Invoice Data')
        .setSubtitle(parsed.confidence < 0.5 ? '⚠️ Low confidence — please review' : '✅ Review and generate')
    )
    .addSection(
      CardService.newCardSection()
        .setHeader('Client')
        .addWidget(
          CardService.newTextInput()
            .setFieldName('clientName')
            .setTitle('Client Name')
            .setValue(parsed.clientName || '')
        )
        .addWidget(
          CardService.newTextInput()
            .setFieldName('clientEmail')
            .setTitle('Client Email')
            .setValue(parsed.clientEmail || '')
        )
        .addWidget(
          CardService.newTextInput()
            .setFieldName('clientAddress')
            .setTitle('Client Address')
            .setValue(parsed.clientAddress || '')
        )
    )
    .addSection(
      CardService.newCardSection()
        .setHeader('Items')
        .addWidget(
          CardService.newTextParagraph()
            .setText(formatItems(parsed.items || []))
        )
    )
    .addSection(
      CardService.newCardSection()
        .setHeader('Totals')
        .addWidget(
          CardService.newKeyValue()
            .setTopLabel('Subtotal')
            .setContent(parsed.currency + ' ' + (parsed.subtotal || '0.00'))
        )
        .addWidget(
          CardService.newKeyValue()
            .setTopLabel('Tax (' + (parsed.taxRate || 21) + '%)')
            .setContent(parsed.currency + ' ' + (parsed.tax || '0.00'))
        )
        .addWidget(
          CardService.newKeyValue()
            .setTopLabel('Total')
            .setContent(parsed.currency + ' ' + (parsed.total || '0.00'))
        )
    )
    .addSection(
      CardService.newCardSection()
        .addWidget(
          CardService.newTextInput()
            .setFieldName('notes')
            .setTitle('Notes')
            .setValue(parsed.notes || '')
        )
    )
    .addSection(
      CardService.newCardSection()
        .addWidget(
          CardService.newTextButton()
            .setText('✅ Generate Invoice')
            .setOnClickAction(
              CardService.newAction()
                .setFunctionName('onGenerateInvoice')
                .setParameters({
                  parsedData: JSON.stringify(parsed),
                  messageId: messageId
                })
            )
        )
        .addWidget(
          CardService.newTextButton()
            .setText('✏️ Edit Items Manually')
            .setOnClickAction(
              CardService.newAction()
                .setFunctionName('onEditItems')
                .setParameters({
                  parsedData: JSON.stringify(parsed),
                  messageId: messageId
                })
            )
        )
    )
    .build();

  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card))
    .build();
}

// ═══════════════════════════════════════════════════════════
// PARSING ENGINE
// ═══════════════════════════════════════════════════════════

/**
 * Main parsing function. Tries Gemini first, then fallback.
 */
function parseEmailData(emailData) {
  var props = PropertiesService.getScriptProperties();
  var geminiKey = props.getProperty('GEMINI_API_KEY');

  if (geminiKey) {
    try {
      return parseWithGemini(emailData, geminiKey);
    } catch (err) {
      Logger.log('Gemini parsing failed, using fallback: ' + err.message);
    }
  }

  return parseWithRegex(emailData);
}

// ═══════════════════════════════════════════════════════════
// GEMINI AI PARSER
// ═══════════════════════════════════════════════════════════

/**
 * Parse email using Gemini API directly from Apps Script.
 */
function parseWithGemini(emailData, apiKey) {
  var model = 'gemini-2.0-flash';
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;

  var systemPrompt = 'You are an invoice data extraction assistant. ' +
    'Given an email, extract structured invoice data. ' +
    'ALWAYS respond with valid JSON only, no markdown, no explanation. ' +
    'Use this exact format: ' +
    '{"clientName":"string","clientEmail":"string","clientAddress":"string",' +
    '"items":[{"description":"string","quantity":number,"unitPrice":"string","total":"string"}],' +
    '"subtotal":"string","tax":"string","taxRate":number,"total":"string",' +
    '"currency":"string (3-letter code)","notes":"string","confidence":number}. ' +
    'Rules: ' +
    '- Extract ALL items/services mentioned. ' +
    '- If prices are not explicit, estimate from context and set confidence low. ' +
    '- Default currency to EUR if unclear. ' +
    '- Default taxRate to 21 if in EU context. ' +
    '- If it is a conversation (not a formal order), extract the implied order. ' +
    '- All monetary values as strings with 2 decimal places.';

  var prompt = 'Extract invoice data from this email:\n\n' +
    'FROM: ' + emailData.from + '\n' +
    'TO: ' + emailData.to + '\n' +
    'DATE: ' + emailData.date + '\n' +
    'SUBJECT: ' + emailData.subject + '\n\n' +
    'BODY:\n' + emailData.body;

  var payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }]
      }
    ],
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    },
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json'
    }
  };

  var response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var code = response.getResponseCode();
  if (code !== 200) {
    throw new Error('Gemini API returned ' + code + ': ' + response.getContentText().substring(0, 200));
  }

  var result = JSON.parse(response.getContentText());
  var text = result.candidates[0].content.parts[0].text;

  // Clean potential markdown wrapping
  text = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();

  var parsed = JSON.parse(text);

  // Validate and fill defaults
  return {
    clientName: parsed.clientName || extractNameFromEmail(emailData.from),
    clientEmail: parsed.clientEmail || extractEmailAddress(emailData.from),
    clientAddress: parsed.clientAddress || '',
    items: Array.isArray(parsed.items) ? parsed.items : [],
    subtotal: parsed.subtotal || '0.00',
    tax: parsed.tax || '0.00',
    taxRate: parsed.taxRate || 21,
    total: parsed.total || '0.00',
    currency: parsed.currency || 'EUR',
    notes: parsed.notes || '',
    confidence: parsed.confidence || 0.7,
    threadId: emailData.threadId
  };
}

// ═══════════════════════════════════════════════════════════
// REGEX/HEURISTIC FALLBACK PARSER
// ═══════════════════════════════════════════════════════════

/**
 * Parse email using regex patterns and heuristics (no AI needed).
 */
function parseWithRegex(emailData) {
  var fullText = emailData.subject + '\n' + emailData.body;
  var props = PropertiesService.getScriptProperties();
  var defaultCurrency = props.getProperty('DEFAULT_CURRENCY') || 'EUR';
  var defaultTaxRate = parseInt(props.getProperty('DEFAULT_TAX_RATE') || '21', 10);

  // ── Extract client info ──
  var clientName = extractNameFromEmail(emailData.from);
  var clientEmail = extractEmailAddress(emailData.from);

  // ── Detect currency ──
  var currency = defaultCurrency;
  if (/USD|\$\d/.test(fullText)) currency = 'USD';
  else if (/GBP|£\d/.test(fullText)) currency = 'GBP';
  else if (/PLN|zł/i.test(fullText)) currency = 'PLN';
  else if (/EUR|€\d/.test(fullText)) currency = 'EUR';

  // ── Extract items ──
  var items = extractItems(fullText);

  // ── Extract or calculate totals ──
  var totals = extractTotals(fullText, items, defaultTaxRate, currency);

  // ── Extract notes ──
  var notes = extractNotes(fullText);

  return {
    clientName: clientName,
    clientEmail: clientEmail,
    clientAddress: '',
    items: items,
    subtotal: totals.subtotal,
    tax: totals.tax,
    taxRate: defaultTaxRate,
    total: totals.total,
    currency: currency,
    notes: notes || 'Parsed with basic extraction. Please review.',
    confidence: items.length > 0 ? 0.4 : 0.2,
    threadId: emailData.threadId
  };
}

/**
 * Extract line items from email text.
 */
function extractItems(text) {
  var items = [];
  var lines = text.split('\n');

  // Pattern 1: "2x Widget - €50.00" or "Widget x2 — $50"
  var qtyPriceRegex = /(\d+)\s*[x×]\s*(.+?)\s*[-–—]\s*[€$£]?\s*(\d+[.,]\d{2})/gi;
  var match;
  while ((match = qtyPriceRegex.exec(text)) !== null) {
    var qty = parseInt(match[1], 10);
    var price = parseFloat(match[3].replace(',', '.'));
    items.push({
      description: match[2].trim(),
      quantity: qty,
      unitPrice: (price / qty).toFixed(2),
      total: price.toFixed(2)
    });
  }

  // Pattern 2: "Widget - €50.00" (no quantity)
  if (items.length === 0) {
    var simplePriceRegex = /(.{3,40}?)\s*[-–—:]\s*[€$£]\s*(\d+[.,]\d{2})/gi;
    while ((match = simplePriceRegex.exec(text)) !== null) {
      var desc = match[1].trim();
      // Skip if it looks like metadata
      if (/^(from|to|date|subject|total|subtotal|tax|vat)/i.test(desc)) continue;
      items.push({
        description: desc,
        quantity: 1,
        unitPrice: match[2].replace(',', '.'),
        total: match[2].replace(',', '.')
      });
    }
  }

  // Pattern 3: Lines with numbers that look like prices
  if (items.length === 0) {
    var priceLineRegex = /^(.+?)\s+(\d+[.,]\d{2})\s*$/gm;
    while ((match = priceLineRegex.exec(text)) !== null) {
      var lineDesc = match[1].trim();
      if (lineDesc.length > 3 && lineDesc.length < 80) {
        items.push({
          description: lineDesc,
          quantity: 1,
          unitPrice: match[2].replace(',', '.'),
          total: match[2].replace(',', '.')
        });
      }
    }
  }

  // Pattern 4: Last resort — extract any amounts and use subject as description
  if (items.length === 0) {
    var amounts = extractAmounts(text);
    if (amounts.length > 0) {
      var biggest = Math.max.apply(null, amounts);
      items.push({
        description: text.split('\n')[0].substring(0, 80) || 'Service/Product',
        quantity: 1,
        unitPrice: biggest.toFixed(2),
        total: biggest.toFixed(2)
      });
    }
  }

  return items;
}

/**
 * Extract all monetary amounts from text.
 */
function extractAmounts(text) {
  var amounts = [];
  var patterns = [
    /[€$£]\s*(\d{1,6}[.,]\d{2})/g,
    /(\d{1,6}[.,]\d{2})\s*(?:EUR|USD|GBP|PLN)/g,
    /(?:price|cost|total|amount|sum|charge|fee|pay|invoice)[:\s]*[€$£]?\s*(\d{1,6}[.,]\d{2})/gi
  ];

  patterns.forEach(function(regex) {
    var match;
    while ((match = regex.exec(text)) !== null) {
      amounts.push(parseFloat(match[1].replace(',', '.')));
    }
  });

  return amounts;
}

/**
 * Extract or calculate totals.
 */
function extractTotals(text, items, taxRate, currency) {
  // Try to find explicit total in text
  var totalRegex = /(?:total|grand total|amount due|to pay)[:\s]*[€$£]?\s*(\d{1,6}[.,]\d{2})/i;
  var totalMatch = text.match(totalRegex);

  var total, subtotal, tax;

  if (totalMatch) {
    total = parseFloat(totalMatch[1].replace(',', '.'));
  } else if (items.length > 0) {
    total = items.reduce(function(sum, item) {
      return sum + parseFloat(item.total || 0);
    }, 0);
  } else {
    total = 0;
  }

  // Check for explicit tax
  var taxRegex = /(?:tax|vat|TVA|PVM)[:\s]*[€$£]?\s*(\d{1,6}[.,]\d{2})/i;
  var taxMatch = text.match(taxRegex);

  if (taxMatch) {
    tax = parseFloat(taxMatch[1].replace(',', '.'));
    subtotal = total - tax;
  } else {
    subtotal = total / (1 + taxRate / 100);
    tax = total - subtotal;
  }

  return {
    total: total.toFixed(2),
    subtotal: subtotal.toFixed(2),
    tax: tax.toFixed(2)
  };
}

/**
 * Extract notes/payment instructions from email.
 */
function extractNotes(text) {
  var notePatterns = [
    /(?:payment|pay by|bank|transfer|IBAN)[:\s](.+?)(?:\n\n|\n[A-Z])/is,
    /(?:note|notes|memo)[:\s](.+?)(?:\n\n|\n[A-Z])/is,
    /(?:due|deadline|please pay)[:\s](.+)/i
  ];

  for (var i = 0; i < notePatterns.length; i++) {
    var match = text.match(notePatterns[i]);
    if (match) return match[1].trim().substring(0, 200);
  }

  return '';
}

// ═══════════════════════════════════════════════════════════
// MANUAL EDIT
// ═══════════════════════════════════════════════════════════

/**
 * Show manual item editor.
 */
function onEditItems(e) {
  var parsed = JSON.parse(e.parameters.parsedData);
  var messageId = e.parameters.messageId;

  var card = CardService.newCardBuilder()
    .setHeader(
      CardService.newCardHeader()
        .setTitle('✏️ Edit Invoice Items')
    );

  // Editable items (up to 10)
  var section = CardService.newCardSection().setHeader('Items');

  for (var i = 0; i < 10; i++) {
    var item = parsed.items[i] || {};
    var prefix = 'item' + i + '_';
    var hasData = !!item.description;

    section.addWidget(
      CardService.newTextInput()
        .setFieldName(prefix + 'desc')
        .setTitle('Item ' + (i + 1) + ' Description')
        .setValue(item.description || '')
    );

    if (hasData || i === 0) {
      section.addWidget(
        CardService.newTextInput()
          .setFieldName(prefix + 'qty')
          .setTitle('Qty')
          .setValue(String(item.quantity || 1))
      );
      section.addWidget(
        CardService.newTextInput()
          .setFieldName(prefix + 'price')
          .setTitle('Unit Price')
          .setValue(item.unitPrice || '0.00')
      );
    }
  }

  card.addSection(section);

  // Currency & tax
  card.addSection(
    CardService.newCardSection()
      .setHeader('Totals')
      .addWidget(
        CardService.newSelectionInput()
          .setType(CardService.SelectionInputType.DROPDOWN)
          .setFieldName('currency')
          .setTitle('Currency')
          .addItem('EUR (€)', 'EUR', parsed.currency === 'EUR')
          .addItem('USD ($)', 'USD', parsed.currency === 'USD')
          .addItem('GBP (£)', 'GBP', parsed.currency === 'GBP')
          .addItem('PLN (zł)', 'PLN', parsed.currency === 'PLN')
      )
      .addWidget(
        CardService.newTextInput()
          .setFieldName('taxRate')
          .setTitle('Tax Rate (%)')
          .setValue(String(parsed.taxRate || 21))
      )
  );

  card.addSection(
    CardService.newCardSection()
      .addWidget(
        CardService.newTextButton()
          .setText('✅ Generate Invoice')
          .setOnClickAction(
            CardService.newAction()
              .setFunctionName('onGenerateFromManual')
              .setParameters({
                clientName: parsed.clientName || '',
                clientEmail: parsed.clientEmail || '',
                clientAddress: parsed.clientAddress || '',
                messageId: messageId,
                threadId: parsed.threadId || ''
              })
          )
      )
  );

  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card.build()))
    .build();
}

/**
 * Generate invoice from manually edited form data.
 */
function onGenerateFromManual(e) {
  var inputs = e.formInputs || {};
  var params = e.parameters || {};

  // Collect items from form
  var items = [];
  for (var i = 0; i < 10; i++) {
    var prefix = 'item' + i + '_';
    var desc = getFormValue(inputs, prefix + 'desc');
    if (!desc) continue;

    var qty = parseInt(getFormValue(inputs, prefix + 'qty') || '1', 10);
    var price = parseFloat(getFormValue(inputs, prefix + 'price') || '0');
    var lineTotal = (qty * price).toFixed(2);

    items.push({
      description: desc,
      quantity: qty,
      unitPrice: price.toFixed(2),
      total: lineTotal
    });
  }

  var currency = getFormValue(inputs, 'currency') || 'EUR';
  var taxRate = parseInt(getFormValue(inputs, 'taxRate') || '21', 10);

  var itemsTotal = items.reduce(function(sum, item) {
    return sum + parseFloat(item.total);
  }, 0);

  var subtotal = (itemsTotal / (1 + taxRate / 100)).toFixed(2);
  var tax = (itemsTotal - parseFloat(subtotal)).toFixed(2);

  var parsedData = {
    clientName: params.clientName,
    clientEmail: params.clientEmail,
    clientAddress: params.clientAddress,
    items: items,
    subtotal: subtotal,
    tax: tax,
    taxRate: taxRate,
    total: itemsTotal.toFixed(2),
    currency: currency,
    notes: '',
    threadId: params.threadId
  };

  // Reuse the normal generate flow
  return onGenerateInvoice({
    parameters: {
      parsedData: JSON.stringify(parsedData),
      messageId: params.messageId
    }
  });
}

// ═══════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════

/**
 * Get value from form inputs (handles string/array).
 */
function getFormValue(inputs, key) {
  var val = inputs[key];
  if (!val) return '';
  if (Array.isArray(val)) return val[0] || '';
  return String(val);
}

/**
 * Format items array for display.
 */
function formatItems(items) {
  if (!items.length) return '⚠️ No items detected. Use "Edit Items Manually" to add them.';

  return items.map(function(item, i) {
    return (i + 1) + '. ' + item.description +
      '\n   Qty: ' + item.quantity +
      '  |  Price: ' + item.unitPrice +
      '  |  Total: ' + item.total;
  }).join('\n\n');
}

/**
 * Extract display name from email header.
 */
function extractNameFromEmail(from) {
  if (!from) return '';
  var nameMatch = from.match(/^"?([^"<]+)"?\s*</);
  if (nameMatch) return nameMatch[1].trim();
  var plainMatch = from.match(/^([^<@]+)/);
  return plainMatch ? plainMatch[1].trim() : from;
}

/**
 * Extract email address from header.
 */
function extractEmailAddress(from) {
  if (!from) return '';
  var emailMatch = from.match(/<([^>]+)>/);
  return emailMatch ? emailMatch[1] : from;
}

/**
 * Show an error card.
 */
function showError(msg) {
  var card = CardService.newCardBuilder()
    .addSection(
      CardService.newCardSection()
        .addWidget(
          CardService.newTextParagraph().setText('❌ ' + msg)
        )
    )
    .build();

  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card))
    .build();
}
