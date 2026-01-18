export const trackEvent = (name: string, props: Record<string, any> = {}) => {
    console.log(`[Analytics] ${name}`, props);
    // Integrate with Segment/Mixpanel here
};

export const identifyUser = (id: string, traits: Record<string, any> = {}) => {
    console.log(`[Analytics] Identify ${id}`, traits);
};
