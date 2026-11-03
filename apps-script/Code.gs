const SPREADSHEET_ID = '1zB_RnNQoS6NkSLibdYKlqu-bGxMwi7M31B-lRHM4fo8';
// ชีตพนักงาน (ถ้าอยู่คนละไฟล์กับชีตจอง ให้ใส่ ID ของไฟล์นั้นแทน)
const EMP_SPREADSHEET_ID = SPREADSHEET_ID;
const EMP_SHEET = 'Emp Active HO';
const BRAND = 'BJC BigC';
const STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];

// เปิดไฟล์ชีตครั้งเดียวต่อ 1 คำขอ (เดิมเปิดซ้ำทุกครั้งที่อ่านชีต ทำให้ช้า)
let _book = null;
function book() { return _book || (_book = SpreadsheetApp.openById(SPREADSHEET_ID)); }

function getSheet(name) {
  return book().getSheetByName(name);
}

function doGet() {
  return jsonResponse({ success: true, message: 'Booking API is running' });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');
    switch (data.action) {
      case 'getStores':      return getStores();
      case 'getServices':    return getServices(data.store_id);
      case 'getBookedSlots': return getBookedSlots(data.store_id, data.booking_date);
      case 'createBooking':  return createBooking(data);
      case 'login':          return login(data);
      case 'getBookings':    return getBookings(data);
      case 'updateStatus':   return updateStatus(data);
      case 'resendEmail':    return resendEmail(data);
      case 'verifyEmployee': return verifyEmployee(data);
      case 'getHolidays':    return getHolidays(data.from, data.to);
      case 'getStoreStaff':  return getStoreStaff(data);
      case 'cancelMyBooking': return cancelMyBooking(data);
      case 'ackCancellations': return ackCancellations(data);
      case 'getAvailableSlots': return getAvailableSlots(data);
      case 'getEmployeeBookings': return getEmployeeBookings(data);
      case 'getStaff':       return getStaff(data);
      case 'saveStaff':      return saveStaff(data);
      default: return jsonResponse({ success: false, message: 'Unknown action' });
    }
  } catch (error) {
    return jsonResponse({ success: false, message: error.message });
  }
}

/* ---------- Public ---------- */

function getStores() {
  const values = getSheet('Stores').getDataRange().getValues();
  values.shift();
  const stores = values
    .filter(row => row[4] === 'ACTIVE')
    .map(row => ({
      store_id: row[0],
      store_name: row[1],
      store_type: row[2],
      external_booking_url: row[3],
      phone: String(row[5] || '').trim() // คอลัมน์ F = Phone (เบอร์ติดต่อร้าน)
    }));
  return jsonResponse({ success: true, stores });
}

function getServices(storeId) {
  const values = getSheet('Services').getDataRange().getValues();
  values.shift();
  const services = values
    .filter(row => row[1] === storeId && row[5] === 'ACTIVE')
    .map(row => ({
      service_id: row[0],
      store_id: row[1],
      service_name: row[2],
      duration_minutes: row[3],
      price: row[4]
    }));
  return jsonResponse({ success: true, services });
}

function getBookedSlots(storeId, date) {
  const dur = durMap();
  const busy = readBookings()
    .filter(b => b.store_id === storeId && b.booking_date === date && b.status !== 'CANCELLED')
    .map(b => ({ start: b.booking_time, end: minToHm(toMin(b.booking_time) + durOf(dur, b.service_id)) }));
  return jsonResponse({ success: true, busy: busy, times: busy.map(x => x.start) });
}

function createBooking(data) {
  ['store_id', 'emp_id', 'phone', 'service_id', 'service_name', 'booking_date', 'booking_time']
    .forEach(k => { if (!data[k]) throw new Error('ข้อมูลไม่ครบ: ' + k); });
  checkBookableDate(data.booking_date);
  // ชื่อและอีเมลดึงจากชีตพนักงานเท่านั้น (ไม่เชื่อค่าจากหน้าเว็บ)
  const emp = findEmployee(data.emp_id);
  if (!emp) throw new Error('ไม่พบรหัสพนักงานนี้ในระบบ');
  data.customer_name = emp.full_name;
  data.email = emp.email;

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const dur = durMap();
    const ids = String(data.service_id).split(',').map(x => x.trim());
    if (ids.some(id => !dur[id])) throw new Error('ไม่พบบริการที่เลือก');
    const mine = durOf(dur, data.service_id);
    const start = toMin(data.booking_time), end = start + mine;
    if (!(start >= OPEN_MIN) || end > CLOSE_MIN) {
      throw new Error('ไม่สามารถจองได้เนื่องจากเวลาไม่เพียงพอ: บริการที่เลือกใช้เวลา ' + mine + ' นาที เกินเวลาทำการ (08:00–20:00 น.)');
    }
    // ต้องมีพนักงานของร้านในวันนั้น และต้องมีพนักงานอย่างน้อย 1 คนที่ว่างตลอดช่วงบริการ
    // (หลายคิวจองทับเวลาเดียวกันได้ตามจำนวนพนักงาน แต่พนักงานคนเดียวกันห้ามซ้อนกัน)
    const resources = dayResources(data.store_id, data.booking_date);
    if (!resources.length) {
      throw new Error('ร้านปิดให้บริการในวันที่เลือก (ร้านยังไม่ได้ระบุพนักงาน) ' + contactText(data.store_id));
    }
    const busy = busyMap(resources, data.store_id, data.booking_date, dur);
    const staffName = pickStaff(resources, busy, start, end);
    if (!staffName) {
      throw new Error('ไม่สามารถจองได้เนื่องจากเวลาไม่เพียงพอ: ไม่มีพนักงานว่างต่อเนื่อง ' + mine + ' นาที ในช่วงเวลานี้ กรุณาเลือกเวลาอื่น');
    }

    const sheet = getSheet('Bookings');
    const bookingId = 'BK' + Utilities.formatString('%04d', sheet.getLastRow());

    sheet.appendRow([
      bookingId, data.store_id, data.customer_name, data.email, data.phone,
      data.service_id, data.service_name, data.booking_date, data.booking_time,
      'PENDING', new Date(), 'PENDING', 'PENDING', // สถานะเริ่มต้น = รอร้านยืนยัน,
      '', // N = Note (เว้นว่างไว้)
      emp.emp_id, emp.company, emp.division, emp.department, // O–R
      staffName // S = Staff_Name (พนักงานที่รับคิว)
    ]);

    // กัน Sheets แปลงเป็นตัวเลข/วันที่ (เช่น เบอร์ 08… เหลือ 8…)
    const row = sheet.getLastRow();
    [[5, data.phone], [8, data.booking_date], [9, data.booking_time]].forEach(([col, v]) =>
      sheet.getRange(row, col).setNumberFormat('@').setValue(String(v)));

    // ส่งอีเมล "ได้รับคำขอจอง" ทันที ส่วนอีเมลยืนยันจะส่งเมื่อร้านกดยืนยัน (คอลัมน์ L จึงเป็น PENDING ไปก่อน)
    try { sendBookingEmail('RECEIVED', bookingId, data); } catch (err) {}

    return jsonResponse({ success: true, booking_id: bookingId });
  } finally {
    lock.releaseLock();
  }
}

