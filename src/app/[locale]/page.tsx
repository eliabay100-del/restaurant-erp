'use client';

import { redirect } from 'next/navigation';
import { useEffect } from 'react';

export default function HomePage() {
  useEffect(() => {
    redirect('/login');
  }, []);

  return (
    <div className="loading-screen">
      <div className="loading-spinner" />
    </div>
  );
}
