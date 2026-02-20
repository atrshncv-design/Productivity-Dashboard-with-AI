'use client';

import { useEffect, useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';

export default function NotificationSettings() {
    const {
        settings,
        permission,
        requestPermission,
        updateSettings,
        sendTestNotification,
        sendTestTelegram,
        reloadSettings,
    } = useNotifications();

    const [isExpanded, setIsExpanded] = useState(false);
    const [isTelegramConnecting, setIsTelegramConnecting] = useState(false);

    useEffect(() => {
        if (settings.telegramEnabled && !settings.telegramChatId.trim()) {
            setIsExpanded(true);
        }
    }, [settings.telegramEnabled, settings.telegramChatId]);

    const handleEnable = async () => {
        if (permission === 'denied') {
            alert('Уведомления заблокированы в настройках браузера. Пожалуйста, разрешите уведомления для этого сайта в настройках браузера.');
            return;
        }

        const granted = await requestPermission();
        if (!granted) {
            alert('Для работы уведомлений необходимо разрешение.');
        }
    };

    const handleTestNotification = async () => {
        const ok = await sendTestNotification(
            '🧪 Тестовое уведомление',
            'Если вы видите это сообщение, уведомления работают!'
        );
        if (!ok) {
            alert('Браузерные уведомления не разрешены.');
        }
    };

    const handleTestTelegram = async () => {
        const result = await sendTestTelegram(
            '🧪 Тест Telegram',
            'Если вы видите это сообщение, Telegram-уведомления работают.'
        );
        if (!result.ok) {
            const detail = result.error || 'Проверьте, что Telegram подключен.';
            if (detail.includes('bot was blocked by the user')) {
                alert('Telegram: бот заблокирован. Откройте ваш Telegram-бот, нажмите Start и разблокируйте его, затем повторите тест.');
                return;
            }
            if (detail.includes('chat not found')) {
                alert('Telegram: чат не найден. Нажмите «Подключить Telegram», откройте бота и нажмите Start.');
                return;
            }
            if (detail.includes('chat_id is empty') || detail.includes('chat_id пустой')) {
                alert('Telegram ещё не подключён. Нажмите «Подключить Telegram» и нажмите Start в боте.');
                return;
            }
            alert(`Ошибка Telegram: ${detail}`);
        }
    };

    const handleConnectTelegram = async () => {
        updateSettings({ enabled: true, telegramEnabled: true });

        const popup = typeof window !== 'undefined' ? window.open('', '_blank') : null;
        setIsTelegramConnecting(true);

        try {
            const res = await fetch('/api/notifications/telegram/connect', { method: 'POST' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.deepLink) {
                throw new Error(data?.error || 'Не удалось создать ссылку для Telegram');
            }

            const deepLink = String(data.deepLink);
            if (popup) {
                popup.location.href = deepLink;
            } else {
                window.open(deepLink, '_blank', 'noopener,noreferrer');
            }
            alert('Telegram открыт. Нажмите Start у бота, затем вернитесь и нажмите «Проверить подключение».');
        } catch (error) {
            if (popup) popup.close();
            alert(`Ошибка подключения Telegram: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
        } finally {
            setIsTelegramConnecting(false);
        }
    };

    const handleCheckTelegramConnection = async () => {
        const fresh = await reloadSettings();
        if (fresh?.telegramChatId.trim()) {
            alert('Telegram успешно подключён. Можно отправить тестовое уведомление.');
            return;
        }
        alert('Подключение пока не найдено. Откройте Telegram, нажмите Start у бота и проверьте снова.');
    };

    // Not granted yet - show enable button
    if (!settings.enabled && permission !== 'granted' && !settings.telegramEnabled) {
        return (
            <div className="card notification-enable-card">
                <div className="notification-enable">
                    <div className="notification-enable__icon">🔔</div>
                    <div className="notification-enable__content">
                        <h3 className="notification-enable__title">Включите уведомления</h3>
                        <p className="notification-enable__text">
                            Получайте напоминания о привычках, задачах и целях, чтобы не забывать о них.
                        </p>
                    </div>
                    <button
                        className="btn btn--primary"
                        onClick={handleEnable}
                    >
                        {permission === 'denied' ? '⚠️ Заблокировано' : '🔔 Включить'}
                    </button>
                    <button
                        className="btn btn--secondary"
                        onClick={handleConnectTelegram}
                    >
                        🤖 Telegram
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="card">
            <div className="notification-header" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="notification-header__left">
                    <h3 className="notification-header__title">🔔 Уведомления</h3>
                    <span className="notification-header__status notification-header__status--active">
                        Включены
                    </span>
                </div>
                <button className="btn btn--ghost btn--small">
                    {isExpanded ? '▲' : '▼'}
                </button>
            </div>

            {isExpanded && (
                <div className="notification-settings">
                    {/* Channel settings */}
                    <div className="notification-setting">
                        <div className="notification-setting__info">
                            <div className="notification-setting__icon">📨</div>
                            <div>
                                <div className="notification-setting__name">Telegram канал</div>
                                <div className="notification-setting__desc">
                                    Запасной канал, если браузерные push недоступны
                                </div>
                            </div>
                        </div>
                        <div className="notification-setting__controls">
                            <label className="notification-toggle">
                                <input
                                    type="checkbox"
                                    checked={settings.telegramEnabled}
                                    onChange={(e) => updateSettings({ telegramEnabled: e.target.checked, enabled: true })}
                                />
                                <span className="notification-toggle__slider" />
                            </label>
                        </div>
                    </div>

                    {settings.telegramEnabled && (
                        <div className="form-group">
                            <label className="form-label">Подключение Telegram</label>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                                {settings.telegramChatId.trim()
                                    ? `Подключено, chat_id: ${settings.telegramChatId}`
                                    : 'Нажмите кнопку ниже, чтобы открыть бота и подключить уведомления без ручного ввода chat_id.'}
                            </p>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                                <button
                                    className="btn btn--secondary btn--small"
                                    onClick={handleConnectTelegram}
                                    disabled={isTelegramConnecting}
                                >
                                    {isTelegramConnecting
                                        ? 'Открываем Telegram...'
                                        : settings.telegramChatId.trim()
                                            ? '🔄 Переподключить Telegram'
                                            : '🤖 Подключить Telegram'}
                                </button>
                                <button
                                    className="btn btn--ghost btn--small"
                                    onClick={handleCheckTelegramConnection}
                                >
                                    Проверить подключение
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Habit Reminder */}
                    <div className="notification-setting">
                        <div className="notification-setting__info">
                            <div className="notification-setting__icon">🎯</div>
                            <div>
                                <div className="notification-setting__name">Напоминание о привычках</div>
                                <div className="notification-setting__desc">
                                    Ежедневное напоминание отметить привычки
                                </div>
                            </div>
                        </div>
                        <div className="notification-setting__controls">
                            <input
                                type="time"
                                className="notification-setting__time"
                                value={settings.habitReminderTime}
                                onChange={(e) => updateSettings({ habitReminderTime: e.target.value })}
                                disabled={!settings.habitReminder}
                            />
                            <label className="notification-toggle">
                                <input
                                    type="checkbox"
                                    checked={settings.habitReminder}
                                    onChange={(e) => updateSettings({ habitReminder: e.target.checked })}
                                />
                                <span className="notification-toggle__slider" />
                            </label>
                        </div>
                    </div>

                    {/* Task Reminder */}
                    <div className="notification-setting">
                        <div className="notification-setting__info">
                            <div className="notification-setting__icon">📋</div>
                            <div>
                                <div className="notification-setting__name">Напоминание о задачах</div>
                                <div className="notification-setting__desc">
                                    Напоминание перед запланированным временем задачи
                                </div>
                            </div>
                        </div>
                        <div className="notification-setting__controls">
                            <select
                                className="notification-setting__select"
                                value={settings.taskReminderMinutes}
                                onChange={(e) => updateSettings({ taskReminderMinutes: Number(e.target.value) })}
                                disabled={!settings.taskReminder}
                            >
                                <option value={5}>за 5 мин</option>
                                <option value={10}>за 10 мин</option>
                                <option value={15}>за 15 мин</option>
                                <option value={30}>за 30 мин</option>
                                <option value={60}>за 1 час</option>
                            </select>
                            <label className="notification-toggle">
                                <input
                                    type="checkbox"
                                    checked={settings.taskReminder}
                                    onChange={(e) => updateSettings({ taskReminder: e.target.checked })}
                                />
                                <span className="notification-toggle__slider" />
                            </label>
                        </div>
                    </div>

                    {/* Goal Reminder */}
                    <div className="notification-setting">
                        <div className="notification-setting__info">
                            <div className="notification-setting__icon">🌟</div>
                            <div>
                                <div className="notification-setting__name">Напоминание о целях</div>
                                <div className="notification-setting__desc">
                                    Ежедневное напоминание проверить прогресс по целям
                                </div>
                            </div>
                        </div>
                        <div className="notification-setting__controls">
                            <input
                                type="time"
                                className="notification-setting__time"
                                value={settings.goalReminderTime}
                                onChange={(e) => updateSettings({ goalReminderTime: e.target.value })}
                                disabled={!settings.goalReminder}
                            />
                            <label className="notification-toggle">
                                <input
                                    type="checkbox"
                                    checked={settings.goalReminder}
                                    onChange={(e) => updateSettings({ goalReminder: e.target.checked })}
                                />
                                <span className="notification-toggle__slider" />
                            </label>
                        </div>
                    </div>

                    {/* Daily Summary */}
                    <div className="notification-setting">
                        <div className="notification-setting__info">
                            <div className="notification-setting__icon">📊</div>
                            <div>
                                <div className="notification-setting__name">Итоги дня</div>
                                <div className="notification-setting__desc">
                                    Сводка по привычкам и задачам за день
                                </div>
                            </div>
                        </div>
                        <div className="notification-setting__controls">
                            <input
                                type="time"
                                className="notification-setting__time"
                                value={settings.dailySummaryTime}
                                onChange={(e) => updateSettings({ dailySummaryTime: e.target.value })}
                                disabled={!settings.dailySummary}
                            />
                            <label className="notification-toggle">
                                <input
                                    type="checkbox"
                                    checked={settings.dailySummary}
                                    onChange={(e) => updateSettings({ dailySummary: e.target.checked })}
                                />
                                <span className="notification-toggle__slider" />
                            </label>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="notification-actions">
                        <button className="btn btn--secondary btn--small" onClick={handleTestNotification}>
                            🧪 Тестовое уведомление
                        </button>
                        {settings.telegramEnabled && (
                            <button className="btn btn--secondary btn--small" onClick={handleTestTelegram}>
                                📨 Тест Telegram
                            </button>
                        )}
                        <button
                            className="btn btn--ghost btn--small"
                            onClick={() => updateSettings({ enabled: false, telegramEnabled: false })}
                            style={{ color: 'var(--priority-high)' }}
                        >
                            Выключить все
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
