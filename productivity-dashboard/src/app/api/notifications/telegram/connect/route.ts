import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { v4 as uuidv4 } from 'uuid';
import { authOptions } from '@/lib/auth';
import { appendRow, COLUMNS, ensureSheetWithHeaders, findRows } from '@/lib/googleSheets';
import { getTelegramBotUsername } from '@/lib/telegram';

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

const LINK_TTL_MINUTES = 30;

function nowPlusMinutesIso(minutes: number): string {
    return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function parseIsoTime(value: string): number {
    const parsed = Date.parse(value || '');
    return Number.isFinite(parsed) ? parsed : 0;
}

function createStartToken(): string {
    return crypto.randomBytes(24).toString('base64url');
}

async function resolveBotUsername(): Promise<string> {
    const envUsername = String(process.env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '').trim();
    if (envUsername) return envUsername;
    return getTelegramBotUsername();
}

export async function POST() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const now = Date.now();

    try {
        await ensureSheetWithHeaders('TelegramLinkTokens', TELEGRAM_LINK_TOKENS_HEADERS);

        const existingRows = await findRows('TelegramLinkTokens', COLUMNS.TelegramLinkTokens.userId, userId);
        const activeRow = existingRows.find((row) => {
            const status = row.data[COLUMNS.TelegramLinkTokens.status];
            const token = row.data[COLUMNS.TelegramLinkTokens.token];
            const usedAt = row.data[COLUMNS.TelegramLinkTokens.usedAt];
            const expiresAt = parseIsoTime(row.data[COLUMNS.TelegramLinkTokens.expiresAt] || '');
            if (!token || usedAt || status === 'used') return false;
            if (!expiresAt) return true;
            return expiresAt > now;
        });

        const token = activeRow?.data[COLUMNS.TelegramLinkTokens.token] || createStartToken();
        const expiresAt = activeRow?.data[COLUMNS.TelegramLinkTokens.expiresAt] || nowPlusMinutesIso(LINK_TTL_MINUTES);

        if (!activeRow) {
            const createdAt = new Date(now).toISOString();
            await appendRow('TelegramLinkTokens', [
                uuidv4(),
                userId,
                token,
                'pending',
                '',
                createdAt,
                expiresAt,
                '',
            ]);
        }

        const botUsername = await resolveBotUsername();
        const botUsernameEncoded = encodeURIComponent(botUsername);
        const tokenEncoded = encodeURIComponent(token);
        const deepLink = `https://t.me/${botUsername}?start=${encodeURIComponent(token)}`;
        const appDeepLink = `tg://resolve?domain=${botUsernameEncoded}&start=${tokenEncoded}`;

        return NextResponse.json({
            success: true,
            deepLink,
            appDeepLink,
            botUsername: `@${botUsername}`,
            expiresAt,
        });
    } catch (error) {
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : 'Failed to create Telegram link',
            },
            { status: 500 }
        );
    }
}
