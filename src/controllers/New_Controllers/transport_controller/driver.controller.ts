import { type Request, type Response } from "express";
import mongoose, { Types } from "mongoose";
import { type IUpload } from "../../../models/New_Model/announcement_model/announcement.model.js";
import { uploadFileToS3New } from "../../../utils/s4UploadsNew.js";
import { DriverModel, type IDriverDocument } from "../../../models/New_Model/transport_model/driver.model.js";
// import { DriverModel, IUpload, IDriverDocument } from "./Driver.model";
// import { uploadFileToS3New, deleteFileFromS3New } from "../utils/s3"; // adjust path to your actual S3 util

/**
 * FILE UPLOAD CONVENTION (multer should be mounted at the route level using
 * `upload.any()` so every file lands in req.files as a flat array, each item
 * carrying its own `fieldname`. This controller does not touch multer itself.)
 *
 *  - fieldname "photo"            -> the single driver photo
 *  - fieldname "documents_<i>"    -> file(s) belonging to the i-th entry of
 *                                    the `documents` array sent in req.body
 *                                    (documents is sent as a JSON string:
 *                                    e.g. documents_0, documents_1, ...)
 *
 * req.body.documents (optional) looks like:
 * JSON.stringify([
 *   { documentName: "Driving License", detail: "TN-...", expiryDate: "2027-01-01", status: "valid" },
 *   { documentName: "Police Verification" }
 * ])
 */

const ALLOWED_DRIVER_DOCUMENT_NAMES = [
    "Driving License",
    "Badge",
    "Police Verification",
    "Medical Certificate",
    "Aadhar Card",
    "Other",
];


const isAllowedDocumentName = (name: any) =>
    typeof name === "string" &&
    ALLOWED_DRIVER_DOCUMENT_NAMES.some((allowed) => allowed.toLowerCase() === name.trim().toLowerCase());



// throws if any document in the final array has an invalid name, or if the same
// document name appears more than once (e.g. two "Aadhar Card" rows)
const assertValidDriverDocuments = (documents: any[]) => {
    const seen = new Set<string>();

    for (const doc of documents) {
        if (!doc.documentName) continue; // allow a placeholder row without a name yet

        if (!isAllowedDocumentName(doc.documentName)) {
            throw new Error(`"${doc.documentName}" is not a valid document name`);
        }

        const key = doc.documentName.trim().toLowerCase();
        if (seen.has(key)) {
            throw new Error(`Duplicate document: "${doc.documentName}" already exists for this driver`);
        }
        seen.add(key);
    }
};


const buildUpload = async (file: any): Promise<IUpload & { _id: Types.ObjectId }> => {
    const uploadData = await uploadFileToS3New(file);

    let fileType: "image" | "pdf" | "video" = "pdf";
    if (file.mimetype.startsWith("image/")) fileType = "image";
    else if (file.mimetype.startsWith("video/")) fileType = "video";

    return {
        _id: new mongoose.Types.ObjectId(),
        type: fileType,
        key: uploadData.key,
        url: uploadData.url,
        originalName: file.originalname,
        uploadedAt: new Date(),
    };
};

// ---------- CREATE ----------

