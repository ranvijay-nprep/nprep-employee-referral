import AnalyticsDashboard from '@/components/AnalyticsDashboard'

// Numbers are fetched client-side rather than rendered here on purpose: the
// aggregation reads NPrep's MySQL, and a slow/unreachable production DB must
// show an error inside the page instead of hanging the whole route.
export default function AnalyticsPage() {
  return <AnalyticsDashboard />
}
