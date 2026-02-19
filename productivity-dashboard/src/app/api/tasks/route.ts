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
    const rows = await findRows('Tasks', COLUMNS.Tasks.userId, userId);

    const tasks = rows.map((r) => ({
        id: r.data[COLUMNS.Tasks.id],
        userId: r.data[COLUMNS.Tasks.userId],
        title: r.data[COLUMNS.Tasks.title],
        description: r.data[COLUMNS.Tasks.description] || '',
        priority: r.data[COLUMNS.Tasks.priority] || 'medium',
        category: r.data[COLUMNS.Tasks.category] || '',
        deadline: r.data[COLUMNS.Tasks.deadline] || '',
        completed: r.data[COLUMNS.Tasks.completed] === 'true',
        parentTaskId: r.data[COLUMNS.Tasks.parentTaskId] || null,
        scheduledTime: r.data[COLUMNS.Tasks.scheduledTime] || '',
        createdAt: r.data[COLUMNS.Tasks.createdAt],
    }));

    return NextResponse.json(tasks);
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

        await appendRow('Tasks', [
            id,
            String(userId),
            String(body.title).trim(),
            String(body.description || ''),
            String(body.priority || 'medium'),
            String(body.category || ''),
            String(body.deadline || ''),
            'false',
            String(body.parentTaskId || ''),
            String(body.scheduledTime || ''),
            now,
        ]);

        return NextResponse.json({
            id,
            userId,
            title: String(body.title).trim(),
            description: body.description || '',
            priority: body.priority || 'medium',
            category: body.category || '',
            deadline: body.deadline || '',
            completed: false,
            parentTaskId: body.parentTaskId || null,
            scheduledTime: body.scheduledTime || '',
            createdAt: now,
        });
    } catch (error) {
        console.error('POST /api/tasks failed:', error);
        return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const row = await findRows('Tasks', COLUMNS.Tasks.id, body.id);

    if (row.length === 0) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const updatedData = [...row[0].data];
    if (body.title !== undefined) updatedData[COLUMNS.Tasks.title] = body.title;
    if (body.description !== undefined) updatedData[COLUMNS.Tasks.description] = body.description;
    if (body.priority !== undefined) updatedData[COLUMNS.Tasks.priority] = body.priority;
    if (body.category !== undefined) updatedData[COLUMNS.Tasks.category] = body.category;
    if (body.deadline !== undefined) updatedData[COLUMNS.Tasks.deadline] = body.deadline;
    if (body.scheduledTime !== undefined) updatedData[COLUMNS.Tasks.scheduledTime] = body.scheduledTime;
    if (body.completed !== undefined) updatedData[COLUMNS.Tasks.completed] = String(body.completed);

    await updateRow('Tasks', row[0].rowIndex, updatedData);
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

    const row = await findRows('Tasks', COLUMNS.Tasks.id, id);
    if (row.length > 0) {
        await deleteRow('Tasks', row[0].rowIndex);
    }

    return NextResponse.json({ success: true });
}
