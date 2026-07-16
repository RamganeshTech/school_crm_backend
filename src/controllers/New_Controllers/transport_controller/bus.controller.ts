import { type Request, type Response } from "express";
import mongoose from "mongoose";
import { uploadFileToS3New } from "../../../utils/s4UploadsNew.js";
import { BusModel, type IStatutoryDocument } from "../../../models/New_Model/transport_model/bus.model.js";
// import { BusModel, IStatutoryDocument } from "./Bus.model";

/**
 * FILE UPLOAD CONVENTION (multer should be mounted at the route level using
 * `upload.any()` so every file lands in req.files as a flat array, each item
 * carrying its own `fieldname`. This controller does not touch multer itself.)
 *
 *  - fieldname "statutoryDocuments_<i>" -> file(s) belonging to the i-th entry
 *    of the `statutoryDocuments` array sent in req.body (as a JSON string):
 *
 * req.body.statutoryDocuments looks like:
 * JSON.stringify([
 *   { documentName: "Insurance", expiry: "2027-01-01", lastCost: 12500, status: "valid" },
 *   { documentName: "PUC" }
 * ])
 */

const buildUpload = async (file: any) => {
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

// fixed set — every bus must have exactly these 5 statutory documents, nothing more, nothing less.
const ALLOWED_BUS_DOCUMENT_NAMES = ["FC", "Insurance", "Permit", "Pollution", "Road Tax"];

// validates whatever is being submitted: each name (if provided) must be one of the allowed 5,
// and no two entries in this array can share the same name. Nothing is required — an empty or
// missing documents array is fine, this only checks what's actually there.
const validateBusDocuments = (documents: any[]) => {
    const seen = new Set<string>();

    for (const doc of documents) {
        if (!doc.documentName) continue; // allow a placeholder row without a name yet

        const name = String(doc.documentName).trim();
        const isAllowed = ALLOWED_BUS_DOCUMENT_NAMES.some(
            (allowed) => allowed.toLowerCase() === name.toLowerCase()
        );
        if (!isAllowed) {
            throw new Error(
                `"${name}" is not a valid statutory document name. Allowed: ${ALLOWED_BUS_DOCUMENT_NAMES.join(", ")}`
            );
        }

        const key = name.toLowerCase();
        if (seen.has(key)) {
            throw new Error(`Duplicate statutory document: "${name}" already exists for this bus`);
        }
        seen.add(key);
    }
};


// ---------- CREATE ----------

export const createBus = async (req: Request, res: Response) => {
    try {
        const {
            schoolId,
            busNumber,
            registrationNo,
            makeModel,
            year,
            seatingCapacity,
            fuelType,
            chassisNo,
            engineNo,
            purchaseDate,
            rcOwner,
            nextServiceDate,
            lastServiceDate,
            assignedDriverId,
            operationalStatus,
            statutoryDocuments,
        } = req.body;

        const files = (req.files as any[]) || [];

        // parse statutory document metadata (no files yet)
        let documentsPayload: Partial<IStatutoryDocument>[] = [];
        if (statutoryDocuments) {
            documentsPayload =
                typeof statutoryDocuments === "string" ? JSON.parse(statutoryDocuments) : statutoryDocuments;
        }

        // whatever is sent must use a valid name and not repeat one — nothing is required to be present
        validateBusDocuments(documentsPayload);

        // build statutory documents array with matched files (statutoryDocuments_<index>)
        const builtDocuments = await Promise.all(
            documentsPayload.map(async (doc, index) => {
                const docFiles = files.filter((f) => f.fieldname === `statutoryDocuments_${index}`);
                const uploadedFiles = docFiles.length ? await Promise.all(docFiles.map(buildUpload)) : [];

                return {
                    documentName: doc.documentName ?? null,
                    expiry: doc.expiry ?? null,
                    lastCost: doc.lastCost ?? 0,
                    status: doc.status ?? "valid",
                    files: uploadedFiles,
                };
            })
        );

        const bus = await BusModel.create({
            schoolId: schoolId ?? null,
            busNumber: busNumber ?? null,
            registrationNo: registrationNo ?? null,
            makeModel: makeModel ?? null,
            year: year ?? null,
            seatingCapacity: seatingCapacity ?? null,
            fuelType: fuelType ?? null,
            chassisNo: chassisNo ?? null,
            engineNo: engineNo ?? null,
            purchaseDate: purchaseDate ?? null,
            rcOwner: rcOwner ?? null,
            nextServiceDate: nextServiceDate ?? null,
            lastServiceDate: lastServiceDate ?? null,
            assignedDriverId: assignedDriverId ?? null,
            operationalStatus: operationalStatus ?? "active",
            statutoryDocuments: builtDocuments,
        });

        res.status(201).json({ ok: true, data: bus });
    } catch (error: any) {
        console.error("Create bus Error:", error);
        res.status(500).json({ ok: false, message: error.message });
    }
};

// ---------- GET ALL (no pagination) ----------

export const getAllBuses = async (req: Request, res: Response) => {
    try {
        // const { schoolId, operationalStatus, search } = req.query;
        const { schoolId, operationalStatus, search, nextServiceFrom, nextServiceTo } = req.query;

      const filter: any = {};
        if (schoolId) filter.schoolId = schoolId;
        if (operationalStatus) filter.operationalStatus = operationalStatus;

        // --- NEW: Next Service Date Range Filter ---
        if (nextServiceFrom || nextServiceTo) {
            filter.nextServiceDate = {};
            if (nextServiceFrom) filter.nextServiceDate.$gte = new Date(nextServiceFrom as string);
            if (nextServiceTo) filter.nextServiceDate.$lte = new Date(nextServiceTo as string);
        }

        // --- UPDATED: Expanded Search ---
        if (search) {
            const searchString = String(search).trim();
            const searchRegex = new RegExp(searchString, "i"); // case-insensitive
            filter.$or = [
                { busNumber: searchRegex },
                { registrationNo: searchRegex },
                { chassisNo: searchRegex },
                { engineNo: searchRegex },
                { rcOwner: searchRegex },
                { makeModel: searchRegex }
            ];
        }

        const buses = await BusModel.find(filter)
            .populate("assignedDriverId", "name phone")
            .sort({ createdAt: -1 });

        res.status(200).json({ ok: true, data: buses });
    } catch (error: any) {
        console.error("Get all buses Error:", error);
        res.status(500).json({ ok: false, message: error.message });
    }
};


export const getAllBusesDropDown = async (req: Request, res: Response) => {
    try {
        const { schoolId } = req.params;

        const buses = await BusModel.find({ schoolId: schoolId }).select("_id busNumber registrationNo assignedDriverId")
            .populate("assignedDriverId", "_id name phone")
            .sort({ createdAt: -1 });

        res.status(200).json({ ok: true, data: buses });
    } catch (error: any) {
        console.error("Get all buses drop down  Error:", error);
        res.status(500).json({ ok: false, message: error.message });
    }
};

// ---------- GET BY ID ----------

export const getBusById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const bus = await BusModel.findById(id).populate("assignedDriverId", "name phone");

        if (!bus) {
            return res.status(404).json({ ok: false, message: "Bus not found" });
        }

        res.status(200).json({ ok: true, data: bus });
    } catch (error: any) {
        console.error("Get bus by id Error:", error);
        res.status(500).json({ ok: false, message: error.message });
    }
};


