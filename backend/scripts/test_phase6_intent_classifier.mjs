import { classifyInterruption, INTERRUPTION_INTENTS } from '../../frontend/src/utils/interviewConversationalPatterns.js';

console.log('========================================================================');
console.log('🧪 REPOSITORY TEST: PHASE 6 INTENT CLASSIFIER IMPORT TEST');
console.log('========================================================================\n');

const TEST_DATASET = [
  // ACKNOWLEDGEMENT
  { text: "Okay got it", expected: INTERRUPTION_INTENTS.ACKNOWLEDGEMENT },
  { text: "Understood", expected: INTERRUPTION_INTENTS.ACKNOWLEDGEMENT },
  { text: "Sure", expected: INTERRUPTION_INTENTS.ACKNOWLEDGEMENT },
  { text: "Alright", expected: INTERRUPTION_INTENTS.ACKNOWLEDGEMENT },
  { text: "Yeah sure", expected: INTERRUPTION_INTENTS.ACKNOWLEDGEMENT },

  // GENERAL_INTERRUPTION
  { text: "Wait a second", expected: INTERRUPTION_INTENTS.GENERAL_INTERRUPTION },
  { text: "Hold on a moment", expected: INTERRUPTION_INTENTS.GENERAL_INTERRUPTION },
  { text: "Give me a second to think", expected: INTERRUPTION_INTENTS.GENERAL_INTERRUPTION },

  // ANSWER
  { text: "We used Redis sorted sets for sliding window rate limiting", expected: INTERRUPTION_INTENTS.ANSWER },
  { text: "In our architecture we built asynchronous microservices using BullMQ", expected: INTERRUPTION_INTENTS.ANSWER },
  { text: "I implemented JWT token authentication with refresh tokens stored in HTTP-only cookies", expected: INTERRUPTION_INTENTS.ANSWER },
  { text: "The reason is that PostgreSQL handles relational consistency much better", expected: INTERRUPTION_INTENTS.ANSWER },

  // UNKNOWN / SHORT ACOUSTIC
  { text: "Hmm", expected: INTERRUPTION_INTENTS.UNKNOWN },
  { text: "Ah", expected: INTERRUPTION_INTENTS.UNKNOWN },
  { text: "12345", expected: INTERRUPTION_INTENTS.UNKNOWN },
];

let passed = 0;
TEST_DATASET.forEach((item, index) => {
  const result = classifyInterruption(item.text);
  const ok = result === item.expected;
  if (ok) {
    passed++;
    console.log(`   ✓ [${String(index + 1).padStart(2, '0')}] "${item.text}" -> ${result}`);
  } else {
    console.log(`   ✗ [${String(index + 1).padStart(2, '0')}] "${item.text}" -> Expected ${item.expected}, got ${result}`);
  }
});

console.log('\n========================================================================');
console.log(`Total: ${TEST_DATASET.length} | Passed: ${passed} | Accuracy: ${((passed / TEST_DATASET.length) * 100).toFixed(2)}%`);
console.log('========================================================================\n');

if (passed !== TEST_DATASET.length) {
  process.exit(1);
} else {
  console.log('✅ ALL INTENT CLASSIFICATION TESTS PASSED (100% ACCURACY)!\n');
  process.exit(0);
}
