/**
 * InvoiceFly — Gmail Add-on Main Entry
 *
 * Homepage and contextual triggers for the Gmail sidebar.
 */

/**
 * Called when the add-on homepage is opened.
 */
function onHomepage(e) {
  var card = CardService.newCardBuilder()
    .setHeader(
      CardService.newCardHeader()
        .setTitle('InvoiceFly')
        .setSubtitle('Turn emails into invoices')
        .setImageUrl('https://via.placeholder.com/48?text=IF')
    )
    .addSection(
      CardService.newCardSection()
        .setHeader('Quick Actions')
        .addWidget(
          CardService.newTextButton()
            .setText('📧 Parse Current Email')
            .setOnClickAction(
              CardService.newAction().setFunctionName('onParseEmail')
            )
        )
        .addWidget(
          CardService.newTextButton()
            .setText('🧾 View Recent Invoices')
            .setOnClickAction(
              CardService.newAction().setFunctionName('onViewInvoices')
            )
        )
        .addWidget(
          CardService.newTextButton()
            .setText('⚙️ Settings')
            .setOnClickAction(
              CardService.newAction().setFunctionName('onSettings')
            )
        )
    )
    .build();

  return [card];
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
    )
    .build();

  return [card];
}
