/**
 * EduTrack Google Apps Script - VERSION 4.1 (FIXED)
 * 
 * PRESERVES ALL ORIGINAL FUNCTIONS:
 * - All CRUD operations
 * - Active user tracking
 * - Teacher authentication  
 * - Activity logging (FIXED: no system recursion)
 * - Backup system
 * - Data migration tools
 * - Bulk operations
 * And much more!
 * 
 * VERSION 4.1 FIXES:
 * - Added GET handlers for logActivity, getRecentActivities, getActivitySummary
 * - Added deleteTeacher, deleteStaff GET handlers
 * - ActivityLog only logs teacher/admin actions (not system/guest)
 * - User info passed from frontend for activity logging
 * - Recent activities properly returns data from ActivityLog sheet
 */

// ==================== CONFIGURATION ====================
const SCRIPT_VERSION = '4.0.0';
const CACHE_DURATION = 300;
const CACHE_MAX_VALUE_SIZE = 95000;
const MAX_RETRIES = 3;
const BATCH_SIZE = 500;
const BACKUP_RETENTION_DAYS = 30;
const MAX_LOG_ENTRIES = 5000;

const SHEET_NAMES = {
  STUDENTS: 'Students',
  ASSESSMENTS: 'Assessments',
  ATTENDANCE: 'Attendance',
  TEACHERS: 'Teachers',
  STAFF: 'Staff',
  PAYMENTS: 'Payments',
  ACTIVITY: 'Activity',  // For tracking active users
  TEACHER_CREDENTIALS: 'TeacherCredentials',  // For teacher login credentials
  ACTIVITY_LOG: 'ActivityLog',  // For logging all user activities
  BACKUP_METADATA: 'Backup_Metadata',  // Track backups
  SYNC_STATUS: 'SyncStatus',  // Track sync operations
  PARENTS: 'Parents',
  CALENDAR: 'Calendar',
  SETTINGS: 'Settings'  // For app settings (fee structures, etc.)
};

// Rate limiting configuration
const RATE_LIMIT = {
  MAX_REQUESTS_PER_MINUTE: 60,
  MAX_REQUESTS_PER_HOUR: 1000
};

var RATE_LIMIT_STORAGE = {
  requests: [],
  reset: function() {
    const oneHourAgo = Date.now() - 3600000;
    this.requests = this.requests.filter(t => t > oneHourAgo);
  },
  canProceed: function() {
    this.reset();
    const oneMinuteAgo = Date.now() - 60000;
    const recentRequests = this.requests.filter(t => t > oneMinuteAgo).length;
    
    if (recentRequests >= RATE_LIMIT.MAX_REQUESTS_PER_MINUTE) {
      return false;
    }
    if (this.requests.length >= RATE_LIMIT.MAX_REQUESTS_PER_HOUR) {
      return false;
    }
    this.requests.push(Date.now());
    return true;
  }
};

// Column headers for each sheet
const STUDENT_HEADERS = ['id', 'name', 'grade', 'stream', 'admissionNo', 'admissionDate', 'upiNo', 'assessmentNo', 'parentContact', 'category', 'previousArrears', 'selectedFees', 'religion', 'portraitUrl'];
const ASSESSMENT_HEADERS = ['id', 'studentId', 'studentAdmissionNo', 'studentName', 'grade', 'subject', 'score', 'term', 'examType', 'academicYear', 'date', 'level', 'rawScore', 'maxScore'];
const ATTENDANCE_HEADERS = ['id', 'studentId', 'date', 'status', 'term', 'academicYear'];
const TEACHER_HEADERS = ['id', 'name', 'contact', 'subjects', 'grades', 'employeeNo', 'nssfNo', 'shifNo', 'taxNo', 'isClassTeacher', 'classTeacherGrade'];
const STAFF_HEADERS = ['id', 'name', 'role', 'contact', 'employeeNo', 'nssfNo', 'shifNo', 'taxNo'];
const PAYMENT_HEADERS = ['id', 'studentId', 'studentName', 'amount', 'term', 'academicYear', 'date', 'receiptNo', 'method', 'reference', 'items', 'voided', 'voidedAt', 'voidedBy', 'voidReason'];
const TEACHER_CREDENTIALS_HEADERS = ['username', 'passwordHash', 'teacherId', 'name', 'role', 'createdAt', 'lastLogin', 'subjects', 'grades', 'classTeacherGrade', 'religion'];
const ACTIVITY_LOG_HEADERS = ['id', 'userId', 'userName', 'userRole', 'action', 'module', 'recordId', 'recordName', 'details', 'timestamp', 'ipAddress'];
const BACKUP_METADATA_HEADERS = ['backupName', 'sheetName', 'createdAt', 'recordCount'];
const SYNC_STATUS_HEADERS = ['lastSyncTime', 'syncType', 'recordCount', 'status', 'errorMessage'];
const PARENT_HEADERS = ['id', 'admissionNo', 'name', 'contact', 'email', 'createdAt', 'lastLogin'];
const CALENDAR_HEADERS = ['id', 'title', 'start', 'end', 'type', 'details', 'term', 'academicYear'];
const SETTINGS_HEADERS = ['key', 'value', 'updatedAt', 'updatedBy'];

// Cache for frequently accessed data
const dataCache = CacheService.getScriptCache();

// ==================== RATE LIMITING ====================

function checkRateLimit() {
  if (!RATE_LIMIT_STORAGE.canProceed()) {
    return { success: false, error: 'Rate limit exceeded. Please try again later.' };
  }
  return null;
}

// ==================== SHEET INITIALIZATION ====================

function initializeSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetsCreated = [];
  
  const sheetsConfig = [
    { name: SHEET_NAMES.STUDENTS, headers: STUDENT_HEADERS },
    { name: SHEET_NAMES.ASSESSMENTS, headers: ASSESSMENT_HEADERS },
    { name: SHEET_NAMES.ATTENDANCE, headers: ATTENDANCE_HEADERS },
    { name: SHEET_NAMES.TEACHERS, headers: TEACHER_HEADERS },
    { name: SHEET_NAMES.STAFF, headers: STAFF_HEADERS },
    { name: SHEET_NAMES.PAYMENTS, headers: PAYMENT_HEADERS },
    { name: SHEET_NAMES.ACTIVITY, headers: ['device', 'lastActivity', 'timestamp'] },
    { name: SHEET_NAMES.TEACHER_CREDENTIALS, headers: TEACHER_CREDENTIALS_HEADERS },
    { name: SHEET_NAMES.ACTIVITY_LOG, headers: ACTIVITY_LOG_HEADERS },
    { name: SHEET_NAMES.BACKUP_METADATA, headers: BACKUP_METADATA_HEADERS },
    { name: SHEET_NAMES.SYNC_STATUS, headers: SYNC_STATUS_HEADERS },
    { name: SHEET_NAMES.PARENTS, headers: PARENT_HEADERS },
    { name: SHEET_NAMES.CALENDAR, headers: CALENDAR_HEADERS },
    { name: SHEET_NAMES.SETTINGS, headers: SETTINGS_HEADERS }
  ];
  
  sheetsConfig.forEach(config => {
    let sheet = ss.getSheetByName(config.name);
    if (!sheet) {
      sheet = ss.insertSheet(config.name);
      sheet.appendRow(config.headers);
      const headerRange = sheet.getRange(1, 1, 1, config.headers.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#4285f4');
      headerRange.setFontColor('#ffffff');
      sheetsCreated.push(config.name);
    } else {
      updateSheetHeaders(sheet, config.headers);
    }
  });
  
  return { success: true, message: 'Sheets initialized', created: sheetsCreated };
}

function updateSheetHeaders(sheet, expectedHeaders) {
  if (!sheet) return false;
  
  try {
    const headerRange = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn()));
    const headerValues = headerRange.getValues()[0];
    const currentHeaders = headerValues.map(function(h) { return String(h || '').trim(); });
    
    let lastCol = sheet.getLastColumn();
    let headersAdded = false;
    
    expectedHeaders.forEach(function(header) {
      if (currentHeaders.indexOf(header) === -1) {
        if (lastCol === 0) {
          sheet.getRange(1, 1).setValue(header);
          lastCol = 1;
        } else {
          sheet.insertColumnAfter(lastCol);
          sheet.getRange(1, lastCol + 1).setValue(header);
          lastCol++;
        }
        headersAdded = true;
      }
    });
    
    return headersAdded;
  } catch (error) {
    console.error('Update headers error:', error);
    return false;
  }
}

function getSheetHealthCheck() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetsCheck = {};
  
  const sheetsToCheck = [
    SHEET_NAMES.STUDENTS,
    SHEET_NAMES.ASSESSMENTS,
    SHEET_NAMES.TEACHERS,
    SHEET_NAMES.STAFF,
    SHEET_NAMES.PAYMENTS,
    SHEET_NAMES.ATTENDANCE
  ];
  
  sheetsToCheck.forEach(function(sheetName) {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();
      const firstRow = lastRow > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
      sheetsCheck[sheetName] = {
        exists: true,
        rows: lastRow,
        columns: lastCol,
        hasHeaders: firstRow.length > 0 && firstRow[0] !== ''
      };
    } else {
      sheetsCheck[sheetName] = { exists: false, rows: 0, columns: 0, hasHeaders: false };
    }
  });
  
  return sheetsCheck;
}

// ==================== CORE CRUD OPERATIONS ====================

function getAllRecords(sheetName, headers, useCache = true) {
  const cacheKey = `records_${sheetName}`;
  
  if (useCache) {
    const cached = dataCache.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {}
    }
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) return [];
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  
  const data = sheet.getDataRange().getValues();
  const seenIds = new Set();
  const results = [];
  
  for (let rowIndex = 1; rowIndex < data.length; rowIndex++) {
    const row = data[rowIndex];
    let obj = {};
    let idValue = null;
    
    for (let colIndex = 0; colIndex < headers.length; colIndex++) {
      const header = headers[colIndex];
      let value = row[colIndex];
      
      if (header === 'id') {
        idValue = String(value || '').trim();
      }
      
      if (header === 'selectedFees' && typeof value === 'string' && value.includes('java.lang.Object')) {
        value = 't1,t2,t3';
      }
      
      if (value && value instanceof Date) {
        value = value.toISOString();
      } else if (value && typeof value === 'object') {
        value = String(value).includes('java.lang') ? '' : JSON.stringify(value);
      }
      
      obj[header] = value;
    }
    
    if (sheetName === SHEET_NAMES.ASSESSMENTS) {
      obj.studentId = String(obj.studentId || '');
      obj.studentAdmissionNo = String(obj.studentAdmissionNo || '');
      obj.studentName = String(obj.studentName || '');
    }
    
    // Ensure we have an ID for the record - generate one if manual entry is missing ID
    if (!idValue) {
      idValue = 'AUTO-' + sheetName.substring(0,3).toUpperCase() + '-' + rowIndex;
      obj.id = idValue;
    }
    
    if (!seenIds.has(idValue)) {
      const headerNames = ['id', 'name', 'grade', 'stream', 'admissionNo', 'parentContact', 'selectedFees', 
                          'studentId', 'studentAdmissionNo', 'studentName', 'subject', 'score', 'term',
                          'examType', 'academicYear', 'date', 'level', 'status'];
      
      // Safety check: skip if ID is actually a header name (case-insensitive)
      if (headerNames.indexOf(idValue.toLowerCase()) === -1) {
        seenIds.add(idValue);
        results.push(obj);
      }
    }
  }
  
  if (useCache) {
    try {
      const serialized = JSON.stringify(results);
      if (serialized.length <= CACHE_MAX_VALUE_SIZE) {
        dataCache.put(cacheKey, serialized, CACHE_DURATION);
      } else {
        console.log(`[Cache] Skipping cache for ${sheetName}: payload too large (${serialized.length} chars)`);
      }
    } catch (cacheError) {
      console.warn(`[Cache] Failed to cache ${sheetName}: ${cacheError.message}`);
    }
  }
  
  return results;
}

function getAllIds(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) return { ids: [] };
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { ids: [] };
  
  const data = sheet.getDataRange().getValues();
  const ids = [];
  
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][0] || '').trim();
    if (id && id !== 'id') {
      ids.push(id);
    }
  }
  
  return { ids: ids };
}

function addRecord(sheetName, record, headers, userId = null, userName = null, userRole = null) {
  console.log('[addRecord] Starting for sheet:', sheetName);
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    console.log('[addRecord] Creating new sheet:', sheetName);
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
  }
  
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    console.log('[addRecord] Lock error:', e.message);
    return { success: false, error: 'Could not obtain script lock: ' + e.message };
  }

  try {
    console.log('[addRecord] Record before processing:', record);
    
    if (!record.id) {
      if (sheetName === SHEET_NAMES.STUDENTS && record.admissionNo) {
        record.id = record.admissionNo;
      } else {
        record.id = 'REC-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      }
    }
    
    console.log('[addRecord] Record ID after processing:', record.id);

    const idIndex = headers.indexOf('id');
    const admissionIndex = sheetName === SHEET_NAMES.STUDENTS ? headers.indexOf('admissionNo') : -1;
    
    if (idIndex === -1) {
      console.log('[addRecord] ERROR: No id column in headers');
      return { success: false, error: 'Table headers missing "id" field' };
    }

    const data = sheet.getDataRange().getValues();
    console.log('[addRecord] Sheet has', data.length, 'rows');
    
    let rowIndex = -1;

    for (let i = 1; i < data.length; i++) {
      const rowId = String(data[i][idIndex] || '').trim();
      const searchId = String(record.id).trim();
      
      let admissionMatch = false;
      if (sheetName === SHEET_NAMES.STUDENTS && admissionIndex >= 0) {
        const rowAdm = String(data[i][admissionIndex] || '').trim();
        const searchAdm = String(record.admissionNo || '').trim();
        if (searchAdm && rowAdm === searchAdm) admissionMatch = true;
      }

      if (rowId === searchId || admissionMatch) {
        rowIndex = i + 1;
        console.log('[addRecord] Found existing row:', rowIndex);
        break;
      }
    }

    const rowValues = headers.map(header => {
      let val = record[header];
      if (val === undefined || val === null) return '';
      if (typeof val === 'object') return JSON.stringify(val);
      return val;
    });
    
    console.log('[addRecord] Row values:', rowValues);

    let action = 'ADD';
    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowValues]);
      action = 'UPDATE';
      console.log('[addRecord] Updated row:', rowIndex);
    } else {
      sheet.appendRow(rowValues);
      action = 'ADD';
      console.log('[addRecord] Added new row');
    }
    
    dataCache.remove(`records_${sheetName}`);
    
    // ONLY log if it's a teacher or admin action
    if (userId && userRole && (userRole === 'teacher' || userRole === 'admin')) {
      let recordName = record.title || record.name || record.studentName || record.studentAdmissionNo || '';
      
      // If no name (e.g. for payments/assessments), try looking up the student in the Students sheet
      if (!recordName && (sheetName === SHEET_NAMES.PAYMENTS || sheetName === SHEET_NAMES.ASSESSMENTS)) {
        const studentId = record.studentId || record.studentAdmissionNo;
        if (studentId) {
          const studentSheet = ss.getSheetByName(SHEET_NAMES.STUDENTS);
          if (studentSheet) {
            const studentData = studentSheet.getDataRange().getValues();
            const idIdx = STUDENT_HEADERS.indexOf('id');
            const admIdx = STUDENT_HEADERS.indexOf('admissionNo');
            const nameIdx = STUDENT_HEADERS.indexOf('name');
            
            for (let i = 1; i < studentData.length; i++) {
              if (String(studentData[i][idIdx]) === String(studentId) || 
                  String(studentData[i][admIdx]) === String(studentId)) {
                recordName = studentData[i][nameIdx];
                break;
              }
            }
          }
        }
      }
      
      if (!recordName) recordName = record.id || 'Unknown';

      logUserActivity({
        userId,
        userName: userName || userId,
        userRole,
        action,
        module: sheetName,
        recordId: record.id,
        recordName,
        details: `School data ${action.toLowerCase()}ed: ${sheetName} entry ${recordName}`
      });
    }
    
    const result = { success: true, id: record.id, message: 'Record ' + action + 'ed', action: action };
    console.log('[addRecord] Returning:', JSON.stringify(result));
    return result;
  } catch (error) {
    console.log('[addRecord] ERROR:', error.message);
    return { success: false, error: error.message };
  } finally {
    lock.releaseLock();
  }
}

function updateRecord(sheetName, keyField, keyValue, record, headers, userId = null, userName = null, userRole = null) {
  record[keyField] = keyValue;
  return addRecord(sheetName, record, headers, userId, userName, userRole);
}

