import { LoadingStatus, Skeleton } from "@/components/skeleton";
import type { StaffView } from "./view-config";

function MetricSkeleton({ compact = false }: { compact?: boolean }) {
  return <section className={`metric-card skeleton-card${compact ? " compact" : ""}`}>
    <Skeleton className="skeleton-icon" />
    <div><Skeleton width="42%" height={9}/><Skeleton width="66%" height={24}/><Skeleton width="54%" height={8}/></div>
  </section>;
}

function PanelHeadingSkeleton() {
  return <div className="panel-head skeleton-panel-head"><div><Skeleton width={154} height={15}/><Skeleton width={205} height={9}/></div></div>;
}

function RowSkeleton({ columns = 3 }: { columns?: number }) {
  return <div className="skeleton-row" style={{ gridTemplateColumns: `repeat(${columns}, minmax(70px, 1fr))` }}>{Array.from({ length: columns }, (_, index) => <Skeleton key={index} width={index === 0 ? "72%" : `${52 + index * 5}%`} height={index === 0 ? 12 : 9}/>)}</div>;
}

function TableSkeleton({ rows = 6, columns = 4 }: { rows?: number; columns?: number }) {
  return <section className="panel table-panel skeleton-table">
    <div className="skeleton-table-head" style={{ gridTemplateColumns: `repeat(${columns}, minmax(74px, 1fr))` }}>{Array.from({ length: columns }, (_, index) => <Skeleton key={index} width="58%" height={8}/>)}</div>
    {Array.from({ length: rows }, (_, index) => <RowSkeleton key={index} columns={columns}/>) }
  </section>;
}

export function CalendarGridSkeleton({ publicCalendar = false, day = false }: { publicCalendar?: boolean; day?: boolean }) {
  const columns = day ? 1 : 7;
  return <div className={`calendar-grid-skeleton${publicCalendar ? " public" : ""}${day ? " day" : ""}`} aria-hidden="true">
    <div className="calendar-skeleton-head">
      <Skeleton className="calendar-skeleton-corner" />
      {Array.from({ length: columns }, (_, index) => <div className="calendar-skeleton-date" key={index}><Skeleton width="42%" height={7}/><Skeleton width="24%" height={18}/><Skeleton width="34%" height={7}/></div>)}
    </div>
    <div className="calendar-skeleton-body">
      <div className="calendar-skeleton-times">{Array.from({ length: 9 }, (_, index) => <Skeleton key={index} width={25} height={7}/>)}</div>
      {Array.from({ length: columns }, (_, column) => <div className="calendar-skeleton-column" key={column}/>) }
    </div>
  </div>;
}

export function DayListSkeleton() {
  return <div className="day-calendar day-list-skeleton" aria-hidden="true">
    <aside className="day-date-block skeleton-day-date">
      <Skeleton width={34} height={8}/><Skeleton width={38} height={34}/><Skeleton width={42} height={9}/>
    </aside>
    <div className="day-calendar-content">
      <header className="day-list-heading skeleton-day-heading"><div><Skeleton width={190} height={16}/><Skeleton width={138} height={8}/></div><Skeleton width={92} height={25} radius={99}/></header>
      <div className="day-appointment-list">
        {Array.from({ length: 4 }, (_, index) => <div className="day-appointment-row skeleton-day-row" key={index}>
          <span className="day-appointment-time skeleton-day-copy"><Skeleton width={50} height={10}/><Skeleton width={38} height={8}/></span>
          <Skeleton className="client-avatar" width={34} height={34} radius="50%"/>
          <span className="day-appointment-client skeleton-day-copy"><Skeleton width={index % 2 ? "64%" : "78%"} height={10}/><Skeleton width="88%" height={8}/></span>
          <span className="day-appointment-piercer skeleton-day-copy"><Skeleton width="66%" height={9}/><Skeleton width="54%" height={8}/></span>
          <Skeleton className="status-pill" width={72} height={22} radius={99}/>
          <Skeleton className="day-row-chevron" width={12} height={15}/>
        </div>)}
      </div>
    </div>
  </div>;
}

function OverviewSkeleton() {
  return <><div className="metric-grid">{Array.from({ length: 4 }, (_, index) => <MetricSkeleton key={index}/>)}</div><div className="two-panel">
    <section className="panel skeleton-panel"><PanelHeadingSkeleton/>{Array.from({ length: 5 }, (_, index) => <RowSkeleton key={index} columns={4}/>)}</section>
    <section className="panel skeleton-panel"><PanelHeadingSkeleton/>{Array.from({ length: 4 }, (_, index) => <RowSkeleton key={index} columns={2}/>)}</section>
  </div></>;
}

function SalesSkeleton() {
  return <><div className="metric-grid compact">{Array.from({ length: 3 }, (_, index) => <MetricSkeleton compact key={index}/>)}</div><Skeleton className="skeleton-page-action" width={132} height={38}/><TableSkeleton columns={8}/></>;
}

function ReportsSkeleton() {
  return <><div className="skeleton-report-controls"><Skeleton width="48%" height={38}/><Skeleton width="36%" height={38}/><Skeleton width={132} height={38}/></div><div className="metric-grid compact">{Array.from({ length: 3 }, (_, index) => <MetricSkeleton compact key={index}/>)}</div><div className="two-panel">{Array.from({ length: 2 }, (_, panel) => <section className="panel skeleton-panel" key={panel}><PanelHeadingSkeleton/>{Array.from({ length: 5 }, (_, index) => <RowSkeleton key={index} columns={2}/>)}</section>)}</div></>;
}

function SettingsSkeleton() {
  return <div className="settings-stack">
    <section className="panel setting-section skeleton-settings-form"><PanelHeadingSkeleton/><div className="skeleton-form-grid">{Array.from({ length: 8 }, (_, index) => <div key={index}><Skeleton width="36%" height={9}/><Skeleton width="100%" height={42}/></div>)}</div></section>
    <section className="panel setting-section skeleton-schedule"><PanelHeadingSkeleton/><CalendarGridSkeleton/></section>
    {Array.from({ length: 2 }, (_, panel) => <section className="panel setting-section skeleton-panel" key={panel}><PanelHeadingSkeleton/>{Array.from({ length: 4 }, (_, index) => <RowSkeleton key={index} columns={3}/>)}</section>)}
    <section className="two-panel">{Array.from({ length: 2 }, (_, panel) => <div className="panel setting-section skeleton-panel" key={panel}><PanelHeadingSkeleton/>{Array.from({ length: 3 }, (_, index) => <RowSkeleton key={index} columns={2}/>)}</div>)}</section>
  </div>;
}

export function StaffViewSkeleton({ view = "overview", label = "Loading workspace" }: { view?: StaffView; label?: string }) {
  return <div className={`feature-view staff-view-skeleton skeleton-${view}`} aria-busy="true">
    <LoadingStatus label={label}/>
    {view === "overview" && <OverviewSkeleton/>}
    {view === "calendar" && <><div className="skeleton-calendar-toolbar">{Array.from({ length: 7 }, (_, index) => <Skeleton key={index} width={index > 2 ? 110 : 39} height={38}/>)}</div><section className="panel operation-calendar"><div className="calendar-scroll"><CalendarGridSkeleton/></div></section></>}
    {view === "clients" && <TableSkeleton/>}
    {view === "sales" && <SalesSkeleton/>}
    {view === "reports" && <ReportsSkeleton/>}
    {view === "settings" && <SettingsSkeleton/>}
  </div>;
}
