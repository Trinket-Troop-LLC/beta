// app/admin/page.tsx
import { Suspense } from 'react'
import AdminDashboardContent from './admin-dashboard-content'

export default function AdminPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AdminDashboardContent />
    </Suspense>
  )
}