import verticalsData from '../content/verticals.json';

export interface Vertical {
    title: string;
    description: string;
    features: string[];
}

export function getVerticals(): Record<string, Vertical> {
    return verticalsData;
}

export function getVertical(slug: string): Vertical | null {
    return (verticalsData as Record<string, Vertical>)[slug] || null;
}
