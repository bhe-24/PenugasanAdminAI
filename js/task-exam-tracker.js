/**
 * TASK & EXAM ACTIVITY TRACKER
 * Mencatat aktivitas siswa saat mengakses dan mengirim tugas/ujian
 */

import ActivityLogger from "./activity-logger.js";

export class TaskExamTracker {
  /**
   * Log ketika siswa membuka halaman tugas
   */
  static async logTaskPageAccess(userId, userName, taskId, taskTitle) {
    await ActivityLogger.log(
      userId,
      userName,
      "VIEW_TASK",
      "Tugas",
      `Membuka: ${taskTitle} (ID: ${taskId})`,
      "SUCCESS"
    );
  }

  /**
   * Log ketika siswa mengirim jawaban tugas
   */
  static async logTaskSubmission(userId, userName, taskId, taskTitle, submissionTime) {
    await ActivityLogger.log(
      userId,
      userName,
      "SUBMIT_TASK",
      "Tugas",
      `Mengirim: ${taskTitle} (ID: ${taskId}) pada ${submissionTime}`,
      "SUCCESS"
    );
  }

  /**
   * Log ketika siswa membuka halaman ujian
   */
  static async logExamPageAccess(userId, userName, examId, examTitle) {
    await ActivityLogger.log(
      userId,
      userName,
      "VIEW_EXAM",
      "Ujian",
      `Membuka: ${examTitle} (ID: ${examId})`,
      "SUCCESS"
    );
  }

  /**
   * Log ketika siswa memulai ujian (klik tombol MULAI)
   */
  static async logExamStart(userId, userName, examId, examTitle, duration) {
    await ActivityLogger.log(
      userId,
      userName,
      "EXAM_START",
      "Ujian",
      `Memulai: ${examTitle} - Durasi: ${duration} menit (ID: ${examId})`,
      "SUCCESS"
    );
  }

  /**
   * Log ketika siswa mengirim/selesai ujian
   */
  static async logExamSubmission(userId, userName, examId, examTitle, score = null, totalQuestions = 0, correctAnswers = 0) {
    const detail = score !== null 
      ? `Mengirim: ${examTitle} - Skor: ${score}/100 (${correctAnswers}/${totalQuestions} benar) (ID: ${examId})`
      : `Mengirim: ${examTitle} (ID: ${examId})`;
    
    await ActivityLogger.log(
      userId,
      userName,
      "SUBMIT_EXAM",
      "Ujian",
      detail,
      "SUCCESS"
    );
  }

  /**
   * Log ketika siswa membuka hasil ujian
   */
  static async logExamResultView(userId, userName, examId, examTitle, score) {
    await ActivityLogger.log(
      userId,
      userName,
      "VIEW_EXAM_RESULT",
      "Ujian",
      `Melihat hasil: ${examTitle} - Skor: ${score}/100 (ID: ${examId})`,
      "SUCCESS"
    );
  }

  /**
   * Log ketika siswa membuka halaman kuis
   */
  static async logQuizAccess(userId, userName, quizId, quizTitle) {
    await ActivityLogger.log(
      userId,
      userName,
      "VIEW_QUIZ",
      "Kuis",
      `Mengakses: ${quizTitle} (ID: ${quizId})`,
      "SUCCESS"
    );
  }

  /**
   * Log ketika siswa mengirim kuis
   */
  static async logQuizSubmission(userId, userName, quizId, quizTitle, score = null) {
    const detail = score !== null 
      ? `Mengirim: ${quizTitle} - Skor: ${score}/100 (ID: ${quizId})`
      : `Mengirim: ${quizTitle} (ID: ${quizId})`;
    
    await ActivityLogger.log(
      userId,
      userName,
      "SUBMIT_QUIZ",
      "Kuis",
      detail,
      "SUCCESS"
    );
  }

  /**
   * Log ketika siswa mengunduh file (materi, dll)
   */
  static async logFileDownload(userId, userName, fileName, fileType = "Document") {
    await ActivityLogger.log(
      userId,
      userName,
      "DOWNLOAD_FILE",
      "Pustaka/Materi",
      `Mengunduh: ${fileName} (${fileType})`,
      "SUCCESS"
    );
  }

  /**
   * Log ketika siswa mengakses profil mereka
   */
  static async logProfileAccess(userId, userName) {
    await ActivityLogger.log(
      userId,
      userName,
      "VIEW_PROFILE",
      "Profil",
      "Melihat profil pribadi",
      "SUCCESS"
    );
  }

  /**
   * Log ketika siswa mengupdate profil
   */
  static async logProfileUpdate(userId, userName, fieldsUpdated) {
    await ActivityLogger.log(
      userId,
      userName,
      "UPDATE_PROFILE",
      "Profil",
      `Memperbarui: ${fieldsUpdated.join(", ")}`,
      "SUCCESS"
    );
  }

  /**
   * Log ketika siswa mengajukan izin/cuti
   */
  static async logLeaveApplication(userId, userName, leaveType, reason, startDate, endDate) {
    await ActivityLogger.log(
      userId,
      userName,
      "APPLY_LEAVE",
      "Izin/Cuti",
      `${leaveType} dari ${startDate} hingga ${endDate} - Alasan: ${reason}`,
      "SUCCESS"
    );
  }

  /**
   * Log ketika siswa membuka kartu studi
   */
  static async logStudyCardAccess(userId, userName, semester) {
    await ActivityLogger.log(
      userId,
      userName,
      "VIEW_STUDY_CARD",
      "Akademik",
      `Melihat Kartu Studi Semester ${semester}`,
      "SUCCESS"
    );
  }

  /**
   * Log ketika siswa mengakses KHS/Rapor
   */
  static async logReportAccess(userId, userName, reportType = "KHS") {
    await ActivityLogger.log(
      userId,
      userName,
      "VIEW_REPORT",
      "Akademik",
      `Mengakses ${reportType}`,
      "SUCCESS"
    );
  }

  /**
   * Log error atau aktivitas gagal
   */
  static async logError(userId, userName, action, module, errorMessage) {
    await ActivityLogger.log(
      userId,
      userName,
      action,
      module,
      `Error: ${errorMessage}`,
      "FAILED"
    );
  }
}

export default TaskExamTracker;