export const createDriver = async (req: Request, res: Response) => {
    try {
        const {
            schoolId,
            name,
            phone,
            assignedBusId,
            dateOfBirth,
            joinedDate,
            emergencyContact,
            address,
            documents,
        } = req.body;

        const files = (req.files as any[]) || [];




        if (!schoolId) {
            return res.status(400).json({ ok: false, message: "schoolId is required" })
        }

        if (!name) {
            return res.status(400).json({ ok: false, message: "driver name is required" })
        }

        // parse document metadata (no files yet)
        let documentsPayload: Partial<IDriverDocument>[] = [];
        if (documents) {
            documentsPayload = typeof documents === "string" ? JSON.parse(documents) : documents;
        }

        // reject invalid/unknown document names and duplicate document types up front,
        // before touching S3 or the DB
        assertValidDriverDocuments(documentsPayload);

        // single photo upload
        let photo: IUpload | null = null;
        const photoFile = files.find((f) => f.fieldname === "photo");
        if (photoFile) {
            photo = await buildUpload(photoFile);
        }

        // build documents array with matched files (documents_<index>)
        const builtDocuments = await Promise.all(
            documentsPayload.map(async (doc, index) => {
                const docFiles = files.filter((f) => f.fieldname === `documents_${index}`);
                const uploadedFiles = docFiles.length ? await Promise.all(docFiles.map(buildUpload)) : [];

                return {
                    _id: new mongoose.Types.ObjectId(),
                    documentName: doc.documentName ?? null,
                    detail: doc.detail ?? null,
                    expiryDate: doc.expiryDate ?? null,
                    status: doc.status ?? "valid",
                    files: uploadedFiles,
                };
            })
        );

        const driver = await DriverModel.create({
            schoolId: schoolId,
            name,
            phone,
            assignedBusId: assignedBusId ?? null,
            dateOfBirth: dateOfBirth ?? null,
            joinedDate: joinedDate ?? null,
            emergencyContact: emergencyContact ?? null,
            address: address ?? null,
            photo,
            documents: builtDocuments,
        });

        res.status(201).json({ ok: true, data: driver, messsage: "created successfully" });
    } catch (error: any) {
        console.error("Create driver Error:", error);
        res.status(500).json({ ok: false, message: error.message });
    }
};

// ---------- GET ALL (no pagination) ----------

export const getAllDrivers = async (req: Request, res: Response) => {
    try {
        const { schoolId, status, search } = req.query;

        const filter: any = {};
        if (schoolId) filter.schoolId = schoolId;
        if (status) filter.status = status;
        // if(search) filter.name = search 

        if (search) {
            const searchString = String(search).trim();
            const searchRegex = new RegExp(searchString, "i"); // "i" makes it case-insensitive
            filter.$or = [
                { name: searchRegex },
                { phone: searchRegex }
            ];
        }

        const drivers = await DriverModel.find(filter)
            .populate("assignedBusId", "_id busNumber registrationNo")
            .sort({ createdAt: -1 });

        res.status(200).json({ ok: true, data: drivers });
    } catch (error: any) {
        console.error("Get all drivers Error:", error);
        res.status(500).json({ ok: false, message: error.message });
    }
};



export const getAllDriverDropDown = async (req: Request, res: Response) => {
    try {
        const { schoolId } = req.params;

        const drivers = await DriverModel.find({ schoolId: schoolId }).select("_id name assignedBusId")
            .populate("assignedBusId", "_id busNumber")
            .sort({ createdAt: -1 });

        res.status(200).json({ ok: true, data: drivers });
    } catch (error: any) {
        console.error("Get all drivers drop down  Error:", error);
        res.status(500).json({ ok: false, message: error.message });
    }
};

// ---------- GET BY ID ----------

export const getDriverById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const driver = await DriverModel.findById(id).populate(
            "assignedBusId",
            "busNumber registrationNo"
        );

        if (!driver) {
            return res.status(404).json({ ok: false, message: "Driver not found" });
        }

        res.status(200).json({ ok: true, data: driver });
    } catch (error: any) {
        console.error("Get driver by id Error:", error);
        res.status(500).json({ ok: false, message: error.message });
    }
};

// ---------- UPDATE (text fields + photo + document files, merged) ----------

