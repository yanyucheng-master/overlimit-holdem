const { createAppServer } = require("../server/server");
const port = Number(process.env.BGM_PREVIEW_PORT || 4182);
const app = createAppServer();
app.httpServer.once("error", (error) => { console.error(error.message); process.exitCode = 1; });
app.httpServer.listen(port, "127.0.0.1", () => {
  console.log(`BGM game preview: http://127.0.0.1:${port}/`);
});