const TH_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

function thaiDate(s) {
  const p = s.split('-');
  return Number(p[2]) + ' ' + TH_MONTHS[Number(p[1]) - 1] + ' ' + (Number(p[0]) + 543);
}

function lookup(sheetName, id, col) {
  const v = getSheet(sheetName).getDataRange().getValues();
  v.shift();
  const r = v.find(r => r[0] === id);
  return r ? r[col] : '';
}

// kind: 'CONFIRM' | 'REMINDER'
function sendBookingEmail(kind, bookingId, d) {
  const store = lookup('Stores', d.store_id, 1);
  const title = kind === 'REMINDER' ? 'พรุ่งนี้คุณมีคิวจองกับเรา'
    : kind === 'RECEIVED' ? 'ได้รับคำขอจองของคุณแล้ว — รอร้านยืนยัน'
    : 'การจองของคุณได้รับการยืนยันแล้ว';
  const rows = [
    ['รหัสการจอง', bookingId], ['ร้าน', store], ['บริการ', d.service_name],
    ['วัน-เวลา', thaiDate(d.booking_date) + ' · ' + d.booking_time + '–' + minToHm(toMin(d.booking_time) + durOf(durMap(), d.service_id))]
  ].map(r =>
    '<tr><td style="padding:10px 0;color:#4e615b;border-top:1px solid #e1e8dc">' + r[0] +
    '</td><td style="padding:10px 0;text-align:right;border-top:1px solid #e1e8dc"><b>' + r[1] + '</b></td></tr>'
  ).join('');
  const html =
    '<div style="font-family:Tahoma,sans-serif;max-width:520px;margin:auto;border:1px solid #e1e8dc;border-radius:16px;overflow:hidden">' +
    '<div style="background:#0f3d33;color:#fff;padding:20px 28px;font-size:20px;font-weight:bold">' + BRAND + '</div>' +
    '<div style="padding:28px"><h2 style="margin:0 0 8px;color:#10241f">' + title + '</h2>' +
    '<p style="color:#4e615b;margin:0 0 16px">สวัสดีคุณ ' + d.customer_name + '</p>' +
    '<table width="100%" cellspacing="0">' + rows + '</table>' +
    '<p style="color:#4e615b;font-size:14px;margin-top:20px">หากต้องการยกเลิก เข้าเมนู “คิวของฉัน” บนเว็บ หรือติดต่อร้านก่อนเวลานัด</p></div></div>';
  MailApp.sendEmail({
    to: d.email,
    subject: (kind === 'REMINDER' ? 'เตือนคิววันพรุ่งนี้ ' : kind === 'RECEIVED' ? 'ได้รับคำขอจอง ' : 'ยืนยันการจอง ') + bookingId + ' · ' + BRAND,
    htmlBody: html,
    name: BRAND
  });
}

function sendConfirmationEmail(bookingId, d) {
  sendBookingEmail('CONFIRM', bookingId, d);
}

// เตือนลูกค้าล่วงหน้า 1 วัน (รันอัตโนมัติด้วย trigger — ดู setupReminderTrigger)
function sendReminders() {
  const tz = Session.getScriptTimeZone();
  const t = new Date();
  t.setDate(t.getDate() + 1);
  const tomorrow = Utilities.formatDate(t, tz, 'yyyy-MM-dd');
  const sheet = getSheet('Bookings');
  readBookings()
    .filter(b => b.status === 'CONFIRMED' && b.booking_date === tomorrow && b.reminder_email !== 'SENT')
    .forEach(b => {
      let r = 'SENT';
      try { sendBookingEmail('REMINDER', b.booking_id, b); } catch (e) { r = 'FAILED'; }
      sheet.getRange(b.row, 13).setValue(r);
    });
}

// รันฟังก์ชันนี้ "ครั้งเดียว" จาก editor เพื่อตั้งให้ส่งเตือนทุกวัน 09:00
function setupReminderTrigger() {
  ScriptApp.newTrigger('sendReminders').timeBased().everyDays(1).atHour(9).create();
}

