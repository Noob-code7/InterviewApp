import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { sessionsApi } from "../api/sessions.js";
import api from "../api/axios.js";

const INTERVIEW_TYPES = [
  { id: "hr",        label: "HR & Behavioral Interview", desc: "STAR format responses, cultural alignment & situational judgment.", tag: "HR / CULTURE" },
  { id: "technical", label: "Technical & Systems Interview", desc: "Core computer science, architecture, DSA & coding rationale.", tag: "CORE CS / SYSTEM" },
  { id: "resume",    label: "Resume-Grounded Defense",   desc: "Deep dive probing projects, tech stacks, and real-world trade-offs.", tag: "PROJECTS / RESUME" },
  { id: "company",   label: "Company-Specific Practice", desc: "FAANG & Tier-1 company specific hiring evaluation patterns.", tag: "ENTERPRISE PATTERN" },
];

const DEPARTMENTS = [
  "Computer Science & Engineering", "Information Technology", "Electronics & Comm (ECE)",
  "Electrical Engineering (EEE)", "Mechanical Engineering", "Other Specialized Engineering",
];

const SUBJECT_OPTIONS = [
  { id: "os", label: "Operating Systems (OS)" },
  { id: "dbms", label: "Database Management Systems (DBMS)" },
  { id: "networking", label: "Computer Networks" },
  { id: "oop", label: "Object-Oriented Programming (OOP)" },
  { id: "se", label: "Software Engineering (SE)" },
  { id: "ds", label: "Data Structures & Algorithms (DSA)" },
];

