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
    const rows = await findRows('Habits', COLUMNS.Habits.userId, userId);

    const habits = rows.map((r) => ({
        id: r.data[COLUMNS.Habits.id],
        userId: r.data[COLUMNS.Habits.userId],
        name: r.data[COLUMNS.Habits.name],
        icon: r.data[COLUMNS.Habits.icon],
        frequency: r.data[COLUMNS.Habits.frequency],
        isPreset: r.data[COLUMNS.Habits.isPreset] === 'true',
        isActive: r.data[COLUMNS.Habits.isActive] === 'true',
        createdAt: r.data[COLUMNS.Habits.createdAt],
    }));

    return NextResponse.json(habits);
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
        if (!body.name || !String(body.name).trim()) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }
        const id = uuidv4();
        const now = new Date().toISOString();

        await appendRow('Habits', [
            id,
            String(userId),
            String(body.name).trim(),
            String(body.icon || '⭐'),
            String(body.frequency || 'daily'),
            'false',
            'true',
            now,
        ]);

        return NextResponse.json({ id, name: String(body.name).trim(), icon: body.icon || '⭐', frequency: body.frequency || 'daily', isPreset: false, isActive: true, createdAt: now });
    } catch (error) {
        console.error('POST /api/habits failed:', error);
        return NextResponse.json({ error: 'Failed to create habit' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const row = await findRows('Habits', COLUMNS.Habits.id, body.id);

    if (row.length === 0) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const updatedData = [...row[0].data];
    if (body.name !== undefined) updatedData[COLUMNS.Habits.name] = body.name;
    if (body.icon !== undefined) updatedData[COLUMNS.Habits.icon] = body.icon;
    if (body.isActive !== undefined) updatedData[COLUMNS.Habits.isActive] = String(body.isActive);

    await updateRow('Habits', row[0].rowIndex, updatedData);
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

    const row = await findRows('Habits', COLUMNS.Habits.id, id);
    if (row.length > 0) {
        await deleteRow('Habits', row[0].rowIndex);
    }

    return NextResponse.json({ success: true });
}
