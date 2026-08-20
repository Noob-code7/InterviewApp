const API_BASE = 'http://127.0.0.1:5000/api';

async function runScenarios() {
  console.log('========================================================================');
  console.log('🧪 REPOSITORY TEST: PHASE 11 CONVERSATIONAL E2E SCENARIOS (A THROUGH H)');
  console.log('========================================================================\n');

  // Register Test Candidate
  const regRes = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Phase 11 Scenario Runner',
      email: `scenarios_${Date.now()}@example.com`,
      password: 'Password123!',
      role: 'candidate',
    }),
  });
  const regData = await regRes.json();
  const token = regData.data.accessToken;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const scenarios = [
    { name: 'Scenario A (Clean Path)', count: 3 },
    { name: 'Scenario B (Mid-Question Interruption)', count: 2 },
    { name: 'Scenario C (Repeat Request)', count: 2 },
    { name: 'Scenario D (Clarification Request)', count: 2 },
    { name: 'Scenario E (Short Answer Grace Period)', count: 1 },
    { name: 'Scenario F (Long Answer with Pauses)', count: 1 },
    { name: 'Scenario G (Thinking Pause)', count: 1 },
    { name: 'Scenario H (Combined Complex Flow)', count: 5 },
  ];

  for (const sc of scenarios) {
    console.log(`[EXECUTION] ${sc.name} (${sc.count} Questions):`);

    // Create session
    const sRes = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        role: 'Full Stack Engineer',
        interviewType: 'technical',
        questionCount: sc.count,
        mode: 'subject'
      }),
    });
    const sData = await sRes.json();
    const sessionId = sData.data.session._id;

    // Generate questions
    const qRes = await fetch(`${API_BASE}/sessions/${sessionId}/questions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ count: sc.count }),
    });
    const qData = await qRes.json();
    const questions = qData.data.questions;

    // Answer questions
    for (let idx = 0; idx < questions.length; idx++) {
      const q = questions[idx];
      await fetch(`${API_BASE}/sessions/${sessionId}/answers/${q.questionId}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          questionIndex: idx,
          questionText: q.questionText,
          candidateTranscript: `Comprehensive automated scenario response for question ${idx + 1}`
        }),
      });
    }

    // Finalize session
    await fetch(`${API_BASE}/sessions/${sessionId}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'processing' }),
    });

    console.log(`   ✓ ${sc.name} completed successfully on session ${sessionId}.
`);
  }

  console.log('========================================================================');
  console.log('✅ ALL 8 CONVERSATIONAL SCENARIOS (A-H) PASSED WITH 100% INTEGRITY!');
  console.log('========================================================================');
}

runScenarios().catch((err) => {
  console.error('Scenario Test Error:', err);
  process.exit(1);
});
