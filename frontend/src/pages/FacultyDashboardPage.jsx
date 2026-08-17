import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "../api/admin.js";
import { Card, Button } from "../components/ui/index.js";

export default function FacultyDashboardPage() {
  const [activeTab, setActiveTab] = useState("drives"); // 'drives' | 'single' | 'bulk'

  // Questions Bank State
  const [questions, setQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [filterCollege, setFilterCollege] = useState("");
  const [questionSearch, setQuestionSearch] = useState("");

  // Drive Creation State
  const [driveForm, setDriveForm] = useState({
    driveName: "",
    driveCode: "",
    interviewType: "technical",
    role: "Fullstack Engineer",
    questionCount: 5,
    useDefaultQuestions: true,
    includeWritingTest: true,
    writingTaskPrompt: "",
  });
  const [createdCode, setCreatedCode] = useState("");

  // Single Question Creation State
  const [singleForm, setSingleForm] = useState({
    questionText: "",
    referenceAnswer: "",
    keywords: "",
    tags: "technical",
    college: "",
  });

  // Bulk Upload State
  const [jsonInput, setJsonInput] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");

  const fetchQuestions = async () => {
    setLoadingQuestions(true);
    try {
      const { data } = await adminApi.listQuestions({
        college: filterCollege || undefined,
        q: questionSearch || undefined,
      });
      setQuestions(data.data.questions || []);
    } catch (err) {
      console.error("Failed to fetch questions:", err);
    } finally {
      setLoadingQuestions(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [filterCollege, questionSearch]);

  const handleCreateDrive = (e) => {
    e.preventDefault();
    const code = driveForm.driveCode.toUpperCase().trim() || `DRIVE-${Math.floor(1000 + Math.random() * 9000)}`;
    setCreatedCode(code);
    alert(`🎉 Placement Drive "${driveForm.driveName || code}" created! Share code: ${code} with students.`);
  };

  const handleCreateSingleQuestion = async (e) => {
    e.preventDefault();
    if (!singleForm.questionText.trim()) return;

    try {
      await adminApi.createQuestion({
        questionText: singleForm.questionText,
        referenceAnswer: singleForm.referenceAnswer,
        keywords: singleForm.keywords,
        tags: singleForm.tags,
        college: singleForm.college || null,
      });

      setSingleForm({
        questionText: "",
        referenceAnswer: "",
        keywords: "",
        tags: "technical",
        college: "",
      });

      alert("Question successfully saved to MongoDB!");
      fetchQuestions();
    } catch (err) {
      alert("Failed to save question: " + (err.response?.data?.error || err.message));
    }
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    setBulkStatus("");

    try {
      const parsed = JSON.parse(jsonInput);
      const items = Array.isArray(parsed) ? parsed : [parsed];

      const res = await adminApi.bulkCreateQuestions({ questions: items });
      setBulkStatus(`✅ Successfully imported ${res.data?.data?.count || items.length} questions into database!`);
      setJsonInput("");
      fetchQuestions();
    } catch (err) {
      setBulkStatus(`❌ Error: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        if (file.name.endsWith(".json")) {
          setJsonInput(text);
        } else if (file.name.endsWith(".csv")) {
          const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
          const header = lines[0].split(",").map((h) => h.trim().toLowerCase());

          const qIdx = header.indexOf("questiontext") !== -1 ? header.indexOf("questiontext") : header.indexOf("question");
          const kIdx = header.indexOf("keywords");
          const aIdx = header.indexOf("referenceanswer") !== -1 ? header.indexOf("referenceanswer") : header.indexOf("answer");
          const tIdx = header.indexOf("tags");

          const parsedList = lines.slice(1).map((line) => {
            const parts = line.split(",").map((p) => p.replace(/^"|"$/g, "").trim());
            return {
              questionText: qIdx !== -1 ? parts[qIdx] : parts[0],
              keywords: kIdx !== -1 ? parts[kIdx] : parts[1] || "",
              referenceAnswer: aIdx !== -1 ? parts[aIdx] : parts[2] || "",
              tags: tIdx !== -1 ? parts[tIdx] : "technical",
            };
          }).filter((item) => Boolean(item.questionText));

          setJsonInput(JSON.stringify(parsedList, null, 2));
        }
      } catch (err) {
        alert("Failed to parse file: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleDeleteQuestion = async (id) => {
    if (!window.confirm("Are you sure you want to delete this question?")) return;
    try {
      await adminApi.deleteQuestion(id);
      fetchQuestions();
    } catch (err) {
      alert("Failed to delete question.");
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F5F0] text-[#161615] p-6 lg:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#E2DFD8] pb-6">
          <div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-blue-50 text-[#1D5DFF] border border-blue-100">
              Faculty & Admin Workspace
            </span>
            <h1 className="text-3xl font-extrabold text-[#161615] tracking-tight mt-2">
              Placement Drive Rules & Question Bank Manager
            </h1>
            <p className="text-xs text-[#6E6D68] mt-1">
              Configure custom interview rules, manage college question banks, toggle default fallbacks, and upload CSV/JSON question files.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/faculty/reports"
              className="px-5 py-2.5 bg-[#1D5DFF] hover:bg-blue-600 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 shadow-md"
            >
              <span>📊</span> View Student Reports & Roster →
            </Link>
          </div>
        </div>

        {/* Workspace Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[#E2DFD8] pb-1">
          <button
            onClick={() => setActiveTab("drives")}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center gap-2 ${
              activeTab === "drives"
                ? "bg-[#1D5DFF] text-white shadow-md"
                : "bg-white text-[#6E6D68] border border-[#E2DFD8] hover:bg-[#FAF9F5]"
            }`}
          >
            <span>⚡</span> Placement Drive Settings
          </button>

          <button
            onClick={() => setActiveTab("single")}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center gap-2 ${
              activeTab === "single"
                ? "bg-[#1D5DFF] text-white shadow-md"
                : "bg-white text-[#6E6D68] border border-[#E2DFD8] hover:bg-[#FAF9F5]"
            }`}
          >
            <span>📝</span> Add Single Question
          </button>

          <button
            onClick={() => setActiveTab("bulk")}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center gap-2 ${
              activeTab === "bulk"
                ? "bg-[#1D5DFF] text-white shadow-md"
                : "bg-white text-[#6E6D68] border border-[#E2DFD8] hover:bg-[#FAF9F5]"
            }`}
          >
            <span>📁</span> Bulk CSV / JSON Upload
          </button>
        </div>

        {/* Tab 1: Drive Creation & Custom Rules Workspace */}
        {activeTab === "drives" && (
          <Card className="bg-white border border-[#E2DFD8] rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-[#E2DFD8] pb-3">
              <h2 className="text-base font-bold text-[#161615]">
                Configure Placement Drive & Interview Settings
              </h2>
              <span className="text-xs text-[#6E6D68]">Faculty Authority Settings</span>
            </div>

            <form onSubmit={handleCreateDrive} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#6E6D68] uppercase tracking-wider mb-1">
                    Drive / Company Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TCS Technical Placement 2026"
                    value={driveForm.driveName}
                    onChange={(e) => setDriveForm({ ...driveForm, driveName: e.target.value })}
                    className="w-full p-3 rounded-xl border border-[#E2DFD8] bg-[#FAF9F5] text-xs focus:outline-none focus:border-[#1D5DFF]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#6E6D68] uppercase tracking-wider mb-1">
                    Drive Access Code (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TCS-2026 (Auto-generated if blank)"
                    value={driveForm.driveCode}
                    onChange={(e) => setDriveForm({ ...driveForm, driveCode: e.target.value })}
                    className="w-full p-3 rounded-xl border border-[#E2DFD8] bg-[#FAF9F5] text-xs font-mono focus:outline-none focus:border-[#1D5DFF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#6E6D68] uppercase tracking-wider mb-1">
                    Target Engineering Role
                  </label>
                  <select
                    value={driveForm.role}
                    onChange={(e) => setDriveForm({ ...driveForm, role: e.target.value })}
                    className="w-full p-3 rounded-xl border border-[#E2DFD8] bg-[#FAF9F5] text-xs focus:outline-none focus:border-[#1D5DFF]"
                  >
                    <option value="Frontend Engineer">Frontend Engineer</option>
                    <option value="Backend Engineer">Backend Engineer</option>
                    <option value="Fullstack Engineer">Fullstack Engineer</option>
                    <option value="Data Engineer">Data Engineer</option>
                    <option value="General Systems Engineer">General Systems Engineer</option>
                  </select>
                </div>
              </div>

              {/* Assessment Rules & Question Sources Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#FAF9F5] p-5 rounded-2xl border border-[#E2DFD8]">
                
                {/* Rule A: Question Bank Source */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-[#161615] block">Question Source Option</span>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-[#161615]">
                    <input
                      type="radio"
                      name="qSource"
                      checked={driveForm.useDefaultQuestions}
                      onChange={() => setDriveForm({ ...driveForm, useDefaultQuestions: true })}
                      className="accent-[#1D5DFF]"
                    />
                    <span>Use System Default Question Bank (Seeded OS/DBMS/DS)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-[#161615]">
                    <input
                      type="radio"
                      name="qSource"
                      checked={!driveForm.useDefaultQuestions}
                      onChange={() => setDriveForm({ ...driveForm, useDefaultQuestions: false })}
                      className="accent-[#1D5DFF]"
                    />
                    <span>Use Custom Faculty Uploaded Questions First</span>
                  </label>
                </div>

                {/* Rule B: Writing Test Toggle */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-[#161615] block">Writing Assessment</span>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-[#161615]">
                    <input
                      type="checkbox"
                      checked={driveForm.includeWritingTest}
                      onChange={(e) => setDriveForm({ ...driveForm, includeWritingTest: e.target.checked })}
                      className="w-4 h-4 accent-[#1D5DFF]"
                    />
                    <span>Include Technical Written Test after Verbal Interview</span>
                  </label>
                </div>

                {/* Rule C: Question Count */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-[#161615] block">Verbal Questions Per Student</span>
                  <select
                    value={driveForm.questionCount}
                    onChange={(e) => setDriveForm({ ...driveForm, questionCount: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-[#E2DFD8] bg-white text-xs font-mono"
                  >
                    <option value={3}>3 Verbal Questions</option>
                    <option value={5}>5 Verbal Questions (Recommended)</option>
                    <option value={10}>10 Verbal Questions</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                {createdCode ? (
                  <div className="text-xs font-mono text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                    Active Share Code: <strong>{createdCode}</strong> (Link: <code>http://localhost:5173/drive/{createdCode}</code>)
                  </div>
                ) : <div />}

                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#1D5DFF] hover:bg-blue-600 text-white rounded-xl text-xs font-semibold transition-colors shadow-md"
                >
                  Create & Activate Placement Drive →
                </button>
              </div>
            </form>
          </Card>
        )}

        {/* Tab 2: Single Question Form */}
        {activeTab === "single" && (
          <Card className="bg-white border border-[#E2DFD8] rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-[#161615]">Add Custom Question to MongoDB</h2>
            <form onSubmit={handleCreateSingleQuestion} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#6E6D68] uppercase tracking-wider mb-1">
                  Question Text *
                </label>
                <textarea
                  value={singleForm.questionText}
                  onChange={(e) => setSingleForm({ ...singleForm, questionText: e.target.value })}
                  placeholder="e.g. What is deadlock, and what conditions are needed for it to occur?"
                  className="w-full p-3 rounded-xl border border-[#E2DFD8] bg-[#FAF9F5] text-sm focus:outline-none focus:border-[#1D5DFF]"
                  rows={3}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#6E6D68] uppercase tracking-wider mb-1">
                    Expected Concept Keywords (Comma separated)
                  </label>
                  <input
                    type="text"
                    value={singleForm.keywords}
                    onChange={(e) => setSingleForm({ ...singleForm, keywords: e.target.value })}
                    placeholder="e.g. mutual exclusion, hold and wait, circular wait"
                    className="w-full p-3 rounded-xl border border-[#E2DFD8] bg-[#FAF9F5] text-sm focus:outline-none focus:border-[#1D5DFF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#6E6D68] uppercase tracking-wider mb-1">
                    Domain Tags (Comma separated)
                  </label>
                  <input
                    type="text"
                    value={singleForm.tags}
                    onChange={(e) => setSingleForm({ ...singleForm, tags: e.target.value })}
                    placeholder="e.g. os, operating-systems, technical"
                    className="w-full p-3 rounded-xl border border-[#E2DFD8] bg-[#FAF9F5] text-sm focus:outline-none focus:border-[#1D5DFF]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6E6D68] uppercase tracking-wider mb-1">
                  Reference Answer / Ideal Evaluation Response (Optional)
                </label>
                <textarea
                  value={singleForm.referenceAnswer}
                  onChange={(e) => setSingleForm({ ...singleForm, referenceAnswer: e.target.value })}
                  placeholder="Ideal technical response breakdown for AI evaluator..."
                  className="w-full p-3 rounded-xl border border-[#E2DFD8] bg-[#FAF9F5] text-sm focus:outline-none focus:border-[#1D5DFF]"
                  rows={2}
                />
              </div>

              <div className="pt-2">
                <Button type="submit" className="bg-[#1D5DFF] text-white px-6 py-2.5 rounded-xl font-medium text-sm">
                  Save Question to Database
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Tab 3: Bulk Import Workspace */}
        {activeTab === "bulk" && (
          <Card className="bg-white border border-[#E2DFD8] rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-[#161615]">Bulk Question Import (CSV / JSON)</h2>
            <p className="text-xs text-[#6E6D68]">
              Upload a <code>.json</code> or <code>.csv</code> file containing multiple interview questions to import them into MongoDB at once.
            </p>

            <div className="border-2 border-dashed border-[#E2DFD8] bg-[#FAF9F5] rounded-xl p-6 text-center hover:border-[#1D5DFF] transition-colors">
              <input
                type="file"
                accept=".csv,.json"
                onChange={handleFileUpload}
                className="hidden"
                id="bulk-file-input-clean"
              />
              <label htmlFor="bulk-file-input-clean" className="cursor-pointer flex flex-col items-center">
                <span className="text-2xl mb-2">📄</span>
                <span className="text-sm font-semibold text-[#161615]">Click to select CSV or JSON file</span>
                <span className="text-xs text-[#6E6D68] mt-1">Supports fields: questionText, keywords, referenceAnswer, tags</span>
              </label>
            </div>

            {jsonInput && (
              <div>
                <label className="block text-xs font-semibold text-[#6E6D68] uppercase tracking-wider mb-1">
                  JSON Payload Preview
                </label>
                <textarea
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#E2DFD8] bg-[#161615] text-[#F0EEE8] font-mono text-xs focus:outline-none"
                  rows={8}
                />
              </div>
            )}

            {bulkStatus && (
              <div className="p-3 rounded-xl bg-[#FAF9F5] border border-[#E2DFD8] text-xs font-mono">
                {bulkStatus}
              </div>
            )}

            <div className="pt-2">
              <button
                onClick={handleBulkSubmit}
                disabled={!jsonInput}
                className="bg-[#1D5DFF] hover:bg-blue-600 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-medium text-sm transition-colors shadow-md"
              >
                Execute Bulk Import to MongoDB
              </button>
            </div>
          </Card>
        )}

        {/* MongoDB Question List Workspace */}
        <Card className="bg-white border border-[#E2DFD8] rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#E2DFD8] pb-3">
            <div>
              <h2 className="text-base font-bold text-[#161615]">
                Active MongoDB Question Bank ({questions.length} Questions)
              </h2>
              <span className="text-xs text-[#6E6D68]">Questions stored in MongoDB for interview practice</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Search database questions..."
                value={questionSearch}
                onChange={(e) => setQuestionSearch(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-[#E2DFD8] bg-[#FAF9F5] text-xs focus:outline-none w-full sm:w-64"
              />
            </div>
          </div>

          {loadingQuestions ? (
            <div className="py-8 text-center text-xs text-[#6E6D68]">Loading questions from MongoDB...</div>
          ) : questions.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#6E6D68]">No questions found in MongoDB matching your search.</div>
          ) : (
            <div className="divide-y divide-[#E2DFD8] max-h-[500px] overflow-y-auto pr-1">
              {questions.map((q) => (
                <div key={q._id} className="py-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="font-semibold text-xs text-[#161615] leading-relaxed">
                      {q.questionText}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-[#6E6D68]">
                      <span className="font-mono bg-[#FAF9F5] px-2 py-0.5 rounded border border-[#E2DFD8]">
                        College: {q.college || "Global (Default)"}
                      </span>
                      {q.tags && q.tags.map((t, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded bg-blue-50 text-[#1D5DFF] font-mono">
                          #{t}
                        </span>
                      ))}
                    </div>

                    {q.keywords && q.keywords.length > 0 && (
                      <div className="text-[11px] text-[#6E6D68]">
                        <span className="font-medium text-[#161615]">Keywords: </span>
                        {q.keywords.join(", ")}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleDeleteQuestion(q._id)}
                    className="px-3 py-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-medium transition-colors"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

      </div>
    </div>
  );
}
