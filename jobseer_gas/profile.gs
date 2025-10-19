// profile.gs - Profile Management & CV Extraction Functions
// Handle user profile setup, CV parsing, and auto-extraction of skills/experience

// ==================== PROFILE INITIALIZATION ====================

// Get existing profile atau create new one
function getOrCreateProfile() {
  try {
    const profiles = getSheetData(SHEET_NAMES.PROFILES);
    if (profiles && profiles.length > 0) {
      return profiles[0];
    }
    return null;
  } catch (e) {
    logError('Get or create profile failed: ' + e.message);
    return null;
  }
}

// ==================== SAVE PROFILE WITH CV EXTRACTION ====================

// Save profile dan auto-extract CV info
function saveProfileWithExtraction(profileData) {
  try {
    checkQuota();
    validateInput(JSON.stringify(profileData));

    const cvUrl = profileData.cvUrl || '';

    // Extract skills dan experience dari CV
    let cvInfo = { skills: '', experiences: '' };
    if (cvUrl && cvUrl.trim() !== '') {
      logInfo('Extracting CV info from: ' + cvUrl.substring(0, 50) + '...');
      cvInfo = extractCVInfo(cvUrl);
    }

    // Merge dengan input
    const mergedProfile = {
      name: profileData.name || '',
      email: profileData.email || '',
      cv_url: cvUrl,
      cv_path: cvUrl,
      ai_prompt: profileData.prompt || '',
      skills: cvInfo.skills || profileData.skills || '',
      experiences: cvInfo.experiences || profileData.experience || '',
      ai_model: 'gemini-2.0-flash-exp',
      updated_at: new Date()
    };

    const existing = getOrCreateProfile();

    if (existing) {
      // Update existing profile
      updateSheetRow(SHEET_NAMES.PROFILES, row => true, mergedProfile);
      logInfo('Profile updated with CV extraction');
    } else {
      // Insert new profile
      appendToSheet(SHEET_NAMES.PROFILES, [
        'default_user',
        mergedProfile.name,
        mergedProfile.email,
        mergedProfile.cv_path,
        mergedProfile.ai_prompt,
        mergedProfile.skills,
        mergedProfile.experiences,
        'Auto-created from JobSeer GAS',
        mergedProfile.ai_model,
        false,
        false,
        new Date(),
        new Date(),
        mergedProfile.cv_url,
        mergedProfile.ai_prompt
      ]);
      logInfo('New profile created with CV extraction');
    }

    return {
      success: true,
      message: 'Profil berhasil disimpan dengan skills & pengalaman dari CV!',
      profile: mergedProfile
    };
  } catch (e) {
    logError('Save profile with extraction failed: ' + e.message);
    return {
      success: false,
      error: 'Gagal simpan profil: ' + e.message,
      profile: null
    };
  }
}

// ==================== CV EXTRACTION VIA GEMINI ====================

// Extract skills & experience dari CV PDF
function extractCVInfo(cvUrl) {
  try {
    checkQuota();

    if (!cvUrl || cvUrl.trim() === '') {
      return { skills: '', experiences: '' };
    }

    // Download PDF from URL
    logInfo('Downloading CV from URL...');
    const response = UrlFetchApp.fetch(cvUrl, {
      muteHttpExceptions: true,
      timeout: 30
    });

    if (response.getResponseCode() !== 200) {
      logWarning('Failed to download CV: ' + response.getResponseCode());
      return { skills: '', experiences: '' };
    }

    const blob = response.getBlob();
    if (!blob || blob.getBytes().length === 0) {
      logWarning('CV blob is empty');
      return { skills: '', experiences: '' };
    }

    // Convert to base64
    const base64Pdf = Utilities.base64Encode(blob.getBytes());

    // Use Gemini to extract info
    logInfo('Extracting CV info via Gemini...');
    const prompt = `Analyze CV/Resume ini dan extract:

1. SKILLS: List semua technical skills dan soft skills yang terlihat
   Format: skill1, skill2, skill3, etc (max 20 items)

2. EXPERIENCE: Ringkas pengalaman kerja total dan posisi utama
   Format: X+ years, posisi utama, industri (max 1 sentence)

Return HANYA dalam format:
SKILLS: [list]
EXPERIENCE: [ringkas]

Jangan ada teks lain.`;

    const extraction = callGeminiAPI(prompt, base64Pdf);

    // Parse response
    const skillsMatch = extraction.match(/SKILLS:\s*(.+?)(?=EXPERIENCE:|$)/is);
    const expMatch = extraction.match(/EXPERIENCE:\s*(.+?)$/is);

    const skills = skillsMatch
      ? skillsMatch[1].trim().substring(0, 500)
      : '';
    const experiences = expMatch
      ? expMatch[1].trim().substring(0, 300)
      : '';

    logInfo('CV extraction complete - Skills found: ' + (skills.split(',').length) + ' items');
    return {
      skills: skills,
      experiences: experiences
    };
  } catch (e) {
    logWarning('CV extraction failed: ' + e.message);
    return { skills: '', experiences: '' };
  }
}

