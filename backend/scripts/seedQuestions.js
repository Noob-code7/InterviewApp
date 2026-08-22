import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import Question from '../models/Question.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../.env') })

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/interviewapp'

const SEED_QUESTIONS = [
  // ── Operating Systems ────────────────────────────────────────────────────────────
  {
    questionText: "What is deadlock, and what conditions are needed for it to occur?",
    track: "subject",
    difficulty: "medium",
    keywords: ["mutual exclusion", "hold and wait", "no preemption", "circular wait", "resource allocation"],
    expectedConcepts: [
      "Process blocked waiting for resource held by another process",
      "Mutual Exclusion condition",
      "Hold and Wait condition",
      "No Preemption condition",
      "Circular Wait condition"
    ],
    acceptablePatterns: ["Coffman conditions", "resource dependency cycle", "banker's algorithm prevention"],
    commonMisconceptions: ["Confusing starvation with deadlock", "Thinking deadlock only happens in multi-threaded programs"],
    referenceAnswer: "Deadlock occurs when processes are unable to proceed because each is waiting for a resource held by another. The four necessary Coffman conditions are Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait.",
    tags: ["os", "operating-systems", "technical"]
  },
  {
    questionText: "What is virtual memory and how does demand paging work?",
    track: "subject",
    difficulty: "medium",
    keywords: ["virtual memory", "demand paging", "page fault", "page table", "swap space", "mmu"],
    expectedConcepts: [
      "Separation of user logical memory from physical RAM",
      "Page table mapping virtual to physical addresses",
      "Page fault interrupt when page is missing from RAM",
      "Loading pages into RAM only when referenced (on demand)"
    ],
    acceptablePatterns: ["Lazy swapper", "MMU address translation", "Page replacement algorithms like LRU/FIFO"],
    commonMisconceptions: ["Thinking virtual memory increases physical RAM speed", "Confusing paging with segmentation"],
    referenceAnswer: "Virtual memory maps virtual addresses to physical memory using the MMU and page tables. Demand paging loads pages into physical RAM only when referenced by a running process, raising a page fault if the page is currently in secondary swap storage.",
    tags: ["os", "operating-systems", "technical"]
  },
  {
    questionText: "What is IPC? What are the different IPC mechanisms?",
    track: "subject",
    difficulty: "easy",
    keywords: ["inter process communication", "shared memory", "message queues", "pipes", "sockets", "semaphores"],
    expectedConcepts: [
      "Mechanisms enabling independent processes to exchange data and synchronize",
      "Anonymous and named pipes for unidirectional/bidirectional streams",
      "Shared memory segment for fastest direct data access",
      "Message queues for asynchronous structured message passing",
      "Sockets for network and inter-host communication",
      "Semaphores or mutexes for synchronization"
    ],
    acceptablePatterns: ["Direct vs indirect communication", "Kernel-mediated message passing vs direct memory mapping"],
    commonMisconceptions: ["Believing threads require IPC rather than direct shared memory", "Confusing sockets with only remote internet protocols"],
    referenceAnswer: "Inter-Process Communication (IPC) allows processes to communicate and synchronize actions. Common mechanisms include Anonymous/Named Pipes, Shared Memory, Message Queues, Semaphores, and Network Sockets.",
    tags: ["os", "operating-systems", "technical"]
  },
  {
    questionText: "What is context switching and why is it important?",
    track: "subject",
    difficulty: "medium",
    keywords: ["context switching", "process control block", "pcb", "cpu registers", "program counter", "overhead"],
    expectedConcepts: [
      "Saving current CPU state (registers, program counter, stack pointer) into process PCB",
      "Loading previously saved state of the next scheduled process",
      "Enables preemptive multitasking and time-sharing operating systems",
      "Pure computational overhead where CPU performs no useful process work"
    ],
    acceptablePatterns: ["State transition from running to ready/waiting", "Kernel mode switch and cache invalidation penalty"],
    commonMisconceptions: ["Assuming context switching executes candidate application code", "Thinking threads have the same context switch cost as processes"],
    referenceAnswer: "Context switching saves the execution state (CPU registers, program counter) of a running process into its Process Control Block (PCB) and restores the saved state of another process to achieve multitasking, at the expense of CPU switching overhead.",
    tags: ["os", "operating-systems", "technical"]
  },

  // ── Database Management Systems ──────────────────────────────────────────────────
  {
    questionText: "Explain ACID properties in database management.",
    track: "subject",
    difficulty: "medium",
    keywords: ["atomicity", "consistency", "isolation", "durability", "transactions", "wal", "locking"],
    expectedConcepts: [
      "Atomicity: All operations in transaction succeed or entire transaction rolls back",
      "Consistency: Transaction transitions database from one valid state to another valid state preserving constraints",
      "Isolation: Concurrent transactions execute independently without dirty reads or uncommitted interference",
      "Durability: Committed data changes persist across server crashes or power failures"
    ],
    acceptablePatterns: ["Write-Ahead Logging (WAL)", "Two-Phase Locking (2PL)", "Isolation levels like Read Committed, Repeatable Read, Serializable"],
    commonMisconceptions: ["Confusing consistency in ACID with eventual consistency in CAP theorem", "Thinking atomicity guarantees speed"],
    referenceAnswer: "ACID properties guarantee relational database transaction reliability: Atomicity ensures all-or-nothing completion; Consistency enforces schema and foreign key constraints; Isolation prevents concurrent transaction race conditions; Durability guarantees committed writes survive crashes via Write-Ahead Logs.",
    tags: ["dbms", "database", "technical"]
  },
  {
    questionText: "What is the difference between an inner join and an outer join?",
    track: "subject",
    difficulty: "easy",
    keywords: ["inner join", "outer join", "left join", "right join", "full join", "null values", "matching predicate"],
    expectedConcepts: [
      "Inner Join returns only rows where matching predicate succeeds in both tables",
      "Left Outer Join returns all rows from left table plus matched rows from right table with NULLs for unmatched",
      "Right Outer Join returns all rows from right table plus matched rows from left table",
      "Full Outer Join returns all records from both tables combined with NULL padding where matches fail"
    ],
    acceptablePatterns: ["Venn diagram explanation", "ON clause foreign key matching", "NULL handling"],
    commonMisconceptions: ["Believing cross join is an outer join", "Thinking inner join preserves unmatched records"],
    referenceAnswer: "An Inner Join returns only rows that satisfy the join condition in both tables. An Outer Join (Left, Right, Full) retains unmatched rows from one or both tables, filling missing matching columns with NULL values.",
    tags: ["dbms", "database", "technical"]
  },
  {
    questionText: "Why is normalization required in DBMS and what is BCNF?",
    track: "subject",
    difficulty: "hard",
    keywords: ["normalization", "redundancy", "insertion anomaly", "deletion anomaly", "update anomaly", "bcnf", "candidate key"],
    expectedConcepts: [
      "Purpose of normalization: Eliminate data redundancy and prevent insertion, deletion, and update anomalies",
      "Boyce-Codd Normal Form (BCNF) is a stricter variation of 3NF",
      "BCNF rule: For every non-trivial functional dependency X -> Y, determinant X must be a super key or candidate key"
    ],
    acceptablePatterns: ["Decomposition into 1NF, 2NF, 3NF, BCNF", "Lossless join decomposition and dependency preservation"],
    commonMisconceptions: ["Thinking 3NF and BCNF are identical", "Assuming over-normalizing always improves query speed (ignores join cost)"],
    referenceAnswer: "Normalization decomposes tables to minimize redundancy and prevent data modification anomalies. BCNF (Boyce-Codd Normal Form) requires that for every functional dependency X -> Y, X must be a candidate key, eliminating multi-attribute key overlap anomalies.",
    tags: ["dbms", "database", "technical"]
  },

  // ── Object-Oriented Programming ──────────────────────────────────────────────────
  {
    questionText: "What is encapsulation, and why is it useful?",
    track: "subject",
    difficulty: "easy",
    keywords: ["encapsulation", "data hiding", "access modifiers", "private fields", "getters setters", "abstraction"],
    expectedConcepts: [
      "Bundling of data (fields) and methods that operate on that data into a single class unit",
      "Restricting direct access to internal state using private/protected access modifiers",
      "Providing controlled public interfaces (getters/setters/methods) to validate state changes and preserve invariants"
    ],
    acceptablePatterns: ["Information hiding", "Protection against unintended external mutations", "Loose coupling and high cohesion"],
    commonMisconceptions: ["Confusing encapsulation with abstraction", "Thinking encapsulation is just writing boilerplate getters/setters"],
    referenceAnswer: "Encapsulation bundles object state and behavioral methods within a class while restricting direct external access to fields through private access modifiers, enforcing data integrity and modularity.",
    tags: ["oop", "programming", "technical"]
  },
  {
    questionText: "What is polymorphism and how does method overriding differ from overloading?",
    track: "subject",
    difficulty: "medium",
    keywords: ["polymorphism", "method overriding", "method overloading", "compile time", "runtime", "virtual methods", "dynamic dispatch"],
    expectedConcepts: [
      "Polymorphism allows objects of different classes to be treated through a common parent interface",
      "Method Overloading (Compile-time / Static): Same method name with different parameter types/counts in the same class",
      "Method Overriding (Runtime / Dynamic): Child class provides a specific implementation of a parent class method with identical signature"
    ],
    acceptablePatterns: ["Virtual method table (vtable)", "Dynamic dispatch", "Method signature matching"],
    commonMisconceptions: ["Assuming overriding happens at compile time", "Thinking return type alone can distinguish overloaded methods in Java/C++"],
    referenceAnswer: "Polymorphism enables multiple behaviors under a unified interface. Overloading is compile-time polymorphism where methods share names with differing parameter signatures; Overriding is runtime polymorphism where a subclass provides its own implementation of an inherited parent method.",
    tags: ["oop", "programming", "technical"]
  },

  // ── Data Structures & Algorithms ─────────────────────────────────────────────────
  {
    questionText: "What is the difference between BFS and DFS graph traversals?",
    track: "subject",
    difficulty: "medium",
    keywords: ["bfs", "dfs", "breadth first search", "depth first search", "queue", "stack", "recursion", "shortest path"],
    expectedConcepts: [
      "BFS visits vertices level-by-level using a Queue (FIFO) data structure",
      "DFS explores down each branch as deep as possible before backtracking using a Stack (LIFO) or recursion",
      "BFS guarantees the shortest path in unweighted graphs",
      "Time complexity for both is O(V + E) on adjacency lists"
    ],
    acceptablePatterns: ["Topological sort (DFS)", "Bipartite graph check (BFS/DFS)", "Connected components"],
    commonMisconceptions: ["Thinking BFS uses a stack", "Believing DFS finds shortest path in general graphs"],
    referenceAnswer: "BFS traverses vertices level-by-level using a Queue to find shortest paths in unweighted graphs. DFS explores deepest along each branch using recursion or a Stack before backtracking, useful for cycle detection and topological sorting.",
    tags: ["ds", "algorithms", "technical"]
  },
  {
    questionText: "What is the difference between TCP and UDP?",
    track: "subject",
    difficulty: "easy",
    keywords: ["tcp", "udp", "connection oriented", "connectionless", "three way handshake", "reliability", "flow control", "congestion control"],
    expectedConcepts: [
      "TCP is connection-oriented and establishes connection via 3-way handshake (SYN, SYN-ACK, ACK)",
      "TCP guarantees reliable, ordered packet delivery with acknowledgments, retransmissions, and flow/congestion control",
      "UDP is connectionless and sends datagrams with minimal overhead without delivery guarantees or ordering",
      "Use cases: TCP for web (HTTP/HTTPS), file transfer, database; UDP for video streaming, DNS, VoIP, gaming"
    ],
    acceptablePatterns: ["Header size comparison (TCP 20B vs UDP 8B)", "Windowing and checksums", "Latency vs reliability trade-off"],
    commonMisconceptions: ["Thinking UDP is always preferred over TCP for all internet communication", "Believing TCP packets cannot be lost"],
    referenceAnswer: "TCP is a reliable, connection-oriented transport protocol with guaranteed ordered delivery and congestion control. UDP is connectionless and lightweight, transmitting datagrams with minimal latency but without delivery or ordering guarantees.",
    tags: ["networking", "technical"]
  },

  // ── HR & Behavioral ──────────────────────────────────────────────────────────────
  {
    questionText: "Tell me about a time you worked with someone whose style was very different from yours.",
    track: "hr",
    difficulty: "medium",
    keywords: ["communication", "collaboration", "adaptability", "conflict resolution", "empathy", "alignment", "star method"],
    expectedConcepts: [
      "Situation & Task: Clear description of a collaborative project with differing communication or work styles",
      "Action: Proactive steps taken to establish common working agreements, active listening, and compromise",
      "Result: Successful project delivery and improved professional rapport"
    ],
    acceptablePatterns: ["STAR framework (Situation, Task, Action, Result)", "Focusing on shared objectives", "Constructive feedback"],
    commonMisconceptions: ["Blaming or criticizing the colleague", "Failing to describe specific personal actions taken"],
    referenceAnswer: "Explain the context using the STAR framework: Describe how differing communication styles were identified, specific proactive steps taken to align expectations and divide responsibilities, and the positive project outcome.",
    tags: ["hr", "behavioral"]
  },
  {
    questionText: "How do you handle pressure when deadlines are close?",
    track: "hr",
    difficulty: "medium",
    keywords: ["prioritization", "time management", "focus", "stress management", "communication", "eisenhower matrix"],
    expectedConcepts: [
      "Systematic task triage and prioritizing high-impact deliverables",
      "Proactive stakeholder and team communication regarding realistic timelines and scope trade-offs",
      "Maintaining calm, methodical execution without sacrificing code quality or testing"
    ],
    acceptablePatterns: ["Breaking complex tasks into small milestones", "Eliminating non-critical distractions", "Requesting assistance when appropriate"],
    commonMisconceptions: ["Saying 'I never feel stress'", "Promising unsustainable crunch without structured planning"],
    referenceAnswer: "Outline a structured prioritization strategy: Triage critical-path deliverables, communicate transparently with stakeholders, eliminate non-essential scope, and maintain methodical execution under pressure.",
    tags: ["hr", "behavioral"]
  },
  {
    questionText: "Tell me about a mistake you made and what you learned from it.",
    track: "hr",
    difficulty: "medium",
    keywords: ["ownership", "accountability", "root cause", "post mortem", "prevention", "learning"],
    expectedConcepts: [
      "Honest ownership of a genuine technical or procedural error without passing blame",
      "Immediate corrective action taken to mitigate the impact",
      "Root cause analysis and systemic preventive safeguards implemented (e.g. automated tests, linting, CI/CD checks)"
    ],
    acceptablePatterns: ["Blameless post-mortem approach", "Continuous improvement mindset"],
    commonMisconceptions: ["Giving a fake non-mistake (e.g. 'I worked too hard')", "Blaming teammates or tools"],
    referenceAnswer: "Describe an authentic challenge, take full ownership, explain the immediate remediation, and emphasize the permanent safeguards and lessons incorporated into your development workflow.",
    tags: ["hr", "behavioral"]
  }
]

