'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Goal, GoalCategory, GoalStatus } from '@/types';

const CATEGORY_CONFIG: Record<GoalCategory, { label: string; icon: string; color: string }> = {
    dream: { label: 'Мечта', icon: '✨', color: 'var(--accent-purple)' },
    'short-term': { label: 'Краткосрочная', icon: '🎯', color: 'var(--accent-green)' },
    'long-term': { label: 'Долгосрочная', icon: '🚀', color: 'var(--accent-blue)' },
};

const STATUS_CONFIG: Record<GoalStatus, { label: string; icon: string }> = {
    active: { label: 'Активна', icon: '🔥' },
    completed: { label: 'Достигнута', icon: '✅' },
    paused: { label: 'На паузе', icon: '⏸️' },
};

export default function GoalsList() {
    const [goals, setGoals] = useState<Goal[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [filterCategory, setFilterCategory] = useState<'all' | GoalCategory>('all');
    const [actionError, setActionError] = useState('');
    const [newGoal, setNewGoal] = useState({
        title: '',
        description: '',
        category: 'short-term' as GoalCategory,
        targetDate: '',
    });

    const fetchGoals = useCallback(async () => {
        try {
            const res = await fetch('/api/goals');
            if (!res.ok) {
                throw new Error('Не удалось загрузить цели');
            }
            const data = await res.json();
            setGoals(data);
        } catch (error) {
            console.error('Error fetching goals:', error);
            setActionError('Не удалось загрузить цели');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchGoals();
    }, [fetchGoals]);

    const addGoal = async () => {
        if (!newGoal.title.trim()) return;

        try {
            const res = await fetch('/api/goals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newGoal),
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || 'Не удалось добавить цель');
            }
            const goal = await res.json();
            setGoals((prev) => [...prev, goal]);
            setNewGoal({ title: '', description: '', category: 'short-term', targetDate: '' });
            setShowAddModal(false);
            setActionError('');
        } catch (error) {
            console.error('Error adding goal:', error);
            setActionError(error instanceof Error ? error.message : 'Ошибка при добавлении цели');
        }
    };

    const updateGoalStatus = async (goalId: string, status: GoalStatus) => {
        setGoals(goals.map(g => g.id === goalId ? { ...g, status } : g));

        try {
            const res = await fetch('/api/goals', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: goalId, status }),
            });
            if (!res.ok) {
                throw new Error('Не удалось обновить цель');
            }
        } catch (error) {
            console.error('Error updating goal:', error);
            setActionError('Не удалось обновить цель');
            fetchGoals();
        }
    };

    const deleteGoal = async (goalId: string) => {
        if (!confirm('Удалить эту цель?')) return;
        setGoals(goals.filter(g => g.id !== goalId));
        try {
            const res = await fetch(`/api/goals?id=${goalId}`, { method: 'DELETE' });
            if (!res.ok) {
                throw new Error('Не удалось удалить цель');
            }
        } catch (error) {
            console.error('Error deleting goal:', error);
            setActionError('Не удалось удалить цель');
            fetchGoals();
        }
    };

    const filteredGoals = goals.filter(g =>
        filterCategory === 'all' ? true : g.category === filterCategory
    );

    // Sort: active first, then paused, then completed
    const statusOrder: Record<GoalStatus, number> = { active: 0, paused: 1, completed: 2 };
    const sortedGoals = [...filteredGoals].sort((a, b) =>
        statusOrder[a.status as GoalStatus] - statusOrder[b.status as GoalStatus]
    );

    const activeCount = goals.filter(g => g.status === 'active').length;
    const completedCount = goals.filter(g => g.status === 'completed').length;

    if (loading) {
        return (
            <div className="card">
                <div className="goals__header">
                    <h3 className="goals__title">🌟 Цели и мечты</h3>
                </div>
                <div className="ai-loading">
                    <div className="ai-loading__spinner" />
                    <p>Загрузка целей...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="card">
            <div className="goals__header">
                <div>
                    <h3 className="goals__title">🌟 Цели и мечты</h3>
                    <p className="goals__subtitle">
                        {activeCount} активных · {completedCount} достигнуто
                    </p>
                </div>
                <button className="btn btn--secondary btn--small" onClick={() => setShowAddModal(true)}>
                    + Цель
                </button>
            </div>
            {actionError && (
                <p style={{ color: 'var(--priority-high)', marginBottom: 'var(--space-sm)', fontSize: '0.8rem' }}>
                    {actionError}
                </p>
            )}

            {/* Category filter */}
            <div className="goals__filters">
                {(['all', 'dream', 'short-term', 'long-term'] as const).map(cat => (
                    <button
                        key={cat}
                        className={`task-list__filter-btn ${filterCategory === cat ? 'task-list__filter-btn--active' : ''}`}
                        onClick={() => setFilterCategory(cat)}
                    >
                        {cat === 'all' ? '🌈 Все' : `${CATEGORY_CONFIG[cat].icon} ${CATEGORY_CONFIG[cat].label}`}
                    </button>
                ))}
            </div>

            <div className="goals__list">
                {sortedGoals.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state__icon">🌟</div>
                        <p className="empty-state__text">
                            {filterCategory === 'all'
                                ? 'Нет целей. Запишите свою первую мечту!'
                                : 'Нет целей в этой категории'}
                        </p>
                    </div>
                ) : (
                    sortedGoals.map(goal => {
                        const catConfig = CATEGORY_CONFIG[goal.category as GoalCategory] || CATEGORY_CONFIG['short-term'];
                        const statusConfig = STATUS_CONFIG[goal.status as GoalStatus] || STATUS_CONFIG.active;
                        const isCompleted = goal.status === 'completed';

                        return (
                            <div key={goal.id} className={`goal-card ${isCompleted ? 'goal-card--completed' : ''} ${goal.status === 'paused' ? 'goal-card--paused' : ''}`}>
                                <div className="goal-card__header">
                                    <div className="goal-card__category-badge" style={{ color: catConfig.color, background: `${catConfig.color}15` }}>
                                        {catConfig.icon} {catConfig.label}
                                    </div>
                                    <div className="goal-card__actions">
                                        <select
                                            className="goal-card__status-select"
                                            value={goal.status}
                                            onChange={(e) => updateGoalStatus(goal.id, e.target.value as GoalStatus)}
                                        >
                                            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                                                <option key={key} value={key}>{cfg.icon} {cfg.label}</option>
                                            ))}
                                        </select>
                                        <button
                                            className="btn btn--ghost btn--small"
                                            onClick={() => deleteGoal(goal.id)}
                                            title="Удалить"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                                <h4 className={`goal-card__title ${isCompleted ? 'goal-card__title--completed' : ''}`}>
                                    {statusConfig.icon} {goal.title}
                                </h4>
                                {goal.description && (
                                    <p className="goal-card__description">{goal.description}</p>
                                )}
                                {goal.targetDate && (
                                    <div className="goal-card__date">
                                        📅 Цель до: {new Date(goal.targetDate).toLocaleDateString('ru-RU', {
                                            day: 'numeric',
                                            month: 'long',
                                            year: 'numeric',
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal__header">
                            <h3 className="modal__title">🌟 Новая цель</h3>
                            <button className="modal__close" onClick={() => setShowAddModal(false)}>✕</button>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Название цели</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="Например: Выучить английский до C1"
                                value={newGoal.title}
                                onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                                onKeyDown={(e) => e.key === 'Enter' && addGoal()}
                                autoFocus
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Описание / детали</label>
                            <textarea
                                className="input"
                                placeholder="Опишите цель подробнее: шаги, мотивацию..."
                                value={newGoal.description}
                                onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                                rows={3}
                                style={{ resize: 'vertical' }}
                            />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                            <div className="form-group">
                                <label className="form-label">Категория</label>
                                <select
                                    className="select"
                                    value={newGoal.category}
                                    onChange={(e) => setNewGoal({ ...newGoal, category: e.target.value as GoalCategory })}
                                >
                                    <option value="dream">✨ Мечта</option>
                                    <option value="short-term">🎯 Краткосрочная</option>
                                    <option value="long-term">🚀 Долгосрочная</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Целевая дата</label>
                                <input
                                    type="date"
                                    className="input"
                                    value={newGoal.targetDate}
                                    onChange={(e) => setNewGoal({ ...newGoal, targetDate: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="modal__actions">
                            <button className="btn btn--secondary" onClick={() => setShowAddModal(false)}>Отмена</button>
                            <button className="btn btn--primary" onClick={addGoal} disabled={!newGoal.title.trim()}>
                                Добавить цель
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