function deleteRecord(sheetName, keyField, keyValue, headers, userId = null, userName = null, userRole = null) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    return { success: false, error: 'Sheet not found' };
  }
  
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    
    const data = sheet.getDataRange().getValues();
    const keyIndex = headers.indexOf(keyField);
    
    if (keyIndex === -1) {
      return { success: false, error: 'Key field not found' };
    }
    
    let recordName = '';
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][keyIndex]) === String(keyValue)) {
        recordName = data[i][headers.indexOf('name')] || keyValue;
        sheet.deleteRow(i + 1);
        dataCache.remove(`records_${sheetName}`);
        
        // ONLY log if it's a teacher or admin action
        if (userId && userRole && (userRole === 'teacher' || userRole === 'admin')) {
          logUserActivity({
            userId: userId,
            userName: userName || userId,
            userRole: userRole,
            action: 'DELETE',
            module: sheetName,
            recordId: keyValue,
            recordName: recordName,
            details: `Deleted ${sheetName} record`
          });
        }
        
        return { success: true, message: 'Record deleted successfully' };
      }
    }
    
    return { success: false, error: 'Record not found' };
  } finally {
    lock.releaseLock();
  }
}

function replaceAllRecords(sheetName, records, headers, userId = null, userName = null, userRole = null) {
  if (!records) records = [];
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(headers);
    } else {
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
      }
    }
    
    if (records.length === 0) {
      return { success: true, count: 0, message: 'Sheet cleared' };
    }
    
    const uniqueRecords = [];
    const seenIds = new Set();
    
    records.forEach(r => {
      const rId = String(r.id || r.admissionNo || '');
      if (rId && !seenIds.has(rId)) {
        seenIds.add(rId);
        uniqueRecords.push(r);
      }
    });

    const values = uniqueRecords.map(record => {
      return headers.map(header => {
        let val = record[header];
        if (val === undefined || val === null) return '';
        if (typeof val === 'object') return JSON.stringify(val);
        return val;
      });
    });
    
    sheet.getRange(2, 1, values.length, headers.length).setValues(values);
    dataCache.remove(`records_${sheetName}`);
    
    // ONLY log if it's a teacher or admin action
    if (userId && userRole && (userRole === 'teacher' || userRole === 'admin')) {
      logUserActivity({
        userId: userId,
        userName: userName || userId,
        userRole: userRole,
        action: 'REPLACE_ALL',
        module: sheetName,
        details: `Replaced all records in ${sheetName}: ${uniqueRecords.length} records`
      });
    }
    
    return { 
      success: true, 
      count: uniqueRecords.length,
      message: `${uniqueRecords.length} records written to ${sheetName}` 
    };
  } finally {
    lock.releaseLock();
  }
}

function bulkPushRecords(sheetName, records, headers, userId = null, userName = null, userRole = null) {
  if (!records || records.length === 0) {
    return { success: true, count: 0, message: 'No records to push' };
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(60000);
    
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(headers);
    }
    
    const fullData = sheet.getDataRange().getValues();
    const idIndex = headers.indexOf('id');
    const admissionIndex = sheetName === SHEET_NAMES.STUDENTS ? headers.indexOf('admissionNo') : -1;
    
    const idMap = new Map();
    const admMap = new Map();
    
    for (let i = 1; i < fullData.length; i++) {
      const rowId = String(fullData[i][idIndex] || '').trim();
      if (rowId) idMap.set(rowId, i + 1);
      
      if (admissionIndex >= 0) {
        const rowAdm = String(fullData[i][admissionIndex] || '').trim();
        if (rowAdm) admMap.set(rowAdm, i + 1);
      }
    }
    
    let updatedCount = 0;
    let addedCount = 0;
    const newRows = [];
    
    const batchSeenIds = new Set();
    const uniqueIncoming = records.filter(r => {
      const rId = String(r.id || r.admissionNo || '');
      if (batchSeenIds.has(rId)) return false;
      batchSeenIds.add(rId);
      return true;
    });

    for (const record of uniqueIncoming) {
      const recordId = String(record.id || '').trim();
      const recordAdm = admissionIndex >= 0 ? String(record.admissionNo || '').trim() : '';
      
      let rowIndex = idMap.get(recordId);
      if (!rowIndex && recordAdm) rowIndex = admMap.get(recordAdm);
      
      const values = headers.map(h => {
        let val = record[h];
        if (val === undefined || val === null) return '';
        if (typeof val === 'object') return JSON.stringify(val);
        return val;
      });
      
      if (rowIndex) {
        sheet.getRange(rowIndex, 1, 1, headers.length).setValues([values]);
        updatedCount++;
      } else {
        newRows.push(values);
        addedCount++;
      }
    }
    
    if (newRows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, headers.length).setValues(newRows);
    }
    
    dataCache.remove(`records_${sheetName}`);
    
    // Update sync status
    updateSyncStatus(sheetName, uniqueIncoming.length, 'success');
    
    // ONLY log if it's a teacher or admin action
    if (userId && userRole && (userRole === 'teacher' || userRole === 'admin')) {
      logUserActivity({
        userId: userId,
        userName: userName || userId,
        userRole: userRole,
        action: 'BULK_SYNC',
        module: sheetName,
        details: `Synced ${uniqueIncoming.length} records (${addedCount} new, ${updatedCount} updated)`
      });
    }
    
    return {
      success: true,
      total: uniqueIncoming.length,
      updated: updatedCount,
      added: addedCount,
      message: `Sync complete: ${addedCount} added, ${updatedCount} updated`
    };
  } catch (error) {
    updateSyncStatus(sheetName, 0, 'failed', error.message);
    return { success: false, error: error.message };
  } finally {
    lock.releaseLock();
  }
}

function updateSyncStatus(sheetName, recordCount, status, errorMessage = '') {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let statusSheet = ss.getSheetByName(SHEET_NAMES.SYNC_STATUS);
    
    if (!statusSheet) {
      statusSheet = ss.insertSheet(SHEET_NAMES.SYNC_STATUS);
      statusSheet.appendRow(SYNC_STATUS_HEADERS);
    }
    
    statusSheet.appendRow([
      new Date().toISOString(),
      sheetName,
      recordCount,
      status,
      errorMessage
    ]);
    
    const lastRow = statusSheet.getLastRow();
    if (lastRow > 1000) {
      statusSheet.deleteRows(2, lastRow - 1000);
    }
  } catch (error) {
    console.error('Update sync status error:', error);
  }
}

// ==================== ACTIVITY LOGGING (USER ACTIONS ONLY) ====================

// Track recent log entries to prevent duplicates
var ACTIVITY_LOG_CACHE = [];

function logUserActivity(params) {
  const { userId, userName, userRole, action, module, recordId, recordName, details, ipAddress } = params;
  
  // ONLY log if it's a teacher or admin - NO SYSTEM LOGS
  if (!userId || !userRole || (userRole !== 'teacher' && userRole !== 'admin')) {
    return { success: false, message: 'Only teacher/admin actions logged' };
  }
  
  // Prevent duplicate entries - check if same action logged within 3 seconds
  const now = Date.now();
  const entryKey = `${userId}-${action}-${module}-${recordId}`;
  
  // Clean old entries from cache (older than 5 seconds)
  ACTIVITY_LOG_CACHE = ACTIVITY_LOG_CACHE.filter(e => now - e.time < 5000);
  
  // Check for duplicate
  const isDuplicate = ACTIVITY_LOG_CACHE.some(e => e.key === entryKey && now - e.time < 3000);
  if (isDuplicate) {
    return { success: false, message: 'Duplicate entry blocked' };
  }
  
  // Add to cache
  ACTIVITY_LOG_CACHE.push({ key: entryKey, time: now });
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let logSheet = ss.getSheetByName(SHEET_NAMES.ACTIVITY_LOG);
    
    if (!logSheet) {
      logSheet = ss.insertSheet(SHEET_NAMES.ACTIVITY_LOG);
      logSheet.appendRow(ACTIVITY_LOG_HEADERS);
      const headerRange = logSheet.getRange(1, 1, 1, ACTIVITY_LOG_HEADERS.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#4285f4');
      headerRange.setFontColor('#ffffff');
    }
    
    const logEntry = [
      'LOG-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8),
      userId,
      userName || userId,
      userRole,
      action,
      module,
      recordId || '',
      recordName || '',
      (details || '').substring(0, 500),
      new Date().toISOString(),
      ipAddress || ''
    ];
    
    logSheet.appendRow(logEntry);
    
    // Maintain log size
    const lastRow = logSheet.getLastRow();
    if (lastRow > MAX_LOG_ENTRIES) {
      const rowsToDelete = lastRow - MAX_LOG_ENTRIES;
      if (rowsToDelete > 0) {
        logSheet.deleteRows(2, rowsToDelete);
      }
    }
    
    return { success: true, logId: logEntry[0] };
  } catch (error) {
    console.error('Log user activity error:', error);
    return { success: false, error: error.message };
  }
}

function getRecentActivities(limit = 50, module = null, userId = null) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const logSheet = ss.getSheetByName(SHEET_NAMES.ACTIVITY_LOG);
    
    if (!logSheet) return [];
    
    const lastRow = logSheet.getLastRow();
    if (lastRow <= 1) return [];
    
    const data = logSheet.getDataRange().getValues();
    const activities = [];
    
    for (let i = data.length - 1; i >= 1 && activities.length < limit; i--) {
      const row = data[i];
      
      if (module && row[5] !== module) continue;
      if (userId && row[1] !== userId) continue;
      
      activities.push({
        id: row[0],
        userId: row[1],
        userName: row[2],
        userRole: row[3],
        action: row[4],
        module: row[5],
        recordId: row[6],
        recordName: row[7],
        details: row[8],
        timestamp: row[9],
        ipAddress: row[10]
      });
    }
    
    return activities;
  } catch (error) {
    console.error('Get recent activities error:', error);
    return [];
  }
}

function getActivitySummary(days = 7) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const logSheet = ss.getSheetByName(SHEET_NAMES.ACTIVITY_LOG);
    
    if (!logSheet) return { total: 0, byAction: {}, byModule: {}, byUser: {}, recent: [] };
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const data = logSheet.getDataRange().getValues();
    const stats = {
      total: 0,
      byAction: {},
      byModule: {},
      byUser: {},
      recent: []
    };
    
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    for (let i = data.length - 1; i >= 1; i--) {
      const row = data[i];
      const timestamp = new Date(row[9]);
      
      if (timestamp < cutoffDate) continue;
      
      stats.total++;
      
      const action = row[4] || 'UNKNOWN';
      stats.byAction[action] = (stats.byAction[action] || 0) + 1;
      
      const module = row[5] || 'UNKNOWN';
      stats.byModule[module] = (stats.byModule[module] || 0) + 1;
      
      const userName = row[2] || 'Unknown';
      stats.byUser[userName] = (stats.byUser[userName] || 0) + 1;
      
      if (timestamp > oneDayAgo) {
        stats.recent.push({
          userName: row[2],
          action: row[4],
          module: row[5],
          recordName: row[7],
          details: row[8],
          timestamp: row[9]
        });
      }
    }
    
    return stats;
  } catch (error) {
    console.error('Activity summary error:', error);
    return { total: 0, byAction: {}, byModule: {}, byUser: {}, recent: [] };
  }
}

function clearActivityLog() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const logSheet = ss.getSheetByName(SHEET_NAMES.ACTIVITY_LOG);
    
    if (!logSheet) {
      return { success: true, message: 'Activity log sheet not found' };
    }
    
    const lastRow = logSheet.getLastRow();
    if (lastRow > 1) {
      logSheet.deleteRows(2, lastRow - 1);
    }
    
    return { success: true, message: 'Activity log cleared' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ==================== ACTIVE USER TRACKING ====================

function setActiveUser(deviceName, timestamp) {
  try {
    if (!deviceName || deviceName.length < 3) {
      return { success: false, error: 'Invalid device name' };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let activitySheet = ss.getSheetByName(SHEET_NAMES.ACTIVITY);
    
    if (!activitySheet) {
      activitySheet = ss.insertSheet(SHEET_NAMES.ACTIVITY);
      activitySheet.appendRow(['device', 'lastActivity', 'timestamp']);
    }
    
    const ts = timestamp ? parseInt(timestamp) : Date.now();
    const nowStr = new Date(ts).toISOString();
    const data = activitySheet.getDataRange().getValues();
    
    let deviceRow = -1;
    for (let i = 1; i < data.length; i++) {
      const existingDevice = String(data[i][0] || '');
      const userPart = deviceName.split('#')[0];
      if (existingDevice === deviceName || existingDevice.startsWith(userPart)) {
        deviceRow = i;
        break;
      }
    }
    
    if (deviceRow > 0) {
      activitySheet.getRange(deviceRow + 1, 2, 1, 2).setValues([[nowStr, ts.toString()]]);
    } else {
      const userPrefix = deviceName.split('#')[0];
      for (let i = data.length - 1; i > 0; i--) {
        const existingDevice = String(data[i][0] || '');
        if (existingDevice.startsWith(userPrefix)) {
          activitySheet.deleteRow(i + 1);
        }
      }
      activitySheet.appendRow([deviceName, nowStr, ts.toString()]);
    }
    
    cleanupStaleActiveUsers(activitySheet);
    
    return { success: true, message: 'Active status updated', device: deviceName };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function cleanupStaleActiveUsers(activitySheet) {
  try {
    const data = activitySheet.getDataRange().getValues();
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
    
    for (let i = data.length - 1; i > 0; i--) {
      const ts = parseInt(data[i][2]);
      if (ts && ts < tenMinutesAgo) {
        activitySheet.deleteRow(i + 1);
      }
    }
  } catch (e) {}
}

function getActiveUsers() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let activitySheet = ss.getSheetByName(SHEET_NAMES.ACTIVITY);
    
    if (!activitySheet) {
      return { success: true, activeCount: 0, activeUsers: [], uniqueUsers: 0, lastActivity: null };
    }
    
    const data = activitySheet.getDataRange().getValues();
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
    let lastActivity = null;
    const activeUsers = [];
    
    for (let i = 1; i < data.length; i++) {
      const timestamp = parseInt(data[i][2]);
      const device = String(data[i][0] || '');
      
      if (timestamp && timestamp > tenMinutesAgo && device) {
        activeUsers.push({
          device: device,
          lastActivity: data[i][1] ? String(data[i][1]) : new Date(timestamp).toISOString(),
          timestamp: timestamp
        });
        
        if (!lastActivity || timestamp > parseInt(lastActivity)) {
          lastActivity = timestamp;
        }
      }
    }
    
    activeUsers.sort((a, b) => b.timestamp - a.timestamp);
    
    const seenDevices = new Set();
    const uniqueUsers = activeUsers.filter(u => {
      const deviceKey = u.device.split('#')[0];
      if (seenDevices.has(deviceKey)) return false;
      seenDevices.add(deviceKey);
      return true;
    });
    
    return { 
      success: true, 
      activeCount: uniqueUsers.length,
      uniqueUsers: uniqueUsers.length,
      activeUsers: uniqueUsers,
      lastActivity: lastActivity ? lastActivity.toString() : null 
    };
  } catch (error) {
    return { success: false, activeCount: 0, activeUsers: [], uniqueUsers: 0, error: error.message };
  }
}

// ==================== TEACHER AUTHENTICATION ====================

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

function registerTeacher(credentials) {
  const { username, password, teacherId, name, role, subjects, grades, classTeacherGrade, religion } = credentials;
  
  if (!username || !password) {
    return { success: false, error: 'Username and password are required' };
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let credSheet = ss.getSheetByName(SHEET_NAMES.TEACHER_CREDENTIALS);
  
  if (!credSheet) {
    credSheet = ss.insertSheet(SHEET_NAMES.TEACHER_CREDENTIALS);
    credSheet.appendRow(TEACHER_CREDENTIALS_HEADERS);
  }
  
  const data = credSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === String(username).toLowerCase()) {
      return { success: false, error: 'Username already exists' };
    }
  }
  
  const passwordHash = simpleHash(password);
  const now = new Date().toISOString();
  
  credSheet.appendRow([
    username.toLowerCase().trim(),
    passwordHash,
    teacherId || '',
    name || username,
    role || 'teacher',
    now,
    '',
    subjects || '',
    grades || '',
    classTeacherGrade || '',
    religion || ''
  ]);
  
  // Log teacher registration (user action)
  logUserActivity({
    userId: username,
    userName: name || username,
    userRole: role || 'teacher',
    action: 'REGISTER',
    module: 'Authentication',
    details: `New teacher account created: ${username}`
  });
  
  return { 
    success: true, 
    message: 'Account created successfully',
    username: username.toLowerCase().trim(),
    role: role || 'teacher'
  };
}

function loginTeacher(credentials) {
  const { username, password } = credentials;
  
  if (!username || !password) {
    return { success: false, error: 'Username and password are required' };
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const credSheet = ss.getSheetByName(SHEET_NAMES.TEACHER_CREDENTIALS);
  
  if (!credSheet) {
    return { success: false, error: 'Credentials system not initialized' };
  }
  
  const data = credSheet.getDataRange().getValues();
  const passwordHash = simpleHash(password);
  
  for (let i = 1; i < data.length; i++) {
    const storedUsername = String(data[i][0] || '').toLowerCase();
    const storedHash = String(data[i][1] || '');
    const storedTeacherId = String(data[i][2] || '');
    const storedName = String(data[i][3] || '');
    const storedRole = String(data[i][4] || 'teacher');
    const storedSubjects = String(data[i][7] || '');
    const storedGrades = String(data[i][8] || '');
    const storedClassTeacherGrade = String(data[i][9] || '');
    const storedReligion = String(data[i][10] || '');
    
    if (storedUsername === username.toLowerCase().trim() && storedHash === passwordHash) {
      credSheet.getRange(i + 1, 7).setValue(new Date().toISOString());
      
      // Log login action (user action)
      logUserActivity({
        userId: username,
        userName: storedName,
        userRole: storedRole,
        action: 'LOGIN',
        module: 'Authentication',
        details: `User logged in successfully`
      });
      
      return { 
        success: true, 
        message: 'Login successful',
        username: storedUsername,
        teacherId: storedTeacherId,
        name: storedName,
        role: storedRole,
        subjects: storedSubjects,
        grades: storedGrades,
        classTeacherGrade: storedClassTeacherGrade,
        religion: storedReligion
      };
    }
  }
  
  return { success: false, error: 'Invalid username or password' };
}

function getTeacherCredentials() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const credSheet = ss.getSheetByName(SHEET_NAMES.TEACHER_CREDENTIALS);
  
  if (!credSheet) return [];
  
  const data = credSheet.getDataRange().getValues();
  const results = [];
  
  for (let i = 1; i < data.length; i++) {
    results.push({
      username: data[i][0],
      teacherId: data[i][2],
      name: data[i][3],
      role: data[i][4],
      createdAt: data[i][5],
      lastLogin: data[i][6],
      subjects: data[i][7] || '',
      grades: data[i][8] || ''
    });
  }
  
  return results;
}

function deleteTeacherAccount(username) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const credSheet = ss.getSheetByName(SHEET_NAMES.TEACHER_CREDENTIALS);
  
  if (!credSheet) {
    return { success: false, error: 'Credentials sheet not found' };
  }
  
  const data = credSheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === String(username).toLowerCase()) {
      credSheet.deleteRow(i + 1);
      
      logUserActivity({
        userId: 'admin',
        userName: 'Admin',
        userRole: 'admin',
        action: 'DELETE_TEACHER',
        module: 'Authentication',
        details: `Teacher account deleted: ${username}`
      });
      
      return { success: true, message: 'Account deleted' };
    }
  }
  
  return { success: false, error: 'Account not found' };
}

