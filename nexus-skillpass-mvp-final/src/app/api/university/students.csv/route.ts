import { NextResponse } from 'next/server';
import type { UniversityData } from '@/components/dashboards/university-dashboard';
import { read } from '@/lib/server/backend';
import { toCsv } from '@/lib/safety';
import { AppError } from '@/lib/server/errors';

/** CSV export of the university's aggregated student results (same data as the dashboard, same authorization). */
export async function GET() {
  try {
    const data = await read<UniversityData>('sp_university_dashboard');
    if (!data.organization || data.pending || !data.students) return new NextResponse('Forbidden', { status: 403 });
    const header = ['student', 'program', 'semester', 'challenges', 'verified_vath', 'verified_competencies', 'credentials', 'active', 'demo_data'];
    const rows = data.students.map((s) => [s.full_name, s.career, s.semester ?? '', s.challenges, s.verified_vath, s.competencies, s.credentials, s.active, s.is_demo]);
    const csv = toCsv([header, ...rows]);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="skillpass-students-${new Date().toISOString().slice(0, 10)}.csv"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;
    return new NextResponse(status === 401 ? 'Unauthorized' : 'Error', { status });
  }
}
