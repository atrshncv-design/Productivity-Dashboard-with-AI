import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { findRows, appendRow, COLUMNS } from '@/lib/googleSheets';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const rows = await findRows('Categories', COLUMNS.Categories.userId, userId);

    const categories = rows.map((r) => ({
        id: r.data[COLUMNS.Categories.id],
        userId: r.data[COLUMNS.Categories.userId],
        name: r.data[COLUMNS.Categories.name],
        color: r.data[COLUMNS.Categories.color],
    }));

    return NextResponse.json(categories);
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const body = await request.json();
    const id = uuidv4();

    await appendRow('Categories', [id, userId, body.name, body.color || '#5b8def']);

    return NextResponse.json({ id, userId, name: body.name, color: body.color || '#5b8def' });
}
