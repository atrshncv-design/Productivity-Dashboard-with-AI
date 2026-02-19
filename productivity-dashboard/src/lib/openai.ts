import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export interface AIRecommendation {
    title: string;
    description: string;
    type: 'tip' | 'motivation' | 'plan';
}

export async function getProductivityRecommendations(
    habitsData: { name: string; completionRate: number; streak: number }[],
    tasksData: { title: string; priority: string; completed: boolean; deadline: string }[],
    userName: string
): Promise<AIRecommendation[]> {
    const habitsInfo = habitsData.map(h =>
        `- ${h.name}: выполнение ${Math.round(h.completionRate * 100)}%, серия ${h.streak} дней`
    ).join('\n');

    const tasksInfo = tasksData.map(t =>
        `- ${t.title} (приоритет: ${t.priority}, ${t.completed ? 'выполнено' : 'не выполнено'}, дедлайн: ${t.deadline || 'нет'})`
    ).join('\n');

    const prompt = `Ты — AI-помощник по продуктивности. Проанализируй данные пользователя ${userName} и дай 3-4 персональные рекомендации на русском языке.

Привычки:
${habitsInfo || 'Нет данных'}

Задачи:
${tasksInfo || 'Нет данных'}

Дай рекомендации в формате JSON массива:
[
  {"title": "Короткий заголовок", "description": "Подробный совет на 1-2 предложения", "type": "tip|motivation|plan"}
]

Типы:
- tip: совет по улучшению продуктивности
- motivation: мотивация на основе текущих достижений
- plan: рекомендация по планированию дня

Ответь ТОЛЬКО JSON массивом, без дополнительного текста.`;

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 1000,
        });

        const content = response.choices[0]?.message?.content || '[]';
        const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(cleanContent);
    } catch (error) {
        console.error('OpenAI error:', error);
        return [
            {
                title: 'Начните с малого',
                description: 'Сфокусируйтесь на одной привычке сегодня и выполните её. Маленькие победы ведут к большим результатам.',
                type: 'motivation',
            },
        ];
    }
}

const QUOTES_RU = [
    'Дисциплина — это мост между целями и достижениями.',
    'Каждый день — это новая возможность стать лучше.',
    'Привычки — это архитектура повседневной жизни.',
    'Продуктивность — это не о том, чтобы делать больше, а о том, чтобы делать важное.',
    'Великие дела складываются из маленьких ежедневных действий.',
    'Не бойтесь идти медленно, бойтесь стоять на месте.',
    'Сложное станет простым, если делать это каждый день.',
    'Ваше будущее создаётся тем, что вы делаете сегодня.',
    'Успех — это сумма маленьких усилий, повторяемых изо дня в день.',
    'Лучшее время начать — прямо сейчас.',
    'Путь в тысячу миль начинается с первого шага.',
    'Постоянство побеждает интенсивность.',
    'Фокус на прогрессе, а не на совершенстве.',
    'Сегодняшние усилия — завтрашний результат.',
    'Каждая маленькая привычка — кирпич в фундаменте успеха.',
];

export function getRandomQuote(): string {
    return QUOTES_RU[Math.floor(Math.random() * QUOTES_RU.length)];
}
