export const HR_QUESTIONS = [
  "Tell me about yourself in your own words.",
  "What kind of work do you enjoy the most?",
  "What helps you do your best work in a team?",
  "Tell me about a time you learned something new quickly.",
  "What was one project or task you felt good about, and why?",
  "Tell me about a time something did not go as planned.",
  "How do you handle pressure when deadlines are close?",
  "Tell me about a time you worked with someone whose style was very different from yours.",
  "What do you usually do when you get stuck on a problem?",
  "How do you decide what to do first when you have several tasks?",
  "Tell me about feedback you received that helped you improve.",
  "What keeps you motivated as an engineer?",
  "How do you stay focused when work gets stressful?",
  "Tell me about a time you disagreed with a teammate.",
  "What kind of mentor or manager helps you grow?",
  "How do you approach new tasks you have not done before?",
  "What does a good workday look like for you?",
  "Tell me about a mistake you made and what you learned from it.",
  "What are you looking for in your next job?",
  "Where do you see yourself growing in the next few years?",
];

export const TECHNICAL_QUESTION_BANK = {
  os: [
    "What is IPC? What are the different IPC mechanisms?",
    "What is the main purpose of an operating system?",
    "Explain demand paging.",
    "What is virtual memory?",
    "What is a process, and what are its states?",
    "What is context switching?",
    "What is thrashing in an operating system?",
    "What is deadlock, and what conditions are needed for it to occur?",
  ],
  dbms: [
    "What is the difference between an inner join and an outer join?",
    "What are primary key, candidate key, and foreign key?",
    "Why is normalization required in DBMS?",
    "What is functional dependency?",
    "Explain ACID properties.",
    "What is BCNF, and why is it better than 3NF?",
    "What is a transaction?",
    "What is query optimization?",
  ],
  se: [
    "What is SDLC?",
    "Which SDLC model would you choose for a fast-moving product team?",
    "What is the difference between validation and verification?",
    "What is the difference between black-box and white-box testing?",
    "What is software re-engineering?",
    "What is the difference between cohesion and coupling?",
    "What are CASE tools?",
    "What is the role of testing in software quality?",
  ],
  networking: [
    "What is the OSI model?",
    "What is the difference between TCP and UDP?",
    "What is subnetting?",
    "What is the difference between a hub and a switch?",
    "What is CSMA/CD?",
    "What is DHCP?",
    "What is the difference between ARP and RARP?",
    "What is routing?",
  ],
  oop: [
    "What is encapsulation, and why is it useful?",
    "What is polymorphism?",
    "What is the difference between a class and an object?",
    "What is a constructor in Java?",
    "What is the difference between heap and stack memory?",
    "What is an interface in Java?",
    "What is method overriding?",
    "What is the difference between == and equals() in Java?",
  ],
  ds: [
    "Why do we need data structures?",
    "What is the difference between stack and queue?",
    "Explain recursion and its use in algorithms.",
    "What is a linked list?",
    "What is the difference between BFS and DFS?",
    "What is a binary search tree?",
    "What is an AVL tree?",
    "What is the basic idea behind Prim’s algorithm?",
  ],
};

export const ROLE_TOPIC_MAP = [
  {
    match: ["frontend", "ui", "web"],
    topics: ["oop", "ds", "se", "networking"],
  },
  {
    match: ["backend", "api", "server"],
    topics: ["os", "dbms", "networking", "ds"],
  },
  {
    match: ["fullstack", "full stack"],
    topics: ["oop", "dbms", "networking", "ds"],
  },
  {
    match: ["devops", "platform", "infra"],
    topics: ["os", "networking", "dbms"],
  },
  { match: ["data", "analytics", "ml", "ai"], topics: ["dbms", "ds", "os"] },
  { match: ["mobile", "android", "ios"], topics: ["oop", "ds", "os", "se"] },
  {
    match: ["software", "engineer"],
    topics: ["os", "dbms", "se", "networking", "oop", "ds"],
  },
];

export function getTopicsForRole(role = "") {
  const normalizedRole = role.toLowerCase();
  const rule = ROLE_TOPIC_MAP.find(({ match }) =>
    match.some((token) => normalizedRole.includes(token)),
  );

  return rule?.topics || ["os", "dbms", "se", "networking", "oop", "ds"];
}