export default function InterviewSetupPage() {
  const navigate = useNavigate();
  const { state } = useLocation();

  const [step, setStep] = useState(1);
  const [interviewType, setInterviewType] = useState(state?.type || "technical");

  const [candidateName, setCandidateName] = useState("");
  const [department, setDepartment] = useState("Computer Science & Engineering");
  const [rollNo, setRollNo] = useState("");
  const [graduationYear, setGraduationYear] = useState("2026");
  const [role, setRole] = useState("Fullstack Systems Engineer");
  const [questionCount, setQuestionCount] = useState(5);
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [company, setCompany] = useState("");
  const [includeWritingTest, setIncludeWritingTest] = useState(true);

  const [resumeFile, setResumeFile] = useState(null);
  const [resumeText, setResumeText] = useState("");
  const [resumeStatus, setResumeStatus] = useState("");

  const [permissionGranted, setPermissionGranted] = useState(false);
  const [permissionError, setPermissionError] = useState("");
  const [creating, setCreating] = useState(false);
  const streamRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleStep1 = () => { if (interviewType) setStep(2); };

  const handleStep2 = (e) => {
    e.preventDefault();
    if (role.trim() && candidateName.trim()) setStep(3);
  };

  const handleResumeFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setResumeFile(file);
    setResumeStatus("Parsing " + file.name + " with LLM parser...");
    try {
      const formData = new FormData();
      formData.append("resume", file);
      formData.append("role", role || "Software Engineer");
      formData.append("count", questionCount || 5);
      const { data } = await api.post("/api/sessions/parse-resume", formData);
      const extracted = data.data?.extractedText || "";
      setResumeText(extracted);
      setResumeStatus("✓ Parsed " + file.name + " (" + extracted.length + " characters extracted)");
    } catch (err) {
      setResumeStatus("Failed to parse " + file.name + " (" + (err.response?.data?.error || err.message) + ")");
      setResumeText("Candidate resume file: " + file.name);
    }
  };

  const toggleSubject = (id) => {
    setSelectedSubjects((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const requestPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; }
      setPermissionGranted(true);
      setPermissionError("");
    } catch {
      setPermissionError("Camera & microphone permission is required to analyze posture, eye attention, and speech acoustic SER.");
    }
  };

  const handleStart = async () => {
    setCreating(true);
    try {
      let referenceImage = null;
      if (videoRef.current && videoRef.current.readyState === 4) {
        const canvas = document.createElement("canvas");
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        referenceImage = canvas.toDataURL("image/jpeg", 0.8);
      }
      const { data } = await sessionsApi.create({
        candidateName: candidateName.trim(),
        department: department.trim(),
        rollNo: rollNo.trim(),
        graduationYear: graduationYear.trim(),
        role: interviewType === "company" && company.trim() ? company + " - " + role : role,
        interviewType,
        questionCount,
        subjectsOfInterest: interviewType === "technical" ? selectedSubjects : [],
        includeWritingTest,
        referenceImage,
        resumeText: resumeText || role + " Candidate Resume Background",
      });
      navigate("/interview/live/" + data.data.session._id);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to create interview session");
      setCreating(false);
    }
  };

  const inputCls = "w-full bg-[#FAF9F5] border border-[#E0DFD9] px-4 py-3 text-sm text-[#111110] font-semibold placeholder:text-[#9CA3AF] rounded-lg focus:outline-none focus:bg-white focus:border-[#1D5DFF] focus:ring-2 focus:ring-[#1D5DFF]/15 transition-all";
  const labelCls = "block font-mono text-xs font-bold uppercase text-[#111110] tracking-wide mb-1.5";
  const selectCls = "w-full bg-[#FAF9F5] border border-[#E0DFD9] px-4 py-3 text-sm text-[#111110] font-semibold rounded-lg focus:outline-none focus:bg-white focus:border-[#1D5DFF] focus:ring-2 focus:ring-[#1D5DFF]/15 transition-all";

  return (
    <div className="min-h-screen bg-[#F6F5F0] text-[#111110] font-sans pb-20">
      <div className="max-w-4xl mx-auto px-6 pt-10">

        {/* Back Link */}
        <button
          onClick={() => (step > 1 ? setStep(step - 1) : navigate("/"))}
          className="inline-flex items-center gap-2 text-sm font-bold text-[#4B5563] hover:text-[#111110] transition-colors mb-6"
        >
          ← {step > 1 ? "Back to previous step" : "Back to Home"}
        </button>

        {/* Header with Geometric Step Progress */}
        <div className="bg-white border border-[#E0DFD9] rounded-2xl p-6 sm:p-8 shadow-sm mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E0DFD9] pb-6 mb-6">
            <div>
              <span className="font-mono text-xs font-bold uppercase text-[#1D5DFF] tracking-wider block mb-1">
                SESSION ORCHESTRATION
              </span>
              <h1 className="text-3xl font-extrabold text-[#111110] tracking-tight">
                Configure Practice Session
              </h1>
            </div>
            <div className="font-mono text-xs font-bold text-[#4B5563] bg-[#FAF9F5] px-3.5 py-1.5 rounded-lg border border-[#E0DFD9]">
              STEP {step} OF 3
            </div>
          </div>

          {/* Clean Stepper Tabs (No round pills) */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { num: "01", label: "INTERVIEW FORMAT" },
              { num: "02", label: "CANDIDATE DETAILS" },
              { num: "03", label: "EQUIPMENT CHECK" },
            ].map((s, idx) => {
              const active = step === idx + 1;
              const completed = step > idx + 1;
              return (
                <div
                  key={s.num}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    active
                      ? "bg-[#111110] text-[#F6F5F0] border-[#111110]"
                      : completed
                      ? "bg-white text-[#111110] border-[#111110]"
                      : "bg-[#FAF9F5] text-[#6B7280] border-[#E0DFD9]"
                  }`}
                >
                  <div className="font-mono text-[10px] font-bold tracking-widest">{s.num}</div>
                  <div className="text-xs font-extrabold mt-0.5 truncate">{s.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* STEP 1: FORMAT SELECTION */}
        {step === 1 && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {INTERVIEW_TYPES.map((type) => {
                const isSelected = interviewType === type.id;
                return (
                  <div
                    key={type.id}
                    onClick={() => setInterviewType(type.id)}
                    className={`p-6 bg-white rounded-2xl border transition-all duration-200 cursor-pointer card-hover ${
                      isSelected
                        ? "border-[#1D5DFF] shadow-md ring-2 ring-[#1D5DFF]/20"
                        : "border-[#E0DFD9] hover:border-[#111110]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-[10px] font-extrabold tracking-widest px-2.5 py-1 rounded bg-[#FAF9F5] text-[#111110] border border-[#E0DFD9]">
                        {type.tag}
                      </span>
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                        isSelected ? "bg-[#1D5DFF] border-[#1D5DFF] text-white" : "border-[#D1D5DB]"
                      }`}>
                        {isSelected && <span className="text-xs font-bold">✓</span>}
                      </div>
                    </div>
                    <h3 className="text-lg font-bold text-[#111110] mb-1.5">{type.label}</h3>
                    <p className="text-xs text-[#4B5563] font-medium leading-relaxed">{type.desc}</p>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleStep1}
                disabled={!interviewType}
                className="bg-[#111110] text-[#F6F5F0] px-8 py-3.5 text-sm font-bold rounded-lg hover:bg-[#1D5DFF] transition-all duration-200 shadow-sm active:scale-98 disabled:opacity-40"
              >
                Continue to Candidate Details →
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: CANDIDATE INFO */}
        {step === 2 && (
          <form onSubmit={handleStep2} className="space-y-6 animate-fade-in">
            <div className="bg-white border border-[#E0DFD9] rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
              <div className="border-b border-[#E0DFD9] pb-4">
                <h2 className="text-xl font-extrabold text-[#111110]">Candidate Identification</h2>
                <p className="text-xs text-[#4B5563] font-medium mt-0.5">Used for university placement roster and analytics matching.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className={labelCls}>Candidate Full Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Rahul Sharma"
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    required
                    className={inputCls}
                    autoFocus
                  />
                </div>
                <div>
                  <label className={labelCls}>Roll Number / University ID *</label>
                  <input
                    type="text"
                    placeholder="e.g. 21CS045"
                    value={rollNo}
                    onChange={(e) => setRollNo(e.target.value)}
                    required
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className={labelCls}>Department / Branch</label>
                  <select value={department} onChange={(e) => setDepartment(e.target.value)} className={selectCls}>
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Graduation Batch</label>
                  <select value={graduationYear} onChange={(e) => setGraduationYear(e.target.value)} className={selectCls}>
                    {["2025", "2026", "2027", "2028"].map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>

              <div className="border-t border-[#E0DFD9] pt-6 space-y-5">
                <div>
                  <label className={labelCls}>Target Engineering Role *</label>
                  <input
                    type="text"
                    placeholder="e.g. Fullstack Systems Engineer"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    required
                    className={inputCls}
                  />
                </div>

                {interviewType === "company" && (
                  <div>
                    <label className={labelCls}>Target Enterprise Company</label>
                    <input
                      type="text"
                      placeholder="e.g. Google, Microsoft, Amazon, TCS"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                )}

                {interviewType === "resume" && (
                  <div className="p-5 bg-[#FAF9F5] border border-[#E0DFD9] rounded-xl space-y-3">
                    <label className={labelCls}>Upload Candidate Resume (PDF / DOCX / TXT)</label>
                    <div className="border-2 border-dashed border-[#D1D5DB] bg-white rounded-xl p-6 text-center hover:border-[#1D5DFF] transition-colors cursor-pointer">
                      <input type="file" accept=".pdf,.docx,.txt" onChange={handleResumeFileUpload} className="hidden" id="resume-file-input" />
                      <label htmlFor="resume-file-input" className="cursor-pointer flex flex-col items-center gap-2">
                        <div className="w-10 h-10 rounded-lg bg-[#FAF9F5] border border-[#E0DFD9] flex items-center justify-center text-sm font-bold font-mono text-[#1D5DFF]">
                          FILE
                        </div>
                        <span className="text-xs font-bold text-[#111110]">
                          {resumeFile ? resumeFile.name : "Click to select PDF or DOCX resume"}
                        </span>
                        <span className="text-[11px] text-[#6B7280]">Questions will be synthesized strictly from your resume projects</span>
                      </label>
                    </div>
                    {resumeStatus && <p className="text-xs font-mono font-bold text-[#1D5DFF]">{resumeStatus}</p>}
                    {resumeText && (
                      <div className="mt-3">
                        <span className="font-mono text-[10px] font-bold uppercase text-[#6B7280] block mb-1">
                          Extracted Context Preview
                        </span>
                        <textarea
                          readOnly
                          value={resumeText}
                          className="w-full h-24 p-3 bg-white border border-[#E0DFD9] rounded-lg text-xs font-mono text-[#4B5563] resize-none focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                )}

                {interviewType === "technical" && (
                  <div className="p-5 bg-[#FAF9F5] border border-[#E0DFD9] rounded-xl space-y-3">
                    <div>
                      <label className={labelCls}>Subject of Interest</label>
                      <p className="text-[11px] text-[#6B7280] mt-0.5 mb-2">
                        Select your strongest subjects (optional, multiple allowed). Questions will be
                        asked from these subjects only. Leave empty for a balanced mix based on your role.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {SUBJECT_OPTIONS.map((subject) => {
                        const isSelected = selectedSubjects.includes(subject.id);
                        return (
                          <button
                            key={subject.id}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => toggleSubject(subject.id)}
                            className={`flex items-center justify-between gap-2 px-4 py-2.5 text-xs font-bold rounded-lg border text-left transition-all ${
                              isSelected
                                ? "bg-[#1D5DFF] text-white border-[#1D5DFF] shadow-sm"
                                : "bg-white text-[#4B5563] border-[#E0DFD9] hover:border-[#111110] hover:text-[#111110]"
                            }`}
                          >
                            <span>{subject.label}</span>
                            <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                              isSelected ? "bg-white/20 border-white" : "border-[#D1D5DB]"
                            }`}>
                              {isSelected && <span className="text-[10px] font-bold">✓</span>}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {selectedSubjects.length > 0 && (
                      <p className="text-[11px] font-mono font-bold text-[#1D5DFF]">
                        {selectedSubjects.length} subject{selectedSubjects.length > 1 ? "s" : ""} selected
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className={labelCls}>Question Count (Session Duration)</label>
                  <div className="grid grid-cols-4 gap-3">
                    {[3, 5, 8, 10].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setQuestionCount(n)}
                        className={`py-3 text-xs font-bold rounded-lg border transition-all ${
                          questionCount === n
                            ? "bg-[#111110] text-white border-[#111110] shadow-sm"
                            : "bg-white text-[#4B5563] border-[#E0DFD9] hover:border-[#111110] hover:text-[#111110]"
                        }`}
                      >
                        {n} Questions
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-5 bg-[#FAF9F5] border border-[#E0DFD9] rounded-xl flex items-start gap-4">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={includeWritingTest}
                    onClick={() => setIncludeWritingTest((v) => !v)}
                    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 mt-0.5 ${
                      includeWritingTest ? "bg-[#1D5DFF]" : "bg-[#D1D5DB]"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        includeWritingTest ? "translate-x-5" : ""
                      }`}
                    />
                  </button>
                  <div>
                    <div className="text-sm font-bold text-[#111110]">
                      Include Technical Writing Test
                    </div>
                    <p className="text-[11px] text-[#6B7280] mt-0.5">
                      After the interview, you may complete a short written technical
                      assessment. Analyzed locally and included in your report.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="bg-white border border-[#E0DFD9] text-[#111110] px-6 py-3 text-sm font-bold rounded-lg hover:border-[#111110] transition-colors"
              >
                ← Back
              </button>
              <button
                type="submit"
                disabled={!role.trim() || !candidateName.trim()}
                className="bg-[#111110] text-[#F6F5F0] px-8 py-3.5 text-sm font-bold rounded-lg hover:bg-[#1D5DFF] transition-all duration-200 shadow-sm active:scale-98 disabled:opacity-40"
              >
                Proceed to Equipment Check →
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: EQUIPMENT CHECK */}
        {step === 3 && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white border border-[#E0DFD9] rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
              <div className="border-b border-[#E0DFD9] pb-4">
                <h2 className="text-xl font-extrabold text-[#111110]">Hardware & Sensor Verification</h2>
                <p className="text-xs text-[#4B5563] font-medium mt-0.5">
                  Verify camera and microphone feed before entering the live interview room.
                </p>
              </div>

              {/* Video Preview Box */}
              <div className="bg-[#111110] rounded-xl aspect-video relative overflow-hidden flex items-center justify-center shadow-inner">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover scale-x-[-1] ${permissionGranted ? "block" : "hidden"}`}
                />
                {!permissionGranted && (
                  <div className="text-center space-y-4 p-6">
                    <div className="w-14 h-14 rounded-xl bg-[#1F2937] border border-[#374151] flex items-center justify-center mx-auto text-white font-mono text-sm font-bold">
                      AV
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">Camera & Microphone Access Required</p>
                      <p className="text-xs text-[#9CA3AF] mt-1">Telemetry models evaluate posture, eye contact, and vocal fluency.</p>
                    </div>
                    <button
                      type="button"
                      onClick={requestPermissions}
                      className="bg-[#1D5DFF] hover:bg-blue-600 text-white px-6 py-2.5 text-xs font-bold rounded-lg transition-colors shadow-sm"
                    >
                      Enable Camera & Microphone
                    </button>
                  </div>
                )}

                {permissionGranted && (
                  <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-md border border-white/10">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-mono text-[10px] text-white font-bold tracking-widest">FEED ACTIVE</span>
                  </div>
                )}
              </div>

              {permissionError && (
                <div className="px-4 py-3 border border-red-200 bg-red-50 text-red-800 text-xs font-semibold rounded-lg">
                  {permissionError}
                </div>
              )}

              {/* Configuration Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                {[
                  ["Candidate", candidateName],
                  ["Role", role],
                  ["Format", INTERVIEW_TYPES.find((t) => t.id === interviewType)?.label || interviewType],
                  ["Questions", questionCount + " Questions"],
                  ...(interviewType === "technical" && selectedSubjects.length > 0
                    ? [[
                        "Subjects",
                        selectedSubjects
                          .map((id) => SUBJECT_OPTIONS.find((s) => s.id === id)?.label.split(" (")[0])
                          .join(", "),
                      ]]
                    : []),
                ].map(([k, v]) => (
                  <div key={k} className="p-3 bg-[#FAF9F5] border border-[#E0DFD9] rounded-lg">
                    <div className="font-mono text-[10px] font-bold text-[#6B7280] uppercase">{k}</div>
                    <div className="text-xs font-extrabold text-[#111110] truncate mt-0.5">{v}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="bg-white border border-[#E0DFD9] text-[#111110] px-6 py-3 text-sm font-bold rounded-lg hover:border-[#111110] transition-colors"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleStart}
                disabled={!permissionGranted || creating}
                className="bg-[#111110] text-[#F6F5F0] px-8 py-3.5 text-sm font-bold rounded-lg hover:bg-[#1D5DFF] transition-all duration-200 shadow-sm active:scale-98 disabled:opacity-40"
              >
                {creating ? "Launching Interview Engine..." : "Enter Live Interview Room →"}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
