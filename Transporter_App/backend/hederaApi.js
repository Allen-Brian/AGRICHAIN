// mobile/services/hederaApi.js
export async function createTopic(job) {
  const res = await fetch("https://your-server.com/createTopic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(job)
  });
  return res.json();
}

export async function submitReceipt(topicId, message) {
  const res = await fetch("https://your-server.com/submitReceipt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topicId, message })
  });
  return res.json();
}