function loginParent(admissionNo, studentName) {
  if (!admissionNo || !studentName) {
    return { success: false, error: 'Both student name and admission number are required' };
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const studentSheet = ss.getSheetByName(SHEET_NAMES.STUDENTS);
  
  if (!studentSheet) {
    return { success: false, error: 'Students data not found' };
  }
  
  const data = studentSheet.getDataRange().getValues();
  if (data.length < 2) return { success: false, error: 'No students found' };
  
  const headers = data[0].map(h => String(h || '').trim());
  const admIndex = headers.indexOf('admissionNo');
  
  if (admIndex === -1) {
    // Fallback to searching all columns if header not exact match
    return { success: false, error: 'Admission system column error' };
  }
  
  const nameIndex = headers.indexOf('name');
  const idIndex = headers.indexOf('id');
  const parentIndex = headers.indexOf('parentContact');
  
  for (let i = 1; i < data.length; i++) {
    const storedAdmNo = String(data[i][admIndex] || '').trim();
    const storedName = String(data[i][nameIndex >= 0 ? nameIndex : 1] || '').trim();
    
    const isAdmMatch = storedAdmNo.toLowerCase() === admissionNo.toLowerCase().trim();
    const isNameMatch = storedName.toLowerCase().includes(studentName.toLowerCase().trim()) || 
                      studentName.toLowerCase().trim().includes(storedName.toLowerCase());
                      
    if (isAdmMatch && isNameMatch) {
      const studentNameResult = storedName;
      const studentId = String(data[i][idIndex >= 0 ? idIndex : 0] || '');
      const parentName = String(data[i][parentIndex >= 0 ? parentIndex : 8] || 'Parent of ' + studentNameResult);
      
      // Update or add to Parents sheet for tracking
      let parentSheet = ss.getSheetByName(SHEET_NAMES.PARENTS);
      if (!parentSheet) {
        parentSheet = ss.insertSheet(SHEET_NAMES.PARENTS);
        parentSheet.appendRow(PARENT_HEADERS);
      }
      
      const parentsData = parentSheet.getDataRange().getValues();
      let parentRow = -1;
      const pAdmIndex = PARENT_HEADERS.indexOf('admissionNo');
      
      for (let j = 1; j < parentsData.length; j++) {
        if (String(parentsData[j][pAdmIndex]).trim().toLowerCase() === admissionNo.toLowerCase().trim()) {
          parentRow = j + 1;
          break;
        }
      }
      
      const now = new Date().toISOString();
      if (parentRow > 0) {
        parentSheet.getRange(parentRow, PARENT_HEADERS.indexOf('lastLogin') + 1).setValue(now);
      } else {
        const newParentRow = PARENT_HEADERS.map(h => {
          if (h === 'id') return 'PAR-' + Date.now();
          if (h === 'admissionNo') return admissionNo;
          if (h === 'name') return parentName;
          if (h === 'createdAt') return now;
          if (h === 'lastLogin') return now;
          return '';
        });
        parentSheet.appendRow(newParentRow);
      }

      // Log parent login
      logUserActivity({
        userId: admissionNo,
        userName: parentName,
        userRole: 'parent',
        action: 'LOGIN',
        module: 'Parent Portal',
        details: `Parent logged in matching: ${studentNameResult} (${admissionNo})`
      });

      return {
        success: true,
        message: 'Login successful',
        admissionNo: storedAdmNo,
        studentName: studentNameResult,
        studentId: studentId,
        parentName: parentName,
        role: 'parent'
      };
    }
  }
  
  return { success: false, error: 'Validation failed: Student name or admission number does not match.' };
}


// ==================== SETTINGS MANAGEMENT ====================

function getSettings() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let settingsSheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);

    if (!settingsSheet) {
      return { success: true, settings: {} };
    }

    const data = settingsSheet.getDataRange().getValues();
    const settings = {};

    for (let i = 1; i < data.length; i++) {
      const key = String(data[i][0] || '').trim();
      const value = data[i][1];

      if (key) {
        // Try to parse JSON values
        try {
          settings[key] = JSON.parse(value);
        } catch (e) {
          settings[key] = value;
        }
      }
    }

    return { success: true, settings: settings };
  } catch (error) {
    console.error('getSettings error:', error);
    return { success: false, error: error.message };
  }
}

function setSettings(settings, updatedBy = 'admin') {
  try {
    console.log('[setSettings] Called with settings keys:', Object.keys(settings));
    console.log('[setSettings] feeStructures:', settings.feeStructures ? JSON.stringify(settings.feeStructures).substring(0, 500) : 'undefined');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let settingsSheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);

    if (!settingsSheet) {
      settingsSheet = ss.insertSheet(SHEET_NAMES.SETTINGS);
      settingsSheet.appendRow(SETTINGS_HEADERS);
      const headerRange = settingsSheet.getRange(1, 1, 1, SETTINGS_HEADERS.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#4285f4');
      headerRange.setFontColor('#ffffff');
    }

    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(30000);

      const now = new Date().toISOString();
      const existingData = settingsSheet.getDataRange().getValues();
      const existingKeys = new Map();

      console.log('[setSettings] Existing rows:', existingData.length);

      // Build map of existing keys
      for (let i = 1; i < existingData.length; i++) {
        const key = String(existingData[i][0] || '').trim();
        if (key) {
          existingKeys.set(key, i + 1);
        }
      }

      console.log('[setSettings] Existing keys:', Array.from(existingKeys.keys()));

      // Update or add each setting
      for (const [key, value] of Object.entries(settings)) {
        const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
        const rowIndex = existingKeys.get(key);

        console.log('[setSettings] Processing key:', key, 'value length:', valueStr.length);

        if (rowIndex) {
          // Update existing row
          settingsSheet.getRange(rowIndex, 2).setValue(valueStr);
          settingsSheet.getRange(rowIndex, 3).setValue(now);
          settingsSheet.getRange(rowIndex, 4).setValue(updatedBy);
          console.log('[setSettings] Updated row:', rowIndex);
        } else {
          // Add new row
          settingsSheet.appendRow([key, valueStr, now, updatedBy]);
          console.log('[setSettings] Appended new row for:', key);
        }
      }

      dataCache.remove('records_Settings');

      console.log('[setSettings] Success - total settings processed:', Object.keys(settings).length);
      return { success: true, message: 'Settings updated successfully' };
    } catch (lockError) {
      console.error('[setSettings] Lock error:', lockError);
      return { success: false, error: 'Lock error: ' + lockError.message };
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    console.error('[setSettings] Error:', error);
    return { success: false, error: error.message };
  }
}


// ==================== BACKUP SYSTEM ====================

function createBackup(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = ss.getSheetByName(sheetName);
  
  if (!sourceSheet) {
    return { success: false, error: 'Sheet not found' };
  }
  
  const backupName = `${sheetName}_Backup_${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss')}`;
  const backupSheet = ss.insertSheet(backupName);
  
  const data = sourceSheet.getDataRange().getValues();
  backupSheet.getRange(1, 1, data.length, data[0].length).setValues(data);
  
  // Record backup metadata
  const metadataSheet = ss.getSheetByName(SHEET_NAMES.BACKUP_METADATA);
  if (metadataSheet) {
    metadataSheet.appendRow([backupName, sheetName, new Date().toISOString(), data.length - 1]);
  }
  
  // Clean old backups
  cleanupOldBackups();
  
  return { success: true, backupName, recordCount: data.length - 1 };
}

function cleanupOldBackups() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const metadataSheet = ss.getSheetByName(SHEET_NAMES.BACKUP_METADATA);
  
  if (!metadataSheet) return;
  
  const data = metadataSheet.getDataRange().getValues();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - BACKUP_RETENTION_DAYS);
  
  for (let i = data.length - 1; i > 0; i--) {
    const backupDate = new Date(data[i][2]);
    if (backupDate < cutoffDate) {
      const backupName = data[i][0];
      const backupSheet = ss.getSheetByName(backupName);
      if (backupSheet) {
        ss.deleteSheet(backupSheet);
      }
      metadataSheet.deleteRow(i + 1);
    }
  }
}

function restoreFromBackup(backupName, targetSheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const backupSheet = ss.getSheetByName(backupName);
  const targetSheet = ss.getSheetByName(targetSheetName);
  
  if (!backupSheet || !targetSheet) {
    return { success: false, error: 'Backup or target sheet not found' };
  }
  
  // Create backup of current data before restore
  createBackup(targetSheetName);
  
  // Clear target sheet
  const lastRow = targetSheet.getLastRow();
  if (lastRow > 1) {
    targetSheet.deleteRows(2, lastRow - 1);
  }
  
  // Copy backup data
  const backupData = backupSheet.getDataRange().getValues();
  if (backupData.length > 1) {
    targetSheet.getRange(2, 1, backupData.length - 1, backupData[0].length).setValues(backupData.slice(1));
  }
  
  return { success: true, message: `Restored from ${backupName}` };
}

// ==================== DATA MIGRATION UTILITIES ====================

function backfillAssessmentStudentData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const studentsSheet = ss.getSheetByName(SHEET_NAMES.STUDENTS);
  const assessmentsSheet = ss.getSheetByName(SHEET_NAMES.ASSESSMENTS);
  
  if (!studentsSheet || !assessmentsSheet) {
    return { success: false, error: 'Students or Assessments sheet not found' };
  }
  
  updateAssessmentSheetHeaders(assessmentsSheet);
  const students = getAllRecords(SHEET_NAMES.STUDENTS, STUDENT_HEADERS);
  const lastRow = assessmentsSheet.getLastRow();
  
  if (lastRow <= 1) {
    return { success: true, message: 'No assessment records to update' };
  }
  
  const data = assessmentsSheet.getDataRange().getValues();
  const headerRow = data[0].map(h => String(h || '').trim());
  
  const studentIdIndex = headerRow.indexOf('studentId');
  const studentAdmIndex = headerRow.indexOf('studentAdmissionNo');
  const studentNameIndex = headerRow.indexOf('studentName');
  
  let updatedCount = 0;
  
  const byId = new Map();
  const byAdm = new Map();
  
  students.forEach(s => {
    if (s.id) byId.set(String(s.id).trim().toLowerCase(), s);
    if (s.admissionNo) byAdm.set(String(s.admissionNo).trim().toLowerCase(), s);
  });
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const currentStudentId = String(row[studentIdIndex] || '').trim();
    
    if (!currentStudentId) {
      updatedCount++;
    }
  }
  
  return { success: true, message: 'Headers updated. ' + updatedCount + ' records analyzed.' };
}

function migrateAssessmentStudentIds() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const studentsSheet = ss.getSheetByName(SHEET_NAMES.STUDENTS);
  const assessmentsSheet = ss.getSheetByName(SHEET_NAMES.ASSESSMENTS);
  
  if (!studentsSheet || !assessmentsSheet) {
    return { success: false, error: 'Required sheets not found' };
  }
  
  const students = getAllRecords(SHEET_NAMES.STUDENTS, STUDENT_HEADERS);
  const lastRow = assessmentsSheet.getLastRow();
  
  if (lastRow <= 1) {
    return { success: true, message: 'No assessment records to migrate' };
  }
  
  const data = assessmentsSheet.getDataRange().getValues();
  const headerRow = data[0].map(function(h) { return String(h || '').trim(); });
  
  const idIndex = headerRow.indexOf('id');
  let studentIdIndex = headerRow.indexOf('studentId');
  let studentAdmIndex = headerRow.indexOf('studentAdmissionNo');
  let studentNameIndex = headerRow.indexOf('studentName');
  
  const currentLastCol = headerRow.length;
  
  if (studentIdIndex === -1) {
    assessmentsSheet.insertColumnAfter(currentLastCol);
    assessmentsSheet.getRange(1, currentLastCol + 1).setValue('studentId');
    studentIdIndex = currentLastCol;
  }
  if (studentAdmIndex === -1) {
    assessmentsSheet.insertColumnAfter(studentIdIndex + 1);
    assessmentsSheet.getRange(1, studentIdIndex + 2).setValue('studentAdmissionNo');
    studentAdmIndex = studentIdIndex + 1;
  }
  if (studentNameIndex === -1) {
    assessmentsSheet.insertColumnAfter(studentAdmIndex + 1);
    assessmentsSheet.getRange(1, studentAdmIndex + 2).setValue('studentName');
    studentNameIndex = studentAdmIndex + 1;
  }
  
  const byAdm = new Map();
  const byName = new Map();
  
  students.forEach(function(s) {
    if (s.admissionNo) byAdm.set(String(s.admissionNo).trim().toLowerCase(), s);
    if (s.name) byName.set(String(s.name).trim().toLowerCase(), s);
  });
  
  let updatedCount = 0;
  let matchedCount = 0;
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const currentStudentId = String(row[studentIdIndex] || '').trim();
    
    if (currentStudentId && currentStudentId.length > 0) continue;
    
    let matchedStudent = null;
    
    if (matchedStudent) {
      assessmentsSheet.getRange(i + 1, studentIdIndex + 1).setValue(String(matchedStudent.id || ''));
      assessmentsSheet.getRange(i + 1, studentAdmIndex + 1).setValue(String(matchedStudent.admissionNo || ''));
      assessmentsSheet.getRange(i + 1, studentNameIndex + 1).setValue(String(matchedStudent.name || ''));
      matchedCount++;
    }
    
    updatedCount++;
  }
  
  return {
    success: true,
    analyzed: updatedCount,
    matched: matchedCount,
    message: 'Migration complete. ' + matchedCount + ' records matched with students.'
  };
}

function updateAssessmentSheetHeaders(sheet) {
  return updateSheetHeaders(sheet, ASSESSMENT_HEADERS);
}

function addMissingColumnsToSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const assessmentsSheet = ss.getSheetByName(SHEET_NAMES.ASSESSMENTS);
  if (assessmentsSheet) {
    updateAssessmentSheetHeaders(assessmentsSheet);
  }
  
  const studentsSheet = ss.getSheetByName(SHEET_NAMES.STUDENTS);
  if (studentsSheet) {
    updateSheetHeaders(studentsSheet, STUDENT_HEADERS);
  }
  
  const paymentsSheet = ss.getSheetByName(SHEET_NAMES.PAYMENTS);
  if (paymentsSheet) {
    updateSheetHeaders(paymentsSheet, PAYMENT_HEADERS);
  }
  
  return { success: true, message: 'Columns added to sheets' };
}

// ==================== CLASS ASSESSMENT SHEET FUNCTIONS ====================

/**
 * Generate class sheet name from grade/stream
 * Examples: "Class_6_Assessment", "Class_7A_Assessment"
 */
function getClassSheetName(grade, stream) {
  const cleanGrade = String(grade || '').trim();
  if (!cleanGrade) return null;
  
  // If stream provided, include it
  if (stream && stream.trim()) {
    const cleanStream = String(stream || '').trim();
    return `Class_${cleanGrade}_${cleanStream}_Assessment`;
  }
  
  return `Class_${cleanGrade}_Assessment`;
}

/**
 * Check if a class assessment sheet exists
 */
function classSheetExists(grade, stream) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = getClassSheetName(grade, stream);
    if (!sheetName) return false;
    
    const sheet = ss.getSheetByName(sheetName);
    return sheet !== null;
  } catch (e) {
    return false;
  }
}

/**
 * Get all class assessment sheet names
 * Supports both patterns:
 * - Grade_Assessments_[Grade]_[Term]_[ExamType]
 * - Class_[Grade]_Assessment
 */
function getAllClassAssessmentSheets() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();
    return sheets
      .map(s => s.getName())
      .filter(name => 
        (name.includes('Class_') && name.includes('_Assessment')) ||
        (name.startsWith('Grade_Assessments_')) ||
        (name.startsWith('MX_'))
      );
  } catch (e) {
    return [];
  }
}

/**
 * Fetch assessments from class sheet with fallback to general sheet
 * Supports both matrix sheets (Grade_Assessments_*) and flat assessment sheets (Class_*_Assessment)
 * Priority: Specific grade/term/exam sheet > General class sheet > General Assessments Sheet
 */
function getAssessmentsWithClassFallback(grade, term, examType, academicYear) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let assessments = [];
    let sheetUsed = null;
    
    console.log(`[Assessment] ==========  FETCHING  ==========`);
    console.log(`[Assessment] Parameters: grade="${grade}", term="${term}", examType="${examType}", year="${academicYear}"`);
    
    // First priority: Look for exact Grade_Assessments_[Grade]_[Term]_[ExamType] sheet
    if (grade && term && examType) {
      const targetSheetName = `Grade_Assessments_${grade}_${term}_${examType}`.replace(/\//g, '-').replace(/\s+/g, '_');
      console.log(`[Assessment] Trying exact sheet: ${targetSheetName}`);
      const targetSheet = ss.getSheetByName(targetSheetName);
      
      if (targetSheet) {
        assessments = parseMatrixSheet(targetSheet, grade, term, examType, academicYear);
        if (assessments.length > 0) {
          sheetUsed = targetSheetName;
          console.log(`[Assessment] ✓ Using matrix sheet: ${sheetUsed}, found ${assessments.length} records`);
          return assessments;
        }
      } else {
        console.log(`[Assessment] ✗ Exact sheet not found`);
      }
    }
    
    // Second priority: Look for Grade_Assessments sheets that match grade/term/examType
    const possibleSheets = getAllClassAssessmentSheets()
      .filter(s => s.startsWith('Grade_Assessments_'));
    
    console.log(`[Assessment] Searching ${possibleSheets.length} Grade_Assessments sheets for: grade=${grade}, term=${term}, examType=${examType}`);
    
    for (const sheetName of possibleSheets) {
      // Parse sheet name: Grade_Assessments_Grade_7_T1_Opener
      const nameMatch = sheetName.match(/Grade_Assessments_(.+)_(T\d)_(.+)/);
      if (!nameMatch) {
        console.log(`[Assessment] Could not parse: ${sheetName}`);
        continue;
      }
      
      const sheetGrade = nameMatch[1].replace(/_/g, ' ').trim();
      const sheetTerm = nameMatch[2];
      const sheetExamType = nameMatch[3];
      
      console.log(`[Assessment] Checking ${sheetName}: parsed as grade="${sheetGrade}", term="${sheetTerm}", examType="${sheetExamType}"`);
      
      // If params are provided, must match; if not provided, accept any
      const gradeMatch = !grade || sheetGrade.toLowerCase() === String(grade).toLowerCase();
      const termMatch = !term || sheetTerm === String(term).trim();
      const examTypeMatch = !examType || sheetExamType === String(examType).trim();
      
      if (gradeMatch && termMatch && examTypeMatch) {
        console.log(`[Assessment] ✓ Match found: ${sheetName}`);
        const sheet = ss.getSheetByName(sheetName);
        if (sheet) {
          assessments = parseMatrixSheet(sheet, sheetGrade, sheetTerm, sheetExamType, academicYear);
          if (assessments.length > 0) {
            sheetUsed = sheetName;
            console.log(`[Assessment] Using matrix sheet: ${sheetUsed}, found ${assessments.length} records`);
            return assessments;
          }
        }
      }
    }
    
    // Third priority: Look for Class_[Grade]_Assessment pattern
    if (grade) {
      const possibleClassSheets = getAllClassAssessmentSheets()
        .filter(s => s.startsWith('Class_'));
      const gradeStr = String(grade).toLowerCase().trim();
      
      for (const sheetName of possibleClassSheets) {
        if (sheetName.toLowerCase().includes(gradeStr)) {
          const sheet = ss.getSheetByName(sheetName);
          if (sheet) {
            const data = sheet.getDataRange().getValues();
            if (data.length > 1) {
              assessments = parseAssessmentSheet(sheet, ASSESSMENT_HEADERS);
              if (assessments.length > 0) {
                sheetUsed = sheetName;
                console.log(`[Assessment] Using class sheet: ${sheetUsed}, found ${assessments.length} records`);
                break;
              }
            }
          }
        }
      }
    }
    
    // If found from class sheets, apply additional filters
    if (assessments.length > 0) {
      if (term) {
        assessments = assessments.filter(a => a.term === term);
      }
      if (examType) {
        assessments = assessments.filter(a => a.examType === examType);
      }
      if (academicYear) {
        assessments = assessments.filter(a => !a.academicYear || a.academicYear === academicYear);
      }
      
      if (assessments.length > 0 && sheetUsed) {
        console.log(`[Assessment] Filtered to ${assessments.length} records from ${sheetUsed}`);
        return assessments;
      }
    }
    
    // Final fallback: General Assessments sheet
    console.log(`[Assessment] No matching class sheets found, falling back to general Assessments sheet`);
    const generalSheetAssessments = getAllRecords(SHEET_NAMES.ASSESSMENTS, ASSESSMENT_HEADERS);
    console.log(`[Assessment] General sheet has ${generalSheetAssessments.length} total records`);
    assessments = generalSheetAssessments;
    
    if (term) {
      assessments = assessments.filter(a => a.term === term);
      console.log(`[Assessment] After term filter: ${assessments.length} records`);
    }
    if (grade) {
      const students = getAllRecords(SHEET_NAMES.STUDENTS, STUDENT_HEADERS);
      const gradeStudentIds = students.filter(s => s.grade === grade).map(s => s.id);
      assessments = assessments.filter(a => gradeStudentIds.includes(a.studentId));
      console.log(`[Assessment] After grade filter: ${assessments.length} records`);
    }
    if (examType) {
      assessments = assessments.filter(a => a.examType === examType);
      console.log(`[Assessment] After examType filter: ${assessments.length} records`);
    }
    if (academicYear) {
      assessments = assessments.filter(a => !a.academicYear || a.academicYear === academicYear);
      console.log(`[Assessment] After year filter: ${assessments.length} records`);
    }
    
    console.log(`[Assessment] ========== FINAL RESULT ==========`);
    console.log(`[Assessment] Returning ${assessments.length} assessments (from general sheet fallback)`);
    return assessments;
  } catch (error) {
    console.error('[Assessment] Error fetching with fallback:', error.message);
    return [];
  }
}

/**
 * Get default subjects for a grade (used when no custom subjects are configured)
 * This mirrors the Storage.getSubjectsForGrade logic from the frontend
 */
function getDefaultSubjectsForGrade(grade) {
  const gUpper = String(grade || '').toUpperCase().trim();
  const seniorGrades = ['GRADE 10', 'GRADE 11', 'GRADE 12'];
  
  // FIXED: More comprehensive normalization
  const normalized = gUpper.replace(/PRE-PRIMARY/g, 'PP')
                           .replace(/PRE\s+PRIMARY/g, 'PP')
                           .replace(/PREPRIMARY/g, 'PP')
                           .replace(/BABY\s+CLASS/g, 'PP1')
                           .replace(/BABYCLASS/g, 'PP1')
                           .replace(/NURSERY/g, 'PP2')
                           .replace(/RECEPTION/g, 'PP2')
                           .replace(/KINDERGARTEN/g, 'PP')
                           .replace(/GRADE/g, '')
                           .replace(/CLASS/g, '')
                           .replace(/\s+/g, '');
  
  if (gUpper === 'BABY CLASS' || normalized === 'PP1' || normalized === 'PP2' || gUpper.includes('PP1') || gUpper.includes('PP2')) {
    return ['Mathematics activities', 'Language activities', 'Literacy', 'Kiswahili', 'Environmental Activities', 'Creative Activities', 'Religious Education Activities'];
  } else if (gUpper === 'GRADE 1' || gUpper === 'GRADE 2' || gUpper === 'GRADE 3' || gUpper === '1' || gUpper === '2' || gUpper === '3') {
    return ['INDIGENOUS LANGUAGE ACTIVITIES', 'KISWAHILI/KSL ACTIVITIES', 'ENGLISH LANGUAGE ACTIVITIES', 'MATHEMATIC ACTIVITIES', 'RELIGIOUS EDUCATION ACTIVITIES', 'ENVIRONMENTAL ACTIVITIES', 'CREATIVE ART ACTIVITIES'];
  } else if (gUpper === 'GRADE 4' || gUpper === 'GRADE 5' || gUpper === 'GRADE 6') {
    return ['ENGLISH', 'KISWAHILI/KSL', 'MATHEMATICS', 'AGRICULTURE', 'SOCIAL STUDIES', 'RELIGIOUS EDUCATION', 'CREATIVE ARTS', 'SCIENCE & TECHNOLOGY'];
  } else if (['GRADE 7', 'GRADE 8', 'GRADE 9'].includes(gUpper)) {
    return ['ENGLISH', 'MATHEMATICS', 'KISWAHILI/KSL', 'SOCIAL STUDIES', 'PRE-TECHNICAL STUDIES', 'CREATIVE ARTS & SPORTS', 'AGRICULTURE & NUTRITION', 'INTEGRATED SCIENCE', 'RELIGIOUS EDUCATION'];
  } else if (seniorGrades.includes(gUpper)) {
    return ['English', 'Kiswahili', 'Mathematics', 'CSL', 'Biology', 'Chemistry', 'Physics', 'Agriculture', 'Computer Studies', 'History and Citizenship', 'Geography', 'CRE', 'IRE', 'Accounting', 'Economics', 'Fine Arts', 'Music and Dance', 'Sports Science', 'Business Studies', 'Physical Education', 'ICT'];
  }
  
  return ['Mathematics', 'English', 'Science'];
}

/**
 * Parse a matrix-format sheet into flat assessment records
 * Matrix format: Row 1 = Headers (ID, Name, Subject1, Subject2, ...)
 *                Rows 2+ = Student rows with marks
 */
function parseMatrixSheet(sheet, grade, term, examType, academicYear) {
  try {
    const data = sheet.getDataRange().getValues();
    console.log(`[Matrix] Sheet has ${data.length} rows total`);
    
    if (data.length <= 1) {
      console.log(`[Matrix] ERROR: Sheet has no data rows (only ${data.length} row)`);
      return [];
    }
    
    const headers = data[0].map(h => String(h || '').trim());
    console.log(`[Matrix] Headers found: ${JSON.stringify(headers)}`);
    
    const assessments = [];
    const students = getAllRecords(SHEET_NAMES.STUDENTS, STUDENT_HEADERS);
    console.log(`[Matrix] Total students in system: ${students.length}`);
    
    if (students.length === 0) {
      console.log(`[Matrix] WARNING: No students in system to match against!`);
    }
    
    const studentMap = new Map();
    students.forEach(s => {
      if (s.id) studentMap.set(String(s.id).toLowerCase(), s);
      if (s.admissionNo) studentMap.set(String(s.admissionNo).toLowerCase(), s);
      if (s.name) studentMap.set(String(s.name).toLowerCase(), s);
    });
    
    console.log(`[Matrix] Student map built with ${studentMap.size} entries`);
    
    // Parse each row (starting from row 2, since row 1 is headers)
    let rowsParsed = 0;
    let rowsSkipped = 0;
    let scoresProcessed = 0;
    let scoresSkipped = 0;
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const studentId = String(row[0] || '').trim();
      const studentName = String(row[1] || '').trim();
      
      if (!studentId && !studentName) {
        console.log(`[Matrix] Row ${i + 1}: SKIPPED (empty student ID and name)`);
        rowsSkipped++;
        continue;
      }
      
      rowsParsed++;
      console.log(`[Matrix] Row ${i + 1}: StudentID="${studentId}", Name="${studentName}"`);
      
      // Find student from map
      let student = studentMap.get(studentId.toLowerCase());
      if (!student && studentName) {
        student = studentMap.get(studentName.toLowerCase());
      }
      
      if (!student) {
        console.log(`[Matrix]  ⚠️ Student not found in system (ID="${studentId}", Name="${studentName}")`);
      }
      
      // Process each subject (columns starting from index 2)
      for (let j = 2; j < headers.length; j++) {
        const subject = String(headers[j] || '').trim();
        const scoreValue = row[j];
        
        if (!subject) {
          console.log(`[Matrix]   Column ${j}: SKIPPED (no subject header)`);
          scoresSkipped++;
          continue;
        }
        
        if (scoreValue === '' || scoreValue === null || scoreValue === undefined) {
          console.log(`[Matrix]   Column ${j} (${subject}): SKIPPED (empty cell)`);
          scoresSkipped++;
          continue;
        }
        
        const score = Number(scoreValue);
        if (isNaN(score) && scoreValue !== 0) {
          console.log(`[Matrix]   Column ${j} (${subject}): SKIPPED (invalid score: "${scoreValue}")`);
          scoresSkipped++;
          continue;
        }
        
        scoresProcessed++;
        const assessment = {
          id: `A-${Date.now()}-${i}-${j}`,
          studentId: student?.id || studentId,
          studentAdmissionNo: student?.admissionNo || studentId,
          studentName: student?.name || studentName,
          grade: String(grade).trim(),
          subject: subject,
          score: score,
          term: String(term).trim(),
          examType: String(examType).trim(),
          academicYear: academicYear || '2025/2026',
          date: new Date().toISOString().split('T')[0],
          level: '',
          rawScore: score,
          maxScore: 100
        };
        
        console.log(`[Matrix]   ✓ Score: ${subject}=${score}`);
        assessments.push(assessment);
      }
    }
    
    console.log(`[Matrix] SUMMARY: Parsed ${rowsParsed} data rows, skipped ${rowsSkipped} rows`);
    console.log(`[Matrix] SUMMARY: Processed ${scoresProcessed} scores, skipped ${scoresSkipped} cells`);
    console.log(`[Matrix] SUMMARY: Final assessments created: ${assessments.length}`);
    
    if (assessments.length === 0) {
      console.log(`[Matrix] ERROR: No assessments were parsed! Check matrix sheet format.`);
    }
    
    return assessments;
  } catch (error) {
    console.error('[Matrix] Parse error:', error.message);
    console.error('[Matrix] Stack:', error.stack);
    return [];
  }
}

/**
 * Parse a flat assessment sheet into assessment records
 */
function parseAssessmentSheet(sheet, headers) {
  try {
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    
    const assessments = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const assessment = {};
      
      headers.forEach((header, index) => {
        assessment[header] = row[index] || '';
      });
      
      if (assessment.id) {
        assessments.push(assessment);
      }
    }
    
    return assessments;
  } catch (error) {
    console.error('[Assessment] Parse error:', error.message);
    return [];
  }
}

/**
 * Get all assessments from all sources (class sheets + general sheet)
 * Merges and deduplicates by assessment ID
 * Handles both matrix sheets (Grade_Assessments_*) and flat sheets (Class_*_Assessment)
 */
