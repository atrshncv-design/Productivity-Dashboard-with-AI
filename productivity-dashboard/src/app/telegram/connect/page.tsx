'use client';

import { useEffect, useMemo, useState } from 'react';

type ConnectPayload = {
    deepLink: string;
    appDeepLink: string;
    botUsername?: string;
    error?: string;
};

export default function TelegramConnectPage() {
    const [payload, setPayload] = useState<ConnectPayload | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

        const connect = async () => {
            try {
                const res = await fetch('/api/notifications/telegram/connect', { method: 'POST' });
                const data = (await res.json().catch(() => ({}))) as ConnectPayload;
                if (!res.ok || !data?.deepLink || !data?.appDeepLink) {
                    throw new Error(data?.error || 'Не удалось открыть Telegram');
                }

                setPayload(data);

                // Try opening Telegram app first, then fallback to web bot page.
                fallbackTimer = setTimeout(() => {
                    window.location.replace(data.deepLink);
                }, 900);

                window.location.href = data.appDeepLink;
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Не удалось открыть Telegram');
            }
        };

        void connect();

        return () => {
            if (fallbackTimer) clearTimeout(fallbackTimer);
        };
    }, []);

    const botName = useMemo(() => payload?.botUsername || 'бота', [payload]);
    const webLink = payload?.deepLink || '#';

    return (
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px', background: '#0f1115', color: '#e5e7eb' }}>
            <div style={{ maxWidth: '480px', width: '100%', background: '#171a21', border: '1px solid #2b3240', borderRadius: '14px', padding: '24px' }}>
                <h1 style={{ margin: '0 0 12px', fontSize: '1.25rem' }}>Открываем Telegram</h1>
                {!error && (
                    <p style={{ margin: '0 0 16px', lineHeight: 1.5 }}>
                        Перенаправляем вас к {botName}. Если приложение не открылось автоматически, нажмите кнопку ниже.
                    </p>
                )}
                {error && (
                    <p style={{ margin: '0 0 16px', color: '#f87171', lineHeight: 1.5 }}>
                        {error}
                    </p>
                )}
                <a
                    href={webLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        height: '42px',
                        borderRadius: '10px',
                        background: '#22c55e',
                        color: '#03170b',
                        fontWeight: 700,
                        textDecoration: 'none',
                    }}
                >
                    Открыть Telegram-бота
                </a>
            </div>
        </main>
    );
}
