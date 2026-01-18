import React from "react";
import Link from "next/link";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen flex flex-col font-sans text-slate-900">
            <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-50">
                <nav className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
                    <Link href="/" className="font-bold text-xl tracking-tight text-slate-900 no-underline">Shift Craft</Link>
                    <div className="flex items-center gap-6 text-sm font-medium">
                        <Link href="/features" className="hover:text-blue-600 transition no-underline text-slate-600">Features</Link>
                        <Link href="/industries" className="hover:text-blue-600 transition no-underline text-slate-600">Industries</Link>
                        <Link href="/pricing" className="hover:text-blue-600 transition no-underline text-slate-600">Pricing</Link>
                        <Link href="/app/onboarding/start" className="bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition no-underline">Get Started</Link>
                    </div>
                </nav>
            </header>
            <main className="flex-grow">
                {children}
            </main>
            <footer className="border-t py-12 bg-slate-50 mt-auto">
                <div className="mx-auto max-w-6xl px-4 flex justify-between items-center text-slate-500 text-sm">
                    <div>&copy; {new Date().getFullYear()} Shift Craft.</div>
                    <div className="flex gap-4">
                        <Link href="/privacy" className="hover:text-slate-900">Privacy</Link>
                        <Link href="/cookies" className="hover:text-slate-900">Cookies</Link>
                        <Link href="/docs" className="hover:text-slate-900">Docs</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
