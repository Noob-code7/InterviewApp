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
  // ── Operating Systems ──────────────────────────────────────────────────────
  {
    questionText: "What is deadlock, and what conditions are needed for it to occur?",
    keywords: ["mutual exclusion", "hold and wait", "no preemption", "circular wait"],
    referenceAnswer: "Deadlock occurs when processes are unable to proceed because each is waiting for a resource held by another. The four necessary conditions are Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait.",
    tags: ["os", "operating-systems", "technical"]
  },
  {
    questionText: "What is virtual memory and how does demand paging work?",
    keywords: ["virtual memory", "demand paging", "page fault", "page table", "swap space"],
    referenceAnswer: "Virtual memory maps virtual addresses to physical memory. Demand paging loads pages into physical RAM only when referenced by a process, triggering a page fault if the page is not in RAM.",
    tags: ["os", "operating-systems", "technical"]
  },
  {
    questionText: "What is IPC? What are the different IPC mechanisms?",
    keywords: ["inter process communication", "shared memory", "message passing", "pipes", "sockets", "semaphores"],
    referenceAnswer: "IPC allows processes to communicate and synchronize actions. Common mechanisms include Pipes, Shared Memory, Message Queues, Semaphores, and Sockets.",
    tags: ["os", "operating-systems", "technical"]
  },
  {
    questionText: "What is context switching and why is it important?",
    keywords: ["context switching", "pcb", "process control block", "cpu state", "overhead"],
    referenceAnswer: "Context switching saves the state of a running process in its PCB and loads the saved state of another process so the CPU can resume execution.",
    tags: ["os", "operating-systems", "technical"]
  },
  {
    questionText: "What is thrashing in an operating system?",
    keywords: ["thrashing", "page fault rate", "swap file", "cpu utilization", "working set"],
    referenceAnswer: "Thrashing occurs when a system spends more time swapping pages in and out of virtual memory than executing actual process instructions due to insufficient physical memory.",
    tags: ["os", "operating-systems", "technical"]
  },

  // ── Database Management Systems ────────────────────────────────────────────
  {
    questionText: "Explain ACID properties in database management.",
    keywords: ["atomicity", "consistency", "isolation", "durability", "transactions"],
    referenceAnswer: "ACID guarantees database reliability. Atomicity ensures all-or-nothing completion; Consistency preserves valid state; Isolation prevents concurrent transaction interference; Durability ensures committed data persists.",
    tags: ["dbms", "database", "technical"]
  },
  {
    questionText: "What is the difference between an inner join and an outer join?",
    keywords: ["inner join", "outer join", "left join", "right join", "null values", "matching rows"],
    referenceAnswer: "An inner join returns only rows where there is a match in both tables. An outer join (left, right, full) returns matched rows plus unmatched rows with NULL values from the specified table.",
    tags: ["dbms", "database", "technical"]
  },
  {
    questionText: "Why is normalization required in DBMS and what is BCNF?",
    keywords: ["normalization", "redundancy", "anomalies", "bcnf", "3nf", "functional dependency"],
    referenceAnswer: "Normalization eliminates data redundancy and update anomalies. BCNF (Boyce-Codd Normal Form) is a stricter version of 3NF where every determinant must be a candidate key.",
    tags: ["dbms", "database", "technical"]
  },
  {
    questionText: "What are primary key, candidate key, and foreign key?",
    keywords: ["primary key", "candidate key", "foreign key", "referential integrity", "uniqueness"],
    referenceAnswer: "A candidate key uniquely identifies a row. A primary key is the chosen minimal candidate key. A foreign key references a primary key in another table to enforce referential integrity.",
    tags: ["dbms", "database", "technical"]
  },

  // ── Object-Oriented Programming ───────────────────────────────────────────
  {
    questionText: "What is encapsulation, and why is it useful?",
    keywords: ["encapsulation", "data hiding", "access modifiers", "private fields", "getters and setters"],
    referenceAnswer: "Encapsulation wraps data and operations into a single unit (class) while restricting direct external access using private modifiers to ensure data protection.",
    tags: ["oop", "programming", "technical"]
  },
  {
    questionText: "What is polymorphism and how does method overriding differ from overloading?",
    keywords: ["polymorphism", "method overriding", "method overloading", "runtime", "compile time", "dynamic binding"],
    referenceAnswer: "Polymorphism allows objects to take multiple forms. Overloading happens at compile time with different parameters; Overriding happens at runtime when a subclass redefines a parent method.",
    tags: ["oop", "programming", "technical"]
  },
  {
    questionText: "What is the difference between an interface and an abstract class?",
    keywords: ["interface", "abstract class", "multiple inheritance", "default methods", "abstract methods"],
    referenceAnswer: "An abstract class can contain state (fields) and implementation code, but supports single inheritance. An interface defines contract method signatures and allows multiple inheritance.",
    tags: ["oop", "programming", "technical"]
  },

  // ── Data Structures & Algorithms ─────────────────────────────────────────
  {
    questionText: "What is the difference between BFS and DFS graph traversals?",
    keywords: ["bfs", "dfs", "breadth first search", "depth first search", "queue", "stack", "shortest path"],
    referenceAnswer: "BFS traverses level-by-level using a Queue and finds shortest paths in unweighted graphs. DFS explores as deep as possible along each branch using a Stack or recursion.",
    tags: ["ds", "algorithms", "technical"]
  },
  {
    questionText: "What is the difference between stack and queue data structures?",
    keywords: ["stack", "queue", "lifo", "fifo", "push pop", "enqueue dequeue"],
    referenceAnswer: "A stack is a Last-In-First-Out (LIFO) structure (push/pop). A queue is a First-In-First-Out (FIFO) structure (enqueue/dequeue).",
    tags: ["ds", "algorithms", "technical"]
  },
  {
    questionText: "What is a Binary Search Tree and what is its average time complexity?",
    keywords: ["binary search tree", "bst", "left child smaller", "right child larger", "o(log n)", "inorder traversal"],
    referenceAnswer: "A BST is a node-based binary tree where left children contain smaller values and right children larger values. Average search/insert time complexity is O(log n).",
    tags: ["ds", "algorithms", "technical"]
  },

  // ── Computer Networks ──────────────────────────────────────────────────────
  {
    questionText: "What is the OSI model and what are its seven layers?",
    keywords: ["osi model", "physical", "data link", "network", "transport", "session", "presentation", "application"],
    referenceAnswer: "The OSI model standardizes network communication into 7 layers: Physical, Data Link, Network, Transport, Session, Presentation, and Application.",
    tags: ["networking", "technical"]
  },
  {
    questionText: "What is the difference between TCP and UDP?",
    keywords: ["tcp", "udp", "connection oriented", "connectionless", "handshake", "reliability", "streaming"],
    referenceAnswer: "TCP is connection-oriented, reliable, and guarantees ordered packet delivery via a 3-way handshake. UDP is connectionless, faster, but does not guarantee delivery or packet ordering.",
    tags: ["networking", "technical"]
  },

  // ── HR & Behavioral ────────────────────────────────────────────────────────
  {
    questionText: "Tell me about a time you worked with someone whose style was very different from yours.",
    keywords: ["communication", "collaboration", "flexibility", "conflict resolution", "adaptability"],
    referenceAnswer: "Demonstrate open communication, active listening, finding common ground, focusing on project goals, and respecting different working styles.",
    tags: ["hr", "behavioral"]
  },
  {
    questionText: "How do you handle pressure when deadlines are close?",
    keywords: ["prioritization", "time management", "focus", "stress management", "communication"],
    referenceAnswer: "Explain breaking tasks into prioritized deliverables, communicating proactively with stakeholders, maintaining focus, and keeping team members updated.",
    tags: ["hr", "behavioral"]
  },
  {
    questionText: "Tell me about a mistake you made and what you learned from it.",
    keywords: ["ownership", "accountability", "learning", "rectification", "prevention"],
    referenceAnswer: "Take ownership of a realistic mistake, describe the immediate steps taken to resolve it, and detail the preventive measures implemented afterwards.",
    tags: ["hr", "behavioral"]
  }
]

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('✅ Connected to MongoDB for seeding')

    // Upsert seed questions into MongoDB
    for (const q of SEED_QUESTIONS) {
      await Question.updateOne(
        { questionText: q.questionText },
        { $set: { ...q, college: null } },
        { upsert: true }
      )
    }

    const count = await Question.countDocuments()
    console.log(`🎉 Question Bank successfully seeded! Total questions in MongoDB: ${count}`)
    process.exit(0)
  } catch (err) {
    console.error('❌ Seeding error:', err)
    process.exit(1)
  }
}

seed()
