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

    const today = new Date().toISOString().split('T')[0];

    const fetchData = useCallback(async () => {
        try {
            const [habitsRes, logsRes] = await Promise.all([
                fetch('/api/habits'),
                fetch(`/api/habit-logs?date=${today}`),
            ]);
            const habitsData = await habitsRes.json();
            const logsData = await logsRes.json();
            setHabits(habitsData.filter((h: Habit) => h.isActive));
            setLogs(logsData);
        } catch (error) {
            console.error('Error fetching habits:', error);
        } finally {
            setLoading(false);
        }
    }, [today]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const toggleHabit = async (habitId: string) => {
        const existingLog = logs.find(l => l.habitId === habitId);
        const newCompleted = !existingLog?.completed;

        // Optimistic update
        if (existingLog) {
            setLogs(logs.map(l => l.habitId === habitId ? { ...l, completed: newCompleted } : l));
        } else {
            setLogs([...logs, { id: 'temp', habitId, userId: '', date: today, completed: true }]);
        }

        try {
            await fetch('/api/habit-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ habitId, date: today, completed: newCompleted }),
            });
        } catch (error) {
            console.error('Error toggling habit:', error);
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
            const newHabit = await res.json();
            setHabits([...habits, { ...newHabit, isActive: true }]);
            setNewHabitName('');
            setNewHabitIcon('⭐');
            setShowAddModal(false);
        } catch (error) {
            console.error('Error adding habit:', error);
        }
    };

    const removeHabit = async (habitId: string) => {
        try {
            await fetch(`/api/habits?id=${habitId}`, { method: 'DELETE' });
            setHabits(habits.filter(h => h.id !== habitId));
        } catch (error) {
            console.error('Error removing habit:', error);
        }
    };

    const completedCount = habits.filter(h =>
        logs.find(l => l.habitId === h.id && l.completed)
    ).length;

    const completionPercent = habits.length > 0
        ? Math.round((completedCount / habits.length) * 100)
        : 0;

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
                            <div key={habit.id} className="habit-item">
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
                                    {!habit.isPreset && (
                                        <button
                                            className="btn btn--ghost btn--small"
                                            onClick={() => removeHabit(habit.id)}
                                            title="Удалить"
                                        >
                                            ✕
                                        </button>
                                    )}
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