function resendEmail(d) {
  const user = authUser(d);
  if (!user) throw new Error('กรุณาเข้าสู่ระบบใหม่');
  const b = readBookings().find(b => b.booking_id === d.booking_id);
  if (!b || !canAccess(user, b.store_id)) throw new Error('ไม่พบรายการจอง');
  const kind = b.status === 'PENDING' ? 'RECEIVED' : 'CONFIRM';
  let r = 'SENT';
  try { sendBookingEmail(kind, b.booking_id, b); } catch (e) { r = 'FAILED'; }
  if (kind === 'CONFIRM') getSheet('Bookings').getRange(b.row, 12).setValue(r);
  if (r === 'FAILED') throw new Error('ส่งอีเมลไม่สำเร็จ: ตรวจสอบสิทธิ์ส่งอีเมลของสคริปต์หรืออีเมลลูกค้า');
  return jsonResponse({ success: true, confirmation_email: kind === 'CONFIRM' ? r : 'PENDING' });
}

/* ---------- วันจอง: จันทร์–ศุกร์ และไม่ใช่วันหยุด ---------- */

const TZ = 'Asia/Bangkok';
const MAX_ADVANCE_DAYS = 7; // จองล่วงหน้าได้ไม่เกินกี่วัน
// วันหยุดนักขัตฤกษ์: อ่านจากปฏิทินวันหยุดไทยของ Google (public iCal ไม่ต้อง subscribe)
const HOLIDAY_ICS_URL = 'https://calendar.google.com/calendar/ical/th.th%23holiday%40group.v.calendar.google.com/public/basic.ics';
const HOLIDAY_SHEET = 'Holidays'; // (ไม่บังคับ) แท็บวันหยุดเพิ่มเติมของบริษัท คอลัมน์ A = วันที่ เช่น 2026-12-31
let HOLIDAY_WARN = '';

function ymd(d) { return Utilities.formatDate(d, TZ, 'yyyy-MM-dd'); }

function loadIcsHolidays() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('ics_holidays');
  if (hit) return JSON.parse(hit);
  const res = UrlFetchApp.fetch(HOLIDAY_ICS_URL, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('โหลดปฏิทินวันหยุดไม่สำเร็จ (HTTP ' + res.getResponseCode() + ')');
  const text = res.getContentText().replace(/\r?\n[ \t]/g, '');
  const days = {};
  text.split('BEGIN:VEVENT').slice(1).forEach(block => {
    const s = /DTSTART[^:\n]*:(\d{8})/.exec(block);
    if (!s) return;
    const e = /DTEND[^:\n]*:(\d{8})/.exec(block);
    const p = v => Utilities.parseDate(v, TZ, 'yyyyMMdd');
    const start = p(s[1]);
    const end = e ? p(e[1]) : new Date(start.getTime() + 86400000);
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) days[ymd(d)] = true;
  });
  const list = Object.keys(days).sort();
  cache.put('ics_holidays', JSON.stringify(list), 21600);
  return list;
}

function holidaySet(fromStr, toStr) {
  const out = {};
  try {
    loadIcsHolidays().forEach(d => { out[d] = true; });
  } catch (err) {
    HOLIDAY_WARN = String(err.message || err);
  }
  try {
    const sh = book().getSheetByName(HOLIDAY_SHEET);
    if (sh) sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 1).getValues().forEach(r => {
      const v = r[0];
      if (v instanceof Date) out[ymd(v)] = true;
      else if (/^\d{4}-\d{2}-\d{2}$/.test(String(v).trim())) out[String(v).trim()] = true;
    });
  } catch (err) {}
  return Object.keys(out).filter(d => d >= fromStr && d <= toStr).sort();
}

// รันใน editor เพื่อทดสอบ/ขออนุญาตสิทธิ์: ดู Execution log ต้องเห็นรายการวันหยุดใน 90 วันข้างหน้า
function testHolidays() {
  const to = new Date();
  to.setDate(to.getDate() + 90);
  Logger.log(JSON.stringify(holidaySet(ymd(new Date()), ymd(to))) + ' | warn=' + HOLIDAY_WARN);
}

function checkBookableDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr))) throw new Error('รูปแบบวันที่ไม่ถูกต้อง');
  const lim = new Date();
  lim.setDate(lim.getDate() + MAX_ADVANCE_DAYS);
  if (dateStr < ymd(new Date())) throw new Error('ไม่สามารถจองย้อนหลังได้');
  if (dateStr > ymd(lim)) throw new Error('จองล่วงหน้าได้ไม่เกิน ' + MAX_ADVANCE_DAYS + ' วัน');
  const dow = Number(Utilities.formatDate(Utilities.parseDate(dateStr, TZ, 'yyyy-MM-dd'), TZ, 'u')); // 1=จ ... 7=อา
  if (dow >= 6) throw new Error('จองได้เฉพาะวันจันทร์–ศุกร์');
  if (holidaySet(dateStr, dateStr).length) throw new Error('วันดังกล่าวเป็นวันหยุด ไม่สามารถจองได้');
}

function getHolidays(from, to) {
  return jsonResponse({ success: true, holidays: holidaySet(from, to), warning: HOLIDAY_WARN });
}

/* ---------- พนักงานรายวัน (เจ้าของร้านกรอกสำหรับวันที่เปิดให้จอง) ---------- */

const STAFF_SHEET = 'Staff'; // Date | Store_ID | Staff_Name | Start_Time | End_Time | Updated_By | Updated_At

function staffSheet(repair) {
  const ss = book();
  let sh = ss.getSheetByName(STAFF_SHEET);
  const headers = ['Date', 'Store_ID', 'Staff_Name', 'Start_Time', 'End_Time', 'Updated_By', 'Updated_At'];

  if (!sh) {
    sh = ss.insertSheet(STAFF_SHEET);
    sh.appendRow(headers);
  } else if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
  } else if (repair) {
    // ตรวจ/เติมหัวคอลัมน์เฉพาะตอนบันทึก (ตอนอ่านข้ามขั้นนี้เพื่อให้เร็วขึ้น)
    // รองรับชีต Staff เดิม 5 คอลัมน์ โดยเติมเฉพาะหัวที่ว่าง ไม่เขียนทับข้อมูลเดิม
    const current = sh.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
    headers.forEach((header, i) => {
      if (!String(current[i] || '').trim()) sh.getRange(1, i + 1).setValue(header);
    });
  }
  return sh;
}

