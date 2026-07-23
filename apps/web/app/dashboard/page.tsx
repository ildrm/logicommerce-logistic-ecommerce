import type { Metadata } from 'next';
import { DashboardClient } from './dashboard-client';

export const metadata: Metadata = {
  title: 'Operations overview',
  description: 'Tenant-scoped operational analytics and exception monitoring.',
};

export default function DashboardPage() {
  return <DashboardClient />;
}
