import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { appendRow, COLUMNS, ensureSheetWithHeaders, findRows, getSheetData } from '@/lib/googleSheets';
import { sendTelegramMessage } from '@/lib/telegram';

type NotificationSettingsRow = {
    userId: string;
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

const NOTIFICATION_EVENTS_HEADERS = ['id', 'eventKey', 'userId', 'channel', 'sentAt'];

function parseBool(value: string | undefined): boolean {
    return value === 'true';
}

function parseIntOr(value: string | undefined, fallback: number): number {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

function localDateKey(date: Date, timezone: string): string {
    const formatted = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
    return formatted;
}

function localTime(date: Date, timezone: string): string {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(date);

    const hour = parts.find((p) => p.type === 'hour')?.value || '00';
    const minute = parts.find((p) => p.type === 'minute')?.value || '00';
    return `${hour}:${minute}`;
}

function toMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return -1;
    return h * 60 + m;
}

function isTimeInWindow(nowHHMM: string, targetHHMM: string, windowMinutes: number): boolean {
    const nowMin = toMinutes(nowHHMM);
    const targetMin = toMinutes(targetHHMM);
    if (nowMin < 0 || targetMin < 0) return false;
    const diff = nowMin - targetMin;
    return diff >= 0 && diff <= windowMinutes;
}

function parseSettingsRow(row: string[]): NotificationSettingsRow {
    return {
        userId: row[COLUMNS.NotificationSettings.userId] || '',
        enabled: parseBool(row[COLUMNS.NotificationSettings.enabled]),
        habitReminder: parseBool(row[COLUMNS.NotificationSettings.habitReminder]),
        habitReminderTime: row[COLUMNS.NotificationSettings.habitReminderTime] || '09:00',
        taskReminder: parseBool(row[COLUMNS.NotificationSettings.taskReminder]),
        taskReminderMinutes: parseIntOr(row[COLUMNS.NotificationSettings.taskReminderMinutes], 15),
        goalReminder: parseBool(row[COLUMNS.NotificationSettings.goalReminder]),
        goalReminderTime: row[COLUMNS.NotificationSettings.goalReminderTime] || '20:00',
        dailySummary: parseBool(row[COLUMNS.NotificationSettings.dailySummary]),
        dailySummaryTime: row[COLUMNS.NotificationSettings.dailySummaryTime] || '21:00',
        telegramEnabled: parseBool(row[COLUMNS.NotificationSettings.telegramEnabled]),
        telegramChatId: row[COLUMNS.NotificationSettings.telegramChatId] || '',
        timezone: row[COLUMNS.NotificationSettings.timezone] || 'UTC',
    };
}

async function sendTelegramOnce(
    userId: string,
    chatId: string,
    eventKey: string,
    title: string,
    body: string,
    sentAt: string
): Promise<boolean> {
    const existing = await findRows('NotificationEvents', COLUMNS.NotificationEvents.eventKey, eventKey);
    if (existing.length > 0) return false;

    await sendTelegramMessage(chatId, `${title}\n${body}`);
    await appendRow('NotificationEvents', [uuidv4(), eventKey, userId, 'telegram', sentAt]);
    return true;
}

export async function POST(request: NextRequest) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization') || '';
    const receivedSecret = authHeader.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length)
        : '';
    if (receivedSecret !== cronSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        await ensureSheetWithHeaders('NotificationSettings', NOTIFICATION_SETTINGS_HEADERS);
        await ensureSheetWithHeaders('NotificationEvents', NOTIFICATION_EVENTS_HEADERS);

        const settingsData = await getSheetData('NotificationSettings');
        const rows = settingsData.slice(1);
        const now = new Date();
        const sentAt = now.toISOString();
        let checkedUsers = 0;
        let sentCount = 0;
        const errors: string[] = [];

        for (const row of rows) {
            const settings = parseSettingsRow(row);
            if (!settings.userId) continue;
            if (!settings.enabled || !settings.telegramEnabled || !settings.telegramChatId) continue;

            checkedUsers += 1;
            const today = localDateKey(now, settings.timezone);
            const nowHHMM = localTime(now, settings.timezone);

            try {
                if (settings.habitReminder && isTimeInWindow(nowHHMM, settings.habitReminderTime, 5)) {
                    const eventKey = `${today}|habit-reminder|${settings.userId}|telegram`;
                    const sent = await sendTelegramOnce(
                        settings.userId,
                        settings.telegramChatId,
                        eventKey,
                        '🎯 Пора отметить привычки!',
                        'Зайдите в приложение и отметьте выполненные привычки на сегодня.',
                        sentAt
                    );
                    if (sent) sentCount += 1;
                }

                if (settings.taskReminder) {
                    const taskRows = await findRows('Tasks', COLUMNS.Tasks.userId, settings.userId);
                    for (const taskRow of taskRows) {
                        const task = taskRow.data;
                        const completed = task[COLUMNS.Tasks.completed] === 'true';
                        const scheduledTime = task[COLUMNS.Tasks.scheduledTime] || '';
                        const deadline = task[COLUMNS.Tasks.deadline] || '';
                        if (completed || !scheduledTime) continue;
                        if (deadline && deadline !== today) continue;

                        const taskMinutes = toMinutes(scheduledTime);
                        if (taskMinutes < 0) continue;

                        const reminderMinutes = taskMinutes - settings.taskReminderMinutes;
                        if (reminderMinutes >= 0) {
                            const reminderHH = String(Math.floor(reminderMinutes / 60)).padStart(2, '0');
                            const reminderMM = String(reminderMinutes % 60).padStart(2, '0');
                            const reminderTime = `${reminderHH}:${reminderMM}`;
                            if (isTimeInWindow(nowHHMM, reminderTime, 5)) {
                                const taskId = task[COLUMNS.Tasks.id];
                                const taskTitle = task[COLUMNS.Tasks.title];
                                const eventKey = `${today}|task-before|${taskId}|telegram`;
                                const sent = await sendTelegramOnce(
                                    settings.userId,
                                    settings.telegramChatId,
                                    eventKey,
                                    `⏰ Задача через ${settings.taskReminderMinutes} мин`,
                                    `${taskTitle} — запланировано на ${scheduledTime}`,
                                    sentAt
                                );
                                if (sent) sentCount += 1;
                            }
                        }

                        if (isTimeInWindow(nowHHMM, scheduledTime, 5)) {
                            const taskId = task[COLUMNS.Tasks.id];
                            const taskTitle = task[COLUMNS.Tasks.title];
                            const eventKey = `${today}|task-now|${taskId}|telegram`;
                            const sent = await sendTelegramOnce(
                                settings.userId,
                                settings.telegramChatId,
                                eventKey,
                                '🔔 Время задачи!',
                                `${taskTitle} — сейчас ${scheduledTime}`,
                                sentAt
                            );
                            if (sent) sentCount += 1;
                        }
                    }
                }

                if (settings.goalReminder && isTimeInWindow(nowHHMM, settings.goalReminderTime, 5)) {
                    const eventKey = `${today}|goal-reminder|${settings.userId}|telegram`;
                    const sent = await sendTelegramOnce(
                        settings.userId,
                        settings.telegramChatId,
                        eventKey,
                        '🌟 Проверьте свои цели!',
                        'Уделите минуту, чтобы вспомнить о своих целях и мечтах.',
                        sentAt
                    );
                    if (sent) sentCount += 1;
                }

                if (settings.dailySummary && isTimeInWindow(nowHHMM, settings.dailySummaryTime, 5)) {
                    const habitRows = await findRows('Habits', COLUMNS.Habits.userId, settings.userId);
                    const logRows = await findRows('HabitLogs', COLUMNS.HabitLogs.userId, settings.userId);
                    const taskRows = await findRows('Tasks', COLUMNS.Tasks.userId, settings.userId);

                    const activeHabits = habitRows.filter((h) => h.data[COLUMNS.Habits.isActive] === 'true');
                    const todayLogs = logRows.filter((l) => l.data[COLUMNS.HabitLogs.date] === today);
                    const completedHabits = activeHabits.filter((habit) =>
                        todayLogs.some(
                            (log) =>
                                log.data[COLUMNS.HabitLogs.habitId] === habit.data[COLUMNS.Habits.id] &&
                                log.data[COLUMNS.HabitLogs.completed] === 'true'
                        )
                    );
                    const completedTasks = taskRows.filter((t) => t.data[COLUMNS.Tasks.completed] === 'true');
                    const pendingTasks = taskRows.filter((t) => t.data[COLUMNS.Tasks.completed] !== 'true');

                    const eventKey = `${today}|daily-summary|${settings.userId}|telegram`;
                    const sent = await sendTelegramOnce(
                        settings.userId,
                        settings.telegramChatId,
                        eventKey,
                        '📊 Итоги дня',
                        `Привычки: ${completedHabits.length}/${activeHabits.length} ✓ | Задачи выполнены: ${completedTasks.length} | Осталось: ${pendingTasks.length}`,
                        sentAt
                    );
                    if (sent) sentCount += 1;
                }
            } catch (error) {
                errors.push(
                    `user:${settings.userId} ${
                        error instanceof Error ? error.message : 'Unknown processing error'
                    }`
                );
            }
        }

        return NextResponse.json({
            success: true,
            checkedUsers,
            sentCount,
            errorsCount: errors.length,
            errors: errors.slice(0, 20),
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown cron error' },
            { status: 500 }
        );
    }
}