function staffRange() {
  const lim = new Date();
  lim.setDate(lim.getDate() + MAX_ADVANCE_DAYS);
  return [ymd(new Date()), ymd(lim)];
}

function staffRows(storeId, from, to) {
  const txt = (x, f) => x instanceof Date ? Utilities.formatDate(x, TZ, f) : String(x || '').trim();
  const v = staffSheet().getDataRange().getValues();
  v.shift();
  return v
    .map((r, i) => ({
      row: i + 2,
      date: txt(r[0], 'yyyy-MM-dd'),
      store_id: String(r[1] || '').trim(),
      name: String(r[2] || '').trim(),
      start: txt(r[3], 'HH:mm'),
      end: txt(r[4], 'HH:mm')
    }))
    .filter(x => x.date && x.store_id && x.name)
    .filter(x => !storeId || x.store_id === String(storeId))
    // from/to ไม่ระบุ = ไม่กรองช่วงวันที่ จึงอ่านประวัติย้อนหลังได้
    .filter(x => !from || x.date >= from)
    .filter(x => !to || x.date <= to)
    .sort((a, b) => (a.date + a.store_id + a.name).localeCompare(b.date + b.store_id + b.name));
}

function getStaff(d) {
  const user = authUser(d);
  if (!user) throw new Error('กรุณาเข้าสู่ระบบใหม่');
  if (user.role !== 'SUPER_ADMIN' && !user.store_id) {
    throw new Error('ไม่พบ store_id ของบัญชีผู้ใช้ กรุณาติดต่อผู้ดูแลระบบ');
  }
  // ร้านทั่วไปเห็นเฉพาะร้านตัวเอง | SUPER_ADMIN เห็นทุกร้าน (หรือเลือกร้านด้วย d.store_id)
  const targetStore = user.role === 'SUPER_ADMIN' ? String(d.store_id || '') : String(user.store_id);
  // ค่าเริ่มต้น: วันนี้ถึง MAX_ADVANCE_DAYS | all_dates: true = ข้อมูลทุกวัน | หรือระบุ from/to
  const allDates = d.all_dates === true || String(d.all_dates || '').toLowerCase() === 'true';
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value));
  if (d.from && !validDate(d.from)) throw new Error('วันที่เริ่มต้นไม่ถูกต้อง');
  if (d.to && !validDate(d.to)) throw new Error('วันที่สิ้นสุดไม่ถูกต้อง');
  const range = staffRange();
  const from = d.from ? String(d.from) : (allDates ? '' : range[0]);
  const to = d.to ? String(d.to) : (allDates ? '' : range[1]);
  if (from && to && from > to) throw new Error('วันที่เริ่มต้นต้องไม่อยู่หลังวันที่สิ้นสุด');
  return jsonResponse({ success: true, rows: staffRows(targetStore, from, to) });
}

// d.dates = รายการวันที่ที่ต้องการบันทึกด้วยรายชื่อชุดเดียวกัน, d.staff = [{name,start,end}]
function saveStaff(d) {
  const user = authUser(d);
  if (!user) throw new Error('กรุณาเข้าสู่ระบบใหม่');
  if (user.role === 'SUPER_ADMIN') throw new Error('บัญชีนี้ไม่ต้องบันทึกพนักงาน');
  const list = (d.staff || []).map(x => ({ name: String(x.name || '').trim(), start: String(x.start || ''), end: String(x.end || '') }));
  if (!list.length) throw new Error('กรุณากรอกพนักงานอย่างน้อย 1 คน');
  list.forEach(x => {
    if (!x.name) throw new Error('กรุณากรอกชื่อพนักงานให้ครบ');
    if (!/^\d{2}:\d{2}$/.test(x.start) || !/^\d{2}:\d{2}$/.test(x.end)) throw new Error('รูปแบบเวลาไม่ถูกต้อง');
    if (toMin(x.end) <= toMin(x.start)) throw new Error('เวลาเลิกงานต้องหลังเวลาเริ่มงาน (' + x.name + ')');
  });
  const dates = Array.from(new Set((d.dates && d.dates.length ? d.dates : [d.date]).map(String)));
  dates.forEach(x => {
    try { checkBookableDate(x); } catch (e) { throw new Error(x + ': ' + e.message); }
  });
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = staffSheet(true);
    const values = sh.getDataRange().getValues();
    for (let i = values.length - 1; i >= 1; i--) {
      const dt = values[i][0] instanceof Date ? ymd(values[i][0]) : String(values[i][0]);
      if (dates.indexOf(dt) >= 0 && values[i][1] === user.store_id) sh.deleteRow(i + 1);
    }
    const rows = [];
    dates.forEach(dt => list.forEach(x => rows.push([dt, user.store_id, x.name, x.start, x.end, user.username, new Date()])));
    const start = sh.getLastRow() + 1;
    sh.getRange(start, 1, rows.length, 5).setNumberFormat('@');
    sh.getRange(start, 1, rows.length, 7).setValues(rows);
  } finally {
    lock.releaseLock();
  }
  bumpStaffVersion(); // ล้างแคชผลเช็กพนักงานของลูกค้า
  const r = staffRange();
  return jsonResponse({ success: true, rows: staffRows(user.store_id, r[0], r[1]) });
}

/* ---------- พนักงานกับการจอง (ความจุ = จำนวนพนักงาน, พนักงานคนเดียวห้ามคิวซ้อนกัน) ---------- */

function contactText(storeId) {
  const p = String(lookup('Stores', storeId, 5) || '').trim();
  return p ? 'โปรดติดต่อเบอร์ร้าน ' + p : 'โปรดติดต่อร้านโดยตรง';
}

