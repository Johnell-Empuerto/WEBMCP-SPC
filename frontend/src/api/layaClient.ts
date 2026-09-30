import axios from "axios";

const apiLayaClient = axios.create({
  baseURL: import.meta.env.VITE_LAYA_API_URL || "/laya-api",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

export default apiLayaClient;
