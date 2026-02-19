import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { v4 as uuidv4 } from 'uuid';
import { authOptions } from '@/lib/auth';
import { appendRow, COLUMNS, ensureSheetWithHeaders, findRows, updateRow } from '@/lib/googleSheets';

type ServerNotificationSettings = {
    enabled: boolean;
    habitReminder: boolean;
    habitReminderTime: string;
    taskReminder: boolean;
    taskReminderMinutes: number;
    goalReminder: boolean;
    goalReminderTime: string;
    dailySummary: boolean;
    dailySummaryTime: string;
    telegramEnabled: boolean;
    telegramChatId: string;
    timezone: string;
};

const DEFAULT_SETTINGS: ServerNotificationSettings = {
    enabled: false,
    habitReminder: true,
    habitReminderTime: '09:00',
    taskReminder: true,
    taskReminderMinutes: 15,
    goalReminder: true,
    goalReminderTime: '20:00',
    dailySummary: true,
    dailySummaryTime: '21:00',
    telegramEnabled: false,
    telegramChatId: '',
    timezone: 'UTC',
};

const NOTIFICATION_SETTINGS_HEADERS = [
    'id',
    'userId',
    'enabled',
    'habitReminder',
    'habitReminderTime',
    'taskReminder',
    'taskReminderMinutes',
    'goalReminder',
    'goalReminderTime',
    'dailySummary',
    'dailySummaryTime',
    'telegramEnabled',
    'telegramChatId',
    'timezone',
    'updatedAt',
];

function parseBool(value: string | undefined): boolean {
    return value === 'true';
}

function parseIntOr(value: string | undefined, fallback: number): number {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

function rowToSettings(row: string[]): ServerNotificationSettings {
    return {
        enabled: parseBool(row[COLUMNS.NotificationSettings.enabled]),
        habitReminder: parseBool(row[COLUMNS.NotificationSettings.habitReminder]),
        habitReminderTime: row[COLUMNS.NotificationSettings.habitReminderTime] || DEFAULT_SETTINGS.habitReminderTime,
        taskReminder: parseBool(row[COLUMNS.NotificationSettings.taskReminder]),
        taskReminderMinutes: parseIntOr(row[COLUMNS.NotificationSettings.taskReminderMinutes], DEFAULT_SETTINGS.taskReminderMinutes),
        goalReminder: parseBool(row[COLUMNS.NotificationSettings.goalReminder]),
        goalReminderTime: row[COLUMNS.NotificationSettings.goalReminderTime] || DEFAULT_SETTINGS.goalReminderTime,
        dailySummary: parseBool(row[COLUMNS.NotificationSettings.dailySummary]),
        dailySummaryTime: row[COLUMNS.NotificationSettings.dailySummaryTime] || DEFAULT_SETTINGS.dailySummaryTime,
        telegramEnabled: parseBool(row[COLUMNS.NotificationSettings.telegramEnabled]),
        telegramChatId: row[COLUMNS.NotificationSettings.telegramChatId] || '',
        timezone: row[COLUMNS.NotificationSettings.timezone] || 'UTC',
    };
}

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    await ensureSheetWithHeaders('NotificationSettings', NOTIFICATION_SETTINGS_HEADERS);

    let rows;
    try {
        rows = await findRows('NotificationSettings', COLUMNS.NotificationSettings.userId, userId);
    } catch {
        return NextResponse.json(DEFAULT_SETTINGS);
    }

    if (rows.length === 0) {
        return NextResponse.json(DEFAULT_SETTINGS);
    }

    return NextResponse.json(rowToSettings(rows[0].data));
}

export async function PUT(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const updates = await request.json();
    await ensureSheetWithHeaders('NotificationSettings', NOTIFICATION_SETTINGS_HEADERS);
    const rows = await findRows('NotificationSettings', COLUMNS.NotificationSettings.userId, userId);
    const now = new Date().toISOString();

    const current = rows.length > 0 ? rowToSettings(rows[0].data) : DEFAULT_SETTINGS;
    const merged: ServerNotificationSettings = {
        ...current,
        ...updates,
        timezone: String((updates.timezone ?? current.timezone) || 'UTC'),
    };

    if (rows.length === 0) {
        await appendRow('NotificationSettings', [
            uuidv4(),
            userId,
            String(merged.enabled),
            String(merged.habitReminder),
            merged.habitReminderTime,
            String(merged.taskReminder),
            String(merged.taskReminderMinutes),
            String(merged.goalReminder),
            merged.goalReminderTime,
            String(merged.dailySummary),
            merged.dailySummaryTime,
            String(merged.telegramEnabled),
            merged.telegramChatId,
            merged.timezone,
            now,
        ]);
    } else {
        const updatedData = [...rows[0].data];
        updatedData[COLUMNS.NotificationSettings.enabled] = String(merged.enabled);
        updatedData[COLUMNS.NotificationSettings.habitReminder] = String(merged.habitReminder);
        updatedData[COLUMNS.NotificationSettings.habitReminderTime] = merged.habitReminderTime;
        updatedData[COLUMNS.NotificationSettings.taskReminder] = String(merged.taskReminder);
        updatedData[COLUMNS.NotificationSettings.taskReminderMinutes] = String(merged.taskReminderMinutes);
        updatedData[COLUMNS.NotificationSettings.goalReminder] = String(merged.goalReminder);
        updatedData[COLUMNS.NotificationSettings.goalReminderTime] = merged.goalReminderTime;
        updatedData[COLUMNS.NotificationSettings.dailySummary] = String(merged.dailySummary);
        updatedData[COLUMNS.NotificationSettings.dailySummaryTime] = merged.dailySummaryTime;
        updatedData[COLUMNS.NotificationSettings.telegramEnabled] = String(merged.telegramEnabled);
        updatedData[COLUMNS.NotificationSettings.telegramChatId] = merged.telegramChatId;
        updatedData[COLUMNS.NotificationSettings.timezone] = merged.timezone;
        updatedData[COLUMNS.NotificationSettings.updatedAt] = now;
        await updateRow('NotificationSettings', rows[0].rowIndex, updatedData);
    }

    return NextResponse.json(merged);
}
