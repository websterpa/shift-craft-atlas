import React from "react";
import Link from "next/link";
import MarketingLayout from "../../components/marketing/Layout";
import verticals from "../../content/verticals.json";

export default function IndustriesIndex() {
    return (
        <MarketingLayout>
            <div className="py-20 px-4 max-w-6xl mx-auto">
                <h1 className="text-4xl font-bold mb-12 text-center">Industries We Serve</h1>
                <div className="grid md:grid-cols-2 gap-8">
                    {Object.entries(verticals).map(([slug, data]) => (
                        <Link key={slug} href={`/industries/${slug}`} className="group block p-8 border rounded-2xl hover:border-blue-500 hover:shadow-md transition bg-white">
                            <h3 className="text-2xl font-bold mb-3 group-hover:text-blue-600 transition">{data.title}</h3>
                            <p className="text-slate-600 mb-4">{data.description}</p>
                            <div className="text-blue-600 font-semibold flex items-center gap-2">
                                Learn more
                                <svg className="w-4 h-4 group-hover:translate-x-1 transition" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14m-7-7 7 7-7 7" /></svg>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </MarketingLayout>
    );
}