function getAllAssessmentsIncludingClassSheets() {
  try {
    const allAssessments = [];
    const seenIds = new Set();
    
    // Fetch from all class sheets first (highest priority)
    const classSheets = getAllClassAssessmentSheets();
    for (const sheetName of classSheets) {
      try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) continue;
        
        const data = sheet.getDataRange().getValues();
        if (data.length <= 1) continue;
        
        let sheetAssessments = [];
        
        // Check if this is a matrix sheet (Grade_Assessments_*)
        if (sheetName.startsWith('Grade_Assessments_')) {
          // Parse sheet name to get grade, term, examType
          const nameMatch = sheetName.match(/Grade_Assessments_(.+)_(T\d)_(.+)/);
          if (nameMatch) {
            const grade = nameMatch[1].replace(/_/g, ' ');
            const term = nameMatch[2];
            const examType = nameMatch[3];
            sheetAssessments = parseMatrixSheet(sheet, grade, term, examType, '2025/2026');
          }
        } else {
          // Flat assessment sheet
          sheetAssessments = parseAssessmentSheet(sheet, ASSESSMENT_HEADERS);
        }
        
        // Add to result, avoiding duplicates
        for (const assessment of sheetAssessments) {
          if (assessment.id && !seenIds.has(assessment.id)) {
            seenIds.add(assessment.id);
            allAssessments.push(assessment);
          }
        }
      } catch (e) {
        console.warn(`[Assessment] Error reading ${sheetName}:`, e.message);
      }
    }
    
    // Then fetch from general Assessments sheet
    const generalAssessments = getAllRecords(SHEET_NAMES.ASSESSMENTS, ASSESSMENT_HEADERS);
    for (const assessment of generalAssessments) {
      if (assessment.id && !seenIds.has(assessment.id)) {
        seenIds.add(assessment.id);
        allAssessments.push(assessment);
      }
    }
    
    console.log(`[Assessment] Total assessments (all sources): ${allAssessments.length}`);
    return allAssessments;
  } catch (error) {
    console.error('[Assessment] Error fetching all assessments:', error.message);
    return getAllRecords(SHEET_NAMES.ASSESSMENTS, ASSESSMENT_HEADERS);
  }
}

// ==================== UTILITY FUNCTIONS ====================

function getGrades() {
  const students = getAllRecords(SHEET_NAMES.STUDENTS, STUDENT_HEADERS);
  const grades = [...new Set(students.map(s => s.grade))];
  return grades.sort();
}

function getSubjects() {
  const assessments = getAllRecords(SHEET_NAMES.ASSESSMENTS, ASSESSMENT_HEADERS);
  const subjects = [...new Set(assessments.map(a => a.subject))];
  return subjects.sort();
}

function sanitizeRecord(record) {
  if (!record || typeof record !== 'object') return {};
  
  const sanitized = {};
  
  const stringFields = ['id', 'name', 'grade', 'stream', 'admissionNo', 'admissionDate', 'upiNo', 'assessmentNo', 'parentContact', 'selectedFees', 
                        'subject', 'term', 'examType', 'academicYear', 'date', 'level', 'status',
                        'receiptNo', 'method', 'reference', 'role', 'employeeNo', 'nssfNo', 'shifNo', 'taxNo',
                        'voided', 'voidedBy', 'studentId', 'studentAdmissionNo', 'studentName', 'category', 'previousArrears', 'rawScore', 'maxScore', 'religion', 'portraitUrl'];
  
  const numericFields = ['score', 'amount'];
  
  stringFields.forEach(field => {
    if (record[field] !== undefined && record[field] !== null) {
      let value = String(record[field]).slice(0, 500);
      value = value.replace(/[<>]/g, '');
      sanitized[field] = value;
    }
  });
  
  numericFields.forEach(field => {
    if (record[field] !== undefined && record[field] !== null) {
      const num = Number(record[field]);
      sanitized[field] = isNaN(num) ? 0 : num;
    }
  });
  
  Object.keys(record).forEach(key => {
    if (!sanitized[key] && record[key] !== undefined && !stringFields.includes(key) && !numericFields.includes(key)) {
      const val = record[key];
      if (typeof val === 'object') {
        sanitized[key] = JSON.stringify(val).slice(0, 2000);
      } else if (typeof val === 'number' || typeof val === 'boolean') {
        sanitized[key] = val;
      }
    }
  });
  
  return sanitized;
}

function testSetup() {
  const result = initializeSheets();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets().map(s => s.getName());
  
  return {
    success: true,
    sheets: sheets,
    studentCount: getAllRecords(SHEET_NAMES.STUDENTS, STUDENT_HEADERS).length,
    assessmentCount: getAllRecords(SHEET_NAMES.ASSESSMENTS, ASSESSMENT_HEADERS).length,
    teacherCount: getAllRecords(SHEET_NAMES.TEACHERS, TEACHER_HEADERS).length,
    paymentCount: getAllRecords(SHEET_NAMES.PAYMENTS, PAYMENT_HEADERS).length
  };
}

function createJsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getHeadersForSheet(sheetName) {
  const headersMap = {
    [SHEET_NAMES.STUDENTS]: STUDENT_HEADERS,
    [SHEET_NAMES.ASSESSMENTS]: ASSESSMENT_HEADERS,
    [SHEET_NAMES.ATTENDANCE]: ATTENDANCE_HEADERS,
    [SHEET_NAMES.TEACHERS]: TEACHER_HEADERS,
    [SHEET_NAMES.STAFF]: STAFF_HEADERS,
    [SHEET_NAMES.PAYMENTS]: PAYMENT_HEADERS,
    [SHEET_NAMES.CALENDAR]: CALENDAR_HEADERS
  };
  return headersMap[sheetName] || [];
}

// ==================== DOGET & DOPOST HANDLERS ====================

/**
 * Handle CORS preflight requests
 */
