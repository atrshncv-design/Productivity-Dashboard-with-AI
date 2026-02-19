'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const result = await signIn('credentials', {
                email,
                password,
                isRegister: 'false',
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
                    <h1 className="auth-card__title">Вход</h1>
                    <p className="auth-card__subtitle">Добро пожаловать обратно</p>
                </div>

                {error && <div className="auth-card__error">{error}</div>}

                <form onSubmit={handleSubmit}>
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
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="btn btn--primary" style={{ width: '100%', marginTop: '8px' }} disabled={loading}>
                        {loading ? 'Вход...' : 'Войти'}
                    </button>
                </form>

                <div className="auth-card__footer">
                    Нет аккаунта? <Link href="/auth/register">Зарегистрируйтесь</Link>
                </div>
            </div>
        </div>
    );
}
