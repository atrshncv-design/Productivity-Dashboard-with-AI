'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface NotificationSettings {
    enabled: boolean;
    habitReminder: boolean;
    habitReminderTime: string; // HH:MM
    taskReminder: boolean;
    taskReminderMinutes: number; // minutes before scheduled time
    goalReminder: boolean;
    goalReminderTime: string; // HH:MM
    dailySummary: boolean;
    dailySummaryTime: string; // HH:MM
    telegramEnabled: boolean;
    telegramChatId: string;
}

const DEFAULT_SETTINGS: NotificationSettings = {
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
};

const STORAGE_KEY = 'notification_settings';
const SENT_KEY = 'notifications_sent_today';

function getBrowserTimezone(): string {
    if (typeof Intl === 'undefined') return 'UTC';
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function getSettings(): NotificationSettings {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    } catch { /* ignore */ }
    return DEFAULT_SETTINGS;
}

function saveSettings(settings: NotificationSettings) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function getSentToday(): Set<string> {
    if (typeof window === 'undefined') return new Set();
    try {
        const today = new Date().toISOString().split('T')[0];
        const stored = localStorage.getItem(SENT_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.date === today) return new Set(parsed.keys);
        }
    } catch { /* ignore */ }
    return new Set();
}

function markSent(key: string) {
    if (typeof window === 'undefined') return;
    const today = new Date().toISOString().split('T')[0];
    const sent = getSentToday();
    sent.add(key);
    localStorage.setItem(SENT_KEY, JSON.stringify({ date: today, keys: Array.from(sent) }));
}

function isTimeInWindow(timeStr: string, windowMinutes: number = 5): boolean {
    const now = new Date();
    const [hours, minutes] = timeStr.split(':').map(Number);
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);
    const diff = now.getTime() - target.getTime();
    return diff >= 0 && diff <= windowMinutes * 60 * 1000;
}

async function sendBrowserNotification(title: string, body: string, tag: string, url?: string): Promise<boolean> {
    if (Notification.permission !== 'granted') return false;

    const sentKey = `web:${tag}`;
    const sent = getSentToday();
    if (sent.has(sentKey)) return true;

    try {
        const registration = await navigator.serviceWorker?.ready;
        if (registration) {
            registration.active?.postMessage({
                type: 'SHOW_NOTIFICATION',
                title,
                options: {
                    body,
                    tag,
                    data: { url: url || '/dashboard' },
                    renotify: false,
                },
            });
        } else {
            // Fallback: direct notification
            new Notification(title, { body, tag, icon: '/icon-192.png' });
        }
        markSent(sentKey);
        return true;
    } catch (error) {
        console.error('Error sending browser notification:', error);
        return false;
    }
}

async function sendTelegramNotification(
    chatId: string,
    title: string,
    body: string,
    tag: string
): Promise<boolean> {
    const result = await sendTelegramNotificationDetailed(chatId, title, body, tag);
    return result.ok;
}

async function sendTelegramNotificationDetailed(
    chatId: string,
    title: string,
    body: string,
    tag: string
): Promise<{ ok: boolean; error?: string }> {
    if (!chatId.trim()) return { ok: false, error: 'chat_id is empty' };

    const sentKey = `tg:${tag}`;
    const sent = getSentToday();
    if (sent.has(sentKey)) return { ok: true };

    try {
        const res = await fetch('/api/notifications/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId, title, body }),
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            const detail = String(data?.details || data?.error || 'Telegram request failed');
            console.error('Telegram notification failed:', detail);
            return { ok: false, error: detail };
        }

        markSent(sentKey);
        return { ok: true };
    } catch (error) {
        console.error('Error sending Telegram notification:', error);
        return { ok: false, error: error instanceof Error ? error.message : 'Unknown Telegram error' };
    }
}

