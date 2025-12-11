curl -X POST https://polished-marmot-96.convex.cloud/webhooks/indiamart \
  -H "Content-Type: application/json" \
  -d '{
    "CODE": 200,
    "STATUS": "SUCCESS",
    "RESPONSE": {
      "UNIQUE_QUERY_ID": "test123",
      "SENDER_NAME": "Test User",
      "SUBJECT": "Test Subject",
      "SENDER_MOBILE": "1234567890",
      "SENDER_EMAIL": "test@example.com",
      "QUERY_MESSAGE": "Test message"
    }
  }'
