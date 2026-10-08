import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AdminDashboard, type AdminOverview } from '@/components/dashboards/admin-dashboard';
import { CompanyDashboard } from '@/components/dashboards/company-dashboard';
import { StudentDashboard } from '@/components/dashboards/student-dashboard';
import { UniversityDashboard, type UniversityData } from '@/components/dashboards/university-dashboard';
import { getMessages } from '@/lib/i18n/server';
import { getMe, read } from '@/lib/server/backend';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return { title: t.nav.dashboard };
}

export default async function DashboardPage() {
  const me = await getMe();
  if (!me) redirect('/login');
  const { t, locale } = await getMessages();
  switch (me.profile.role) {
    case 'student':
      return <StudentDashboard me={me} t={t} locale={locale} data={await read('sp_student_dashboard')} />;
    case 'company':
    case 'supervisor':
      return <CompanyDashboard me={me} t={t} locale={locale} data={await read('sp_company_dashboard')} />;
    case 'university':
      return <UniversityDashboard t={t} locale={locale} data={await read<UniversityData>('sp_university_dashboard')} />;
    case 'admin':
      return <AdminDashboard t={t} locale={locale} data={await read<AdminOverview>('sp_admin_overview')} />;
  }
}