export function useNotifications() {
    const [settings, setSettingsState] = useState<NotificationSettings>(() => getSettings());
    const [permission, setPermission] = useState<NotificationPermission>(() => (
        typeof Notification !== 'undefined' ? Notification.permission : 'default'
    ));
    const [swRegistered, setSwRegistered] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const syncSettingsToServer = useCallback(async (nextSettings: NotificationSettings) => {
        try {
            await fetch('/api/notification-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...nextSettings,
                    timezone: getBrowserTimezone(),
                }),
            });
        } catch (error) {
            console.error('Failed to sync notification settings to server:', error);
        }
    }, []);

    const fetchServerSettings = useCallback(async (): Promise<NotificationSettings | null> => {
        try {
            const res = await fetch('/api/notification-settings');
            if (!res.ok) return null;
            const serverSettings = await res.json();
            return { ...getSettings(), ...serverSettings } as NotificationSettings;
        } catch (error) {
            console.error('Failed to load notification settings from server:', error);
            return null;
        }
    }, []);

    const reloadSettings = useCallback(async (): Promise<NotificationSettings | null> => {
        const merged = await fetchServerSettings();
        if (!merged) return null;
        setSettingsState(merged);
        saveSettings(merged);
        return merged;
    }, [fetchServerSettings]);

    useEffect(() => {
        let cancelled = false;

        const loadServerSettings = async () => {
            const merged = await fetchServerSettings();
            if (!merged || cancelled) return;
            setSettingsState(merged);
            saveSettings(merged);
        };

        void loadServerSettings();
        return () => {
            cancelled = true;
        };
    }, [fetchServerSettings]);

    // Register service worker
    useEffect(() => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

        navigator.serviceWorker.register('/sw.js')
            .then((reg) => {
                console.log('[Notifications] Service Worker registered');
                setSwRegistered(true);

                // Update SW if there's a new version
                reg.update();
            })
            .catch((err) => {
                console.error('[Notifications] SW registration failed:', err);
            });
    }, []);

    const requestPermission = useCallback(async () => {
        if (typeof Notification === 'undefined') return false;

        const result = await Notification.requestPermission();
        setPermission(result);

        if (result === 'granted') {
            const newSettings = { ...settings, enabled: true };
            setSettingsState(newSettings);
            saveSettings(newSettings);
            void syncSettingsToServer(newSettings);

            // Send immediate welcome notification
            sendBrowserNotification(
                '🎉 Уведомления включены!',
                'Теперь вы будете получать напоминания о задачах, привычках и целях.',
                'welcome'
            );
            return true;
        }
        return false;
    }, [settings, syncSettingsToServer]);

    const updateSettings = useCallback((updates: Partial<NotificationSettings>) => {
        const newSettings = { ...settings, ...updates };
        setSettingsState(newSettings);
        saveSettings(newSettings);
        void syncSettingsToServer(newSettings);
    }, [settings, syncSettingsToServer]);

    // Check and send notifications periodically
    const checkNotifications = useCallback(async () => {
        if (!settings.enabled) return;

        const canUseBrowser = permission === 'granted';
        const canUseTelegram = settings.telegramEnabled && settings.telegramChatId.trim().length > 0;
        if (!canUseBrowser && !canUseTelegram) return;

        const now = new Date();

        const notify = async (title: string, body: string, tag: string) => {
            await Promise.all([
                canUseBrowser ? sendBrowserNotification(title, body, tag) : Promise.resolve(),
                canUseTelegram ? sendTelegramNotification(settings.telegramChatId, title, body, tag) : Promise.resolve(),
            ]);
        };

        // 1. Habit reminder
        if (settings.habitReminder && isTimeInWindow(settings.habitReminderTime, 2)) {
            await notify(
                '🎯 Пора отметить привычки!',
                'Зайдите в приложение и отметьте выполненные привычки на сегодня.',
                'habit-reminder'
            );
        }

        // 2. Task time reminders - check for tasks with scheduled time
        if (settings.taskReminder) {
            try {
                const res = await fetch('/api/tasks');
                if (res.ok) {
                    const tasks = await res.json();
                    const today = now.toISOString().split('T')[0];

                    for (const task of tasks) {
                        if (task.completed || !task.scheduledTime) continue;

                        // Check if task is for today (either no deadline or deadline is today)
                        const isToday = !task.deadline || task.deadline === today;
                        if (!isToday) continue;

                        // Check if it's time to remind (N minutes before scheduled time)
                        const [taskH, taskM] = task.scheduledTime.split(':').map(Number);
                        const taskTime = new Date();
                        taskTime.setHours(taskH, taskM, 0, 0);

                        const reminderTime = new Date(taskTime.getTime() - settings.taskReminderMinutes * 60 * 1000);
                        const diffMs = now.getTime() - reminderTime.getTime();

                        if (diffMs >= 0 && diffMs <= 2 * 60 * 1000) {
                            await notify(
                                `⏰ Задача через ${settings.taskReminderMinutes} мин`,
                                `${task.title} — запланировано на ${task.scheduledTime}`,
                                `task-${task.id}`
                            );
                        }

                        // Also notify when it's exactly the scheduled time
                        const exactDiff = now.getTime() - taskTime.getTime();
                        if (exactDiff >= 0 && exactDiff <= 2 * 60 * 1000) {
                            await notify(
                                `🔔 Время задачи!`,
                                `${task.title} — сейчас ${task.scheduledTime}`,
                                `task-now-${task.id}`
                            );
                        }
                    }
                }
            } catch (error) {
                console.error('Error checking tasks for notifications:', error);
            }
        }

        // 3. Goal reminder
        if (settings.goalReminder && isTimeInWindow(settings.goalReminderTime, 2)) {
            await notify(
                '🌟 Проверьте свои цели!',
                'Уделите минуту, чтобы вспомнить о своих целях и мечтах.',
                'goal-reminder'
            );
        }

        // 4. Daily summary
        if (settings.dailySummary && isTimeInWindow(settings.dailySummaryTime, 2)) {
            try {
                const today = now.toISOString().split('T')[0];
                const [habitsRes, logsRes, tasksRes] = await Promise.all([
                    fetch('/api/habits'),
                    fetch(`/api/habit-logs?date=${today}`),
                    fetch('/api/tasks'),
                ]);

                if (habitsRes.ok && logsRes.ok && tasksRes.ok) {
                    const habits = await habitsRes.json();
                    const logs = await logsRes.json();
                    const tasks = await tasksRes.json();

                    const activeHabits = habits.filter((h: { isActive: boolean }) => h.isActive);
                    const completedHabits = activeHabits.filter((h: { id: string }) =>
                        logs.find((l: { habitId: string; completed: boolean }) => l.habitId === h.id && l.completed)
                    );
                    const completedTasks = tasks.filter((t: { completed: boolean }) => t.completed);
                    const pendingTasks = tasks.filter((t: { completed: boolean }) => !t.completed);

                    await notify(
                        '📊 Итоги дня',
                        `Привычки: ${completedHabits.length}/${activeHabits.length} ✓ | Задачи выполнены: ${completedTasks.length} | Осталось: ${pendingTasks.length}`,
                        'daily-summary'
                    );
                }
            } catch (error) {
                console.error('Error generating daily summary:', error);
            }
        }

    }, [settings, permission]);

    // Set up interval for checking notifications
    useEffect(() => {
        if (!settings.enabled || permission !== 'granted') return;

        // Check immediately on mount
        checkNotifications();

        // Check every minute
        intervalRef.current = setInterval(checkNotifications, 60 * 1000);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [settings.enabled, permission, checkNotifications]);

    return {
        settings,
        permission,
        swRegistered,
        requestPermission,
        updateSettings,
        sendTestNotification: async (title: string, body: string) => {
            if (permission !== 'granted') return false;
            await sendBrowserNotification(title, body, `test-web-${Date.now()}`);
            return true;
        },
        sendTestTelegram: async (title: string, body: string) => {
            if (!settings.telegramEnabled || !settings.telegramChatId.trim()) {
                return { ok: false, error: 'Telegram не включен или chat_id пустой' };
            }
            return sendTelegramNotificationDetailed(settings.telegramChatId, title, body, `test-tg-${Date.now()}`);
        },
        reloadSettings,
    };
}
