// 소유자 라운지 API (Apps Script 웹앱) — mypage.html / login.html 이 POST(JSON)로 호출
// 원본: Desktop/clone/_apps_script/Code.gs (편집기에 붙여넣고 "배포 관리 → 기존 배포 수정"으로 올림)
// 필요 설정: 편집기 왼쪽 "서비스 +" → Drive API(v3, 식별자 Drive) 추가, setup() 1회 실행
//
// action: login | list | thumbs | preview | download
// 응답 형식은 NAS 이관 시 그대로 재구현할 수 있도록 고정해 둠(_apps_script/API.md 참고)

// ── 썸네일 · 새 자료(N) 설정 ──
var NEW_DAYS = 14;           // 업로드·수정 후 이 기간이 지나면 안 읽었어도 N 표시 안 함
var READS_KEEP_DAYS = 180;   // 읽음 기록 보관 기간(매일 새벽 정리)
var THUMB_SIZE = 400;        // 목록 썸네일 긴 변(px)
var PREVIEW_SIZE = 1600;     // 크게 보기 긴 변(px)
var READS_SHEET = 'reads';   // 읽음 기록 시트: 읽은 주체 | 파일ID | 클릭시각(ms) | 내용값(md5)
var FOLDER_MIME = 'application/vnd.google-apps.folder';
var FILE_FIELDS = 'id,name,mimeType,createdTime,modifiedTime,md5Checksum,size,thumbnailLink,parents';
var DAY_MS = 24 * 60 * 60 * 1000;

function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  var action = body.action || 'login';

  if (action === 'login') return handleLogin(body);
  if (action === 'list') return handleList(body);
  if (action === 'thumbs') return handleThumbs(body);
  if (action === 'preview') return handlePreview(body);
  if (action === 'download') return handleDownload(body);

  return jsonOutput({ success: false, message: 'invalid action' });
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// 최초 1회 편집기에서 실행: 읽음 기록 시트 생성 + 매일 정리 트리거 + 새 권한(Drive API·외부 요청) 승인
function setup() {
  getReadsSheet();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'pruneReads') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('pruneReads').timeBased().everyDays(1).atHour(4).create();
  Drive.Files.list({ pageSize: 1, fields: 'files(id)' });
  UrlFetchApp.fetch('https://www.google.com', { muteHttpExceptions: true });
}

function handleLogin(body) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('data');
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var col = {};
  headers.forEach(function (h, i) { col[h] = i; });

  var phone = (body.phone || '').replace(/[^0-9]/g, '');
  var password = (body.password || '').trim();

  for (var i = 1; i < data.length; i++) {
    var rowPhone = String(data[i][col['전화번호']]).replace(/[^0-9]/g, '');
    var rowPassword = String(data[i][col['비밀번호']]).trim();
    if (rowPhone === phone && rowPassword === password) {
      var role = col['권한'] !== undefined ? String(data[i][col['권한']]).trim().toUpperCase() : 'O';
      var name = col['이름'] !== undefined ? data[i][col['이름']] : '';
      var room = col['호실'] !== undefined ? data[i][col['호실']] : '';

      var token = Utilities.getUuid();
      var session = { phone: phone, name: name, room: room, role: role };
      CacheService.getScriptCache().put('session_' + token, JSON.stringify(session), 21600);

      return jsonOutput({ success: true, token: token, name: name, room: room, role: role });
    }
  }
  return jsonOutput({ success: false });
}

function getSession(token) {
  if (!token) return null;
  var raw = CacheService.getScriptCache().get('session_' + token);
  return raw ? JSON.parse(raw) : null;
}

function getAccessibleRoles(role) {
  if (role === 'A') return ['A', 'O'];
  return ['O'];
}

function getFolderMap() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('permission');
  var data = sheet.getDataRange().getValues();
  var map = {};
  for (var i = 0; i < data.length; i++) {
    var roleName = String(data[i][0]).trim().toUpperCase();
    var folderId = String(data[i][1]).trim();
    if (roleName) map[roleName] = folderId;
  }
  return map;
}

