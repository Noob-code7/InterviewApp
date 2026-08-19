import { useState, useEffect } from "react";



import { adminApi } from "../api/admin.js";



import { Button, Card } from "../components/ui/index.js";







export default function AdminQuestionsPage() {



  const [questions, setQuestions] = useState([]);



  const [filterCollege, setFilterCollege] = useState("");



  const [searchQuery, setSearchQuery] = useState("");



  const [loading, setLoading] = useState(false);



  const [activeTab, setActiveTab] = useState("single"); // 'single' | 'bulk'







  // Single Question Form State



  const [form, setForm] = useState({



    questionText: "",



    referenceAnswer: "",



    keywords: "",



    tags: "technical",



    college: "",



  });







  // Bulk JSON Upload State



  const [jsonInput, setJsonInput] = useState("");



  const [bulkStatus, setBulkStatus] = useState("");







  const fetchQuestions = async () => {



    setLoading(true);



    try {



      const { data } = await adminApi.listQuestions({



        college: filterCollege || undefined,



        q: searchQuery || undefined,



      });



      setQuestions(data.data.questions || []);



    } catch (err) {



      console.error("Failed to fetch questions:", err);



    } finally {



      setLoading(false);



    }



  };







  useEffect(() => {



    fetchQuestions();



  }, [filterCollege, searchQuery]);







  const onCreateSingle = async (e) => {



    e.preventDefault();



    if (!form.questionText.trim()) return;







    try {



      await adminApi.createQuestion({



        questionText: form.questionText,



        referenceAnswer: form.referenceAnswer,



        keywords: form.keywords,



        tags: form.tags,



        college: form.college || null,



      });







      setForm({



        questionText: "",



        referenceAnswer: "",



        keywords: "",



        tags: "technical",



        college: "",



      });







      alert("Question created successfully!");



      fetchQuestions();



    } catch (err) {



      console.error(err);



      alert(err.response?.data?.error || "Failed to create question");



    }



  };







  const onBulkSubmit = async (e) => {



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



      console.error("Bulk upload error:", err);



      setBulkStatus(` Error: ${err.response?.data?.error || err.message}`);



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



          // Parse basic CSV



          const lines = text.split("\n").map((l) =>l.trim()).filter(Boolean);



          const header = lines[0].split(",").map((h) =>h.trim().toLowerCase());



          



          const qIdx = header.indexOf("questiontext") !== -1 ? header.indexOf("questiontext") : header.indexOf("question");



          const kIdx = header.indexOf("keywords");



          const aIdx = header.indexOf("referenceanswer") !== -1 ? header.indexOf("referenceanswer") : header.indexOf("answer");



          const tIdx = header.indexOf("tags");







          const parsedList = lines.slice(1).map((line) => {



            const parts = line.split(",").map((p) =>p.replace(/^"|"$/g, "").trim());



            return {



              questionText: qIdx !== -1 ? parts[qIdx] : parts[0],



              keywords: kIdx !== -1 ? parts[kIdx] : parts[1] || "",



              referenceAnswer: aIdx !== -1 ? parts[aIdx] : parts[2] || "",



              tags: tIdx !== -1 ? parts[tIdx] : "technical",



            };



          }).filter((item) =>Boolean(item.questionText));







          setJsonInput(JSON.stringify(parsedList, null, 2));



        }



      } catch (parseErr) {



        alert("Failed to parse file: " + parseErr.message);



      }



    };



    reader.readAsText(file);



  };







  const onDelete = async (id) => {



    if (!window.confirm("Are you sure you want to delete this question?")) return;



    try {



      await adminApi.deleteQuestion(id);



      fetchQuestions();



    } catch (err) {



      alert("Failed to delete question");



    }



  };







  return (



    <div className="min-h-screen bg-[#F6F5F0] text-[#161615] p-6 lg:p-10">



      <div className="max-w-6xl mx-auto space-y-8">



        



        {/* Header */}



        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#E2DFD8] pb-6">



          <div>



            <h1 className="text-3xl font-bold text-[#161615] tracking-tight">Faculty & Admin  Question Bank Manager



            </h1>



            <p className="text-sm text-[#6E6D68] mt-1">Upload custom college question banks with explicit concept keywords. Student practice sessions will prioritize your uploaded questions!



            </p>



          </div>



          



          <div className="flex items-center gap-2">



            <button



              onClick={() =>setActiveTab("single")}



              className={`px-4 py-2 rounded-xl font-medium text-xs transition-colors ${



                activeTab === "single"



                  ? "bg-[#1D5DFF] text-white shadow-md"



                  : "bg-white text-[#6E6D68] border border-[#E2DFD8] hover:bg-[#FAF9F5]"



              }`}



            >



              + Single Question



            </button>



            <button



              onClick={() =>setActiveTab("bulk")}



              className={`px-4 py-2 rounded-xl font-medium text-xs transition-colors ${



                activeTab === "bulk"



                  ? "bg-[#1D5DFF] text-white shadow-md"



                  : "bg-white text-[#6E6D68] border border-[#E2DFD8] hover:bg-[#FAF9F5]"



              }`}



            >Bulk CSV / JSON Upload



            </button>



          </div>



        </div>







        {/* Upload Workspace */}



        {activeTab === "single" ? (



          <Card className="bg-white border border-[#E2DFD8] rounded-2xl p-6 shadow-sm">



            <h2 className="text-lg font-bold text-[#161615] mb-4">Add Custom Question</h2>



            <form onSubmit={onCreateSingle} className="space-y-4">



              <div>



                <label className="block text-xs font-semibold text-[#6E6D68] uppercase tracking-wider mb-1">Question Text *



                </label>



                <textarea



                  value={form.questionText}



                  onChange={(e) =>setForm({ ...form, questionText: e.target.value })}



                  placeholder="e.g. What is deadlock, and what conditions are needed for it to occur?"



                  className="w-full p-3 rounded-xl border border-[#E2DFD8] bg-[#FAF9F5] text-sm focus:outline-none focus:border-[#1D5DFF]"



                  rows={3}



                  required



                />



              </div>







              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">



                <div>



                  <label className="block text-xs font-semibold text-[#6E6D68] uppercase tracking-wider mb-1">Expected Concept Keywords (Comma separated)



                  </label>



                  <input



                    type="text"



                    value={form.keywords}



                    onChange={(e) =>setForm({ ...form, keywords: e.target.value })}



                    placeholder="e.g. mutual exclusion, hold and wait, circular wait"



                    className="w-full p-3 rounded-xl border border-[#E2DFD8] bg-[#FAF9F5] text-sm focus:outline-none focus:border-[#1D5DFF]"



                  />



                </div>







                <div>



                  <label className="block text-xs font-semibold text-[#6E6D68] uppercase tracking-wider mb-1">Domain Tags (Comma separated)



                  </label>



                  <input



                    type="text"



                    value={form.tags}



                    onChange={(e) =>setForm({ ...form, tags: e.target.value })}



                    placeholder="e.g. os, operating-systems, technical"



                    className="w-full p-3 rounded-xl border border-[#E2DFD8] bg-[#FAF9F5] text-sm focus:outline-none focus:border-[#1D5DFF]"



                  />



                </div>



              </div>







              <div>



                <label className="block text-xs font-semibold text-[#6E6D68] uppercase tracking-wider mb-1">Reference Answer / Evaluation Guide (Optional)



                </label>



                <textarea



                  value={form.referenceAnswer}



                  onChange={(e) =>setForm({ ...form, referenceAnswer: e.target.value })}



                  placeholder="Ideal technical response breakdown for AI evaluator..."



                  className="w-full p-3 rounded-xl border border-[#E2DFD8] bg-[#FAF9F5] text-sm focus:outline-none focus:border-[#1D5DFF]"



                  rows={2}



                />



              </div>







              <div>



                <label className="block text-xs font-semibold text-[#6E6D68] uppercase tracking-wider mb-1">Target College Identifier (Leave blank for global)



                </label>



                <input



                  type="text"



                  value={form.college}



                  onChange={(e) =>setForm({ ...form, college: e.target.value })}



                  placeholder="e.g. MIT, IIT Bombay (Defaults to your user college)"



                  className="w-full p-3 rounded-xl border border-[#E2DFD8] bg-[#FAF9F5] text-sm focus:outline-none focus:border-[#1D5DFF]"



                />



              </div>







              <div className="pt-2">



                <Button type="submit" className="bg-[#1D5DFF] text-white px-6 py-2.5 rounded-xl font-medium text-sm">Save Question to Database



                </Button>



              </div>



            </form>



          </Card>



        ) : (



          <Card className="bg-white border border-[#E2DFD8] rounded-2xl p-6 shadow-sm space-y-4">



            <h2 className="text-lg font-bold text-[#161615]">Bulk Question Import (CSV / JSON)</h2>



            <p className="text-xs text-[#6E6D68]">Upload a <code>.json</code>or <code>.csv</code>file containing multiple interview questions to import them into MongoDB at once.



            </p>







            <div className="border-2 border-dashed border-[#E2DFD8] bg-[#FAF9F5] rounded-xl p-6 text-center hover:border-[#1D5DFF] transition-colors">



              <input



                type="file"



                accept=".csv,.json"



                onChange={handleFileUpload}



                className="hidden"



                id="bulk-file-input"



              />



              <label htmlFor="bulk-file-input" className="cursor-pointer flex flex-col items-center">



                <span className="text-2xl mb-2"></span>



                <span className="text-sm font-semibold text-[#161615]">Click to select CSV or JSON file</span>



                <span className="text-xs text-[#6E6D68] mt-1">Supports fields: questionText, keywords, referenceAnswer, tags</span>



              </label>



            </div>







            {jsonInput && (



              <div>



                <label className="block text-xs font-semibold text-[#6E6D68] uppercase tracking-wider mb-1">JSON Preview / Payload



                </label>



                <textarea



                  value={jsonInput}



                  onChange={(e) =>setJsonInput(e.target.value)}



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



                onClick={onBulkSubmit}



                disabled={!jsonInput}



                className="bg-[#1D5DFF] hover:bg-blue-600 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-medium text-sm transition-colors shadow-md"



              >Execute Bulk Import to MongoDB



              </button>



            </div>



          </Card>



        )}







        {/* Existing Database Questions Table */}



        <Card className="bg-white border border-[#E2DFD8] rounded-2xl p-6 shadow-sm space-y-4">



          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">



            <h2 className="text-lg font-bold text-[#161615]">Active MongoDB Question Bank ({questions.length})



            </h2>







            <div className="flex flex-wrap gap-2 w-full md:w-auto">



              <input



                type="text"



                placeholder="Filter by college..."



                value={filterCollege}



                onChange={(e) =>setFilterCollege(e.target.value)}



                className="px-3 py-1.5 rounded-xl border border-[#E2DFD8] bg-[#FAF9F5] text-xs focus:outline-none"



              />



              <input



                type="text"



                placeholder="Search questions..."



                value={searchQuery}



                onChange={(e) =>setSearchQuery(e.target.value)}



                className="px-3 py-1.5 rounded-xl border border-[#E2DFD8] bg-[#FAF9F5] text-xs focus:outline-none"



              />



            </div>



          </div>







          {loading ? (



            <div className="py-8 text-center text-xs text-[#6E6D68]">Loading questions from MongoDB...</div>



          ) : questions.length === 0 ? (



            <div className="py-8 text-center text-xs text-[#6E6D68]">No questions found matching your filter criteria.</div>



          ) : (



            <div className="divide-y divide-[#E2DFD8]">



              {questions.map((q) => (



                <div key={q._id} className="py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">



                  <div className="space-y-1.5 flex-1">



                    <div className="font-semibold text-sm text-[#161615]">



                      {q.questionText}



                    </div>



                    



                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#6E6D68]">



                      <span className="px-2 py-0.5 rounded bg-[#FAF9F5] border border-[#E2DFD8] font-mono text-[10px]">College: {q.college || "Global (Default)"}



                      </span>



                      {q.tags && q.tags.map((t, idx) => (



                        <span key={idx} className="px-2 py-0.5 rounded bg-blue-50 text-[#1D5DFF] text-[10px] font-mono">



                          #{t}



                        </span>



                      ))}



                    </div>







                    {q.keywords && q.keywords.length >0 && (



                      <div className="text-xs text-[#6E6D68]">



                        <span className="font-medium text-[#161615]">Keywords: </span>



                        {q.keywords.join(", ")}



                      </div>



                    )}



                  </div>







                  <button



                    onClick={() =>onDelete(q._id)}



                    className="px-3 py-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-medium transition-colors"



                  >Delete



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



