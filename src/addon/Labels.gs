/**
 * InvoiceFly — Gmail Auto-Labeling
 *
 * Automatically labels Gmail threads based on invoice status.
 * Labels:
 *   InvoiceFly/Invoice Created
 *   InvoiceFly/Invoice Sent
 *   InvoiceFly/Paid
 *   InvoiceFly/Overdue
 *   InvoiceFly/Recurring Client
 */

var LABEL_PREFIX = 'InvoiceFly';

var LABELS = {
  CREATED: LABEL_PREFIX + '/Invoice Created',
  SENT: LABEL_PREFIX + '/Invoice Sent',
  PAID: LABEL_PREFIX + '/Paid',
  OVERDUE: LABEL_PREFIX + '/Overdue',
  RECURRING: LABEL_PREFIX + '/Recurring Client'
};

/**
 * Initialize all InvoiceFly labels.
 */
function initializeLabels() {
  Object.values(LABELS).forEach(function(labelName) {
    if (!GmailApp.getUserLabelByName(labelName)) {
      GmailApp.createLabel(labelName);
    }
  });
}

/**
 * Apply a label to a Gmail thread.
 */
function applyLabel(threadId, labelKey) {
  try {
    var thread = GmailApp.getThreadById(threadId);
    if (!thread) return;

    var labelName = LABELS[labelKey];
    if (!labelName) return;

    var label = GmailApp.getUserLabelByName(labelName) ||
                GmailApp.createLabel(labelName);
    thread.addLabel(label);
  } catch (err) {
    Logger.log('Label error for thread ' + threadId + ': ' + err.message);
  }
}

/**
 * Remove a label from a Gmail thread.
 */
function removeLabel(threadId, labelKey) {
  try {
    var thread = GmailApp.getThreadById(threadId);
    if (!thread) return;

    var labelName = LABELS[labelKey];
    var label = GmailApp.getUserLabelByName(labelName);
    if (label) {
      thread.removeLabel(label);
    }
  } catch (err) {
    Logger.log('Remove label error: ' + err.message);
  }
}

/**
 * Transition label when invoice status changes.
 * e.g. Created → Sent → Paid
 */
function transitionLabel(threadId, fromStatus, toStatus) {
  var statusToLabel = {
    'Created': 'CREATED',
    'Sent': 'SENT',
    'Paid': 'PAID',
    'Overdue': 'OVERDUE'
  };

  if (statusToLabel[fromStatus]) {
    removeLabel(threadId, statusToLabel[fromStatus]);
  }

  if (statusToLabel[toStatus]) {
    applyLabel(threadId, statusToLabel[toStatus]);
  }
}

/**
 * Check for overdue invoices and update labels.
 * Called by daily trigger.
 */
function updateOverdueLabels() {
  var overdue = getOverdueInvoices();

  overdue.forEach(function(inv) {
    if (inv.threadId) {
      applyLabel(inv.threadId, 'OVERDUE');
      removeLabel(inv.threadId, 'SENT');
      removeLabel(inv.threadId, 'CREATED');
    }
  });

  if (overdue.length > 0) {
    Logger.log('Updated ' + overdue.length + ' overdue invoice labels');
  }
}

/**
 * Label threads from recurring clients.
 */
function labelRecurringClients() {
  var recurring = JSON.parse(
    PropertiesService.getScriptProperties().getProperty('RECURRING_INVOICES') || '[]'
  );

  recurring.forEach(function(config) {
    if (!config.enabled) return;

    // Search for recent threads from this client
    var threads = GmailApp.search('from:' + config.clientEmail + ' newer_than:30d', 0, 10);
    threads.forEach(function(thread) {
      applyLabel(thread.getId(), 'RECURRING');
    });
  });
}

/**
 * Set up daily triggers for label maintenance.
 */
function setupLabelTriggers() {
  var triggers = ScriptApp.getProjectTriggers();

  // Overdue check
  var hasOverdueTrigger = triggers.some(function(t) {
    return t.getHandlerFunction() === 'dailyLabelMaintenance';
  });

  if (!hasOverdueTrigger) {
    ScriptApp.newTrigger('dailyLabelMaintenance')
      .timeBased()
      .everyDays(1)
      .atHour(9)
      .create();
  }
}

/**
 * Daily maintenance: update overdue labels and recurring client labels.
 */
function dailyLabelMaintenance() {
  updateOverdueLabels();
  labelRecurringClients();
}
