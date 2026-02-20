type TelegramGetMeResponse = {
    ok: boolean;
    result?: {
        username?: string;
    };
    description?: string;
};

function getTelegramApiBase(): string {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
        throw new Error('TELEGRAM_BOT_TOKEN is not configured');
    }
    return `https://api.telegram.org/bot${botToken}`;
}

export async function getTelegramBotUsername(): Promise<string> {
    const response = await fetch(`${getTelegramApiBase()}/getMe`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Telegram API error (getMe): ${errorText}`);
    }

    const payload = (await response.json()) as TelegramGetMeResponse;
    const username = payload?.result?.username?.trim();
    if (!payload.ok || !username) {
        throw new Error(payload.description || 'Telegram bot username is not available');
    }

    return username;
}

export async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
    const response = await fetch(`${getTelegramApiBase()}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            disable_web_page_preview: true,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Telegram API error: ${errorText}`);
    }
}
