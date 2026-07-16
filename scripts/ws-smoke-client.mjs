import WebSocket from "ws";

const ws = new WebSocket("ws://127.0.0.1:4317/ws?projectId=proj_Agentia");
ws.on("open", () => console.log("[client] connected"));
ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type === "EVENT") {
    console.log(`[client] EVENT seq=${msg.seq} agent=${msg.event.agentId} type=${msg.event.eventType} state=${msg.event.status} msg="${msg.event.message}"`);
  } else {
    console.log(`[client] ${msg.type}`, msg.type === "SNAPSHOT" ? JSON.stringify(msg.employees) : "");
  }
});
ws.on("close", () => console.log("[client] closed"));
setTimeout(() => process.exit(0), 8000);
