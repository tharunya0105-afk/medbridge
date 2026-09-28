/**
 * MedBridge Client-Side Fallback & Demo Engine
 * Allows full offline and GitHub Pages functionality without requiring a live Python backend.
 */

export const DEMO_CASES = {
  'case-1': {
    description: 'Clean discharge — amlodipine + atorvastatin. No alerts expected.',
    meds: [
      {
        id: 'med-0',
        name_raw: 'Amlopres 5mg',
        name_generic: 'amlodipine',
        dose_value: 5.0,
        dose_unit: 'mg',
        frequency_per_day: 1.0,
        frequency_raw: 'Once daily',
        duration_days: 30,
        route: 'oral',
        instructions: 'Take once daily in the morning with or without food.',
        confidence: 0.95,
        flagged_low_confidence: false,
        confirmed: true
      },
      {
        id: 'med-1',
        name_raw: 'Atorva 20mg',
        name_generic: 'atorvastatin',
        dose_value: 20.0,
        dose_unit: 'mg',
        frequency_per_day: 1.0,
        frequency_raw: 'Once daily',
        duration_days: 30,
        route: 'oral',
        instructions: 'Take once daily at bedtime.',
        confidence: 0.96,
        flagged_low_confidence: false,
        confirmed: true
      }
    ]
  },
  'case-2': {
    description: 'Duplicate case — Crocin + Dolo (both paracetamol). R-DUP-01 should fire.',
    meds: [
      {
        id: 'med-0',
        name_raw: 'Crocin 500mg',
        name_generic: 'paracetamol',
        dose_value: 500.0,
        dose_unit: 'mg',
        frequency_per_day: 2.0,
        frequency_raw: 'Twice daily',
        duration_days: 5,
        route: 'oral',
        instructions: 'Take twice daily after food.',
        confidence: 0.95,
        flagged_low_confidence: false,
        confirmed: true
      },
      {
        id: 'med-1',
        name_raw: 'Dolo 650',
        name_generic: 'paracetamol',
        dose_value: 650.0,
        dose_unit: 'mg',
        frequency_per_day: 2.0,
        frequency_raw: 'Twice daily',
        duration_days: 5,
        route: 'oral',
        instructions: 'Take twice daily for fever.',
        confidence: 0.93,
        flagged_low_confidence: false,
        confirmed: true
      }
    ]
  },
  'case-3': {
    description: 'Interaction case — warfarin + aspirin. R-INT-01 (major) should fire.',
    meds: [
      {
        id: 'med-0',
        name_raw: 'Warf 5mg',
        name_generic: 'warfarin',
        dose_value: 5.0,
        dose_unit: 'mg',
        frequency_per_day: 1.0,
        frequency_raw: 'Once daily',
        duration_days: 30,
        route: 'oral',
        instructions: 'Take once daily at the same time each day.',
        confidence: 0.95,
        flagged_low_confidence: false,
        confirmed: true
      },
      {
        id: 'med-1',
        name_raw: 'Ecosprin 75mg',
        name_generic: 'aspirin',
        dose_value: 75.0,
        dose_unit: 'mg',
        frequency_per_day: 1.0,
        frequency_raw: 'Once daily',
        duration_days: 30,
        route: 'oral',
        instructions: 'Take once daily after food.',
        confidence: 0.94,
        flagged_low_confidence: false,
        confirmed: true
      }
    ]
  },
  'case-4': {
    description: 'Dose-range case — metformin above typical daily limit. R-DOSE-01 should fire.',
    meds: [
      {
        id: 'med-0',
        name_raw: 'Glycomet 1000mg',
        name_generic: 'metformin',
        dose_value: 1000.0,
        dose_unit: 'mg',
        frequency_per_day: 4.0,
        frequency_raw: 'Four times daily',
        duration_days: 30,
        route: 'oral',
        instructions: 'Take four times daily with meals.',
        confidence: 0.92,
        flagged_low_confidence: false,
        confirmed: true
      }
    ]
  },
  'case-5': {
    description: 'Blurry case — one medicine unreadable. R-OCR-01 should abstain on it.',
    meds: [
      {
        id: 'med-0',
        name_raw: 'Amlopres 5mg',
        name_generic: 'amlodipine',
        dose_value: 5.0,
        dose_unit: 'mg',
        frequency_per_day: 1.0,
        frequency_raw: 'Once daily',
        duration_days: 30,
        route: 'oral',
        instructions: 'Take once daily.',
        confidence: 0.95,
        flagged_low_confidence: false,
        confirmed: true
      },
      {
        id: 'med-1',
        name_raw: '??? 250mg',
        name_generic: null,
        dose_value: null,
        dose_unit: null,
        frequency_per_day: null,
        frequency_raw: null,
        duration_days: null,
        route: null,
        instructions: null,
        confidence: 0.28,
        flagged_low_confidence: true,
        confirmed: false
      }
    ]
  },
  'case-6': {
    description: 'Elderly polypharmacy — digoxin, furosemide, lisinopril, spironolactone, aspirin.',
    meds: [
      {
        id: 'med-0',
        name_raw: 'Lanoxin 0.25mg',
        name_generic: 'digoxin',
        dose_value: 0.25,
        dose_unit: 'mg',
        frequency_per_day: 1.0,
        frequency_raw: 'Once daily',
        duration_days: 90,
        route: 'oral',
        instructions: 'Take once daily in the morning.',
        confidence: 0.94,
        flagged_low_confidence: false,
        confirmed: true
      },
      {
        id: 'med-1',
        name_raw: 'Lasix 40mg',
        name_generic: 'furosemide',
        dose_value: 40.0,
        dose_unit: 'mg',
        frequency_per_day: 2.0,
        frequency_raw: 'Twice daily',
        duration_days: 30,
        route: 'oral',
        instructions: 'Take twice daily.',
        confidence: 0.95,
        flagged_low_confidence: false,
        confirmed: true
      },
      {
        id: 'med-2',
        name_raw: 'Listril 10mg',
        name_generic: 'lisinopril',
        dose_value: 10.0,
        dose_unit: 'mg',
        frequency_per_day: 1.0,
        frequency_raw: 'Once daily',
        duration_days: 90,
        route: 'oral',
        instructions: 'Take once daily.',
        confidence: 0.93,
        flagged_low_confidence: false,
        confirmed: true
      },
      {
        id: 'med-3',
        name_raw: 'Aldactone 25mg',
        name_generic: 'spironolactone',
        dose_value: 25.0,
        dose_unit: 'mg',
        frequency_per_day: 1.0,
        frequency_raw: 'Once daily',
        duration_days: 90,
        route: 'oral',
        instructions: 'Take once daily with food.',
        confidence: 0.96,
        flagged_low_confidence: false,
        confirmed: true
      },
      {
        id: 'med-4',
        name_raw: 'Ecosprin 75mg',
        name_generic: 'aspirin',
        dose_value: 75.0,
        dose_unit: 'mg',
        frequency_per_day: 1.0,
        frequency_raw: 'Once daily',
        duration_days: 90,
        route: 'oral',
        instructions: 'Take once daily after food.',
        confidence: 0.95,
        flagged_low_confidence: false,
        confirmed: true
      }
    ]
  }
};

