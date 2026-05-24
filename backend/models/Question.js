import mongoose from "mongoose";

const questionSchema = new mongoose.Schema(
  {
    questionText: { type: String, required: true },
    referenceAnswer: { type: String, default: "" },
    keywords: { type: [String], default: [] },
    testcases: { type: [mongoose.Schema.Types.Mixed], default: [] },
    college: { type: String, default: null }, // optional college identifier
    tags: { type: [String], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

const Question = mongoose.model("Question", questionSchema);
export default Question;
