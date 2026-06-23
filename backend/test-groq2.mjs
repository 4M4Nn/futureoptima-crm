const response = await fetch('https://api.groq.com/openai/v1/models', {
  headers: { 
    'Authorization': 'Bearer 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'
  }
});
const text = await response.text();
console.log('Status:', response.status);
console.log('OK:', response.ok);
console.log('Raw:', text.substring(0, 500));
const data = JSON.parse(text);
console.log('Models count:', data.data?.length);
console.log('First model:', data.data?.[0]?.id);
