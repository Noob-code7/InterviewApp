import Session from '../models/Session.js'
import { sendSuccess, sendError } from '../utils/response.js'

// Mock question banks based on interview type
const QUESTION_BANKS = {
  hr: [
    "Tell me about a time you handled a difficult situation with a coworker.",
    "Where do you see yourself in 5 years?",
    "Describe your greatest professional achievement.",
    "How do you handle working under pressure or tight deadlines?",
    "Why do you want to work for our company?",
    "Tell me about a time you failed and what you learned from it.",
    "How do you prioritize multiple tasks?",
    "Describe a time when you had to adapt to a significant change at work.",
  ],
  technical: [
    "Explain the difference between functional and object-oriented programming.",
    "How would you optimize a slow-performing database query?",
    "Describe a challenging technical problem you solved recently.",
    "Explain the concept of Big O notation and why it matters.",
    "How do you ensure your code is secure and free of vulnerabilities?",
    "What is your approach to testing and test-driven development?",
    "Describe a time you had to learn a new technology quickly.",
  ],
  company: [
    "Why are you interested in our specific product line?",
    "How would you improve one of our existing features?",
    "Tell me what you know about our main competitors and our market position.",
    "Which of our company values resonates with you the most and why?",
  ],
  resume: [
    "Can you walk me through the most significant project listed on your resume?",
    "I see you used [Technology] at [Company]. Tell me about your experience with it.",
    "What was your primary contribution to the [Project]?",
    "Why did you leave your previous role at [Company]?",
  ],
  mixed: [
    "Tell me about yourself.",
    "Explain a complex technical concept to a non-technical person.",
    "What is your greatest weakness?",
    "Describe a time you disagreed with a manager. How did you handle it?",
    "How do you stay updated with industry trends?",
  ]
}

function getRandomQuestions(bank, count) {
  const shuffled = [...bank].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, count)
}

// ── POST /api/sessions/:sessionId/questions ─────────────────────────────────
export const generateQuestions = async (req, res) => {
  try {
    const { sessionId } = req.params
    const session = await Session.findOne({ _id: sessionId, userId: req.user._id })
    
    if (!session) return sendError(res, 'Session not found', 404)
    if (session.answers && session.answers.length > 0) {
      return sendSuccess(res, { session }, 200, 'Questions already generated')
    }

    // In a real implementation, this would call an LLM with the session.role and session.interviewType
    const type = session.interviewType || 'mixed'
    const bank = QUESTION_BANKS[type] || QUESTION_BANKS.mixed
    
    const count = session.questionCount || 5
    const selectedQuestions = getRandomQuestions(bank, count)
    
    // Fallback if we need more questions than the bank has
    while (selectedQuestions.length < count) {
      selectedQuestions.push(QUESTION_BANKS.mixed[Math.floor(Math.random() * QUESTION_BANKS.mixed.length)])
    }

    const answers = selectedQuestions.map((q, index) => ({
      questionId: `q-${Date.now()}-${index}`,
      questionText: q,
    }))

    session.answers = answers
    await session.save()

    return sendSuccess(res, { session }, 201)
  } catch (err) {
    return sendError(res, err.message, 500)
  }
}