function doOptions(e) {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doGet(e) {
  // Initialize sheets first to ensure headers exist
  try {
    initializeSheets();
  } catch (err) {
    console.log('[Script] Warning during sheet init:', err);
  }
  
  const rateCheck = checkRateLimit();
  if (rateCheck) {
    return createJsonResponse(rateCheck);
  }
  
  const action = e?.parameter?.action || 'getAll';
  let response = {};
  
  console.log(`[Script] Action: ${action}, Time: ${new Date().toISOString()}`);
  
  try {
    let postData = {};
    let parseError = null;
    
    if (e?.parameter?.data) {
      try {
        postData = JSON.parse(decodeURIComponent(e.parameter.data));
        console.log('[Script] Parsed postData:', Object.keys(postData));
      } catch (err) {
        parseError = err.message;
        try {
          postData = JSON.parse(e.parameter.data);
        } catch (err2) {
          parseError = err.message + ' | ' + err2.message;
        }
      }
    }
    
    if (parseError) {
      console.log('[Script] Data parse warning:', parseError);
    }
    
    // Sanitize all record types
    if (postData && postData.record) {
      postData.record = sanitizeRecord(postData.record);
    }
    if (postData && postData.assessment) {
      postData.assessment = sanitizeRecord(postData.assessment);
    }
    if (postData && postData.student) {
      postData.student = sanitizeRecord(postData.student);
    }
    if (postData && postData.payment) {
      postData.payment = sanitizeRecord(postData.payment);
    }
    if (postData && postData.teacher) {
      postData.teacher = sanitizeRecord(postData.teacher);
    }
    if (postData && postData.staff) {
      postData.staff = sanitizeRecord(postData.staff);
    }
    
    // Handle addAssessment via GET
    if (action === 'addAssessment' && postData.assessment) {
      const assessment = postData.assessment;
      if (!assessment.id) {
        assessment.id = 'A-' + Date.now();
      }
      if (!assessment.date) {
        assessment.date = new Date().toISOString().split('T')[0];
      }
      response = addRecord(SHEET_NAMES.ASSESSMENTS, assessment, ASSESSMENT_HEADERS,
        e?.parameter?.userId, e?.parameter?.userName, e?.parameter?.userRole);
      return createJsonResponse(response);
    }
    
    // Handle addStudent via GET - with fallback for direct parameters
    if (action === 'addStudent') {
      let student = postData.student || postData.record; // Support both keys

      // Fallback: if postData parsing failed, try reading from direct parameters
      if (!student && e?.parameter?.student) {
        try {
          student = JSON.parse(decodeURIComponent(e.parameter.student));
        } catch (err) {
          try { student = JSON.parse(e.parameter.student); } catch (err2) {}
        }
      }

      console.log('[Script] addStudent - Student data received:', student ? 'YES' : 'NO');
      console.log('[Script] addStudent - Student name:', student?.name);
      console.log('[Script] addStudent - Student ID:', student?.id);
      console.log('[Script] addStudent - Portrait URL:', student?.portraitUrl || student?.portrait);

      if (student) {
        // Ensure student has ID
        if (!student.id && student.admissionNo) student.id = student.admissionNo;

        // Handle portrait field mapping - ensure portraitUrl is set
        if (!student.portraitUrl && student.portrait) {
          student.portraitUrl = student.portrait;
          console.log('[Script] Mapped portrait to portraitUrl');
        }

        console.log('[Script] Adding/Updating student:', student.name, student.id);
        response = addRecord(SHEET_NAMES.STUDENTS, student, STUDENT_HEADERS,
          e?.parameter?.userId, e?.parameter?.userName, e?.parameter?.userRole);
        console.log('[Script] addRecord response:', response);
        return createJsonResponse(response);
      } else {
        console.log('[Script] ERROR: No student data found');
        return createJsonResponse({ success: false, error: 'No student data found' });
      }
    }
    
    // Handle addAttendance via GET
    if (action === 'addAttendance' && postData.attendance) {
      response = addRecord(SHEET_NAMES.ATTENDANCE, postData.attendance, ATTENDANCE_HEADERS,
        e?.parameter?.userId, e?.parameter?.userName, e?.parameter?.userRole);
      return createJsonResponse(response);
    }

    // Handle addTeacher via GET
    if (action === 'addTeacher' && postData.teacher) {
      const teacher = postData.teacher;
      if (!teacher.id) {
        teacher.id = 'T-' + Date.now();
      }
      response = addRecord(SHEET_NAMES.TEACHERS, teacher, TEACHER_HEADERS,
        e?.parameter?.userId, e?.parameter?.userName, e?.parameter?.userRole);
      return createJsonResponse(response);
    }

    // Handle addStaff via GET
    if (action === 'addStaff' && postData.staff) {
      const staff = postData.staff;
      if (!staff.id) {
        staff.id = 'S-' + Date.now();
      }
      response = addRecord(SHEET_NAMES.STAFF, staff, STAFF_HEADERS,
        e?.parameter?.userId, e?.parameter?.userName, e?.parameter?.userRole);
      return createJsonResponse(response);
    }
    
    // Handle addPayment via GET
    if (action === 'addPayment' && postData.payment) {
      const payment = postData.payment;
      if (!payment.id) {
        payment.id = 'PAY-' + Date.now();
      }
      if (!payment.date) {
        payment.date = new Date().toISOString().split('T')[0];
      }
      response = addRecord(SHEET_NAMES.PAYMENTS, payment, PAYMENT_HEADERS,
        e?.parameter?.userId, e?.parameter?.userName, e?.parameter?.userRole);
      return createJsonResponse(response);
    }

    // Handle addCalendar via GET
    if (action === 'addCalendar' && postData.calendar) {
      const event = postData.calendar;
      if (!event.id) {
        event.id = 'EVT-' + Date.now();
      }
      response = addRecord(SHEET_NAMES.CALENDAR, event, CALENDAR_HEADERS,
        e?.parameter?.userId, e?.parameter?.userName, e?.parameter?.userRole);
      return createJsonResponse(response);
    }

    // Handle photo gallery records via GET (stored in Calendar sheet with type='photo_gallery')
    if (action === 'addPhotoGallery' && postData) {
      const photoRecord = postData;
      if (!photoRecord.id) {
        photoRecord.id = 'PHOTO-' + Date.now();
      }
      if (!photoRecord.updatedAt) {
        photoRecord.updatedAt = new Date().toISOString();
      }
      console.log('[Script] addPhotoGallery - Photo for student:', photoRecord.studentId, photoRecord.name);
      response = addRecord(SHEET_NAMES.CALENDAR, photoRecord, CALENDAR_HEADERS,
        e?.parameter?.userId, e?.parameter?.userName, e?.parameter?.userRole);
      return createJsonResponse(response);
    }

    // Handle generic addRecord via GET
    if (action === 'addRecord') {
      const sheetName = postData.sheetName;
      const record = postData.record;
      if (sheetName && record) {
        let headers = getHeadersForSheet(sheetName);
        if (headers.length > 0) {
          response = addRecord(sheetName, record, headers,
            e?.parameter?.userId, e?.parameter?.userName, e?.parameter?.userRole);
          return createJsonResponse(response);
        }
      }
      return createJsonResponse({ success: false, error: 'Invalid sheet or record' });
    }
     
    // Handle deleteRecord via GET
    if (action === 'deleteRecord') {
      const sheetName = e?.parameter?.sheetName || postData.sheetName;
      const recordId = e?.parameter?.recordId || postData.recordId;
      if (sheetName && recordId) {
        const headers = getHeadersForSheet(sheetName);
        response = deleteRecord(sheetName, 'id', recordId, headers,
          e?.parameter?.userId, e?.parameter?.userName, e?.parameter?.userRole);
        return createJsonResponse(response);
      }
    }

    // Handle deleteAssessment via GET
    if (action === 'deleteAssessment') {
      const recordId = e?.parameter?.recordId || postData.recordId;
      if (recordId) {
        response = deleteRecord(SHEET_NAMES.ASSESSMENTS, 'id', recordId, ASSESSMENT_HEADERS,
          e?.parameter?.userId, e?.parameter?.userName, e?.parameter?.userRole);
        return createJsonResponse(response);
      }
    }

    // Handle deleteStudent via GET
    if (action === 'deleteStudent') {
      const recordId = e?.parameter?.recordId || postData.recordId;
      if (recordId) {
        response = deleteRecord(SHEET_NAMES.STUDENTS, 'id', recordId, STUDENT_HEADERS,
          e?.parameter?.userId, e?.parameter?.userName, e?.parameter?.userRole);
        return createJsonResponse(response);
      }
    }
    
    // Handle deletePayment via GET
    if (action === 'deletePayment') {
      const recordId = e?.parameter?.recordId || postData.recordId;
      if (recordId) {
        response = deleteRecord(SHEET_NAMES.PAYMENTS, 'id', recordId, PAYMENT_HEADERS,
          e?.parameter?.userId, e?.parameter?.userName, e?.parameter?.userRole);
        return createJsonResponse(response);
      }
    }

    // Handle deleteTeacher via GET
    if (action === 'deleteTeacher') {
      const recordId = e?.parameter?.recordId || postData.recordId;
      if (recordId) {
        response = deleteRecord(SHEET_NAMES.TEACHERS, 'id', recordId, TEACHER_HEADERS,
          e?.parameter?.userId, e?.parameter?.userName, e?.parameter?.userRole);
        return createJsonResponse(response);
      }
    }

    // Handle deleteStaff via GET
    if (action === 'deleteStaff') {
      const recordId = e?.parameter?.recordId || postData.recordId;
      if (recordId) {
        response = deleteRecord(SHEET_NAMES.STAFF, 'id', recordId, STAFF_HEADERS,
          e?.parameter?.userId, e?.parameter?.userName, e?.parameter?.userRole);
        return createJsonResponse(response);
      }
    }

    // Handle logActivity via GET
    if (action === 'logActivity') {
      let activityData = {};
      if (e?.parameter?.data) {
        try {
          activityData = JSON.parse(decodeURIComponent(e.parameter.data));
        } catch (err) {
          try { activityData = JSON.parse(e.parameter.data); } catch (err2) {}
        }
      }
      response = logUserActivity(activityData);
      return createJsonResponse(response);
    }

    // Handle getRecentActivities via GET
    if (action === 'getRecentActivities') {
      const limit = parseInt(e?.parameter?.limit) || 50;
      const module = e?.parameter?.module || null;
      const userId = e?.parameter?.userId || null;
      const activities = getRecentActivities(limit, module, userId);
      return createJsonResponse({ success: true, activities: activities });
    }

    // Handle getActivitySummary via GET
    if (action === 'getActivitySummary') {
      const days = parseInt(e?.parameter?.days) || 7;
      const summary = getActivitySummary(days);
      return createJsonResponse({ success: true, summary: summary });
    }

    // Handle clearActivityLog via GET
    if (action === 'clearActivityLog') {
      response = clearActivityLog();
      return createJsonResponse(response);
    }

    // Handle getTeacherCredentials via GET
    if (action === 'getTeacherCredentials') {
      const teachers = getTeacherCredentials();
      return createJsonResponse({ success: true, teachers: teachers });
    }

    // Handle registerTeacher via GET
    if (action === 'registerTeacher') {
      const credentials = {
        username: e?.parameter?.username || '',
        password: e?.parameter?.password || '',
        teacherId: e?.parameter?.teacherId || '',
        name: e?.parameter?.name || '',
        role: e?.parameter?.role || 'teacher',
        subjects: e?.parameter?.subjects || '',
        grades: e?.parameter?.grades || '',
        classTeacherGrade: e?.parameter?.classTeacherGrade || '',
        religion: e?.parameter?.religion || ''
      };
      response = registerTeacher(credentials);
      return createJsonResponse(response);
    }

    // Handle loginTeacher via GET
    if (action === 'loginTeacher') {
      const credentials = {
        username: e?.parameter?.username || '',
        password: e?.parameter?.password || ''
      };
      response = loginTeacher(credentials);
      return createJsonResponse(response);
    }

    // Handle deleteTeacher via GET (already added above)
    
    // Handle setActive via GET
    if (action === 'setActive') {
      const device = e?.parameter?.device || '';
      const timestamp = e?.parameter?.timestamp || '';
      response = setActiveUser(device, timestamp);
      return createJsonResponse(response);
    }

    // Handle getActiveUsers via GET
    if (action === 'getActiveUsers') {
      response = getActiveUsers();
      return createJsonResponse(response);
    }
    
    // Handle ping for connection testing
    if (action === 'ping') {
      response = {
        success: true,
        message: 'Connection successful',
        timestamp: new Date().toISOString(),
        serverTime: new Date().getTime(),
        sheetStatus: getSheetHealthCheck()
      };
      return createJsonResponse(response);
    }
    
    switch (action) {
      case 'getAll':
        response = {
          success: true,
          timestamp: new Date().toISOString(),
          students: getAllRecords(SHEET_NAMES.STUDENTS, STUDENT_HEADERS),
          assessments: getAllAssessmentsIncludingClassSheets(),
          attendance: getAllRecords(SHEET_NAMES.ATTENDANCE, ATTENDANCE_HEADERS),
          teachers: getAllRecords(SHEET_NAMES.TEACHERS, TEACHER_HEADERS),
          staff: getAllRecords(SHEET_NAMES.STAFF, STAFF_HEADERS),
          payments: getAllRecords(SHEET_NAMES.PAYMENTS, PAYMENT_HEADERS),
          calendar: getAllRecords(SHEET_NAMES.CALENDAR, CALENDAR_HEADERS, false),
          settings: getSettings().settings || {}
        };
        break;

      case 'getSettings':
        response = getSettings();
        break;
        
      case 'getCalendar':
        response = { success: true, calendar: getAllRecords(SHEET_NAMES.CALENDAR, CALENDAR_HEADERS, false) };
        break;
        
      case 'getStudents':
        response = { success: true, students: getAllRecords(SHEET_NAMES.STUDENTS, STUDENT_HEADERS) };
        break;
        
      case 'getAssessments':
        const term = e?.parameter?.term;
        const grade = e?.parameter?.grade;
        const examType = e?.parameter?.examType;
        const academicYear = e?.parameter?.academicYear;
        
        // Use class-aware fetching with fallback to general assessments
        let assessments = getAssessmentsWithClassFallback(grade, term, examType, academicYear);
        
        // If no assessments from class sheet, try general sheet as final fallback
        if (assessments.length === 0) {
          assessments = getAllRecords(SHEET_NAMES.ASSESSMENTS, ASSESSMENT_HEADERS);
          
          if (term) {
            assessments = assessments.filter(a => a.term === term);
          }
          if (grade) {
            const students = getAllRecords(SHEET_NAMES.STUDENTS, STUDENT_HEADERS);
            const gradeStudentIds = students.filter(s => s.grade === grade).map(s => s.id);
            assessments = assessments.filter(a => gradeStudentIds.includes(a.studentId));
          }
          if (examType) {
            assessments = assessments.filter(a => a.examType === examType);
          }
          if (academicYear) {
            assessments = assessments.filter(a => !a.academicYear || a.academicYear === academicYear);
          }
        }
        
        response = { success: true, assessments: assessments };
        break;
        
      case 'getAttendance':
        let attendance = getAllRecords(SHEET_NAMES.ATTENDANCE, ATTENDANCE_HEADERS);
        const attTerm = e?.parameter?.term;
        if (attTerm) {
          attendance = attendance.filter(a => a.term === attTerm);
        }
        response = { success: true, attendance: attendance };
        break;
        
      case 'getTeachers':
        response = { success: true, teachers: getAllRecords(SHEET_NAMES.TEACHERS, TEACHER_HEADERS) };
        break;
        
      case 'getStaff':
        response = { success: true, staff: getAllRecords(SHEET_NAMES.STAFF, STAFF_HEADERS) };
        break;
        
      case 'getPayments':
        response = { success: true, payments: getAllRecords(SHEET_NAMES.PAYMENTS, PAYMENT_HEADERS) };
        break;
        
      case 'getClassSheets':
        response = { 
          success: true, 
          classSheets: getAllClassAssessmentSheets(),
          count: getAllClassAssessmentSheets().length
        };
        break;
        
      case 'classSheetExists':
        const csGrade = e?.parameter?.grade;
        const csStream = e?.parameter?.stream;
        const exists = classSheetExists(csGrade, csStream);
        response = { 
          success: true, 
          exists: exists,
          grade: csGrade,
          stream: csStream,
          sheetName: exists ? getClassSheetName(csGrade, csStream) : null
        };
        break;
        
      case 'debugGradeSheets':
        // List all Grade_Assessments sheets and their data counts
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const allSheets = ss.getSheets();
        const gradeSheets = allSheets
          .filter(s => s.getName().startsWith('Grade_Assessments_'))
          .map(s => ({
            name: s.getName(),
            rows: s.getLastRow() - 1,
            cols: s.getLastColumn()
          }));
        
        response = {
          success: true,
          gradeSheets: gradeSheets,
          count: gradeSheets.length,
          message: `Found ${gradeSheets.length} Grade_Assessments sheets`
        };
        break;
        
      case 'debugAssessments':
        // Show what's currently in the Assessments sheet
        const assessmentSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ASSESSMENTS);
        const assData = assessmentSheet ? assessmentSheet.getDataRange().getValues() : [];
        const assHeaders = assData.length > 0 ? assData[0] : [];
        
        response = {
          success: true,
          assessmentSheet: {
            name: SHEET_NAMES.ASSESSMENTS,
            totalRows: assData.length,
            dataRows: assData.length - 1,
            columns: assHeaders,
            preview: assData.slice(0, Math.min(6, assData.length))
          },
          message: `Assessments sheet has ${assData.length - 1} data rows`
        };
        break;
        
      case 'debugSyncTest':
        // Test the sync for a specific matrix sheet
        const testSheetName = e?.parameter?.sheetName;
        if (!testSheetName) {
          response = { success: false, error: 'sheetName parameter required' };
        } else {
          const testSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(testSheetName);
          if (!testSheet) {
            response = { success: false, error: `Sheet "${testSheetName}" not found` };
          } else {
            const testData = testSheet.getDataRange().getValues();
            const testParsed = parseMatrixSheet(testSheet, 'TEST_GRADE', 'T1', 'Opener', '2025/2026');
            response = {
              success: true,
              sheetName: testSheetName,
              rawData: {
                rows: testData.length,
                headers: testData[0],
                preview: testData.slice(0, 3)
              },
              parsed: {
                count: testParsed.length,
                preview: testParsed.slice(0, 3)
              }
            };
          }
        }
        break;
        
      case 'forceReloadAll':
        // Force clear cache and reload all data fresh
        dataCache.removeAll();
        console.log('[Debug] Cache cleared');
        response = {
          success: true,
          assessments: getAllAssessmentsIncludingClassSheets(),
          students: getAllRecords(SHEET_NAMES.STUDENTS, STUDENT_HEADERS),
          message: 'Data reloaded fresh from sheets (cache cleared)'
        };
        break;
        
      case 'fetchMatrixSheet':
        // Fetch raw data from a specific matrix sheet
        const matrixSheetName = e?.parameter?.sheetName;
        if (!matrixSheetName) {
          response = { success: false, error: 'Missing sheetName parameter' };
        } else {
          const matrixSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(matrixSheetName);
          if (!matrixSheet) {
            response = { success: false, error: `Sheet "${matrixSheetName}" not found` };
          } else {
            const matrixData = matrixSheet.getDataRange().getValues();
            response = {
              success: true,
              sheetName: matrixSheetName,
              totalRows: matrixData.length,
              totalCols: matrixData[0] ? matrixData[0].length : 0,
              headers: matrixData[0] || [],
              preview: matrixData.slice(0, 6) // First 5 data rows + header
            };
          }
        }
        break;
        
      case 'getAssessmentsFromSheet':
        // Manually fetch assessments from a specific Grade_Assessments sheet
        const sheetToFetch = e?.parameter?.sheetName;
        const gradeParam = e?.parameter?.grade || '';
        const termParam = e?.parameter?.term || '';
        const examTypeParam = e?.parameter?.examType || '';
        
        if (!sheetToFetch) {
          response = { success: false, error: 'Missing sheetName parameter' };
        } else {
          const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetToFetch);
          if (!sheet) {
            response = { success: false, error: `Sheet "${sheetToFetch}" not found` };
          } else {
            const assessmentsFromMatrix = parseMatrixSheet(sheet, gradeParam, termParam, examTypeParam, '2025/2026');
            response = {
              success: true,
              sheetName: sheetToFetch,
              grade: gradeParam,
              term: termParam,
              examType: examTypeParam,
              totalAssessments: assessmentsFromMatrix.length,
              assessments: assessmentsFromMatrix.slice(0, 10) // First 10
            };
          }
        }
        break;
        
      case 'ping':
        response = { success: true, message: 'EduTrack Google Sync is active!', version: SCRIPT_VERSION, timestamp: new Date().toISOString() };
        break;
        
      case 'setActive':
        response = setActiveUser(e?.parameter?.device, e?.parameter?.timestamp);
        break;
        
      case 'getActiveUsers':
        response = getActiveUsers();
        break;
        
      case 'getAllIds':
        response = getAllIds(e?.parameter?.sheetName);
        break;
        
      case 'getGrades':
        response = { success: true, grades: getGrades() };
        break;
        
      case 'getSubjects':
        response = { success: true, subjects: getSubjects() };
        break;
        
      case 'getRecentActivities':
        response = { 
          success: true, 
          activities: getRecentActivities(
            parseInt(e?.parameter?.limit) || 50,
            e?.parameter?.module || null,
            e?.parameter?.userId || null
          ) 
        };
        break;
        
      case 'getActivitySummary':
        response = { success: true, summary: getActivitySummary(parseInt(e?.parameter?.days) || 7) };
        break;
        
      case 'clearActivityLog':
        response = clearActivityLog();
        break;
        
      case 'registerTeacher':
        let regData = {};
        if (e?.parameter?.data) {
          try {
            regData = JSON.parse(decodeURIComponent(e.parameter.data));
          } catch (err) {
            try {
              regData = JSON.parse(e.parameter.data);
            } catch (err2) {}
          }
        }
        response = registerTeacher({
          username: regData.username || e?.parameter?.username,
          password: regData.password || e?.parameter?.password,
          teacherId: regData.teacherId || e?.parameter?.teacherId,
          name: regData.name || e?.parameter?.name,
          role: regData.role || e?.parameter?.role,
          subjects: regData.subjects || e?.parameter?.subjects,
          grades: regData.grades || e?.parameter?.grades,
          classTeacherGrade: regData.classTeacherGrade || e?.parameter?.classTeacherGrade,
          religion: regData.religion || e?.parameter?.religion
        });
        break;
        
      case 'loginTeacher':
        let loginData = {};
        if (e?.parameter?.data) {
          try {
            loginData = JSON.parse(decodeURIComponent(e.parameter.data));
          } catch (err) {
            try {
              loginData = JSON.parse(e.parameter.data);
            } catch (err2) {}
          }
        }
        response = loginTeacher({
          username: loginData.username || e?.parameter?.username,
          password: loginData.password || e?.parameter?.password
        });
        break;
        
      case 'getTeacherCredentials':
        response = { success: true, teachers: getTeacherCredentials() };
        break;
        
      case 'bulkPushStudents':
        let studentData = {};
        if (e?.parameter?.data) {
          try {
            studentData = JSON.parse(e.parameter.data);
          } catch (err) {
            return createJsonResponse({ error: 'Invalid JSON data' });
          }
        }
        response = bulkPushRecords(SHEET_NAMES.STUDENTS, studentData.students || [], STUDENT_HEADERS,
          e?.parameter?.userId, e?.parameter?.userName, e?.parameter?.userRole);
        break;
        
      case 'bulkPushAssessments':
        let assessData = {};
        if (e?.parameter?.data) {
          try {
            assessData = JSON.parse(e.parameter.data);
          } catch (err) {
            return createJsonResponse({ error: 'Invalid JSON data' });
          }
        }
        response = bulkPushRecords(SHEET_NAMES.ASSESSMENTS, assessData.assessments || [], ASSESSMENT_HEADERS,
          e?.parameter?.userId, e?.parameter?.userName, e?.parameter?.userRole);
        break;
        
      case 'bulkPushAttendance':
        let attData = {};
        if (e?.parameter?.data) {
          try {
            attData = JSON.parse(e.parameter.data);
          } catch (err) {
            return createJsonResponse({ error: 'Invalid JSON data' });
          }
        }
        response = bulkPushRecords(SHEET_NAMES.ATTENDANCE, attData.attendance || [], ATTENDANCE_HEADERS,
          e?.parameter?.userId, e?.parameter?.userName, e?.parameter?.userRole);
        break;
        
      case 'bulkPushPayments':
        let paymentData = {};
        if (e?.parameter?.data) {
          try {
            paymentData = JSON.parse(e.parameter.data);
          } catch (err) {
            return createJsonResponse({ error: 'Invalid JSON data' });
          }
        }
        response = bulkPushRecords(SHEET_NAMES.PAYMENTS, paymentData.payments || [], PAYMENT_HEADERS,
          e?.parameter?.userId, e?.parameter?.userName, e?.parameter?.userRole);
        break;
        
      case 'createBackup':
        response = createBackup(e?.parameter?.sheetName);
        break;
        
      case 'restoreBackup':
        response = restoreFromBackup(e?.parameter?.backupName, e?.parameter?.targetSheet);
        break;
        
      case 'backfillAssessmentStudentData':
        response = backfillAssessmentStudentData();
        break;
        
      case 'migrateAssessmentStudentIds':
        response = migrateAssessmentStudentIds();
        break;
        
      case 'addMissingColumns':
        response = addMissingColumnsToSheets();
        break;
        
      case 'testSetup':
        response = testSetup();
        break;
        
      // Matrix operations via GET
      case 'CREATE_MATRIX':
        let matrixSubjects = [];
        if (e?.parameter?.subjects) {
          try {
            const rawSubs = e.parameter.subjects;
            if (typeof rawSubs === 'string') {
              try { 
                matrixSubjects = JSON.parse(decodeURIComponent(rawSubs)); 
              } catch (e1) { 
                matrixSubjects = JSON.parse(rawSubs); 
              }
            } else {
              matrixSubjects = rawSubs;
            }
          } catch (err) {
            console.error('Subject parsing error:', err);
            matrixSubjects = [];
          }
        }
        if (!Array.isArray(matrixSubjects)) matrixSubjects = [];
        response = processMatrixRequest('CREATE_MATRIX', e?.parameter?.grade, e?.parameter?.term, e?.parameter?.examType, null, matrixSubjects);
        break;
        
      case 'UPDATE_MATRIX_CELL':
        response = processMatrixRequest('UPDATE_MATRIX_CELL', e?.parameter?.studentId, e?.parameter?.subject, e?.parameter?.score, e?.parameter?.grade, e?.parameter?.term, e?.parameter?.examType);
        break;
        
      case 'SYNC_MATRIX':
        response = processMatrixRequest('SYNC_MATRIX', null, null, null, e?.parameter?.sheetName);
        break;
        
      case 'LIST_MATRICES':
        response = processMatrixRequest('LIST_MATRICES', null, null, null, null);
        break;
        
      case 'DELETE_MATRIX':
        response = processMatrixRequest('DELETE_MATRIX', null, null, null, e?.parameter?.sheetName);
        break;

      case 'loginParent':
        response = loginParent(e?.parameter?.admissionNo, e?.parameter?.studentName);
        break;
        
      default:
        response = { success: false, error: 'Unknown action: ' + action };
    }
  } catch (error) {
    console.error('doGet error:', error);
    response = { success: false, error: error.message };
  }
  
  return createJsonResponse(response);
}

