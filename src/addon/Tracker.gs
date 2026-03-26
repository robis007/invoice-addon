/**
 * InvoiceFly — Invoice Tracker
 *
 * Manages invoice lifecycle: created → sent → viewed → paid → overdue.
 * Uses a Google Sheet as the database.
 */

/**
 * Initialize the tracker spreadsheet with required sheets and headers.
 */
function initializeTracker() {
  var sheetId = PropertiesService.getScriptProperties().getProperty('TRACKER_SHEET_ID');
  if (!sheetId) {
    // Create new spreadsheet
    var ss = SpreadsheetApp.create('InvoiceFly — Invoice Tracker');
    sheetId = ss.getId();
    PropertiesService.getScriptProperties().setProperty('TRACKER_SHEET_ID', sheetId);
  }

  var ss = SpreadsheetApp.openById(sheetId);

  // Invoices sheet
  var invoices = ss.getSheetByName('Invoices') || ss.insertSheet('Invoices');
  if (invoices.getLastRow() === 0) {
    invoices.appendRow([
      'Invoice #', 'Date', 'Due Date', 'Client Name', 'Client Email',
      'Currency', 'Subtotal', 'Tax', 'Total', 'Status',
      'Doc URL', 'Thread ID', 'Sent Date', 'Paid Date', 'Notes'
    ]);
    invoices.getRange(1, 1, 1, 15).setFontWeight('bold').setBackground('#E8F0FE');
    invoices.setFrozenRows(1);
  }

  // Clients sheet
  var clients = ss.getSheetByName('Clients') || ss.insertSheet('Clients');
  if (clients.getLastRow() === 0) {
    clients.appendRow([
      'Client Name', 'Email', 'Address', 'Phone',
      'Total Invoiced', 'Total Paid', 'Outstanding', 'Invoice Count',
      'First Invoice', 'Last Invoice', 'Notes'
    ]);
    clients.getRange(1, 1, 1, 11).setFontWeight('bold').setBackground('#E8F0FE');
    clients.setFrozenRows(1);
  }

  // Monthly Summary sheet
  var monthly = ss.getSheetByName('Monthly Summary') || ss.insertSheet('Monthly Summary');
  if (monthly.getLastRow() === 0) {
    monthly.appendRow([
      'Month', 'Invoices Created', 'Invoices Paid', 'Revenue',
      'Outstanding', 'Avg Invoice Value', 'Top Client'
    ]);
    monthly.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#E8F0FE');
    monthly.setFrozenRows(1);
  }

  // Remove default Sheet1 if it exists and is empty
  var sheet1 = ss.getSheetByName('Sheet1');
  if (sheet1 && sheet1.getLastRow() === 0) {
    ss.deleteSheet(sheet1);
  }

  return sheetId;
}

/**
 * Add an invoice to the tracker.
 */
function trackInvoice(data) {
  var sheetId = PropertiesService.getScriptProperties().getProperty('TRACKER_SHEET_ID');
  if (!sheetId) sheetId = initializeTracker();

  var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('Invoices');

  var dueDate = new Date();
  var terms = parseInt(PropertiesService.getScriptProperties().getProperty('PAYMENT_TERMS') || '14', 10);
  dueDate.setDate(dueDate.getDate() + terms);

  sheet.appendRow([
    data.invoiceNumber,
    new Date(),
    dueDate,
    data.clientName,
    data.clientEmail,
    data.currency || 'EUR',
    data.subtotal || '0.00',
    data.tax || '0.00',
    data.total || '0.00',
    'Created',
    data.docUrl || '',
    data.threadId || '',
    '',   // Sent date
    '',   // Paid date
    data.notes || ''
  ]);

  // Update client record
  updateClientRecord(data);
}

/**
 * Update invoice status in the tracker.
 */
function updateInvoiceStatus(invoiceNumber, newStatus) {
  var sheetId = PropertiesService.getScriptProperties().getProperty('TRACKER_SHEET_ID');
  if (!sheetId) return;

  var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('Invoices');
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === invoiceNumber) {
      sheet.getRange(i + 1, 10).setValue(newStatus); // Status column

      if (newStatus === 'Sent') {
        sheet.getRange(i + 1, 13).setValue(new Date()); // Sent date
      } else if (newStatus === 'Paid') {
        sheet.getRange(i + 1, 14).setValue(new Date()); // Paid date
      }

      // Color code the status
      var statusCell = sheet.getRange(i + 1, 10);
      switch (newStatus) {
        case 'Created': statusCell.setBackground('#DBEAFE'); break;
        case 'Sent':    statusCell.setBackground('#FEF3C7'); break;
        case 'Paid':    statusCell.setBackground('#D1FAE5'); break;
        case 'Overdue': statusCell.setBackground('#FEE2E2'); break;
      }
      break;
    }
  }
}

/**
 * Update or create a client record.
 */
function updateClientRecord(data) {
  var sheetId = PropertiesService.getScriptProperties().getProperty('TRACKER_SHEET_ID');
  if (!sheetId) return;

  var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('Clients');
  var rows = sheet.getDataRange().getValues();
  var clientRow = -1;

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][1] === data.clientEmail) {
      clientRow = i + 1;
      break;
    }
  }

  var total = parseFloat(data.total || 0);

  if (clientRow > 0) {
    // Update existing
    var invoiced = parseFloat(rows[clientRow - 1][4] || 0) + total;
    var count = parseInt(rows[clientRow - 1][7] || 0, 10) + 1;
    sheet.getRange(clientRow, 5).setValue(invoiced);
    sheet.getRange(clientRow, 7).setValue(invoiced - parseFloat(rows[clientRow - 1][5] || 0));
    sheet.getRange(clientRow, 8).setValue(count);
    sheet.getRange(clientRow, 10).setValue(new Date());
  } else {
    // New client
    sheet.appendRow([
      data.clientName,
      data.clientEmail,
      data.clientAddress || '',
      '',
      total,
      0,
      total,
      1,
      new Date(),
      new Date(),
      ''
    ]);
  }
}

/**
 * Get overdue invoices.
 */
function getOverdueInvoices() {
  var sheetId = PropertiesService.getScriptProperties().getProperty('TRACKER_SHEET_ID');
  if (!sheetId) return [];

  var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('Invoices');
  var data = sheet.getDataRange().getValues();
  var overdue = [];
  var now = new Date();

  for (var i = 1; i < data.length; i++) {
    var status = data[i][9];
    var dueDate = new Date(data[i][2]);

    if ((status === 'Created' || status === 'Sent') && dueDate < now) {
      overdue.push({
        invoiceNumber: data[i][0],
        dueDate: dueDate,
        clientName: data[i][3],
        clientEmail: data[i][4],
        total: data[i][8],
        currency: data[i][5],
        daysPastDue: Math.floor((now - dueDate) / (1000 * 60 * 60 * 24))
      });

      // Update status
      sheet.getRange(i + 1, 10).setValue('Overdue');
      sheet.getRange(i + 1, 10).setBackground('#FEE2E2');
    }
  }

  return overdue;
}
