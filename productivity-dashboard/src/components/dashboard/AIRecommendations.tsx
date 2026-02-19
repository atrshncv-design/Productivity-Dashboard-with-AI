'use client';

import { useState } from 'react';

interface Recommendation {
    title: string;
    description: string;
    type: 'tip' | 'motivation' | 'plan';
}

const TYPE_LABELS = {
    tip: { label: 'Совет', emoji: '💡' },
    motivation: { label: 'Мотивация', emoji: '🔥' },
    plan: { label: 'План дня', emoji: '📋' },
};

export default function AIRecommendations() {
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const fetchRecommendations = async () => {
        setLoading(true);
        setErrorMessage('');
        try {
            const res = await fetch('/api/ai', { method: 'POST' });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || 'Не удалось получить рекомендации');
            }
            const data = await res.json();
            setRecommendations(data);
            setHasLoaded(true);
        } catch (error) {
            console.error('Error fetching AI recommendations:', error);
            setErrorMessage(error instanceof Error ? error.message : 'Не удалось получить рекомендации');
            setRecommendations([{
                title: 'Не удалось получить рекомендации',
                description: 'Проверьте API-ключ OpenAI в файле .env',
                type: 'tip',
            }]);
            setHasLoaded(true);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card">
            <div className="ai-section__header">
                <h3 className="ai-section__title">
                    🤖 AI-Рекомендации
                </h3>
                <button
                    className="btn btn--secondary btn--small"
                    onClick={fetchRecommendations}
                    disabled={loading}
                >
                    {loading ? '⏳ Анализ...' : hasLoaded ? '🔄 Обновить' : '✨ Получить'}
                </button>
            </div>
            {errorMessage && (
                <p style={{ color: 'var(--priority-high)', marginBottom: 'var(--space-sm)', fontSize: '0.8rem' }}>
                    {errorMessage}
                </p>
            )}

            {loading ? (
                <div className="ai-loading">
                    <div className="ai-loading__spinner" />
                    <p>AI анализирует ваши данные...</p>
                </div>
            ) : !hasLoaded ? (
                <div className="empty-state">
                    <div className="empty-state__icon">🤖</div>
                    <p className="empty-state__text">
                        Нажмите кнопку выше, чтобы получить персональные рекомендации на основе ваших привычек и задач
                    </p>
                </div>
            ) : (
                <div>
                    {recommendations.map((rec, i) => (
                        <div key={i} className="ai-card">
                            <div className={`ai-card__type ai-card__type--${rec.type}`}>
                                {TYPE_LABELS[rec.type]?.emoji} {TYPE_LABELS[rec.type]?.label || rec.type}
                            </div>
                            <div className="ai-card__title">{rec.title}</div>
                            <div className="ai-card__description">{rec.description}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
