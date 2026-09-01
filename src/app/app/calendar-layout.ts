export type CalendarAppointmentInterval = {
  id: string;
  startsAt: string;
  endsAt: string;
};

export type CalendarAppointmentLayout = {
  column: number;
  columns: number;
};

export function layoutOverlappingAppointments(
  appointments: CalendarAppointmentInterval[],
) {
  const sorted = appointments
    .map((appointment) => ({
      ...appointment,
      start: new Date(appointment.startsAt).getTime(),
      end: new Date(appointment.endsAt).getTime(),
    }))
    .sort((left, right) => left.start - right.start || left.end - right.end || left.id.localeCompare(right.id));
  const layouts = new Map<string, CalendarAppointmentLayout>();
  let cluster: typeof sorted = [];
  let clusterEnd = Number.NEGATIVE_INFINITY;

  function placeCluster() {
    const laneEnds: number[] = [];
    const placements: Array<{ id: string; column: number }> = [];
    for (const appointment of cluster) {
      let column = laneEnds.findIndex((end) => end <= appointment.start);
      if (column === -1) column = laneEnds.length;
      laneEnds[column] = appointment.end;
      placements.push({ id: appointment.id, column });
    }
    for (const placement of placements) {
      layouts.set(placement.id, { column: placement.column, columns: laneEnds.length });
    }
  }

  for (const appointment of sorted) {
    if (cluster.length && appointment.start >= clusterEnd) {
      placeCluster();
      cluster = [];
      clusterEnd = Number.NEGATIVE_INFINITY;
    }
    cluster.push(appointment);
    clusterEnd = Math.max(clusterEnd, appointment.end);
  }
  if (cluster.length) placeCluster();
  return layouts;
}
