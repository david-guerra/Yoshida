// Civil dates are strings and UTC arithmetic; host DST must never move a Berlin appointment.
const berlinParts = (instant: Date) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone:"Europe/Berlin", year:"numeric", month:"2-digit", day:"2-digit",
    hour:"2-digit", minute:"2-digit", second:"2-digit", hourCycle:"h23",
  }).formatToParts(instant);
  return (name:string) => parts.find(part => part.type === name)!.value;
};

export function berlinDay(instant: Date) {
  const part = berlinParts(instant);
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function shiftDay(day: string, offset: number) {
  const date = new Date(day + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate()+offset);
  return date.toISOString().slice(0,10);
}

export function berlinMidnight(day: string) {
  const target = Date.parse(day + "T00:00:00Z");
  let instant = target;
  for (let i=0; i<3; i++) {
    const part = berlinParts(new Date(instant));
    const actual = Date.UTC(Number(part("year")), Number(part("month"))-1, Number(part("day")), Number(part("hour")), Number(part("minute")));
    instant += target - actual;
  }
  return new Date(instant).toISOString();
}

export function weekDays(day: string) {
  const sunday = shiftDay(day, -new Date(day + "T12:00:00Z").getUTCDay());
  return Array.from({length:7}, (_, index) => shiftDay(sunday, index));
}

export function calendarWeek(day: string) {
  const days = weekDays(day);
  return {from:berlinMidnight(days[0]), to:berlinMidnight(shiftDay(days[6],1))};
}

export function monthDays(day: string) {
  const first = day.slice(0, 7) + "-01";
  const next = new Date(first + "T12:00:00Z");
  next.setUTCMonth(next.getUTCMonth() + 1);
  const last = shiftDay(next.toISOString().slice(0, 10), -1);
  const from = weekDays(first)[0];
  const to = weekDays(last)[6];
  const count = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  return Array.from({length: count}, (_, index) => shiftDay(from, index));
}

export function calendarMonth(day: string) {
  const days = monthDays(day);
  return {from: berlinMidnight(days[0]), to: berlinMidnight(shiftDay(days.at(-1)!, 1))};
}

export function shiftMonth(day: string, offset: number) {
  const date = new Date(day.slice(0, 7) + "-01T12:00:00Z");
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 10);
}