// พนักงานที่ร้านระบุไว้ของวันนั้น จัดกลุ่มตามชื่อ: [{name, shifts:[{s,e}]}]
function dayResources(storeId, date) {
  const m = {};
  staffRows(storeId, date, date).forEach(x => {
    (m[x.name] = m[x.name] || { name: x.name, shifts: [] }).shifts.push({ s: toMin(x.start), e: toMin(x.end) });
  });
  return Object.keys(m).map(k => m[k]);
}

function canTake(res, busyList, a, b) {
  return res.shifts.some(s => s.s <= a && b <= s.e) && !busyList.some(iv => a < iv.e && iv.s < b);
}

// ช่วงเวลาที่พนักงานแต่ละคนถูกจองไว้แล้ว: { name: [{s,e}] }
function busyMap(resources, storeId, date, dur) {
  const busy = {};
  resources.forEach(r => { busy[r.name] = []; });
  const unassigned = [];
  readBookings()
    .filter(b => b.store_id === storeId && b.booking_date === date && b.status !== 'CANCELLED')
    .sort((x, y) => toMin(x.booking_time) - toMin(y.booking_time))
    .forEach(b => {
      const iv = { s: toMin(b.booking_time), e: toMin(b.booking_time) + durOf(dur, b.service_id) };
      if (b.staff_name) { if (busy[b.staff_name]) busy[b.staff_name].push(iv); }
      else unassigned.push(iv);
    });
  // คิวเก่าที่ไม่ได้ระบุพนักงาน: จัดให้พนักงานที่ว่างคนแรก (คำนวณชั่วคราว ไม่เขียนลงชีต)
  unassigned.forEach(iv => {
    const r = resources.find(r => canTake(r, busy[r.name], iv.s, iv.e));
    if (r) busy[r.name].push(iv);
  });
  return busy;
}

// เลือกพนักงานที่ว่างตลอดช่วง [a,b) โดยกระจายงานให้คนที่คิวน้อยที่สุดก่อน
function pickStaff(resources, busy, a, b) {
  const free = resources.filter(r => canTake(r, busy[r.name], a, b));
  if (!free.length) return null;
  free.sort((x, y) => busy[x.name].length - busy[y.name].length);
  return free[0].name;
}

function staffVersion() { return CacheService.getScriptCache().get('staff_ver') || '0'; }
function bumpStaffVersion() { CacheService.getScriptCache().put('staff_ver', String(Date.now()), 21600); }

// วันที่ (ในช่วงที่เปิดจอง) ที่ร้านระบุพนักงานแล้ว — เปิดสาธารณะ ไม่ส่งชื่อพนักงาน
// แคช 5 นาที และถูกล้างทันทีเมื่อเจ้าของร้านบันทึกพนักงานใหม่
function getStoreStaff(d) {
  const storeId = String(d.store_id || '');
  const cache = CacheService.getScriptCache();
  const key = 'ss_' + staffVersion() + '_' + ymd(new Date()) + '_' + storeId;
  let out = cache.get(key);
  if (!out) {
    const r = staffRange();
    const counts = {};
    staffRows(storeId, r[0], r[1]).forEach(x => { counts[x.date] = (counts[x.date] || 0) + 1; });
    out = JSON.stringify({ success: true, dates: Object.keys(counts).sort(), counts: counts });
    cache.put(key, out, 300);
  }
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
}

// สถานะของแต่ละช่องเวลา (ทุก 30 นาที) สำหรับบริการที่เลือก: ok | short (ไม่พอสำหรับบริการ) | full (ไม่มีพนักงานว่าง)
function getAvailableSlots(d) {
  const storeId = String(d.store_id || '');
  const date = String(d.date || '');
  checkBookableDate(date);
  const dur = durMap();
  const ids = String(d.service_id || '').split(',').map(x => x.trim()).filter(Boolean);
  if (!ids.length || ids.some(id => !dur[id])) throw new Error('ไม่พบบริการที่เลือก');
  const mine = durOf(dur, d.service_id);
  const resources = dayResources(storeId, date);
  const busy = busyMap(resources, storeId, date, dur);
  const slots = {};
  for (let t = OPEN_MIN; t < CLOSE_MIN; t += 30) {
    let status = 'ok';
    if (t + mine > CLOSE_MIN || !pickStaff(resources, busy, t, t + mine)) {
      status = pickStaff(resources, busy, t, t + 30) ? 'short' : 'full';
    }
    slots[minToHm(t)] = status;
  }
  return jsonResponse({ success: true, open: resources.length > 0, staff: resources.length, slots: slots });
}

// ประวัติการจองของพนักงานแต่ละคน (เรียกหลังตรวจรหัสพนักงานฝั่งหน้าเว็บ)
// อีเมล/เบอร์โทรถูกปิดบังบางส่วน เพราะ API นี้เรียกโดยไม่ต้องล็อกอิน
function getEmployeeBookings(d) {
  const want = normId(d.emp_id);
  if (!want) throw new Error('กรุณาระบุรหัสพนักงาน');
  const dur = durMap();
  const all = readBookings();
  autoComplete(all, dur);
  const cancels = {};
  readLog().filter(x => x.to === 'CANCELLED').forEach(x => { cancels[x.booking_id] = x; });
  const bookings = all
    .filter(b => b.emp_id && normId(b.emp_id) === want)
    .map(b => Object.assign({}, b, {
      duration_minutes: durOf(dur, b.service_id),
      cancel_reason: cancels[b.booking_id] ? cancels[b.booking_id].reason : '',
      cancelled_by: cancels[b.booking_id] ? cancels[b.booking_id].by : '',
      email: maskEmail(b.email),
      phone: b.phone ? '******' + String(b.phone).slice(-4) : ''
    }))
    .sort((a, b) => (b.booking_date + b.booking_time).localeCompare(a.booking_date + a.booking_time));
  return jsonResponse({ success: true, bookings: bookings });
}

