import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { findRows, COLUMNS } from '@/lib/googleSheets';
import { getProductivityRecommendations } from '@/lib/openai';

export async function POST() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const userName = session.user.name || 'Пользователь';

    // Get habits and their logs
    const habitsRows = await findRows('Habits', COLUMNS.Habits.userId, userId);
    const logsRows = await findRows('HabitLogs', COLUMNS.HabitLogs.userId, userId);
    const tasksRows = await findRows('Tasks', COLUMNS.Tasks.userId, userId);

    // Calculate habit stats
    const habitsData = habitsRows
        .filter((h) => h.data[COLUMNS.Habits.isActive] === 'true')
        .map((h) => {
            const habitId = h.data[COLUMNS.Habits.id];
            const habitLogs = logsRows.filter(
                (l) => l.data[COLUMNS.HabitLogs.habitId] === habitId
            );
            const completedLogs = habitLogs.filter(
                (l) => l.data[COLUMNS.HabitLogs.completed] === 'true'
            );

            // Calculate streak
            let streak = 0;
            const today = new Date();
            for (let i = 0; i < 365; i++) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                const log = habitLogs.find(
                    (l) => l.data[COLUMNS.HabitLogs.date] === dateStr && l.data[COLUMNS.HabitLogs.completed] === 'true'
                );
                if (log) {
                    streak++;
                } else if (i > 0) {
                    break;
                }
            }

            return {
                name: h.data[COLUMNS.Habits.name],
                completionRate: habitLogs.length > 0 ? completedLogs.length / habitLogs.length : 0,
                streak,
            };
        });

    const tasksData = tasksRows.map((t) => ({
        title: t.data[COLUMNS.Tasks.title],
        priority: t.data[COLUMNS.Tasks.priority],
        completed: t.data[COLUMNS.Tasks.completed] === 'true',
        deadline: t.data[COLUMNS.Tasks.deadline],
    }));

    const recommendations = await getProductivityRecommendations(habitsData, tasksData, userName);
    return NextResponse.json(recommendations);
}
