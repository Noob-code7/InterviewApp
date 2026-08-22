import assert from "assert";
import { mergeTranscripts } from "../utils/transcriptHelper.js";

console.log("================================================================");
console.log("🧪 RUNNING TRANSCRIPT MERGE & DEDUPLICATION UNIT TESTS");
console.log("================================================================\n");

// Test 1: Exact User Prompt Scenario
const t1_prompt = "OS is an operating...";
const t2_prompt = "OS is also known as an operating system.";
const res_prompt = mergeTranscripts(t1_prompt, t2_prompt);
console.log("Test 1 (User Scenario):");
console.log(`  T1:       "${t1_prompt}"`);
console.log(`  T2:       "${t2_prompt}"`);
console.log(`  Merged:   "${res_prompt}"`);
assert.strictEqual(
  res_prompt,
  "OS is an operating... OS is also known as an operating system."
);
console.log("  ✓ Passed!\n");

// Test 2: Clean continuation without punctuation
const t1_clean = "OS is an operating";
const t2_clean = "system that manages computer hardware";
const res_clean = mergeTranscripts(t1_clean, t2_clean);
console.log("Test 2 (Clean continuation):");
console.log(`  T1:       "${t1_clean}"`);
console.log(`  T2:       "${t2_clean}"`);
console.log(`  Merged:   "${res_clean}"`);
assert.strictEqual(
  res_clean,
  "OS is an operating system that manages computer hardware"
);
console.log("  ✓ Passed!\n");

// Test 3: Overlapping word deduplication
const t1_overlap = "An operating system is software that manages computer hardware";
const t2_overlap = "manages computer hardware and memory resources.";
const res_overlap = mergeTranscripts(t1_overlap, t2_overlap);
console.log("Test 3 (Overlap deduplication):");
console.log(`  T1:       "${t1_overlap}"`);
console.log(`  T2:       "${t2_overlap}"`);
console.log(`  Merged:   "${res_overlap}"`);
assert.strictEqual(
  res_overlap,
  "An operating system is software that manages computer hardware and memory resources."
);
console.log("  ✓ Passed!\n");

// Test 4: Containment (T2 contains T1)
const t1_contain = "Operating system";
const t2_contain = "Operating system controls hardware components";
const res_contain = mergeTranscripts(t1_contain, t2_contain);
console.log("Test 4 (Containment):");
console.log(`  T1:       "${t1_contain}"`);
console.log(`  T2:       "${t2_contain}"`);
console.log(`  Merged:   "${res_contain}"`);
assert.strictEqual(
  res_contain,
  "Operating system controls hardware components"
);
console.log("  ✓ Passed!\n");

// Test 5: Empty inputs
assert.strictEqual(mergeTranscripts("", "Hello world"), "Hello world");
assert.strictEqual(mergeTranscripts("Hello world", ""), "Hello world");
assert.strictEqual(mergeTranscripts(null, "Hello world"), "Hello world");
assert.strictEqual(mergeTranscripts("Hello world", null), "Hello world");
console.log("Test 5 (Empty/Null inputs): ✓ Passed!\n");

// Test 6: Multi-part sequential continuation (3 parts)
let cumulative = "";
cumulative = mergeTranscripts(cumulative, "Operating system is");
cumulative = mergeTranscripts(cumulative, "a system software that manages hardware.");
cumulative = mergeTranscripts(cumulative, "It also provides common services for computer programs.");
console.log("Test 6 (3-Part Sequential Continuation):");
console.log(`  Final: "${cumulative}"`);
assert.strictEqual(
  cumulative,
  "Operating system is a system software that manages hardware. It also provides common services for computer programs."
);
console.log("  ✓ Passed!\n");

console.log("================================================================");
console.log("✅ ALL TRANSCRIPT MERGE UNIT TESTS PASSED!");
console.log("================================================================\n");
