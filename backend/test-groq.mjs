const response = await fetch('https://api.groq.com/openai/v1/models', {
  headers: { 
    'Authorization': 'Bearer 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'
  }
});
const data = await response.json();
console.log('Status:', response.status);
console.log('Models:', data.data?.length);
console.log('Running:', !!data.data);