function getAllowedFolderIds(session, folderMap) {
  return getAccessibleRoles(session.role).map(function (r) { return folderMap[r]; }).filter(Boolean);
}

function putCache(key, obj, seconds) {
  try { CacheService.getScriptCache().put(key, JSON.stringify(obj), seconds); } catch (err) { /* 100KB 초과 등 — 캐시 없이 동작 */ }
}

// ── Drive API(v3) 조회 ──
function driveList(q, fields) {
  var out = [];
  var pageToken;
  do {
    var res = Drive.Files.list({
      q: q, fields: 'nextPageToken,files(' + fields + ')', pageSize: 1000,
      pageToken: pageToken, orderBy: 'folder,name',
      supportsAllDrives: true, includeItemsFromAllDrives: true
    });
    out = out.concat(res.files || []);
    pageToken = res.nextPageToken;
  } while (pageToken);
  return out;
}

function chunk(arr, size) {
  var out = [];
  for (var i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// 여러 폴더의 직속 항목(폴더+파일)을 한 번에 조회
function listChildren(folderIds, extraQuery, fields) {
  var out = [];
  chunk(folderIds, 30).forEach(function (ids) {
    var q = '(' + ids.map(function (id) { return "'" + id + "' in parents"; }).join(' or ') + ') and trashed = false';
    if (extraQuery) q += ' and (' + extraQuery + ')';
    out = out.concat(driveList(q, fields || FILE_FIELDS));
  });
  return out;
}

// N 판단에 쓰는 파일 상태값(짧은 키: 캐시 용량 절약)
function fileState(f, parentId) {
  return {
    id: f.id, p: parentId || '',
    c: Date.parse(f.createdTime), m: Date.parse(f.modifiedTime),
    h: f.md5Checksum || ''  // 사진·PDF 등 일반 파일만 있음, 구글 문서류는 없음
  };
}

// ── 폴더 트리 색인(10분 캐시) ──
// parentOf: 라운지 안 모든 폴더의 상위 폴더, recent: 최근 NEW_DAYS일 안에 올라오거나 바뀐 파일
// → 폴더 메뉴에 N(안에 새 자료 있음) 표시 + 폴더 접근 권한 확인을 Drive 재귀 조회 없이 처리
function getTreeIndex(folderMap) {
  var rootIds = Object.keys(folderMap).map(function (r) { return folderMap[r]; }).filter(Boolean).sort();
  var cacheKey = 'tree_' + Utilities.base64EncodeWebSafe(rootIds.join(',')).slice(0, 200);
  var raw = CacheService.getScriptCache().get(cacheKey);
  if (raw) return JSON.parse(raw);

  var parentOf = {};
  rootIds.forEach(function (id) { parentOf[id] = ''; });
  var since = new Date(Date.now() - NEW_DAYS * DAY_MS).toISOString();
  var recent = [];
  var frontier = rootIds.slice();
  while (frontier.length) {
    var next = [];
    var batch = listChildren(frontier,
      "mimeType = '" + FOLDER_MIME + "' or modifiedTime > '" + since + "' or createdTime > '" + since + "'",
      'id,mimeType,parents,createdTime,modifiedTime,md5Checksum');
    batch.forEach(function (f) {
      var p = (f.parents || []).filter(function (id) { return frontier.indexOf(id) !== -1; })[0] || '';
      if (f.mimeType === FOLDER_MIME) {
        if (!(f.id in parentOf)) { parentOf[f.id] = p; next.push(f.id); }
      } else {
        recent.push(fileState(f, p));
      }
    });
    frontier = next;
  }
  var index = { parentOf: parentOf, recent: recent };
  putCache(cacheKey, index, 600);
  return index;
}

function isAllowedFolderFast(folderId, allowedFolderIds, index) {
  if (folderId in index.parentOf) {
    for (var p = folderId; p; p = index.parentOf[p]) {
      if (allowedFolderIds.indexOf(p) !== -1) return true;
    }
    return false;
  }
  return isAllowedFolder(folderId, allowedFolderIds); // 방금 만든 폴더 등 색인에 아직 없으면 기존 방식으로 확인
}

function isInAllowedTree(item, allowedFolderIds) {
  var parents = item.getParents();
  while (parents.hasNext()) {
    var p = parents.next();
    if (allowedFolderIds.indexOf(p.getId()) !== -1) return true;
    if (isInAllowedTree(p, allowedFolderIds)) return true;
  }
  return false;
}

function isAllowedFolder(folderId, allowedFolderIds) {
  if (allowedFolderIds.indexOf(folderId) !== -1) return true;
  var folder = DriveApp.getFolderById(folderId);
  return isInAllowedTree(folder, allowedFolderIds);
}

// ── 읽음 기록 / N 판단 ──
// 호실 계정을 가족·직원이 함께 쓰므로 호실 단위로 기록(호실이 없는 계정은 전화번호 단위)
function readerKey(session) {
  return session.room ? 'R:' + session.room : 'P:' + session.phone;
}

function getReadsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(READS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(READS_SHEET);
    sheet.appendRow(['읽은주체', '파일ID', '클릭시각(ms)', '내용값(md5)']);
  }
  return sheet;
}

// { 파일ID: { t: 마지막 클릭시각, h: 클릭 당시 내용값 } } — 6시간 캐시, 클릭 시 캐시도 같이 갱신
function getReads(key) {
  var raw = CacheService.getScriptCache().get('reads_' + key);
  if (raw) return JSON.parse(raw);
  var map = {};
  var sheet = getReadsSheet();
  var last = sheet.getLastRow();
  if (last > 1) {
    sheet.getRange(2, 1, last - 1, 4).getValues().forEach(function (r) {
      if (String(r[0]) !== key) return;
      var t = Number(r[2]);
      if (!map[r[1]] || map[r[1]].t < t) map[r[1]] = { t: t, h: String(r[3] || '') };
    });
  }
  putCache('reads_' + key, map, 21600);
  return map;
}

function markRead(session, state) {
  var key = readerKey(session);
  var now = Date.now();
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    getReadsSheet().appendRow([key, state.id, now, state.h]);
    var map = getReads(key);
    map[state.id] = { t: now, h: state.h };
    putCache('reads_' + key, map, 21600);
  } finally {
    lock.releaseLock();
  }
}

