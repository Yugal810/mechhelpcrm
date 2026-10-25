import app from "./index.js";
import { PORT } from "./config.js";

const port = PORT || 8000;

const server = app.listen(port, () => {
  console.log(`🚀 MechHelp API Server running at http://localhost:${port}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.log(`Port ${port} already in use, reusing running server.`);
  } else {
    console.error("Backend server error:", err);
  }
});
