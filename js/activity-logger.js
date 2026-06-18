/**
 * ACTIVITY LOGGER - SISTEM PENCATATAN AKTIVITAS UNIVERSAL
 * Mencatat semua aktivitas pengguna: login, logout, akses tugas, ujian, dll
 */

import { db } from "./firebase-config.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

class ActivityLogger {
  /**
   * Fungsi utama untuk mencatat aktivitas
   * @param {string} userId - UID pengguna
   * @param {string} userName - Nama pengguna
   * @param {string} activity - Jenis aktivitas (LOGIN, LOGOUT, VIEW_TASK, SUBMIT_TASK, VIEW_EXAM, SUBMIT_EXAM, DELETE_ACCOUNT, APPLY_LEAVE, dll)
   * @param {string} module - Modul/halaman yang diakses (Tugas, Ujian, Profil, Dashboard, dll)
   * @param {string} detail - Detail tambahan (nama tugas, id ujian, alasan cuti, dll)
   * @param {string} status - Status aktivitas (SUCCESS, FAILED, PENDING)
   */
  static async log(userId, userName, activity, module = "System", detail = "", status = "SUCCESS") {
    try {
      // Validasi input
      if (!userId || !userName || !activity) {
        console.warn("⚠️ ActivityLogger: Data tidak lengkap", { userId, userName, activity });
        return;
      }

      // Normalisasi nama aktivitas
      const activityNormalized = String(activity).toUpperCase().trim();

      // Siapkan payload
      const logPayload = {
        userId,
        studentUid: userId, // Alias untuk kompatibilitas
        studentName: userName,
        userName: userName, // Alias
        activity: activityNormalized,
        action: activityNormalized, // Alias untuk kompatibilitas dengan arsip.html
        module,
        context: module, // Alias
        detail,
        status,
        timestamp: serverTimestamp(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      };

      // Catat ke Firestore
      await addDoc(collection(db, "activity_logs"), logPayload);

      console.log(`✅ Activity Logged: ${activityNormalized} by ${userName}`);
    } catch (error) {
      console.error("❌ Error logging activity:", error);
      // Fail silently agar tidak mengganggu UX
    }
  }

  /**
   * Shortcut untuk mencatat login
   */
  static async logLogin(userId, userName, email) {
    await this.log(userId, userName, "LOGIN", "Authentication", email, "SUCCESS");
  }

  /**
   * Shortcut untuk mencatat logout
   */
  static async logLogout(userId, userName) {
    await this.log(userId, userName, "LOGOUT", "Authentication", "User signed out", "SUCCESS");
  }

  /**
   * Shortcut untuk mencatat akses tugas
   */
  static async logTaskAccess(userId, userName, taskId, taskTitle) {
    await this.log(userId, userName, "VIEW_TASK", "Tugas", `Task: ${taskTitle} (${taskId})`, "SUCCESS");
  }

  /**
   * Shortcut untuk mencatat pengiriman tugas
   */
  static async logTaskSubmit(userId, userName, taskId, taskTitle) {
    await this.log(userId, userName, "SUBMIT_TASK", "Tugas", `Task: ${taskTitle} (${taskId})`, "SUCCESS");
  }

  /**
   * Shortcut untuk mencatat akses ujian
   */
  static async logExamAccess(userId, userName, examId, examTitle) {
    await this.log(userId, userName, "VIEW_EXAM", "Ujian", `Exam: ${examTitle} (${examId})`, "SUCCESS");
  }

  /**
   * Shortcut untuk mencatat pengiriman ujian
   */
  static async logExamSubmit(userId, userName, examId, examTitle, score = null) {
    const detail = score !== null ? `Exam: ${examTitle} (${examId}) - Score: ${score}` : `Exam: ${examTitle} (${examId})`;
    await this.log(userId, userName, "SUBMIT_EXAM", "Ujian", detail, "SUCCESS");
  }

  /**
   * Shortcut untuk mencatat permohonan cuti
   */
  static async logLeaveRequest(userId, userName, leaveType, reason) {
    await this.log(userId, userName, "LEAVE_REQUEST", "Izin/Cuti", `Type: ${leaveType} - Reason: ${reason}`, "SUCCESS");
  }

  /**
   * Shortcut untuk mencatat penghapusan akun
   */
  static async logAccountDeletion(userId, userName) {
    await this.log(userId, userName, "DELETE_ACCOUNT", "Account", "User account deleted", "SUCCESS");
  }

  /**
   * Shortcut untuk mencatat akses profil
   */
  static async logProfileAccess(userId, userName) {
    await this.log(userId, userName, "VIEW_PROFILE", "Profil", "User accessed their profile", "SUCCESS");
  }

  /**
   * Shortcut untuk mencatat download KHS (dari fitur KHS lama yang mungkin masih ada)
   */
  static async logKHSDownload(userId, userName) {
    await this.log(userId, userName, "DOWNLOAD_KHS", "Akademik", "User downloaded KHS/Rapor", "SUCCESS");
  }

  /**
   * Shortcut untuk mencatat akses dashboard
   */
  static async logDashboardAccess(userId, userName) {
    await this.log(userId, userName, "DASHBOARD_ACCESS", "Dashboard", "User accessed main dashboard", "SUCCESS");
  }
}

export default ActivityLogger;
