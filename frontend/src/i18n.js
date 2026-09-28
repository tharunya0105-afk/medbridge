/**
 * MedBridge i18n — English and Tamil strings.
 * Mirrors the backend i18n/en.json and ta.json.
 */

const en = {
  app_name: 'MedBridge',
  tagline: 'A safety net between the hospital door and the kitchen table.',
  disclaimer: 'Not medical advice. This is an unvalidated demo dataset. Confirm all results with your pharmacist or doctor.',
  demo_badge: 'Demo data',

  welcome: {
    title: 'Welcome to MedBridge',
    subtitle: 'MedBridge helps you understand your discharge medicines.',
    disclaimer_heading: 'Important',
    disclaimer_body: 'MedBridge does not diagnose, prescribe, or change treatment. It is a support tool only. Always confirm your medicines with your pharmacist or doctor.',
    consent_label: 'I understand this is a support tool, not medical advice.',
    start_live: 'Photograph my discharge summary',
    start_demo: 'Try a sample case',
    language_label: 'Language',
  },

  capture: {
    title: 'Upload or photograph your discharge summary',
    upload_btn: 'Choose file',
    camera_btn: 'Use camera',
    quality_ok: 'Image looks good — processing...',
    quality_fail: 'Image quality too low. Please retake.',
    processing: 'Reading your document...',
  },

  confirm: {
    title: 'Check your medicines',
    subtitle: 'Please check each item. Edit anything that looks wrong.',
    amber_label: 'Please check this',
    field_name: 'Medicine name',
    field_dose: 'Dose',
    field_frequency: 'How often',
    field_duration: 'For how long',
    confirm_btn: 'Confirm',
    edit_btn: 'Edit',
    unsure_btn: 'Not sure',
    add_row_btn: '+ Add a medicine',
    run_check_btn: 'Run safety check',
    unsure_note: "Items marked 'not sure' will be sent to 'Ask your pharmacist' — they will not be safety-checked.",
  },

  safety: {
    title: 'Safety check results',
    no_alerts: 'No safety concerns found for the medicines you confirmed.',
    what_was_checked: 'What was checked',
    not_checked: 'Not checked (please ask your pharmacist)',
    show_why: 'Show me why',
    hide_why: 'Hide details',
    rule_id_label: 'Rule',
    action_label: 'What to do',
    severity_major: 'Important — please act on this',
    severity_moderate: 'Worth knowing',
    severity_info: 'Information',
    disclaimer_footer: 'Not medical advice. Confirm with your pharmacist or doctor.',
    verified_footer: 'Checked by deterministic rules — not by AI.',
    continue_btn: 'View my medicines',
  },

  medicines: {
    title: 'Your medicines today',
    listen_btn: 'Listen',
    large_text_btn: 'Large text',
    what_is_it: 'What it is for',
    how_to_take: 'How to take it',
    watch_for: 'Watch for',
    source_note: 'Based only on your discharge document.',
    continue_btn: 'Check my understanding',
  },

  teachback: {
    title: 'Check your understanding',
    subtitle: 'Answer a few questions about your medicines.',
    correct_feedback: 'Correct! ✓',
    wrong_feedback: 'Not quite. Here is the right answer:',
    score_label: 'Your score',
    caregiver_prompt: 'Your score is below 60%. Would you like to share this summary with a caregiver?',
    share_btn: 'Share with caregiver',
    next_btn: 'Next question',
    finish_btn: 'See my summary',
    question_of: 'Question {current} of {total}',
  },

  summary: {
    title: 'Summary for your pharmacist or nurse',
    copy_btn: 'Copy',
    print_btn: 'Print',
    meds_heading: 'Confirmed medicines',
    alerts_heading: 'Safety flags',
    unsure_heading: 'Items needing pharmacist check',
    quiz_heading: 'Comprehension score',
    unvalidated_note: 'DEMO DATASET — Not clinically validated. Must be reviewed by a pharmacist.',
    delete_btn: 'Delete my data',
    start_over: 'Start over',
  },

  actions: {
    ask_pharmacist: 'Ask your pharmacist',
    contact_doctor: 'Contact your doctor',
    seek_urgent_care: 'Seek urgent care',
  },

  interaction_major: '{drug_a} and {drug_b} should not normally be taken together without your doctor\'s guidance.',
  interaction_moderate: 'There is a possible interaction between {drug_a} and {drug_b}.',
  duplicate_generic: 'You appear to have {generic} listed twice — under {drug_a} and {drug_b}.',
  dose_above_limit: 'Your total daily dose of {generic} ({total} {unit}) may be above the usual limit ({max} {unit}).',
  implausible_frequency: '{name} is written as {frequency} times per day, which is unusual. Please check.',
  ocr_low_confidence: "The item '{name}' could not be read clearly (confidence: {confidence}). Please check this line.",
  red_flag_digoxin: 'While taking {generic}, watch for: {symptoms}. If any appear, {action}.',
  red_flag_warfarin: 'While taking {generic}, watch for: {symptoms}. If any appear, {action}.',
  red_flag_ace_angioedema: 'While taking {generic}, watch for: {symptoms}. If any appear, {action}.',
  red_flag_metformin_lactic_acidosis: 'While taking {generic}, watch for: {symptoms}. If any appear, {action}.',
  red_flag_hyperkalaemia: 'While taking {generic}, watch for: {symptoms}. If any appear, {action}.',

  demo_cases: {
    'case-1': { title: 'Case 1 — Clean', desc: 'Amlodipine + Atorvastatin. No alerts.' },
    'case-2': { title: 'Case 2 — Duplicate', desc: 'Crocin + Dolo (both paracetamol).' },
    'case-3': { title: 'Case 3 — Interaction', desc: 'Warfarin + Aspirin (major).' },
    'case-4': { title: 'Case 4 — Dose Limit', desc: 'Metformin overdose scenario.' },
    'case-5': { title: 'Case 5 — Blurry', desc: 'One unreadable medicine.' },
    'case-6': { title: 'Case 6 — Polypharmacy', desc: '5 drugs, multiple alerts.' },
  },
};

