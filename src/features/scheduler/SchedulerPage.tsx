import { CalendarClock } from 'lucide-react'
import EmptyState from '../../components/ui/EmptyState'

export default function SchedulerPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', height: '100%' }}>
      <div>
        <h1 className="page-title">Scheduler</h1>
        <p className="page-subtitle">
          Schedule bulk import jobs to run automatically at a set time or interval.
        </p>
      </div>
      <EmptyState
        icon={<CalendarClock size={22} />}
        title="Coming in a future phase"
        description="Scheduled jobs will run your saved bulk files at a set time — even in the background via system tray."
      />
    </div>
  )
}