// ==================== GET PROFILE FOR USE ====================

// Get profile data untuk digunakan dalam cover letter generation
function getProfileForGeneration() {
  try {
    const profiles = getSheetData(SHEET_NAMES.PROFILES);
    if (!profiles || profiles.length === 0) {
      return getDefaultProfileData();
    }

    const p = profiles[0];
    return {
      name: p.name || 'Kandidat',
      email: p.email || '',
      skills: p.skills || '',
      experiences: p.experiences || '',
      prompt: p.ai_prompt || 'Buat cover letter profesional yang ringkas dan personal.',
      cv_url: p.cv_url || p.cv_path || ''
    };
  } catch (e) {
    logError('Get profile for generation failed: ' + e.message);
    return getDefaultProfileData();
  }
}

// Default profile data
function getDefaultProfileData() {
  return {
    name: 'Kandidat',
    email: '',
    skills: '',
    experiences: '',
    prompt: 'Buat cover letter profesional yang ringkas dan personal.',
    cv_url: ''
  };
}

// ==================== PROFILE VALIDATION ====================

// Validate profile completeness
function validateProfile(profile) {
  try {
    if (!profile) {
      return { valid: false, reason: 'Profile tidak ada' };
    }

    if (!profile.name || profile.name.trim() === '') {
      return { valid: false, reason: 'Nama harus diisi' };
    }

    if (!profile.email || profile.email.trim() === '') {
      return { valid: false, reason: 'Email harus diisi' };
    }

    if (!profile.cvUrl || profile.cvUrl.trim() === '') {
      return { valid: false, reason: 'CV URL harus diisi' };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(profile.email)) {
      return { valid: false, reason: 'Email format tidak valid' };
    }

    return { valid: true, reason: 'OK' };
  } catch (e) {
    logError('Profile validation failed: ' + e.message);
    return { valid: false, reason: 'Validation error' };
  }
}

// ==================== UPDATE PROFILE FIELDS ====================

// Update specific profile field
function updateProfileField(fieldName, fieldValue) {
  try {
    checkQuota();
    const profiles = getSheetData(SHEET_NAMES.PROFILES);

    if (!profiles || profiles.length === 0) {
      return { success: false, error: 'Profile tidak ditemukan' };
    }

    const updates = {};
    updates[fieldName] = fieldValue;
    updates['updated_at'] = new Date();

    updateSheetRow(SHEET_NAMES.PROFILES, row => true, updates);
    logInfo('Profile field updated: ' + fieldName);

    return { success: true, message: 'Field updated' };
  } catch (e) {
    logError('Update profile field failed: ' + e.message);
    return { success: false, error: e.message };
  }
}

// ==================== PROFILE DISPLAY ====================

// Format profile untuk display di frontend
function formatProfileForDisplay() {
  try {
    const profile = getProfileForGeneration();

    return {
      name: profile.name,
      email: profile.email,
      hasCV: profile.cv_url ? true : false,
      skillsCount: profile.skills ? profile.skills.split(',').length : 0,
      hasExperience: profile.experiences ? true : false,
      hasPrompt: profile.prompt && profile.prompt.length > 0 ? true : false,
      skills: profile.skills,
      experiences: profile.experiences,
      prompt: profile.prompt
    };
  } catch (e) {
    logError('Format profile for display failed: ' + e.message);
    return null;
  }
}

// ==================== CLEAR PROFILE ====================

// Clear all profile data (careful!)
function clearProfile() {
  try {
    checkQuota();
    const config = getConfig();
    const spreadsheet = SpreadsheetApp.openById(config.SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHEET_NAMES.PROFILES);

    if (sheet && sheet.getLastRow() > 1) {
      const range = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
      range.clearContent();
      logWarning('Profile cleared by user');
      return { success: true, message: 'Profil sudah dihapus' };
    }

    return { success: false, error: 'Tidak ada data untuk dihapus' };
  } catch (e) {
    logError('Clear profile failed: ' + e.message);
    return { success: false, error: e.message };
  }
}
