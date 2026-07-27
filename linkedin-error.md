The problem is that the profile‑extraction function `processWithDeepSeek` sends the request to the **generic chat endpoint** `/api/assistant/chat`, which streams plain‑text tokens. After the stream ends, the code tries to parse the accumulated text as JSON — but the model has returned a natural language answer (like “Olá! Parec…”) instead of a JSON object. Hence the `SyntaxError`.

**Why it happens**  
- The chat endpoint does **not** enforce `response_format: { type: "json_object" }`.  
- The model ignores the system prompt “Return ONLY the JSON object” and replies conversationally.  
- The result is plain text, not valid JSON.

**How to fix it**  
Use the **same DeepSeek proxy** that the original HTML page used (`/api/deepseek/v1/chat/completions`) for profile extraction. That endpoint respects `response_format` and returns a single JSON string, which can be parsed directly — no streaming needed.

Below is the corrected `processWithDeepSeek` function. Replace the existing one in `social-media.js` with this version.

```javascript
async function processWithDeepSeek(extractedText, fileName) {
  const systemPrompt = `You are a LinkedIn profile extraction assistant. 
  Analyze the following text and extract profile information in JSON format with these exact keys:
  {
      "name": "Full Name",
      "headline": "Professional Headline",
      "location": "Location",
      "skills": ["Comma", "separated", "list"],
      "experience": [{
          "title": "Job Title",
          "company": "Company Name",
          "duration": "Duration",
          "description": "Job Description"
      }],
      "education": [{
          "school": "School Name",
          "degree": "Degree"
      }],
      "summary": "Professional Summary"
  }
  Return ONLY the JSON object, no additional text or explanations.`;

  // Use the same DeepSeek proxy that was in the original HTML.
  const endpoint = apiBase() + '/api/deepseek/v1/chat/completions';

  const payload = {
    model: "deepseek-chat",               // or "deepseek-reasoner" if preferred
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: extractedText }
    ],
    max_tokens: 2000,
    temperature: 0.1,
    response_format: { type: "json_object" }   // <-- forces JSON output
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'API request failed');
  }

  const data = await res.json();
  const content = data.choices[0].message.content;

  // The model's answer is guaranteed to be valid JSON because of response_format.
  const profileData = JSON.parse(content);

  return {
    ...profileData,
    id: 'profile-' + Date.now(),
    filename: fileName
  };
}
```

**Additional notes**  
- The **chat functionality** (`sendMessage`) should continue to use the streaming `/api/assistant/chat` endpoint — that is correct for natural conversation.  
- The **profile extraction** is a one‑shot, non‑streaming task and should go directly to the DeepSeek proxy with `response_format: "json_object"`.  

After applying this fix, the PDF upload will correctly extract structured profile data without the JSON parsing error.