export const updateBus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const bus = await BusModel.findById(id);
        if (!bus) {
            return res.status(404).json({ ok: false, message: "Bus not found" });
        }

        const {
            busNumber,
            registrationNo,
            makeModel,
            year,
            seatingCapacity,
            fuelType,
            chassisNo,
            engineNo,
            purchaseDate,
            rcOwner,
            nextServiceDate,
            lastServiceDate,
            assignedDriverId,
            operationalStatus,
            statutoryDocuments,
        } = req.body;

        // Update bus details
        if (busNumber !== undefined) bus.busNumber = busNumber;
        if (registrationNo !== undefined) bus.registrationNo = registrationNo;
        if (makeModel !== undefined) bus.makeModel = makeModel;
        if (year !== undefined) bus.year = year;
        if (seatingCapacity !== undefined) bus.seatingCapacity = seatingCapacity;
        if (fuelType !== undefined) bus.fuelType = fuelType;
        if (chassisNo !== undefined) bus.chassisNo = chassisNo;
        if (engineNo !== undefined) bus.engineNo = engineNo;
        if (purchaseDate !== undefined) bus.purchaseDate = purchaseDate;
        if (rcOwner !== undefined) bus.rcOwner = rcOwner;
        if (nextServiceDate !== undefined) bus.nextServiceDate = nextServiceDate;
        if (lastServiceDate !== undefined) bus.lastServiceDate = lastServiceDate;
        if (assignedDriverId !== undefined)
            bus.assignedDriverId = assignedDriverId ?? null;
        if (operationalStatus !== undefined)
            bus.operationalStatus = operationalStatus;

        const files = (req.files as any[]) || [];

        // Merge statutory documents
        if (statutoryDocuments !== undefined) {
            const documentsPayload: Partial<IStatutoryDocument>[] =
                typeof statutoryDocuments === "string"
                    ? JSON.parse(statutoryDocuments)
                    : statutoryDocuments;

            // Start with existing documents
            const updatedDocuments: any[] = [...bus.statutoryDocuments];

            await Promise.all(
                documentsPayload.map(async (doc: any, index: number) => {
                    const docFiles = files.filter(
                        (f) => f.fieldname === `statutoryDocuments_${index}`
                    );

                    const uploadedFiles = docFiles.length
                        ? await Promise.all(docFiles.map(buildUpload))
                        : [];

                    if (doc._id) {
                        // Update existing document
                        const existingIndex = updatedDocuments.findIndex(
                            (d: any) => String(d._id) === String(doc._id)
                        );

                        if (existingIndex === -1) return;

                        const existing = updatedDocuments[existingIndex];

                        updatedDocuments[existingIndex] = {
                            _id: existing._id,
                            documentName: doc.documentName ?? existing.documentName ?? null,
                            expiry: doc.expiry ?? existing.expiry ?? null,
                            lastCost: doc.lastCost ?? existing.lastCost ?? 0,
                            status: doc.status ?? existing.status ?? "valid",
                            files: [...(existing.files ?? []), ...uploadedFiles],
                        };
                    } else {
                        // Add new document
                        updatedDocuments.push({
                            _id: new mongoose.Types.ObjectId(),
                            documentName: doc.documentName ?? null,
                            expiry: doc.expiry ?? null,
                            lastCost: doc.lastCost ?? 0,
                            status: doc.status ?? "valid",
                            files: uploadedFiles,
                        });
                    }
                })
            );

            // Validate final merged documents
            validateBusDocuments(updatedDocuments);

            bus.statutoryDocuments = updatedDocuments as any;
        }

        await bus.save();

        res.status(200).json({
            ok: true,
            data: bus,
        });
    } catch (error: any) {
        console.error("Update bus Error:", error);
        res.status(500).json({
            ok: false,
            message: error.message,
        });
    }
};

