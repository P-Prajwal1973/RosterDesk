import { defaultClock } from './clock';
import type { Clock } from './clock';

export const HOSPITAL_TIMEZONE = 'Asia/Kolkata';


export function getHospitalDateString(
  dateOrTimestamp: Date | number = defaultClock.getSystemDate(),
  timezone: string = HOSPITAL_TIMEZONE
): string {
  const date = typeof dateOrTimestamp === 'number' ? new Date(dateOrTimestamp) : dateOrTimestamp;
  
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  return formatter.format(date); //  YYYY-MM-DD
}


export function isDateInPast(
  dateString: string,
  clock: Clock = defaultClock,
  timezone: string = HOSPITAL_TIMEZONE
): boolean {
  const todayHospital = getHospitalDateString(clock.getSystemDate(), timezone);
  return dateString < todayHospital;
}


export function getShiftStartAndEndTimes(
  dateString: string, // 'YYYY-MM-DD'
  shiftType: 'D' | 'E' | 'N',
  timezone: string = HOSPITAL_TIMEZONE
): { start: Date; end: Date } {
  const [year, month, day] = dateString.split('-').map(Number);

  let startHour = 7;
  let endHour = 15;
  let endOffsetDays = 0;

  if (shiftType === 'E') {
    startHour = 15;
    endHour = 23;
  } else if (shiftType === 'N') {
    startHour = 23;
    endHour = 7;
    endOffsetDays = 1; // Night shift ends on the next calendar day
  }

 
  const startDate = createDateInTimezone(year, month, day, startHour, 0, timezone);
  const endDate = createDateInTimezone(year, month, day + endOffsetDays, endHour, 0, timezone);

  return { start: startDate, end: endDate };
}


function createDateInTimezone(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string
): Date {
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute));
  
  
  const invDate = new Date(
    utcDate.toLocaleString('en-US', { timeZone: timezone })
  );
  const diff = utcDate.getTime() - invDate.getTime();
  
  return new Date(utcDate.getTime() + diff);
}