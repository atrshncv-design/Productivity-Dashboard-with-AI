'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Habit, HabitLog } from '@/types';

export default function HabitTracker() {
    const [habits, setHabits] = useState<Habit[]>([]);
    const [logs, setLogs] = useState<HabitLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newHabitName, setNewHabitName] = useState('');
    const [newHabitIcon, setNewHabitIcon] = useState('⭐');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [actionError, setActionError] = useState('');

    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    const today = formatDate(new Date());
    const currentDateStr = formatDate(selectedDate);
    const isToday = currentDateStr === today;

    const fetchData = useCallback(async () => {
        try {
            const [habitsRes, logsRes] = await Promise.all([
                fetch('/api/habits'),
                fetch(`/api/habit-logs?date=${currentDateStr}`),
            ]);
            if (!habitsRes.ok || !logsRes.ok) {
                throw new Error('Не удалось загрузить привычки');
            }
            const habitsData = await habitsRes.json();
            const logsData = await logsRes.json();
            setHabits(habitsData.filter((h: Habit) => h.isActive));
            setLogs(logsData);
        } catch (error) {
            console.error('Error fetching habits:', error);
            setActionError('Не удалось загрузить привычки');
        } finally {
            setLoading(false);
        }
    }, [currentDateStr]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const changeDate = (offset: number) => {
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() + offset);
        // Don't allow future dates
        if (newDate <= new Date()) {
            setSelectedDate(newDate);
        }
    };

    const toggleHabit = async (habitId: string) => {
        const existingLog = logs.find(l => l.habitId === habitId);
        const newCompleted = !existingLog?.completed;

        // Optimistic update
        if (existingLog) {
            setLogs(logs.map(l => l.habitId === habitId ? { ...l, completed: newCompleted } : l));
        } else {
            setLogs([...logs, { id: 'temp', habitId, userId: '', date: currentDateStr, completed: true }]);
        }

        try {
            const res = await fetch('/api/habit-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ habitId, date: currentDateStr, completed: newCompleted }),
            });
            if (!res.ok) {
                throw new Error('Не удалось обновить привычку');
            }
        } catch (error) {
            console.error('Error toggling habit:', error);
            setActionError('Не удалось обновить привычку');
            fetchData(); // Revert on error
        }
    };

    const addHabit = async () => {
        if (!newHabitName.trim()) return;

        try {
            const res = await fetch('/api/habits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newHabitName, icon: newHabitIcon }),
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || 'Не удалось добавить привычку');
            }
            const newHabit = await res.json();
            setHabits((prev) => [...prev, { ...newHabit, isActive: true }]);
            setNewHabitName('');
            setNewHabitIcon('⭐');
            setShowAddModal(false);
            setActionError('');
        } catch (error) {
            console.error('Error adding habit:', error);
            setActionError(error instanceof Error ? error.message : 'Ошибка при добавлении привычки');
        }
    };

    const removeHabit = async (habitId: string) => {
        if (!confirm('Удалить эту привычку?')) return;
        try {
            const res = await fetch(`/api/habits?id=${habitId}`, { method: 'DELETE' });
            if (!res.ok) {
                throw new Error('Не удалось удалить привычку');
            }
            setHabits((prev) => prev.filter(h => h.id !== habitId));
        } catch (error) {
            console.error('Error removing habit:', error);
            setActionError('Не удалось удалить привычку');
        }
    };

    const completedCount = habits.filter(h =>
        logs.find(l => l.habitId === h.id && l.completed)
    ).length;

    const completionPercent = habits.length > 0
        ? Math.round((completedCount / habits.length) * 100)
        : 0;

    const formatDisplayDate = (d: Date) => {
        if (isToday) return 'Сегодня';
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (formatDate(d) === formatDate(yesterday)) return 'Вчера';
        return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    };

    if (loading) {
        return (
            <div className="card">
                <div className="habit-tracker__header">
                    <h3 className="habit-tracker__title">🎯 Трекер привычек</h3>
                </div>
                <div className="ai-loading">
                    <div className="ai-loading__spinner" />
                    <p>Загрузка привычек...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="card">
            <div className="habit-tracker__header">
                <div>
                    <h3 className="habit-tracker__title">🎯 Трекер привычек</h3>
                    <p className="habit-tracker__date">
                        {completedCount}/{habits.length} выполнено · {completionPercent}%
                    </p>
                </div>
                <button className="btn btn--secondary btn--small" onClick={() => setShowAddModal(true)}>
                    + Добавить
                </button>
            </div>
            {actionError && (
                <p style={{ color: 'var(--priority-high)', marginBottom: 'var(--space-sm)', fontSize: '0.8rem' }}>
                    {actionError}
                </p>
            )}

            {/* Date navigation */}
            <div className="habit-tracker__date-nav">
                <button className="btn btn--ghost btn--small" onClick={() => changeDate(-1)}>
                    ←
                </button>
                <span className="habit-tracker__date-label">{formatDisplayDate(selectedDate)}</span>
                <button
                    className="btn btn--ghost btn--small"
                    onClick={() => changeDate(1)}
                    disabled={isToday}
                >
                    →
                </button>
            </div>

            <div style={{ marginBottom: 'var(--space-md)' }}>
                <div className="progress-bar">
                    <div className="progress-bar__fill" style={{ width: `${completionPercent}%` }} />
                </div>
            </div>

            <div className="habit-tracker">
                {habits.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state__icon">🎯</div>
                        <p className="empty-state__text">Нет привычек. Добавьте первую!</p>
                    </div>
                ) : (
                    habits.map(habit => {
                        const isCompleted = logs.find(l => l.habitId === habit.id)?.completed || false;
                        return (
                            <div key={habit.id} className={`habit-item ${isCompleted ? 'habit-item--completed' : ''}`}>
                                <div className="habit-item__icon">{habit.icon}</div>
                                <div className="habit-item__info">
                                    <div className={`habit-item__name ${isCompleted ? 'checkbox__label--checked' : ''}`}>
                                        {habit.name}
                                    </div>
                                </div>
                                <div className="habit-item__actions">
                                    <input
                                        type="checkbox"
                                        className="checkbox__input"
                                        checked={isCompleted}
                                        onChange={() => toggleHabit(habit.id)}
                                    />
                                    <button
                                        className="btn btn--ghost btn--small habit-item__delete"
                                        onClick={() => removeHabit(habit.id)}
                                        title="Удалить"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal__header">
                            <h3 className="modal__title">Добавить привычку</h3>
                            <button className="modal__close" onClick={() => setShowAddModal(false)}>✕</button>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Иконка</label>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {['⭐', '🏋️', '📚', '🧘', '💧', '🚶', '😴', '🎵', '💻', '🍎', '✍️', '🧹'].map(icon => (
                                    <button
                                        key={icon}
                                        className={`btn btn--ghost ${newHabitIcon === icon ? 'btn--secondary' : ''}`}
                                        style={{ fontSize: '1.3rem', padding: '8px' }}
                                        onClick={() => setNewHabitIcon(icon)}
                                    >
                                        {icon}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Название</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="Например: Утренняя пробежка"
                                value={newHabitName}
                                onChange={(e) => setNewHabitName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addHabit()}
                                autoFocus
                            />
                        </div>
                        <div className="modal__actions">
                            <button className="btn btn--secondary" onClick={() => setShowAddModal(false)}>Отмена</button>
                            <button className="btn btn--primary" onClick={addHabit} disabled={!newHabitName.trim()}>
                                Добавить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
