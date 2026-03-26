/**
 * InvoiceFly — Invoice Generator
 *
 * Creates invoices from parsed data using Google Docs templates.
 * If no template is configured, auto-creates a professional default template.
 */

/**
 * Generate an invoice from parsed email data.
 */
function onGenerateInvoice(e) {
  var parsed = JSON.parse(e.parameters.parsedData);
  var messageId = e.parameters.messageId;

  try {
    var invoiceUrl = createInvoice(parsed);

    // Label the Gmail thread
    labelThread(messageId, 'InvoiceFly/Invoice Created');

    var card = CardService.newCardBuilder()
      .setHeader(
        CardService.newCardHeader()
          .setTitle('✅ Invoice Created!')
      )
      .addSection(
        CardService.newCardSection()
          .addWidget(
            CardService.newKeyValue()
              .setTopLabel('Invoice #')
              .setContent(parsed.invoiceNumber || 'AUTO')
          )
          .addWidget(
            CardService.newKeyValue()
              .setTopLabel('Client')
              .setContent(parsed.clientName)
          )
          .addWidget(
            CardService.newKeyValue()
              .setTopLabel('Total')
              .setContent(parsed.currency + ' ' + parsed.total)
          )
      )
      .addSection(
        CardService.newCardSection()
          .addWidget(
            CardService.newTextButton()
              .setText('📄 Open Invoice')
              .setOpenLink(CardService.newOpenLink().setUrl(invoiceUrl))
          )
          .addWidget(
            CardService.newTextButton()
              .setText('📤 Send to Client')
              .setOnClickAction(
                CardService.newAction()
                  .setFunctionName('onSendInvoice')
                  .setParameters({
                    invoiceUrl: invoiceUrl,
                    clientEmail: parsed.clientEmail,
                    invoiceNumber: parsed.invoiceNumber || 'N/A'
                  })
              )
          )
      )
      .build();

    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().pushCard(card))
      .build();

  } catch (err) {
    return showError('Invoice generation failed: ' + err.message);
  }
}

/**
 * Create invoice document from template.
 * If no template is set, auto-creates one.
 */
function createInvoice(data) {
  var props = PropertiesService.getScriptProperties();

  // Generate invoice number
  var invoiceNum = generateInvoiceNumber();
  data.invoiceNumber = invoiceNum;

  // Get or create template
  var templateDocId = props.getProperty('TEMPLATE_DOC_ID');
  if (!templateDocId) {
    templateDocId = createDefaultTemplate();
    props.setProperty('TEMPLATE_DOC_ID', templateDocId);
  }

  // Get or create invoice folder
  var folderId = props.getProperty('INVOICE_FOLDER_ID');
  var folder;
  if (folderId) {
    folder = DriveApp.getFolderById(folderId);
  } else {
    folder = DriveApp.createFolder('InvoiceFly Invoices');
    props.setProperty('INVOICE_FOLDER_ID', folder.getId());
  }

  // Copy template
  var templateFile = DriveApp.getFileById(templateDocId);
  var invoiceName = 'Invoice ' + invoiceNum + ' - ' + data.clientName;
  var copy = templateFile.makeCopy(invoiceName, folder);
  var doc = DocumentApp.openById(copy.getId());
  var body = doc.getBody();

  // Get business info from settings
  var businessName = props.getProperty('BUSINESS_NAME') || 'Your Business';
  var businessEmail = props.getProperty('BUSINESS_EMAIL') || '';
  var businessAddress = props.getProperty('BUSINESS_ADDRESS') || '';
  var taxId = props.getProperty('TAX_ID') || '';
  var paymentTerms = props.getProperty('PAYMENT_TERMS') || '14';

  // Calculate due date
  var dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + parseInt(paymentTerms, 10));

  // Replace all placeholders
  var replacements = {
    '{{INVOICE_NUMBER}}': invoiceNum,
    '{{DATE}}': formatDate(new Date()),
    '{{DUE_DATE}}': formatDate(dueDate),
    '{{BUSINESS_NAME}}': businessName,
    '{{BUSINESS_EMAIL}}': businessEmail,
    '{{BUSINESS_ADDRESS}}': businessAddress,
    '{{TAX_ID}}': taxId,
    '{{CLIENT_NAME}}': data.clientName || '',
    '{{CLIENT_EMAIL}}': data.clientEmail || '',
    '{{CLIENT_ADDRESS}}': data.clientAddress || '',
    '{{CURRENCY}}': data.currency || 'EUR',
    '{{SUBTOTAL}}': data.subtotal || '0.00',
    '{{TAX}}': data.tax || '0.00',
    '{{TOTAL}}': data.total || '0.00',
    '{{PAYMENT_TERMS}}': paymentTerms,
    '{{NOTES}}': data.notes || 'Thank you for your business!'
  };

  for (var placeholder in replacements) {
    body.replaceText(escapeRegex(placeholder), replacements[placeholder]);
  }

  // Replace items
  var itemsText = (data.items || []).map(function(item, i) {
    return (i + 1) + '.  ' + item.description +
      '\n     Qty: ' + item.quantity +
      '   |   Price: ' + item.unitPrice +
      '   |   Total: ' + item.total;
  }).join('\n\n');
  body.replaceText(escapeRegex('{{ITEMS}}'), itemsText || 'No items');

  doc.saveAndClose();

  // Track the invoice
  trackInvoice({
    invoiceNumber: invoiceNum,
    clientName: data.clientName,
    clientEmail: data.clientEmail,
    currency: data.currency,
    subtotal: data.subtotal,
    tax: data.tax,
    total: data.total,
    docUrl: copy.getUrl(),
    threadId: data.threadId || '',
    notes: data.notes || ''
  });

  return copy.getUrl();
}

