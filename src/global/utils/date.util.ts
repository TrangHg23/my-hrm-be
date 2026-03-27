export const nowVN = (): Date => {
  return new Date();
};

export const parseDateVN = (dateStr: string | Date): Date => {
  if (dateStr instanceof Date) return dateStr;
  return new Date(`${dateStr}T00:00:00+07:00`);
};

export const combineDateTimeVN = (dateStr: string, timeStr: string): Date => {
  return new Date(`${dateStr}T${timeStr}:00+07:00`);
};

export const formatDateVN = (date: Date): string => {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(date)
    .split('/')
    .reverse()
    .join('-');
};

export const formatTimeToHHmm = (date: Date): string => {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
};