// ---------- DELETE ----------

export const deleteBus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const bus = await BusModel.findByIdAndDelete(id);
        if (!bus) {
            return res.status(404).json({ ok: false, message: "Bus not found" });
        }

        res.status(200).json({ ok: true, message: "Bus deleted" });
    } catch (error: any) {
        console.error("Delete bus Error:", error);
        res.status(500).json({ ok: false, message: error.message });
    }
};

// ---------- DELETE A SINGLE ATTACHMENT FROM A STATUTORY DOCUMENT'S FILES ----------

export const deleteBusDocumentAttachment = async (req: Request, res: Response) => {
    try {
        const { id, documentId, fileId } = req.params;

        const bus = await BusModel.findById(id);
        if (!bus) {
            return res.status(404).json({ ok: false, message: "Bus not found" });
        }

        const document = bus.statutoryDocuments.find((d: any) => String(d._id) === String(documentId));
        if (!document) {
            return res.status(404).json({ ok: false, message: "Document not found" });
        }

        const file = document.files.find((f: any) => String(f._id) === String(fileId));
        if (!file) {
            return res.status(404).json({ ok: false, message: "File not found" });
        }

        // if (file.key) {
        //   try {
        //     await deleteFileFromS3New(file.key);
        //   } catch (err) {
        //     console.error("S3 file delete failed (continuing):", err);
        //   }
        // }

        document.files = document.files.filter((f: any) => String(f._id) !== String(fileId)) as any;

        await bus.save();

        res.status(200).json({ ok: true, data: bus });
    } catch (error: any) {
        console.error("Delete bus document attachment Error:", error);
        res.status(500).json({ ok: false, message: error.message });
    }
};