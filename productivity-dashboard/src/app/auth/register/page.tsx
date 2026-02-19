'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Пароли не совпадают');
            return;
        }

        if (password.length < 6) {
            setError('Пароль должен быть не менее 6 символов');
            return;
        }

        setLoading(true);

        try {
            const result = await signIn('credentials', {
                email,
                password,
                name,
                isRegister: 'true',
                redirect: false,
            });

            if (result?.error) {
                setError(result.error);
            } else {
                router.push('/dashboard');
            }
        } catch {
            setError('Произошла ошибка. Попробуйте позже.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-card__logo">
                    <div className="auth-card__logo-icon">⚡</div>
                    <h1 className="auth-card__title">Регистрация</h1>
                    <p className="auth-card__subtitle">Создайте свой аккаунт</p>
                </div>

                {error && <div className="auth-card__error">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="name">Имя</label>
                        <input
                            id="name"
                            type="text"
                            className="input"
                            placeholder="Ваше имя"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            className="input"
                            placeholder="your@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="password">Пароль</label>
                        <input
                            id="password"
                            type="password"
                            className="input"
                            placeholder="Минимум 6 символов"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="confirmPassword">Подтвердите пароль</label>
                        <input
                            id="confirmPassword"
                            type="password"
                            className="input"
                            placeholder="Повторите пароль"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="btn btn--primary" style={{ width: '100%', marginTop: '8px' }} disabled={loading}>
                        {loading ? 'Создание аккаунта...' : 'Создать аккаунт'}
                    </button>
                </form>

                <div className="auth-card__footer">
                    Уже есть аккаунт? <Link href="/auth/login">Войдите</Link>
                </div>
            </div>
        </div>
    );
}
