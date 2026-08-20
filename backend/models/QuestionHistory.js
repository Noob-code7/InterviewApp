import mongoose from "mongoose";

const questionHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
      index: true,
    },
    questionText: {
      type: String,
      required: true,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    track: {
      type: String,
      enum: ["hr", "subject", "project"],
      default: "subject",
    },
    askedAt: {
      type: Date,
      default: Date.now,
    },
    timesAsked: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  { timestamps: true }
);

// Compound unique index to prevent duplicate entries for same user/question
questionHistorySchema.index({ userId: 1, questionId: 1 }, { unique: true });

// Index for efficient querying by user and tags
questionHistorySchema.index({ userId: 1, tags: 1 });

// Index for sorting by least recently asked
questionHistorySchema.index({ userId: 1, askedAt: 1 });

const QuestionHistory = mongoose.model("QuestionHistory", questionHistorySchema);

export default QuestionHistory;