(function (global) {
  'use strict';

  const THAI_DAYS = [
    'อาทิตย์',
    'จันทร์',
    'อังคาร',
    'พุธ',
    'พฤหัสบดี',
    'ศุกร์',
    'เสาร์'
  ];

  const THAI_MONTHS_FULL = [
    'มกราคม',
    'กุมภาพันธ์',
    'มีนาคม',
    'เมษายน',
    'พฤษภาคม',
    'มิถุนายน',
    'กรกฎาคม',
    'สิงหาคม',
    'กันยายน',
    'ตุลาคม',
    'พฤศจิกายน',
    'ธันวาคม'
  ];

  const THAI_MONTHS_SHORT = [
    'ม.ค.',
    'ก.พ.',
    'มี.ค.',
    'เม.ย.',
    'พ.ค.',
    'มิ.ย.',
    'ก.ค.',
    'ส.ค.',
    'ก.ย.',
    'ต.ค.',
    'พ.ย.',
    'ธ.ค.'
  ];

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function getTodayISO() {
    const now = new Date();
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  }

  function parseISODate(isoDate) {
    if (!isoDate || typeof isoDate !== 'string') {
      return new Date();
    }
    const parts = isoDate.split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) {
      return new Date();
    }
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function formatThaiDateFull(isoDate) {
    const d = parseISODate(isoDate);
    const dayName = THAI_DAYS[d.getDay()];
    const dayNum = d.getDate();
    const monthName = THAI_MONTHS_FULL[d.getMonth()];
    const buddhistYear = d.getFullYear() + 543;
    return `วัน${dayName}ที่ ${dayNum} ${monthName} พ.ศ. ${buddhistYear}`;
  }

  function formatThaiDateShort(isoDate) {
    const d = parseISODate(isoDate);
    const dayNum = d.getDate();
    const monthShort = THAI_MONTHS_SHORT[d.getMonth()];
    const buddhistYear = d.getFullYear() + 543;
    return `${dayNum} ${monthShort} ${buddhistYear}`;
  }

  function formatTimeNow(dateObj) {
    const now = dateObj instanceof Date ? dateObj : new Date();
    return `${pad2(now.getHours())}:${pad2(now.getMinutes())} น.`;
  }

  function shiftDateISO(isoDate, deltaDays) {
    const d = parseISODate(isoDate);
    d.setDate(d.getDate() + deltaDays);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  global.AttendanceApp = global.AttendanceApp || {};
  global.AttendanceApp.ThaiDate = {
    getTodayISO,
    parseISODate,
    formatThaiDateFull,
    formatThaiDateShort,
    formatTimeNow,
    shiftDateISO
  };
})(window);
