'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Task, Category, Priority } from '@/types';

const PRIORITY_LABELS: Record<Priority, string> = {
    high: 'Высокий',
    medium: 'Средний',
    low: 'Низкий',
};

export default function TaskList() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | Priority>('all');
    const [showAddModal, setShowAddModal] = useState(false);
    const [newTask, setNewTask] = useState({
        title: '',
        description: '',
        priority: 'medium' as Priority,
        category: '',
        deadline: '',
        parentTaskId: '',
    });

    const fetchData = useCallback(async () => {
        try {
            const [tasksRes, catsRes] = await Promise.all([
                fetch('/api/tasks'),
                fetch('/api/categories'),
            ]);
            const tasksData = await tasksRes.json();
            const catsData = await catsRes.json();
            setTasks(tasksData);
            setCategories(catsData);
        } catch (error) {
            console.error('Error fetching tasks:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const addTask = async () => {
        if (!newTask.title.trim()) return;

        try {
            const res = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTask),
            });
            const task = await res.json();
            setTasks([...tasks, task]);
            setNewTask({ title: '', description: '', priority: 'medium', category: '', deadline: '', parentTaskId: '' });
            setShowAddModal(false);
        } catch (error) {
            console.error('Error adding task:', error);
        }
    };

    const toggleTask = async (taskId: string) => {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        const newCompleted = !task.completed;
        setTasks(tasks.map(t => t.id === taskId ? { ...t, completed: newCompleted } : t));

        try {
            await fetch('/api/tasks', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: taskId, completed: newCompleted }),
            });
        } catch (error) {
            console.error('Error toggling task:', error);
            fetchData();
        }
    };

    const deleteTask = async (taskId: string) => {
        setTasks(tasks.filter(t => t.id !== taskId));
        try {
            await fetch(`/api/tasks?id=${taskId}`, { method: 'DELETE' });
        } catch (error) {
            console.error('Error deleting task:', error);
            fetchData();
        }
    };

    const parentTasks = tasks.filter(t => !t.parentTaskId);
    const filteredTasks = parentTasks.filter(t =>
        filter === 'all' ? true : t.priority === filter
    );

    // Sort: incomplete first, then by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const sortedTasks = [...filteredTasks].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return priorityOrder[a.priority as Priority] - priorityOrder[b.priority as Priority];
    });

    const getSubtasks = (parentId: string) => tasks.filter(t => t.parentTaskId === parentId);

    const isOverdue = (deadline: string) => {
        if (!deadline) return false;
        return new Date(deadline) < new Date(new Date().toDateString());
    };

    const completedCount = tasks.filter(t => t.completed).length;

    if (loading) {
        return (
            <div className="card">
                <div className="task-list__header">
                    <h3 className="task-list__title">📋 Задачи</h3>
                </div>
                <div className="ai-loading">
                    <div className="ai-loading__spinner" />
                    <p>Загрузка задач...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="card">
            <div className="task-list__header">
                <div>
                    <h3 className="task-list__title">📋 Задачи</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {completedCount}/{tasks.length} выполнено
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                    <div className="task-list__filters">
                        {(['all', 'high', 'medium', 'low'] as const).map(f => (
                            <button
                                key={f}
                                className={`task-list__filter-btn ${filter === f ? 'task-list__filter-btn--active' : ''}`}
                                onClick={() => setFilter(f)}
                            >
                                {f === 'all' ? 'Все' : PRIORITY_LABELS[f]}
                            </button>
                        ))}
                    </div>
                    <button className="btn btn--secondary btn--small" onClick={() => setShowAddModal(true)}>
                        + Задача
                    </button>
                </div>
            </div>

            {sortedTasks.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state__icon">📋</div>
                    <p className="empty-state__text">
                        {filter === 'all' ? 'Нет задач. Добавьте первую!' : 'Нет задач с данным приоритетом'}
                    </p>
                </div>
            ) : (
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {sortedTasks.map(task => (
                        <div key={task.id}>
                            <div className="task-item">
                                <input
                                    type="checkbox"
                                    className="checkbox__input"
                                    checked={task.completed}
                                    onChange={() => toggleTask(task.id)}
                                />
                                <div className="task-item__content">
                                    <div className={`task-item__title ${task.completed ? 'task-item__title--completed' : ''}`}>
                                        {task.title}
                                    </div>
                                    <div className="task-item__meta">
                                        <span className={`badge badge--${task.priority}`}>
                                            {PRIORITY_LABELS[task.priority as Priority] || task.priority}
                                        </span>
                                        {task.category && (
                                            <span className="task-item__category">{task.category}</span>
                                        )}
                                        {task.deadline && (
                                            <span className={`task-item__deadline ${isOverdue(task.deadline) && !task.completed ? 'task-item__deadline--overdue' : ''}`}>
                                                📅 {new Date(task.deadline).toLocaleDateString('ru-RU')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="task-item__actions">
                                    <button className="btn btn--ghost btn--small" onClick={() => deleteTask(task.id)} title="Удалить">
                                        🗑
                                    </button>
                                </div>
                            </div>
                            {/* Subtasks */}
                            {getSubtasks(task.id).length > 0 && (
                                <div className="subtasks">
                                    {getSubtasks(task.id).map(sub => (
                                        <div key={sub.id} className="task-item">
                                            <input
                                                type="checkbox"
                                                className="checkbox__input"
                                                checked={sub.completed}
                                                onChange={() => toggleTask(sub.id)}
                                            />
                                            <div className="task-item__content">
                                                <div className={`task-item__title ${sub.completed ? 'task-item__title--completed' : ''}`}>
                                                    {sub.title}
                                                </div>
                                            </div>
                                            <div className="task-item__actions">
                                                <button className="btn btn--ghost btn--small" onClick={() => deleteTask(sub.id)}>🗑</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal__header">
                            <h3 className="modal__title">Новая задача</h3>
                            <button className="modal__close" onClick={() => setShowAddModal(false)}>✕</button>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Название</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="Что нужно сделать?"
                                value={newTask.title}
                                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                                autoFocus
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Описание</label>
                            <textarea
                                className="input"
                                placeholder="Подробности (необязательно)"
                                value={newTask.description}
                                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                                rows={2}
                                style={{ resize: 'vertical' }}
                            />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                            <div className="form-group">
                                <label className="form-label">Приоритет</label>
                                <select
                                    className="select"
                                    value={newTask.priority}
                                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as Priority })}
                                >
                                    <option value="high">🔴 Высокий</option>
                                    <option value="medium">🟡 Средний</option>
                                    <option value="low">🟢 Низкий</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Дедлайн</label>
                                <input
                                    type="date"
                                    className="input"
                                    value={newTask.deadline}
                                    onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Категория</label>
                            <select
                                className="select"
                                value={newTask.category}
                                onChange={(e) => setNewTask({ ...newTask, category: e.target.value })}
                            >
                                <option value="">Без категории</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Подзадача к</label>
                            <select
                                className="select"
                                value={newTask.parentTaskId}
                                onChange={(e) => setNewTask({ ...newTask, parentTaskId: e.target.value })}
                            >
                                <option value="">Нет (основная задача)</option>
                                {parentTasks.filter(t => !t.completed).map(t => (
                                    <option key={t.id} value={t.id}>{t.title}</option>
                                ))}
                            </select>
                        </div>
                        <div className="modal__actions">
                            <button className="btn btn--secondary" onClick={() => setShowAddModal(false)}>Отмена</button>
                            <button className="btn btn--primary" onClick={addTask} disabled={!newTask.title.trim()}>
                                Добавить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