/* ---------- ประวัติสถานะ + เปลี่ยนสถานะอัตโนมัติ + ยกเลิกโดยผู้จอง ---------- */

const LOG_SHEET = 'Status_Log'; // Time | Booking_ID | Store_ID | From | To | By | Actor | Reason | Seen

function logSheet() {
  const ss = book();
  let sh = ss.getSheetByName(LOG_SHEET);
  if (!sh) {
    sh = ss.insertSheet(LOG_SHEET);
    sh.appendRow(['Time', 'Booking_ID', 'Store_ID', 'From', 'To', 'By', 'Actor', 'Reason', 'Seen', 'Email']);
  } else if (sh.getLastColumn() < 10) {
    sh.getRange(1, 10).setValue('Email');
  }
  return sh;
}

// by: USER (ผู้จอง) | OWNER (เจ้าของร้าน) | SYSTEM (อัตโนมัติ)
// Seen = NO เฉพาะเมื่อผู้จองยกเลิก (รอเจ้าของร้านกดรับทราบจากป๊อปอัพ)
function logStatus(b, from, to, by, actor, reason) {
  const sh = logSheet();
  sh.appendRow([
    Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'), b.booking_id, b.store_id, from, to, by, String(actor || ''),
    reason || '', (by === 'USER' && to === 'CANCELLED') ? 'NO' : 'YES', ''
  ]);
  return sh.getLastRow();
}

// สถานะการส่งอีเมลแจ้งยกเลิก: SENT | FAILED | NONE (ไม่มีอีเมลปลายทาง)
function setLogMail(row, mail) { logSheet().getRange(row, 10).setValue(mail); }

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// by = USER → แจ้งร้าน (อีเมลร้านอยู่ชีต Stores คอลัมน์ G, ใส่หลายอีเมลคั่นด้วย , ได้)
// by = OWNER → แจ้งผู้จอง (อีเมลของผู้จองในชีต Bookings)
function sendCancelEmail(b, by, reason) {
  const to = by === 'USER' ? String(lookup('Stores', b.store_id, 6) || '').trim() : String(b.email || '').trim();
  if (!to) return 'NONE';
  const store = lookup('Stores', b.store_id, 1);
  const end = minToHm(toMin(b.booking_time) + durOf(durMap(), b.service_id));
  const rows = [
    ['รหัสการจอง', b.booking_id], ['ร้าน', store], ['ผู้จอง', b.customer_name], ['บริการ', b.service_name],
    ['วัน-เวลา', thaiDate(b.booking_date) + ' · ' + b.booking_time + '–' + end],
    ['ยกเลิกโดย', by === 'USER' ? 'ผู้จอง' : 'ร้าน'], ['เหตุผล', reason]
  ].map(r =>
    '<tr><td style="padding:10px 0;color:#4e615b;border-top:1px solid #e1e8dc">' + esc(r[0]) +
    '</td><td style="padding:10px 0;text-align:right;border-top:1px solid #e1e8dc"><b>' + esc(r[1]) + '</b></td></tr>'
  ).join('');
  const title = by === 'USER' ? 'ผู้จองยกเลิกคิว' : 'ร้านยกเลิกคิวของคุณ';
  const html =
    '<div style="font-family:Tahoma,sans-serif;max-width:520px;margin:auto;border:1px solid #e1e8dc;border-radius:16px;overflow:hidden">' +
    '<div style="background:#0f3d33;color:#fff;padding:20px 28px;font-size:20px;font-weight:bold">' + esc(BRAND) + '</div>' +
    '<div style="padding:28px"><h2 style="margin:0 0 16px;color:#10241f">' + title + '</h2>' +
    '<table width="100%" cellspacing="0">' + rows + '</table></div></div>';
  MailApp.sendEmail({ to: to, subject: title + ' ' + b.booking_id + ' · ' + BRAND, htmlBody: html, name: BRAND });
  return 'SENT';
}

function readLog() {
  const txt = v => v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd HH:mm') : String(v);
  const v = logSheet().getDataRange().getValues();
  v.shift();
  return v
    .map((r, i) => ({ row: i + 2, time: txt(r[0]), booking_id: String(r[1]), store_id: String(r[2]), from: String(r[3]), to: String(r[4]),
      by: String(r[5]), actor: String(r[6]), reason: String(r[7] || ''), seen: String(r[8] || ''), mail: String(r[9] || '') }))
    .filter(x => x.booking_id);
}

// คิวที่ "ยืนยันแล้ว" และสิ้นสุดเวลาบริการแล้ว → เสร็จสิ้น (แก้ทั้งในชีตและในรายการที่ส่งเข้ามา)
// คิวที่ยังรอยืนยันจนเลยเวลา ไม่ถูกเปลี่ยนอัตโนมัติ (ร้านต้องตัดสินใจเอง)
function autoComplete(list, dur) {
  const now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
  const sh = getSheet('Bookings');
  list.filter(b => b.status === 'CONFIRMED').forEach(b => {
    const end = b.booking_date + ' ' + minToHm(toMin(b.booking_time) + durOf(dur, b.service_id));
    if (end <= now) {
      sh.getRange(b.row, 10).setValue('COMPLETED');
      logStatus(b, 'CONFIRMED', 'COMPLETED', 'SYSTEM', 'auto', '');
      b.status = 'COMPLETED';
    }
  });
}

// (ไม่บังคับ) ตั้ง trigger ให้เปลี่ยนสถานะเป็นเสร็จสิ้นทุก 10 นาที แม้ไม่มีใครเปิดเว็บ — รันครั้งเดียวจาก editor
function autoCompleteJob() { autoComplete(readBookings(), durMap()); }
function setupAutoCompleteTrigger() {
  ScriptApp.newTrigger('autoCompleteJob').timeBased().everyMinutes(10).create();
}

