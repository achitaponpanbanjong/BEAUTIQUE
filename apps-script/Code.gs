const SPREADSHEET_ID = '1zB_RnNQoS6NkSLibdYKlqu-bGxMwi7M31B-lRHM4fo8';
const BRAND = '[ชื่อแบรนด์]';
const STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];

function getSheet(name) {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
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
      case 'getStaff':       return getStaff(data);
      case 'saveStaff':      return saveStaff(data);
      case 'createBooking':  return createBooking(data);
      case 'login':          return login(data);
      case 'getBookings':    return getBookings(data);
      case 'getEmployeeBookings': return getEmployeeBookings(data);
      case 'updateStatus':   return updateStatus(data);
      case 'resendEmail':    return resendEmail(data);
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
      external_booking_url: row[3]
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
  const staff = readStaff()
    .filter(s => s.store_id === storeId && s.date === date)
    .map(s => ({ name: s.name, start: s.start, end: s.end }));
  if (!staff.length) return jsonResponse({ success: true, times: [], busy: [], staff: [], closed: true });

  // Return intervals, not just start times, so the client can safely check
  // capacity against every working staff member for the full service duration.
  const services = getSheet('Services').getDataRange().getValues();
  services.shift();
  const durationById = {};
  services.forEach(r => { durationById[String(r[0])] = Number(r[3]) || 60; });
  const busy = readBookings()
    .filter(b => b.store_id === storeId && b.booking_date === date && b.status !== 'CANCELLED')
    .map(b => {
      const duration = String(b.service_id || '').split(',').reduce((n, id) => n + (durationById[id] || 0), 0) || 60;
      const parts = String(b.booking_time).split(':');
      const end = Number(parts[0]) * 60 + Number(parts[1]) + duration;
      return { start: b.booking_time, end: String(Math.floor(end / 60)).padStart(2, '0') + ':' + String(end % 60).padStart(2, '0') };
    });
  return jsonResponse({ success: true, times: busy.map(x => x.start), busy: busy, staff: staff, closed: false });
}

/* ---------- Daily staff ---------- */

