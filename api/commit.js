export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { tab, PlayerID, RVS, CRANK, Tier, CrankNotes } = req.body;

    // ✅ Only allow RVS_Input for safety
    if (tab !== "RVS_Input") {
      return res.status(403).json({ error: "Unauthorized tab access" });
    }

    // Build payload for GAS WebApp
    const update = { PlayerID, RVS, CRANK, Tier, CrankNotes };

    const gasRes = await fetch(process.env.GAS_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "commitRVSInput",
        update
      })
    });

    const json = await gasRes.json();
    res.status(200).json(json);

  } catch (err) {
    console.error("Commit failed", err);
    res.status(500).json({ error: err.message });
  }
}
