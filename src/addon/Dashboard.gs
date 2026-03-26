/**
 * InvoiceFly — Dashboard
 *
 * Income overview, client stats, and overdue alerts.
 * Displayed in the Gmail sidebar homepage.
 */

/**
 * Build the dashboard card with stats.
 */
function buildDashboard() {
  var stats = calculateStats();

  var card = CardService.newCardBuilder()
    .setHeader(
      CardService.newCardHeader()
        .setTitle('📊 Dashboard')
        .setSubtitle(getCurrentMonthName() + ' ' + new Date().getFullYear())
    );

  // Revenue overview
  card.addSection(
    CardService.newCardSection()
      .setHeader('Revenue')
      .addWidget(
        CardService.newDecoratedText()
          .setTopLabel('This Month')
          .setText(stats.currency + ' ' + stats.monthRevenue)
          .setBottomLabel(stats.monthInvoiceCount + ' invoices')
      )
      .addWidget(
        CardService.newDecoratedText()
          .setTopLabel('Outstanding')
          .setText(stats.currency + ' ' + stats.outstanding)
          .setBottomLabel(stats.unpaidCount + ' unpaid')
      )
      .addWidget(
        CardService.newDecoratedText()
          .setTopLabel('All Time')
          .setText(stats.currency + ' ' + stats.totalRevenue)
          .setBottomLabel(stats.totalInvoiceCount + ' invoices total')
      )
  );

  // Overdue alerts
  if (stats.overdueCount > 0) {
    var overdueSection = CardService.newCardSection()
      .setHeader('⚠️ Overdue (' + stats.overdueCount + ')');

    stats.overdue.slice(0, 5).forEach(function(inv) {
      overdueSection.addWidget(
        CardService.newDecoratedText()
          .setTopLabel(inv.invoiceNumber)
          .setText(inv.clientName + ' — ' + inv.currency + ' ' + inv.total)
          .setBottomLabel(inv.daysPastDue + ' days overdue')
          .setOnClickAction(
            CardService.newAction()
              .setFunctionName('onOverdueAction')
              .setParameters({
                invoiceNumber: inv.invoiceNumber,
                clientEmail: inv.clientEmail
              })
          )
      );
    });

    card.addSection(overdueSection);
  }

  // Top clients
  if (stats.topClients.length > 0) {
    var clientSection = CardService.newCardSection()
      .setHeader('Top Clients');

    stats.topClients.slice(0, 5).forEach(function(client, i) {
      clientSection.addWidget(
        CardService.newDecoratedText()
          .setTopLabel('#' + (i + 1))
          .setText(client.name)
          .setBottomLabel(stats.currency + ' ' + client.total + ' (' + client.count + ' invoices)')
      );
    });

    card.addSection(clientSection);
  }

  // Quick actions
  card.addSection(
    CardService.newCardSection()
      .addWidget(
        CardService.newTextButton()
          .setText('📋 All Invoices')
          .setOnClickAction(
            CardService.newAction().setFunctionName('onViewInvoices')
          )
      )
      .addWidget(
        CardService.newTextButton()
          .setText('🔁 Recurring')
          .setOnClickAction(
            CardService.newAction().setFunctionName('onViewRecurring')
          )
      )
      .addWidget(
        CardService.newTextButton()
          .setText('📊 Open Full Tracker')
          .setOnClickAction(
            CardService.newAction().setFunctionName('onOpenTracker')
          )
      )
      .addWidget(
        CardService.newTextButton()
          .setText('⚙️ Settings')
          .setOnClickAction(
            CardService.newAction().setFunctionName('onSettings')
          )
      )
  );

  return card.build();
}

/**
 * Calculate stats from tracker spreadsheet.
 */
function calculateStats() {
  var sheetId = PropertiesService.getScriptProperties().getProperty('TRACKER_SHEET_ID');
  var currency = PropertiesService.getScriptProperties().getProperty('DEFAULT_CURRENCY') || 'EUR';

  var defaults = {
    currency: currency,
    monthRevenue: '0.00',
    monthInvoiceCount: 0,
    outstanding: '0.00',
    unpaidCount: 0,
    totalRevenue: '0.00',
    totalInvoiceCount: 0,
    overdueCount: 0,
    overdue: [],
    topClients: []
  };

  if (!sheetId) return defaults;

  try {
    var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('Invoices');
    if (!sheet || sheet.getLastRow() <= 1) return defaults;

    var data = sheet.getDataRange().getValues();
    var now = new Date();
    var currentMonth = now.getMonth();
    var currentYear = now.getFullYear();

    var monthRevenue = 0, monthCount = 0;
    var totalRevenue = 0, totalCount = 0;
    var outstanding = 0, unpaidCount = 0;
    var overdue = [];
    var clientTotals = {};

    for (var i = 1; i < data.length; i++) {
      var date = new Date(data[i][1]);
      var total = parseFloat(data[i][8] || 0);
      var status = data[i][9];
      var clientName = data[i][3];
      var clientEmail = data[i][4];
      var dueDate = new Date(data[i][2]);

      totalRevenue += total;
      totalCount++;

      // This month
      if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
        monthRevenue += total;
        monthCount++;
      }

      // Outstanding
      if (status !== 'Paid') {
        outstanding += total;
        unpaidCount++;

        // Overdue
        if (dueDate < now) {
          overdue.push({
            invoiceNumber: data[i][0],
            clientName: clientName,
            clientEmail: clientEmail,
            total: total.toFixed(2),
            currency: data[i][5] || currency,
            daysPastDue: Math.floor((now - dueDate) / (1000 * 60 * 60 * 24))
          });
        }
      }

      // Client totals
      if (!clientTotals[clientEmail]) {
        clientTotals[clientEmail] = { name: clientName, total: 0, count: 0 };
      }
      clientTotals[clientEmail].total += total;
      clientTotals[clientEmail].count++;
    }

    // Sort clients by total
    var topClients = Object.values(clientTotals)
      .sort(function(a, b) { return b.total - a.total; })
      .map(function(c) {
        return { name: c.name, total: c.total.toFixed(2), count: c.count };
      });

    // Sort overdue by days past due
    overdue.sort(function(a, b) { return b.daysPastDue - a.daysPastDue; });

    return {
      currency: currency,
      monthRevenue: monthRevenue.toFixed(2),
      monthInvoiceCount: monthCount,
      outstanding: outstanding.toFixed(2),
      unpaidCount: unpaidCount,
      totalRevenue: totalRevenue.toFixed(2),
      totalInvoiceCount: totalCount,
      overdueCount: overdue.length,
      overdue: overdue,
      topClients: topClients
    };
  } catch (err) {
    Logger.log('Stats calculation error: ' + err.message);
    return defaults;
  }
}

