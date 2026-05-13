// app/owner/reports/page.tsx
import DashboardLayout from "@/components/dashboard-layout";
import ReportsContent from "./ReportsContent";

export default function ReportsPage() {
  return (
    <DashboardLayout>
      <ReportsContent />
    </DashboardLayout>
  );
}