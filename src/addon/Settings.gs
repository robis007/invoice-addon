/**
 * InvoiceFly — Settings
 *
 * Configuration UI for the add-on.
 */

/**
 * Show settings card.
 */
function onSettings(e) {
  var props = PropertiesService.getScriptProperties();

  var card = CardService.newCardBuilder()
    .setHeader(
      CardService.newCardHeader()
        .setTitle('⚙️ Settings')
        .setSubtitle('Configure InvoiceFly')
    )
    .addSection(
      CardService.newCardSection()
        .setHeader('Business Info')
        .addWidget(
          CardService.newTextInput()
            .setFieldName('businessName')
            .setTitle('Business Name')
            .setValue(props.getProperty('BUSINESS_NAME') || '')
        )
        .addWidget(
          CardService.newTextInput()
            .setFieldName('businessEmail')
            .setTitle('Business Email')
            .setValue(props.getProperty('BUSINESS_EMAIL') || '')
        )
        .addWidget(
          CardService.newTextInput()
            .setFieldName('businessAddress')
            .setTitle('Business Address')
            .setValue(props.getProperty('BUSINESS_ADDRESS') || '')
        )
        .addWidget(
          CardService.newTextInput()
            .setFieldName('taxId')
            .setTitle('Tax / VAT ID')
            .setValue(props.getProperty('TAX_ID') || '')
        )
    )
    .addSection(
      CardService.newCardSection()
        .setHeader('Invoice Defaults')
        .addWidget(
          CardService.newSelectionInput()
            .setType(CardService.SelectionInputType.DROPDOWN)
            .setFieldName('defaultCurrency')
            .setTitle('Default Currency')
            .addItem('EUR (€)', 'EUR', props.getProperty('DEFAULT_CURRENCY') === 'EUR' || !props.getProperty('DEFAULT_CURRENCY'))
            .addItem('USD ($)', 'USD', props.getProperty('DEFAULT_CURRENCY') === 'USD')
            .addItem('GBP (£)', 'GBP', props.getProperty('DEFAULT_CURRENCY') === 'GBP')
            .addItem('PLN (zł)', 'PLN', props.getProperty('DEFAULT_CURRENCY') === 'PLN')
        )
        .addWidget(
          CardService.newTextInput()
            .setFieldName('defaultTaxRate')
            .setTitle('Default Tax Rate (%)')
            .setValue(props.getProperty('DEFAULT_TAX_RATE') || '21')
        )
        .addWidget(
          CardService.newTextInput()
            .setFieldName('paymentTerms')
            .setTitle('Payment Terms (days)')
            .setValue(props.getProperty('PAYMENT_TERMS') || '14')
        )
    )
    .addSection(
      CardService.newCardSection()
        .setHeader('AI Parsing')
        .addWidget(
          CardService.newTextParagraph()
            .setText('Add a Gemini API key for AI-powered email parsing. ' +
                     'Without it, basic regex parsing is used.\n' +
                     'Get a free key at: aistudio.google.com/apikey')
        )
        .addWidget(
          CardService.newTextInput()
            .setFieldName('geminiApiKey')
            .setTitle('Gemini API Key')
            .setValue(props.getProperty('GEMINI_API_KEY') ? '••••••••' + props.getProperty('GEMINI_API_KEY').slice(-4) : '')
        )
    )
    .addSection(
      CardService.newCardSection()
        .setHeader('Connections')
        .addWidget(
          CardService.newTextInput()
            .setFieldName('templateDocId')
            .setTitle('Invoice Template (Google Doc ID)')
            .setValue(props.getProperty('TEMPLATE_DOC_ID') || '')
            .setHint('Leave empty to auto-create')
        )
        .addWidget(
          CardService.newTextInput()
            .setFieldName('invoiceFolderId')
            .setTitle('Invoice Folder (Google Drive ID)')
            .setValue(props.getProperty('INVOICE_FOLDER_ID') || '')
            .setHint('Leave empty to auto-create')
        )
        .addWidget(
          CardService.newTextInput()
            .setFieldName('trackerSheetId')
            .setTitle('Invoice Tracker (Google Sheet ID)')
            .setValue(props.getProperty('TRACKER_SHEET_ID') || '')
            .setHint('Leave empty to auto-create')
        )
    )
    .addSection(
      CardService.newCardSection()
        .addWidget(
          CardService.newTextButton()
            .setText('💾 Save Settings')
            .setOnClickAction(
              CardService.newAction().setFunctionName('onSaveSettings')
            )
        )
    )
    .build();

  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card))
    .build();
}

