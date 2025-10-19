// helper.gs - Utilities untuk JobSeer GAS
// Update: Extract subject custom dari text (jika ada 'subject:' atau 'subjek:')

function getHeadersForSheet(sheetName) {
  const directKey = Object.keys(SHEET_NAMES).find(key => SHEET_NAMES[key] === sheetName);
  if (directKey && SHEET_HEADERS[directKey]) {
    return SHEET_HEADERS[directKey];
  }
  const upper = sheetName ? SHEET_HEADERS[String(sheetName).toUpperCase()] : null;
  if (upper) return upper;
  throw new Error('Header sheet tidak ditemukan untuk: ' + sheetName);
}

// Fungsi untuk append data ke sheet (data persistence di spreadsheet)
function appendToSheet(sheetName, data) {
  safeExecute(() => {
    const config = getConfig();
    const spreadsheet = SpreadsheetApp.openById(config.SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      logError('Sheet not found: ' + sheetName);
      return;
    }
    const headers = getHeadersForSheet(sheetName);
    const currentHeader = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    const mismatch = headers.some((header, idx) => currentHeader[idx] !== header);
    if (mismatch) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    sheet.appendRow(data);
  });
}

// Fungsi untuk ambil data dari sheet (return array of objects)
function getSheetData(sheetName) {
  return safeExecute(() => {
    const config = getConfig();
    const spreadsheet = SpreadsheetApp.openById(config.SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) return [];
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    return data.slice(1).map(row => {
      const obj = {};
      headers.forEach((header, i) => obj[header] = row[i]);
      return obj;
    });
  });
}

// Fungsi untuk update row di sheet berdasarkan kondisi
function updateSheetRow(sheetName, condition, updates) {
  safeExecute(() => {
    const data = getSheetData(sheetName);
    const config = getConfig();
    const spreadsheet = SpreadsheetApp.openById(config.SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(sheetName);
    const headers = getHeadersForSheet(sheetName);
    data.forEach((row, index) => {
      if (condition(row)) {
        Object.keys(updates).forEach(key => {
          const colIndex = headers.indexOf(key);
          if (colIndex !== -1) {
            sheet.getRange(index + 2, colIndex + 1).setValue(updates[key]);
          }
        });
      }
    });
  });
}

// Extract custom subject dari text jika ada pattern 'subject:' atau 'subjek:'
function extractCustomSubject(text) {
  try {
    if (!text || text.length === 0) return null;
    validateInput(text);

    // Pattern untuk extract subject: atau subjek: (case-insensitive)
    const patterns = [
      /subject\s*:\s*([^\n]+?)(?:\n|$)/i,  // subject: text
      /subjek\s*:\s*([^\n]+?)(?:\n|$)/i,   // subjek: text
      /posisi\s*:\s*([^\n]+?)(?:\n|$)/i,   // posisi: text (alternative)
      /lowongan\s*:\s*([^\n]+?)(?:\n|$)/i  // lowongan: text (alternative)
    ];

    for (let pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const subject = match[1].trim();
        // Validasi subject tidak kosong dan reasonable length
        if (subject && subject.length > 3 && subject.length < 200) {
          logInfo('Custom subject extracted: ' + subject);
          return subject;
        }
      }
    }

    return null;  // Tidak ada custom subject
  } catch (e) {
    logError('Extract custom subject failed: ' + e.message);
    return null;
  }
}

