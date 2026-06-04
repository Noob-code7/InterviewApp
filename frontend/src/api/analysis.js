import api from "./axios.js";

export const analysisApi = {
  transcribe: (formData) =>
    api.post("/api/analysis/voice", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  evaluate: (payload) => api.post("/api/analysis/evaluate", payload),
};
