import { Link } from "react-router-dom";
import { Card } from "../components/ui/index.js";

export default function FacultyHubPage() {
  return (
    <div className="min-h-screen bg-[#F6F5F0] text-[#161615] p-6 lg:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* Header Hero Section */}
        <div className="bg-white border border-[#E2DFD8] rounded-3xl p-8 shadow-sm space-y-3">
          <span className="px-3.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-blue-50 text-[#1D5DFF] border border-blue-100">
            Faculty & Administrative Command Portal
          </span>
          <h1 className="text-3xl lg:text-4xl font-extrabold text-[#161615] tracking-tight">
            College Assessment & Placement Portal
          </h1>
          <p className="text-sm text-[#6E6D68] max-w-3xl leading-relaxed">
            Centralized hub for college faculty and placement officers. Configure custom drive rules, upload specialized question banks, monitor real-time candidate scores, and manage proctoring security flags.
          </p>
        </div>

        {/* Quick Navigation Cards Grid (Connecting All Pages) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Feature 1: Drive Settings */}
          <Link to="/faculty/dashboard" className="group">
            <Card className="bg-white border border-[#E2DFD8] rounded-2xl p-6 shadow-sm group-hover:border-[#1D5DFF] group-hover:shadow-md transition-all h-full flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#1D5DFF] flex items-center justify-center text-2xl font-bold">
                  ⚡
                </div>
                <h2 className="text-lg font-bold text-[#161615] group-hover:text-[#1D5DFF] transition-colors">
                  Placement Drive & Settings
                </h2>
                <p className="text-xs text-[#6E6D68] leading-relaxed">
                  Configure custom placement test codes (e.g. <code>TCS-2026</code>), set question counts, toggle writing tests, and select question sources.
                </p>
              </div>

              <div className="text-xs font-bold text-[#1D5DFF] flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                Configure Drives →
              </div>
            </Card>
          </Link>

          {/* Feature 2: Question Bank Manager */}
          <Link to="/admin/questions" className="group">
            <Card className="bg-white border border-[#E2DFD8] rounded-2xl p-6 shadow-sm group-hover:border-[#1D5DFF] group-hover:shadow-md transition-all h-full flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-2xl font-bold">
                  📝
                </div>
                <h2 className="text-lg font-bold text-[#161615] group-hover:text-[#1D5DFF] transition-colors">
                  Question Bank & Bulk Upload
                </h2>
                <p className="text-xs text-[#6E6D68] leading-relaxed">
                  Add single questions with concept keywords, or drag & drop bulk <code>.csv</code> / <code>.json</code> question files into MongoDB.
                </p>
              </div>

              <div className="text-xs font-bold text-[#1D5DFF] flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                Manage Question Bank →
              </div>
            </Card>
          </Link>

          {/* Feature 3: Roster & Student Reports */}
          <Link to="/faculty/reports" className="group">
            <Card className="bg-white border border-[#E2DFD8] rounded-2xl p-6 shadow-sm group-hover:border-[#1D5DFF] group-hover:shadow-md transition-all h-full flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl font-bold">
                  📊
                </div>
                <h2 className="text-lg font-bold text-[#161615] group-hover:text-[#1D5DFF] transition-colors">
                  Student Roster & Reports
                </h2>
                <p className="text-xs text-[#6E6D68] leading-relaxed">
                  View student candidates by Name, Roll Number, and Department. Monitor proctoring security flags and export placement CSV rosters.
                </p>
              </div>

              <div className="text-xs font-bold text-[#1D5DFF] flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                View Roster & Reports →
              </div>
            </Card>
          </Link>

        </div>

        {/* Comprehensive Faculty User Manual & Operational Documentation */}
        <div className="bg-white border border-[#E2DFD8] rounded-3xl p-8 shadow-sm space-y-8">
          <div className="border-b border-[#E2DFD8] pb-4">
            <span className="text-xs font-bold text-[#1D5DFF] uppercase tracking-wider">Official Operational Guide</span>
            <h2 className="text-2xl font-extrabold text-[#161615] tracking-tight mt-1">
              Faculty Feature Manual & Workflow Documentation
            </h2>
            <p className="text-xs text-[#6E6D68] mt-1">
              Step-by-step instructions for managing college drives, uploading custom questions, and evaluating student performance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Guide Section 1 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-bold text-sm text-[#161615]">
                <span className="w-6 h-6 rounded-full bg-[#161615] text-white flex items-center justify-center text-xs">1</span>
                <span>Placement Drives & Access Codes</span>
              </div>
              <p className="text-xs text-[#6E6D68] leading-relaxed">
                Create custom placement drive codes (e.g. <code>TCS-MOCK-2026</code>). You can specify whether students take a technical writing test after verbal questions, set question counts (3, 5, 10), and toggle between system default questions or custom faculty questions.
              </p>
              <div className="bg-[#FAF9F5] p-3 rounded-xl border border-[#E2DFD8] text-[11px] text-[#6E6D68]">
                💡 <strong>Tip:</strong> Share the generated link <code>http://localhost:5173/drive/CODE</code> directly with your class.
              </div>
            </div>

            {/* Guide Section 2 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-bold text-sm text-[#161615]">
                <span className="w-6 h-6 rounded-full bg-[#161615] text-white flex items-center justify-center text-xs">2</span>
                <span>Question Bank & Keyword Matching</span>
              </div>
              <p className="text-xs text-[#6E6D68] leading-relaxed">
                Add single questions or upload bulk <code>.csv</code> / <code>.json</code> files containing explicit concept keywords (e.g., <code>["mutual exclusion", "circular wait"]</code>). The AI evaluator uses these keywords to score factual candidate accuracy automatically.
              </p>
              <div className="bg-[#FAF9F5] p-3 rounded-xl border border-[#E2DFD8] text-[11px] text-[#6E6D68]">
                💡 <strong>CSV Template:</strong> <code>questionText,keywords,referenceAnswer,tags</code>
              </div>
            </div>

            {/* Guide Section 3 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-bold text-sm text-[#161615]">
                <span className="w-6 h-6 rounded-full bg-[#161615] text-white flex items-center justify-center text-xs">3</span>
                <span>Student Roster & Proctoring Flags</span>
              </div>
              <p className="text-xs text-[#6E6D68] leading-relaxed">
                In the Roster section, students are listed by **Full Name**, **Roll Number**, and **Department**. Look for 🚨 <strong>Mismatch Flags</strong> if DeepFace detected potential face substitution or multiple people during recording.
              </p>
              <div className="bg-[#FAF9F5] p-3 rounded-xl border border-[#E2DFD8] text-[11px] text-[#6E6D68]">
                💡 <strong>Export:</strong> Click "Export Roster (CSV)" to download placement records.
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