// Validasi email yang SMART: whitelist domain umum, tapi cek MX untuk domain tidak kenal
function validateEmail(email) {
  validateInput(email);

  // Regex basic email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, reason: 'Format email tidak valid' };
  }

  const domain = email.split('@')[1].toLowerCase();

  // Whitelist domain umum yang pasti valid
  const trustedDomains = [
    'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com',
    'company.com', 'corp.com',
    'mail.com', 'ymail.com', 'rocketmail.com',
    'icloud.com', 'me.com', 'aol.com',
    'protonmail.com', 'tutanota.com'
  ];

  // Domain generik lokal yang biasanya valid
  const trustedExtensions = ['.co.id', '.com', '.org', '.net', '.gov', '.edu', '.ac.id'];

  // Jika domain di whitelist, langsung accept
  if (trustedDomains.includes(domain)) {
    return { valid: true, reason: 'Domain terpercaya' };
  }

  // Check domain extension
  for (let ext of trustedExtensions) {
    if (domain.endsWith(ext)) {
      return { valid: true, reason: 'Domain terpercaya' };
    }
  }

  // Jika domain tidak dikenal, cek MX record (DNS)
  try {
    checkQuota();
    const url = 'https://dns.google/resolve?name=' + domain + '&type=MX';
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() === 200) {
      const data = JSON.parse(response.getContentText());
      if (data.Answer && data.Answer.length > 0) {
        return { valid: true, reason: 'MX record ditemukan' };
      }
    }
  } catch (e) {
    logError('DNS check failed: ' + e.message);
    // Jika DNS check gagal, assume domain valid (internet error)
    return { valid: true, reason: 'DNS check error (assumed valid)' };
  }

  // Jika tidak ada MX record, email tidak valid
  return { valid: false, reason: 'Domain tidak memiliki MX record' };
}

// Fungsi cek duplikasi aplikasi dengan HR email comparison
function checkDuplicate(candidateEmail, company, role, hrEmail) {
  try {
    validateInput(candidateEmail);
    validateInput(company);
    validateInput(role);
    if (hrEmail) validateInput(hrEmail);

    const sentEmails = getSheetData(SHEET_NAMES.EMAILS);
    const parsed = getSheetData(SHEET_NAMES.PARSED);
    const now = new Date().getTime();
    const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000; // 7 days timeframe

    // Check dalam last 7 days untuk sent emails - sekarang juga check HR email
    const recentDuplicate = sentEmails.some(e => {
      try {
        const emailTime = new Date(e.timestamp).getTime();
        const isRecent = (now - emailTime) < sevenDaysInMs;
        const isSameJob = sanitizeString(e.job_company) === sanitizeString(company) &&
                          sanitizeString(e.job_role) === sanitizeString(role);

        // Also check if HR email matches (jika provided)
        const isSameHrEmail = hrEmail ?
          sanitizeString(e.recipient_email) === sanitizeString(hrEmail) :
          false;

        const isSuccess = e.status === 'sent' || e.status === 'ready';

        // Duplicate jika: (same job + recent) OR (same HR email + recent)
        return isRecent && isSuccess && (isSameJob || isSameHrEmail);
      } catch (err) {
        return false;
      }
    });

    if (recentDuplicate) {
      logInfo('Duplicate detected (sent_emails): ' + company + ' - ' + role +
              (hrEmail ? ' to ' + hrEmail : ''));
      return true;
    }

    // Check dalam parsed sheet dengan loose timeframe
    const parsedDuplicate = parsed.some(p => {
      try {
        const isSameJob = sanitizeString(p.company) === sanitizeString(company) &&
                          sanitizeString(p.role) === sanitizeString(role);

        // Also check if HR email matches
        const isSameHrEmail = hrEmail ?
          sanitizeString(p.email) === sanitizeString(hrEmail) :
          false;

        const isNotFailed = ['nabung', 'parsed', 'ready', 'sent', 'duplicate'].includes(p.status);

        // Duplicate jika: (same job + active) OR (same HR email + active)
        return isNotFailed && (isSameJob || isSameHrEmail);
      } catch (err) {
        return false;
      }
    });

    if (parsedDuplicate) {
      logInfo('Duplicate detected (parsed): ' + company + ' - ' + role +
              (hrEmail ? ' to ' + hrEmail : ''));
      return true;
    }

    return false;
  } catch (e) {
    logError('Check duplicate failed: ' + e.message);
    return false; // Assume not duplicate on error
  }
}</parameter>