// 업로드·수정 후 NEW_DAYS일 이내이면서
// - 이 호실이 한 번도 안 눌렀거나
// - 누른 뒤 파일 내용이 바뀐 경우(사진·PDF: md5 비교 → 이름 변경·이동은 무시 / 구글 문서류: 수정시각 비교)
function isNewFile(state, rec) {
  if (Math.max(state.c, state.m) < Date.now() - NEW_DAYS * DAY_MS) return false;
  if (!rec) return true;
  if (state.h && rec.h) return state.h !== rec.h;
  return state.m > rec.t;
}

// 새 자료가 들어 있는 폴더(상위 폴더 전부 포함)
function newFolderSet(index, reads) {
  var set = {};
  index.recent.forEach(function (f) {
    if (!isNewFile(f, reads[f.id])) return;
    for (var p = f.p; p; p = index.parentOf[p]) set[p] = true;
  });
  return set;
}

// 매일 새벽 트리거: 같은 호실·파일은 최신 1줄만, READS_KEEP_DAYS 지난 기록 삭제
function pruneReads() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getReadsSheet();
    var last = sheet.getLastRow();
    if (last < 2) return;
    var cutoff = Date.now() - READS_KEEP_DAYS * DAY_MS;
    var latest = {};
    sheet.getRange(2, 1, last - 1, 4).getValues().forEach(function (r) {
      var t = Number(r[2]);
      if (t < cutoff) return;
      var k = r[0] + '|' + r[1];
      if (!latest[k] || Number(latest[k][2]) < t) latest[k] = r;
    });
    var rows = Object.keys(latest).map(function (k) { return latest[k]; });
    sheet.getRange(2, 1, last - 1, 4).clearContent();
    if (rows.length) sheet.getRange(2, 1, rows.length, 4).setValues(rows);
  } finally {
    lock.releaseLock();
  }
}