/**
 * Deterministic safety rule evaluator for client-side fallback
 */
export function evaluateRulesClientSide(meds) {
  const alerts = [];
  const confirmed = meds.filter(m => m.confirmed);
  const generics = confirmed.map(m => (m.name_generic || '').toLowerCase());

  // R-OCR-01: Low confidence check
  meds.forEach(m => {
    if (m.flagged_low_confidence || (m.confidence != null && m.confidence < 0.6)) {
      alerts.push({
        rule_id: 'R-OCR-01',
        severity: 'info',
        meds_involved: [m.name_raw],
        message_key: 'ocr_low_confidence',
        message: `The item '${m.name_raw}' could not be read clearly (confidence: ${Math.round((m.confidence || 0) * 100)}%). Please verify this line.`,
        params: { name: m.name_raw, confidence: m.confidence },
        action: 'Ask your pharmacist',
        source_to_verify: 'MedBridge OCR confidence heuristic',
        why_detail: 'Low OCR character confidence suggests text was blurry, faded, or cut off.',
      });
    }
  });

  // R-DUP-01: Duplicate generic check
  const genericCounts = {};
  confirmed.forEach(m => {
    const gen = (m.name_generic || '').toLowerCase();
    if (!gen) return;
    genericCounts[gen] = (genericCounts[gen] || []);
    genericCounts[gen].push(m);
  });

  Object.entries(genericCounts).forEach(([gen, list]) => {
    if (list.length > 1) {
      alerts.push({
        rule_id: 'R-DUP-01',
        severity: 'major',
        meds_involved: list.map(m => m.name_raw),
        message_key: 'duplicate_generic',
        message: `You appear to have ${gen} listed twice — under ${list[0].name_raw} and ${list[1].name_raw}.`,
        params: { generic: gen, drug_a: list[0].name_raw, drug_b: list[1].name_raw },
        action: 'Ask your pharmacist',
        source_to_verify: 'WHO Model List of Essential Medicines / BNF Duplicate Active Ingredient Policy',
        why_detail: `Taking two different brand names containing ${gen} can lead to unintended accidental overdose.`,
      });
    }
  });

  // R-INT-01: Warfarin + Aspirin
  if (generics.includes('warfarin') && generics.includes('aspirin')) {
    alerts.push({
      rule_id: 'R-INT-01',
      severity: 'major',
      meds_involved: ['warfarin', 'aspirin'],
      message_key: 'interaction_major',
      message: 'Warfarin and Aspirin should not normally be taken together without your doctor\'s explicit guidance.',
      params: { drug_a: 'warfarin', drug_b: 'aspirin' },
      action: 'Ask your pharmacist',
      source_to_verify: 'Stockley’s Drug Interactions / BNF Anticoagulants and Antiplatelets',
      why_detail: 'Both medications thin the blood or prevent clotting. Taking them simultaneously significantly increases the risk of serious gastrointestinal or internal bleeding.',
    });
  }

  // R-INT-02: Lisinopril + Spironolactone
  if (generics.includes('lisinopril') && generics.includes('spironolactone')) {
    alerts.push({
      rule_id: 'R-INT-02',
      severity: 'moderate',
      meds_involved: ['lisinopril', 'spironolactone'],
      message_key: 'interaction_moderate',
      message: 'There is a possible interaction between Lisinopril and Spironolactone.',
      params: { drug_a: 'lisinopril', drug_b: 'spironolactone' },
      action: 'Ask your pharmacist',
      source_to_verify: 'NICE Clinical Knowledge Summaries / BNF ACEi and Potassium-Sparing Diuretics',
      why_detail: 'Both medications can retain potassium in the body. Taking them together requires monitoring of serum potassium and kidney function.',
    });
  }

  // R-INT-03: Digoxin + Furosemide
  if (generics.includes('digoxin') && generics.includes('furosemide')) {
    alerts.push({
      rule_id: 'R-INT-03',
      severity: 'moderate',
      meds_involved: ['digoxin', 'furosemide'],
      message_key: 'interaction_moderate',
      message: 'There is a possible interaction between Digoxin and Furosemide.',
      params: { drug_a: 'digoxin', drug_b: 'furosemide' },
      action: 'Ask your pharmacist',
      source_to_verify: 'BNF Cardiac Glycosides and Loop Diuretics',
      why_detail: 'Furosemide can lower blood potassium levels (hypokalemia), which increases cardiac sensitivity to Digoxin and can provoke arrhythmias.',
    });
  }

  // R-DOSE-01: Metformin max dose check (> 2550 mg/day)
  confirmed.forEach(m => {
    if ((m.name_generic || '').toLowerCase() === 'metformin' && m.dose_value && m.frequency_per_day) {
      const dailyTotal = m.dose_value * m.frequency_per_day;
      if (dailyTotal > 2550) {
        alerts.push({
          rule_id: 'R-DOSE-01',
          severity: 'major',
          meds_involved: ['metformin'],
          message_key: 'dose_above_limit',
          message: `Your total daily dose of metformin (${dailyTotal} mg) may be above the usual safe limit (2550 mg).`,
          params: { generic: 'metformin', total: dailyTotal, max: 2550, unit: 'mg' },
          action: 'Contact your doctor',
          source_to_verify: 'FDA Prescribing Information for Glucophage (Metformin)',
          why_detail: 'Exceeding the maximum recommended daily dose of metformin elevates the risk of lactic acidosis without additional therapeutic glycemic benefit.',
        });
      }
    }
  });

  // Red Flags: Warfarin
  if (generics.includes('warfarin')) {
    alerts.push({
      rule_id: 'R-RED-02',
      severity: 'major',
      meds_involved: ['warfarin'],
      message_key: 'red_flag_warfarin',
      message: 'While taking warfarin, watch for: unexplained bruising, blood in urine or stool, nosebleeds. If any appear, seek urgent care.',
      params: { generic: 'warfarin', symptoms: 'unexplained bruising, blood in urine or stool, prolonged bleeding', action: 'seek urgent care' },
      action: 'Seek urgent care',
      source_to_verify: 'NHS Warfarin Patient Safety Information Booklet',
      why_detail: 'Signs of excessive anticoagulation require prompt clinical evaluation and INR testing.',
    });
  }

  // Red Flags: Digoxin
  if (generics.includes('digoxin')) {
    alerts.push({
      rule_id: 'R-RED-01',
      severity: 'major',
      meds_involved: ['digoxin'],
      message_key: 'red_flag_digoxin',
      message: 'While taking digoxin, watch for: nausea, vomiting, dizziness, blurred or yellowish vision. If any appear, contact your doctor.',
      params: { generic: 'digoxin', symptoms: 'nausea, dizziness, yellow halos around lights', action: 'contact your doctor' },
      action: 'Contact your doctor',
      source_to_verify: 'BNF Narrow Therapeutic Index Monitoring Guidelines',
      why_detail: 'Digoxin has a narrow therapeutic range. Gastrointestinal and visual symptoms can indicate early toxicity.',
    });
  }

  return alerts;
}

