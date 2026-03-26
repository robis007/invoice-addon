/**
 * InvoiceFly — Gmail Add-on Main Entry
 *
 * Homepage and contextual triggers for the Gmail sidebar.
 */

/**
 * Called when the add-on homepage is opened.
 * Shows the dashboard if tracker exists, otherwise shows onboarding.
 */
function onHomepage(e) {
  var sheetId = PropertiesService.getScriptProperties().getProperty('TRACKER_SHEET_ID');

  if (sheetId) {
    // Show dashboard
    return [buildDashboard()];
  }

  // Onboarding / quick actions
  var card = CardService.newCardBuilder()
    .setHeader(
      CardService.newCardHeader()
        .setTitle('InvoiceFly')
        .setSubtitle('Turn emails into invoices')
        .setImageUrl('https://via.placeholder.com/48?text=IF')
    )
    .addSection(
      CardService.newCardSection()
        .setHeader('Welcome! 👋')
        .addWidget(
          CardService.newTextParagraph()
            .setText('Open any email and click "Parse & Extract" to create your first invoice. ' +
                     'A tracker spreadsheet will be auto-created for you.')
        )
    )
    .addSection(
      CardService.newCardSection()
        .setHeader('Quick Actions')
        .addWidget(
          CardService.newTextButton()
            .setText('⚙️ Configure Settings')
            .setOnClickAction(
              CardService.newAction().setFunctionName('onSettings')
            )
        )
        .addWidget(
          CardService.newTextButton()
            .setText('🏷️ Initialize Labels')
            .setOnClickAction(
              CardService.newAction().setFunctionName('onInitLabels')
            )
        )
    )
    .build();

  return [card];
}

/**
 * Initialize labels and show confirmation.
 */
function onInitLabels(e) {
  initializeLabels();
  return CardService.newActionResponseBuilder()
    .setNotification(
      CardService.newNotification().setText('✅ InvoiceFly labels created in Gmail!')
    )
    .build();
}

/**
 * Called when a Gmail message is opened (contextual trigger).
 */
function onGmailMessageOpen(e) {
  var messageId = e.gmail.messageId;
  var message = GmailApp.getMessageById(messageId);
  var subject = message.getSubject();
  var from = message.getFrom();
  var body = message.getPlainBody().substring(0, 2000); // Limit for parsing

  var card = CardService.newCardBuilder()
    .setHeader(
      CardService.newCardHeader()
        .setTitle('InvoiceFly')
        .setSubtitle('Create invoice from this email')
    )
    .addSection(
      CardService.newCardSection()
        .setHeader('Email Summary')
        .addWidget(
          CardService.newKeyValue()
            .setTopLabel('From')
            .setContent(from)
        )
        .addWidget(
          CardService.newKeyValue()
            .setTopLabel('Subject')
            .setContent(subject)
        )
    )
    .addSection(
      CardService.newCardSection()
        .addWidget(
          CardService.newTextButton()
            .setText('🔍 Parse & Extract Invoice Data')
            .setOnClickAction(
              CardService.newAction()
                .setFunctionName('onParseEmail')
                .setParameters({ messageId: messageId })
            )
        )
        .addWidget(
          CardService.newTextButton()
            .setText('⚡ Quick Invoice (Use Defaults)')
            .setOnClickAction(
              CardService.newAction()
                .setFunctionName('onQuickInvoice')
                .setParameters({ messageId: messageId })
            )
        )
        .addWidget(
          CardService.newTextButton()
            .setText('🔁 Check Recurring Pattern')
            .setOnClickAction(
              CardService.newAction()
                .setFunctionName('onCheckRecurring')
                .setParameters({ clientEmail: from.replace(/.*<([^>]+)>.*/, '$1') })
            )
        )
    )
    .build();

  return [card];
}
