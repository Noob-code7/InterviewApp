import { classifyInterruption, INTERRUPTION_INTENTS } from '../../frontend/src/utils/interviewConversationalPatterns.js';

console.log('========================================================================');
console.log('🧪 REPOSITORY TEST: PHASE 6 INTENT CLASSIFIER IMPORT TEST');
console.log('========================================================================\n');

const TEST_DATASET = [
  // REPEAT_REQUEST
  { text: "Can you repeat that?", expected: INTERRUPTION_INTENTS.REPEAT_REQUEST },
  { text: "Could you repeat the question please?", expected: INTERRUPTION_INTENTS.REPEAT_REQUEST },
  { text: "Say that again?", expected: INTERRUPTION_INTENTS.REPEAT_REQUEST },
  { text: "Pardon, what was the question?", expected: INTERRUPTION_INTENTS.REPEAT_REQUEST },
  { text: "Can you say that one more time?", expected: INTERRUPTION_INTENTS.REPEAT_REQUEST },

  // CLARIFICATION_REQUEST
  { text: "What do you mean by scalability?", expected: INTERRUPTION_INTENTS.CLARIFICATION_REQUEST },
  { text: "Can you clarify what you mean by ACID compliance?", expected: INTERRUPTION_INTENTS.CLARIFICATION_REQUEST },
  { text: "Are you asking about frontend performance or backend latency?", expected: INTERRUPTION_INTENTS.CLARIFICATION_REQUEST },
  { text: "Could you explain what you mean by partition key?", expected: INTERRUPTION_INTENTS.CLARIFICATION_REQUEST },
  { text: "Do you mean horizontal scaling or vertical scaling?", expected: INTERRUPTION_INTENTS.CLARIFICATION_REQUEST },

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

  // UNKNOWN
  { text: "Hmm", expected: INTERRUPTION_INTENTS.UNKNOWN },
  { text: "Ah", expected: INTERRUPTION_INTENTS.UNKNOWN },
  { text: "12345", expected: INTERRUPTION_INTENTS.UNKNOWN }
];

let passed = 0;
TEST_DATASET.forEach(({ text, expected }, idx) => {
  const predicted = classifyInterruption(text);
  const isMatch = predicted === expected;
  const numStr = String(idx + 1).padStart(2, '0');
  if (isMatch) {
    passed++;
    console.log(`   ✓ [${numStr}] "${text}" -> ${predicted}`);
  } else {
    console.error(`   ✗ [${numStr}] "${text}" -> Expected ${expected}, got ${predicted}`);
  }
});

const accuracy = (passed / TEST_DATASET.length) * 100;
console.log(`\n========================================================================`);
console.log(`Total: ${TEST_DATASET.length} | Passed: ${passed} | Accuracy: ${accuracy.toFixed(2)}%`);
console.log(`========================================================================`);

if (passed !== TEST_DATASET.length) {
  process.exit(1);
}
