'use client';

import { useState, useEffect } from 'react';

interface Stats {
    habitsToday: number;
    habitsTotal: number;
    tasksCompleted: number;
    tasksTotal: number;
}

export default function StatsCards() {
    const [stats, setStats] = useState<Stats>({ habitsToday: 0, habitsTotal: 0, tasksCompleted: 0, tasksTotal: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const today = new Date().toISOString().split('T')[0];
                const [habitsRes, logsRes, tasksRes] = await Promise.all([
                    fetch('/api/habits'),
                    fetch(`/api/habit-logs?date=${today}`),
                    fetch('/api/tasks'),
                ]);

                const habits = await habitsRes.json();
                const logs = await logsRes.json();
                const tasks = await tasksRes.json();

                const activeHabits = habits.filter((h: { isActive: boolean }) => h.isActive);
                const completedLogs = logs.filter((l: { completed: boolean }) => l.completed);
                const completedTasks = tasks.filter((t: { completed: boolean }) => t.completed);

                setStats({
                    habitsToday: completedLogs.length,
                    habitsTotal: activeHabits.length,
                    tasksCompleted: completedTasks.length,
                    tasksTotal: tasks.length,
                });
            } catch (error) {
                console.error('Error fetching stats:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
        const interval = setInterval(fetchStats, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, []);

    const habitsPercent = stats.habitsTotal > 0 ? Math.round((stats.habitsToday / stats.habitsTotal) * 100) : 0;
    const tasksPercent = stats.tasksTotal > 0 ? Math.round((stats.tasksCompleted / stats.tasksTotal) * 100) : 0;

    if (loading) {
        return (
            <div className="stats-grid">
                {[1, 2, 3].map(i => (
                    <div key={i} className="card stat-card animate-pulse">
                        <div style={{ height: '80px' }} />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="stats-grid">
            <div className="card stat-card card--gradient-1 stat-card--pink">
                <div className="stat-card__icon">🎯</div>
                <div className="stat-card__value">{habitsPercent}%</div>
                <div className="stat-card__label">Привычки сегодня</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                    {stats.habitsToday}/{stats.habitsTotal}
                </div>
            </div>

            <div className="card stat-card card--gradient-2 stat-card--green">
                <div className="stat-card__icon">✅</div>
                <div className="stat-card__value">{tasksPercent}%</div>
                <div className="stat-card__label">Задачи выполнены</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                    {stats.tasksCompleted}/{stats.tasksTotal}
                </div>
            </div>

            <div className="card stat-card stat-card--purple">
                <div className="stat-card__icon">⚡</div>
                <div className="stat-card__value">{Math.round((habitsPercent + tasksPercent) / 2)}%</div>
                <div className="stat-card__label">Общая продуктивность</div>
            </div>
        </div>
    );
}
