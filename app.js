/**
 * Student Result Search System - Core Application Logic
 * College Project Demonstration Model
 * Compares Linear Search O(n) vs Binary Search O(log n)
 */

// ==========================================================================
// Constants & Configuration
// ==========================================================================
const SUBJECTS = ["Python", "Data Structures", "Mathematics", "Electronics", "Communication Skills"];
const FIRST_ROLL = 1001;
const FIRST_NAMES = [
  "Aarav", "Aditi", "Arjun", "Anaya", "Ishaan", "Isha", "Kabir", "Kavya",
  "Rohan", "Saanvi", "Vivaan", "Diya", "Aditya", "Meera", "Yash", "Tanvi"
];
const LAST_NAMES = [
  "Patil", "Sharma", "Jadhav", "Deshmukh", "Kulkarni", "Pawar", "Joshi",
  "More", "Shinde", "Chavan", "Kadam", "Gupta"
];

// Reference benchmark data (empirically derived from the Python project runs)
const REFERENCE_BENCHMARKS = [
  { size: 100, count: 1004, linearCmp: 50.8, binaryCmp: 5.7, linearUs: 4.85, binaryUs: 1.12 },
  { size: 1000, count: 1004, linearCmp: 501.2, binaryCmp: 8.9, linearUs: 38.60, binaryUs: 1.65 },
  { size: 10000, count: 1004, linearCmp: 5003.5, binaryCmp: 12.3, linearUs: 395.20, binaryUs: 2.15 },
  { size: 100000, count: 1004, linearCmp: 50012.0, binaryCmp: 15.6, linearUs: 3910.40, binaryUs: 2.78 }
];

// ==========================================================================
// Application State
// ==========================================================================
const state = {
  students: [], // Active full dataset
  visualSubset: [], // Slice displayed in the visualizer arena
  soundEnabled: true,
  audioCtx: null,

  // Visualizer Execution State
  linearTrace: [],
  binaryTrace: [],
  linearStepIdx: 0,
  binaryStepIdx: 0,
  simulationTimer: null,
  isPaused: false,
  stepSpeedMs: 400,
  targetRoll: null,
  activeFoundStudent: null,

  // Directory Table State
  dirSearchTerm: '',
  dirGradeFilter: 'ALL',
  dirStatusFilter: 'ALL',
  dirCurrentPage: 1,
  dirPageSize: 12,

  // Chart Instances
  comparisonsChart: null,
  timeChart: null,
  benchmarkResults: [...REFERENCE_BENCHMARKS]
};

// ==========================================================================
// Sound Effects Synthesizer (Web Audio API)
// ==========================================================================
function initAudio() {
  if (!state.audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      state.audioCtx = new AudioContext();
    }
  }
  if (state.audioCtx && state.audioCtx.state === 'suspended') {
    state.audioCtx.resume();
  }
}

function playTone(freq, type = 'sine', duration = 0.06, gainLevel = 0.08) {
  if (!state.soundEnabled) return;
  try {
    initAudio();
    if (!state.audioCtx) return;
    const osc = state.audioCtx.createOscillator();
    const gain = state.audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, state.audioCtx.currentTime);
    gain.gain.setValueAtTime(gainLevel, state.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, state.audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(state.audioCtx.destination);
    osc.start();
    osc.stop(state.audioCtx.currentTime + duration);
  } catch (e) {
    // Audio context may be restricted by autoplay policy
  }
}

function playSuccessChime() {
  if (!state.soundEnabled) return;
  const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
  notes.forEach((freq, idx) => {
    setTimeout(() => playTone(freq, 'triangle', 0.18, 0.1), idx * 75);
  });
}

function playNotFoundTone() {
  if (!state.soundEnabled) return;
  playTone(220, 'sawtooth', 0.2, 0.07);
}

// ==========================================================================
// Data Generation & Utility Functions
// ==========================================================================
function gradeFor(percentage) {
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B";
  if (percentage >= 60) return "C";
  if (percentage >= 50) return "D";
  return "E";
}

