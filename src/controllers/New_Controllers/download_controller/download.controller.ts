import type { Response } from "express";
import { getSignedUrlForKey } from "../../../utils/s4UploadsNew.js";
import type { RoleBasedRequest } from "../../../utils/types.js";

// --- DOWNLOAD CONTROLLER ---
export const downloadProof = async (req:RoleBasedRequest, res:Response) => {
    try {
        const { key } = req.query; // Expecting ?key=images/xyz.jpg

        if (!key) {
            return res.status(400).json({ message: "File key is required", ok:false });
        }

        // Generate a secure, temporary link
        const downloadUrl = getSignedUrlForKey(key);

       return res.status(200).json({
            url: downloadUrl,
            message: "Link expires in 15 minutes",
            ok:true

        });


        // Returns JSON like Vertical Living
        // res.json({ url: downloadUrl });

    } catch (error:any) {
        console.error(error);
        // 🌟 Guardrail: Check if a response has already been sent before crashing the server
        if (res.headersSent) {
            console.warn("Headers were already sent. Skipping duplicate error response handling.");
            return;
        }
       return res.status(500).json({ message: "Error generating download link" });
    }
};