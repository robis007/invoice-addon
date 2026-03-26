/**
 * InvoiceFly — Invoice Generator
 *
 * Creates invoices from parsed data using Google Docs templates.
 */

var TEMPLATE_DOC_ID = PropertiesService.getScriptProperties().getProperty('TEMPLATE_DOC_ID') || '';
var INVOICE_FOLDER_ID = PropertiesService.getScriptProperties().getProperty('INVOICE_FOLDER_ID') || '';

/**
 * Generate an invoice from parsed email data.
 */
function onGenerateInvoice(e) {
  var parsed = JSON.parse(e.parameters.parsedData);
  var messageId = e.parameters.messageId;

  try {
    var invoiceUrl = createInvoice(parsed);

    // Label the Gmail thread
    labelThread(messageId, 'InvoiceFly/Invoice Sent');

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
 */
function createInvoice(data) {
  // Generate invoice number
  var invoiceNum = generateInvoiceNumber();
  data.invoiceNumber = invoiceNum;

  // Copy template
  var templateFile = DriveApp.getFileById(TEMPLATE_DOC_ID);
  var folder = INVOICE_FOLDER_ID
    ? DriveApp.getFolderById(INVOICE_FOLDER_ID)
    : DriveApp.getRootFolder();

  var invoiceName = 'Invoice ' + invoiceNum + ' - ' + data.clientName;
  var copy = templateFile.makeCopy(invoiceName, folder);
  var doc = DocumentApp.openById(copy.getId());
  var body = doc.getBody();

  // Replace placeholders
  body.replaceText('{{INVOICE_NUMBER}}', invoiceNum);
  body.replaceText('{{DATE}}', new Date().toLocaleDateString('lt-LT'));
  body.replaceText('{{CLIENT_NAME}}', data.clientName || '');
  body.replaceText('{{CLIENT_EMAIL}}', data.clientEmail || '');
  body.replaceText('{{CLIENT_ADDRESS}}', data.clientAddress || '');
  body.replaceText('{{CURRENCY}}', data.currency || 'EUR');
  body.replaceText('{{TOTAL}}', data.total || '0.00');
  body.replaceText('{{TAX}}', data.tax || '0.00');
  body.replaceText('{{SUBTOTAL}}', data.subtotal || '0.00');
  body.replaceText('{{NOTES}}', data.notes || '');

  // Replace items table (simplified — single block replacement)
  var itemsText = (data.items || []).map(function(item, i) {
    return (i + 1) + '. ' + item.description +
      '  |  Qty: ' + item.quantity +
      '  |  Price: ' + item.unitPrice +
      '  |  Total: ' + item.total;
  }).join('\n');
  body.replaceText('{{ITEMS}}', itemsText || 'No items');

  doc.saveAndClose();

  // Store invoice record
  storeInvoiceRecord(invoiceNum, data, copy.getUrl());

  return copy.getUrl();
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
 * Store invoice record in a spreadsheet for tracking.
 */
function storeInvoiceRecord(invoiceNum, data, url) {
  var sheetId = PropertiesService.getScriptProperties().getProperty('TRACKER_SHEET_ID');
  if (!sheetId) return;

  var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('Invoices');
  if (!sheet) return;

  sheet.appendRow([
    invoiceNum,
    new Date(),
    data.clientName,
    data.clientEmail,
    data.currency + ' ' + data.total,
    'Created',
    url
  ]);
}

/**
 * Send invoice to client via email.
 */
function onSendInvoice(e) {
  var clientEmail = e.parameters.clientEmail;
  var invoiceUrl = e.parameters.invoiceUrl;
  var invoiceNumber = e.parameters.invoiceNumber;

  // Get business info from settings
  var props = PropertiesService.getScriptProperties();
  var businessName = props.getProperty('BUSINESS_NAME') || 'Your Business';

  GmailApp.sendEmail(clientEmail, 'Invoice ' + invoiceNumber + ' from ' + businessName,
    'Hello,\n\nPlease find your invoice attached.\n\n' +
    'Invoice: ' + invoiceNumber + '\n' +
    'View online: ' + invoiceUrl + '\n\n' +
    'Thank you for your business!\n' +
    businessName,
    {
      name: businessName
    }
  );

  // Update tracker
  // TODO: Update spreadsheet status to "Sent"

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
  onParseEmail(e); // First parse, then auto-generate
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
