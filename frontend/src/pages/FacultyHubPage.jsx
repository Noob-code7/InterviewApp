import { Link } from "react-router-dom";

const PORTAL_ITEMS = [
  {
    to: "/faculty/dashboard",
    tag: "DRIVES & CONFIG",
    label: "Placement Drives & Configuration",
    desc: "Configure placement drive codes (e.g. TCS-2026), customize question counts, toggle written assessment rubrics, and assign custom question banks.",
    action: "Configure Drives →",
  },
  {
    to: "/admin/questions",
    tag: "QUESTION REPOSITORY",
    label: "Question Bank & Bulk Upload",
    desc: "Create single technical questions with keyword rubrics, or drag & drop bulk CSV / JSON files directly into the MongoDB question database.",
    action: "Manage Question Bank →",
  },
  {
    to: "/faculty/reports",
    tag: "STUDENT ROSTER",
    label: "Student Roster & Proctoring Reports",
    desc: "Monitor student candidates by Name, Roll Number, and Department. Audit visual biometric proctoring alerts and export CSV placement rosters.",
    action: "View Student Roster →",
  },
];

export default function FacultyHubPage() {
  return (
    <div className="min-h-screen bg-[#F6F5F0] text-[#111110] font-sans pt-10 pb-20 px-6">
      <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">

        {/* Header Hero */}
        <div className="bg-white border border-[#E0DFD9] rounded-2xl p-6 sm:p-8 shadow-sm">
          <span className="font-mono text-xs font-bold uppercase text-[#1D5DFF] tracking-wider block mb-1">
            FACULTY & ADMINISTRATIVE WORKSPACE
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#111110] tracking-tight">
            College Assessment & Placement Portal
          </h1>
          <p className="text-sm text-[#4B5563] font-medium mt-2 max-w-2xl leading-relaxed">
            Centralized orchestration hub for campus recruitment drives, custom departmental question banks, and candidate proctoring evaluation records.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PORTAL_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="bg-white border border-[#E0DFD9] hover:border-[#111110] rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-6 card-hover group"
            >
              <div className="space-y-3">
                <span className="font-mono text-[10px] font-bold uppercase px-2.5 py-1 rounded bg-[#FAF9F5] text-[#111110] border border-[#E0DFD9] inline-block">
                  {item.tag}
                </span>
                <h2 className="text-lg font-bold text-[#111110] group-hover:text-[#1D5DFF] transition-colors leading-snug">
                  {item.label}
                </h2>
                <p className="text-xs text-[#4B5563] font-medium leading-relaxed">
                  {item.desc}
                </p>
              </div>

              <div className="text-xs font-bold text-[#1D5DFF] group-hover:translate-x-1 transition-transform pt-2 border-t border-[#E0DFD9]">
                {item.action}
              </div>
            </Link>
          ))}
        </div>

        {/* Access Note */}
        <div className="p-5 bg-white border border-[#E0DFD9] rounded-xl flex items-center justify-between gap-4">
          <div className="text-xs text-[#4B5563] font-medium">
            Placement drives synchronize directly with candidate session parameters. Questions uploaded here take precedence during student interviews.
          </div>
          <span className="font-mono text-[10px] font-bold text-[#1D5DFF] bg-blue-50 border border-blue-200 px-2.5 py-1 rounded shrink-0">
            SYSTEM ACTIVE
          </span>
        </div>

      </div>
    </div>
  );
}
