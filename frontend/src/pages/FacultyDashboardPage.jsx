import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "../api/admin.js";

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
    alert(`Placement Drive "${driveForm.driveName || code}" created! Share code: ${code} with students.`);
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
      setBulkStatus(`Successfully imported ${res.data?.data?.count || items.length} questions into database!`);
      setJsonInput("");
      fetchQuestions();
    } catch (err) {
      setBulkStatus(`Error: ${err.response?.data?.error || err.message}`);
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

  const inputCls = "w-full bg-[#FAF9F5] border border-[#E0DFD9] px-4 py-3 text-sm text-[#111110] font-semibold placeholder:text-[#9CA3AF] rounded-lg focus:outline-none focus:bg-white focus:border-[#1D5DFF] focus:ring-2 focus:ring-[#1D5DFF]/15 transition-all";
  const labelCls = "block font-mono text-xs font-bold uppercase text-[#111110] tracking-wide mb-1.5";
  const selectCls = "w-full bg-[#FAF9F5] border border-[#E0DFD9] px-4 py-3 text-sm text-[#111110] font-semibold rounded-lg focus:outline-none focus:bg-white focus:border-[#1D5DFF] focus:ring-2 focus:ring-[#1D5DFF]/15 transition-all";

  return (
    <div className="min-h-screen bg-[#F6F5F0] text-[#111110] font-sans pt-10 pb-20 px-6">
      <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#E0DFD9] pb-6">
          <div>
            <span className="font-mono text-xs font-bold uppercase text-[#1D5DFF] tracking-wider block mb-1">
              FACULTY COMMAND DESK
            </span>
            <h1 className="text-3xl font-extrabold text-[#111110] tracking-tight">
              Placement Drives & Question Bank
            </h1>
            <p className="text-xs text-[#4B5563] font-medium mt-1">
              Configure placement drive rules, manage departmental question banks, and upload bulk question sets.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/faculty/reports"
              className="px-5 py-2.5 bg-[#111110] hover:bg-[#1D5DFF] text-white rounded-lg text-xs font-bold transition-all duration-200 shadow-sm active:scale-98"
            >
              View Student Roster →
            </Link>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[#E0DFD9] pb-2">
          {[
            { id: "drives", label: "PLACEMENT DRIVES" },
            { id: "single", label: "ADD SINGLE QUESTION" },
            { id: "bulk",   label: "BULK CSV / JSON UPLOAD" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-xs font-mono font-bold rounded-lg transition-all ${
                activeTab === tab.id
                  ? "bg-[#111110] text-white"
                  : "bg-white text-[#4B5563] border border-[#E0DFD9] hover:border-[#111110] hover:text-[#111110]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: PLACEMENT DRIVES */}
        {activeTab === "drives" && (
          <div className="bg-white border border-[#E0DFD9] rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="border-b border-[#E0DFD9] pb-4">
              <h2 className="text-xl font-extrabold text-[#111110]">Configure Placement Drive</h2>
              <p className="text-xs text-[#4B5563] font-medium mt-0.5">Students enter the drive code to take this customized interview format.</p>
            </div>

            <form onSubmit={handleCreateDrive} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div>
                  <label className={labelCls}>Drive / Company Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. TCS Technical Placement 2026"
                    value={driveForm.driveName}
                    onChange={(e) => setDriveForm({ ...driveForm, driveName: e.target.value })}
                    required
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Drive Access Code</label>
                  <input
                    type="text"
                    placeholder="e.g. TCS-2026"
                    value={driveForm.driveCode}
                    onChange={(e) => setDriveForm({ ...driveForm, driveCode: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Target Engineering Role</label>
                  <select
                    value={driveForm.role}
                    onChange={(e) => setDriveForm({ ...driveForm, role: e.target.value })}
                    className={selectCls}
                  >
                    <option value="Fullstack Engineer">Fullstack Engineer</option>
                    <option value="Frontend Engineer">Frontend Engineer</option>
                    <option value="Backend Engineer">Backend Engineer</option>
                    <option value="Data Engineer">Data Engineer</option>
                  </select>
                </div>
              </div>

              <div className="p-5 bg-[#FAF9F5] border border-[#E0DFD9] rounded-xl space-y-4">
                <span className="font-mono text-xs font-bold uppercase text-[#111110] tracking-wide block">
                  Question Source Selection
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="flex items-center gap-3 p-3.5 bg-white border border-[#E0DFD9] rounded-lg cursor-pointer hover:border-[#1D5DFF] transition-colors">
                    <input
                      type="radio"
                      name="qSource"
                      checked={driveForm.useDefaultQuestions}
                      onChange={() => setDriveForm({ ...driveForm, useDefaultQuestions: true })}
                      className="accent-[#1D5DFF]"
                    />
                    <div>
                      <div className="text-xs font-bold text-[#111110]">Default Syllabus Question Bank</div>
                      <div className="text-[11px] text-[#6B7280]">Seed OS, DBMS, OOP, and DSA questions</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3.5 bg-white border border-[#E0DFD9] rounded-lg cursor-pointer hover:border-[#1D5DFF] transition-colors">
                    <input
                      type="radio"
                      name="qSource"
                      checked={!driveForm.useDefaultQuestions}
                      onChange={() => setDriveForm({ ...driveForm, useDefaultQuestions: false })}
                      className="accent-[#1D5DFF]"
                    />
                    <div>
                      <div className="text-xs font-bold text-[#111110]">Custom Faculty Uploaded Bank</div>
                      <div className="text-[11px] text-[#6B7280]">Use college questions uploaded in MongoDB</div>
                    </div>
                  </label>
                </div>
              </div>

              {createdCode && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl font-mono text-xs font-bold">
                  ✓ Placement Drive Activated! Student Access Code: <span className="text-emerald-700 underline text-sm">{createdCode}</span>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="bg-[#111110] hover:bg-[#1D5DFF] text-white px-8 py-3 text-sm font-bold rounded-lg transition-all duration-200 shadow-sm active:scale-98"
                >
                  Create & Activate Placement Drive →
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 2: SINGLE QUESTION */}
        {activeTab === "single" && (
          <div className="bg-white border border-[#E0DFD9] rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="border-b border-[#E0DFD9] pb-4">
              <h2 className="text-xl font-extrabold text-[#111110]">Add Technical Question</h2>
              <p className="text-xs text-[#4B5563] font-medium mt-0.5">Define reference keywords and technical rubrics for automated NLP scoring.</p>
            </div>

            <form onSubmit={handleCreateSingleQuestion} className="space-y-5">
              <div>
                <label className={labelCls}>Question Prompt *</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Explain how indexing works in MongoDB and compare B-Trees vs. Hash indexes..."
                  value={singleForm.questionText}
                  onChange={(e) => setSingleForm({ ...singleForm, questionText: e.target.value })}
                  required
                  className="w-full bg-[#FAF9F5] border border-[#E0DFD9] p-4 text-sm text-[#111110] font-medium rounded-lg focus:outline-none focus:bg-white focus:border-[#1D5DFF] transition-all"
                />
              </div>

              <div>
                <label className={labelCls}>Expected Keywords / Concept Tokens (Comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. B-Tree, indexing, read overhead, compound index, balancing"
                  value={singleForm.keywords}
                  onChange={(e) => setSingleForm({ ...singleForm, keywords: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Model Reference Answer (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Reference answer used by evaluator to compare semantic depth..."
                  value={singleForm.referenceAnswer}
                  onChange={(e) => setSingleForm({ ...singleForm, referenceAnswer: e.target.value })}
                  className="w-full bg-[#FAF9F5] border border-[#E0DFD9] p-4 text-sm text-[#111110] font-medium rounded-lg focus:outline-none focus:bg-white focus:border-[#1D5DFF] transition-all"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="bg-[#111110] hover:bg-[#1D5DFF] text-white px-8 py-3 text-sm font-bold rounded-lg transition-all duration-200 shadow-sm active:scale-98"
                >
                  Save Question to Database →
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 3: BULK UPLOAD */}
        {activeTab === "bulk" && (
          <div className="bg-white border border-[#E0DFD9] rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="border-b border-[#E0DFD9] pb-4">
              <h2 className="text-xl font-extrabold text-[#111110]">Bulk Upload Questions</h2>
              <p className="text-xs text-[#4B5563] font-medium mt-0.5">Upload a CSV or JSON file to batch import multiple questions simultaneously.</p>
            </div>

            <div className="p-6 border-2 border-dashed border-[#D1D5DB] rounded-xl text-center bg-[#FAF9F5] hover:border-[#1D5DFF] transition-colors cursor-pointer">
              <input type="file" accept=".csv,.json" onChange={handleFileUpload} className="hidden" id="bulk-file-input" />
              <label htmlFor="bulk-file-input" className="cursor-pointer flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-xl bg-white border border-[#E0DFD9] flex items-center justify-center font-mono font-bold text-[#1D5DFF]">
                  CSV
                </div>
                <span className="text-xs font-bold text-[#111110]">Click to select .CSV or .JSON question file</span>
                <span className="text-[11px] text-[#6B7280]">Columns: questionText, keywords, referenceAnswer, tags</span>
              </label>
            </div>

            {bulkStatus && (
              <div className="p-4 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl font-mono text-xs font-bold">
                {bulkStatus}
              </div>
            )}

            <div>
              <label className={labelCls}>JSON Input Payload</label>
              <textarea
                rows={6}
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder='[ { "questionText": "What is normalization?", "keywords": "1NF, 2NF, BCNF", "tags": "dbms" } ]'
                className="w-full bg-[#FAF9F5] border border-[#E0DFD9] p-4 text-xs font-mono text-[#111110] rounded-lg focus:outline-none focus:bg-white focus:border-[#1D5DFF] transition-all"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleBulkSubmit}
                disabled={!jsonInput.trim()}
                className="bg-[#111110] hover:bg-[#1D5DFF] text-white px-8 py-3 text-sm font-bold rounded-lg transition-all duration-200 shadow-sm active:scale-98 disabled:opacity-40"
              >
                Execute Bulk Import →
              </button>
            </div>
          </div>
        )}

        {/* Existing Questions Table */}
        <div className="bg-white border border-[#E0DFD9] rounded-2xl p-6 sm:p-8 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E0DFD9] pb-4">
            <div>
              <h2 className="text-lg font-extrabold text-[#111110]">
                Active Question Bank ({questions.length} Questions)
              </h2>
              <p className="text-xs text-[#4B5563] font-medium">Stored in MongoDB question collection for candidate sessions.</p>
            </div>

            <input
              type="text"
              placeholder="Search questions..."
              value={questionSearch}
              onChange={(e) => setQuestionSearch(e.target.value)}
              className="px-4 py-2 border border-[#E0DFD9] bg-[#FAF9F5] rounded-lg text-xs font-semibold text-[#111110] focus:outline-none w-full sm:w-64"
            />
          </div>

          {loadingQuestions ? (
            <div className="py-12 text-center text-xs font-bold text-[#6B7280]">Loading questions...</div>
          ) : questions.length === 0 ? (
            <div className="py-12 text-center text-xs font-bold text-[#6B7280]">No questions found matching criteria.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E0DFD9] bg-[#FAF9F5] text-[#111110] font-mono text-[10px] uppercase font-bold">
                    <th className="py-3 px-4">Question Text</th>
                    <th className="py-3 px-4">Rubric Keywords</th>
                    <th className="py-3 px-4">Tag</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E0DFD9]">
                  {questions.slice(0, 15).map((q) => (
                    <tr key={q._id} className="hover:bg-[#FAF9F5] transition-colors">
                      <td className="py-3.5 px-4 font-bold text-[#111110] max-w-xs truncate">{q.questionText}</td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-[#4B5563] truncate max-w-[200px]">
                        {Array.isArray(q.keywords) ? q.keywords.join(", ") : q.keywords || "N/A"}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#FAF9F5] text-[#111110] border border-[#E0DFD9]">
                          {q.tags || "General"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleDeleteQuestion(q._id)}
                          className="text-xs font-bold text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
