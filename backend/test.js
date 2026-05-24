import mongoose from "mongoose";
import Session from "./models/Session.js";

async function run() {
  await mongoose.connect("mongodb://127.0.0.1:27017/interviewapp");
  const sessions = await Session.find().sort({ _id: -1 }).limit(10);
  console.log("LAST 10 SESSIONS:");
  sessions.forEach((s) => {
    console.log(
      s._id,
      s.interviewType,
      s.role,
      s.answers?.length > 0 ? "Has Answers" : "No Answers",
    );
  });
  process.exit(0);
}
run();
