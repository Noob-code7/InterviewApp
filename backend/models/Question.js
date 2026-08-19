import mongoose from "mongoose";

const questionSchema = new mongoose.Schema(
  {
    questionText: { type: String, required: true },
    referenceAnswer: { type: String, default: "" },
    keywords: { type: [String], default: [] },
    expectedConcepts: { type: [String], default: [] },
    acceptablePatterns: { type: [String], default: [] },
    commonMisconceptions: { type: [String], default: [] },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },
    track: {
      type: String,
      enum: ["hr", "subject", "project"],
      default: "subject",
    },
    scoringRubric: {
      relevanceWeight: { type: Number, default: 0.25 },
      conceptWeight: { type: Number, default: 0.35 },
      completenessWeight: { type: Number, default: 0.20 },
      structureWeight: { type: Number, default: 0.20 },
    },
    testcases: { type: [mongoose.Schema.Types.Mixed], default: [] },
    college: { type: String, default: null }, // optional college identifier
    tags: { type: [String], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

const Question = mongoose.model("Question", questionSchema);
export default Question;
