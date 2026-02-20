'use client';

import { useSession, signOut } from 'next-auth/react';
import { useState, useRef, useEffect } from 'react';

export default function Header() {
    const { data: session } = useSession();
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const userName = session?.user?.name || 'Пользователь';
    const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 6) return 'Доброй ночи';
        if (hour < 12) return 'Доброе утро';
        if (hour < 18) return 'Добрый день';
        return 'Добрый вечер';
    };

    return (
        <header className="dashboard__header">
            <div className="dashboard__header-left">
                <div className="dashboard__logo">⚡</div>
                <div className="dashboard__greeting">
                    <h1>{getGreeting()}, {userName}!</h1>
                    <p>Ваш персональный дашборд PRODUCTIVITY AI</p>
                </div>
            </div>

            <div className="dashboard__header-right">
                <div className="user-menu" ref={menuRef}>
                    <div
                        className="dashboard__avatar"
                        onClick={() => setShowMenu(!showMenu)}
                    >
                        {initials}
                    </div>
                    {showMenu && (
                        <div className="user-menu__dropdown">
                            <div className="user-menu__item" style={{ borderBottom: '1px solid var(--border-color)', pointerEvents: 'none' }}>
                                <span>👤</span>
                                <div>
                                    <div style={{ fontWeight: 600 }}>{userName}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{session?.user?.email}</div>
                                </div>
                            </div>
                            <button
                                className="user-menu__item user-menu__item--danger"
                                onClick={() => signOut({ callbackUrl: '/auth/login' })}
                            >
                                <span>🚪</span> Выйти
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