// Fungsi generate cover letter dengan custom prompt support
function generateCoverLetter(jobDetails, profile) {
  try {
    validateInput(JSON.stringify(jobDetails));
    validateInput(JSON.stringify(profile));

    let basePrompt = `Buat cover letter personal untuk lowongan:
    - Posisi: ${jobDetails.role || 'N/A'}
    - Perusahaan: ${jobDetails.company || 'N/A'}
    - Requirements: ${jobDetails.requirements || 'N/A'}
    - Description: ${jobDetails.description || 'N/A'}

    Profil kandidat:
    - Nama: ${profile.name || 'Kandidat'}
    - Email: ${profile.email || 'N/A'}
    - Skills: ${profile.skills || 'N/A'}
    - Pengalaman: ${profile.experiences || profile.experience || 'N/A'}

    Instruksi: Gunakan bahasa Indonesia, profesional tapi personal dan genuine. Ringkas (max 300 kata). Highlight key skills yang relevan. Akhiri dengan enthusiasm untuk bergabung dan siap interview.`;

    // Tambahkan custom prompt jika ada
    if (profile.ai_prompt && profile.ai_prompt.trim()) {
      basePrompt += `\n\nCustom instruction: ${profile.ai_prompt}`;
    }

    return callOpenRouterAPI(basePrompt);
  } catch (e) {
    logError('Generate cover letter failed: ' + e.message);
    return 'Saya tertarik dengan posisi ini dan ingin bergabung dengan tim Anda.';
  }
}

// Fungsi cek throttle email (max 3 email per 30 detik)
function checkThrottle(userId) {
  try {
    validateInput(userId);
    const config = getConfig();
    const now = new Date().getTime();
    const emails = getSheetData(SHEET_NAMES.EMAILS).filter(e => {
      const emailTime = new Date(e.timestamp).getTime();
      return e.candidate_email === userId && (now - emailTime) < config.THROTTLE_WINDOW;
    });
    const canSend = emails.length < config.THROTTLE_LIMIT;
    if (!canSend) {
      logInfo('Throttle limit reached for user: ' + userId);
    }
    return canSend;
  } catch (e) {
    logError('Check throttle failed: ' + e.message);
    return true; // Assume no throttle on error
  }
}

// Panggil Gemini API dengan fallback keys, validasi, quota check
function callGeminiAPI(prompt, imageData = null) {
  try {
    validateInput(prompt);
    if (imageData && typeof imageData === 'string' && imageData.length <= 10000) {
      validateInput(imageData);
    }

    const keys = getApiKeys('GEMINI_KEYS');
    let lastError = null;

    for (let i = 0; i < keys.length; i++) {
      try {
        checkQuota();
        rateLimitDelay(1000);

        const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=' + keys[i];
        const payload = { contents: [{ parts: [{ text: prompt }] }] };

        if (imageData) {
          // Handle both base64 string and Blob object
          if (typeof imageData === 'string') {
            payload.contents[0].parts.push({ inline_data: { mime_type: 'image/jpeg', data: imageData } });
          } else {
            // It's a Blob
            const base64 = Utilities.base64Encode(imageData.getBytes());
            payload.contents[0].parts.push({ inline_data: { mime_type: 'image/jpeg', data: base64 } });
          }
        }

        const options = {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify(payload),
          muteHttpExceptions: true
        };

        const response = UrlFetchApp.fetch(url, options);
        const responseCode = response.getResponseCode();

        if (responseCode === 200) {
          const result = JSON.parse(response.getContentText());
          if (result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts) {
            return result.candidates[0].content.parts[0].text;
          } else {
            throw new Error('Invalid Gemini response format');
          }
        } else if (responseCode === 429 || responseCode === 402) {
          logInfo('Gemini quota exceeded, trying next key', '', 'Key index: ' + i);
          lastError = new Error('Quota exceeded');
          continue;
        } else {
          lastError = new Error('Gemini API error: ' + response.getContentText());
          if (i < keys.length - 1) {
            logInfo('Gemini API error, trying next key', '', 'Code: ' + responseCode);
            continue;
          }
        }
      } catch (e) {
        lastError = e;
        logError('Gemini API call failed: ' + e.message, '', 'Key index: ' + i);
        if (i < keys.length - 1) continue;
      }
    }

    throw lastError || new Error('All Gemini API keys exhausted');
  } catch (e) {
    logError('callGeminiAPI failed: ' + e.message);
    throw e;
  }
}