function doPost(e) {
  // Initialize sheets first to ensure headers exist
  try {
    initializeSheets();
  } catch (err) {
    console.log('[Script] Warning during sheet init:', err);
  }
  
  const rateCheck = checkRateLimit();
  if (rateCheck) {
    return createJsonResponse(rateCheck);
  }
  
  let data = {};
  
  try {
    const urlAction = e?.parameter?.action;
    
    if (e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        const params = e.parameter;
        data = {
          action: params?.action,
          sheetName: params?.sheetName,
          records: params?.records ? JSON.parse(params.records) : [],
          headers: params?.headers ? JSON.parse(params.headers) : []
        };
      }
    } else if (e.parameter) {
      const params = e.parameter;
      data = {
        action: params?.action,
        sheetName: params?.sheetName,
        records: params?.records ? JSON.parse(params.records) : [],
        headers: params?.headers ? JSON.parse(params.headers) : []
      };
    }
    
    if (urlAction && !data.action) {
      data.action = urlAction;
    }
    
    const action = data.action || 'unknown';
    console.log('POST action:', action);
    
    let response = {};
    
    switch (action) {
      case 'addStudent':
        console.log('[POST] addStudent - Student name:', data.student?.name);
        console.log('[POST] addStudent - Student ID:', data.student?.id);
        console.log('[POST] addStudent - Portrait URL:', data.student?.portraitUrl || data.student?.portrait);
        // Handle portrait field mapping - ensure portraitUrl is set
        if (!data.student.portraitUrl && data.student.portrait) {
          data.student.portraitUrl = data.student.portrait;
          console.log('[POST] Mapped portrait to portraitUrl');
        }
        response = addRecord(SHEET_NAMES.STUDENTS, data.student, STUDENT_HEADERS,
          data.userId, data.userName, data.userRole);
        console.log('[POST] addRecord response:', response);
        break;
        
      case 'updateStudent':
        response = updateRecord(SHEET_NAMES.STUDENTS, 'id', data.student.id, data.student, STUDENT_HEADERS,
          data.userId, data.userName, data.userRole);
        break;
        
      case 'addAssessment':
        if (!data.assessment.id) {
          data.assessment.id = 'A-' + Date.now();
        }
        if (!data.assessment.date) {
          data.assessment.date = new Date().toISOString().split('T')[0];
        }
        response = addRecord(SHEET_NAMES.ASSESSMENTS, data.assessment, ASSESSMENT_HEADERS,
          data.userId, data.userName, data.userRole);
        break;
        
      case 'updateAssessment':
        response = updateRecord(SHEET_NAMES.ASSESSMENTS, 'id', data.assessment.id, data.assessment, ASSESSMENT_HEADERS,
          data.userId, data.userName, data.userRole);
        break;
        
      case 'addAttendance':
        if (!data.attendance.id) {
          data.attendance.id = 'ATT-' + Date.now();
        }
        response = addRecord(SHEET_NAMES.ATTENDANCE, data.attendance, ATTENDANCE_HEADERS,
          data.userId, data.userName, data.userRole);
        break;
        
      case 'updateAttendance':
        response = updateRecord(SHEET_NAMES.ATTENDANCE, 'id', data.attendance.id, data.attendance, ATTENDANCE_HEADERS,
          data.userId, data.userName, data.userRole);
        break;

      case 'addTeacher':
        if (!data.teacher.id) {
          data.teacher.id = 'T-' + Date.now();
        }
        response = addRecord(SHEET_NAMES.TEACHERS, data.teacher, TEACHER_HEADERS,
          data.userId, data.userName, data.userRole);
        break;

      case 'updateTeacher':
        response = updateRecord(SHEET_NAMES.TEACHERS, 'id', data.teacher.id, data.teacher, TEACHER_HEADERS,
          data.userId, data.userName, data.userRole);
        break;

      case 'addStaff':
        if (!data.staff.id) {
          data.staff.id = 'S-' + Date.now();
        }
        response = addRecord(SHEET_NAMES.STAFF, data.staff, STAFF_HEADERS,
          data.userId, data.userName, data.userRole);
        break;

      case 'updateStaff':
        response = updateRecord(SHEET_NAMES.STAFF, 'id', data.staff.id, data.staff, STAFF_HEADERS,
          data.userId, data.userName, data.userRole);
        break;

      case 'addPayment':
        if (!data.payment.id) {
          data.payment.id = 'PAY-' + Date.now();
        }
        if (!data.payment.date) {
          data.payment.date = new Date().toISOString().split('T')[0];
        }
        response = addRecord(SHEET_NAMES.PAYMENTS, data.payment, PAYMENT_HEADERS,
          data.userId, data.userName, data.userRole);
        break;

      case 'updatePayment':
        response = updateRecord(SHEET_NAMES.PAYMENTS, 'id', data.payment.id, data.payment, PAYMENT_HEADERS,
          data.userId, data.userName, data.userRole);
        break;
        
      case 'bulkAddAssessments':
        response = bulkPushRecords(SHEET_NAMES.ASSESSMENTS, data.assessments, ASSESSMENT_HEADERS,
          data.userId, data.userName, data.userRole);
        break;
        
      case 'syncAll':
        response = {
          success: true,
          students: getAllRecords(SHEET_NAMES.STUDENTS, STUDENT_HEADERS),
          assessments: getAllRecords(SHEET_NAMES.ASSESSMENTS, ASSESSMENT_HEADERS),
          attendance: getAllRecords(SHEET_NAMES.ATTENDANCE, ATTENDANCE_HEADERS),
          teachers: getAllRecords(SHEET_NAMES.TEACHERS, TEACHER_HEADERS),
          staff: getAllRecords(SHEET_NAMES.STAFF, STAFF_HEADERS),
          payments: getAllRecords(SHEET_NAMES.PAYMENTS, PAYMENT_HEADERS)
        };
        break;
        
      case 'replaceAll':
        response = replaceAllRecords(data.sheetName, data.records, data.headers,
          data.userId, data.userName, data.userRole);
        break;

      case 'updateRecord':
        const uSheet = data.sheetName;
        let uHeaders = getHeadersForSheet(uSheet);
        
        if (uHeaders.length > 0 && data.record && data.record.id) {
          response = updateRecord(uSheet, 'id', data.record.id, data.record, uHeaders,
            data.userId, data.userName, data.userRole);
        } else {
          response = { success: false, error: 'Invalid sheet or record' };
        }
        break;
        
      case 'deleteRecord':
        const dSheet = data.sheetName || SHEET_NAMES.ASSESSMENTS;
        const dHeaders = getHeadersForSheet(dSheet);
        response = deleteRecord(dSheet, 'id', data.recordId, dHeaders,
          data.userId, data.userName, data.userRole);
        break;
        
      case 'deleteAssessment':
        response = deleteRecord(SHEET_NAMES.ASSESSMENTS, 'id', data.recordId, ASSESSMENT_HEADERS,
          data.userId, data.userName, data.userRole);
        break;
        
      case 'deleteStudent':
        response = deleteRecord(SHEET_NAMES.STUDENTS, 'id', data.recordId, STUDENT_HEADERS,
          data.userId, data.userName, data.userRole);
        break;
        
      case 'deleteTeacher':
        response = deleteRecord(SHEET_NAMES.TEACHERS, 'id', data.recordId, TEACHER_HEADERS,
          data.userId, data.userName, data.userRole);
        break;
        
      case 'deleteStaff':
        response = deleteRecord(SHEET_NAMES.STAFF, 'id', data.recordId, STAFF_HEADERS,
          data.userId, data.userName, data.userRole);
        break;
        
      case 'deletePayment':
        response = deleteRecord(SHEET_NAMES.PAYMENTS, 'id', data.recordId, PAYMENT_HEADERS,
          data.userId, data.userName, data.userRole);
        break;
        
      case 'bulkPushStudents':
        response = bulkPushRecords(SHEET_NAMES.STUDENTS, data.students || [], STUDENT_HEADERS,
          data.userId, data.userName, data.userRole);
        break;
        
      case 'bulkPushAssessments':
        response = bulkPushRecords(SHEET_NAMES.ASSESSMENTS, data.assessments || [], ASSESSMENT_HEADERS,
          data.userId, data.userName, data.userRole);
        break;
        
      case 'bulkPushAttendance':
        response = bulkPushRecords(SHEET_NAMES.ATTENDANCE, data.attendance || [], ATTENDANCE_HEADERS,
          data.userId, data.userName, data.userRole);
        break;

      case 'bulkPushPayments':
        response = bulkPushRecords(SHEET_NAMES.PAYMENTS, data.payments || [], PAYMENT_HEADERS,
          data.userId, data.userName, data.userRole);
        break;
        
      case 'setActive':
        response = setActiveUser(data.device, data.timestamp);
        break;
        
      case 'getActiveUsers':
        response = getActiveUsers();
        break;
        
      case 'syncAllToGoogle':
        if (!data.data || !data.headers) {
          response = { success: false, error: 'Missing data or headers' };
          break;
        }
        
        const results = {};
        for (const [key, records] of Object.entries(data.data)) {
          const sheetKey = key.toUpperCase();
          const sheetName = SHEET_NAMES[sheetKey];
          const headers = data.headers[key];
          
          if (sheetName && headers) {
            results[key] = bulkPushRecords(sheetName, records, headers,
              data.userId, data.userName, data.userRole);
          }
        }
        response = { success: true, message: 'Batch sync complete', results };
        break;
        
      case 'getAll':
        response = {
          success: true,
          students: getAllRecords(SHEET_NAMES.STUDENTS, STUDENT_HEADERS),
          assessments: getAllAssessmentsIncludingClassSheets(),
          attendance: getAllRecords(SHEET_NAMES.ATTENDANCE, ATTENDANCE_HEADERS),
          teachers: getAllRecords(SHEET_NAMES.TEACHERS, TEACHER_HEADERS),
          staff: getAllRecords(SHEET_NAMES.STAFF, STAFF_HEADERS),
          payments: getAllRecords(SHEET_NAMES.PAYMENTS, PAYMENT_HEADERS),
          parents: getAllRecords(SHEET_NAMES.PARENTS, PARENT_HEADERS),
          calendar: getAllRecords(SHEET_NAMES.CALENDAR, CALENDAR_HEADERS),
          settings: getSettings().settings || {}
        };
        break;

      case 'setSettings':
        console.log('[doPost] setSettings called with data:', JSON.stringify(data));
        console.log('[doPost] data.settings keys:', data.settings ? Object.keys(data.settings) : 'undefined');
        console.log('[doPost] data.settings.feeStructures:', data.settings?.feeStructures?.length || 0);
        response = setSettings(data.settings, data.updatedBy || 'admin');
        break;
        
      case 'registerTeacher':
        response = registerTeacher({
          username: data.username,
          password: data.password,
          teacherId: data.teacherId,
          name: data.name,
          role: data.role,
          subjects: data.subjects,
          grades: data.grades,
          classTeacherGrade: data.classTeacherGrade,
          religion: data.religion
        });
        break;
        
      case 'loginTeacher':
        response = loginTeacher({
          username: data.username,
          password: data.password
        });
        break;

      case 'loginParent':
        response = loginParent(data.admissionNo, data.studentName);
        break;
        
      case 'getTeacherCredentials':
        response = { success: true, teachers: getTeacherCredentials() };
        break;
        
      case 'deleteTeacherAccount':
        response = deleteTeacherAccount(data.username);
        break;
        
      case 'logActivity':
        response = logUserActivity(data);
        break;
        
      case 'getRecentActivities':
        response = { 
          success: true, 
          activities: getRecentActivities(
            parseInt(data.limit) || 50,
            data.module || null,
            data.userId || null
          ) 
        };
        break;
        
      case 'getActivitySummary':
        response = { success: true, summary: getActivitySummary(parseInt(data.days) || 7) };
        break;
        
      case 'clearActivityLog':
        response = clearActivityLog();
        break;
        
      case 'getGrades':
        response = { success: true, grades: getGrades() };
        break;
        
      case 'getSubjects':
        response = { success: true, subjects: getSubjects() };
        break;
        
      case 'createBackup':
        response = createBackup(data.sheetName);
        break;
        
      case 'restoreBackup':
        response = restoreFromBackup(data.backupName, data.targetSheet);
        break;
        
      case 'testSetup':
        response = testSetup();
        break;
        
      // Matrix operations (from AssessmentMatrix.gs)
      case 'CREATE_MATRIX':
        response = processMatrixRequest('CREATE_MATRIX', data.grade, data.term, data.examType, null, data.subjects);
        break;
        
      case 'UPDATE_MATRIX_CELL':
        response = processMatrixRequest('UPDATE_MATRIX_CELL', data.studentId, data.subject, data.score, data.grade, data.term, data.examType);
        break;
        
      case 'SYNC_MATRIX':
        response = processMatrixRequest('SYNC_MATRIX', null, null, null, data.sheetName);
        break;
        
      case 'LIST_MATRICES':
        response = processMatrixRequest('LIST_MATRICES', null, null, null, null);
        break;
        
      case 'DELETE_MATRIX':
        response = processMatrixRequest('DELETE_MATRIX', null, null, null, data.sheetName);
        break;
        
      default:
        response = { success: false, error: 'Unknown action: ' + action };
    }
    
    return createJsonResponse(response);
  } catch (error) {
    console.error('doPost error:', error);
    return createJsonResponse({ success: false, error: error.message });
  }
}

// ==================== INITIALIZATION ====================

function onOpen() {
  initializeSheets();
}

// ==================== MATRIX OPERATIONS ====================

