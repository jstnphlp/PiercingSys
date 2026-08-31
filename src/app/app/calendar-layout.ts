export type CalendarInterval = {
  id: string;
  starts_at: string;
  ends_at: string;
};

export type PositionedCalendarItem<T> = {
  item: T;
  lane: number;
  laneCount: number;
};

export function layoutOverlappingAppointments<T extends CalendarInterval>(items: T[]): PositionedCalendarItem<T>[] {
  return layoutOverlappingItems(items, (item) => timestamp(item.starts_at), (item) => timestamp(item.ends_at));
}

export function layoutOverlappingItems<T extends { id: string }>(items: T[], getStart: (item: T) => number, getEnd: (item: T) => number): PositionedCalendarItem<T>[] {
  const sorted = [...items].sort((left, right) => {
    const startDifference = getStart(left) - getStart(right);
    if (startDifference) return startDifference;
    const endDifference = getEnd(right) - getEnd(left);
    return endDifference || left.id.localeCompare(right.id);
  });
  const groups: T[][] = [];
  let group: T[] = [];
  let groupEnd = Number.NEGATIVE_INFINITY;

  for (const item of sorted) {
    const start = getStart(item);
    const end = getEnd(item);
    if (group.length && start >= groupEnd) {
      groups.push(group);
      group = [];
      groupEnd = Number.NEGATIVE_INFINITY;
    }
    group.push(item);
    groupEnd = Math.max(groupEnd, end);
  }
  if (group.length) groups.push(group);

  return groups.flatMap((overlapGroup) => {
    const laneEnds: number[] = [];
    const positioned = overlapGroup.map((item) => {
      const start = getStart(item);
      const availableLane = laneEnds.findIndex((end) => end <= start);
      const lane = availableLane === -1 ? laneEnds.length : availableLane;
      laneEnds[lane] = getEnd(item);
      return { item, lane };
    });
    const laneCount = laneEnds.length;
    return positioned.map((entry) => ({ ...entry, laneCount }));
  });
}

function timestamp(value: string) {
  return new Date(value).getTime();
}
