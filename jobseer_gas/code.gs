// jobseer_gas/code.gs
// Main Entry Point untuk JobSeer GAS (Web App Backend)
// Update: CV extraction, email sender name, improved error handling, quota reset

function doPost(e) {
  try {
    // RESET API call counter at start of each request
    resetApiCallCount();

    checkQuota();
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    const payload = data.payload || {};

    validateInput(action);
    logInfo('doPost received', 'web', JSON.stringify(data));

    switch (action) {
      case 'process_image':
        return ContentService.createTextOutput(JSON.stringify(processImage(payload.file, payload.mode, payload.manualEmail))).setMimeType(ContentService.MimeType.JSON);
      case 'parse_text':
        return ContentService.createTextOutput(JSON.stringify(parseText(payload.text, payload.mode, payload.manualEmail))).setMimeType(ContentService.MimeType.JSON);
      case 'send_bulk':
        return ContentService.createTextOutput(JSON.stringify(sendBulk())).setMimeType(ContentService.MimeType.JSON);
      case 'get_bulk_nabung':
        return ContentService.createTextOutput(JSON.stringify(getBulkNabung())).setMimeType(ContentService.MimeType.JSON);
      case 'get_status_stats':
        return ContentService.createTextOutput(JSON.stringify(getStatusStats())).setMimeType(ContentService.MimeType.JSON);
      case 'get_profile':
        return ContentService.createTextOutput(JSON.stringify(getProfileData())).setMimeType(ContentService.MimeType.JSON);
      case 'save_profile':
        return ContentService.createTextOutput(JSON.stringify(saveProfileData(payload))).setMimeType(ContentService.MimeType.JSON);
      case 'upload_batch_screenshots':
        return ContentService.createTextOutput(JSON.stringify(uploadBatchScreenshots(payload))).setMimeType(ContentService.MimeType.JSON);
      case 'trigger_image_queue':
        return ContentService.createTextOutput(JSON.stringify(triggerImageQueue())).setMimeType(ContentService.MimeType.JSON);
      case 'trigger_parse_queue':
        return ContentService.createTextOutput(JSON.stringify(triggerParsingQueue())).setMimeType(ContentService.MimeType.JSON);
      default:
        return ContentService.createTextOutput('Invalid action').setMimeType(ContentService.MimeType.TEXT);
    }
  } catch (error) {
    logError('doPost error: ' + error.message);
    return ContentService.createTextOutput(JSON.stringify({ error: 'Gagal memproses, coba lagi ya!', details: error.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ==================== PROFILE MANAGEMENT ====================

// Get profile dari sheet
function getProfileData() {
  try {
    const profiles = getSheetData(SHEET_NAMES.PROFILES);
    return profiles.length > 0 ? profiles[0] : null;
  } catch (e) {
    logError('Get profile failed: ' + e.message);
    return null;
  }
}

// Save profile ke sheet dengan CV extraction
function saveProfileData(profileData) {
  try {
    checkQuota();
    validateInput(JSON.stringify(profileData));

    // Standardize field names
    const cvUrl = profileData.cvUrl || '';
    const customPrompt = profileData.customPrompt || '';
    const skills = profileData.skills || '';
    const experience = profileData.experience || '';

    // Extract CV info jika CV URL ada dan baru/berubah
    let extractedSkills = skills;
    let extractedExperience = experience;

    if (cvUrl && cvUrl.trim()) {
      logInfo('CV URL provided, attempting extraction...');
      try {
        const cvInfo = extractCVInfo(cvUrl);
        if (cvInfo && cvInfo.skills) {
          extractedSkills = cvInfo.skills || skills;
        }
        if (cvInfo && cvInfo.experiences) {
          extractedExperience = cvInfo.experiences || experience;
        }
      } catch (e) {
        logWarning('CV extraction failed, using manual input: ' + e.message);
      }
    }

    const existing = getSheetData(SHEET_NAMES.PROFILES);

    if (existing.length > 0) {
      // Update existing profile
      updateSheetRow(SHEET_NAMES.PROFILES, row => true, {
        name: profileData.name || '',
        email: profileData.email || '',
        cv_path: cvUrl,
        cv_url: cvUrl,
        ai_prompt: customPrompt,
        custom_prompt: customPrompt,
        skills: extractedSkills,
        experiences: extractedExperience,
        updated_at: new Date()
      });
      logInfo('Profile updated with extracted CV info');
    } else {
      // Insert new profile
      appendToSheet(SHEET_NAMES.PROFILES, [
        'default_user',
        profileData.name || '',
        profileData.email || '',
        cvUrl,
        customPrompt,
        extractedSkills,
        extractedExperience,
        'Profil dari web app',
        'gemini-2.0-flash-exp',
        false,
        false,
        new Date(),
        new Date(),
        cvUrl,
        customPrompt
      ]);
      logInfo('New profile created with extracted CV info');
    }

    return {
      success: true,
      message: 'Profil berhasil disimpan dengan CV extraction!',
      extractedSkills: extractedSkills,
      extractedExperience: extractedExperience
    };
  } catch (e) {
    logError('Save profile failed: ' + e.message);
    return { success: false, error: 'Gagal simpan profil: ' + e.message };
  }
}

// ==================== BULK OPERATIONS ====================

// Get semua lamaran dengan status 'nabung'
function getBulkNabung() {
  try {
    checkQuota();
    const parsed = getSheetData(SHEET_NAMES.PARSED);
    const nabungItems = parsed.filter(p => p.status === 'nabung').map(p => ({
      timestamp: p.timestamp,
      role: p.role || 'N/A',
      company: p.company || 'N/A',
      email: p.email || '',
      location: p.location || 'N/A',
      salary: p.salary || 'N/A',
      requirements: p.requirements || '',
      description: p.description || '',
      custom_subject: p.custom_subject || '',
      cover_letter: p.cover_letter || ''
    }));

    if (nabungItems.length === 0) {
      return { error: 'Tidak ada lamaran dengan status nabung.' };
    }

    return { items: nabungItems };
  } catch (e) {
    logError('Get bulk nabung failed: ' + e.message);
    return { error: 'Gagal load lamaran nabung: ' + e.message };
  }
}

// ==================== STATUS & TRACKING ====================

// Get statistik lamaran
function getStatusStats() {
  try {
    checkQuota();
    const raw = getSheetData(SHEET_NAMES.RAW);
    const parsed = getSheetData(SHEET_NAMES.PARSED);
    const emails = getSheetData(SHEET_NAMES.EMAILS);

    const waitingOcr = raw.filter(r => {
      const status = String(r.status || '').toLowerCase();
      return status === 'waiting_ocr' || status === 'ocr_retry' || status === 'ocr_processing';
    }).length;

    const parsingReady = raw.filter(r => {
      const status = String(r.status || '').toLowerCase();
      return status === 'ocr_done' || status === 'parsing_retry';
    }).length;

    const needEmail = parsed.filter(p => String(p.status || '').toLowerCase() === 'need_email').length;

    const stats = {
      nabung: parsed.filter(p => p.status === 'nabung').length,
      sent: emails.filter(e => e.status === 'sent').length,
      failed: emails.filter(e => e.status === 'failed').length,
      duplicate: parsed.filter(p => p.status === 'duplicate').length,
      waiting_ocr: waitingOcr,
      parsing_ready: parsingReady,
      need_email: needEmail,
      total: parsed.length
    };

    // Get recent emails (latest 10)
    const history = emails.slice(-10).reverse().map(e => ({
      timestamp: e.timestamp,
      recipient_email: e.recipient_email,
      role: e.job_role || 'N/A',
      company: e.job_company || 'N/A',
      subject: e.subject,
      status: e.status
    }));

    return { stats: stats, history: history };
  } catch (e) {
    logError('Get status stats failed: ' + e.message);
    return { stats: null, history: [] };
  }
}

// ==================== BATCH SCREENSHOT PIPELINE ====================

function uploadBatchScreenshots(payload) {
  try {
    checkQuota();
    const files = (payload && payload.files) || [];
    if (!files.length) {
      return { success: false, message: 'Tidak ada file yang diunggah.' };
    }

    const submittedBy = payload.submittedBy || 'web_user';
    let successCount = 0;
    const errors = [];

    files.forEach(file => {
      try {
        checkQuota();
        const driveFile = saveBase64Screenshot(file.data, file.name);
        appendToSheet(SHEET_NAMES.RAW, [
          new Date(),
          submittedBy,
          '',
          'waiting_ocr',
          driveFile.getId(),
          driveFile.getName(),
          'batch_screenshot',
          '',
          'Menunggu OCR'
        ]);
        successCount++;
      } catch (err) {
        errors.push((file && file.name ? file.name : 'unknown') + ': ' + err.message);
      }
    });

    const summary = successCount > 0
      ? `${successCount} gambar berhasil diunggah ke antrean OCR.`
      : 'Tidak ada gambar yang berhasil diunggah.';

    return {
      success: successCount > 0,
      message: errors.length ? `${summary} Error: ${errors.join('; ')}` : summary,
      queued: successCount,
      errors: errors
    };
  } catch (e) {
    logError('Upload batch screenshots failed: ' + e.message);
    return { success: false, message: 'Gagal mengunggah batch: ' + e.message };
  }
}

function triggerImageQueue() {
  try {
    checkQuota();
    const rawData = getSheetData(SHEET_NAMES.RAW);
    const pending = rawData.filter(r => ['waiting_ocr', 'ocr_retry'].includes(String(r.status).toLowerCase()));
    if (pending.length === 0) {
      clearQueue(SCRIPT_PROP_KEYS.IMAGE_QUEUE_TRIGGER_ID);
      return { success: false, message: 'Tidak ada gambar yang menunggu OCR.' };
    }
    const result = processImageQueueStep();
    return {
      success: result.ok !== false,
      message: result.message,
      remaining: result.remaining
    };
  } catch (e) {
    logError('Trigger image queue failed: ' + e.message);
    return { success: false, message: 'Gagal memulai proses OCR: ' + e.message };
  }
}

function processQueuedImage() {
  resetApiCallCount();
  processImageQueueStep();
}

function processImageQueueStep() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(SCRIPT_PROP_KEYS.IMAGE_QUEUE_TRIGGER_ID);

  const rawData = getSheetData(SHEET_NAMES.RAW);
  const pendingIndex = rawData.findIndex(r => ['waiting_ocr', 'ocr_retry'].includes(String(r.status).toLowerCase()));

  if (pendingIndex === -1) {
    clearQueue(SCRIPT_PROP_KEYS.IMAGE_QUEUE_TRIGGER_ID);
    return { processed: false, message: 'Tidak ada gambar dalam antrean OCR.', remaining: 0 };
  }

  const item = rawData[pendingIndex];
  const timestampMs = new Date(item.timestamp).getTime();

  updateSheetRow(SHEET_NAMES.RAW, row => {
    const rowTime = new Date(row.timestamp).getTime();
    return rowTime === timestampMs;
  }, {
    status: 'ocr_processing',
    processed_at: new Date(),
    notes: 'Sedang diproses OCR'
  });

  let message = '';
  let ok = true;

  try {
    if (!item.file_id) {
      throw new Error('File ID tidak ditemukan.');
    }
    const file = DriveApp.getFileById(item.file_id);
    const text = extractTextFromImage(file.getBlob());

    updateSheetRow(SHEET_NAMES.RAW, row => {
      const rowTime = new Date(row.timestamp).getTime();
      return rowTime === timestampMs;
    }, {
      content: text,
      status: 'ocr_done',
      processed_at: new Date(),
      notes: 'OCR selesai'
    });

    message = 'OCR selesai untuk ' + (item.file_name || item.file_id);
  } catch (error) {
    logError('Image queue step failed: ' + error.message);
    ok = false;

    updateSheetRow(SHEET_NAMES.RAW, row => {
      const rowTime = new Date(row.timestamp).getTime();
      return rowTime === timestampMs;
    }, {
      status: 'ocr_failed',
      processed_at: new Date(),
      notes: 'Error OCR: ' + error.message
    });

    message = 'OCR gagal untuk ' + (item.file_name || item.file_id) + ': ' + error.message;
  }

  const remaining = getSheetData(SHEET_NAMES.RAW)
    .filter(r => ['waiting_ocr', 'ocr_retry'].includes(String(r.status).toLowerCase()))
    .length;

  if (remaining > 0) {
    scheduleQueue(SCRIPT_PROP_KEYS.IMAGE_QUEUE_TRIGGER_ID, 'processQueuedImage', QUEUE_INTERVAL_MS);
  } else {
    clearQueue(SCRIPT_PROP_KEYS.IMAGE_QUEUE_TRIGGER_ID);
  }

  return { processed: true, ok: ok, message: message, remaining: remaining };
}

function triggerParsingQueue() {
  try {
    checkQuota();
    const rawData = getSheetData(SHEET_NAMES.RAW);
    const parsedData = getSheetData(SHEET_NAMES.PARSED);
    const pending = rawData.filter(row => {
      const status = String(row.status).toLowerCase();
      if (status !== 'ocr_done' && status !== 'parsing_retry') return false;
      if (String(row.source_type).toLowerCase() !== 'batch_screenshot') return false;
      const ts = new Date(row.timestamp).getTime();
      return !parsedData.some(p => new Date(p.source_raw_timestamp).getTime() === ts);
    });

    if (pending.length === 0) {
      clearQueue(SCRIPT_PROP_KEYS.PARSE_QUEUE_TRIGGER_ID);
      return { success: false, message: 'Tidak ada teks lowongan yang menunggu parsing.' };
    }

    const result = processParsingQueueStep();
    return {
      success: result.ok !== false,
      message: result.message,
      remaining: result.remaining
    };
  } catch (e) {
    logError('Trigger parsing queue failed: ' + e.message);
    return { success: false, message: 'Gagal memulai parsing massal: ' + e.message };
  }
}

function processQueuedParsing() {
  resetApiCallCount();
  processParsingQueueStep();
}

function processParsingQueueStep() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(SCRIPT_PROP_KEYS.PARSE_QUEUE_TRIGGER_ID);

  const rawData = getSheetData(SHEET_NAMES.RAW);
  const parsedData = getSheetData(SHEET_NAMES.PARSED);

  const pendingIndex = rawData.findIndex(row => {
    const status = String(row.status).toLowerCase();
    if (status !== 'ocr_done' && status !== 'parsing_retry') return false;
    if (String(row.source_type).toLowerCase() !== 'batch_screenshot') return false;
    const ts = new Date(row.timestamp).getTime();
    return !parsedData.some(p => new Date(p.source_raw_timestamp).getTime() === ts);
  });

  if (pendingIndex === -1) {
    clearQueue(SCRIPT_PROP_KEYS.PARSE_QUEUE_TRIGGER_ID);
    return { processed: false, message: 'Tidak ada lowongan yang menunggu parsing.', remaining: 0 };
  }

  const item = rawData[pendingIndex];
  const timestampMs = new Date(item.timestamp).getTime();

  updateSheetRow(SHEET_NAMES.RAW, row => {
    const rowTime = new Date(row.timestamp).getTime();
    return rowTime === timestampMs;
  }, {
    status: 'parsing_processing',
    processed_at: new Date(),
    notes: 'Sedang parsing ke lowongan_parsed'
  });

  let message = '';
  let ok = true;

  try {
    const content = item.content ? String(item.content).trim() : '';
    if (!content) {
      throw new Error('Konten lowongan kosong, tidak bisa diparsing.');
    }

    const parsed = parseJobDetails(content);
    const now = new Date();

    appendToSheet(SHEET_NAMES.PARSED, [
      now,
      item.timestamp,
      parsed.role || '',
      parsed.company || '',
      parsed.email || '',
      parsed.location || '',
      parsed.salary || '',
      parsed.requirements || '',
      parsed.description || '',
      'nabung',
      '',
      parsed.custom_subject || '',
      ''
    ]);

    updateSheetRow(SHEET_NAMES.RAW, row => {
      const rowTime = new Date(row.timestamp).getTime();
      return rowTime === timestampMs;
    }, {
      status: 'parsed',
      processed_at: new Date(),
      notes: 'Parsing sukses'
    });

    message = 'Parsing selesai untuk ' + (item.file_name || timestampMs);
  } catch (error) {
    logError('Parsing queue step failed: ' + error.message);
    ok = false;

    updateSheetRow(SHEET_NAMES.RAW, row => {
      const rowTime = new Date(row.timestamp).getTime();
      return rowTime === timestampMs;
    }, {
      status: 'parsing_failed',
      processed_at: new Date(),
      notes: 'Error parsing: ' + error.message
    });

    message = 'Parsing gagal: ' + error.message;
  }

  const refreshedParsed = getSheetData(SHEET_NAMES.PARSED);
  const remaining = getSheetData(SHEET_NAMES.RAW)
    .filter(row => {
      const status = String(row.status).toLowerCase();
      if (status !== 'ocr_done' && status !== 'parsing_retry') return false;
      if (String(row.source_type).toLowerCase() !== 'batch_screenshot') return false;
      const ts = new Date(row.timestamp).getTime();
      return !refreshedParsed.some(p => new Date(p.source_raw_timestamp).getTime() === ts);
    })
    .length;

  if (remaining > 0) {
    scheduleQueue(SCRIPT_PROP_KEYS.PARSE_QUEUE_TRIGGER_ID, 'processQueuedParsing', QUEUE_INTERVAL_MS);
  } else {
    clearQueue(SCRIPT_PROP_KEYS.PARSE_QUEUE_TRIGGER_ID);
  }

  return { processed: true, ok: ok, message: message, remaining: remaining };
}

// ==================== PROCESS IMAGE ====================

function processImage(fileData, mode, manualEmail) {
  try {
    checkQuota();
    const blob = normalizeImageInput(fileData);
    if (!blob) return { error: 'Gambar tidak ditemukan.' };
    if (blob.getBytes().length > 2 * 1024 * 1024) return { error: 'Ukuran gambar maksimal 2MB!' };

    // Ekstrak teks dari gambar
    const extractedText = extractTextFromImage(blob);
    const now = new Date();
    appendToSheet(SHEET_NAMES.RAW, [
      now,
      'web_user',
      extractedText,
      'ocr_done',
      '',
      '',
      'instant_image',
      now,
      'OCR instan via web app'
    ]);

    // Parse job details
    const parsed = parseJobDetails(extractedText);
    const timestamp = new Date();

    appendToSheet(SHEET_NAMES.PARSED, [
      timestamp,
      timestamp,
      parsed.role || '',
      parsed.company || '',
      parsed.email || '',
      parsed.location || '',
      parsed.salary || '',
      parsed.requirements || '',
      parsed.description || '',
      mode === 'nabung' ? 'nabung' : 'ready',
      manualEmail || '',
      parsed.custom_subject || '',
      ''
    ]);

    // Mode nabung: hanya simpan, jangan kirim
    if (mode === 'nabung') {
      return { success: true, message: '✅ Lamaran disimpan di nabung! 📦' };
    }

    // Mode kirim: eksekusi penuh
    return processParsedData(parsed, timestamp, manualEmail, extractedText);

  } catch (error) {
    logError('Process image failed: ' + error.message);
    return { error: 'Gagal memproses gambar, coba lagi ya!' };
  }
}

// ==================== PROCESS TEXT ====================

function parseText(text, mode, manualEmail) {
  try {
    checkQuota();
    validateInput(text);

    // Catat teks ke sheet
    const now = new Date();
    appendToSheet(SHEET_NAMES.RAW, [
      now,
      'web_user',
      text,
      'ocr_done',
      '',
      '',
      'instant_text',
      now,
      'Input teks manual'
    ]);

    // Parse job details
    const parsed = parseJobDetails(text);
    const timestamp = new Date();

    appendToSheet(SHEET_NAMES.PARSED, [
      timestamp,
      timestamp,
      parsed.role || '',
      parsed.company || '',
      parsed.email || '',
      parsed.location || '',
      parsed.salary || '',
      parsed.requirements || '',
      parsed.description || '',
      mode === 'nabung' ? 'nabung' : 'ready',
      manualEmail || '',
      parsed.custom_subject || '',
      ''
    ]);

    // Mode nabung: hanya simpan, jangan kirim
    if (mode === 'nabung') {
      return { success: true, message: '✅ Lamaran disimpan di nabung! 📦' };
    }

    // Mode kirim: eksekusi penuh
    return processParsedData(parsed, timestamp, manualEmail, text);

  } catch (error) {
    logError('Parse text failed: ' + error.message);
    return { error: 'Gagal memproses teks, coba lagi ya!' };
  }
}

// ==================== PROCESS PARSED DATA ====================

// Helper function untuk proses data yang sudah di-parse
function processParsedData(parsed, timestamp, manualEmail, sourceText) {
  try {
    checkQuota();

    // Tentukan email HR (prioritas: manual > parsing)
    let hrEmail = manualEmail || parsed.email;

    // Validasi email HR
    const emailCheck = validateEmail(hrEmail);
    if (!emailCheck.valid) {
      // Email tidak valid, minta input manual
      logInfo('Email validation failed for: ' + hrEmail + ', reason: ' + emailCheck.reason);
      updateSheetRow(SHEET_NAMES.PARSED, row => isSameTimestamp(row.timestamp, timestamp), {
        status: 'need_email',
        email_manual: manualEmail || '',
        email: parsed.email || ''
      });
      return {
        needsEmail: true,
        parsed: parsed,
        timestamp: timestamp instanceof Date ? timestamp.toISOString() : timestamp,
        reason: emailCheck.reason,
        source: sourceText ? 'text' : 'image'
      };
    }

    // Cek duplikasi dengan HR email
    if (checkDuplicate('web_user', parsed.company, parsed.role, hrEmail)) {
      updateSheetRow(SHEET_NAMES.PARSED, row => isSameTimestamp(row.timestamp, timestamp), { status: 'duplicate' });
      logInfo('Duplicate detected for: ' + parsed.company + ' - ' + parsed.role + ' to ' + hrEmail);
      return { error: '⚠️ Lowongan sudah ada di database, tidak akan dikirim ulang untuk menghindari spam.' };
    }

    parsed.email = hrEmail;

    // Generate cover letter with profile data
    const profile = getLocalProfile();
    const cover = generateCoverLetter(parsed, profile);

    // Update sheet dengan cover letter dan email_manual jika ada
    updateSheetRow(SHEET_NAMES.PARSED, row => isSameTimestamp(row.timestamp, timestamp), {
      status: 'ready',
      cover_letter: cover,
      email_manual: manualEmail || '',
      email: hrEmail
    });

    // Tentukan subject email
    const emailSubject = buildEmailSubject(parsed);

    // Kirim email dengan CV
    const sendResult = sendEmailWithAttachmentFromUrl(hrEmail, emailSubject, cover, profile.name);

    // Update status di sheet
    updateSheetRow(SHEET_NAMES.PARSED, row => isSameTimestamp(row.timestamp, timestamp), {
      status: sendResult.status === 'sent' ? 'sent' : 'failed'
    });

    // Catat ke sent_emails
    appendToSheet(SHEET_NAMES.EMAILS, [
      new Date(),
      profile.email || 'web_user@example.com',
      hrEmail,
      parsed.role || 'N/A',
      parsed.company || 'N/A',
      emailSubject,
      cover.substring(0, 100),
      sendResult.status,
      sendResult.messageId || '',
      sendResult.error || ''
    ]);

    if (sendResult.status === 'sent') {
      logInfo('Email sent from: ' + profile.name + ' to: ' + hrEmail + ' for: ' + parsed.role);
      return {
        success: true,
        message: `✅ Lamaran terkirim dari ${profile.name} ke ${hrEmail}!`
      };
    } else {
      logError('Email send failed: ' + sendResult.error);
      return {
        success: false,
        message: `⚠️ Gagal kirim: ${sendResult.error}`
      };
    }

  } catch (error) {
    logError('Process parsed data failed: ' + error.message);
    return { error: 'Gagal memproses lamaran: ' + error.message };
  }
}

// ==================== BULK SEND ====================

function sendBulk() {
  try {
    checkQuota();
    const nabungData = getSheetData(SHEET_NAMES.PARSED).filter(p => p.status === 'nabung');

    if (nabungData.length === 0) {
      return 'ℹ️ Tidak ada lamaran dengan status nabung untuk dikirim.';
    }

    let sent = 0, failed = 0, duplicate = 0;
    let failedEmails = [];
    const profile = getLocalProfile();

    nabungData.forEach(item => {
      try {
        checkQuota();

        // Cek duplikasi dengan HR email check
         if (checkDuplicate('web_user', item.company, item.role, item.email)) {
           updateSheetRow(SHEET_NAMES.PARSED, row => isSameTimestamp(row.timestamp, item.timestamp), { status: 'duplicate' });
           duplicate++;
           logInfo('Duplicate detected: ' + item.company + ' - ' + item.role + ' to ' + item.email);
           return;
         }

        // Generate cover letter jika belum ada dengan profile
        const cover = item.cover_letter || generateCoverLetter(item, profile);

        // Tentukan subject email
        const emailSubject = buildEmailSubject(item);

        // Kirim email
        const sendResult = sendEmailWithAttachmentFromUrl(item.email, emailSubject, cover, profile.name);

        // Update status
        updateSheetRow(SHEET_NAMES.PARSED, row => isSameTimestamp(row.timestamp, item.timestamp), {
          status: sendResult.status === 'sent' ? 'sent' : 'failed',
          cover_letter: cover
        });

        // Catat ke sent_emails
        appendToSheet(SHEET_NAMES.EMAILS, [
          new Date(),
          profile.email || 'web_user@example.com',
          item.email,
          item.role || 'N/A',
          item.company || 'N/A',
          emailSubject,
          cover.substring(0, 100),
          sendResult.status,
          sendResult.messageId || '',
          sendResult.error || ''
        ]);

        if (sendResult.status === 'sent') {
          sent++;
          logInfo('Bulk sent: ' + item.role + ' at ' + item.company + ' to ' + item.email);
        } else {
          failed++;
          failedEmails.push({
            company: item.company,
            role: item.role,
            email: item.email,
            error: sendResult.error
          });
          logError('Bulk failed: ' + item.company + ' (' + item.email + '), error: ' + sendResult.error);
        }

        rateLimitDelay(2000); // Delay 2 detik antar email untuk avoid rate limit
      } catch (e) {
        failed++;
        failedEmails.push({
          company: item.company,
          role: item.role,
          email: item.email,
          error: e.message
        });
        logError('Bulk send failed for item: ' + e.message);
      }
    });

    // Build detailed response
    let response = `✅ Kirim massal selesai: ${sent} berhasil, ${failed} gagal, ${duplicate} duplikat.`;
    if (failedEmails.length > 0) {
      response += '\n\n⚠️ Email yang gagal:\n';
      failedEmails.forEach(f => {
        response += `- ${f.company} (${f.role}): ${f.error}\n`;
      });
    }
    return response;
  } catch (error) {
    logError('Send bulk failed: ' + error.message);
    return '❌ Gagal kirim massal: ' + error.message;
  }
}

// ==================== BUILD EMAIL SUBJECT ====================

// Build email subject - gunakan custom_subject jika ada, atau generate default
function buildEmailSubject(parsed) {
  try {
    // Prioritas: custom_subject > default format
    if (parsed.custom_subject && parsed.custom_subject.trim()) {
      return parsed.custom_subject.trim();
    }

    // Generate default subject
    const role = parsed.role || 'Lamaran Kerja';
    const company = parsed.company || 'Perusahaan';
    return `Lamaran: ${role} - ${company}`;
  } catch (e) {
    logError('Build email subject failed: ' + e.message);
    return 'Lamaran Kerja';
  }
}

// ==================== MANUAL EMAIL RETRY ====================

function retryWithEmail(retryPayload, manualEmail) {
  try {
    checkQuota();
    if (!retryPayload || !retryPayload.parsed) {
      throw new Error('Data lamaran tidak valid untuk retry.');
    }
    if (!manualEmail || typeof manualEmail !== 'string') {
      throw new Error('Email manual tidak boleh kosong.');
    }

    const parsed = retryPayload.parsed;
    const timestampValue = retryPayload.timestamp ?
      new Date(retryPayload.timestamp) :
      new Date();

    return processParsedData(parsed, timestampValue, manualEmail, retryPayload.sourceText || '');
  } catch (e) {
    logError('Retry with email failed: ' + e.message);
    return { error: 'Gagal kirim ulang dengan email manual: ' + e.message };
  }
}

// ==================== PROFILE HELPER ====================

function getLocalProfile() {
  try {
    const profiles = getSheetData(SHEET_NAMES.PROFILES);
    if (profiles.length > 0) {
      const profile = profiles[0];
      return {
        name: profile.name || 'Kandidat',
        email: profile.email || '',
        skills: profile.skills || '',
        experiences: profile.experiences || '',
        experience: profile.experiences || '',
        ai_prompt: profile.ai_prompt || 'Buat cover letter profesional yang ringkas dan personal.',
        prompt: profile.ai_prompt || 'Buat cover letter profesional yang ringkas dan personal.'
      };
    }
  } catch (e) {
    logError('Get local profile failed: ' + e.message);
  }

  return getDefaultProfile();
}

function getDefaultProfile() {
  return {
    name: 'Kandidat',
    email: 'candidate@gmail.com',
    skills: '',
    experiences: '',
    experience: '',
    ai_prompt: 'Buat cover letter profesional yang ringkas dan personal.',
    prompt: 'Buat cover letter profesional yang ringkas dan personal.'
  };
}
