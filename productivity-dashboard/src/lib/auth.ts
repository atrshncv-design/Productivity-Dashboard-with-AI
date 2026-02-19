import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { findRow, appendRow, COLUMNS } from './googleSheets';
import { v4 as uuidv4 } from 'uuid';

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Пароль', type: 'password' },
                name: { label: 'Имя', type: 'text' },
                isRegister: { label: 'Регистрация', type: 'text' },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error('Введите email и пароль');
                }

                const isRegister = credentials.isRegister === 'true';

                if (isRegister) {
                    // Registration
                    const existingUser = await findRow('Users', COLUMNS.Users.email, credentials.email);
                    if (existingUser) {
                        throw new Error('Пользователь с таким email уже существует');
                    }

                    const passwordHash = await bcrypt.hash(credentials.password, 12);
                    const id = uuidv4();
                    const now = new Date().toISOString();

                    await appendRow('Users', [
                        id,
                        credentials.email,
                        passwordHash,
                        credentials.name || credentials.email.split('@')[0],
                        now,
                    ]);

                    // Add default habits for new user
                    const defaultHabits = [
                        { name: 'Зарядка', icon: '🏋️' },
                        { name: 'Чтение', icon: '📚' },
                        { name: 'Медитация', icon: '🧘' },
                        { name: 'Выпить воду', icon: '💧' },
                        { name: 'Прогулка', icon: '🚶' },
                        { name: 'Сон 8 часов', icon: '😴' },
                    ];

                    for (const habit of defaultHabits) {
                        await appendRow('Habits', [
                            uuidv4(),
                            id,
                            habit.name,
                            habit.icon,
                            'daily',
                            'true',
                            'true',
                            now,
                        ]);
                    }

                    // Add default categories
                    const defaultCategories = [
                        { name: 'Работа', color: '#5b8def' },
                        { name: 'Личное', color: '#ff6b8a' },
                        { name: 'Здоровье', color: '#4ade80' },
                        { name: 'Обучение', color: '#f59e0b' },
                    ];

                    for (const cat of defaultCategories) {
                        await appendRow('Categories', [
                            uuidv4(),
                            id,
                            cat.name,
                            cat.color,
                        ]);
                    }

                    return { id, email: credentials.email, name: credentials.name || credentials.email.split('@')[0] };
                } else {
                    // Login
                    const userRow = await findRow('Users', COLUMNS.Users.email, credentials.email);
                    if (!userRow) {
                        throw new Error('Пользователь не найден');
                    }

                    const passwordMatch = await bcrypt.compare(
                        credentials.password,
                        userRow.data[COLUMNS.Users.passwordHash]
                    );

                    if (!passwordMatch) {
                        throw new Error('Неверный пароль');
                    }

                    return {
                        id: userRow.data[COLUMNS.Users.id],
                        email: userRow.data[COLUMNS.Users.email],
                        name: userRow.data[COLUMNS.Users.name],
                    };
                }
            },
        }),
    ],
    session: {
        strategy: 'jwt',
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as { id: string }).id = token.id as string;
            }
            return session;
        },
    },
    pages: {
        signIn: '/auth/login',
    },
    secret: process.env.NEXTAUTH_SECRET,
};