// Sheet schema: date | store_id | name | start | end
// This is intentionally separate from the employee master: it records who is
// working on a particular date, while the master records every employee.
function getStaffSheet() {
  const book = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = book.getSheetByName('Staff');
  if (!sheet) {
    sheet = book.insertSheet('Staff');
    sheet.appendRow(['date', 'store_id', 'name', 'start', 'end']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function readStaff() {
  const sheet = getStaffSheet();
  if (sheet.getLastRow() < 2) return [];
  const tz = Session.getScriptTimeZone();
  const date = v => v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : String(v);
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues()
    .map((r, i) => ({ row: i + 2, date: date(r[0]), store_id: String(r[1]), name: String(r[2]), start: String(r[3]), end: String(r[4]) }))
    .filter(r => r.date && r.store_id && r.name);
}

function getStaff(d) {
  const user = authUser(d);
  if (!user) throw new Error('กรุณาเข้าสู่ระบบใหม่');
  const rows = readStaff()
    .filter(x => canAccess(user, x.store_id))
    .filter(x => user.role !== 'SUPER_ADMIN' || !d.store_id || x.store_id === d.store_id)
    .sort((a, b) => (a.date + a.store_id + a.name).localeCompare(b.date + b.store_id + b.name));
  return jsonResponse({ success: true, rows: rows });
}

function saveStaff(d) {
  const user = authUser(d);
  if (!user) throw new Error('กรุณาเข้าสู่ระบบใหม่');
  if (user.role === 'SUPER_ADMIN' || !user.store_id) throw new Error('ต้องเลือกบัญชีผู้ดูแลร้านเพื่อบันทึกพนักงาน');

  const dates = [...new Set((d.dates || []).map(String))];
  const staff = (d.staff || []).map(x => ({
    name: String(x.name || '').trim(), start: String(x.start || ''), end: String(x.end || '')
  }));
  if (!dates.length || !dates.every(x => /^\d{4}-\d{2}-\d{2}$/.test(x))) throw new Error('วันที่ไม่ถูกต้อง');
  if (!staff.length || staff.some(x => !x.name || !/^\d\d:\d\d$/.test(x.start) || !/^\d\d:\d\d$/.test(x.end) || x.start >= x.end)) throw new Error('ข้อมูลพนักงานหรือเวลาทำงานไม่ถูกต้อง');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getStaffSheet();
    const rows = readStaff();
    // Delete only the selected store and dates, then append their replacement.
    rows.filter(x => x.store_id === user.store_id && dates.includes(x.date))
      .sort((a, b) => b.row - a.row).forEach(x => sheet.deleteRow(x.row));
    const values = dates.flatMap(date => staff.map(x => [date, user.store_id, x.name, x.start, x.end]));
    sheet.getRange(sheet.getLastRow() + 1, 1, values.length, 5).setValues(values);
  } finally {
    lock.releaseLock();
  }
  return getStaff({ username: d.username, password: d.password });
}

function createBooking(data) {
  ['store_id', 'customer_name', 'email', 'phone', 'service_id', 'service_name', 'booking_date', 'booking_time']
    .forEach(k => { if (!data[k]) throw new Error('ข้อมูลไม่ครบ: ' + k); });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const requestedStart = String(data.booking_time).split(':');
    const start = Number(requestedStart[0]) * 60 + Number(requestedStart[1]);
    const duration = Number(data.duration_minutes) || 60;
    const end = start + duration;
    const staff = readStaff().filter(s => s.store_id === data.store_id && s.date === data.booking_date);
    if (!staff.length) throw new Error('ร้านปิดในวันที่เลือก เนื่องจากยังไม่ได้ระบุพนักงานประจำวัน กรุณาติดต่อร้านโดยตรง');

    const activeBookings = readBookings().filter(b => b.store_id === data.store_id && b.booking_date === data.booking_date && b.status !== 'CANCELLED');
    const serviceRows = getSheet('Services').getDataRange().getValues();
    serviceRows.shift();
    const durationById = {};
    serviceRows.forEach(r => { durationById[String(r[0])] = Number(r[3]) || 60; });
    const intervals = activeBookings.map(b => {
      const p = String(b.booking_time).split(':');
      const bookingStart = Number(p[0]) * 60 + Number(p[1]);
      const bookingDuration = String(b.service_id || '').split(',').reduce((n, id) => n + (durationById[id] || 0), 0) || 60;
      return { start: bookingStart, end: bookingStart + bookingDuration };
    });
    for (let minute = start; minute < end; minute += 30) {
      const working = staff.filter(s => {
        const a = String(s.start).split(':'), z = String(s.end).split(':');
        return Number(a[0]) * 60 + Number(a[1]) <= minute && Number(z[0]) * 60 + Number(z[1]) >= minute + 30;
      }).length;
      const busy = intervals.filter(b => b.start < minute + 30 && minute < b.end).length;
      if (!working || busy >= working) throw new Error('ช่วงเวลานี้มีพนักงานดูแลครบทุกคนแล้ว กรุณาเลือกเวลาอื่น');
    }

    const sheet = getSheet('Bookings');
    const bookingId = 'BK' + Utilities.formatString('%04d', sheet.getLastRow());

    sheet.appendRow([
      bookingId, data.store_id, data.customer_name, data.email, data.phone,
      data.service_id, data.service_name, data.booking_date, data.booking_time,
      'CONFIRMED', new Date(), 'PENDING', 'PENDING'
    ]);

    // กัน Sheets แปลงเป็นตัวเลข/วันที่ (เช่น เบอร์ 08… เหลือ 8…)
    const row = sheet.getLastRow();
    [[5, data.phone], [8, data.booking_date], [9, data.booking_time]].forEach(([col, v]) =>
      sheet.getRange(row, col).setNumberFormat('@').setValue(String(v)));

    let mail = 'SENT';
    try { sendConfirmationEmail(bookingId, data); } catch (err) { mail = 'FAILED'; }
    sheet.getRange(row, 12).setValue(mail);

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
  const price = lookup('Services', d.service_id, 4);
  const title = kind === 'REMINDER' ? 'พรุ่งนี้คุณมีคิวจองกับเรา' : 'การจองของคุณได้รับการยืนยันแล้ว';
  const rows = [
    ['รหัสการจอง', bookingId], ['ร้าน', store], ['บริการ', d.service_name],
    ['วัน-เวลา', thaiDate(d.booking_date) + ' · ' + d.booking_time], ['ราคา', '฿' + price]
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
    '<p style="color:#4e615b;font-size:14px;margin-top:20px">หากต้องการเปลี่ยนหรือยกเลิก กรุณาติดต่อร้านก่อนเวลานัด</p></div></div>';
  MailApp.sendEmail({
    to: d.email,
    subject: (kind === 'REMINDER' ? 'เตือนคิววันพรุ่งนี้ ' : 'ยืนยันการจอง ') + bookingId + ' · ' + BRAND,
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
  let r = 'SENT';
  try { sendBookingEmail('CONFIRM', b.booking_id, b); } catch (e) { r = 'FAILED'; }
  getSheet('Bookings').getRange(b.row, 12).setValue(r);
  if (r === 'FAILED') throw new Error('ส่งอีเมลไม่สำเร็จ: ตรวจสอบสิทธิ์ส่งอีเมลของสคริปต์หรืออีเมลลูกค้า');
  return jsonResponse({ success: true, confirmation_email: r });
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
  const bookings = readBookings()
    .filter(b => canAccess(user, b.store_id))
    .filter(b => user.role !== 'SUPER_ADMIN' || !d.store_id || b.store_id === d.store_id)
    .sort((a, b) => (a.booking_date + a.booking_time).localeCompare(b.booking_date + b.booking_time));
  return jsonResponse({ success: true, bookings });
}

// Employee self-service history. The web client calls this only after the
// employee has been verified through the employee-login flow.
function getEmployeeBookings(d) {
  if (!d.emp_id) throw new Error('กรุณาระบุรหัสพนักงาน');
  const bookings = readBookings()
    .filter(b => String(b.emp_id || '') === String(d.emp_id))
    .sort((a, b) => (b.booking_date + b.booking_time).localeCompare(a.booking_date + a.booking_time));
  return jsonResponse({ success: true, bookings: bookings });
}

function updateStatus(d) {
  const user = authUser(d);
  if (!user) throw new Error('กรุณาเข้าสู่ระบบใหม่');
  if (STATUSES.indexOf(d.status) < 0) throw new Error('สถานะไม่ถูกต้อง');
  const b = readBookings().find(b => b.booking_id === d.booking_id);
  if (!b || !canAccess(user, b.store_id)) throw new Error('ไม่พบรายการจอง');
  getSheet('Bookings').getRange(b.row, 10).setValue(d.status);
  return jsonResponse({ success: true });
}

/* ---------- Helpers ---------- */

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
    confirmation_email: r[11], reminder_email: r[12], emp_id: r[13] || ''
  }));
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
