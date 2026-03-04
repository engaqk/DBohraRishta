import RishtaDashboard from '@/components/RishtaDashboard';
import { Suspense } from 'react';

export default function Home() {
  return (
    <main>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
        <RishtaDashboard />
      </Suspense>
    </main>
  );
}
