import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { findRows, appendRow, updateRow, COLUMNS, getSheetData } from '@/lib/googleSheets';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date'); // YYYY-MM-DD
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const rows = await findRows('HabitLogs', COLUMNS.HabitLogs.userId, userId);

    let logs = rows.map((r) => ({
        id: r.data[COLUMNS.HabitLogs.id],
        habitId: r.data[COLUMNS.HabitLogs.habitId],
        userId: r.data[COLUMNS.HabitLogs.userId],
        date: r.data[COLUMNS.HabitLogs.date],
        completed: r.data[COLUMNS.HabitLogs.completed] === 'true',
    }));

    if (date) {
        logs = logs.filter((l) => l.date === date);
    } else if (startDate && endDate) {
        logs = logs.filter((l) => l.date >= startDate && l.date <= endDate);
    }

    return NextResponse.json(logs);
}

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const body = await request.json();

    // Check if log already exists for this habit and date
    const allData = await getSheetData('HabitLogs');
    let existingRowIndex = -1;

    for (let i = 1; i < allData.length; i++) {
        if (
            allData[i][COLUMNS.HabitLogs.userId] === userId &&
            allData[i][COLUMNS.HabitLogs.habitId] === body.habitId &&
            allData[i][COLUMNS.HabitLogs.date] === body.date
        ) {
            existingRowIndex = i + 1;
            break;
        }
    }

    if (existingRowIndex > 0) {
        // Update existing log
        const existingRow = allData[existingRowIndex - 1];
        existingRow[COLUMNS.HabitLogs.completed] = String(body.completed);
        await updateRow('HabitLogs', existingRowIndex, existingRow);
        return NextResponse.json({ success: true, updated: true });
    }

    // Create new log
    const id = uuidv4();
    await appendRow('HabitLogs', [
        id,
        body.habitId,
        userId,
        body.date,
        String(body.completed),
    ]);

    return NextResponse.json({ id, success: true });
}