// ── 목록 ──
function listFolderContents(folderId, category, reads, newFolders) {
  return listChildren([folderId]).map(function (f) {
    if (f.mimeType === FOLDER_MIME) {
      return { type: 'folder', id: f.id, name: f.name, category: category, isNew: !!newFolders[f.id] };
    }
    return {
      type: 'file', id: f.id, name: f.name, category: category,
      updated: f.modifiedTime, created: f.createdTime, mimeType: f.mimeType,
      size: f.size ? Number(f.size) : null, hasThumb: !!f.thumbnailLink,
      isNew: isNewFile(fileState(f), reads[f.id])
    };
  });
}

function handleList(body) {
  var session = getSession(body.token);
  if (!session) return jsonOutput({ success: false, message: 'unauthorized' });

  var folderMap = getFolderMap();
  var roles = getAccessibleRoles(session.role);
  var allowedFolderIds = getAllowedFolderIds(session, folderMap);
  var index = getTreeIndex(folderMap);
  var reads = getReads(readerKey(session));
  var newFolders = newFolderSet(index, reads);

  var folderId = body.folderId;

  if (!folderId) {
    // 최상위: 접근 가능한 권한 폴더들의 직속 항목을 합쳐서 보여줌
    var items = [];
    roles.forEach(function (r) {
      var fid = folderMap[r];
      if (!fid) return;
      items = items.concat(listFolderContents(fid, r, reads, newFolders));
    });
    return jsonOutput({ success: true, items: items });
  }

  if (!isAllowedFolderFast(folderId, allowedFolderIds, index)) {
    return jsonOutput({ success: false, message: 'forbidden' });
  }
  return jsonOutput({ success: true, items: listFolderContents(folderId, null, reads, newFolders) });
}

// ── 썸네일 / 크게 보기 ──
// 요청한 파일들이 (권한 있는) 해당 폴더의 직속 파일인지 확인하고 Drive 정보를 돌려줌. 권한 없으면 null
// folderId 없음 = 최상위(권한 폴더 바로 아래 파일)
function filesInFolder(session, folderId, fileIds) {
  var folderMap = getFolderMap();
  var allowedFolderIds = getAllowedFolderIds(session, folderMap);
  var parents = allowedFolderIds;
  if (folderId) {
    if (!isAllowedFolderFast(folderId, allowedFolderIds, getTreeIndex(folderMap))) return null;
    parents = [folderId];
  }
  var map = {};
  listChildren(parents, "mimeType != '" + FOLDER_MIME + "'").forEach(function (f) {
    if (fileIds.indexOf(f.id) !== -1) map[f.id] = f;
  });
  return map;
}

// Drive 썸네일 주소 끝의 =s220 을 원하는 크기로 바꿔서 요청(소유 계정 권한으로)
function thumbRequest(link, size) {
  var url = /=s\d+$/.test(link) ? link.replace(/=s\d+$/, '=s' + size) : link;
  return { url: url, headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true };
}

function responseToImage(res) {
  if (!res || res.getResponseCode() !== 200) return null;
  var blob = res.getBlob();
  var type = blob.getContentType() || '';
  if (type.indexOf('image/') !== 0) return null;
  return { mimeType: type, base64: Utilities.base64Encode(blob.getBytes()) };
}

// 썸네일 주소 요청이 실패하면 DriveApp 기본 썸네일(작은 크기)로 대체
function fallbackThumb(fileId) {
  try {
    var blob = DriveApp.getFileById(fileId).getThumbnail();
    return blob ? { mimeType: blob.getContentType() || 'image/png', base64: Utilities.base64Encode(blob.getBytes()) } : null;
  } catch (err) {
    return null;
  }
}

