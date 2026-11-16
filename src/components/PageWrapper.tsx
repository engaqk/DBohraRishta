"use client";
import { usePathname } from 'next/navigation';

export default function PageWrapper({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const noNavPages = ['/login', '/onboarding'];
    const needsPadding = !noNavPages.includes(pathname);
    return <div className={needsPadding ? 'pt-16' : ''}>{children}</div>;
}