function processMatrixRequest(action, param1, param2, param3, param4, param5) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'CREATE_MATRIX') {
      const grade = param1, term = param2, examType = param3;
      const subjects = param5 || [];
      // SHORTENED PREFIX TO STAY UNDER 31 CHAR LIMIT
      const sheetName = `MX_${grade}_${term}_${examType}`.replace(/\//g, '-').replace(/\s+/g, '_').substring(0, 31);

      // Get all students for this grade - BYPASS CACHE TO BE SURE
      const allStudents = getAllRecords(SHEET_NAMES.STUDENTS, STUDENT_HEADERS, false);
      
      const normalize = (g) => {
        let val = String(g || '').toUpperCase().trim();
        // Handle PP <=> Pre-Primary aliases - FIXED: normalize BEFORE removing GRADE/CLASS
        val = val.replace(/PRE-PRIMARY/gi, 'PP')
                 .replace(/PRE\s+PRIMARY/gi, 'PP')
                 .replace(/PREPRIMARY/gi, 'PP')
                 .replace(/BABY\s+CLASS/gi, 'PP1')
                 .replace(/BABYCLASS/gi, 'PP1')
                 .replace(/NURSERY/gi, 'PP2')
                 .replace(/RECEPTION/gi, 'PP2')
                 .replace(/KINDERGARTEN/gi, 'PP');
        // Handle common variations - remove spaces FIRST to catch compound names
        val = val.replace(/\s+/g, '')  // Remove all whitespace
                 .replace(/GRADE/g, '')
                 .replace(/CLASS/g, '')
                 .trim();
        return val;
      };

      const searchGrade = String(grade || '').toUpperCase().trim();
      if (!searchGrade || searchGrade === 'UNDEFINED' || searchGrade === '') {
        return { success: false, error: 'Grade parameter is missing. Please select a Grade/Class first.' };
      }
      const searchGradeNorm = normalize(searchGrade);
      // Extra fuzzy: if PP1, look for just the number
      const searchNumber = searchGrade.replace(/[^0-9]/g, '');

      console.log(`[Matrix] Creating for: "${searchGrade}" (Norm: "${searchGradeNorm}", Num: "${searchNumber}")`);
      console.log(`[Matrix] Total system students: ${allStudents.length}`);

      let students = allStudents.filter(s => {
        const sGrade = String(s.grade || '').toUpperCase().trim();
        const sGradeNorm = normalize(sGrade);
        
        // Strategy 1: Exact match (case-insensitive via toUpperCase)
        const isExactMatch = sGrade === searchGrade;
        // Strategy 2: Normalized match (after alias conversion)
        const isNormMatch = sGradeNorm === searchGradeNorm;
        // Strategy 3: Partial match (useful for "Grade 8" vs "GRADE8")
        const isPartialMatch = sGradeNorm.startsWith(searchGradeNorm) || searchGradeNorm.startsWith(sGradeNorm);
        // Strategy 4: Special handling for early years (PP1, PP2, BABY CLASS, NURSERY, etc.)
        const isEarlyYears = (searchGradeNorm === 'PP1' || searchGradeNorm === 'PP2' || searchGradeNorm === 'BABYCLASS') && 
                            (sGradeNorm === 'PP1' || sGradeNorm === 'PP2' || sGradeNorm === 'BABYCLASS' ||
                             sGrade.includes('BABY') || sGrade.includes('NURSERY') || 
                             sGrade.includes('RECEPTION') || sGrade.includes('KINDERGARTEN'));

        return isExactMatch || isNormMatch || isPartialMatch || (searchGrade.includes('PP') && isEarlyYears);
      });

      // RESCUE MODE: If still 0, try even fuzzier (numeric match for early years)
      if (students.length === 0 && searchNumber.length > 0) {
        console.log(`[Matrix] Entering Rescue Mode for grade ${searchGrade}...`);
        students = allStudents.filter(s => {
          const sGrad = String(s.grade || '').toUpperCase();
          const sGradNorm = normalize(sGrad);
          // For early years, also check normalized versions
          return sGrad.includes(searchGrade) || sGrad.includes(searchNumber) || 
                 sGradNorm.includes(searchGradeNorm) || sGradNorm.includes(searchNumber);
        });
      }

      // FINAL RESCUE: If searching for PP1/PP2/BABY CLASS and still getting 0, be very aggressive
      if (students.length === 0 && (searchGradeNorm === 'PP1' || searchGradeNorm === 'PP2' || searchGradeNorm === 'BABYCLASS')) {
        console.log(`[Matrix] FINAL RESCUE MODE for early years: ${searchGrade}...`);
        students = allStudents.filter(s => {
          const sGrad = String(s.grade || '').toUpperCase();
          const sGradNorm = normalize(sGrad);
          // Match any early years student if searching for early years
          return sGrad.match(/PP1|PP2|BABY|NURSERY|RECEPTION|KINDERGARTEN|PRE-PRIMARY|PRE PRIMARY|PREPRIMARY/) ? true : false;
        });
        // If still nothing, keep only the ones that match our search
        students = students.filter(s => {
          const sGrad = String(s.grade || '').toUpperCase();
          const sGradNorm = normalize(sGrad);
          return sGradNorm === searchGradeNorm;
        });
      }

      console.log(`[Matrix] Students matched: ${students.length}`);
      
      // LOG DIAGNOSTICS to the sheet for the user to see
      logUserActivity({
        userId: 'SYSTEM',
        userName: 'MatrixEngine',
        userRole: 'admin',
        action: 'DIAGNOSTIC',
        module: 'Matrix',
        details: `Grade: ${searchGrade} | Matched: ${students.length}/${allStudents.length} | First 5 system grades: ${allStudents.slice(0, 5).map(x => x.grade).join(', ')}`
      });

      if (students.length === 0 && allStudents.length > 0) {
        const sampleGrades = [...new Set(allStudents.slice(0, 30).map(s => s.grade))].join(', ');
        return { 
          success: false, 
          error: `No students found for grade "${searchGrade}".`,
          foundGrades: sampleGrades,
          totalStudents: allStudents.length
        };
      }


      // Remove existing sheet to rebuild with error protection
      try {
        const existing = ss.getSheetByName(sheetName);
        if (existing) ss.deleteSheet(existing);
      } catch (e) {
        console.warn(`[Matrix] Delete existing sheet failed: ${e.message}`);
      }

      let sheet;
      try {
        sheet = ss.insertSheet(sheetName);
      } catch (e) {
        console.error(`[Matrix] Insert sheet failed: ${e.message}`);
        // Fallback: If 31 char limit is still an issue or name conflict
        const altName = `MX_${Date.now()}`.substring(0, 31);
        sheet = ss.insertSheet(altName);
        console.log(`[Matrix] Used fallback sheet name: ${altName}`);
      }

      // FIXED: If no subjects provided, retrieve them from settings or defaults
      let finalSubjects = subjects;
      if (!finalSubjects || finalSubjects.length === 0) {
        console.log(`[Matrix] No subjects provided, retrieving from Settings...`);
        // Try to get from Settings sheet
        const settingsSheet = ss.getSheetByName('Settings');
        if (settingsSheet) {
          const settingsData = settingsSheet.getDataRange().getValues();
          for (let i = 0; i < settingsData.length; i++) {
            if (settingsData[i][0] === 'gradeSubjects' && settingsData[i][1]) {
              try {
                const gradeSubjectsMap = JSON.parse(settingsData[i][1]);
                const normalizedSearchGrade = normalize(searchGrade);
                // Try to find subjects by various grade name matches
                for (const [key, value] of Object.entries(gradeSubjectsMap)) {
                  if (normalize(key) === normalizedSearchGrade || key === searchGrade) {
                    finalSubjects = Array.isArray(value) ? value : [];
                    console.log(`[Matrix] ✓ Found subjects in Settings for "${key}": ${finalSubjects.length} subjects`);
                    break;
                  }
                }
              } catch (e) {
                console.warn(`[Matrix] Settings gradeSubjects parse error: ${e.message}`);
              }
              break;
            }
          }
        }
        
        // If still no subjects, use defaults for the grade
        if (!finalSubjects || finalSubjects.length === 0) {
          console.log(`[Matrix] Using default subjects for grade: ${searchGrade}`);
          const defaults = getDefaultSubjectsForGrade(searchGrade);
          finalSubjects = defaults;
          console.log(`[Matrix] Default subjects: ${finalSubjects.join(', ')}`);
        }
      }

      // Header row: Admission No, Name, [subjects...]
      const headerRow = ['Admission No', 'Name', ...finalSubjects];
      console.log(`[Matrix] Writing headers with ${finalSubjects.length} subjects: ${JSON.stringify(headerRow.slice(0, 5))}...`);
      console.log(`[Matrix] Full header row:`, headerRow);
      sheet.appendRow(headerRow);

      // Header formatting - wrap in try catch to prevent total failure on formatting errors
      try {
        const headerRange = sheet.getRange(1, 1, 1, Math.max(1, headerRow.length));
        headerRange.setFontWeight('bold');
        headerRange.setBackground('#1a73e8');
        headerRange.setFontColor('#ffffff');
      } catch (e) {
        console.warn(`[Matrix] Header formatting failed: ${e.message}`);
      }

      // Get existing assessments for this grade/term/exam
      const allAssessments = getAllRecords(SHEET_NAMES.ASSESSMENTS, ASSESSMENT_HEADERS);
      const filteredAssessments = allAssessments.filter(a =>
        a.term === term && a.examType === examType
      );
      console.log(`[Matrix] Found ${filteredAssessments.length} assessments for ${term} ${examType}`);

      // Build student rows with existing scores
      console.log(`[Matrix] Building ${students.length} student rows...`);
      students.forEach((student, idx) => {
        const row = [student.admissionNo || student.id, student.name];
        finalSubjects.forEach(sub => {
          const found = filteredAssessments.find(a =>
            (String(a.studentId) === String(student.id) ||
             String(a.studentAdmissionNo || '').toLowerCase() === String(student.admissionNo || '').toLowerCase()) &&
            String(a.subject || '').toLowerCase() === String(sub || '').toLowerCase()
          );
          row.push(found ? found.score : '');
        });
        console.log(`[Matrix] Student ${idx + 1}/${students.length}: ${student.name} - Row:`, row);
        sheet.appendRow(row);
      });
      console.log(`[Matrix] All student rows appended`);

      // Auto-resize columns
      sheet.autoResizeColumns(1, headerRow.length);

      return {
        success: true,
        sheetName: sheetName,
        headers: finalSubjects.length,
        students: students.length,
        message: `Matrix sheet "${sheetName}" created with ${students.length} students and ${finalSubjects.length} subjects.`
      };
    }

    if (action === 'SYNC_MATRIX') {
      // param4 = sheetName of the matrix to sync back
      const sheetName = param4;
      if (!sheetName) return { success: false, error: 'No sheet name provided' };

      console.log(`\n================== SYNC MATRIX START ==================`);
      console.log(`[SYNC] Sheet name to sync: "${sheetName}"`);

      const matrixSheet = ss.getSheetByName(sheetName);
      if (!matrixSheet) {
        console.log(`[SYNC] ERROR: Sheet not found: "${sheetName}"`);
        return { success: false, error: `Sheet "${sheetName}" not found` };
      }

      console.log(`[SYNC] ✓ Matrix sheet found`);
      
      const matrixData = matrixSheet.getDataRange().getValues();
      console.log(`[SYNC] Matrix sheet has ${matrixData.length} rows, ${matrixData[0]?.length || 0} columns`);
      
      if (!matrixData || matrixData.length < 2) {
        console.log(`[SYNC] Matrix sheet is empty (less than 2 rows)`);
        return { success: true, imported: 0, message: 'No data rows found' };
      }

      // Parse sheet name to get grade/term/examType
      let grade = '', term = '', examType = '';
      
      const parts = sheetName.split('_');
      if (parts.length >= 4 && parts[0] === 'MX') {
        // Find term (T\d)
        let termIdx = -1;
        for (let i = 1; i < parts.length; i++) {
          if (parts[i].match(/^T\d+$/)) {
            termIdx = i;
            break;
          }
        }
        
        if (termIdx > 1) {
          grade = parts.slice(1, termIdx).join(' ');
          term = parts[termIdx];
          examType = parts.slice(termIdx + 1).join(' ');
        }
      }

      // Fallback: if parsing failed
      if (!grade || !term) {
        const nameMatch = sheetName.match(/MX_(.+)_(T\d+)_(.+)/) || sheetName.match(/Grade_Assessments_(.+)_(T\d+)_(.+)/);
        if (nameMatch) {
          grade = nameMatch[1].replace(/_/g, ' ');
          term = nameMatch[2];
          examType = nameMatch[3];
        } else {
          console.log(`[SYNC] ERROR: Could not parse sheet name: ${sheetName}`);
          return { success: false, error: `Could not parse sheet name: ${sheetName}` };
        }
      }

      console.log(`[SYNC] Parsed sheet name: Grade="${grade}", Term="${term}", ExamType="${examType}"`);

      // ⭐ USE THE PROVEN parseMatrixSheet FUNCTION
      console.log(`[SYNC] Calling parseMatrixSheet()...`);
      const parsedAssessments = parseMatrixSheet(matrixSheet, grade, term, examType, '2025/2026');
      
      console.log(`[SYNC] parseMatrixSheet returned ${parsedAssessments.length} assessments`);
      
      if (!parsedAssessments || parsedAssessments.length === 0) {
        console.log(`[SYNC] No valid assessments parsed from matrix sheet`);
        console.log(`[SYNC] This could mean:`);
        console.log(`[SYNC]  - Matrix sheet format is wrong (check headers and data)`);
        console.log(`[SYNC]  - Student IDs don't match system students`);
        console.log(`[SYNC]  - Subject names don't match configured subjects`);
        console.log(`[SYNC]  - Score values are not numbers`);
        return { success: true, imported: 0, message: 'Matrix sheet has no valid data', assessments: [] };
      }

      // Get Assessments sheet
      const assessmentsSheet = ss.getSheetByName(SHEET_NAMES.ASSESSMENTS);
      if (!assessmentsSheet) {
        console.log(`[SYNC] ERROR: Assessments sheet not found`);
        return { success: false, error: 'Assessments sheet not found' };
      }

      console.log(`[SYNC] ✓ Assessments sheet found`);

      // Get existing assessments
      const allAssessments = getAllRecords(SHEET_NAMES.ASSESSMENTS, ASSESSMENT_HEADERS, false);
      console.log(`[SYNC] Assessments sheet currently has ${allAssessments.length} records`);
      
      // Merge: Update existing or add new
      let updateCount = 0;
      let createdCount = 0;
      const finalAssessments = [...allAssessments]; // Start with all existing
      
      parsedAssessments.forEach(parsed => {
        // Find if this assessment already exists (by studentId + subject + term + examType)
        // LOOSE MATCHING to prevent duplicates if formatting varies
        const parsedTerm = String(parsed.term || '').toLowerCase().trim();
        const parsedExam = String(parsed.examType || '').toLowerCase().trim();
        const parsedSub = String(parsed.subject || '').toLowerCase().trim();
        const parsedSid = String(parsed.studentId || '').toLowerCase().trim();

        const existingIdx = finalAssessments.findIndex(a => {
          const aTerm = String(a.term || '').toLowerCase().trim();
          const aExam = String(a.examType || '').toLowerCase().trim();
          const aSub = String(a.subject || '').toLowerCase().trim();
          const aSid = String(a.studentId || '').toLowerCase().trim();
          const aAdm = String(a.studentAdmissionNo || '').toLowerCase().trim();

          const sMatch = aSid === parsedSid || aAdm === parsedSid;
          const subMatch = aSub === parsedSub;
          const termMatch = aTerm === parsedTerm || aTerm.includes(parsedTerm) || parsedTerm.includes(aTerm);
          const examMatch = aExam === parsedExam || aExam.includes(parsedExam) || parsedExam.includes(aExam);
          
          return sMatch && subMatch && termMatch && examMatch;
        });
        
        if (existingIdx !== -1) {
          // Update existing
          finalAssessments[existingIdx] = { ...finalAssessments[existingIdx], ...parsed };
          updateCount++;
          console.log(`[SYNC]   UPDATED: ${parsed.studentName} (${parsed.studentId}) - ${parsed.subject} = ${parsed.score}`);
        } else {
          // Add new
          finalAssessments.push(parsed);
          createdCount++;
          console.log(`[SYNC]   CREATED: ${parsed.studentName} (${parsed.studentId}) - ${parsed.subject} = ${parsed.score}`);
        }
      });

      console.log(`[SYNC] Merge complete: ${updateCount} updated, ${createdCount} created`);

      // Write back to Assessments sheet
      if (updateCount > 0 || createdCount > 0) {
        try {
          // Clear and rewrite
          assessmentsSheet.clearContents();
          console.log(`[SYNC] ✓ Cleared Assessments sheet`);
          
          if (finalAssessments.length > 0) {
            // Convert to array format for sheet
            const rows = [];
            rows.push(ASSESSMENT_HEADERS); // Add header row
            
            finalAssessments.forEach(a => {
              const row = ASSESSMENT_HEADERS.map(header => a[header] || '');
              rows.push(row);
            });
            
            // Write all rows
            assessmentsSheet.getRange(1, 1, rows.length, ASSESSMENT_HEADERS.length).setValues(rows);
            console.log(`[SYNC] ✓ Wrote ${rows.length} rows to Assessments sheet (header + ${finalAssessments.length} data)`);
          }
          
          // ⭐ CLEAR CACHE SO FRONTEND GETS FRESH DATA
          dataCache.remove(`records_${SHEET_NAMES.ASSESSMENTS}`);
          console.log(`[SYNC] ✓ Cache cleared for Assessments`);
          
          // Verify write
          const verifyRead = getAllRecords(SHEET_NAMES.ASSESSMENTS, ASSESSMENT_HEADERS, false);
          console.log(`[SYNC] ✓ VERIFICATION: Assessments sheet now has ${verifyRead.length} records`);
          
        } catch (writeErr) {
          console.error(`[SYNC] ERROR writing to Assessments sheet:`, writeErr.message);
          return { success: false, error: `Failed to write to Assessments sheet: ${writeErr.message}` };
        }
      }

      console.log(`[SYNC] ✓ SYNC COMPLETE`);
      console.log(`================== SYNC MATRIX END ==================\n`);

      return {
        success: true,
        imported: updateCount + createdCount,
        sheetName: sheetName,
        grade: grade,
        term: term,
        examType: examType,
        assessments: finalAssessments,
        message: `✓ Synced ${updateCount + createdCount} marks (${updateCount} updated, ${createdCount} created) from matrix sheet "${sheetName}"`
      };
    }

    if (action === 'UPDATE_MATRIX_CELL') {
      // param1=studentId, param2=subject, param3=score, param4=grade, param5=term, extra=examType
      // This is called per-cell when clicking save in the matrix view - just write to Assessments sheet
      return { success: true, message: 'Cell sync handled via addAssessment' };
    }

    if (action === 'LIST_MATRICES') {
      const sheets = ss.getSheets();
      const matrices = sheets
        .filter(s => s.getName().startsWith('MX_') || s.getName().startsWith('Grade_Assessments_'))
        .map(s => ({ name: s.getName(), rows: s.getLastRow() - 1 }));
      return { success: true, matrices: matrices };
    }

    if (action === 'DELETE_MATRIX') {
      const sheetName = param4;
      if (!sheetName) return { success: false, error: 'No sheet name provided' };
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) return { success: false, error: `Sheet "${sheetName}" not found` };
      ss.deleteSheet(sheet);
      return { success: true, message: `Deleted matrix sheet "${sheetName}"` };
    }

    return { success: false, error: `Unknown matrix action: ${action}` };
  } catch (err) {
    console.error('processMatrixRequest error:', err.message);
    return { success: false, error: err.message };
  }
}