// ผู้จอง (พนักงาน) ยกเลิกคิวของตัวเอง ต้องระบุเหตุผล
function cancelMyBooking(d) {
  const want = normId(d.emp_id);
  if (!want) throw new Error('กรุณาระบุรหัสพนักงาน');
  const reason = String(d.reason || '').trim().slice(0, 300);
  if (!reason) throw new Error('กรุณาระบุเหตุผลการยกเลิก');
  const all = readBookings();
  autoComplete(all, durMap());
  const b = all.find(x => x.booking_id === d.booking_id && x.emp_id && normId(x.emp_id) === want);
  if (!b) throw new Error('ไม่พบรายการจอง');
  if (b.status !== 'PENDING' && b.status !== 'CONFIRMED') throw new Error('คิวนี้ไม่สามารถยกเลิกได้ (สถานะ: ' + b.status + ')');
  getSheet('Bookings').getRange(b.row, 10).setValue('CANCELLED');
  const lr = logStatus(b, b.status, 'CANCELLED', 'USER', b.emp_id, reason);
  let mail = 'FAILED';
  try { mail = sendCancelEmail(b, 'USER', reason); } catch (e) {}
  setLogMail(lr, mail);
  return jsonResponse({ success: true, mail: mail });
}

// เจ้าของร้านกด "รับทราบ" ที่ป๊อปอัพแจ้งยกเลิก
function ackCancellations(d) {
  const user = authUser(d);
  if (!user) throw new Error('กรุณาเข้าสู่ระบบใหม่');
  const ids = (d.ids || []).map(Number);
  const sh = logSheet();
  readLog().filter(x => ids.indexOf(x.row) >= 0 && canAccess(user, x.store_id)).forEach(x => sh.getRange(x.row, 9).setValue('YES'));
  return jsonResponse({ success: true });
}

/* ---------- Employee ---------- */

function normId(v) {
  const t = String(v || '').trim().toUpperCase();
  return /^\d+$/.test(t) ? t.replace(/^0+/, '') : t;
}

// หาแท็บพนักงานแบบไม่สนช่องว่างเกิน/ช่องว่างพิเศษ/ตัวพิมพ์ใหญ่เล็ก
function getEmpSheet() {
  const ss = SpreadsheetApp.openById(EMP_SPREADSHEET_ID);
  const norm = n => String(n).replace(/\s+/g, ' ').trim().toLowerCase();
  const sheet = ss.getSheets().find(s => norm(s.getName()) === norm(EMP_SHEET));
  if (!sheet) {
    throw new Error('ไม่พบชีต "' + EMP_SHEET + '" — แท็บที่สคริปต์เห็น: ' +
      ss.getSheets().map(s => '[' + s.getName() + ']').join(', '));
  }
  return sheet;
}

function findEmployee(code) {
  const want = normId(code);
  if (!want) return null;
  const sheet = getEmpSheet();
  const values = sheet.getDataRange().getValues();
  const head = values.shift().map(h => String(h).trim());
  const col = name => {
    const i = head.indexOf(name);
    if (i < 0) throw new Error('ไม่พบคอลัมน์ ' + name + ' ในชีต ' + EMP_SHEET);
    return i;
  };
  const iId = col('CODEMPID');
  const r = values.find(r => normId(r[iId]) === want);
  if (!r) return null;
  const get = name => String(r[col(name)] || '').trim();
  const combined = head.indexOf('FORMAT_NAME / COMPANY_CODE') >= 0;
  const company = combined
    ? get('FORMAT_NAME / COMPANY_CODE')
    : [get('FORMAT_NAME'), get('COMPANY_CODE') && '(' + get('COMPANY_CODE') + ')'].filter(String).join(' ');
  return {
    emp_id: String(r[iId]).trim(),
    company: company,
    full_name: (get('FIRST_NAME_LOCAL') + ' ' + get('LAST_NAME_LOCAL')).trim(),
    division: get('DIVISION_NAME'),
    department: get('DEPARTMENT_NAME'),
    email: get('EMAIL')
  };
}

// อีเมลที่ส่งกลับไปหน้าเว็บจะถูกปิดบังบางส่วน (อีเมลจริงใช้เฉพาะฝั่งเซิร์ฟเวอร์ตอนส่งยืนยัน)
function maskEmail(m) {
  const s = String(m || '');
  const at = s.indexOf('@');
  if (at < 1) return s ? '***' : '';
  const local = s.slice(0, at);
  return local.slice(0, local.length > 3 ? 2 : 1) + '***' + s.slice(at);
}

function verifyEmployee(d) {
  const e = findEmployee(d.emp_id);
  if (!e) throw new Error('ไม่พบรหัสพนักงานนี้ในระบบ');
  e.email = maskEmail(e.email);
  return jsonResponse({ success: true, employee: e });
}

/* ---------- Admin (เวอร์ชันง่าย: ส่ง username/password ทุก request) ---------- */

function authUser(d) {
  const values = getSheet('Users').getDataRange().getValues();
  values.shift();
  const r = values.find(r =>
    String(r[1]) === String(d.username) &&
    String(r[2]) === String(d.password) &&
    r[5] === 'ACTIVE');
  return r ? { username: r[1], role: r[3], store_id: r[4] || '' } : null;
}

function canAccess(user, storeId) {
  return user.role === 'SUPER_ADMIN' || user.store_id === storeId;
}

