curl -X POST https://YOUR-PROJECT.vercel.app/api/fgf/commit \
  -H "Content-Type: application/json" \
  -d '{
    "tab": "RVS_Input",
    "updates": [
      { "Join_Key": "Bijan_Robinson", "RVS": 12, "CRANK": 5, "Tier": "Tier 1" }
    ]
  }'
