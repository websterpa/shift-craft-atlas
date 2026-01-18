import React from "react";
import { useRouter } from "next/router";
import MarketingLayout from "../../components/marketing/Layout";
import verticals from "../../content/verticals.json";
import Link from "next/link";

export default function IndustryPage() {
    const router = useRouter();
    const { slug } = router.query;
    // In a real app, use getStaticProps. accessing json directly here for stub.
    const data = verticals[slug as keyof typeof verticals];

    if (!data) return <MarketingLayout><div>Loading...</div></MarketingLayout>;

    return (
        <MarketingLayout>
            <div className="py-24 px-4 text-center max-w-4xl mx-auto">
                <div className="inline-block px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-semibold mb-6 uppercase tracking-wider">
                    Industry Solution
                </div>
                <h1 className="text-4xl md:text-5xl font-bold mb-6">{data.title}</h1>
                <p className="text-xl text-slate-600 mb-12 leading-relaxed">{data.description}</p>

                <div className="grid md:grid-cols-3 gap-6 mb-16 text-left">
                    {data.features.map((feature, i) => (
                        <div key={i} className="p-6 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="font-bold mb-2 text-slate-900">Feature {i + 1}</div>
                            <div className="text-slate-600">{feature}</div>
                        </div>
                    ))}
                </div>

                <Link href="/app/onboarding/start" className="bg-slate-900 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-slate-800 transition shadow-xl">
                    See {slug} Demo
                </Link>
            </div>
        </MarketingLayout>
    );
}
