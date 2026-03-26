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
  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty('TRACKER_SHEET_ID');

  // Verify tracker still exists, clear stale ID if not
  if (sheetId && fileExists(sheetId)) {
    return [buildDashboard()];
  } else if (sheetId) {
    // Stale ID — file was deleted
    props.deleteProperty('TRACKER_SHEET_ID');
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
            .setText('🚀 Set Up Everything (Template, Folder, Tracker, Labels)')
            .setOnClickAction(
              CardService.newAction().setFunctionName('onRunSetup')
            )
        )
        .addWidget(
          CardService.newTextButton()
            .setText('🏷️ Initialize Labels Only')
            .setOnClickAction(
              CardService.newAction().setFunctionName('onInitLabels')
            )
        )
    )
    .build();

  return [card];
}

/**
 * One-click setup: creates template, folder, tracker, and labels.
 */
function onRunSetup(e) {
  var props = PropertiesService.getScriptProperties();
  var created = [];

  // 1. Create or verify parent folder: "InvoiceFly"
  var parentFolderId = props.getProperty('PARENT_FOLDER_ID');
  var parentFolder;
  if (!parentFolderId || !fileExists(parentFolderId)) {
    parentFolder = DriveApp.createFolder('InvoiceFly');
    parentFolderId = parentFolder.getId();
    props.setProperty('PARENT_FOLDER_ID', parentFolderId);
    // Clear child IDs since parent is new
    props.deleteProperty('TEMPLATE_DOC_ID');
    props.deleteProperty('INVOICE_FOLDER_ID');
    props.deleteProperty('TRACKER_SHEET_ID');
    created.push('📂 InvoiceFly folder');
  } else {
    parentFolder = DriveApp.getFolderById(parentFolderId);
  }

  // 2. Invoice template (inside InvoiceFly/)
  var templateId = props.getProperty('TEMPLATE_DOC_ID');
  if (!templateId || !fileExists(templateId)) {
    templateId = createDefaultTemplate();
    var templateFile = DriveApp.getFileById(templateId);
    parentFolder.addFile(templateFile);
    DriveApp.getRootFolder().removeFile(templateFile);
    props.setProperty('TEMPLATE_DOC_ID', templateId);
    created.push('📄 Invoice template');
  }

  // 3. Invoices subfolder (InvoiceFly/Invoices/)
  var invoiceFolderId = props.getProperty('INVOICE_FOLDER_ID');
  if (!invoiceFolderId || !fileExists(invoiceFolderId)) {
    var invoicesFolder = parentFolder.createFolder('Invoices');
    props.setProperty('INVOICE_FOLDER_ID', invoicesFolder.getId());
    created.push('📁 Invoices folder');
  }

  // 4. Tracker spreadsheet (inside InvoiceFly/)
  var trackerId = props.getProperty('TRACKER_SHEET_ID');
  if (!trackerId || !fileExists(trackerId)) {
    var sheetId = initializeTracker();
    var trackerFile = DriveApp.getFileById(sheetId);
    parentFolder.addFile(trackerFile);
    DriveApp.getRootFolder().removeFile(trackerFile);
    created.push('📊 Invoice tracker');
  }

  // 5. Gmail labels
  initializeLabels();
  created.push('🏷️ Gmail labels');

  var summary = created.length > 0
    ? 'Created:\n' + created.join('\n')
    : 'Everything was already set up!';

  // Show confirmation with links
  var card = CardService.newCardBuilder()
    .setHeader(
      CardService.newCardHeader()
        .setTitle('✅ Setup Complete!')
    )
    .addSection(
      CardService.newCardSection()
        .addWidget(
          CardService.newTextParagraph().setText(summary)
        )
    )
    .addSection(
      CardService.newCardSection()
        .setHeader('Your Resources')
        .addWidget(
          CardService.newTextButton()
            .setText('📂 Open InvoiceFly Folder')
            .setOpenLink(
              CardService.newOpenLink()
                .setUrl('https://drive.google.com/drive/folders/' + props.getProperty('PARENT_FOLDER_ID'))
            )
        )
        .addWidget(
          CardService.newTextButton()
            .setText('📄 Open Invoice Template')
            .setOpenLink(
              CardService.newOpenLink()
                .setUrl('https://docs.google.com/document/d/' + props.getProperty('TEMPLATE_DOC_ID') + '/edit')
            )
        )
        .addWidget(
          CardService.newTextButton()
            .setText('📁 Open Invoices Folder')
            .setOpenLink(
              CardService.newOpenLink()
                .setUrl('https://drive.google.com/drive/folders/' + props.getProperty('INVOICE_FOLDER_ID'))
            )
        )
        .addWidget(
          CardService.newTextButton()
            .setText('📊 Open Invoice Tracker')
            .setOpenLink(
              CardService.newOpenLink()
                .setUrl('https://docs.google.com/spreadsheets/d/' + props.getProperty('TRACKER_SHEET_ID') + '/edit')
            )
        )
    )
    .addSection(
      CardService.newCardSection()
        .addWidget(
          CardService.newTextParagraph()
            .setText('💡 Tip: Customize the template by editing the Google Doc. ' +
                     'Just keep the {{PLACEHOLDERS}} intact — they get replaced with real data.')
        )
        .addWidget(
          CardService.newTextButton()
            .setText('⚙️ Configure Business Info')
            .setOnClickAction(
              CardService.newAction().setFunctionName('onSettings')
            )
        )
    )
    .build();

  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card))
    .build();
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
 * Check if a Drive file/folder still exists.
 */
function fileExists(fileId) {
  try {
    DriveApp.getFileById(fileId);
    return true;
  } catch (e) {
    try {
      DriveApp.getFolderById(fileId);
      return true;
    } catch (e2) {
      return false;
    }
  }
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