// Simple pseudo-random number generator for seeded datasets
function createRng(seed = 42) {
  let s = seed;
  return function() {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function generateStudents(size, seed = 2026) {
  const rng = createRng(seed);
  const students = [];
  for (let offset = 0; offset < size; offset++) {
    const marks = SUBJECTS.map(() => Math.floor(rng() * 76) + 25); // 25 to 100
    const total = marks.reduce((a, b) => a + b, 0);
    const percentage = Number((total / SUBJECTS.length).toFixed(2));
    const status = marks.every(m => m >= 35) ? "Pass" : "Fail";
    const firstName = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
    const lastName = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
    const rollNo = FIRST_ROLL + offset;

    students.push({
      roll_no: rollNo,
      name: `${firstName} ${lastName}`,
      marks,
      total,
      percentage,
      grade: gradeFor(percentage),
      status
    });
  }
  return students;
}

// ==========================================================================
// Trace Generators (For Step-by-Step Visualizer Animation)
// ==========================================================================
function generateLinearSearchTrace(arr, key) {
  const trace = [];
  let comparisons = 0;
  for (let i = 0; i < arr.length; i++) {
    comparisons++;
    const roll = arr[i].roll_no;
    trace.push({
      type: 'check',
      index: i,
      roll: roll,
      comparisons: comparisons,
      message: `Step ${comparisons}: Scanning index [${i}] with Roll No: ${roll}`
    });

    if (roll === key) {
      trace.push({
        type: 'found',
        index: i,
        roll: roll,
        comparisons: comparisons,
        message: `MATCH FOUND at index [${i}]! (Roll No: ${roll})`
      });
      return trace;
    }
  }

  trace.push({
    type: 'not_found',
    comparisons: comparisons,
    message: `End of array reached after ${comparisons} comparisons. Target ${key} NOT FOUND.`
  });
  return trace;
}

function generateBinarySearchTrace(arr, key) {
  const trace = [];
  let low = 0;
  let high = arr.length - 1;
  let comparisons = 0;
  let step = 0;

  while (low <= high) {
    step++;
    const mid = Math.floor((low + high) / 2);
    comparisons++;
    const midVal = arr[mid].roll_no;

    trace.push({
      type: 'inspect_range',
      low,
      high,
      mid,
      midVal,
      comparisons,
      step,
      message: `Step ${step}: Active range [${low} .. ${high}], Mid index [${mid}] is Roll: ${midVal}`
    });

    if (midVal === key) {
      trace.push({
        type: 'found',
        low,
        high,
        mid,
        midVal,
        comparisons,
        step,
        message: `MATCH FOUND at Mid index [${mid}]! (Roll: ${midVal})`
      });
      return trace;
    }

    if (midVal < key) {
      const prevLow = low;
      low = mid + 1;
      trace.push({
        type: 'discard_left',
        discardStart: prevLow,
        discardEnd: mid,
        low,
        high,
        mid,
        midVal,
        comparisons,
        step,
        message: `${midVal} < ${key} (Target is larger). Discarding left half [${prevLow}..${mid}]. New Low = ${low}.`
      });
    } else {
      const prevHigh = high;
      high = mid - 1;
      trace.push({
        type: 'discard_right',
        discardStart: mid,
        discardEnd: prevHigh,
        low,
        high,
        mid,
        midVal,
        comparisons,
        step,
        message: `${midVal} > ${key} (Target is smaller). Discarding right half [${mid}..${prevHigh}]. New High = ${high}.`
      });
    }
  }

  trace.push({
    type: 'not_found',
    comparisons,
    message: `Range exhausted (low > high) in ${comparisons} comparisons. Target ${key} NOT FOUND.`
  });
  return trace;
}

// ==========================================================================
// Visualizer Rendering & Stepping Engine
// ==========================================================================
function updateVisualSubset() {
  const sizeSelect = document.getElementById('visual-size-select');
  const count = parseInt(sizeSelect.value, 10) || 32;
  state.visualSubset = state.students.slice(0, count);

  document.getElementById('linear-max-idx').textContent = (state.visualSubset.length - 1).toString();
  renderVisualCardArenas();
}

function renderVisualCardArenas() {
  const linearContainer = document.getElementById('linear-cards-container');
  const binaryContainer = document.getElementById('binary-cards-container');
  linearContainer.innerHTML = '';
  binaryContainer.innerHTML = '';

  state.visualSubset.forEach((student, idx) => {
    // Linear Card
    const lCard = document.createElement('div');
    lCard.className = 'student-card';
    lCard.id = `l-card-${idx}`;
    lCard.innerHTML = `
      <div class="card-idx">[${idx}]</div>
      <div class="card-roll">${student.roll_no}</div>
      <div class="card-name-initials" title="${student.name}">${student.name.split(' ')[0]}</div>
    `;
    lCard.addEventListener('click', () => {
      document.getElementById('target-roll-input').value = student.roll_no;
      showStudentResultCard(student);
    });
    linearContainer.appendChild(lCard);

    // Binary Card
    const bCard = document.createElement('div');
    bCard.className = 'student-card';
    bCard.id = `b-card-${idx}`;
    bCard.innerHTML = `
      <div class="card-idx">[${idx}]</div>
      <div class="card-roll">${student.roll_no}</div>
      <div class="card-name-initials" title="${student.name}">${student.name.split(' ')[0]}</div>
    `;
    bCard.addEventListener('click', () => {
      document.getElementById('target-roll-input').value = student.roll_no;
      showStudentResultCard(student);
    });
    binaryContainer.appendChild(bCard);
  });

  resetVisualStateUI();
}

function resetVisualStateUI() {
  // Clear running timers
  if (state.simulationTimer) {
    clearInterval(state.simulationTimer);
    state.simulationTimer = null;
  }
  state.isPaused = false;
  state.linearStepIdx = 0;
  state.binaryStepIdx = 0;

  // Reset Buttons
  document.getElementById('start-simulation-btn').disabled = false;
  document.getElementById('step-simulation-btn').disabled = false;
  document.getElementById('pause-simulation-btn').disabled = true;
  document.getElementById('pause-simulation-btn').innerHTML = '<span class="btn-icon">⏸</span> Pause';

  // Reset Winner Banner
  document.getElementById('winner-banner').classList.add('hidden');

  // Reset Linear Arena UI
  document.getElementById('linear-comparisons-count').textContent = '0';
  document.getElementById('linear-current-index').textContent = '-';
  document.getElementById('linear-inspected-val').textContent = '-';
  document.getElementById('linear-time-hud').textContent = '0.00 µs';
  document.getElementById('linear-status-badge').textContent = 'Ready to Scan';
  document.getElementById('linear-status-badge').style.color = '';
  document.getElementById('linear-log-message').innerHTML = 'Click <strong>Run Simultaneous Search</strong> or <strong>Step</strong> to inspect elements left to right.';

  // Reset Binary Arena UI
  const maxIdx = state.visualSubset.length - 1;
  document.getElementById('binary-comparisons-count').textContent = '0';
  document.getElementById('binary-range-hud').textContent = `[0 .. ${maxIdx}]`;
  document.getElementById('binary-mid-val').textContent = '-';
  document.getElementById('binary-time-hud').textContent = '0.00 µs';
  document.getElementById('binary-status-badge').textContent = 'Ready to Halve';
  document.getElementById('binary-status-badge').style.color = '';
  document.getElementById('binary-log-message').innerHTML = 'Binary Search evaluates the middle item and cuts remaining search space by <strong>50%</strong> each step.';

  // Reset all card classes
  const cards = document.querySelectorAll('.student-card');
  cards.forEach(c => {
    c.className = 'student-card';
  });
}

function prepareSimulationTraces() {
  const inputVal = document.getElementById('target-roll-input').value.trim();
  if (!inputVal) {
    alert('Please enter or select a target roll number.');
    return false;
  }
  state.targetRoll = parseInt(inputVal, 10);
  state.linearTrace = generateLinearSearchTrace(state.visualSubset, state.targetRoll);
  state.binaryTrace = generateBinarySearchTrace(state.visualSubset, state.targetRoll);
  state.linearStepIdx = 0;
  state.binaryStepIdx = 0;
  return true;
}

function executeSingleStep() {
  const linearDone = state.linearStepIdx >= state.linearTrace.length;
  const binaryDone = state.binaryStepIdx >= state.binaryTrace.length;

  if (linearDone && binaryDone) {
    finishSimulation();
    return;
  }

  // Step Linear Search
  if (!linearDone) {
    const step = state.linearTrace[state.linearStepIdx];
    applyLinearStep(step);
    state.linearStepIdx++;
  }

  // Step Binary Search
  if (!binaryDone) {
    const step = state.binaryTrace[state.binaryStepIdx];
    applyBinaryStep(step);
    state.binaryStepIdx++;
  }

  // Subtle audio click for algorithm pulse
  playTone(480, 'sine', 0.04, 0.04);

  // Check if both finished on this step
  if (state.linearStepIdx >= state.linearTrace.length && state.binaryStepIdx >= state.binaryTrace.length) {
    finishSimulation();
  }
}

function applyLinearStep(step) {
  const hudComp = document.getElementById('linear-comparisons-count');
  const hudIdx = document.getElementById('linear-current-index');
  const hudVal = document.getElementById('linear-inspected-val');
  const hudTime = document.getElementById('linear-time-hud');
  const badge = document.getElementById('linear-status-badge');
  const log = document.getElementById('linear-log-message');

  hudComp.textContent = step.comparisons.toString();
  // Simulated hardware latency ~ 0.08µs per loop iteration
  hudTime.textContent = (step.comparisons * 0.082).toFixed(2) + ' µs';

  if (step.type === 'check') {
    badge.textContent = `Scanning [${step.index}]`;
    hudIdx.textContent = step.index.toString();
    hudVal.textContent = step.roll.toString();
    log.textContent = step.message;

    // Discard previous card
    if (step.index > 0) {
      const prev = document.getElementById(`l-card-${step.index - 1}`);
      if (prev) {
        prev.classList.remove('checking-linear');
        prev.classList.add('discarded-linear');
      }
    }
    const current = document.getElementById(`l-card-${step.index}`);
    if (current) current.classList.add('checking-linear');

  } else if (step.type === 'found') {
    badge.textContent = 'MATCH FOUND! 🎉';
    badge.style.color = '#34d399';
    hudIdx.textContent = step.index.toString();
    hudVal.textContent = step.roll.toString();
    log.innerHTML = `<span style="color:#34d399; font-weight:700;">${step.message}</span>`;

    const targetCard = document.getElementById(`l-card-${step.index}`);
    if (targetCard) {
      targetCard.classList.remove('checking-linear');
      targetCard.classList.add('found-match');
    }
  } else if (step.type === 'not_found') {
    badge.textContent = 'NOT FOUND ✕';
    badge.style.color = '#fda4af';
    log.innerHTML = `<span style="color:#fda4af;">${step.message}</span>`;
    // Dim out the last item checked
    const last = document.getElementById(`l-card-${state.visualSubset.length - 1}`);
    if (last) {
      last.classList.remove('checking-linear');
      last.classList.add('discarded-linear');
    }
  }
}

function applyBinaryStep(step) {
  const hudComp = document.getElementById('binary-comparisons-count');
  const hudRange = document.getElementById('binary-range-hud');
  const hudMid = document.getElementById('binary-mid-val');
  const hudTime = document.getElementById('binary-time-hud');
  const badge = document.getElementById('binary-status-badge');
  const log = document.getElementById('binary-log-message');

  hudComp.textContent = step.comparisons.toString();
  // Simulated hardware latency ~ 0.06µs per divide step
  hudTime.textContent = (step.comparisons * 0.065).toFixed(2) + ' µs';

  // Clear previous mid/low/high pointer classes
  const cards = document.querySelectorAll('#binary-cards-container .student-card');
  cards.forEach(c => c.classList.remove('pointer-low', 'pointer-high', 'pointer-mid'));

  if (step.type === 'inspect_range') {
    badge.textContent = `Step ${step.step}: Halving Window`;
    hudRange.textContent = `[${step.low} .. ${step.high}]`;
    hudMid.textContent = step.midVal.toString();
    log.textContent = step.message;

    // Apply pointers
    const lowCard = document.getElementById(`b-card-${step.low}`);
    const highCard = document.getElementById(`b-card-${step.high}`);
    const midCard = document.getElementById(`b-card-${step.mid}`);

    if (lowCard) lowCard.classList.add('pointer-low');
    if (highCard) highCard.classList.add('pointer-high');
    if (midCard) midCard.classList.add('pointer-mid');

  } else if (step.type === 'discard_left') {
    log.textContent = step.message;
    // Shade out indices discardStart .. discardEnd
    for (let i = step.discardStart; i <= step.discardEnd; i++) {
      const card = document.getElementById(`b-card-${i}`);
      if (card) card.classList.add('discarded-binary');
    }
  } else if (step.type === 'discard_right') {
    log.textContent = step.message;
    // Shade out indices discardStart .. discardEnd
    for (let i = step.discardStart; i <= step.discardEnd; i++) {
      const card = document.getElementById(`b-card-${i}`);
      if (card) card.classList.add('discarded-binary');
    }
  } else if (step.type === 'found') {
    badge.textContent = 'MATCH FOUND! 🎯';
    badge.style.color = '#34d399';
    hudMid.textContent = step.midVal.toString();
    log.innerHTML = `<span style="color:#34d399; font-weight:700;">${step.message}</span>`;

    const midCard = document.getElementById(`b-card-${step.mid}`);
    if (midCard) {
      midCard.classList.add('found-match');
    }
  } else if (step.type === 'not_found') {
    badge.textContent = 'NOT FOUND ✕';
    badge.style.color = '#fda4af';
    hudRange.textContent = 'Empty';
    log.innerHTML = `<span style="color:#fda4af;">${step.message}</span>`;
  }
}

function finishSimulation() {
  if (state.simulationTimer) {
    clearInterval(state.simulationTimer);
    state.simulationTimer = null;
  }
  document.getElementById('start-simulation-btn').disabled = false;
  document.getElementById('step-simulation-btn').disabled = true;
  document.getElementById('pause-simulation-btn').disabled = true;

  // Retrieve final comparisons
  const linearFinal = state.linearTrace[state.linearTrace.length - 1];
  const binaryFinal = state.binaryTrace[state.binaryTrace.length - 1];
  const lCmp = linearFinal ? linearFinal.comparisons : 0;
  const bCmp = binaryFinal ? binaryFinal.comparisons : 0;

  const foundStudent = state.visualSubset.find(s => s.roll_no === state.targetRoll);
  state.activeFoundStudent = foundStudent || null;

  // Sound announcement
  if (foundStudent) {
    playSuccessChime();
  } else {
    playNotFoundTone();
  }

  // Display Winner Banner
  const banner = document.getElementById('winner-banner');
  const title = document.getElementById('winner-title');
  const subtitle = document.getElementById('winner-subtitle');
  banner.classList.remove('hidden');

  if (bCmp < lCmp) {
    const ratio = (lCmp / Math.max(1, bCmp)).toFixed(1);
    title.innerHTML = '🏆 Binary Search is the Resounding Winner!';
    subtitle.innerHTML = `Binary Search required only <strong>${bCmp} comparisons</strong> vs <strong>${lCmp} comparisons</strong> in Linear Search. That represents a <strong>${ratio}x algorithmic efficiency advantage</strong>!`;
  } else if (lCmp < bCmp) {
    title.innerHTML = '⚡ Linear Search Finished Faster!';
    subtitle.innerHTML = `Linear Search found the target in only <strong>${lCmp} comparison</strong> because the roll number happened to be at the very first index (Index 0 - Best Case O(1))!`;
  } else {
    title.innerHTML = '🤝 Comparison Counts are Tied!';
    subtitle.innerHTML = `Both algorithms required <strong>${bCmp} comparisons</strong> for this specific index alignment.`;
  }

  if (foundStudent) {
    showStudentResultCard(foundStudent);
  }
}

function startSimultaneousSearch() {
  if (state.linearStepIdx === 0 && state.binaryStepIdx === 0) {
    resetVisualStateUI();
    if (!prepareSimulationTraces()) return;
  }

  document.getElementById('start-simulation-btn').disabled = true;
  document.getElementById('step-simulation-btn').disabled = true;
  document.getElementById('pause-simulation-btn').disabled = false;
  state.isPaused = false;

  state.simulationTimer = setInterval(() => {
    executeSingleStep();
  }, state.stepSpeedMs);
}

function pauseSimulation() {
  const pauseBtn = document.getElementById('pause-simulation-btn');
  if (!state.isPaused) {
    clearInterval(state.simulationTimer);
    state.simulationTimer = null;
    state.isPaused = true;
    pauseBtn.innerHTML = '<span class="btn-icon">▶</span> Resume';
    document.getElementById('step-simulation-btn').disabled = false;
  } else {
    state.isPaused = false;
    pauseBtn.innerHTML = '<span class="btn-icon">⏸</span> Pause';
    document.getElementById('step-simulation-btn').disabled = true;
    state.simulationTimer = setInterval(() => {
      executeSingleStep();
    }, state.stepSpeedMs);
  }
}

// ==========================================================================
// Student Result Card Renderer
// ==========================================================================
function renderResultCardHTML(student) {
  const passClass = student.status === 'Pass' ? 'status-badge-pass' : 'status-badge-fail';
  const tableRows = SUBJECTS.map((sub, idx) => {
    const mark = student.marks[idx];
    const subStatus = mark >= 35 ? 'PASS' : 'FAIL';
    const subStatusColor = mark >= 35 ? '#059669' : '#dc2626';
    return `
      <tr>
        <td><strong>${sub}</strong></td>
        <td>100</td>
        <td><strong>${mark}</strong></td>
        <td>${((mark / 100) * 100).toFixed(0)}%</td>
        <td style="color: ${subStatusColor}; font-weight: 700;">${subStatus}</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="cert-header">
      <div class="cert-inst">DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING • ANNUAL EVALUATION</div>
      <h2 class="cert-title">STUDENT RESULT CERTIFICATE</h2>
      <div class="cert-subtitle">Academic Year 2025–2026 | Bachelor of Technology (Semester IV)</div>
    </div>

    <div class="cert-student-meta">
      <div class="meta-row">
        <span class="meta-label">Roll Number:</span>
        <span class="meta-val">${student.roll_no}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">Candidate Name:</span>
        <span class="meta-val">${student.name}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">Program:</span>
        <span class="meta-val">B.Tech Computer Engineering</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">Verification ID:</span>
        <span class="meta-val">NIT-CSE-${student.roll_no}-2026</span>
      </div>
    </div>

    <table class="cert-table">
      <thead>
        <tr>
          <th>Subject Course</th>
          <th>Max Marks</th>
          <th>Marks Scored</th>
          <th>Percentage</th>
          <th>Result</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>

    <div class="cert-summary-grid">
      <div class="cert-sum-item">
        <span class="cert-sum-label">Total Aggregate</span>
        <span class="cert-sum-val">${student.total} / 500</span>
      </div>
      <div class="cert-sum-item">
        <span class="cert-sum-label">Percentage</span>
        <span class="cert-sum-val">${student.percentage.toFixed(2)}%</span>
      </div>
      <div class="cert-sum-item">
        <span class="cert-sum-label">Final Letter Grade</span>
        <span class="cert-sum-val">${student.grade}</span>
      </div>
      <div class="cert-sum-item">
        <span class="cert-sum-label">Promotion Status</span>
        <span class="cert-sum-val ${passClass}">${student.status.toUpperCase()}</span>
      </div>
    </div>
  `;
}

function showStudentResultCard(student) {
  const section = document.getElementById('result-card-section');
  const body = document.getElementById('student-result-card-body');
  body.innerHTML = renderResultCardHTML(student);
  section.classList.remove('hidden');
  section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function openResultCardModal(student) {
  const modal = document.getElementById('result-modal');
  const content = document.getElementById('modal-card-content');
  content.innerHTML = renderResultCardHTML(student);
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function closeResultCardModal() {
  const modal = document.getElementById('result-modal');
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

// ==========================================================================
// Performance Benchmark Suite & Chart.js Visuals
// ==========================================================================
function initCharts() {
  const comparisonsCtx = document.getElementById('comparisonsChart').getContext('2d');
  const timeCtx = document.getElementById('timeChart').getContext('2d');

  const chartDefaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#cbd5e1',
          font: { family: 'Plus Jakarta Sans', size: 12, weight: '600' }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleColor: '#f8fafc',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
        padding: 10,
        boxPadding: 4
      }
    },
    scales: {
      x: {
        type: 'logarithmic',
        title: {
          display: true,
          text: 'Number of Student Records (N)',
          color: '#94a3b8',
          font: { weight: '600' }
        },
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: {
          color: '#94a3b8',
          callback: val => Number(val).toLocaleString()
        }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8' }
      }
    }
  };

  // Chart 1: Comparisons vs Size
  state.comparisonsChart = new Chart(comparisonsCtx, {
    type: 'line',
    data: {
      labels: [100, 1000, 10000, 100000],
      datasets: [
        {
          label: 'Linear Search O(n)',
          data: [50.8, 501.2, 5003.5, 50012.0],
          borderColor: '#f43f5e',
          backgroundColor: 'rgba(244, 63, 94, 0.15)',
          borderWidth: 2.5,
          pointRadius: 5,
          pointHoverRadius: 7,
          tension: 0.2
        },
        {
          label: 'Binary Search O(log n)',
          data: [5.7, 8.9, 12.3, 15.6],
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6, 182, 212, 0.15)',
          borderWidth: 2.5,
          pointRadius: 5,
          pointHoverRadius: 7,
          tension: 0.2
        }
      ]
    },
    options: {
      ...chartDefaultOptions,
      scales: {
        ...chartDefaultOptions.scales,
        y: {
          ...chartDefaultOptions.scales.y,
          title: {
            display: true,
            text: 'Average Comparisons',
            color: '#94a3b8',
            font: { weight: '600' }
          }
        }
      }
    }
  });

  // Chart 2: Time vs Size (Log-Log)
  state.timeChart = new Chart(timeCtx, {
    type: 'line',
    data: {
      labels: [100, 1000, 10000, 100000],
      datasets: [
        {
          label: 'Linear Search O(n)',
          data: [4.85, 38.60, 395.20, 3910.40],
          borderColor: '#f43f5e',
          backgroundColor: 'rgba(244, 63, 94, 0.15)',
          borderWidth: 2.5,
          pointRadius: 5,
          tension: 0.2
        },
        {
          label: 'Binary Search O(log n)',
          data: [1.12, 1.65, 2.15, 2.78],
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          borderWidth: 2.5,
          pointRadius: 5,
          tension: 0.2
        }
      ]
    },
    options: {
      ...chartDefaultOptions,
      scales: {
        ...chartDefaultOptions.scales,
        y: {
          type: 'logarithmic',
          title: {
            display: true,
            text: 'Average Latency (µs)',
            color: '#94a3b8',
            font: { weight: '600' }
          },
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8' }
        }
      }
    }
  });

  renderBenchmarkTable(state.benchmarkResults);
}

function renderBenchmarkTable(rows) {
  const tbody = document.getElementById('benchmark-table-body');
  tbody.innerHTML = '';

  rows.forEach(r => {
    const reduction = (((r.linearCmp - r.binaryCmp) / r.linearCmp) * 100).toFixed(1);
    const speedup = (r.linearUs / Math.max(0.01, r.binaryUs)).toFixed(1);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${r.size.toLocaleString()}</strong></td>
      <td>${r.count.toLocaleString()}</td>
      <td class="text-linear">${r.linearCmp.toFixed(1)}</td>
      <td class="text-binary">${r.binaryCmp.toFixed(1)}</td>
      <td><span class="badge badge-emerald">-${reduction}%</span></td>
      <td>${r.linearUs.toFixed(2)} µs</td>
      <td class="text-emerald">${r.binaryUs.toFixed(2)} µs</td>
      <td><span class="badge badge-yellow">${speedup}x</span></td>
    `;
    tbody.appendChild(tr);
  });
}

async function runLiveBenchmarkSuite() {
  const btn = document.getElementById('run-benchmark-btn');
  const progWrap = document.getElementById('benchmark-progress-bar-wrap');
  const progFill = document.getElementById('benchmark-progress-fill');
  const progText = document.getElementById('benchmark-progress-text');
  const progPct = document.getElementById('benchmark-progress-pct');

  btn.disabled = true;
  progWrap.classList.remove('hidden');

  const sizes = [100, 1000, 10000, 100000];
  const newResults = [];

  for (let i = 0; i < sizes.length; i++) {
    const size = sizes[i];
    const pct = Math.round(((i) / sizes.length) * 100);
    progFill.style.width = `${pct}%`;
    progPct.textContent = `${pct}%`;
    progText.textContent = `Benchmarking ${size.toLocaleString()} records across 1,004 search cases...`;

    // Yield control to UI thread
    await new Promise(r => setTimeout(r, 40));

    const dataset = generateStudents(size, size + 100);
    const first = dataset[0].roll_no;
    const mid = dataset[Math.floor(size / 2)].roll_no;
    const last = dataset[size - 1].roll_no;
    const targets = [first, mid, last, last + 99999];

    // Add 1,000 random query targets
    const rng = createRng(999);
    for (let k = 0; k < 1000; k++) {
      targets.push(FIRST_ROLL + Math.floor(rng() * size));
    }

    let linearCmpTotal = 0;
    let binaryCmpTotal = 0;
    let linearTimeTotal = 0;
    let binaryTimeTotal = 0;

    for (const key of targets) {
      // Linear Search
      const t0 = performance.now();
      let lCount = 0;
      for (let j = 0; j < dataset.length; j++) {
        lCount++;
        if (dataset[j].roll_no === key) break;
      }
      const t1 = performance.now();
      linearCmpTotal += lCount;
      linearTimeTotal += (t1 - t0) * 1000; // in µs

      // Binary Search
      const t2 = performance.now();
      let bCount = 0;
      let low = 0;
      let high = dataset.length - 1;
      while (low <= high) {
        bCount++;
        const m = Math.floor((low + high) / 2);
        if (dataset[m].roll_no === key) break;
        if (dataset[m].roll_no < key) low = m + 1;
        else high = m - 1;
      }
      const t3 = performance.now();
      binaryCmpTotal += bCount;
      binaryTimeTotal += (t3 - t2) * 1000; // in µs
    }

    const count = targets.length;
    newResults.push({
      size,
      count,
      linearCmp: linearCmpTotal / count,
      binaryCmp: binaryCmpTotal / count,
      linearUs: Math.max(0.2, linearTimeTotal / count),
      binaryUs: Math.max(0.1, binaryTimeTotal / count)
    });
  }

  progFill.style.width = '100%';
  progPct.textContent = '100%';
  progText.textContent = 'Benchmark Suite Completed Successfully!';
  state.benchmarkResults = newResults;

  // Update Charts
  state.comparisonsChart.data.datasets[0].data = newResults.map(r => r.linearCmp);
  state.comparisonsChart.data.datasets[1].data = newResults.map(r => r.binaryCmp);
  state.comparisonsChart.update();

  state.timeChart.data.datasets[0].data = newResults.map(r => r.linearUs);
  state.timeChart.data.datasets[1].data = newResults.map(r => r.binaryUs);
  state.timeChart.update();

  renderBenchmarkTable(newResults);
  playSuccessChime();

  setTimeout(() => {
    btn.disabled = false;
    progWrap.classList.add('hidden');
  }, 1200);
}

// ==========================================================================
// Student Directory & CSV Operations
// ==========================================================================
function getFilteredStudents() {
  const term = state.dirSearchTerm.toLowerCase();
  return state.students.filter(student => {
    const matchesTerm = !term ||
      student.roll_no.toString().includes(term) ||
      student.name.toLowerCase().includes(term);

    const matchesGrade = state.dirGradeFilter === 'ALL' || student.grade === state.dirGradeFilter;
    const matchesStatus = state.dirStatusFilter === 'ALL' || student.status === state.dirStatusFilter;

    return matchesTerm && matchesGrade && matchesStatus;
  });
}

function renderDirectoryTable() {
  const filtered = getFilteredStudents();
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / state.dirPageSize));

  if (state.dirCurrentPage > totalPages) state.dirCurrentPage = totalPages;

  const startIndex = (state.dirCurrentPage - 1) * state.dirPageSize;
  const pageItems = filtered.slice(startIndex, startIndex + state.dirPageSize);

  document.getElementById('dir-showing-count').textContent = pageItems.length.toString();
  document.getElementById('dir-total-count').textContent = total.toLocaleString();
  document.getElementById('page-indicator').textContent = `Page ${state.dirCurrentPage} / ${totalPages}`;
  document.getElementById('prev-page-btn').disabled = state.dirCurrentPage <= 1;
  document.getElementById('next-page-btn').disabled = state.dirCurrentPage >= totalPages;

  const tbody = document.getElementById('directory-table-body');
  tbody.innerHTML = '';

  if (pageItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" style="text-align:center; padding: 2rem; color: #94a3b8;">No matching student records found.</td></tr>`;
    return;
  }

  pageItems.forEach(student => {
    const tr = document.createElement('tr');
    const statusBadge = student.status === 'Pass'
      ? '<span class="badge badge-green">Pass</span>'
      : '<span class="badge badge-red">Fail</span>';

    tr.innerHTML = `
      <td><strong>${student.roll_no}</strong></td>
      <td>${student.name}</td>
      <td>${student.marks[0]}</td>
      <td>${student.marks[1]}</td>
      <td>${student.marks[2]}</td>
      <td>${student.marks[3]}</td>
      <td>${student.marks[4]}</td>
      <td><strong>${student.total}</strong></td>
      <td>${student.percentage.toFixed(2)}%</td>
      <td><span class="badge badge-blue">${student.grade}</span></td>
      <td>${statusBadge}</td>
      <td><button class="btn btn-secondary btn-sm dir-view-btn" data-roll="${student.roll_no}">View Card</button></td>
    `;
    tbody.appendChild(tr);
  });

  // Attach view card click events
  tbody.querySelectorAll('.dir-view-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const roll = parseInt(e.currentTarget.getAttribute('data-roll'), 10);
      const student = state.students.find(s => s.roll_no === roll);
      if (student) openResultCardModal(student);
    });
  });
}

function exportStudentsToCSV() {
  let csv = ['roll_no,name,' + SUBJECTS.join(',') + ',total,percentage,grade,status'];
  state.students.forEach(s => {
    csv.push(`${s.roll_no},"${s.name}",${s.marks.join(',')},${s.total},${s.percentage},${s.grade},${s.status}`);
  });
  const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `students_${state.students.length}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importStudentsFromCSV(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const text = e.target.result;
      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length < 2) throw new Error('CSV file is empty or missing headers.');

      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const required = ['roll_no', 'name', ...SUBJECTS];
      const hasAll = required.every(r => headers.includes(r));
      if (!hasAll) throw new Error(`CSV must contain headers: ${required.join(', ')}`);

      const loaded = [];
      for (let i = 1; i < lines.length; i++) {
        // Quick CSV line parser handling quotes
        const match = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        const parts = lines[i].split(',').map(p => p.trim().replace(/^"|"$/g, ''));
        if (parts.length < headers.length) continue;

        const rowObj = {};
        headers.forEach((h, idx) => {
          rowObj[h] = parts[idx];
        });

        const roll = parseInt(rowObj.roll_no, 10);
        const marks = SUBJECTS.map(s => parseInt(rowObj[s], 10));
        if (isNaN(roll) || marks.some(isNaN)) continue;

        const total = marks.reduce((a, b) => a + b, 0);
        const percentage = Number((total / SUBJECTS.length).toFixed(2));
        const status = marks.every(m => m >= 35) ? 'Pass' : 'Fail';

        loaded.push({
          roll_no: roll,
          name: rowObj.name,
          marks,
          total,
          percentage,
          grade: gradeFor(percentage),
          status
        });
      }

      if (loaded.length === 0) throw new Error('No valid student rows could be parsed.');

      // Sort by roll number ascending (required for Binary Search)
      loaded.sort((a, b) => a.roll_no - b.roll_no);
      state.students = loaded;

      document.getElementById('header-records-count').textContent = `${state.students.length.toLocaleString()} Students`;
      updateVisualSubset();
      renderDirectoryTable();
      alert(`Successfully loaded and sorted ${state.students.length.toLocaleString()} student records from CSV!`);
    } catch (err) {
      alert(`CSV Import Failed: ${err.message}`);
    }
  };
  reader.readAsText(file);
}

// ==========================================================================
// Interactive Complexity Calculator
// ==========================================================================
function updateTheoreticalCalculator() {
  const input = document.getElementById('calc-n-input');
  let n = parseInt(input.value, 10);
  if (isNaN(n) || n <= 0) n = 1;

  const linearWorst = n;
  const binaryWorst = Math.ceil(Math.log2(n + 1));
  const ratio = (linearWorst / Math.max(1, binaryWorst)).toFixed(0);

  document.getElementById('calc-linear-res').textContent = linearWorst.toLocaleString() + ' Steps';
  document.getElementById('calc-binary-res').textContent = binaryWorst.toLocaleString() + ' Steps';
  document.getElementById('calc-ratio-res').textContent = Number(ratio).toLocaleString() + 'x Faster';
}

// ==========================================================================
// Event Listeners & Initialization
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Dataset
  state.students = generateStudents(1000);
  document.getElementById('header-records-count').textContent = `${state.students.length.toLocaleString()} Students`;
  updateVisualSubset();

  // 2. Tab Navigation
  const tabButtons = document.querySelectorAll('.nav-tab');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('.tab-content').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const targetId = `tab-${btn.getAttribute('data-tab')}`;
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) targetPanel.classList.add('active');

      // Resize charts if switching to benchmark tab
      if (btn.getAttribute('data-tab') === 'benchmark') {
        if (!state.comparisonsChart) {
          initCharts();
        } else {
          state.comparisonsChart.resize();
          state.timeChart.resize();
        }
      }
    });
  });

  // 3. Sound Effects Toggle
  const soundBtn = document.getElementById('sound-toggle-btn');
  soundBtn.addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    document.getElementById('sound-icon').textContent = state.soundEnabled ? '🔊' : '🔇';
    document.getElementById('sound-status').textContent = state.soundEnabled ? 'Sound ON' : 'Sound OFF';
    if (state.soundEnabled) playTone(600, 'sine', 0.08);
  });

  // 4. Quick Presets for Target Roll Number
  document.querySelectorAll('.preset-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const type = pill.getAttribute('data-preset');
      const subset = state.visualSubset;
      let target = FIRST_ROLL;

      if (type === 'first') target = subset[0].roll_no;
      else if (type === 'mid') target = subset[Math.floor(subset.length / 2)].roll_no;
      else if (type === 'last') target = subset[subset.length - 1].roll_no;
      else if (type === 'missing') target = 9999;
      else if (type === 'random') {
        const randIdx = Math.floor(Math.random() * subset.length);
        target = subset[randIdx].roll_no;
      }

      document.getElementById('target-roll-input').value = target;
      resetVisualStateUI();
    });
  });

  // Default preset to mid target
  if (state.visualSubset.length > 0) {
    document.getElementById('target-roll-input').value = state.visualSubset[Math.floor(state.visualSubset.length / 2)].roll_no;
  }

  // 5. Visualizer Controls
  document.getElementById('visual-size-select').addEventListener('change', () => {
    updateVisualSubset();
    resetVisualStateUI();
  });

  const speedSlider = document.getElementById('speed-slider');
  speedSlider.addEventListener('input', (e) => {
    state.stepSpeedMs = parseInt(e.target.value, 10);
    document.getElementById('speed-label').textContent = `${state.stepSpeedMs}ms`;
    if (state.simulationTimer && !state.isPaused) {
      clearInterval(state.simulationTimer);
      state.simulationTimer = setInterval(executeSingleStep, state.stepSpeedMs);
    }
  });

  document.getElementById('start-simulation-btn').addEventListener('click', startSimultaneousSearch);
  document.getElementById('step-simulation-btn').addEventListener('click', () => {
    if (state.linearStepIdx === 0 && state.binaryStepIdx === 0) {
      if (!prepareSimulationTraces()) return;
    }
    executeSingleStep();
  });
  document.getElementById('pause-simulation-btn').addEventListener('click', pauseSimulation);
  document.getElementById('reset-simulation-btn').addEventListener('click', resetVisualStateUI);

  // Instant Search Button
  document.getElementById('search-instant-btn').addEventListener('click', () => {
    resetVisualStateUI();
    if (!prepareSimulationTraces()) return;
    while (state.linearStepIdx < state.linearTrace.length || state.binaryStepIdx < state.binaryTrace.length) {
      if (state.linearStepIdx < state.linearTrace.length) {
        applyLinearStep(state.linearTrace[state.linearStepIdx]);
        state.linearStepIdx++;
      }
      if (state.binaryStepIdx < state.binaryTrace.length) {
        applyBinaryStep(state.binaryTrace[state.binaryStepIdx]);
        state.binaryStepIdx++;
      }
    }
    finishSimulation();
  });

  // Winner Banner Actions
  document.getElementById('view-card-from-banner-btn').addEventListener('click', () => {
    if (state.activeFoundStudent) {
      showStudentResultCard(state.activeFoundStudent);
    }
  });

  // Result Card Header Actions
  document.getElementById('print-result-card-btn').addEventListener('click', () => window.print());
  document.getElementById('close-result-card-btn').addEventListener('click', () => {
    document.getElementById('result-card-section').classList.add('hidden');
  });

  // 6. Benchmark Suite Controls
  document.getElementById('run-benchmark-btn').addEventListener('click', runLiveBenchmarkSuite);
  document.getElementById('load-reference-benchmark-btn').addEventListener('click', () => {
    state.benchmarkResults = [...REFERENCE_BENCHMARKS];
    if (state.comparisonsChart) {
      state.comparisonsChart.data.datasets[0].data = REFERENCE_BENCHMARKS.map(r => r.linearCmp);
      state.comparisonsChart.data.datasets[1].data = REFERENCE_BENCHMARKS.map(r => r.binaryCmp);
      state.comparisonsChart.update();

      state.timeChart.data.datasets[0].data = REFERENCE_BENCHMARKS.map(r => r.linearUs);
      state.timeChart.data.datasets[1].data = REFERENCE_BENCHMARKS.map(r => r.binaryUs);
      state.timeChart.update();
    }
    renderBenchmarkTable(REFERENCE_BENCHMARKS);
    playSuccessChime();
  });

  document.getElementById('export-benchmark-csv-btn').addEventListener('click', () => {
    let csv = ['size,queries,linear_cmp,binary_cmp,linear_us,binary_us,speedup'];
    state.benchmarkResults.forEach(r => {
      const speedup = (r.linearUs / Math.max(0.01, r.binaryUs)).toFixed(2);
      csv.push(`${r.size},${r.count},${r.linearCmp},${r.binaryCmp},${r.linearUs},${r.binaryUs},${speedup}`);
    });
    const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'search_benchmark_data.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // 7. Directory & CSV Controls
  document.getElementById('directory-search-input').addEventListener('input', (e) => {
    state.dirSearchTerm = e.target.value.trim();
    state.dirCurrentPage = 1;
    renderDirectoryTable();
  });

  document.getElementById('grade-filter-select').addEventListener('change', (e) => {
    state.dirGradeFilter = e.target.value;
    state.dirCurrentPage = 1;
    renderDirectoryTable();
  });

  document.getElementById('status-filter-select').addEventListener('change', (e) => {
    state.dirStatusFilter = e.target.value;
    state.dirCurrentPage = 1;
    renderDirectoryTable();
  });

  document.getElementById('prev-page-btn').addEventListener('click', () => {
    if (state.dirCurrentPage > 1) {
      state.dirCurrentPage--;
      renderDirectoryTable();
    }
  });

  document.getElementById('next-page-btn').addEventListener('click', () => {
    const totalPages = Math.ceil(getFilteredStudents().length / state.dirPageSize);
    if (state.dirCurrentPage < totalPages) {
      state.dirCurrentPage++;
      renderDirectoryTable();
    }
  });

  document.getElementById('generate-1k-btn').addEventListener('click', () => {
    state.students = generateStudents(1000, Date.now() % 10000);
    document.getElementById('header-records-count').textContent = '1,000 Students';
    updateVisualSubset();
    renderDirectoryTable();
    playSuccessChime();
  });

  document.getElementById('generate-10k-btn').addEventListener('click', () => {
    state.students = generateStudents(10000, Date.now() % 10000);
    document.getElementById('header-records-count').textContent = '10,000 Students';
    updateVisualSubset();
    renderDirectoryTable();
    playSuccessChime();
  });

  document.getElementById('export-csv-btn').addEventListener('click', exportStudentsToCSV);
  document.getElementById('csv-file-input').addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      importStudentsFromCSV(e.target.files[0]);
    }
  });

  // 8. Theory Calculator Controls
  document.getElementById('calc-n-input').addEventListener('input', updateTheoreticalCalculator);
  document.querySelectorAll('.calc-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const n = chip.getAttribute('data-n');
      document.getElementById('calc-n-input').value = n;
      updateTheoreticalCalculator();
    });
  });
  updateTheoreticalCalculator();

  // 9. Modal Controls
  document.getElementById('modal-close-btn').addEventListener('click', closeResultCardModal);
  document.getElementById('modal-dismiss-btn').addEventListener('click', closeResultCardModal);
  document.getElementById('modal-print-btn').addEventListener('click', () => window.print());
  document.getElementById('result-modal').addEventListener('click', (e) => {
    if (e.target.id === 'result-modal') closeResultCardModal();
  });

  // Initial table rendering
  renderDirectoryTable();
});
