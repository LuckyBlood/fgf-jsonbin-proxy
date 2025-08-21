import { google } from "googleapis";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { tab, updates } = req.body;

  // ✅ Only allow RVS_Input for safety
  if (tab !== "RVS_Input") {
    return res.status(403).json({ error: "Unauthorized tab access" });
  }

  try {
    // Auth with Google
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });
    const sheets = google.sheets({ version: "v4", auth });

    const spreadsheetId = process.env.SPREADSHEET_ID;

    // For each update, find row by Join_Key (assumes Join_Key is in column A)
    for (const update of updates) {
            const { PlayerID, ...fields } = update;

      // Find row number where PlayerID matches column A
      const findResp = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${tab}!A:A` // Column A = PlayerID
      });
      const rows = findResp.data.values || [];
      const rowIndex = rows.findIndex(r => r[0] === PlayerID);
      if (rowIndex === -1) continue; // Skip if not found

      // Build values array in correct order (adjust columns as needed)
      const values = [Join_Key, fields.RVS ?? "", fields.CRANK ?? "", fields.Tier ?? ""];

      // Update row
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${tab}!A${rowIndex + 1}:D${rowIndex + 1}`, // A-D (adjust if needed)
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [values] }
      });
    }

    res.status(200).json({ message: "Updates committed successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to commit updates" });
  }
}
