import React from "react";
import Link from "next/link";
import MarketingLayout from "../components/marketing/Layout";

export default function Home() {
    return (
        <MarketingLayout>
            {/* Hero */}
            <section className="py-24 text-center px-4 bg-gradient-to-b from-white to-slate-50">
                <h1 className="text-5xl md:text-6xl font-extrabold mb-6 tracking-tight text-slate-900">
                    The Intelligent Roster Platform <br />
                    <span className="text-blue-600">for Modern Teams</span>
                </h1>
                <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
                    Automate scheduling, ensure compliance, and empower your workforce with Shift Craft.
                    Say goodbye to spreadsheets and hello to efficiency.
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <Link href="/app/onboarding/start" className="bg-blue-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-blue-700 transition shadow-lg shadow-blue-600/20">Get Started for Free</Link>
                    <Link href="/pricing" className="bg-white text-slate-900 border border-slate-200 px-8 py-3 rounded-xl font-semibold hover:bg-slate-50 transition">View Pricing</Link>
                </div>
            </section>

            {/* Features Grid */}
            <section className="py-20 px-4 max-w-6xl mx-auto">
                <h2 className="text-3xl font-bold text-center mb-12">Everything you need to run your team</h2>
                <div className="grid md:grid-cols-3 gap-8">
                    <div className="p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 text-blue-600">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        </div>
                        <h3 className="text-xl font-bold mb-2">Smart Scheduling</h3>
                        <p className="text-slate-600">Drag & drop shifts, use AI auto-fill, and detect conflicts instantly.</p>
                    </div>
                    <div className="p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
                        <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4 text-green-600">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                        </div>
                        <h3 className="text-xl font-bold mb-2">Compliance First</h3>
                        <p className="text-slate-600">Automatically flag WTR breaches, rest period violations, and expired certifications.</p>
                    </div>
                    <div className="p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
                        <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4 text-purple-600">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                        </div>
                        <h3 className="text-xl font-bold mb-2">Staff Portal</h3>
                        <p className="text-slate-600">Let staff check shifts, request leave, and swap shifts via their mobile device.</p>
                    </div>
                </div>
            </section>
        </MarketingLayout>
    );
}