import fs from 'fs'

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('✅ Connected to MongoDB for seeding')

    // 1. Seed base SEED_QUESTIONS
    for (const q of SEED_QUESTIONS) {
      await Question.updateOne(
        { questionText: q.questionText },
        { $set: { ...q, college: null } },
        { upsert: true }
      )
    }

    // 2. Seed comprehensive question bank (285 questions across OS, DBMS, SE, Networks, Java, DSA)
    const jsonPath = path.resolve(__dirname, '../data/comprehensiveQuestionBank.json')
    if (fs.existsSync(jsonPath)) {
      const fullBank = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
      for (const q of fullBank) {
        await Question.updateOne(
          { questionText: new RegExp('^' + q.questionText.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i') },
          {
            $set: {
              questionText: q.questionText.trim(),
              track: q.track || 'subject',
              tags: q.tags || ['technical'],
              difficulty: q.difficulty || 'medium',
              keywords: q.keywords || [],
              expectedConcepts: q.expectedConcepts || [],
              acceptablePatterns: q.acceptablePatterns || [],
              commonMisconceptions: q.commonMisconceptions || [],
              referenceAnswer: q.referenceAnswer || '',
              answerType: q.answerType || 'explanatory',
              canonicalAnswer: q.canonicalAnswer || '',
              acceptedAnswers: q.acceptedAnswers || [],
              scoringRubric: q.scoringRubric || {
                relevanceWeight: 0.25,
                conceptWeight: 0.40,
                completenessWeight: 0.20,
                structureWeight: 0.15,
              },
              college: null,
            }
          },
          { upsert: true }
        )
      }
      console.log(`✅ Loaded and upserted ${fullBank.length} questions from comprehensiveQuestionBank.json`)
    }

    const count = await Question.countDocuments()
    console.log(`🚀 Question Bank successfully seeded! Total questions in MongoDB: ${count}`)
    process.exit(0)
  } catch (err) {
    console.error('❌ Seeding error:', err)
    process.exit(1)
  }
}

seed()
