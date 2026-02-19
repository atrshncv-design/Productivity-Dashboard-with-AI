'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import type { HabitLog } from '@/types';

type Range = 'week' | 'month' | 'year';

const RANGE_LABELS: Record<Range, string> = {
    week: 'Неделя',
    month: 'Месяц',
    year: 'Год',
};

const COLORS = ['#ff6b8a', '#5b8def', '#4ade80', '#f59e0b', '#a78bfa', '#22d3ee'];

const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function getDateRange(range: Range): { startDate: string; endDate: string; days: number } {
    const now = new Date();
    const endDate = now.toISOString().split('T')[0];
    let startDate: Date;
    let days: number;

    switch (range) {
        case 'week':
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - 6);
            days = 7;
            break;
        case 'month':
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - 29);
            days = 30;
            break;
        case 'year':
            startDate = new Date(now);
            startDate.setFullYear(startDate.getFullYear() - 1);
            days = 365;
            break;
    }

    return {
        startDate: startDate.toISOString().split('T')[0],
        endDate,
        days,
    };
}

interface DayData {
    date: string;
    label: string;
    completed: number;
    total: number;
    percent: number;
}

export default function ProgressCharts() {
    const [range, setRange] = useState<Range>('week');
    const [logs, setLogs] = useState<HabitLog[]>([]);
    const [habitCount, setHabitCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [chartData, setChartData] = useState<DayData[]>([]);
    const [streak, setStreak] = useState(0);
    const [avgCompletion, setAvgCompletion] = useState(0);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const { startDate, endDate } = getDateRange(range);

        try {
            const [logsRes, habitsRes] = await Promise.all([
                fetch(`/api/habit-logs?startDate=${startDate}&endDate=${endDate}`),
                fetch('/api/habits'),
            ]);
            const logsData = await logsRes.json();
            const habitsData = await habitsRes.json();
            const activeHabits = habitsData.filter((h: { isActive: boolean }) => h.isActive);

            setLogs(logsData);
            setHabitCount(activeHabits.length);
        } catch (error) {
            console.error('Error fetching progress data:', error);
        } finally {
            setLoading(false);
        }
    }, [range]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (habitCount === 0) {
            setChartData([]);
            setStreak(0);
            setAvgCompletion(0);
            return;
        }

        const { days } = getDateRange(range);
        const data: DayData[] = [];
        const now = new Date();
        let currentStreak = 0;
        let totalPercent = 0;

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];

            const dayLogs = logs.filter(l => l.date === dateStr);
            const completedCount = dayLogs.filter(l => l.completed).length;
            const percent = Math.round((completedCount / habitCount) * 100);

            let label = '';
            if (range === 'week') {
                const dayOfWeek = date.getDay();
                label = WEEKDAYS_SHORT[dayOfWeek === 0 ? 6 : dayOfWeek - 1];
            } else if (range === 'month') {
                label = `${date.getDate()}`;
            } else {
                const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
                label = months[date.getMonth()];
            }

            data.push({ date: dateStr, label, completed: completedCount, total: habitCount, percent });
            totalPercent += percent;
        }

        // Calculate streak (from today backwards)
        for (let i = data.length - 1; i >= 0; i--) {
            if (data[i].completed > 0) {
                currentStreak++;
            } else {
                break;
            }
        }

        setChartData(data);
        setStreak(currentStreak);
        setAvgCompletion(data.length > 0 ? Math.round(totalPercent / data.length) : 0);
    }, [logs, habitCount, range]);

    const pieData = [
        { name: 'Выполнено', value: avgCompletion },
        { name: 'Осталось', value: 100 - avgCompletion },
    ];

    // Aggregate data for year view
    const displayData = range === 'year'
        ? chartData.reduce<DayData[]>((acc, item) => {
            const last = acc[acc.length - 1];
            if (last && last.label === item.label) {
                last.completed += item.completed;
                last.total += item.total;
                last.percent = Math.round((last.completed / last.total) * 100);
            } else {
                acc.push({ ...item });
            }
            return acc;
        }, [])
        : chartData;

    if (loading) {
        return (
            <div className="card">
                <h3 className="charts-section__title">📊 Прогресс</h3>
                <div className="ai-loading">
                    <div className="ai-loading__spinner" />
                </div>
            </div>
        );
    }

    return (
        <div className="card">
            <div className="charts-section__header">
                <h3 className="charts-section__title">📊 Прогресс</h3>
                <div className="charts-section__range">
                    {(Object.keys(RANGE_LABELS) as Range[]).map(r => (
                        <button
                            key={r}
                            className={`charts-section__range-btn ${range === r ? 'charts-section__range-btn--active' : ''}`}
                            onClick={() => setRange(r)}
                        >
                            {RANGE_LABELS[r]}
                        </button>
                    ))}
                </div>
            </div>

            <div className="streak-display">
                <div className="streak-badge">
                    <div className="streak-badge__value">🔥 {streak}</div>
                    <div className="streak-badge__label">Дней подряд</div>
                </div>
                <div className="streak-badge">
                    <div className="streak-badge__value">{avgCompletion}%</div>
                    <div className="streak-badge__label">Среднее выполнение</div>
                </div>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                    <ResponsiveContainer width={120} height={120}>
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={35}
                                outerRadius={50}
                                startAngle={90}
                                endAngle={-270}
                                dataKey="value"
                                strokeWidth={0}
                            >
                                <Cell fill="#ff6b8a" />
                                <Cell fill="rgba(255,255,255,0.05)" />
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={displayData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorPercent" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#5b8def" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#5b8def" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis
                            dataKey="label"
                            stroke="var(--text-tertiary)"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="var(--text-tertiary)"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                            domain={[0, 100]}
                            tickFormatter={(v) => `${v}%`}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                fontSize: '0.8rem',
                            }}
                            formatter={(value: number | undefined) => [`${value ?? 0}%`, 'Выполнение']}
                        />
                        <Area
                            type="monotone"
                            dataKey="percent"
                            stroke="#5b8def"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorPercent)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
