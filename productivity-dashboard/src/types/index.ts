export interface User {
    id: string;
    email: string;
    name: string;
    passwordHash?: string;
    createdAt: string;
}

export interface Habit {
    id: string;
    userId: string;
    name: string;
    icon: string;
    frequency: 'daily' | 'weekly' | 'custom';
    isPreset: boolean;
    isActive: boolean;
    createdAt: string;
}

export interface HabitLog {
    id: string;
    habitId: string;
    userId: string;
    date: string; // YYYY-MM-DD
    completed: boolean;
}

export type Priority = 'high' | 'medium' | 'low';

export interface Task {
    id: string;
    userId: string;
    title: string;
    description: string;
    priority: Priority;
    category: string;
    deadline: string;
    scheduledTime: string;
    completed: boolean;
    parentTaskId: string | null;
    createdAt: string;
}

export interface Category {
    id: string;
    userId: string;
    name: string;
    color: string;
}

export interface HabitStreak {
    habitId: string;
    habitName: string;
    currentStreak: number;
    longestStreak: number;
    completionRate: number;
}

export interface DailyStats {
    date: string;
    habitsCompleted: number;
    habitsTotal: number;
    tasksCompleted: number;
    tasksTotal: number;
}

export type GoalCategory = 'dream' | 'short-term' | 'long-term';
export type GoalStatus = 'active' | 'completed' | 'paused';

export interface Goal {
    id: string;
    userId: string;
    title: string;
    description: string;
    category: GoalCategory;
    status: GoalStatus;
    targetDate: string;
    createdAt: string;
}