export const updateDriver = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const driver = await DriverModel.findById(id);
        if (!driver) {
            return res.status(404).json({ ok: false, message: "Driver not found" });
        }

        const {
            name,
            phone,
            assignedBusId,
            dateOfBirth,
            joinedDate,
            emergencyContact,
            address,
            status,
            documents,
        } = req.body;

        if (name !== undefined) driver.name = name;
        if (phone !== undefined) driver.phone = phone;
        if (assignedBusId !== undefined) driver.assignedBusId = assignedBusId ?? null;
        if (dateOfBirth !== undefined) driver.dateOfBirth = dateOfBirth ?? null;
        if (joinedDate !== undefined) driver.joinedDate = joinedDate ?? null;
        if (emergencyContact !== undefined) driver.emergencyContact = emergencyContact ?? null;
        if (address !== undefined) driver.address = address ?? null;
        if (status !== undefined) driver.status = status;

        const files = (req.files as any[]) || [];

        // replace photo if a new one is uploaded
        const photoFile = files.find((f) => f.fieldname === "photo");
        if (photoFile) {
            // if (driver.photo?.key) {
            //     try {
            //         await deleteFileFromS3New(driver.photo.key);
            //     } catch (err) {
            //         console.error("Old photo delete failed (continuing):", err);
            //     }
            // }
            driver.photo = await buildUpload(photoFile);
        }

        // merge documents metadata + append any newly uploaded files (documents_<index>)
        // IMPORTANT: this is a true merge, not an array replace — we start from the driver's
        // existing documents and only touch the rows this payload actually mentions. Any
        // existing document not included in `documents` this time stays exactly as-is.
        if (documents !== undefined) {
            const documentsPayload: Partial<IDriverDocument>[] =
                typeof documents === "string" ? JSON.parse(documents) : documents;

            const updatedDocuments: any[] = [...driver.documents];
            await Promise.all(
                documentsPayload.map(async (doc: any, index: number) => {
                    const docFiles = files.filter((f) => f.fieldname === `documents_${index}`);
                    const uploadedFiles = docFiles.length ? await Promise.all(docFiles.map(buildUpload)) : [];

                    if (doc._id) {
                        // updating an existing row (rename, change detail/expiry/status, and/or add more files)
                        const existingIndex = updatedDocuments.findIndex(
                            (d: any) => String(d._id) === String(doc._id)
                        );
                        if (existingIndex === -1) return; // stale/unknown _id — ignore rather than duplicate

                        const existing = updatedDocuments[existingIndex];
                        updatedDocuments[existingIndex] = {
                            _id: existing._id,
                            documentName: doc.documentName ?? existing.documentName ?? null,
                            detail: doc.detail ?? existing.detail ?? null,
                            expiryDate: doc.expiryDate ?? existing.expiryDate ?? null,
                            status: doc.status ?? existing.status ?? "valid",
                            files: [...(existing.files ?? []), ...uploadedFiles],
                        };
                    } else {
                        // brand new row
                        updatedDocuments.push({
                            _id: new mongoose.Types.ObjectId(),
                            documentName: doc.documentName ?? null,
                            detail: doc.detail ?? null,
                            expiryDate: doc.expiryDate ?? null,
                            status: doc.status ?? "valid",
                            files: uploadedFiles,
                        });
                    }
                })
            );

            // validate the FINAL merged array — catches duplicates created by this update
            // even when the duplicate involves a row that wasn't itself part of this payload
            assertValidDriverDocuments(updatedDocuments);

            driver.documents = updatedDocuments as any;
        }

        await driver.save();

        res.status(200).json({ ok: true, data: driver });
    } catch (error: any) {
        console.error("Update driver Error:", error);
        res.status(500).json({ ok: false, message: error.message });
    }
};

// ---------- DELETE ----------

export const deleteDriver = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const driver = await DriverModel.findByIdAndDelete(id);
        if (!driver) {
            return res.status(404).json({ ok: false, message: "Driver not found" });
        }

        res.status(200).json({ ok: true, message: "Driver deleted" });
    } catch (error: any) {
        console.error("Delete driver Error:", error);
        res.status(500).json({ ok: false, message: error.message });
    }
};

// ---------- DELETE A SINGLE ATTACHMENT FROM A DOCUMENT'S FILES ----------

export const deleteDriverDocumentAttachment = async (req: Request, res: Response) => {
    try {
        const { id, documentId, fileId } = req.params;

        const driver = await DriverModel.findById(id);
        if (!driver) {
            return res.status(404).json({ ok: false, message: "Driver not found" });
        }

        const document = driver.documents.find((d: any) => String(d._id) === String(documentId));
        if (!document) {
            return res.status(404).json({ ok: false, message: "Document not found" });
        }

        const file = document.files.find((f: any) => String(f._id) === String(fileId));
        if (!file) {
            return res.status(404).json({ ok: false, message: "File not found" });
        }

        // if (file.key) {
        //     try {
        //         await deleteFileFromS3New(file.key);
        //     } catch (err) {
        //         console.error("S3 file delete failed (continuing):", err);
        //     }
        // }

        document.files = document.files.filter((f: any) => String(f._id) !== String(fileId)) as any;

        await driver.save();

        res.status(200).json({ ok: true, data: driver });
    } catch (error: any) {
        console.error("Delete driver document attachment Error:", error);
        res.status(500).json({ ok: false, message: error.message });
    }
};