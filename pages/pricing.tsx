import React from "react";
import Link from "next/link";
import MarketingLayout from "../components/marketing/Layout";
import plansConfig from "../config/plans.json";

export default function Pricing() {
    return (
        <MarketingLayout>
            <div className="py-20 px-4 text-center">
                <h1 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h1>
                <p className="text-xl text-slate-600 mb-12">Choose the plan that fits your team size.</p>

                <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8 text-left">
                    {plansConfig.plans.map((plan) => (
                        <div key={plan.id} className="border rounded-2xl p-8 bg-white shadow-sm flex flex-col">
                            <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                            <div className="text-4xl font-extrabold mb-4">
                                {plan.price === null ? "Custom" : `£${plan.price}`}
                                {plan.price !== null && <span className="text-lg font-normal text-slate-500">/{plan.interval}</span>}
                            </div>
                            <p className="text-slate-600 mb-6">{plan.description}</p>

                            <ul className="mb-8 space-y-3 flex-grow">
                                {plan.features.map((feature, i) => (
                                    <li key={i} className="flex items-center gap-3">
                                        <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            <Link href="/app/onboarding/start" className={`w-full py-3 rounded-xl font-semibold text-center transition ${plan.id === 'pro' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'}`}>
                                {plan.price === null ? "Contact Sales" : "Start Free Trial"}
                            </Link>
                        </div>
                    ))}
                </div>
            </div>
        </MarketingLayout>
    );
}
