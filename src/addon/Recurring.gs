/**
 * InvoiceFly — Recurring Invoice Detection
 *
 * Detects patterns in email conversations that suggest recurring orders.
 * Suggests automatic invoicing for repeat clients.
 */

/**
 * Analyze a client's invoice history for recurring patterns.
 */
function detectRecurringPatterns(clientEmail) {
  var sheetId = PropertiesService.getScriptProperties().getProperty('TRACKER_SHEET_ID');
  if (!sheetId) return null;

  var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('Invoices');
  var data = sheet.getDataRange().getValues();

  // Get all invoices for this client
  var invoices = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][4] === clientEmail) {
      invoices.push({
        date: new Date(data[i][1]),
        total: parseFloat(data[i][8] || 0),
        items: data[i][14] // Notes may contain item info
      });
    }
  }

  if (invoices.length < 2) return null;

  // Sort by date
  invoices.sort(function(a, b) { return a.date - b.date; });

  // Calculate intervals between invoices (in days)
  var intervals = [];
  for (var j = 1; j < invoices.length; j++) {
    var diff = Math.floor((invoices[j].date - invoices[j - 1].date) / (1000 * 60 * 60 * 24));
    intervals.push(diff);
  }

  // Detect pattern
  var avgInterval = intervals.reduce(function(a, b) { return a + b; }, 0) / intervals.length;
  var avgAmount = invoices.reduce(function(a, b) { return a + b.total; }, 0) / invoices.length;

  // Check consistency (standard deviation)
  var variance = intervals.reduce(function(sum, val) {
    return sum + Math.pow(val - avgInterval, 2);
  }, 0) / intervals.length;
  var stdDev = Math.sqrt(variance);

  var isRecurring = stdDev < avgInterval * 0.3; // Less than 30% variation = recurring
  var pattern = null;

  if (isRecurring) {
    if (avgInterval >= 25 && avgInterval <= 35) {
      pattern = 'monthly';
    } else if (avgInterval >= 12 && avgInterval <= 16) {
      pattern = 'bi-weekly';
    } else if (avgInterval >= 5 && avgInterval <= 9) {
      pattern = 'weekly';
    } else if (avgInterval >= 80 && avgInterval <= 100) {
      pattern = 'quarterly';
    } else {
      pattern = 'every ~' + Math.round(avgInterval) + ' days';
    }
  }

  return {
    isRecurring: isRecurring,
    pattern: pattern,
    avgInterval: Math.round(avgInterval),
    avgAmount: avgAmount.toFixed(2),
    invoiceCount: invoices.length,
    lastInvoice: invoices[invoices.length - 1].date,
    nextExpected: isRecurring ?
      new Date(invoices[invoices.length - 1].date.getTime() + avgInterval * 24 * 60 * 60 * 1000) :
      null,
    confidence: isRecurring ? Math.max(0.5, 1 - (stdDev / avgInterval)) : 0
  };
}

/**
 * Show recurring pattern card in sidebar.
 */
function onCheckRecurring(e) {
  var clientEmail = e.parameters.clientEmail;
  var result = detectRecurringPatterns(clientEmail);

  if (!result || !result.isRecurring) {
    var card = CardService.newCardBuilder()
      .addSection(
        CardService.newCardSection()
          .addWidget(
            CardService.newTextParagraph()
              .setText('📊 No recurring pattern detected for this client yet. ' +
                       'Patterns are detected after 2+ invoices with consistent timing.')
          )
      )
      .build();

    return CardService.newActionResponseBuilder()
      .setNavigation(CardService.newNavigation().pushCard(card))
      .build();
  }

  var nextDate = result.nextExpected ?
    result.nextExpected.toLocaleDateString('lt-LT') : 'Unknown';

  var card = CardService.newCardBuilder()
    .setHeader(
      CardService.newCardHeader()
        .setTitle('🔁 Recurring Pattern Detected')
        .setSubtitle(clientEmail)
    )
    .addSection(
      CardService.newCardSection()
        .addWidget(
          CardService.newKeyValue()
            .setTopLabel('Pattern')
            .setContent(result.pattern)
        )
        .addWidget(
          CardService.newKeyValue()
            .setTopLabel('Average Amount')
            .setContent('€' + result.avgAmount)
        )
        .addWidget(
          CardService.newKeyValue()
            .setTopLabel('Invoices So Far')
            .setContent(String(result.invoiceCount))
        )
        .addWidget(
          CardService.newKeyValue()
            .setTopLabel('Next Expected')
            .setContent(nextDate)
        )
        .addWidget(
          CardService.newKeyValue()
            .setTopLabel('Confidence')
            .setContent(Math.round(result.confidence * 100) + '%')
        )
    )
    .addSection(
      CardService.newCardSection()
        .addWidget(
          CardService.newTextButton()
            .setText('⚡ Set Up Auto-Invoice')
            .setOnClickAction(
              CardService.newAction()
                .setFunctionName('onSetupAutoInvoice')
                .setParameters({
                  clientEmail: clientEmail,
                  pattern: result.pattern,
                  avgAmount: result.avgAmount
                })
            )
        )
    )
    .build();

  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card))
    .build();
}

/**
 * Set up automatic recurring invoice.
 */
function onSetupAutoInvoice(e) {
  var clientEmail = e.parameters.clientEmail;
  var pattern = e.parameters.pattern;

  // Store recurring config
  var props = PropertiesService.getScriptProperties();
  var recurring = JSON.parse(props.getProperty('RECURRING_INVOICES') || '[]');

  recurring.push({
    clientEmail: clientEmail,
    pattern: pattern,
    amount: e.parameters.avgAmount,
    enabled: true,
    createdAt: new Date().toISOString()
  });

  props.setProperty('RECURRING_INVOICES', JSON.stringify(recurring));

  // Set up time trigger
  setupRecurringTrigger();

  return CardService.newActionResponseBuilder()
    .setNotification(
      CardService.newNotification()
        .setText('✅ Auto-invoice set up for ' + clientEmail + ' (' + pattern + ')')
    )
    .build();
}

/**
 * Create a daily trigger to check for recurring invoices.
 */
function setupRecurringTrigger() {
  // Check if trigger already exists
  var triggers = ScriptApp.getProjectTriggers();
  var exists = triggers.some(function(t) {
    return t.getHandlerFunction() === 'processRecurringInvoices';
  });

  if (!exists) {
    ScriptApp.newTrigger('processRecurringInvoices')
      .timeBased()
      .everyDays(1)
      .atHour(8)
      .create();
  }
}

/**
 * Process recurring invoices (called by daily trigger).
 */
function processRecurringInvoices() {
  var props = PropertiesService.getScriptProperties();
  var recurring = JSON.parse(props.getProperty('RECURRING_INVOICES') || '[]');

  recurring.forEach(function(config) {
    if (!config.enabled) return;

    var result = detectRecurringPatterns(config.clientEmail);
    if (!result || !result.nextExpected) return;

    var now = new Date();
    var next = new Date(result.nextExpected);

    // If we're within 1 day of the expected date, create a draft
    var diffDays = Math.abs((next - now) / (1000 * 60 * 60 * 24));
    if (diffDays <= 1) {
      Logger.log('Creating recurring invoice for ' + config.clientEmail);
      // TODO: Auto-create invoice from last template
    }
  });
}
