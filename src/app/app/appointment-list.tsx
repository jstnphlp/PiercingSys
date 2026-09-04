"use client";

import { CalendarDays, Search } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import type { BookingRecord } from "@/lib/data/staff";
import type { BookingStatus } from "@/lib/domain";
import { BookingActions } from "./controls";
import {
  emptyState,
  panel,
  statusClasses,
  statusNote,
} from "./dashboard-styles";
import { SideDrawer } from "./side-drawer";

export function TodayAppointments({
  bookings,
  role,
}: {
  bookings: BookingRecord[];
  role: string;
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const normalizedSearch = normalize(search);
  const visibleBookings = useMemo(
    () =>
      normalizedSearch
        ? bookings.filter((item) =>
            normalize(searchableAppointmentText(item)).includes(
              normalizedSearch,
            ),
          )
        : bookings,
    [bookings, normalizedSearch],
  );
  const selected = bookings.find((item) => item.id === selectedId) ?? null;

  return (
    <section className={panel}>
      <div className="flex min-h-[66px] items-center justify-between gap-3 border-b border-dashed border-[#c98965] bg-[#fff7e5] px-[18px] py-3.5 max-[700px]:items-stretch max-[700px]:flex-col">
        <div className="min-w-0">
          <h3 className="m-0 font-display text-base font-[760] text-hippy-ink">
            Today’s appointments
          </h3>
          <p className="mt-1 mb-0 text-[9px] text-[#82675d]">
            Live records from the studio calendar
          </p>
        </div>
        <label className="relative block w-[clamp(240px,36%,292px)] shrink-0 max-[700px]:w-full [&>svg]:pointer-events-none [&>svg]:absolute [&>svg]:top-1/2 [&>svg]:left-2.5 [&>svg]:size-3.5 [&>svg]:-translate-y-1/2 [&>svg]:text-[#8a6a5d]">
          <span className="sr-only">Search appointments</span>
          <Search />
          <input
            className="min-h-9 w-full rounded-[10px_7px_11px_8px] border-[1.5px] border-hippy-ink bg-[#fffaf0] py-2 pr-3 pl-8 text-[10px] font-bold text-espresso shadow-[2px_2px_0_#d9a47e] outline-none placeholder:text-[#9a8176] focus:border-hippy-orange focus:outline-3 focus:outline-[#df682c35]"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search appointments..."
          />
        </label>
      </div>
      {bookings.length ? (
        <AppointmentList
          bookings={visibleBookings}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      ) : (
        <Empty
          icon={<CalendarDays />}
          title="No appointments today"
          text="Confirmed online bookings and staff appointments will appear here."
        />
      )}
      {bookings.length > 0 && visibleBookings.length === 0 && (
        <p className={`${statusNote} px-4 py-5`}>
          No appointments match the current search.
        </p>
      )}
      {selected && (
        <AppointmentDetails
          booking={selected}
          role={role}
          onClose={() => setSelectedId(null)}
        />
      )}
    </section>
  );
}

function AppointmentList({
  bookings,
  selectedId,
  onSelect,
}: {
  bookings: BookingRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (!bookings.length) return null;

  return (
    <div className="overflow-x-auto [scrollbar-width:thin] [scrollbar-color:#d5aa89_transparent]">
      <table className="w-full min-w-[640px] table-fixed border-collapse bg-[#fff9eb]">
        <colgroup>
          <col className="w-[11%]" />
          <col className="w-[31%]" />
          <col className="w-[23%]" />
          <col className="w-[17.5%]" />
          <col className="w-[17.5%]" />
        </colgroup>
        <thead>
          <tr className="h-10 bg-[#f5ddba] text-left text-[8px] font-black tracking-[.6px] text-[#795346] uppercase">
            <th className="px-3 pl-4">Time</th>
            <th className="px-2">Customer</th>
            <th className="px-2">Piercer</th>
            <th className="px-2">Appointment Status</th>
            <th className="px-2">Completion Status</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((item) => {
            const statuses = displayStatuses(item.status);
            return (
              <tr
                className={`min-h-[70px] cursor-pointer border-b border-dashed border-[#dab08f] transition last:border-0 hover:bg-[#fff1cf] focus:bg-[#fff1cf] focus:outline-2 focus:-outline-offset-2 focus:outline-[#d66335] ${
                  selectedId === item.id ? "bg-[#fff1cf]" : ""
                }`}
                key={item.id}
                tabIndex={0}
                onClick={() => onSelect(item.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(item.id);
                  }
                }}
                aria-label={`Open appointment details for ${item.customer.name}`}
              >
                <td className="px-3 py-[9px] pl-4 align-middle">
                  <span className="flex flex-col text-[10px] text-hippy-ink">
                    <strong className="truncate">
                      {formatTime(item.startsAt)}
                    </strong>
                    <small className="mt-[3px] truncate text-[8px] text-[#80675e]">
                      {formatTime(item.endsAt)}
                    </small>
                  </span>
                </td>
                <td className="px-2 py-[9px] align-middle">
                  <span className="grid w-full grid-cols-[33px_minmax(0,1fr)] items-center gap-2 text-left">
                    <span className="grid size-[33px] place-items-center rounded-[50%_42%_50%_45%] border border-hippy-ink bg-[#e98956] text-[10px] font-extrabold text-[#522b1b]">
                      {initials(item.customer.name)}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <strong className="truncate text-[10px] text-hippy-ink">
                        {item.customer.name}
                      </strong>
                      <small className="mt-[3px] truncate text-[8px] text-[#80675e]">
                        {item.services.map((service) => service.name).join(" + ")}{" "}
                        · {item.reference}
                      </small>
                    </span>
                  </span>
                </td>
                <td className="px-2 py-[9px] align-middle">
                  <span className="flex min-w-0 items-center gap-[7px] text-[9px] text-[#4a3730]">
                    <i
                      className="size-2 shrink-0 rounded-full"
                      style={{
                        background: item.piercer?.color ?? "#80675e",
                      }}
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">
                        {item.piercer?.name ?? "Unassigned"}
                      </span>
                      <small className="mt-[3px] truncate text-[8px] text-[#80675e]">
                        {item.station ?? "No station"}
                      </small>
                    </span>
                  </span>
                </td>
                <td className="px-2 py-[9px] align-middle">
                  <StatusBadge
                    value={statuses.appointmentTone}
                    label={statuses.appointmentLabel}
                  />
                </td>
                <td className="px-2 py-[9px] align-middle">
                  <StatusBadge
                    value={statuses.completionTone}
                    label={statuses.completionLabel}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AppointmentDetails({
  booking,
  role,
  onClose,
}: {
  booking: BookingRecord;
  role: string;
  onClose: () => void;
}) {
  const statuses = displayStatuses(booking.status);
  const canManage = role !== "piercer";

  return (
    <SideDrawer
      title={booking.customer.name}
      detail={`${booking.reference} · ${booking.services.map((item) => item.name).join(" + ")}`}
      onClose={onClose}
    >
      <div className="flex flex-col gap-[15px] p-[21px] max-[700px]:p-4">
          <dl className="m-0 grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border-[1.5px] border-hippy-ink bg-hippy-ink max-[700px]:grid-cols-1 [&>div]:min-w-0 [&>div]:bg-[#fff9eb] [&>div]:p-3 [&_dt]:mb-[5px] [&_dt]:text-[8px] [&_dt]:font-black [&_dt]:tracking-[.8px] [&_dt]:text-[#a34d30] [&_dt]:uppercase [&_dd]:m-0 [&_dd]:text-[11px]/[1.55] [&_dd]:break-words">
            <Detail label="Contact">
              {booking.customer.email}
              <br />
              {booking.customer.phone}
            </Detail>
            <Detail label="Booking reference">{booking.reference}</Detail>
            <Detail label="Appointment start">
              {formatDate(booking.startsAt)}
              <br />
              {formatTime(booking.startsAt)}
            </Detail>
            <Detail label="Appointment end">
              {formatDate(booking.endsAt)}
              <br />
              {formatTime(booking.endsAt)}
            </Detail>
            <Detail label="Services">
              {booking.services.map((item) => item.name).join(" + ")}
            </Detail>
            <Detail label="Assigned piercer">
              {booking.piercer?.name ?? "Unassigned"}
              <br />
              {booking.station ?? "No station"}
            </Detail>
            <Detail label="Appointment Status">
              <StatusBadge
                value={statuses.appointmentTone}
                label={statuses.appointmentLabel}
              />
            </Detail>
            <Detail label="Completion Status">
              <StatusBadge
                value={statuses.completionTone}
                label={statuses.completionLabel}
              />
            </Detail>
            <Detail label="Notes" className="col-span-2 max-[700px]:col-span-1">
              {booking.notes || "No notes"}
            </Detail>
          </dl>
          <section className="rounded-[14px] border-[1.5px] border-hippy-ink bg-[#fff9eb] p-3 shadow-[2px_2px_0_#3b2923]">
            <h3 className="mt-0 mb-2 text-[10px] font-black tracking-[.7px] text-[#a34d30] uppercase">
              Booking actions
            </h3>
            <BookingActions
              id={booking.id}
              status={booking.status}
              canManage={canManage}
              startsAt={booking.startsAt}
            />
            {role === "piercer" && (
              <p className={`${statusNote} mt-2 mb-0`}>
                Management actions are hidden for piercer accounts.
              </p>
            )}
            {!["confirmed", "requested"].includes(booking.status) && (
              <p className={`${statusNote} mt-2 mb-0`}>
                This appointment is already {booking.status.replace("_", " ")}.
              </p>
            )}
          </section>
      </div>
    </SideDrawer>
  );
}

function Detail({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Empty({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className={emptyState}>
      <span>{icon}</span>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

function StatusBadge({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return <span className={statusClasses(value)}>{label}</span>;
}

function displayStatuses(status: BookingStatus) {
  const mapped: Record<
    BookingStatus,
    {
      appointmentLabel: string;
      appointmentTone: string;
      completionLabel: string;
      completionTone: string;
    }
  > = {
    requested: {
      appointmentLabel: "Requested",
      appointmentTone: "requested",
      completionLabel: "Pending",
      completionTone: "pending",
    },
    confirmed: {
      appointmentLabel: "Confirmed",
      appointmentTone: "confirmed",
      completionLabel: "Pending",
      completionTone: "pending",
    },
    completed: {
      appointmentLabel: "Confirmed",
      appointmentTone: "confirmed",
      completionLabel: "Completed",
      completionTone: "completed",
    },
    rejected: {
      appointmentLabel: "Rejected",
      appointmentTone: "rejected",
      completionLabel: "N/A",
      completionTone: "rejected",
    },
    cancelled: {
      appointmentLabel: "Cancelled",
      appointmentTone: "cancelled",
      completionLabel: "N/A",
      completionTone: "cancelled",
    },
    no_show: {
      appointmentLabel: "No-show",
      appointmentTone: "no_show",
      completionLabel: "No-show",
      completionTone: "no_show",
    },
  };
  return mapped[status];
}

function searchableAppointmentText(item: BookingRecord) {
  return [
    item.customer.name,
    item.reference,
    item.piercer?.name,
    item.station,
    ...item.services.map((service) => service.name),
  ]
    .filter(Boolean)
    .join(" ");
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

function initials(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "PC"
  );
}