/**
 * Generate plain-language explanations client-side
 */
export function generateExplanationsClientSide(meds) {
  const confirmed = meds.filter(m => m.confirmed);
  return confirmed.map(med => {
    const parts = [];
    if (med.instructions) {
      parts.push(`Your prescription says: ${med.instructions}`);
    }
    if (med.dose_value && med.dose_unit) {
      parts.push(`Take ${med.dose_value} ${med.dose_unit}`);
    }
    if (med.frequency_per_day) {
      const fMap = { 1: 'once a day', 2: 'twice a day', 3: 'three times a day', 4: 'four times a day' };
      parts.push(fMap[med.frequency_per_day] || `${med.frequency_per_day} times a day`);
    }
    if (med.duration_days) {
      parts.push(`for ${med.duration_days} days`);
    }
    const text = parts.length > 0
      ? parts.join(', ') + '.'
      : 'Please take as prescribed by your doctor and ask your pharmacist about any questions.';

    return {
      med_id: med.id,
      name: med.name_raw,
      text: text
    };
  });
}

/**
 * Generate teach-back questions client-side
 */
export function generateQuestionsClientSide(meds) {
  const confirmed = meds.filter(m => m.confirmed);
  if (!confirmed.length) return [];

  const questions = [];

  // Q1: Frequency of first medicine
  const freqMed = confirmed.find(m => m.frequency_per_day != null);
  if (freqMed) {
    const fMap = { 1: 'Once a day', 2: 'Twice a day', 3: 'Three times a day', 4: 'Four times a day' };
    const correctLabel = fMap[freqMed.frequency_per_day] || `${freqMed.frequency_per_day} times a day`;
    const distractors = ['Once a day', 'Twice a day', 'Three times a day', 'Four times a day'].filter(x => x !== correctLabel);

    const options = [correctLabel, distractors[0], distractors[1], distractors[2]];
    // Deterministic shuffle
    const shuffled = [options[1], options[0], options[2], options[3]];
    const correctIdx = shuffled.indexOf(correctLabel);

    questions.push({
      question_id: 'q-freq-0',
      question_text: `How often should you take ${freqMed.name_raw}?`,
      text: `How often should you take ${freqMed.name_raw}?`,
      options: shuffled,
      correct_index: correctIdx,
      med_id: freqMed.id,
      rationale: `Your discharge summary instructs you to take ${freqMed.name_raw} ${correctLabel.toLowerCase()}.`
    });
  }

  // Q2: Duration or dose question
  const durMed = confirmed.find(m => m.duration_days != null);
  if (durMed) {
    const correctDur = `${durMed.duration_days} days`;
    const durPool = ['5 days', '7 days', '14 days', '30 days', '90 days'].filter(d => d !== correctDur);
    const options = [durPool[0], correctDur, durPool[1], durPool[2]];
    const correctIdx = options.indexOf(correctDur);

    questions.push({
      question_id: 'q-dur-0',
      question_text: `For how long should you take ${durMed.name_raw}?`,
      text: `For how long should you take ${durMed.name_raw}?`,
      options: options,
      correct_index: correctIdx,
      med_id: durMed.id,
      rationale: `Your prescription specifies taking ${durMed.name_raw} for ${correctDur}.`
    });
  }

  // Q3: General safety question
  questions.push({
    question_id: 'q-safety-0',
    question_text: 'What should you do if you notice unexpected bleeding, severe dizziness, or an unusual symptom?',
    text: 'What should you do if you notice unexpected bleeding, severe dizziness, or an unusual symptom?',
    options: [
      'Ignore it and wait for your next scheduled appointment in a few months',
      'Double the dose of your medicine to see if symptoms improve',
      'Contact your pharmacist, doctor, or seek urgent care right away',
      'Stop eating food with your medicines'
    ],
    correct_index: 2,
    med_id: 'general',
    rationale: 'Always contact your healthcare provider or seek urgent medical attention whenever warning signs or unexpected side effects develop.'
  });

  return questions;
}
