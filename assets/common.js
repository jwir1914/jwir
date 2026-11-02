/**
 * common.js — 세 화면(index / elder / secretary)이 함께 쓰는 기능
 *  - 서버 요청 (JW.api)
 *  - 로그인 토큰 저장 (PIN 숫자는 저장하지 않음)
 *  - 글자 안전 처리, 파일 다운로드
 */
window.JW = (function () {
  "use strict";

  const STAFF_KEY = "jw_staff_token";
  const PUB_PREFIX = "jw_pub_token_";
  const memory = {}; // 저장소를 쓸 수 없거나 "기억 안 함"일 때

  function lsGet(key) {
    try { return window.localStorage.getItem(key) || memory[key] || ""; }
    catch (e) { return memory[key] || ""; }
  }
  function lsSet(key, value) {
    memory[key] = value;
    try { window.localStorage.setItem(key, value); } catch (e) { /* 메모리만 사용 */ }
  }
  function lsRemove(key) {
    delete memory[key];
    try { window.localStorage.removeItem(key); } catch (e) { /* 무시 */ }
  }

  /* ---------- 토큰 ---------- */

  const getStaffToken = () => lsGet(STAFF_KEY);
  const setStaffToken = t => (t ? lsSet(STAFF_KEY, t) : lsRemove(STAFF_KEY));
  const clearStaffToken = () => lsRemove(STAFF_KEY);

  const getPubToken = id => (id ? lsGet(PUB_PREFIX + id) : "");
  /** remember=false 이면 이 화면을 닫을 때까지만 기억 */
  function setPubToken(id, t, remember) {
    if (!id || !t) return;
    if (remember === false) { memory[PUB_PREFIX + id] = t; return; }
    lsSet(PUB_PREFIX + id, t);
  }
  const clearPubToken = id => lsRemove(PUB_PREFIX + id);

  /* ---------- 서버 요청 ---------- */

  /**
   * @param {string} action
   * @param {object} payload
   * @param {{staff?: boolean, token?: string}} opts
   *   staff: 장로·서기 토큰을 자동으로 붙이고, 응답의 새 토큰을 저장. 로그인 만료 시 화면 새로고침
   */
  async function api(action, payload, opts) {
    opts = opts || {};
    const token = opts.token || (opts.staff ? getStaffToken() : "");
    let res;
    try {
      const r = await fetch(window.JW_CONFIG.API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: action, payload: payload || {}, token: token || undefined })
      });
      res = await r.json();
    } catch (e) {
      console.error("서버 통신 오류", action, e);
      return { success: false, code: "NETWORK", message: "서버에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요." };
    }

    if (opts.staff) {
      if (res && res.token) setStaffToken(res.token);
      if (res && res.code === "AUTH_REQUIRED") {
        clearStaffToken();
        if (!opts.noReload) {
          alert(res.message || "다시 로그인해 주세요.");
          location.reload();
        }
      }
    }
    return res || { success: false, code: "ERROR", message: "응답이 없습니다." };
  }

  /* ---------- 글자 안전 처리 ---------- */

  function esc(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /* ---------- 다운로드 ---------- */

  /** 서버의 { fileName, mimeType, base64 } 또는 { downloadUrl } 을 내려받기 */
  function download(res) {
    if (res.base64) {
      const bin = atob(res.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: res.mimeType || "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.fileName || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      return true;
    }
    if (res.downloadUrl) {
      window.open(res.downloadUrl, "_blank");
      return true;
    }
    return false;
  }

  /* ---------- 날짜 ---------- */

  function ym(d) {
    d = d || new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }

  function serviceYearOf(yearMonth) {
    const [y, m] = String(yearMonth).split("-").map(Number);
    return m >= 9 ? y + 1 : y;
  }

  return {
    api, esc, download, ym, serviceYearOf,
    getStaffToken, setStaffToken, clearStaffToken,
    getPubToken, setPubToken, clearPubToken
  };
})();