/**
 * Save settings from the form.
 */
function onSaveSettings(e) {
  var inputs = e.formInputs;
  var props = PropertiesService.getScriptProperties();

  var fields = {
    'BUSINESS_NAME': 'businessName',
    'BUSINESS_EMAIL': 'businessEmail',
    'BUSINESS_ADDRESS': 'businessAddress',
    'TAX_ID': 'taxId',
    'DEFAULT_CURRENCY': 'defaultCurrency',
    'DEFAULT_TAX_RATE': 'defaultTaxRate',
    'PAYMENT_TERMS': 'paymentTerms',
    'TEMPLATE_DOC_ID': 'templateDocId',
    'INVOICE_FOLDER_ID': 'invoiceFolderId',
    'TRACKER_SHEET_ID': 'trackerSheetId'
  };

  for (var propKey in fields) {
    var formKey = fields[propKey];
    if (inputs[formKey]) {
      var value = inputs[formKey];
      if (Array.isArray(value)) value = value[0];
      props.setProperty(propKey, String(value));
    }
  }

  // Handle Gemini API key separately (don't overwrite with masked value)
  if (inputs['geminiApiKey']) {
    var keyValue = inputs['geminiApiKey'];
    if (Array.isArray(keyValue)) keyValue = keyValue[0];
    keyValue = String(keyValue);
    // Only save if it's a real key (not the masked display)
    if (keyValue && !keyValue.startsWith('••')) {
      props.setProperty('GEMINI_API_KEY', keyValue);
    }
  }

  return CardService.newActionResponseBuilder()
    .setNotification(
      CardService.newNotification().setText('✅ Settings saved!')
    )
    .build();
}

/**
 * Show recent invoices.
 */
function onViewInvoices(e) {
  var sheetId = PropertiesService.getScriptProperties().getProperty('TRACKER_SHEET_ID');

  if (!sheetId) {
    return showError('No invoice tracker configured. Go to Settings and add a Google Sheet ID.');
  }

  try {
    var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('Invoices');
    var data = sheet.getDataRange().getValues();
    var recent = data.slice(-10).reverse(); // Last 10, newest first

    var section = CardService.newCardSection().setHeader('Recent Invoices');

    if (recent.length === 0) {
      section.addWidget(
        CardService.newTextParagraph().setText('No invoices yet.')
      );
    } else {
      recent.forEach(function(row) {
        section.addWidget(
          CardService.newKeyValue()
            .setTopLabel(row[0]) // Invoice number
            .setContent(row[2] + ' — ' + row[4]) // Client — Amount
            .setBottomLabel(row[5]) // Status
            .setOnClickAction(
              CardService.newAction()
                .setFunctionName('onOpenInvoiceLink')
                .setParameters({ url: row[6] })
            )
        );
      });
    }

    var card = CardService.newCardBuilder()
      .setHeader(
        CardService.newCardHeader()
          .setTitle('🧾 Recent Invoices')
      )
      .addSection(section)
      .build();

    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().pushCard(card))
      .build();

  } catch (err) {
    return showError('Could not load invoices: ' + err.message);
  }
}

/**
 * Open invoice link.
 */
function onOpenInvoiceLink(e) {
  return CardService.newActionResponseBuilder()
    .setOpenLink(CardService.newOpenLink().setUrl(e.parameters.url))
    .build();
}
