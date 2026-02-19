import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendTelegramMessage } from '@/lib/telegram';

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const chatId = String(body.chatId || '').trim();
    const title = String(body.title || '').trim();
    const textBody = String(body.body || '').trim();

    if (!chatId || !title || !textBody) {
        return NextResponse.json(
            { error: 'chatId, title and body are required' },
            { status: 400 }
        );
    }

    const text = `${title}\n${textBody}`;

    try {
        await sendTelegramMessage(chatId, text);
    } catch (error) {
        return NextResponse.json(
            {
                error: 'Failed to send Telegram message',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 502 }
        );
    }

    return NextResponse.json({ success: true });
}
