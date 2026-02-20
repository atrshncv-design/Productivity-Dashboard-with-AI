import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { appendRow, COLUMNS, ensureSheetWithHeaders, findRows, updateRow } from '@/lib/googleSheets';
import { sendTelegramMessage } from '@/lib/telegram';

const TELEGRAM_LINK_TOKENS_HEADERS = [
    'id',
    'userId',
    'token',
    'status',
    'chatId',
    'createdAt',
    'expiresAt',
    'usedAt',
];

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

type TelegramUpdate = {
    message?: {
        text?: string;
        chat?: {
            id?: number | string;
        };
    };
};

function parseIsoTime(value: string): number {
    const parsed = Date.parse(value || '');
    return Number.isFinite(parsed) ? parsed : 0;
}

function extractStartToken(text: string): string {
    const trimmed = text.trim();
    const match = trimmed.match(/^\/start(?:@\w+)?(?:\s+(.+))?$/i);
    return (match?.[1] || '').trim();
}

function ensureRowLength(row: string[], minLength: number): string[] {
    const next = [...row];
    while (next.length < minLength) next.push('');
    return next;
}

async function upsertNotificationSettingsForTelegram(userId: string, chatId: string) {
    const now = new Date().toISOString();
    await ensureSheetWithHeaders('NotificationSettings', NOTIFICATION_SETTINGS_HEADERS);

    const rows = await findRows('NotificationSettings', COLUMNS.NotificationSettings.userId, userId);
    if (rows.length === 0) {
        await appendRow('NotificationSettings', [
            uuidv4(),
            userId,
            'true',
            'true',
            '09:00',
            'true',
            '15',
            'true',
            '20:00',
            'true',
            '21:00',
            'true',
            chatId,
            'UTC',
            now,
        ]);
        return;
    }

    const updated = ensureRowLength(rows[0].data, COLUMNS.NotificationSettings.updatedAt + 1);
    updated[COLUMNS.NotificationSettings.enabled] = 'true';
    updated[COLUMNS.NotificationSettings.telegramEnabled] = 'true';
    updated[COLUMNS.NotificationSettings.telegramChatId] = chatId;
    if (!updated[COLUMNS.NotificationSettings.timezone]) {
        updated[COLUMNS.NotificationSettings.timezone] = 'UTC';
    }
    updated[COLUMNS.NotificationSettings.updatedAt] = now;
    await updateRow('NotificationSettings', rows[0].rowIndex, updated);
}

function getWelcomeText(isConnected: boolean): string {
    if (isConnected) {
        return [
            '✅ Telegram подключен к PRODUCTIVITY AI.',
            '',
            'Что умеет PRODUCTIVITY AI:',
            '• напоминать о привычках, задачах и целях',
            '• присылать ежедневную сводку прогресса',
            '• помогать с планированием через AI-ассистента',
            '',
            'Настройте время напоминаний в разделе «Уведомления» в приложении.',
        ].join('\n');
    }

    return [
        '👋 Добро пожаловать в PRODUCTIVITY AI!',
        '',
        'Этот бот отправляет напоминания о задачах, привычках и целях, а также ежедневную сводку.',
        'Чтобы подключить уведомления к вашему аккаунту, откройте приложение и нажмите «Подключить Telegram» в настройках уведомлений.',
    ].join('\n');
}

export async function POST(request: NextRequest) {
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (webhookSecret) {
        const incomingSecret = request.headers.get('x-telegram-bot-api-secret-token') || '';
        if (incomingSecret !== webhookSecret) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    let update: TelegramUpdate;
    try {
        update = (await request.json()) as TelegramUpdate;
    } catch {
        return NextResponse.json({ ok: true });
    }

    const chatIdRaw = update?.message?.chat?.id;
    const text = String(update?.message?.text || '');
    const chatId = String(chatIdRaw || '').trim();
    if (!chatId || !text) {
        return NextResponse.json({ ok: true });
    }

    const startToken = extractStartToken(text);
    if (text.trim().toLowerCase().startsWith('/start')) {
        if (!startToken) {
            try {
                await sendTelegramMessage(chatId, getWelcomeText(false));
            } catch {
                return NextResponse.json({ ok: true });
            }
            return NextResponse.json({ ok: true });
        }

        try {
            await ensureSheetWithHeaders('TelegramLinkTokens', TELEGRAM_LINK_TOKENS_HEADERS);
            const tokenRows = await findRows('TelegramLinkTokens', COLUMNS.TelegramLinkTokens.token, startToken);
            if (tokenRows.length === 0) {
                await sendTelegramMessage(chatId, getWelcomeText(false));
                return NextResponse.json({ ok: true });
            }

            const tokenRow = tokenRows[0];
            const tokenData = ensureRowLength(tokenRow.data, COLUMNS.TelegramLinkTokens.usedAt + 1);
            const status = tokenData[COLUMNS.TelegramLinkTokens.status];
            const usedAt = tokenData[COLUMNS.TelegramLinkTokens.usedAt];
            const expiresAtRaw = tokenData[COLUMNS.TelegramLinkTokens.expiresAt];
            const userId = tokenData[COLUMNS.TelegramLinkTokens.userId];
            const isExpired = parseIsoTime(expiresAtRaw) > 0 && parseIsoTime(expiresAtRaw) <= Date.now();

            if (!userId || status === 'used' || usedAt) {
                await sendTelegramMessage(chatId, 'Эта ссылка уже использована. Создайте новую ссылку в PRODUCTIVITY AI.');
                return NextResponse.json({ ok: true });
            }

            if (isExpired) {
                tokenData[COLUMNS.TelegramLinkTokens.status] = 'expired';
                await updateRow('TelegramLinkTokens', tokenRow.rowIndex, tokenData);
                await sendTelegramMessage(chatId, 'Срок действия ссылки истёк. Создайте новую ссылку в PRODUCTIVITY AI.');
                return NextResponse.json({ ok: true });
            }

            await upsertNotificationSettingsForTelegram(userId, chatId);

            tokenData[COLUMNS.TelegramLinkTokens.status] = 'used';
            tokenData[COLUMNS.TelegramLinkTokens.chatId] = chatId;
            tokenData[COLUMNS.TelegramLinkTokens.usedAt] = new Date().toISOString();
            await updateRow('TelegramLinkTokens', tokenRow.rowIndex, tokenData);

            await sendTelegramMessage(chatId, getWelcomeText(true));
            return NextResponse.json({ ok: true });
        } catch {
            return NextResponse.json({ ok: true });
        }
    }

    return NextResponse.json({ ok: true });
}
