   curl -X POST https://your-deployment.convex.site/webhooks/indiamart \
     -H "Content-Type: application/json" \
     -d '{
       "CODE": 200,
       "STATUS": "SUCCESS",
       "RESPONSE": {
         "UNIQUE_QUERY_ID": "TEST123",
         "SENDER_NAME": "Test User",
         "SUBJECT": "Test Inquiry",
         "SENDER_MOBILE": "9876543210",
         "SENDER_EMAIL": "test@example.com",
         "SENDER_COMPANY": "Test Company",
         "QUERY_MESSAGE": "Test message",
         "QUERY_TIME": "2025-12-11 06:24:06",
         "QUERY_TYPE": "W",
         "QUERY_MCAT_NAME": "Test Category",
         "QUERY_PRODUCT_NAME": "Test Product",
         "SENDER_COUNTRY_ISO": "IN"
       }
     }'
   