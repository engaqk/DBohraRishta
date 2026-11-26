export interface PollOption {
    id: string;
    label: string;
    emoji: string;
}

export interface CompatibilityPoll {
    id: string;
    category: 'Family' | 'Deen & Values' | 'Lifestyle' | 'Future';
    emoji: string;
    question: string;
    options: PollOption[];
}

export const COMPATIBILITY_POLLS: CompatibilityPoll[] = [
    {
        id: 'living_preference',
        category: 'Family',
        emoji: '🏡',
        question: 'Living preference after Shaadi?',
        options: [
            { id: 'joint', label: 'Joint family warmth', emoji: '👨‍👩‍👧‍👦' },
            { id: 'nearby', label: 'Independent, near parents', emoji: '🏘️' },
            { id: 'flexible', label: 'Open to either', emoji: '✨' },
        ],
    },
    {
        id: 'relocation_openness',
        category: 'Future',
        emoji: '✈️',
        question: 'Open to relocating (Hizrat) for career or partner?',
        options: [
            { id: 'global', label: 'Open globally', emoji: '🌍' },
            { id: 'india_metro', label: 'Prefer India metros', emoji: '🇮🇳' },
            { id: 'hometown', label: 'Stay near hometown Jamaat', emoji: '📍' },
        ],
    },
    {
        id: 'deen_dunya',
        category: 'Deen & Values',
        emoji: '🕌',
        question: 'Ideal Deen & Dunya balance at home?',
        options: [
            { id: 'traditional', label: 'Deeply rooted in Jamaat', emoji: '🤲' },
            { id: 'balanced', label: 'Modern career + strong Deen', emoji: '⚖️' },
            { id: 'growing', label: 'Growing together at our pace', emoji: '🌱' },
        ],
    },
    {
        id: 'weekend_vibe',
        category: 'Lifestyle',
        emoji: '☕',
        question: 'Your ideal Sunday evening?',
        options: [
            { id: 'family_majlis', label: 'Family dinner & Majlis', emoji: '🍽️' },
            { id: 'cafe_drive', label: 'Quiet cafe & long drive', emoji: '☕' },
            { id: 'outdoors', label: 'Fitness, nature or exploring', emoji: '🌿' },
        ],
    },
    {
        id: 'wedding_style',
        category: 'Deen & Values',
        emoji: '💍',
        question: 'Preferred Nikah & Walima style?',
        options: [
            { id: 'simple', label: 'Simple & Barakat-filled', emoji: '🕊️' },
            { id: 'classic', label: 'Classic Bohra celebration', emoji: '✨' },
            { id: 'family_choice', label: 'Happy with family wish', emoji: '💛' },
        ],
    },
    {
        id: 'career_balance',
        category: 'Future',
        emoji: '💼',
        question: 'View on partner career & home balance?',
        options: [
            { id: 'ambitious', label: 'Both career-driven', emoji: '🚀' },
            { id: 'work_life', label: 'Work-life balance first', emoji: '🏡' },
            { id: 'flexible_home', label: 'Choice to focus on home/work', emoji: '💛' },
        ],
    },
    {
        id: 'decision_making',
        category: 'Family',
        emoji: '🤝',
        question: 'How should big life decisions be made?',
        options: [
            { id: 'couple_first', label: 'Open couple dialogue first', emoji: '🗣️' },
            { id: 'elders', label: 'Consulting elders together', emoji: '👨‍👩‍👧' },
            { id: 'blend', label: 'Blending both gracefully', emoji: '🤝' },
        ],
    },
    {
        id: 'social_battery',
        category: 'Lifestyle',
        emoji: '🌙',
        question: 'Social energy at family & Jamaat gatherings?',
        options: [
            { id: 'extrovert', label: 'Love hosting & mingling', emoji: '🎉' },
            { id: 'ambivert', label: 'Warm with close circle', emoji: '😊' },
            { id: 'homebody', label: 'Peaceful homebody', emoji: '🌙' },
        ],
    },
    {
        id: 'travel_style',
        category: 'Lifestyle',
        emoji: '🧳',
        question: 'First memorable trip together?',
        options: [
            { id: 'ziyarat', label: 'Karbala / Najaf / Umrah', emoji: '🕌' },
            { id: 'nature', label: 'Mountains & beaches', emoji: '🏔️' },
            { id: 'cities', label: 'Global cities & food', emoji: '🌆' },
        ],
    },
    {
        id: 'financial_mindset',
        category: 'Future',
        emoji: '🏦',
        question: 'Approach to saving & lifestyle spending?',
        options: [
            { id: 'saver', label: 'Future-focused investor', emoji: '📈' },
            { id: 'balanced', label: 'Save smart & enjoy life', emoji: '⚖️' },
            { id: 'experiences', label: 'Prioritize experiences', emoji: '✨' },
        ],
    },
];

export interface SharedPollMatch {
    pollId: string;
    question: string;
    label: string;
    emoji: string;
}

export function computeSharedPolls(
    myPolls?: Record<string, string> | null,
    theirPolls?: Record<string, string> | null
): SharedPollMatch[] {
    if (!myPolls || !theirPolls) return [];
    const matches: SharedPollMatch[] = [];

    for (const poll of COMPATIBILITY_POLLS) {
        const myAns = myPolls[poll.id];
        const theirAns = theirPolls[poll.id];
        if (myAns && theirAns && myAns === theirAns) {
            const opt = poll.options.find(o => o.id === myAns);
            if (opt) {
                matches.push({
                    pollId: poll.id,
                    question: poll.question,
                    label: opt.label,
                    emoji: opt.emoji,
                });
            }
        }
    }
    return matches;
}

export function getDailyPoll(myPolls?: Record<string, string> | null): CompatibilityPoll | null {
    const answered = myPolls || {};
    const unanswered = COMPATIBILITY_POLLS.filter(p => !answered[p.id]);
    if (unanswered.length === 0) return null;

    // Pick deterministically by day-of-year so it feels fresh each day
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
    return unanswered[dayOfYear % unanswered.length];
}
