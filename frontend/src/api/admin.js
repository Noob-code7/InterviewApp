import api from "./axios.js";

export const adminApi = {
  createQuestion: (payload) => api.post("/api/admin/questions", payload),
  listQuestions: (params) => api.get("/api/admin/questions", { params }),
  getQuestion: (id) => api.get(`/api/admin/questions/${id}`),
  updateQuestion: (id, payload) =>
    api.put(`/api/admin/questions/${id}`, payload),
  deleteQuestion: (id) => api.delete(`/api/admin/questions/${id}`),
};
