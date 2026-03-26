/**
 * InvoiceFly — Email Parser
 *
 * Extracts invoice-relevant data from emails using AI (Gemini API).
 */

var BACKEND_URL = PropertiesService.getScriptProperties().getProperty('BACKEND_URL') || '';

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

  // Call backend for AI parsing
  var parsed;
  try {
    parsed = callBackend('/parse', emailData);
  } catch (err) {
    return showError('Parsing failed: ' + err.message);
  }

  // Show extracted data for review
  var card = CardService.newCardBuilder()
    .setHeader(
      CardService.newCardHeader()
        .setTitle('Extracted Invoice Data')
        .setSubtitle('Review and edit before generating')
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
        .addWidget(
          CardService.newKeyValue()
            .setTopLabel('Total')
            .setContent(parsed.currency + ' ' + (parsed.total || '0.00'))
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
            .setText('✏️ Edit Manually')
            .setOnClickAction(
              CardService.newAction()
                .setFunctionName('onEditInvoice')
                .setParameters({ parsedData: JSON.stringify(parsed) })
            )
        )
    )
    .build();

  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card))
    .build();
}

/**
 * Call the Cloud Run backend.
 */
function callBackend(endpoint, payload) {
  if (!BACKEND_URL) {
    throw new Error('Backend URL not configured. Go to Settings.');
  }

  var response = UrlFetchApp.fetch(BACKEND_URL + endpoint, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    throw new Error('Backend returned ' + response.getResponseCode());
  }

  return JSON.parse(response.getContentText());
}

/**
 * Format items array for display.
 */
function formatItems(items) {
  if (!items.length) return 'No items detected.';

  return items.map(function(item, i) {
    return (i + 1) + '. ' + item.description +
      ' — ' + item.quantity + ' × ' + item.unitPrice +
      ' = ' + item.total;
  }).join('\n');
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