/**
 * Handle overdue invoice action — offer to send reminder.
 */
function onOverdueAction(e) {
  var invoiceNumber = e.parameters.invoiceNumber;
  var clientEmail = e.parameters.clientEmail;

  var card = CardService.newCardBuilder()
    .setHeader(
      CardService.newCardHeader()
        .setTitle('⚠️ Overdue: ' + invoiceNumber)
    )
    .addSection(
      CardService.newCardSection()
        .addWidget(
          CardService.newTextButton()
            .setText('📧 Send Payment Reminder')
            .setOnClickAction(
              CardService.newAction()
                .setFunctionName('onSendReminder')
                .setParameters({
                  invoiceNumber: invoiceNumber,
                  clientEmail: clientEmail
                })
            )
        )
        .addWidget(
          CardService.newTextButton()
            .setText('✅ Mark as Paid')
            .setOnClickAction(
              CardService.newAction()
                .setFunctionName('onMarkPaid')
                .setParameters({ invoiceNumber: invoiceNumber })
            )
        )
    )
    .build();

  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card))
    .build();
}

/**
 * Send payment reminder email.
 */
function onSendReminder(e) {
  var invoiceNumber = e.parameters.invoiceNumber;
  var clientEmail = e.parameters.clientEmail;
  var businessName = PropertiesService.getScriptProperties().getProperty('BUSINESS_NAME') || 'Your Business';

  GmailApp.sendEmail(
    clientEmail,
    'Payment Reminder: ' + invoiceNumber,
    'Hello,\n\n' +
    'This is a friendly reminder that invoice ' + invoiceNumber + ' is overdue.\n\n' +
    'Could you please arrange payment at your earliest convenience?\n\n' +
    'If you have already made the payment, please disregard this reminder.\n\n' +
    'Thank you,\n' + businessName,
    { name: businessName }
  );

  return CardService.newActionResponseBuilder()
    .setNotification(
      CardService.newNotification().setText('📧 Reminder sent to ' + clientEmail)
    )
    .build();
}

/**
 * Mark an invoice as paid.
 */
function onMarkPaid(e) {
  var invoiceNumber = e.parameters.invoiceNumber;
  updateInvoiceStatus(invoiceNumber, 'Paid');

  // Update Gmail label
  // TODO: Change label from "Invoice Sent" to "Paid"

  return CardService.newActionResponseBuilder()
    .setNotification(
      CardService.newNotification().setText('✅ ' + invoiceNumber + ' marked as paid!')
    )
    .build();
}

/**
 * Open the tracker spreadsheet.
 */
function onOpenTracker(e) {
  var sheetId = PropertiesService.getScriptProperties().getProperty('TRACKER_SHEET_ID');
  if (!sheetId) {
    return showError('No tracker set up. Create an invoice first to auto-initialize.');
  }

  return CardService.newActionResponseBuilder()
    .setOpenLink(
      CardService.newOpenLink()
        .setUrl('https://docs.google.com/spreadsheets/d/' + sheetId)
    )
    .build();
}

/**
 * View recurring invoices list.
 */
function onViewRecurring(e) {
  var recurring = JSON.parse(
    PropertiesService.getScriptProperties().getProperty('RECURRING_INVOICES') || '[]'
  );

  var card = CardService.newCardBuilder()
    .setHeader(
      CardService.newCardHeader()
        .setTitle('🔁 Recurring Invoices')
    );

  if (recurring.length === 0) {
    card.addSection(
      CardService.newCardSection()
        .addWidget(
          CardService.newTextParagraph()
            .setText('No recurring invoices set up yet.\n\n' +
                     'Recurring patterns are auto-detected after creating 2+ invoices ' +
                     'for the same client with consistent timing.')
        )
    );
  } else {
    var section = CardService.newCardSection();
    recurring.forEach(function(r) {
      section.addWidget(
        CardService.newDecoratedText()
          .setTopLabel(r.pattern)
          .setText(r.clientEmail)
          .setBottomLabel('~€' + r.amount + ' • ' + (r.enabled ? '✅ Active' : '⏸️ Paused'))
      );
    });
    card.addSection(section);
  }

  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card.build()))
    .build();
}

/**
 * Get current month name.
 */
function getCurrentMonthName() {
  var months = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];
  return months[new Date().getMonth()];
}