/**
 * Create a professional default invoice template in Google Docs.
 * Uses the bundled TemplateHtml.html file — uploaded as HTML and
 * converted to Google Docs format via the Drive API.
 */
function createDefaultTemplate() {
  var html = HtmlService.createHtmlOutputFromFile('TemplateHtml').getContent();

  var blob = Utilities.newBlob(html, 'text/html', 'InvoiceFly — Invoice Template.html');

  var resource = {
    title: 'InvoiceFly — Invoice Template',
    mimeType: 'application/vnd.google-apps.document'
  };

  var file = Drive.Files.insert(resource, blob, { convert: true });

  Logger.log('Default template created from HTML: ' + file.id);
  return file.id;
}

/**
 * Generate sequential invoice number.
 */
function generateInvoiceNumber() {
  var props = PropertiesService.getScriptProperties();
  var lastNum = parseInt(props.getProperty('LAST_INVOICE_NUM') || '0', 10);
  var newNum = lastNum + 1;
  props.setProperty('LAST_INVOICE_NUM', String(newNum));

  var year = new Date().getFullYear();
  return 'INV-' + year + '-' + String(newNum).padStart(4, '0');
}

/**
 * Format date as YYYY-MM-DD.
 */
function formatDate(d) {
  var year = d.getFullYear();
  var month = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str) {
  return str.replace(/[{}()[\]\\.*+?^$|]/g, '\\$&');
}

/**
 * Store invoice record in a spreadsheet for tracking.
 * (Legacy function — kept for compatibility, delegates to Tracker.gs)
 */
function storeInvoiceRecord(invoiceNum, data, url) {
  trackInvoice({
    invoiceNumber: invoiceNum,
    clientName: data.clientName,
    clientEmail: data.clientEmail,
    currency: data.currency,
    subtotal: data.subtotal,
    tax: data.tax,
    total: data.total,
    docUrl: url,
    threadId: data.threadId || '',
    notes: data.notes || ''
  });
}

/**
 * Send invoice to client via email.
 */
function onSendInvoice(e) {
  var clientEmail = e.parameters.clientEmail;
  var invoiceUrl = e.parameters.invoiceUrl;
  var invoiceNumber = e.parameters.invoiceNumber;

  var props = PropertiesService.getScriptProperties();
  var businessName = props.getProperty('BUSINESS_NAME') || 'Your Business';

  GmailApp.sendEmail(clientEmail, 'Invoice ' + invoiceNumber + ' from ' + businessName,
    'Hello,\n\n' +
    'Please find your invoice below.\n\n' +
    'Invoice: ' + invoiceNumber + '\n' +
    'View online: ' + invoiceUrl + '\n\n' +
    'Thank you for your business!\n' +
    businessName,
    { name: businessName }
  );

  // Update status
  updateInvoiceStatus(invoiceNumber, 'Sent');

  return CardService.newActionResponseBuilder()
    .setNotification(
      CardService.newNotification().setText('✅ Invoice sent to ' + clientEmail)
    )
    .build();
}

/**
 * Quick invoice — parse and generate in one step with defaults.
 */
function onQuickInvoice(e) {
  onParseEmail(e);
}

/**
 * Apply or create a Gmail label.
 */
function labelThread(messageId, labelName) {
  try {
    var message = GmailApp.getMessageById(messageId);
    var thread = message.getThread();
    var label = GmailApp.getUserLabelByName(labelName) ||
                GmailApp.createLabel(labelName);
    thread.addLabel(label);
  } catch (err) {
    Logger.log('Label error: ' + err.message);
  }
}
