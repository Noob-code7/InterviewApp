import { useState, useEffect } from "react";
import { adminApi } from "../api/admin.js";
import { Button, Card } from "../components/ui/index.js";

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState([]);
  const [form, setForm] = useState({
    questionText: "",
    referenceAnswer: "",
    keywords: "",
    college: "",
  });
  const [loading, setLoading] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.listQuestions();
      setQuestions(data.data.questions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, []);

  const onCreate = async (e) => {
    e.preventDefault();
    try {
      await adminApi.createQuestion({
        questionText: form.questionText,
        referenceAnswer: form.referenceAnswer,
        keywords: form.keywords,
        college: form.college,
      });
      setForm({
        questionText: "",
        referenceAnswer: "",
        keywords: "",
        college: "",
      });
      fetch();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl mb-4">Admin — Question Bank</h2>
      <Card className="p-4 mb-4">
        <form onSubmit={onCreate} className="space-y-3">
          <div>
            <label className="block text-sm">Question</label>
            <textarea
              value={form.questionText}
              onChange={(e) =>
                setForm((f) => ({ ...f, questionText: e.target.value }))
              }
              className="w-full p-2 border"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm">Reference answer</label>
            <textarea
              value={form.referenceAnswer}
              onChange={(e) =>
                setForm((f) => ({ ...f, referenceAnswer: e.target.value }))
              }
              className="w-full p-2 border"
              rows={2}
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-sm">
                Keywords (comma separated)
              </label>
              <input
                value={form.keywords}
                onChange={(e) =>
                  setForm((f) => ({ ...f, keywords: e.target.value }))
                }
                className="w-full p-2 border"
              />
            </div>
            <div className="w-48">
              <label className="block text-sm">College (optional)</label>
              <input
                value={form.college}
                onChange={(e) =>
                  setForm((f) => ({ ...f, college: e.target.value }))
                }
                className="w-full p-2 border"
              />
            </div>
          </div>
          <div>
            <Button type="submit">Create Question</Button>
          </div>
        </form>
      </Card>

      <Card className="p-4">
        <h3 className="text-lg mb-2">Existing Questions</h3>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <ul className="space-y-2">
            {questions.map((q) => (
              <li
                key={q._id}
                className="p-3 border rounded bg-white/5 flex justify-between items-start"
              >
                <div>
                  <div className="font-semibold">{q.questionText}</div>
                  <div className="text-xs text-slate-400">
                    College: {q.college || "global"}
                  </div>
                  <div className="text-xs text-slate-400">
                    Keywords: {q.keywords?.join(", ")}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      await adminApi.deleteQuestion(q._id);
                      fetch();
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
