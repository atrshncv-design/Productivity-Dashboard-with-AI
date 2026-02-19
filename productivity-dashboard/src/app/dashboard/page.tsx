'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Header from '@/components/dashboard/Header';
import TimeWidget from '@/components/dashboard/TimeWidget';
import StatsCards from '@/components/dashboard/StatsCards';
import HabitTracker from '@/components/dashboard/HabitTracker';
import TaskList from '@/components/dashboard/TaskList';
import GoalsList from '@/components/dashboard/GoalsList';
import NotificationSettings from '@/components/dashboard/NotificationSettings';
import AIRecommendations from '@/components/dashboard/AIRecommendations';
import ProgressCharts from '@/components/dashboard/ProgressCharts';

export default function DashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/auth/login');
        }
    }, [status, router]);

    if (status === 'loading') {
        return (
            <div className="auth-page">
                <div style={{ textAlign: 'center' }}>
                    <div className="ai-loading__spinner" />
                    <p style={{ color: 'var(--text-secondary)' }}>Загрузка дашборда...</p>
                </div>
            </div>
        );
    }

    if (!session) return null;

    return (
        <div className="dashboard">
            <Header />
            <div className="dashboard__content">
                {/* Notification prompt */}
                <div style={{ marginBottom: 'var(--space-lg)' }}>
                    <NotificationSettings />
                </div>

                {/* Row 1: Time + Stats */}
                <div className="dashboard__grid" style={{ marginBottom: 'var(--space-lg)' }}>
                    <TimeWidget />
                    <div className="dashboard__col-span-2">
                        <StatsCards />
                    </div>
                </div>

                {/* Row 2: Habits + Tasks */}
                <div className="dashboard__grid" style={{ marginBottom: 'var(--space-lg)' }}>
                    <HabitTracker />
                    <div className="dashboard__col-span-2">
                        <TaskList />
                    </div>
                </div>

                {/* Row 3: Goals */}
                <div className="dashboard__grid" style={{ marginBottom: 'var(--space-lg)' }}>
                    <div className="dashboard__col-span-3">
                        <GoalsList />
                    </div>
                </div>

                {/* Row 4: Charts + AI */}
                <div className="dashboard__grid">
                    <div className="dashboard__col-span-2">
                        <ProgressCharts />
                    </div>
                    <AIRecommendations />
                </div>
            </div>
        </div>
    );
}
