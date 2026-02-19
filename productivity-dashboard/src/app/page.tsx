'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    if (session) {
      router.push('/dashboard');
    } else {
      router.push('/auth/login');
    }
  }, [session, status, router]);

  return (
    <div className="auth-page">
      <div style={{ textAlign: 'center' }}>
        <div className="ai-loading__spinner" />
        <p style={{ color: 'var(--text-secondary)' }}>Загрузка...</p>
      </div>
    </div>
  );
}