// Panggil OpenRouter API dengan fallback keys, validasi, quota check
function callOpenRouterAPI(prompt, model = AI_MODELS.OPENROUTER) {
  try {
    validateInput(prompt);

    const keys = getApiKeys('OPENROUTER_KEYS');
    let lastError = null;

    for (let i = 0; i < keys.length; i++) {
      try {
        checkQuota();
        rateLimitDelay(1000);

        const url = 'https://openrouter.ai/api/v1/chat/completions';
        const payload = {
          model: model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          top_p: 1
        };

        const options = {
          method: 'post',
          headers: {
            'Authorization': 'Bearer ' + keys[i],
            'HTTP-Referer': 'https://script.google.com',
            'X-Title': 'JobSeer GAS'
          },
          contentType: 'application/json',
          payload: JSON.stringify(payload),
          muteHttpExceptions: true,
          timeout: 30
        };

        const response = UrlFetchApp.fetch(url, options);
        const responseCode = response.getResponseCode();

        if (responseCode === 200) {
          const result = JSON.parse(response.getContentText());
          if (result.choices && result.choices[0] && result.choices[0].message) {
            return result.choices[0].message.content;
          } else {
            throw new Error('Invalid OpenRouter response format');
          }
        } else if (responseCode === 429 || responseCode === 402) {
          logInfo('OpenRouter quota exceeded, trying next key', '', 'Key index: ' + i);
          lastError = new Error('Quota exceeded');
          continue;
        } else {
          lastError = new Error('OpenRouter API error: ' + response.getContentText().substring(0, 200));
          if (i < keys.length - 1) {
            logInfo('OpenRouter API error, trying next key', '', 'Code: ' + responseCode);
            continue;
          }
        }
      } catch (e) {
        lastError = e;
        logError('OpenRouter API call failed: ' + e.message, '', 'Key index: ' + i);
        if (i < keys.length - 1) continue;
      }
    }

    throw lastError || new Error('All OpenRouter API keys exhausted');
  } catch (e) {
    logError('callOpenRouterAPI failed: ' + e.message);
    throw e;
  }
}

// Ekstrak teks dari gambar via Gemini
function extractTextFromImage(imageData) {
  try {
    const prompt = 'Ekstrak SEMUA teks dari gambar lowongan kerja ini. Output hanya teks plain, jangan ada markup atau formatting khusus. Pertahankan struktur asli. Cari pola "subject:", "subjek:", "posisi:", "lowongan:", email, company name, dll. Jangan tambahkan komentar atau penjelasan.';
    return callGeminiAPI(prompt, imageData);
  } catch (e) {
    logError('Extract text from image failed: ' + e.message);
    throw new Error('Gagal ekstrak teks dari gambar: ' + e.message);
  }
}

