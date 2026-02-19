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
};

const STORAGE_KEY = 'notification_settings';
const SENT_KEY = 'notifications_sent_today';

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

function isTimePassed(timeStr: string): boolean {
    const now = new Date();
    const [hours, minutes] = timeStr.split(':').map(Number);
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);
    return now >= target;
}

function isTimeInWindow(timeStr: string, windowMinutes: number = 5): boolean {
    const now = new Date();
    const [hours, minutes] = timeStr.split(':').map(Number);
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);
    const diff = now.getTime() - target.getTime();
    return diff >= 0 && diff <= windowMinutes * 60 * 1000;
}

async function sendNotification(title: string, body: string, tag: string, url?: string) {
    if (Notification.permission !== 'granted') return;

    const sent = getSentToday();
    if (sent.has(tag)) return;

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
        markSent(tag);
    } catch (error) {
        console.error('Error sending notification:', error);
    }
}

export function useNotifications() {
    const [settings, setSettingsState] = useState<NotificationSettings>(DEFAULT_SETTINGS);
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [swRegistered, setSwRegistered] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Load settings on mount
    useEffect(() => {
        setSettingsState(getSettings());
        if (typeof Notification !== 'undefined') {
            setPermission(Notification.permission);
        }
    }, []);

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

            // Send immediate welcome notification
            sendNotification(
                '🎉 Уведомления включены!',
                'Теперь вы будете получать напоминания о задачах, привычках и целях.',
                'welcome'
            );
            return true;
        }
        return false;
    }, [settings]);

    const updateSettings = useCallback((updates: Partial<NotificationSettings>) => {
        const newSettings = { ...settings, ...updates };
        setSettingsState(newSettings);
        saveSettings(newSettings);
    }, [settings]);

    // Check and send notifications periodically
    const checkNotifications = useCallback(async () => {
        if (!settings.enabled || permission !== 'granted') return;

        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        // 1. Habit reminder
        if (settings.habitReminder && isTimeInWindow(settings.habitReminderTime, 2)) {
            sendNotification(
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
                            sendNotification(
                                `⏰ Задача через ${settings.taskReminderMinutes} мин`,
                                `${task.title} — запланировано на ${task.scheduledTime}`,
                                `task-${task.id}`
                            );
                        }

                        // Also notify when it's exactly the scheduled time
                        const exactDiff = now.getTime() - taskTime.getTime();
                        if (exactDiff >= 0 && exactDiff <= 2 * 60 * 1000) {
                            sendNotification(
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
            sendNotification(
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

                    sendNotification(
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
        sendTestNotification: (title: string, body: string) => {
            sendNotification(title, body, `test-${Date.now()}`);
        },
    };
}
