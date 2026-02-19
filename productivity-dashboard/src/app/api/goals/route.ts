import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { findRows, appendRow, updateRow, deleteRow, COLUMNS } from '@/lib/googleSheets';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const rows = await findRows('Goals', COLUMNS.Goals.userId, userId);

    const goals = rows.map((r) => ({
        id: r.data[COLUMNS.Goals.id],
        userId: r.data[COLUMNS.Goals.userId],
        title: r.data[COLUMNS.Goals.title],
        description: r.data[COLUMNS.Goals.description] || '',
        category: r.data[COLUMNS.Goals.category] || 'short-term',
        status: r.data[COLUMNS.Goals.status] || 'active',
        targetDate: r.data[COLUMNS.Goals.targetDate] || '',
        createdAt: r.data[COLUMNS.Goals.createdAt],
    }));

    return NextResponse.json(goals);
}

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    if (!userId) {
        return NextResponse.json({ error: 'User session is invalid. Please sign in again.' }, { status: 401 });
    }

    try {
        const body = await request.json();
        if (!body.title || !String(body.title).trim()) {
            return NextResponse.json({ error: 'Title is required' }, { status: 400 });
        }
        const id = uuidv4();
        const now = new Date().toISOString();

        await appendRow('Goals', [
            id,
            String(userId),
            String(body.title).trim(),
            String(body.description || ''),
            String(body.category || 'short-term'),
            String(body.status || 'active'),
            String(body.targetDate || ''),
            now,
        ]);

        return NextResponse.json({
            id,
            userId,
            title: String(body.title).trim(),
            description: body.description || '',
            category: body.category || 'short-term',
            status: body.status || 'active',
            targetDate: body.targetDate || '',
            createdAt: now,
        });
    } catch (error) {
        console.error('POST /api/goals failed:', error);
        return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const row = await findRows('Goals', COLUMNS.Goals.id, body.id);

    if (row.length === 0) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const updatedData = [...row[0].data];
    if (body.title !== undefined) updatedData[COLUMNS.Goals.title] = body.title;
    if (body.description !== undefined) updatedData[COLUMNS.Goals.description] = body.description;
    if (body.category !== undefined) updatedData[COLUMNS.Goals.category] = body.category;
    if (body.status !== undefined) updatedData[COLUMNS.Goals.status] = body.status;
    if (body.targetDate !== undefined) updatedData[COLUMNS.Goals.targetDate] = body.targetDate;

    await updateRow('Goals', row[0].rowIndex, updatedData);
    return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const row = await findRows('Goals', COLUMNS.Goals.id, id);
    if (row.length > 0) {
        await deleteRow('Goals', row[0].rowIndex);
    }

    return NextResponse.json({ success: true });
}
