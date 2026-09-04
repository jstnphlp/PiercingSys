import { LoadingStatus, Skeleton } from "@/components/skeleton";
import { cn } from "@/lib/utils";
import { calendarBodyHeight, calendarHourLabels, calendarTotalHeight } from "./calendar-geometry";
import { featureView, metricCard, metricGrid, metricGridThree, panel, panelHead, settingSection, settingsStack, tablePanel, twoPanel } from "./dashboard-styles";
import type { StaffView } from "./view-config";

function MetricSkeleton({ compact = false }: { compact?: boolean }) {
  return <section className={cn(metricCard, compact && "min-h-[105px]")}>
    <Skeleton className="size-[43px] bg-[#dfcda9] max-[760px]:size-9" />
    <div><Skeleton width="42%" height={9}/><Skeleton width="66%" height={24}/><Skeleton width="54%" height={8}/></div>
  </section>;
}

function PanelHeadingSkeleton() {
  return <div className={`${panelHead} [&>div]:flex [&>div]:flex-col [&>div]:gap-1.5`}><div><Skeleton className="bg-[#dfcda9]" width={154} height={15}/><Skeleton className="bg-[#dfcda9]" width={205} height={9}/></div></div>;
}

function RowSkeleton({ columns = 3 }: { columns?: number }) {
  return <div className="grid min-h-[58px] items-center gap-4 border-b border-dashed border-[#d5a684] px-4 max-[760px]:gap-2.5 max-[760px]:px-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(70px, 1fr))` }}>{Array.from({ length: columns }, (_, index) => <Skeleton className="bg-[#dfcda9]" key={index} width={index === 0 ? "72%" : `${52 + index * 5}%`} height={index === 0 ? 12 : 9}/>)}</div>;
}

function TableSkeleton({ rows = 6, columns = 4 }: { rows?: number; columns?: number }) {
  return <section className={tablePanel}>
    <div className="grid min-h-[42px] items-center gap-4 bg-[#f5ddba] px-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(74px, 1fr))` }}>{Array.from({ length: columns }, (_, index) => <Skeleton className="bg-[#dfcda9]" key={index} width="58%" height={8}/>)}</div>
    {Array.from({ length: rows }, (_, index) => <RowSkeleton key={index} columns={columns}/>) }
  </section>;
}

export function CalendarGridSkeleton({ publicCalendar = false, day = false }: { publicCalendar?: boolean; day?: boolean }) {
  const columns = day ? 1 : 7;
  const columnTemplate = publicCalendar ? "64px repeat(7, minmax(118px, 1fr))" : `72px repeat(${columns}, minmax(138px, 1fr))`;
  const shellHeight = publicCalendar ? undefined : calendarTotalHeight;
  const bodyHeight = publicCalendar ? undefined : calendarBodyHeight;
  return <div className={cn("min-w-[1080px] overflow-hidden bg-[#fff8e7]", publicCalendar ? "h-[783px] min-w-[890px]" : "", day && "min-w-[540px]")} style={shellHeight ? { height: shellHeight } : undefined} aria-hidden="true">
    <div className={cn("grid h-16 border-b-[1.5px] border-hippy-ink bg-[#f0d09d]", publicCalendar && "h-[55px]")} style={{ gridTemplateColumns: columnTemplate }}>
      <Skeleton className={cn("m-auto h-[15px] w-[30px] bg-[#dfcda9]", publicCalendar && "bg-[#dfc49e]")} />
      {Array.from({ length: columns }, (_, index) => <div className="flex flex-col items-center justify-center gap-[5px] border-l border-[#c99572]" key={index}><Skeleton className={publicCalendar ? "bg-[#dfc49e]" : "bg-[#dfcda9]"} width="42%" height={7}/><Skeleton className={publicCalendar ? "bg-[#dfc49e]" : "bg-[#dfcda9]"} width="24%" height={18}/><Skeleton className={publicCalendar ? "bg-[#dfc49e]" : "bg-[#dfcda9]"} width="34%" height={7}/></div>)}
    </div>
    <div className={cn("grid", publicCalendar && "h-[728px]")} style={{ gridTemplateColumns: columnTemplate, height: bodyHeight }}>
      <div className="flex flex-col items-end justify-around border-r-[1.5px] border-hippy-ink bg-[#f7e4bd] px-[9px]">{Array.from({ length: publicCalendar ? 9 : calendarHourLabels().length }, (_, index) => <Skeleton className={publicCalendar ? "bg-[#dfc49e]" : "bg-[#dfcda9]"} key={index} width={25} height={7}/>)}</div>
      {Array.from({ length: columns }, (_, column) => <div className="relative border-l border-[#d2a281] bg-[#fff9eb] bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_63px,#d6ab8b_64px)]" key={column}/>) }
    </div>
  </div>;
}

export function DayListSkeleton() {
  return <div className="grid min-h-[330px] grid-cols-[112px_minmax(0,1fr)] bg-[#fff9eb] max-[760px]:grid-cols-[70px_minmax(0,1fr)]" aria-hidden="true">
    <aside className="flex min-h-[330px] flex-col items-center justify-center gap-2 border-r border-dashed border-[#a96749] bg-[#f0c875]">
      <Skeleton width={34} height={8}/><Skeleton width={38} height={34}/><Skeleton width={42} height={9}/>
    </aside>
    <div className="min-w-0 bg-[#fff9eb]">
      <header className="flex min-h-[74px] items-center justify-between border-b border-dashed border-[#c88f6e] bg-[#f8e3bc] px-[18px] py-[13px]"><div className="flex flex-col gap-2"><Skeleton width={190} height={16}/><Skeleton width={138} height={8}/></div><Skeleton width={92} height={25} radius={99}/></header>
      <div className="flex flex-col">
        {Array.from({ length: 4 }, (_, index) => <div className="grid min-h-[78px] grid-cols-[80px_38px_minmax(150px,1fr)_minmax(135px,.65fr)_92px_18px] items-center gap-[11px] border-b border-dashed border-[#d7a47f] px-[17px] py-2.5 max-[760px]:grid-cols-[63px_34px_minmax(0,1fr)_18px]" key={index}>
          <span className="flex flex-col gap-2"><Skeleton width={50} height={10}/><Skeleton width={38} height={8}/></span>
          <Skeleton width={34} height={34} radius="50%"/>
          <span className="flex flex-col gap-2"><Skeleton width={index % 2 ? "64%" : "78%"} height={10}/><Skeleton width="88%" height={8}/></span>
          <span className="flex flex-col gap-2 max-[760px]:hidden"><Skeleton width="66%" height={9}/><Skeleton width="54%" height={8}/></span>
          <Skeleton className="max-[760px]:hidden" width={72} height={22} radius={99}/>
          <Skeleton width={12} height={15}/>
        </div>)}
      </div>
    </div>
  </div>;
}

export function OverviewMetricsSkeleton() {
  return <div className={metricGrid}>{Array.from({ length: 4 }, (_, index) => <MetricSkeleton key={index}/>)}</div>;
}

export function OverviewAppointmentsSkeleton() {
  return <section className={panel}><PanelHeadingSkeleton/>{Array.from({ length: 5 }, (_, index) => <RowSkeleton key={index} columns={4}/>)}</section>;
}

export function OverviewReadinessSkeleton() {
  return <section className={panel}><PanelHeadingSkeleton/>{Array.from({ length: 4 }, (_, index) => <RowSkeleton key={index} columns={2}/>)}</section>;
}

function OverviewSkeleton() {
  return <><OverviewMetricsSkeleton/><div className={twoPanel}><OverviewAppointmentsSkeleton/><OverviewReadinessSkeleton/></div></>;
}

function SalesSkeleton() {
  return <>
    <div className={metricGridThree}>{Array.from({ length: 3 }, (_, index) => <MetricSkeleton key={index}/>)}</div>
    <div className="grid grid-cols-[minmax(220px,1fr)_132px] items-end gap-3 max-[640px]:grid-cols-1"><div className="flex flex-col gap-1.5"><Skeleton width={72} height={9}/><Skeleton width="100%" height={42}/></div><Skeleton className="max-[640px]:w-full" width={132} height={38}/></div>
    <TableSkeleton columns={7}/>
  </>;
}

function ReportsSkeleton() {
  return <>
    <div className="grid grid-cols-1 items-end gap-3.5 rounded-[18px_12px_17px_13px] border-2 border-hippy-ink bg-[#fff8e9] p-3.5 shadow-[4px_4px_0_#3b2923] min-[880px]:grid-cols-[1fr_auto] min-[1380px]:grid-cols-[minmax(420px,1fr)_auto_auto]">
      <Skeleton className="h-[49px] w-full rounded-[14px_10px_13px_11px] min-[880px]:col-span-full min-[1380px]:col-span-1" />
      <div className="flex flex-wrap items-end gap-2 border-l-2 border-dashed border-[#c78e6a] pl-3.5 max-[1379px]:border-l-0 max-[1379px]:pl-0 max-[500px]:w-full">
        <Skeleton className="h-[39px] flex-1 min-w-[120px]" />
        <Skeleton className="h-[39px] flex-1 min-w-[120px]" />
        <Skeleton className="h-[39px] w-[62px] max-[500px]:w-full" />
      </div>
      <Skeleton className="h-[43px] w-full min-[880px]:w-[136px] shrink-0" />
    </div>
    <div className={metricGridThree}>{Array.from({ length: 3 }, (_, index) => <MetricSkeleton key={index}/>)}</div>
    <div className={twoPanel}>{Array.from({ length: 2 }, (_, index) => <section className={panel} key={index}><PanelHeadingSkeleton/>{Array.from({ length: 5 }, (_, row) => <RowSkeleton key={row} columns={2}/>)}</section>)}</div>
  </>;
}

function SettingsSkeleton() {
  return <div className={settingsStack}>
    <section className={settingSection}><PanelHeadingSkeleton/><div className="grid grid-cols-2 gap-[13px] p-[18px] max-[760px]:grid-cols-1">{Array.from({ length: 8 }, (_, index) => <div className="flex flex-col gap-2" key={index}><Skeleton width="36%" height={9}/><Skeleton width="100%" height={42}/></div>)}</div></section>
    <section className={settingSection}><PanelHeadingSkeleton/><CalendarGridSkeleton/></section>
    {Array.from({ length: 2 }, (_, index) => <section className={settingSection} key={index}><PanelHeadingSkeleton/>{Array.from({ length: 4 }, (_, row) => <RowSkeleton key={row} columns={3}/>)}</section>)}
    <section className={twoPanel}>{Array.from({ length: 2 }, (_, index) => <div className={settingSection} key={index}><PanelHeadingSkeleton/>{Array.from({ length: 3 }, (_, row) => <RowSkeleton key={row} columns={2}/>)}</div>)}</section>
  </div>;
}

export function StaffViewSkeleton({ view = "overview", label = "Loading workspace" }: { view?: StaffView; label?: string }) {
  return <div className={featureView} aria-busy="true">
    <LoadingStatus label={label}/>
    {view === "overview" && <OverviewSkeleton/>}
    {view === "calendar" && <><div className="flex gap-2 overflow-hidden rounded-[17px] border-2 border-hippy-ink bg-[#f1d39c] p-2.5">{Array.from({ length: 7 }, (_, index) => <Skeleton key={index} width={index > 2 ? 110 : 39} height={38}/>)}</div><section className={panel}><div className="overflow-x-auto"><CalendarGridSkeleton/></div></section></>}
    {view === "clients" && <><div className="flex items-end gap-3 max-[640px]:flex-col"><span className="flex flex-1 flex-col gap-2 max-[640px]:w-full"><Skeleton width={78} height={9}/><Skeleton className="w-full" height={42}/></span><Skeleton className="max-[640px]:w-full" width={118} height={38}/></div><TableSkeleton/></>}
    {view === "sales" && <SalesSkeleton/>}
    {view === "reports" && <ReportsSkeleton/>}
    {view === "settings" && <SettingsSkeleton/>}
  </div>;
}

export function SettingsFormSkeleton() {
  return <section className={settingSection}><PanelHeadingSkeleton/><div className="grid grid-cols-2 gap-[13px] p-[18px] max-[760px]:grid-cols-1">{Array.from({ length: 8 }, (_, index) => <div className="flex flex-col gap-2" key={index}><Skeleton width="36%" height={9}/><Skeleton width="100%" height={42}/></div>)}</div></section>;
}

export function SettingsScheduleSkeleton() {
  return <section className={settingSection}><PanelHeadingSkeleton/><CalendarGridSkeleton/></section>;
}

export function SettingsListSkeleton({ rows = 4 }: { rows?: number }) {
  return <section className={settingSection}><PanelHeadingSkeleton/>{Array.from({ length: rows }, (_, index) => <RowSkeleton key={index} columns={3}/>)}</section>;
}

export function SettingsNotificationSkeleton() {
  return <div className={settingSection}><PanelHeadingSkeleton/>{Array.from({ length: 3 }, (_, index) => <RowSkeleton key={index} columns={2}/>)}</div>;
}

export function StaffShellSkeleton({ view = "overview" }: { view?: StaffView }) {
  return (
    <div className="relative flex h-screen min-h-[620px] gap-[15px] overflow-hidden bg-hippy-sand p-3.5 text-hippy-ink max-[760px]:block max-[760px]:h-auto max-[760px]:min-h-screen max-[760px]:p-2.5" aria-busy="true">
      <aside className="flex h-full w-[230px] shrink-0 flex-col rounded-[24px_14px_20px_17px] border-2 border-hippy-ink bg-[#f9ecd1] px-3.5 pt-[21px] pb-4 shadow-[6px_6px_0_#3b2923] max-[760px]:mb-3 max-[760px]:h-auto max-[760px]:w-full">
        <div className="flex items-center gap-2.5 px-2 pb-[27px]"><Skeleton className="size-[42px]" radius="50%"/><span className="flex flex-1 flex-col gap-2"><Skeleton width="74%" height={16}/><Skeleton width="48%" height={7}/></span></div>
        <div className="flex flex-col gap-2 max-[760px]:flex-row max-[760px]:overflow-hidden">{Array.from({ length: 6 }, (_, index) => <Skeleton className="h-[42px] w-full max-[760px]:min-w-[105px]" key={index}/>)}</div>
        <div className="mt-auto rounded-[15px] border border-hippy-ink bg-[#fff7e7] p-3 max-[760px]:hidden"><Skeleton width="82%" height={38}/></div>
      </aside>
      <main className="h-full min-w-0 flex-1 overflow-hidden rounded-[18px_26px_17px_23px] border-2 border-hippy-ink bg-hippy-cream shadow-[7px_7px_0_#3b2923] max-[760px]:min-h-[calc(100vh-110px)] max-[760px]:w-full">
        <header className="flex min-h-[92px] items-center border-b border-dashed border-[#c9825a] px-[clamp(24px,4vw,52px)]"><span className="flex w-full max-w-[280px] flex-col gap-2"><Skeleton width="48%" height={8}/><Skeleton width="88%" height={27}/></span></header>
        <div className="mx-auto max-w-[1450px] px-[clamp(22px,4vw,52px)] pt-[30px] pb-[72px]"><StaffViewSkeleton view={view} label={`Loading ${view}`}/></div>
      </main>
    </div>
  );
}