// 목록 썸네일: 한 번에 최대 20장, 6시간 캐시(같은 사진은 Drive에 다시 요청하지 않음)
function handleThumbs(body) {
  var session = getSession(body.token);
  if (!session) return jsonOutput({ success: false, message: 'unauthorized' });

  var ids = (body.fileIds || []).slice(0, 20);
  var files = filesInFolder(session, body.folderId, ids);
  if (!files) return jsonOutput({ success: false, message: 'forbidden' });

  var cache = CacheService.getScriptCache();
  var keyOf = {};
  ids.forEach(function (id) {
    var f = files[id];
    if (f) keyOf[id] = 'th' + THUMB_SIZE + '_' + id + '_' + (f.md5Checksum || f.modifiedTime);
  });
  var cached = cache.getAll(Object.keys(keyOf).map(function (id) { return keyOf[id]; }));

  var thumbs = {};
  var toFetch = [];
  Object.keys(keyOf).forEach(function (id) {
    if (cached[keyOf[id]]) thumbs[id] = JSON.parse(cached[keyOf[id]]);
    else if (files[id].thumbnailLink) toFetch.push(id);
  });

  var responses = toFetch.length
    ? UrlFetchApp.fetchAll(toFetch.map(function (id) { return thumbRequest(files[id].thumbnailLink, THUMB_SIZE); }))
    : [];
  var toCache = {};
  toFetch.forEach(function (id, i) {
    var img = responseToImage(responses[i]) || fallbackThumb(id);
    if (!img) return;
    thumbs[id] = img;
    var json = JSON.stringify(img);
    if (json.length < 95000) toCache[keyOf[id]] = json;
  });
  try { cache.putAll(toCache, 21600); } catch (err) { /* 캐시 실패는 무시 */ }

  // 썸네일이 아직 안 만들어진 사진(업로드 직후 등)은 응답에서 빠짐 → 화면에서 "준비 중"
  return jsonOutput({ success: true, thumbs: thumbs });
}

// 크게 보기: 1600px 이미지 + 읽음 처리
function handlePreview(body) {
  var session = getSession(body.token);
  if (!session) return jsonOutput({ success: false, message: 'unauthorized' });

  var files = filesInFolder(session, body.folderId, [body.fileId]);
  if (!files) return jsonOutput({ success: false, message: 'forbidden' });
  var f = files[body.fileId];
  if (!f) return jsonOutput({ success: false, message: 'not found' });

  var img = null;
  if (f.thumbnailLink) {
    var req = thumbRequest(f.thumbnailLink, PREVIEW_SIZE);
    img = responseToImage(UrlFetchApp.fetch(req.url, req));
  }
  // 썸네일이 없으면 원본(브라우저가 바로 보여줄 수 있는 형식 + 10MB 이하만)
  if (!img && /^image\/(jpeg|png|gif|webp)$/.test(f.mimeType) && Number(f.size || 0) <= 10 * 1024 * 1024) {
    var blob = DriveApp.getFileById(f.id).getBlob();
    img = { mimeType: f.mimeType, base64: Utilities.base64Encode(blob.getBytes()) };
  }
  if (!img) return jsonOutput({ success: false, message: 'no preview' });

  markRead(session, fileState(f));
  return jsonOutput({ success: true, name: f.name, mimeType: img.mimeType, base64: img.base64 });
}

function handleDownload(body) {
  var session = getSession(body.token);
  if (!session) return jsonOutput({ success: false, message: 'unauthorized' });

  var folderMap = getFolderMap();
  var allowedFolderIds = getAllowedFolderIds(session, folderMap);

  var file;
  try {
    file = DriveApp.getFileById(body.fileId);
  } catch (err) {
    return jsonOutput({ success: false, message: 'not found' });
  }

  if (!isInAllowedTree(file, allowedFolderIds)) {
    return jsonOutput({ success: false, message: 'forbidden' });
  }

  try {
    markRead(session, fileState(Drive.Files.get(body.fileId, { fields: FILE_FIELDS, supportsAllDrives: true })));
  } catch (err) { /* 읽음 기록 실패해도 다운로드는 진행 */ }

  var blob = file.getBlob();
  return jsonOutput({
    success: true,
    name: file.getName(),
    mimeType: blob.getContentType(),
    base64: Utilities.base64Encode(blob.getBytes())
  });
}