const ta = {
  app_name: 'மெட்பிரிட்ஜ்',
  tagline: 'மருத்துவமனை கதவிலிருந்து வீட்டு சமையலறைக்கு இடையிலான பாதுகாப்பு வலை.',
  disclaimer: 'இது மருத்துவ ஆலோசனை அல்ல. உங்கள் மருந்தாளர் அல்லது மருத்துவரிடம் உறுதிப்படுத்தவும்.',
  demo_badge: 'டெமோ தரவு',

  welcome: {
    title: 'மெட்பிரிட்ஜுக்கு வரவேற்கிறோம்',
    subtitle: 'உங்கள் மருத்துவமனை வெளியேற்ற மருந்துகளை புரிந்துகொள்ள உதவுகிறது.',
    disclaimer_heading: 'முக்கியமான குறிப்பு',
    disclaimer_body: 'மெட்பிரிட்ஜ் நோயை கண்டறியவோ, மருந்து பரிந்துரைக்கவோ செய்வதில்லை. இது ஒரு உதவி கருவி மட்டுமே.',
    consent_label: 'இது ஒரு உதவி கருவி மட்டுமே என்று புரிகிறது.',
    start_live: 'வெளியேற்ற சுருக்கத்தை புகைப்படம் எடு',
    start_demo: 'மாதிரி வழக்கை முயற்சி செய்',
    language_label: 'மொழி',
  },

  capture: {
    title: 'வெளியேற்ற சுருக்கத்தை பதிவேற்றவும்',
    upload_btn: 'கோப்பை தேர்ந்தெடு',
    camera_btn: 'கேமரா பயன்படுத்து',
    processing: 'ஆவணத்தை படிக்கிறது...',
  },

  confirm: {
    title: 'உங்கள் மருந்துகளை சரிபார்க்கவும்',
    subtitle: 'தவறாக தெரிந்தால் திருத்தவும்.',
    amber_label: 'இதை சரிபார்க்கவும்',
    field_name: 'மருந்தின் பெயர்',
    field_dose: 'அளவு',
    field_frequency: 'எத்தனை முறை',
    field_duration: 'எத்தனை நாட்கள்',
    confirm_btn: 'உறுதிப்படுத்து',
    edit_btn: 'திருத்து',
    unsure_btn: 'தெரியவில்லை',
    run_check_btn: 'பாதுகாப்பு சோதனை செய்',
  },

  safety: {
    title: 'பாதுகாப்பு சோதனை முடிவுகள்',
    no_alerts: 'பாதுகாப்பு கவலைகள் எதுவும் இல்லை.',
    show_why: 'ஏன் என்று காட்டு',
    hide_why: 'மூடு',
    severity_major: 'முக்கியமானது',
    severity_moderate: 'தெரிந்திருக்க வேண்டியது',
    severity_info: 'தகவல்',
    continue_btn: 'மருந்துகளை பார்',
  },

  medicines: {
    title: 'உங்கள் இன்றைய மருந்துகள்',
    continue_btn: 'புரிதலை சோதி',
  },

  teachback: {
    title: 'புரிதலை சோதிக்கவும்',
    subtitle: 'உங்கள் மருந்துகளைப் பற்றிய கேள்விகளுக்கு பதிலளிக்கவும்.',
    correct_feedback: 'சரி! ✓',
    wrong_feedback: 'சரியான பதில்:',
    finish_btn: 'சுருக்கத்தை பார்',
    next_btn: 'அடுத்த கேள்வி',
  },

  summary: {
    title: 'மருந்தாளருக்கான சுருக்கம்',
    copy_btn: 'நகலெடு',
    print_btn: 'அச்சிடு',
    delete_btn: 'தரவை நீக்கு',
    start_over: 'மீண்டும் தொடங்கு',
  },

  actions: {
    ask_pharmacist: 'உங்கள் மருந்தாளரிடம் கேளுங்கள்',
    contact_doctor: 'உங்கள் மருத்துவரை தொடர்பு கொள்ளுங்கள்',
    seek_urgent_care: 'உடனடி மருத்துவ உதவி பெறுங்கள்',
  },

  // Fallback to English for message templates
  interaction_major: en.interaction_major,
  interaction_moderate: en.interaction_moderate,
  duplicate_generic: en.duplicate_generic,
  dose_above_limit: en.dose_above_limit,
  implausible_frequency: en.implausible_frequency,
  ocr_low_confidence: en.ocr_low_confidence,
  red_flag_digoxin: en.red_flag_digoxin,
  red_flag_warfarin: en.red_flag_warfarin,
  red_flag_ace_angioedema: en.red_flag_ace_angioedema,
  red_flag_metformin_lactic_acidosis: en.red_flag_metformin_lactic_acidosis,
  red_flag_hyperkalaemia: en.red_flag_hyperkalaemia,

  demo_cases: en.demo_cases,
};

const strings = { en, ta };

export function t(lang, key) {
  const parts = key.split('.');
  let val = strings[lang] || strings.en;
  for (const p of parts) {
    val = val?.[p];
  }
  return val ?? key;
}

/**
 * Interpolate template params: "{drug_a} and {drug_b}" + {drug_a: "Warfarin", drug_b: "Aspirin"}
 */
export function tMsg(lang, messageKey, params = {}) {
  let template = t(lang, messageKey);
  if (typeof template !== 'string') return messageKey;
  for (const [k, v] of Object.entries(params)) {
    template = template.replaceAll(`{${k}}`, v);
  }
  return template;
}

export default strings;
