/* eslint-disable no-console */
const { google } = require('googleapis');

const REQUIRED_SHEETS = [
  'Users',
  'Habits',
  'HabitLogs',
  'Tasks',
  'Categories',
  'Goals',
  'NotificationSettings',
  'NotificationEvents',
];

function parseCredentials(raw, name) {
  if (!raw) {
    throw new Error(`${name} is missing`);
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${name} is not valid JSON`);
  }
}

function getAuth(credentials) {
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

async function ensureSheet(targetSheets, spreadsheetId, title) {
  const meta = await targetSheets.spreadsheets.get({ spreadsheetId });
  const exists = (meta.data.sheets || []).some((s) => s.properties && s.properties.title === title);
  if (exists) return;
  await targetSheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title } } }],
    },
  });
}

async function readSheet(sourceSheets, spreadsheetId, title) {
  const res = await sourceSheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${title}!A:Z`,
  });
  return res.data.values || [];
}

async function writeSheet(targetSheets, spreadsheetId, title, rows) {
  await targetSheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${title}!A:Z`,
  });

  if (rows.length === 0) return;
  await targetSheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${title}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });
}

async function migrate() {
  const sourceSpreadsheetId = process.env.SOURCE_GOOGLE_SHEETS_ID;
  const targetSpreadsheetId = process.env.TARGET_GOOGLE_SHEETS_ID;

  if (!sourceSpreadsheetId || !targetSpreadsheetId) {
    throw new Error('Set SOURCE_GOOGLE_SHEETS_ID and TARGET_GOOGLE_SHEETS_ID');
  }

  const sourceCredsRaw =
    process.env.GOOGLE_SHEETS_SOURCE_CREDENTIALS || process.env.GOOGLE_SHEETS_CREDENTIALS;
  const targetCredsRaw =
    process.env.GOOGLE_SHEETS_TARGET_CREDENTIALS || process.env.GOOGLE_SHEETS_CREDENTIALS;

  const sourceCreds = parseCredentials(sourceCredsRaw, 'GOOGLE_SHEETS_SOURCE_CREDENTIALS/GOOGLE_SHEETS_CREDENTIALS');
  const targetCreds = parseCredentials(targetCredsRaw, 'GOOGLE_SHEETS_TARGET_CREDENTIALS/GOOGLE_SHEETS_CREDENTIALS');

  const sourceSheets = google.sheets({ version: 'v4', auth: getAuth(sourceCreds) });
  const targetSheets = google.sheets({ version: 'v4', auth: getAuth(targetCreds) });

  const requestedSheets = (process.env.SHEETS_TO_MIGRATE || REQUIRED_SHEETS.join(','))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  console.log(`Source spreadsheet: ${sourceSpreadsheetId}`);
  console.log(`Target spreadsheet: ${targetSpreadsheetId}`);
  console.log(`Sheets: ${requestedSheets.join(', ')}`);

  for (const sheetName of requestedSheets) {
    console.log(`\nMigrating ${sheetName}...`);
    const rows = await readSheet(sourceSheets, sourceSpreadsheetId, sheetName);
    await ensureSheet(targetSheets, targetSpreadsheetId, sheetName);
    await writeSheet(targetSheets, targetSpreadsheetId, sheetName, rows);
    console.log(`Done: ${sheetName} (${rows.length} rows)`);
  }

  console.log('\nMigration completed successfully.');
}

migrate().catch((error) => {
  console.error('\nMigration failed:', error.message);
  process.exit(1);
});