// Parse job details via OpenRouter dengan error handling
function parseJobDetails(text) {
  try {
    validateInput(text);

    const prompt = `Parse detail lowongan dari teks ini dan return HANYA JSON (no markdown, no explanation):

${text}

Return JSON format:
{
  "role": "job title or null",
  "company": "company name or null",
  "email": "HR email (format: user@domain) or null",
  "location": "location or null",
  "salary": "salary range or null",
  "requirements": "key requirements or null",
  "description": "job description or null",
  "custom_subject": "if 'subject:' or 'subjek:' found, extract value, else null"
}

Rules:
- Email harus format valid (user@domain)
- Untuk custom_subject: cari patterns 'subject:', 'subjek:', 'posisi:', 'lowongan:'
- Jika tidak ada pattern, set ke null
- Output HANYA JSON, tanpa markdown, tanpa triple backticks`;

    const response = callOpenRouterAPI(prompt);

    // Clean response - sometimes AI add markdown code blocks
    let cleaned = response.trim();

    // Remove markdown code blocks
    if (cleaned.startsWith('```json')) cleaned = cleaned.substring(7);
    if (cleaned.startsWith('```')) cleaned = cleaned.substring(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.substring(0, cleaned.length - 3);

    // Try to extract JSON if wrapped in text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    const parsed = JSON.parse(cleaned.trim());

    // Validate email format
    if (parsed.email && !validateEmail(parsed.email).valid) {
      parsed.email = null;
    }

    return parsed;
  } catch (e) {
    logError('Parse job details failed: ' + e.message + ', text length: ' + text.length);
    return {
      role: null,
      company: null,
      email: null,
      location: null,
      salary: null,
      requirements: null,
      description: null,
      custom_subject: null
    };
  }
}

// Kirim email dengan lampiran CV dari URL dan sender name dari profil
function sendEmailWithAttachmentFromUrl(toEmail, subject, body, senderName) {
  try {
    checkQuota();
    const cvUrl = getCvUrl();
    if (!cvUrl || cvUrl.trim() === '') {
      return { status: 'failed', error: 'CV URL belum diatur di profil. Setup profil terlebih dahulu.' };
    }

    const response = UrlFetchApp.fetch(cvUrl, {
      muteHttpExceptions: true,
      timeout: 30
    });

    if (response.getResponseCode() !== 200) {
      logError('Failed to download CV from URL: ' + cvUrl + ', status: ' + response.getResponseCode());
      return { status: 'failed', error: 'Gagal download CV. Pastikan link CV masih valid.' };
    }

    const blob = response.getBlob();
    if (!blob || blob.getBytes().length === 0) {
      return { status: 'failed', error: 'CV file kosong atau tidak valid.' };
    }

    blob.setName("CV.pdf");

    // Use provided sender name, fallback to email
    const finalSenderName = senderName || Session.getEffectiveUser().getEmail().split('@')[0];
    const userEmail = Session.getEffectiveUser().getEmail();

    // Send email via Gmail with user's name
    GmailApp.sendEmail(toEmail, subject, body, {
      attachments: [blob],
      name: finalSenderName,
      replyTo: userEmail
    });

    logInfo('Email sent from: ' + finalSenderName + ' (' + userEmail + ') to: ' + toEmail + ', subject: ' + subject);
    return { status: 'sent', messageId: 'sent_via_gmail', error: '' };
  } catch (e) {
    logError('Send email failed to ' + toEmail + ': ' + e.message);
    return { status: 'failed', messageId: '', error: e.message };
  }
}

// Ambil CV URL dari sheet (support cv_url atau cv_path)
function getCvUrl() {
  try {
    const profiles = getSheetData(SHEET_NAMES.PROFILES);
    if (profiles.length > 0) {
      const profile = profiles[0];
      return profile.cv_url || profile.cv_path || null;
    }
    return null;
  } catch (e) {
    logError('Get CV URL failed: ' + e.message);
    return null;
  }
}

// ==================== DRIVE & TRIGGER HELPERS ====================

function ensureScreenshotFolderId() {
  return ensureDriveFolderId(SCRIPT_PROP_KEYS.SCREENSHOT_FOLDER_ID, DRIVE_FOLDERS.SCREENSHOTS);
}

function ensureDriveFolderId(propKey, folderName) {
  const props = PropertiesService.getScriptProperties();
  let folderId = props.getProperty(propKey);

  if (folderId) {
    try {
      DriveApp.getFolderById(folderId);
      return folderId;
    } catch (e) {
      logWarning('Folder ID tidak valid, membuat ulang: ' + e.message);
      props.deleteProperty(propKey);
    }
  }

  const existing = DriveApp.getFoldersByName(folderName);
  if (existing.hasNext()) {
    folderId = existing.next().getId();
  } else {
    folderId = DriveApp.createFolder(folderName).getId();
  }
  props.setProperty(propKey, folderId);
  return folderId;
}

function saveBase64Screenshot(base64String, fileName) {
  if (!base64String) throw new Error('Data gambar kosong.');
  const cleanName = fileName || ('lowongan_' + new Date().getTime() + '.png');
  const matches = /^data:(.*?);base64,/i.exec(base64String || '');
  const mimeType = matches && matches[1] ? matches[1] : 'image/png';
  const payload = base64String.includes(',') ? base64String.split(',')[1] : base64String;
  const blob = Utilities.newBlob(Utilities.base64Decode(payload), mimeType, cleanName);
  const folderId = ensureScreenshotFolderId();
  const folder = DriveApp.getFolderById(folderId);
  const file = folder.createFile(blob);
  return file;
}

function scheduleQueue(propKey, handlerName, delayMs) {
  const props = PropertiesService.getScriptProperties();
  const existingId = props.getProperty(propKey);
  const triggers = ScriptApp.getProjectTriggers();

  if (existingId && triggers.some(tr => tr.getUniqueId() === existingId)) {
    return existingId;
  }

  if (existingId) {
    props.deleteProperty(propKey);
  }

  const trigger = ScriptApp.newTrigger(handlerName)
    .timeBased()
    .after(Math.max(delayMs || 0, 0))
    .create();

  props.setProperty(propKey, trigger.getUniqueId());
  return trigger.getUniqueId();
}

function clearQueue(propKey) {
  const props = PropertiesService.getScriptProperties();
  const triggerId = props.getProperty(propKey);
  if (!triggerId) return;

  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getUniqueId() === triggerId) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  props.deleteProperty(propKey);
}

