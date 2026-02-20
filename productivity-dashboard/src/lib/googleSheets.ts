import { google, sheets_v4 } from 'googleapis';

let sheetsClient: sheets_v4.Sheets | null = null;

function getSheetsClient(): sheets_v4.Sheets {
    if (sheetsClient) return sheetsClient;

    const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS || '{}');
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    sheetsClient = google.sheets({ version: 'v4', auth });
    return sheetsClient;
}

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID || '';
const ensuredSheets = new Set<string>();

export async function getSheetData(sheetName: string): Promise<string[][]> {
    await ensureKnownSheet(sheetName);
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A:Z`,
    });
    return response.data.values || [];
}

function toColumnLabel(colNumber: number): string {
    let label = '';
    let num = colNumber;
    while (num > 0) {
        const rem = (num - 1) % 26;
        label = String.fromCharCode(65 + rem) + label;
        num = Math.floor((num - 1) / 26);
    }
    return label;
}

export async function ensureSheetWithHeaders(sheetName: string, headers: string[]): Promise<void> {
    const sheets = getSheetsClient();
    const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
    });

    const existingSheet = spreadsheet.data.sheets?.find(
        (s) => s.properties?.title === sheetName
    );

    if (!existingSheet) {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                requests: [{ addSheet: { properties: { title: sheetName } } }],
            },
        });
    }

    const endColumn = toColumnLabel(headers.length);
    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A1:${endColumn}1`,
        valueInputOption: 'RAW',
        requestBody: { values: [headers] },
    });
}

export async function appendRow(sheetName: string, values: string[]): Promise<void> {
    await ensureKnownSheet(sheetName);
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A:Z`,
        valueInputOption: 'RAW',
        requestBody: {
            values: [values],
        },
    });
}

export async function updateRow(
    sheetName: string,
    rowIndex: number,
    values: string[]
): Promise<void> {
    await ensureKnownSheet(sheetName);
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A${rowIndex}:Z${rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: {
            values: [values],
        },
    });
}

export async function deleteRow(sheetName: string, rowIndex: number): Promise<void> {
    await ensureKnownSheet(sheetName);
    const sheets = getSheetsClient();
    const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
    });

    const sheet = spreadsheet.data.sheets?.find(
        (s) => s.properties?.title === sheetName
    );
    if (!sheet?.properties?.sheetId && sheet?.properties?.sheetId !== 0) return;

    await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
            requests: [
                {
                    deleteDimension: {
                        range: {
                            sheetId: sheet.properties.sheetId,
                            dimension: 'ROWS',
                            startIndex: rowIndex - 1,
                            endIndex: rowIndex,
                        },
                    },
                },
            ],
        },
    });
}

export async function findRows(
    sheetName: string,
    columnIndex: number,
    value: string
): Promise<{ rowIndex: number; data: string[] }[]> {
    await ensureKnownSheet(sheetName);
    const data = await getSheetData(sheetName);
    const results: { rowIndex: number; data: string[] }[] = [];

    for (let i = 1; i < data.length; i++) {
        if (data[i][columnIndex] === value) {
            results.push({ rowIndex: i + 1, data: data[i] });
        }
    }

    return results;
}

export async function findRow(
    sheetName: string,
    columnIndex: number,
    value: string
): Promise<{ rowIndex: number; data: string[] } | null> {
    const results = await findRows(sheetName, columnIndex, value);
    return results[0] || null;
}

// Column mappings
export const COLUMNS = {
    Users: { id: 0, email: 1, passwordHash: 2, name: 3, createdAt: 4 },
    Habits: { id: 0, userId: 1, name: 2, icon: 3, frequency: 4, isPreset: 5, isActive: 6, createdAt: 7 },
    HabitLogs: { id: 0, habitId: 1, userId: 2, date: 3, completed: 4 },
    Tasks: { id: 0, userId: 1, title: 2, description: 3, priority: 4, category: 5, deadline: 6, completed: 7, parentTaskId: 8, scheduledTime: 9, createdAt: 10 },
    Categories: { id: 0, userId: 1, name: 2, color: 3 },
    Goals: { id: 0, userId: 1, title: 2, description: 3, category: 4, status: 5, targetDate: 6, createdAt: 7 },
    NotificationSettings: {
        id: 0,
        userId: 1,
        enabled: 2,
        habitReminder: 3,
        habitReminderTime: 4,
        taskReminder: 5,
        taskReminderMinutes: 6,
        goalReminder: 7,
        goalReminderTime: 8,
        dailySummary: 9,
        dailySummaryTime: 10,
        telegramEnabled: 11,
        telegramChatId: 12,
        timezone: 13,
        updatedAt: 14,
    },
    NotificationEvents: {
        id: 0,
        eventKey: 1,
        userId: 2,
        channel: 3,
        sentAt: 4,
    },
    TelegramLinkTokens: {
        id: 0,
        userId: 1,
        token: 2,
        status: 3,
        chatId: 4,
        createdAt: 5,
        expiresAt: 6,
        usedAt: 7,
    },
};

const SHEET_HEADERS: Record<string, string[]> = {
    Users: ['id', 'email', 'passwordHash', 'name', 'createdAt'],
    Habits: ['id', 'userId', 'name', 'icon', 'frequency', 'isPreset', 'isActive', 'createdAt'],
    HabitLogs: ['id', 'habitId', 'userId', 'date', 'completed'],
    Tasks: ['id', 'userId', 'title', 'description', 'priority', 'category', 'deadline', 'completed', 'parentTaskId', 'scheduledTime', 'createdAt'],
    Categories: ['id', 'userId', 'name', 'color'],
    Goals: ['id', 'userId', 'title', 'description', 'category', 'status', 'targetDate', 'createdAt'],
    NotificationSettings: ['id', 'userId', 'enabled', 'habitReminder', 'habitReminderTime', 'taskReminder', 'taskReminderMinutes', 'goalReminder', 'goalReminderTime', 'dailySummary', 'dailySummaryTime', 'telegramEnabled', 'telegramChatId', 'timezone', 'updatedAt'],
    NotificationEvents: ['id', 'eventKey', 'userId', 'channel', 'sentAt'],
    TelegramLinkTokens: ['id', 'userId', 'token', 'status', 'chatId', 'createdAt', 'expiresAt', 'usedAt'],
};

async function ensureKnownSheet(sheetName: string): Promise<void> {
    if (ensuredSheets.has(sheetName)) return;
    const headers = SHEET_HEADERS[sheetName];
    if (!headers) return;
    await ensureSheetWithHeaders(sheetName, headers);
    ensuredSheets.add(sheetName);
}