function login(d) {
  const user = authUser(d);
  if (!user) return jsonResponse({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
  return jsonResponse({ success: true, user });
}

function getBookings(d) {
  const user = authUser(d);
  if (!user) throw new Error('กรุณาเข้าสู่ระบบใหม่');
  const dur = durMap();
  const all = readBookings();
  autoComplete(all, dur); // คิวที่สิ้นสุดเวลาบริการแล้วเปลี่ยนเป็นเสร็จสิ้นอัตโนมัติ
  const log = readLog();
  const by = {};
  log.forEach(x => { (by[x.booking_id] = by[x.booking_id] || []).push(x); });
  const bookings = all
    .filter(b => canAccess(user, b.store_id))
    .filter(b => user.role !== 'SUPER_ADMIN' || !d.store_id || b.store_id === d.store_id)
    .sort((a, b) => (a.booking_date + a.booking_time).localeCompare(b.booking_date + b.booking_time));
  bookings.forEach(b => {
    const h = by[b.booking_id] || [];
    const c = h.filter(x => x.to === 'CANCELLED').pop();
    b.duration_minutes = durOf(dur, b.service_id);
    b.history = h.map(x => ({ time: x.time, to: x.to, by: x.by, actor: x.actor, reason: x.reason, mail: x.mail }));
    b.cancel_reason = c ? c.reason : '';
    b.cancelled_by = c ? c.by : '';
    b.cancelled_actor = c ? c.actor : '';
    b.cancelled_at = c ? c.time : '';
    b.cancel_mail = c ? c.mail : '';
  });
  // แจ้งเตือนเจ้าของร้านเมื่อผู้จองยกเลิก (ยังไม่กดรับทราบ)
  const byId = {};
  bookings.forEach(b => { byId[b.booking_id] = b; });
  const alerts = user.role === 'SUPER_ADMIN' ? [] : log
    .filter(x => x.to === 'CANCELLED' && x.by === 'USER' && x.seen !== 'YES' && byId[x.booking_id])
    .map(x => {
      const b = byId[x.booking_id];
      return { log_row: x.row, booking_id: x.booking_id, reason: x.reason, time: x.time,
        customer_name: b.customer_name, service_name: b.service_name, booking_date: b.booking_date, booking_time: b.booking_time };
    });
  return jsonResponse({ success: true, bookings, alerts });
}

// เจ้าของร้าน: รอยืนยัน → ยืนยันแล้ว | รอยืนยัน/ยืนยันแล้ว → ยกเลิก (ต้องระบุเหตุผล)
// "เสร็จสิ้น" ระบบเปลี่ยนให้เองเมื่อสิ้นสุดเวลาบริการ
function updateStatus(d) {
  const user = authUser(d);
  if (!user) throw new Error('กรุณาเข้าสู่ระบบใหม่');
  const all = readBookings();
  autoComplete(all, durMap());
  const b = all.find(b => b.booking_id === d.booking_id);
  if (!b || !canAccess(user, b.store_id)) throw new Error('ไม่พบรายการจอง');
  const to = String(d.status || '');
  const allowed = { PENDING: ['CONFIRMED', 'CANCELLED'], CONFIRMED: ['CANCELLED'] };
  if ((allowed[b.status] || []).indexOf(to) < 0) throw new Error('ไม่สามารถเปลี่ยนสถานะนี้ได้ (' + b.status + ' → ' + to + ')');
  const reason = String(d.reason || '').trim().slice(0, 300);
  if (to === 'CANCELLED' && !reason) throw new Error('กรุณาระบุเหตุผลการยกเลิก');
  const sh = getSheet('Bookings');
  sh.getRange(b.row, 10).setValue(to);
  const lr = logStatus(b, b.status, to, 'OWNER', user.username, reason);
  let mail = '';
  let cancelMail = '';
  if (to === 'CANCELLED') {
    cancelMail = 'FAILED';
    try { cancelMail = sendCancelEmail(b, 'OWNER', reason); } catch (e) {}
    setLogMail(lr, cancelMail);
  }
  if (to === 'CONFIRMED') {
    mail = 'SENT';
    try { sendBookingEmail('CONFIRM', b.booking_id, b); } catch (e) { mail = 'FAILED'; }
    sh.getRange(b.row, 12).setValue(mail);
  }
  return jsonResponse({ success: true, status: to, confirmation_email: mail, cancel_mail: cancelMail });
}

/* ---------- Helpers ---------- */

const OPEN_MIN = 8 * 60, CLOSE_MIN = 20 * 60; // เวลาทำการ 08:00–20:00

function toMin(t) { const p = String(t).split(':'); return Number(p[0]) * 60 + Number(p[1]); }
function minToHm(n) { return ('0' + Math.floor(n / 60)).slice(-2) + ':' + ('0' + (n % 60)).slice(-2); }

// service_id -> ระยะเวลา (นาที)
function durMap() {
  const v = getSheet('Services').getDataRange().getValues();
  v.shift();
  const m = {};
  v.forEach(r => { m[r[0]] = Number(r[3]) || 60; });
  return m;
}

// รวมระยะเวลาของหลายบริการ (service_id คั่นด้วย ,)
function durOf(dur, ids) {
  const sum = String(ids).split(',').reduce((a, id) => a + (dur[id.trim()] || 0), 0);
  return sum || 60;
}

function readBookings() {
  const tz = Session.getScriptTimeZone();
  const txt = (v, f) => v instanceof Date ? Utilities.formatDate(v, tz, f) : String(v);
  const values = getSheet('Bookings').getDataRange().getValues();
  values.shift();
  return values.map((r, i) => ({
    row: i + 2,
    booking_id: r[0], store_id: r[1], customer_name: r[2], email: r[3],
    phone: String(r[4]), service_id: r[5], service_name: r[6],
    booking_date: txt(r[7], 'yyyy-MM-dd'), booking_time: txt(r[8], 'HH:mm'),
    status: r[9], created_at: txt(r[10], 'yyyy-MM-dd HH:mm'),
    confirmation_email: r[11], reminder_email: r[12],
    emp_id: String(r[14] || ''), company: String(r[15] || ''),
    division: String(r[16] || ''), department: String(r[17] || ''),
    staff_name: String(r[18] || '')
  }));
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}