function normalizeImageInput(data) {
  if (!data) return null;
  if (typeof data === 'string') {
    const payload = data.includes(',') ? data.split(',')[1] : data;
    return Utilities.newBlob(Utilities.base64Decode(payload), 'image/png', 'upload.png');
  }
  if (data.getBytes) {
    return data;
  }
  if (data.bytes) {
    return Utilities.newBlob(data.bytes, 'image/png', 'upload.png');
  }
  return null;
}

// ==================== CV EXTRACTION ====================

// Extract skills dan experience dari CV PDF via Gemini
function extractCVInfo(cvUrl) {
  try {
    checkQuota();

    if (!cvUrl) {
      return { skills: '', experiences: '' };
    }

    // Download PDF
    const response = UrlFetchApp.fetch(cvUrl, {
      muteHttpExceptions: true,
      timeout: 30
    });

    if (response.getResponseCode() !== 200) {
      logWarning('Failed to download CV from URL for extraction: ' + cvUrl);
      return { skills: '', experiences: '' };
    }

    const blob = response.getBlob();

    // Convert PDF to text menggunakan Gemini
    const base64Pdf = Utilities.base64Encode(blob.getBytes());
    const prompt = `Extract dari CV ini:
1. LIST SEMUA SKILLS/KEAHLIAN (technical & soft skills) - pisahkan dengan koma
2. PENGALAMAN KERJA RINGKAS (garis besar, max 2-3 sentences)

Format response HANYA:
SKILLS: [list skills]
EXPERIENCE: [ringkas experience]

Jangan tambahkan penjelasan lain.`;

    const geminiResponse = callGeminiAPI(prompt, base64Pdf);

    // Parse response
    const skillsMatch = geminiResponse.match(/SKILLS:\s*(.+?)(?=EXPERIENCE:|$)/is);
    const experienceMatch = geminiResponse.match(/EXPERIENCE:\s*(.+?)$/is);

    const skills = skillsMatch ? skillsMatch[1].trim() : '';
    const experiences = experienceMatch ? experienceMatch[1].trim() : '';

    logInfo('CV extraction successful - Skills: ' + skills.substring(0, 50) + '...');
    return { skills: skills, experiences: experiences };
  } catch (e) {
    logWarning('Extract CV info failed: ' + e.message);
    return { skills: '', experiences: '' };
  }
}

// ==================== UTILITY FUNCTIONS ====================

// Get current user email (dari Gmail API)
function getCurrentUserEmail() {
  try {
    return Session.getEffectiveUser().getEmail();
  } catch (e) {
    logError('Get current user email failed: ' + e.message);
    return 'unknown@gmail.com';
  }
}

// Format email untuk display
function formatEmail(email) {
  if (!email) return 'N/A';
  if (email.length > 50) {
    return email.substring(0, 47) + '...';
  }
  return email;
}

// Get readable timestamp
function formatTimestamp(timestamp) {
  try {
    if (typeof timestamp === 'string') {
      return new Date(timestamp).toLocaleString('id-ID');
    }
    return timestamp.toLocaleString('id-ID');
  } catch (e) {
    return timestamp;
  }
}

// Get current user Gmail account
function getUserEmail() {
  try {
    return Session.getEffectiveUser().getEmail();
  } catch (e) {
    logError('Get user email failed: ' + e.message);
    return 'unknown@gmail.com';
  }
}

// Get current user name (fallback to email)
function getUserName() {
  try {
    const profiles = getSheetData(SHEET_NAMES.PROFILES);
    if (profiles.length > 0 && profiles[0].name) {
      return profiles[0].name;
    }
    const email = Session.getEffectiveUser().getEmail();
    return email.split('@')[0];
  } catch (e) {
    return 'User';
  }
}
